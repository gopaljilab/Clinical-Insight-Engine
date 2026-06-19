"""Unit tests for services/resource_guard.py ResourceGuard and ResourceExhaustedError."""

import sys
import os
import time
import threading

import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from services.resource_guard import ResourceGuard, ResourceExhaustedError  # noqa: E402


class TestResourceExhaustedError:
    def test_is_exception_subclass(self):
        err = ResourceExhaustedError("timeout")
        assert isinstance(err, Exception)

    def test_carries_message(self):
        err = ResourceExhaustedError("time limit exceeded")
        assert str(err) == "time limit exceeded"


class TestResourceGuardInit:
    def test_default_limits(self):
        guard = ResourceGuard()
        assert guard.max_rows == 150000
        assert guard.timeout_seconds == 30

    def test_custom_limits(self):
        guard = ResourceGuard(max_rows=500, timeout_seconds=5)
        assert guard.max_rows == 500
        assert guard.timeout_seconds == 5
        assert guard.start_time > 0
        assert guard.rows_processed == 0


class TestResourceGuardCheckTime:
    def test_no_error_within_timeout(self):
        guard = ResourceGuard(timeout_seconds=10)
        guard.check_time()  # should not raise

    def test_raises_after_timeout(self):
        guard = ResourceGuard(timeout_seconds=0)
        time.sleep(0.01)
        with pytest.raises(ResourceExhaustedError) as exc_info:
            guard.check_time()
        assert "timeout" in str(exc_info.value).lower()


class TestResourceGuardIncrementRows:
    def test_increments_rows(self):
        guard = ResourceGuard()
        guard.increment_rows(100)
        assert guard.rows_processed == 100
        guard.increment_rows(50)
        assert guard.rows_processed == 150

    def test_raises_when_max_rows_exceeded(self):
        guard = ResourceGuard(max_rows=200)
        guard.increment_rows(150)
        with pytest.raises(ResourceExhaustedError) as exc_info:
            guard.increment_rows(51)
        assert "150000" not in str(exc_info.value)  # uses actual max_rows=200
        assert "200" in str(exc_info.value)

    def test_no_error_at_exactly_max_rows(self):
        guard = ResourceGuard(max_rows=200)
        guard.increment_rows(200)
        assert guard.rows_processed == 200


class TestResourceGuardCheckResourceLimits:
    def test_passes_within_limits(self):
        guard = ResourceGuard(max_rows=500, timeout_seconds=10)
        guard.check_resource_limits(100)
        assert guard.rows_processed == 100

    def test_raises_on_row_overflow_in_check_resource_limits(self):
        guard = ResourceGuard(max_rows=300, timeout_seconds=10)
        guard.increment_rows(250)
        with pytest.raises(ResourceExhaustedError):
            guard.check_resource_limits(100)

    def test_accumulates_across_multiple_check_resource_limits(self):
        guard = ResourceGuard(max_rows=1000, timeout_seconds=10)
        guard.check_resource_limits(300)
        guard.check_resource_limits(300)
        guard.check_resource_limits(300)
        assert guard.rows_processed == 900

    def test_raises_after_exact_max_in_multiple_chunks(self):
        guard = ResourceGuard(max_rows=500, timeout_seconds=10)
        for _ in range(5):
            guard.check_resource_limits(100)
        with pytest.raises(ResourceExhaustedError):
            guard.check_resource_limits(100)
