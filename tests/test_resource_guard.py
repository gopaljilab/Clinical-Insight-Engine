"""
Unit tests for services/resource_guard.py

Resource exhaustion protection tests.
"""
import pytest
from unittest.mock import patch
from services.resource_guard import ResourceGuard, ResourceExhaustedError


class TestResourceGuard:
    """Tests for ResourceGuard class."""

    def test_check_time_within_limit(self):
        """Does not raise when elapsed time is below timeout_seconds."""
        guard = ResourceGuard(timeout_seconds=10)
        # Mock time.time to return the same value (no elapsed time)
        with patch("services.resource_guard.time.time", return_value=1000.0):
            guard.start_time = 1000.0  # Simulate guard created at t=1000
            # Mock time.time to return t=1005 (5 seconds elapsed, within limit)
            with patch("services.resource_guard.time.time", return_value=1005.0):
                guard.check_time()  # Should not raise

    def test_check_time_exceeds_timeout(self):
        """Raises ResourceExhaustedError when elapsed time exceeds timeout."""
        guard = ResourceGuard(timeout_seconds=10)
        with patch("services.resource_guard.time.time", return_value=1000.0):
            guard.start_time = 1000.0  # Created at t=1000
            # Elapsed: 15 seconds > 10 second timeout
            with patch("services.resource_guard.time.time", return_value=1015.0):
                with pytest.raises(ResourceExhaustedError) as exc_info:
                    guard.check_time()
                assert "Processing timeout exceeded" in str(exc_info.value)

    def test_increment_rows_within_limit(self):
        """Does not raise when rows_processed is below max_rows."""
        guard = ResourceGuard(max_rows=100000)
        guard.increment_rows(50000)  # Within limit
        assert guard.rows_processed == 50000

    def test_increment_rows_at_boundary(self):
        """Does not raise when rows_processed equals max_rows."""
        guard = ResourceGuard(max_rows=100000)
        guard.increment_rows(100000)  # Exactly at limit
        assert guard.rows_processed == 100000

    def test_increment_rows_exceeds_max(self):
        """Raises ResourceExhaustedError when rows exceed max_rows."""
        guard = ResourceGuard(max_rows=100000)
        with pytest.raises(ResourceExhaustedError) as exc_info:
            guard.increment_rows(100001)
        assert "Maximum row count" in str(exc_info.value)
        assert "100000" in str(exc_info.value)

    def test_increment_rows_multiple_calls_accumulate(self):
        """Multiple increments accumulate row count correctly."""
        guard = ResourceGuard(max_rows=100000)
        guard.increment_rows(30000)
        guard.increment_rows(30000)
        guard.increment_rows(30000)
        assert guard.rows_processed == 90000
        # One more increment of 10001 would exceed
        with pytest.raises(ResourceExhaustedError):
            guard.increment_rows(10001)

    def test_check_resource_limits_calls_both(self):
        """check_resource_limits enforces both time and row limits."""
        guard = ResourceGuard(max_rows=100000, timeout_seconds=10)

        # Time exceeded: should raise
        with patch("services.resource_guard.time.time", return_value=1000.0):
            guard.start_time = 1000.0
            with patch("services.resource_guard.time.time", return_value=1020.0):
                with pytest.raises(ResourceExhaustedError) as exc_info:
                    guard.check_resource_limits(100)
                assert "Processing timeout exceeded" in str(exc_info.value)

    def test_check_resource_limits_rows_exceeded(self):
        """check_resource_limits raises when row limit is exceeded."""
        guard = ResourceGuard(max_rows=100000, timeout_seconds=10)

        # Row limit exceeded (time is fine)
        with patch("services.resource_guard.time.time", return_value=1000.0):
            guard.start_time = 1000.0
            with patch("services.resource_guard.time.time", return_value=1001.0):
                with pytest.raises(ResourceExhaustedError) as exc_info:
                    guard.check_resource_limits(100001)
                assert "Maximum row count" in str(exc_info.value)

    def test_check_resource_limits_within_both_limits(self):
        """check_resource_limits passes when both limits are respected."""
        guard = ResourceGuard(max_rows=100000, timeout_seconds=10)
        with patch("services.resource_guard.time.time", return_value=1000.0):
            guard.start_time = 1000.0
            with patch("services.resource_guard.time.time", return_value=1005.0):
                guard.check_resource_limits(50000)  # Should not raise
                assert guard.rows_processed == 50000

    def test_resource_exhausted_error_message_format(self):
        """ResourceExhaustedError has the expected message format."""
        error = ResourceExhaustedError("Processing timeout exceeded")
        assert str(error) == "Processing timeout exceeded"

        error2 = ResourceExhaustedError("Maximum row count (150000) exceeded")
        assert "150000" in str(error2)
