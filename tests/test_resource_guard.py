"""
Unit tests for the ResourceGuard class.
Tests timeout enforcement, row-count limits, and combined resource limit checks.
"""
import os
import sys
import time

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from services.resource_guard import ResourceExhaustedError, ResourceGuard


class TestResourceGuardCheckTime:
    def test_does_not_raise_when_time_not_exceeded(self):
        guard = ResourceGuard(timeout_seconds=30)
        guard.check_time()  # should not raise

    def test_raises_when_timeout_exceeded(self):
        guard = ResourceGuard(timeout_seconds=0)
        time.sleep(0.05)
        try:
            guard.check_time()
            assert False, "Expected ResourceExhaustedError"
        except ResourceExhaustedError as e:
            assert "timeout" in str(e).lower()

    def test_timeout_exactly_at_boundary(self):
        guard = ResourceGuard(timeout_seconds=1)
        time.sleep(1.0)
        try:
            guard.check_time()
            assert False, "Expected ResourceExhaustedError"
        except ResourceExhaustedError:
            pass


class TestResourceGuardIncrementRows:
    def test_does_not_raise_when_row_count_within_limit(self):
        guard = ResourceGuard(max_rows=100)
        guard.increment_rows(50)  # should not raise

    def test_does_not_raise_at_exactly_max_rows(self):
        guard = ResourceGuard(max_rows=100)
        guard.increment_rows(100)  # should not raise

    def test_raises_when_max_rows_exceeded(self):
        guard = ResourceGuard(max_rows=10)
        try:
            guard.increment_rows(11)
            assert False, "Expected ResourceExhaustedError"
        except ResourceExhaustedError as e:
            assert "row" in str(e).lower() or "maximum" in str(e).lower()


class TestResourceGuardCheckResourceLimits:
    def test_passes_valid_chunk(self):
        guard = ResourceGuard(max_rows=1000, timeout_seconds=30)
        guard.check_resource_limits(100)  # should not raise

    def test_raises_on_row_limit_from_chunk(self):
        guard = ResourceGuard(max_rows=5, timeout_seconds=30)
        try:
            guard.check_resource_limits(6)
            assert False, "Expected ResourceExhaustedError"
        except ResourceExhaustedError:
            pass


class TestResourceGuardStateTracking:
    def test_rows_accumulate_across_increments(self):
        guard = ResourceGuard(max_rows=100)
        guard.increment_rows(50)
        guard.increment_rows(40)
        try:
            guard.increment_rows(15)
            assert False, "Expected ResourceExhaustedError"
        except ResourceExhaustedError:
            pass

    def test_start_time_is_recorded(self):
        guard = ResourceGuard(timeout_seconds=30)
        assert guard.start_time > 0
        assert isinstance(guard.start_time, float)

    def test_default_limits(self):
        guard = ResourceGuard()
        assert guard.max_rows == 150000
        assert guard.timeout_seconds == 30

    def test_custom_limits(self):
        guard = ResourceGuard(max_rows=500, timeout_seconds=60)
        assert guard.max_rows == 500
        assert guard.timeout_seconds == 60
