"""
Unit tests for services/resource_guard.py

Tests the ResourceGuard class which enforces row-count and time-based
resource limits for CSV processing as a DoS protection mechanism.
"""
import time
import pytest
from services.resource_guard import ResourceGuard, ResourceExhaustedError


class TestResourceExhaustedError:
    def test_inherits_from_exception(self):
        """ResourceExhaustedError must be a proper Exception subclass."""
        err = ResourceExhaustedError("limit exceeded")
        assert isinstance(err, Exception)
        assert isinstance(err, ResourceExhaustedError)

    def test_carries_message(self):
        """Error message must be accessible for logging and debugging."""
        msg = "Maximum row count (100) exceeded"
        err = ResourceExhaustedError(msg)
        assert str(err) == msg


class TestResourceGuardInit:
    def test_default_max_rows(self):
        """Default max_rows must be 150000."""
        guard = ResourceGuard()
        assert guard.max_rows == 150000

    def test_default_timeout(self):
        """Default timeout_seconds must be 30."""
        guard = ResourceGuard()
        assert guard.timeout_seconds == 30

    def test_custom_max_rows(self):
        """Custom max_rows must be respected."""
        guard = ResourceGuard(max_rows=5000)
        assert guard.max_rows == 5000

    def test_custom_timeout(self):
        """Custom timeout_seconds must be respected."""
        guard = ResourceGuard(timeout_seconds=60)
        assert guard.timeout_seconds == 60

    def test_initial_rows_processed_is_zero(self):
        """rows_processed counter starts at 0."""
        guard = ResourceGuard()
        assert guard.rows_processed == 0

    def test_start_time_is_set(self):
        """start_time must be recorded at construction."""
        guard = ResourceGuard()
        assert guard.start_time is not None
        assert isinstance(guard.start_time, float)


class TestCheckTime:
    def test_does_not_raise_before_timeout(self):
        """check_time must not raise if within the time window."""
        guard = ResourceGuard(timeout_seconds=30)
        # Fresh guard should always pass
        guard.check_time()  # should not raise

    def test_raises_when_timeout_exceeded(self):
        """check_time must raise ResourceExhaustedError after timeout."""
        # Use a zero timeout and sleep just over it
        guard = ResourceGuard(timeout_seconds=0)
        time.sleep(0.01)
        with pytest.raises(ResourceExhaustedError) as exc_info:
            guard.check_time()
        assert "timeout" in str(exc_info.value).lower()

    def test_error_message_is_descriptive(self):
        """Timeout error message must be descriptive."""
        guard = ResourceGuard(timeout_seconds=0)
        time.sleep(0.01)
        with pytest.raises(ResourceExhaustedError) as exc_info:
            guard.check_time()
        assert "timeout" in str(exc_info.value).lower()


class TestIncrementRows:
    def test_does_not_raise_below_max(self):
        """increment_rows must not raise if under max_rows."""
        guard = ResourceGuard(max_rows=100)
        guard.increment_rows(50)
        assert guard.rows_processed == 50

    def test_raises_when_max_rows_exceeded(self):
        """increment_rows must raise ResourceExhaustedError when limit is breached."""
        guard = ResourceGuard(max_rows=100)
        with pytest.raises(ResourceExhaustedError) as exc_info:
            guard.increment_rows(101)
        assert "100" in str(exc_info.value)

    def test_exactly_at_max_is_allowed(self):
        """increment_rows must allow exactly max_rows."""
        guard = ResourceGuard(max_rows=100)
        guard.increment_rows(100)  # should not raise
        assert guard.rows_processed == 100

    def test_accumulator_behaves_correctly(self):
        """Multiple calls must accumulate row count."""
        guard = ResourceGuard(max_rows=100)
        guard.increment_rows(30)
        guard.increment_rows(30)
        guard.increment_rows(30)
        assert guard.rows_processed == 90

    def test_accumulator_triggers_on_final_exceed(self):
        """Accumulated count that exceeds max must trigger exception."""
        guard = ResourceGuard(max_rows=100)
        guard.increment_rows(90)
        with pytest.raises(ResourceExhaustedError):
            guard.increment_rows(15)  # 90 + 15 = 105 > 100


class TestCheckResourceLimits:
    def test_calls_both_time_and_row_checks(self):
        """check_resource_limits must validate both time and row limits."""
        guard = ResourceGuard(max_rows=100, timeout_seconds=30)
        guard.check_resource_limits(50)  # should not raise
        assert guard.rows_processed == 50

    def test_raises_on_time_exceeded(self):
        """check_resource_limits must propagate timeout errors."""
        guard = ResourceGuard(max_rows=100000, timeout_seconds=0)
        time.sleep(0.01)
        with pytest.raises(ResourceExhaustedError):
            guard.check_resource_limits(10)

    def test_raises_on_row_exceeded(self):
        """check_resource_limits must propagate row-count errors."""
        guard = ResourceGuard(max_rows=50, timeout_seconds=30)
        with pytest.raises(ResourceExhaustedError):
            guard.check_resource_limits(51)
