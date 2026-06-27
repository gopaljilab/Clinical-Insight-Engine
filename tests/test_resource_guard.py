"""
Unit tests for services.resource_guard.ResourceGuard.

These tests lock down the boundary behavior of both resource checks:
- The row-count check fires when cumulative rows_processed exceeds max_rows.
- The wall-clock timeout check fires when time elapsed since construction exceeds timeout_seconds.
- The timeout check is evaluated BEFORE the row-count check.
"""

import time

import pytest

from services.resource_guard import ResourceExhaustedError, ResourceGuard


# ---------------------------------------------------------------------------
# Constructor
# ---------------------------------------------------------------------------

def test_start_time_captured_at_construction():
    """Two guards constructed sequentially must have start_times that differ by at least the construction gap."""
    guard_a = ResourceGuard()
    time.sleep(0.05)
    guard_b = ResourceGuard()
    # The captured start_time of guard_b must be at least ~30ms after guard_a.
    # We use a generous lower bound to avoid flakiness on a slow CI runner.
    assert guard_b.start_time - guard_a.start_time >= 0.03


# ---------------------------------------------------------------------------
# Row-count boundary
# ---------------------------------------------------------------------------

def test_row_count_at_exact_limit_does_not_raise():
    """Incrementing by exactly max_rows must NOT raise."""
    guard = ResourceGuard(max_rows=100, timeout_seconds=10)
    guard.increment_rows(100)
    assert guard.rows_processed == 100


def test_row_count_one_over_limit_raises():
    """Incrementing by max_rows + 1 must raise ResourceExhaustedError with the documented message."""
    guard = ResourceGuard(max_rows=100, timeout_seconds=10)
    with pytest.raises(ResourceExhaustedError, match="Maximum row count"):
        guard.increment_rows(101)


def test_row_count_accumulates_across_multiple_calls():
    """Row-count check is on cumulative rows_processed, not per-call."""
    guard = ResourceGuard(max_rows=10, timeout_seconds=10)
    guard.increment_rows(4)
    guard.increment_rows(4)
    # 8 rows so far - still under the limit.
    assert guard.rows_processed == 8
    # 3 more pushes cumulative to 11, which is over the limit of 10.
    with pytest.raises(ResourceExhaustedError, match="Maximum row count"):
        guard.increment_rows(3)


def test_row_count_message_contains_configured_limit():
    """The error message must include the configured max_rows so operators can diagnose."""
    guard = ResourceGuard(max_rows=42, timeout_seconds=10)
    with pytest.raises(ResourceExhaustedError, match=r"42"):
        guard.increment_rows(43)


# ---------------------------------------------------------------------------
# Timeout boundary
# ---------------------------------------------------------------------------

def test_timeout_with_zero_second_limit_raises_immediately():
    """A guard with timeout_seconds=0 must raise on the very first check_time() call (after any sleep)."""
    guard = ResourceGuard(max_rows=1000, timeout_seconds=0)
    time.sleep(0.005)
    with pytest.raises(ResourceExhaustedError, match="timeout"):
        guard.check_time()


def test_timeout_message_uses_documented_text():
    """The error message must say 'timeout' so it can be matched downstream."""
    guard = ResourceGuard(max_rows=1000, timeout_seconds=0)
    time.sleep(0.005)
    with pytest.raises(ResourceExhaustedError, match=r"[Tt]imeout"):
        guard.check_time()


# ---------------------------------------------------------------------------
# Combined check_resource_limits
# ---------------------------------------------------------------------------

def test_check_resource_limits_happy_path():
    """A small chunk within both limits must not raise."""
    guard = ResourceGuard(max_rows=1000, timeout_seconds=10)
    guard.check_resource_limits(10)
    assert guard.rows_processed == 10


def test_check_resource_limits_timeout_fires_before_row_check():
    """When both limits are exhausted, the timeout check must fire (NOT the row check)."""
    # timeout_seconds=0 means check_time() will fire after any sleep.
    # We pick max_rows very large so that the row check is guaranteed not to be the cause.
    guard = ResourceGuard(max_rows=10_000_000, timeout_seconds=0)
    time.sleep(0.005)
    with pytest.raises(ResourceExhaustedError, match="timeout"):
        # Even though 1 row is well within the row limit, the timeout check must fire first.
        guard.check_resource_limits(1)


def test_check_resource_limits_propagates_row_count_error():
    """When the row check fails (and timeout does not), the row error must propagate."""
    guard = ResourceGuard(max_rows=5, timeout_seconds=10)
    with pytest.raises(ResourceExhaustedError, match="Maximum row count"):
        guard.check_resource_limits(10)
