"""
Unit tests for the ResourceGuard class (services/resource_guard.py).

Covers: row-count limits, timeout enforcement, and aggregated resource checks.
"""
import time
import pytest
import services.resource_guard as resource_guard


class TestResourceGuardDefaults:
    """Test suite for default ResourceGuard behavior."""

    def test_instantiation_with_defaults(self):
        guard = resource_guard.ResourceGuard()
        assert guard.max_rows == 150000
        assert guard.timeout_seconds == 30
        assert guard.rows_processed == 0
        assert guard.start_time > 0

    def test_instantiation_with_custom_limits(self):
        guard = resource_guard.ResourceGuard(max_rows=5000, timeout_seconds=10)
        assert guard.max_rows == 5000
        assert guard.timeout_seconds == 10


class TestCheckTime:
    """Test suite for the check_time method."""

    def test_before_timeout_does_not_raise(self):
        guard = resource_guard.ResourceGuard(timeout_seconds=30)
        # Immediate call should be well within timeout
        guard.check_time()  # Should not raise

    def test_timeout_exceeded_raises_resource_exhausted_error(self):
        # Create guard with timeout already exceeded
        guard = resource_guard.ResourceGuard(timeout_seconds=0)
        time.sleep(0.05)  # Ensure clock has advanced past 0 seconds
        with pytest.raises(resource_guard.ResourceExhaustedError, match="timeout"):
            guard.check_time()


class TestIncrementRows:
    """Test suite for the increment_rows method."""

    def test_increment_within_limit_does_not_raise(self):
        guard = resource_guard.ResourceGuard(max_rows=100)
        guard.increment_rows(50)  # Should not raise
        assert guard.rows_processed == 50

    def test_increment_exactly_at_limit_does_not_raise(self):
        guard = resource_guard.ResourceGuard(max_rows=100)
        guard.increment_rows(100)  # Exactly at limit - allowed
        assert guard.rows_processed == 100

    def test_increment_exceeding_limit_raises_error(self):
        guard = resource_guard.ResourceGuard(max_rows=100)
        with pytest.raises(resource_guard.ResourceExhaustedError, match="row count"):
            guard.increment_rows(101)

    def test_max_rows_zero_raises_on_any_increment(self):
        guard = resource_guard.ResourceGuard(max_rows=0)
        with pytest.raises(resource_guard.ResourceExhaustedError, match="row count"):
            guard.increment_rows(1)

    def test_multiple_increments_accumulate_correctly(self):
        guard = resource_guard.ResourceGuard(max_rows=100)
        guard.increment_rows(30)
        guard.increment_rows(30)
        guard.increment_rows(30)
        assert guard.rows_processed == 90
        # One more should still be within limit
        guard.increment_rows(10)
        assert guard.rows_processed == 100

    def test_increment_with_zero_does_not_change_count(self):
        guard = resource_guard.ResourceGuard(max_rows=100)
        guard.increment_rows(50)
        guard.increment_rows(0)
        assert guard.rows_processed == 50


class TestCheckResourceLimits:
    """Test suite for the combined check_resource_limits method."""

    def test_valid_chunk_passes_both_checks(self):
        guard = resource_guard.ResourceGuard(max_rows=100, timeout_seconds=30)
        guard.check_resource_limits(50)  # Should not raise
        assert guard.rows_processed == 50

    def test_timeout_triggers_before_row_limit(self):
        guard = resource_guard.ResourceGuard(max_rows=200, timeout_seconds=0)
        time.sleep(0.05)
        with pytest.raises(resource_guard.ResourceExhaustedError, match="timeout"):
            guard.check_resource_limits(50)

    def test_row_limit_triggers_before_timeout(self):
        guard = resource_guard.ResourceGuard(max_rows=10, timeout_seconds=30)
        with pytest.raises(resource_guard.ResourceExhaustedError, match="row count"):
            guard.check_resource_limits(11)

    def test_empty_chunk_does_not_change_state(self):
        guard = resource_guard.ResourceGuard(max_rows=100, timeout_seconds=30)
        guard.check_resource_limits(0)
        assert guard.rows_processed == 0
        # Timeout and row limit still not reached
        guard.check_resource_limits(100)  # Exactly at limit
        assert guard.rows_processed == 100

    def test_error_message_includes_limit_info(self):
        guard = resource_guard.ResourceGuard(max_rows=50)
        with pytest.raises(resource_guard.ResourceExhaustedError) as exc_info:
            guard.increment_rows(51)
        assert "50" in str(exc_info.value)
