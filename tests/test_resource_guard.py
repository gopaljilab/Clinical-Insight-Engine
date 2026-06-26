"""
Unit tests for the ResourceGuard class in services/resource_guard.py.
"""
import sys
import os
import time

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from services.resource_guard import ResourceGuard, ResourceExhaustedError


class TestResourceExhaustedError:
    """Test suite for the ResourceExhaustedError exception."""

    def test_is_exception(self):
        """Verify ResourceExhaustedError is an Exception subclass."""
        err = ResourceExhaustedError("timeout")
        assert isinstance(err, Exception)

    def test_preserves_message(self):
        """Verify the error message is preserved."""
        msg = "Maximum row count exceeded"
        err = ResourceExhaustedError(msg)
        assert str(err) == msg


class TestResourceGuard:
    """Test suite for the ResourceGuard class."""

    def test_constructor_defaults(self):
        """Verify default constructor sets expected limits."""
        guard = ResourceGuard()
        assert guard.max_rows == 150000
        assert guard.timeout_seconds == 30
        assert guard.rows_processed == 0

    def test_constructor_custom_limits(self):
        """Verify custom max_rows and timeout_seconds are set."""
        guard = ResourceGuard(max_rows=5000, timeout_seconds=10)
        assert guard.max_rows == 5000
        assert guard.timeout_seconds == 10

    def test_check_time_within_timeout(self):
        """check_time does not raise when within timeout window."""
        guard = ResourceGuard(timeout_seconds=30)
        # Fresh guard should not raise
        guard.check_time()  # should not raise

    def test_check_time_past_timeout(self):
        """check_time raises ResourceExhaustedError after timeout exceeded."""
        guard = ResourceGuard(timeout_seconds=0)
        time.sleep(0.05)  # wait just over the zero timeout
        try:
            guard.check_time()
            assert False, "Expected ResourceExhaustedError"
        except ResourceExhaustedError as e:
            assert "timeout" in str(e).lower()

    def test_increment_rows_within_limit(self):
        """increment_rows does not raise when under max_rows."""
        guard = ResourceGuard(max_rows=100)
        guard.increment_rows(50)
        assert guard.rows_processed == 50
        guard.increment_rows(49)
        assert guard.rows_processed == 99

    def test_increment_rows_at_limit_boundary(self):
        """increment_rows does not raise when rows equal max_rows."""
        guard = ResourceGuard(max_rows=10)
        guard.increment_rows(10)
        assert guard.rows_processed == 10  # exactly at limit, no error

    def test_increment_rows_exceeds_limit(self):
        """increment_rows raises ResourceExhaustedError when exceeding max_rows."""
        guard = ResourceGuard(max_rows=10)
        guard.increment_rows(10)  # exactly at limit - does NOT raise (10 > 10 is False)
        assert guard.rows_processed == 10
        try:
            guard.increment_rows(1)  # one more exceeds
            assert False, "Expected ResourceExhaustedError"
        except ResourceExhaustedError as e:
            assert "row" in str(e).lower()

    def test_increment_rows_large_batch(self):
        """increment_rows correctly accumulates large batch counts."""
        guard = ResourceGuard(max_rows=1_000_000)
        guard.increment_rows(500_000)
        assert guard.rows_processed == 500_000
        guard.increment_rows(499_999)
        assert guard.rows_processed == 999_999
        # One more should exceed
        try:
            guard.increment_rows(2)
            assert False, "Expected ResourceExhaustedError"
        except ResourceExhaustedError:
            pass

    def test_check_resource_limits_calls_time_check(self):
        """check_resource_limits raises on timeout."""
        guard = ResourceGuard(timeout_seconds=0)
        time.sleep(0.05)
        try:
            guard.check_resource_limits(0)
            assert False, "Expected ResourceExhaustedError"
        except ResourceExhaustedError as e:
            assert "timeout" in str(e).lower()

    def test_check_resource_limits_calls_row_check(self):
        """check_resource_limits raises on row count exceeded."""
        guard = ResourceGuard(max_rows=5)
        try:
            guard.check_resource_limits(10)  # chunk larger than limit
            assert False, "Expected ResourceExhaustedError"
        except ResourceExhaustedError as e:
            assert "row" in str(e).lower()

    def test_check_resource_limits_happy_path(self):
        """check_resource_limits does not raise for valid chunk."""
        guard = ResourceGuard(max_rows=100, timeout_seconds=30)
        guard.check_resource_limits(50)
        assert guard.rows_processed == 50

    def test_multiple_check_resource_limits_accumulate_rows(self):
        """Multiple check_resource_limits calls accumulate row count."""
        guard = ResourceGuard(max_rows=20)
        guard.check_resource_limits(5)  # 5
        guard.check_resource_limits(5)  # 10
        guard.check_resource_limits(5)  # 15
        assert guard.rows_processed == 15
        guard.check_resource_limits(5)  # 20 - exactly at limit, 20 > 20 is False, no error
        assert guard.rows_processed == 20
        # One more call of 5 would exceed max_rows
        try:
            guard.check_resource_limits(5)  # 25 > 20 raises
            assert False, "Expected ResourceExhaustedError"
        except ResourceExhaustedError:
            pass


if __name__ == "__main__":
    import unittest
    unittest.main()
