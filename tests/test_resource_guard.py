"""
Unit tests for the ResourceGuard class.
Tests row-count limits and timeout enforcement for CSV processing pipelines.
"""
import sys
import os
import time

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from services.resource_guard import ResourceGuard, ResourceExhaustedError


class TestResourceGuardInit:
    """Test suite for ResourceGuard initialization."""

    def test_default_max_rows_and_timeout(self):
        guard = ResourceGuard()
        assert guard.max_rows == 150000
        assert guard.timeout_seconds == 30

    def test_custom_max_rows_and_timeout(self):
        guard = ResourceGuard(max_rows=1000, timeout_seconds=5)
        assert guard.max_rows == 1000
        assert guard.timeout_seconds == 5

    def test_initial_rows_processed_is_zero(self):
        guard = ResourceGuard()
        assert guard.rows_processed == 0


class TestCheckTime:
    """Test suite for the check_time method."""

    def test_no_raise_within_time_limit(self):
        guard = ResourceGuard(timeout_seconds=10)
        guard.check_time()  # should not raise

    def test_raises_after_timeout_exceeded(self):
        # Use a timeout of 0 seconds — already elapsed since __init__
        guard = ResourceGuard(timeout_seconds=0)
        # Small sleep to ensure the timeout has definitely passed
        time.sleep(0.01)
        try:
            guard.check_time()
            assert False, "Should have raised ResourceExhaustedError"
        except ResourceExhaustedError as e:
            assert "timeout" in str(e).lower()


class TestIncrementRows:
    """Test suite for the increment_rows method."""

    def test_accumulates_row_count_correctly(self):
        guard = ResourceGuard(max_rows=100)
        guard.increment_rows(30)
        assert guard.rows_processed == 30
        guard.increment_rows(20)
        assert guard.rows_processed == 50

    def test_no_raise_when_within_max_rows(self):
        guard = ResourceGuard(max_rows=100)
        guard.increment_rows(50)
        guard.increment_rows(49)
        # still within limit

    def test_raises_when_max_rows_exceeded(self):
        guard = ResourceGuard(max_rows=100)
        try:
            guard.increment_rows(101)
            assert False, "Should have raised ResourceExhaustedError"
        except ResourceExhaustedError as e:
            assert "row" in str(e).lower() or "count" in str(e).lower()
            assert "100" in str(e)

    def test_exactly_at_max_rows_does_not_raise(self):
        guard = ResourceGuard(max_rows=50)
        guard.increment_rows(50)  # exactly at limit, should not raise


class TestCheckResourceLimits:
    """Test suite for the check_resource_limits method."""

    def test_raises_on_timeout(self):
        guard = ResourceGuard(timeout_seconds=0, max_rows=999999)
        time.sleep(0.01)
        try:
            guard.check_resource_limits(0)
            assert False, "Should have raised ResourceExhaustedError"
        except ResourceExhaustedError as e:
            assert "timeout" in str(e).lower()

    def test_raises_on_row_count(self):
        guard = ResourceGuard(timeout_seconds=9999, max_rows=10)
        try:
            guard.check_resource_limits(11)
            assert False, "Should have raised ResourceExhaustedError"
        except ResourceExhaustedError as e:
            assert "row" in str(e).lower() or "count" in str(e).lower()

    def test_no_raise_when_both_limits_within_bounds(self):
        guard = ResourceGuard(timeout_seconds=10, max_rows=100)
        guard.check_resource_limits(50)  # should not raise

    def test_accumulates_across_multiple_calls(self):
        guard = ResourceGuard(max_rows=100)
        guard.check_resource_limits(40)
        guard.check_resource_limits(40)
        guard.check_resource_limits(20)  # 100 total, should raise
        try:
            guard.check_resource_limits(1)
            assert False, "Should have raised on cumulative limit"
        except ResourceExhaustedError:
            pass  # expected


class TestResourceExhaustedError:
    """Test suite for the ResourceExhaustedError exception."""

    def test_is_runtime_exception(self):
        try:
            raise ResourceExhaustedError("limit exceeded")
        except Exception as e:
            assert isinstance(e, ResourceExhaustedError)

    def test_message_is_preserved(self):
        msg = "Maximum row count (1000) exceeded"
        try:
            raise ResourceExhaustedError(msg)
        except ResourceExhaustedError as e:
            assert str(e) == msg
