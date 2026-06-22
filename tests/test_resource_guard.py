"""Unit tests for resource_guard module."""

import sys
import time

import pytest

REPO_ROOT = __import__("os").path.abspath(__import__("os").path.join(__import__("os").path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from services.resource_guard import ResourceGuard, ResourceExhaustedError


class TestResourceGuardInit:
    def test_uses_default_values(self):
        guard = ResourceGuard()
        assert guard.max_rows == 150000
        assert guard.timeout_seconds == 30
        assert guard.rows_processed == 0

    def test_accepts_custom_limits(self):
        guard = ResourceGuard(max_rows=1000, timeout_seconds=5)
        assert guard.max_rows == 1000
        assert guard.timeout_seconds == 5


class TestCheckTime:
    def test_passes_within_timeout(self):
        guard = ResourceGuard(timeout_seconds=30)
        # Should not raise within the first second
        guard.check_time()

    def test_raises_after_timeout(self):
        # Create a guard that already expired
        guard = ResourceGuard(timeout_seconds=0)
        time.sleep(0.01)
        with pytest.raises(ResourceExhaustedError, match="Processing timeout exceeded"):
            guard.check_time()


class TestIncrementRows:
    def test_increments_row_count(self):
        guard = ResourceGuard(max_rows=100)
        guard.increment_rows(10)
        assert guard.rows_processed == 10
        guard.increment_rows(20)
        assert guard.rows_processed == 30

    def test_raises_when_max_rows_exceeded(self):
        guard = ResourceGuard(max_rows=100)
        with pytest.raises(ResourceExhaustedError, match="Maximum row count"):
            guard.increment_rows(101)

    def test_does_not_raise_at_exact_limit(self):
        guard = ResourceGuard(max_rows=100)
        guard.increment_rows(100)  # Exactly at limit
        # Should not raise

    def test_tracks_cumulative_rows_across_calls(self):
        guard = ResourceGuard(max_rows=50)
        guard.increment_rows(20)
        guard.increment_rows(20)
        with pytest.raises(ResourceExhaustedError):
            guard.increment_rows(15)  # 55 > 50


class TestCheckResourceLimits:
    def test_calls_both_checks(self):
        guard = ResourceGuard(max_rows=10, timeout_seconds=30)
        guard.check_resource_limits(5)
        assert guard.rows_processed == 5

    def test_raises_on_row_limit_via_check_resource_limits(self):
        guard = ResourceGuard(max_rows=10, timeout_seconds=30)
        with pytest.raises(ResourceExhaustedError):
            guard.check_resource_limits(15)
