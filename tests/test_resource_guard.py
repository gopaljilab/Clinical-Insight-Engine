import pytest
import time
from services.resource_guard import ResourceGuard, ResourceExhaustedError


class TestResourceGuardConstructor:
    def test_default_max_rows(self):
        guard = ResourceGuard()
        assert guard.max_rows == 150000

    def test_default_timeout(self):
        guard = ResourceGuard()
        assert guard.timeout_seconds == 30

    def test_custom_max_rows(self):
        guard = ResourceGuard(max_rows=5000)
        assert guard.max_rows == 5000

    def test_custom_timeout(self):
        guard = ResourceGuard(timeout_seconds=60)
        assert guard.timeout_seconds == 60

    def test_initial_rows_processed_is_zero(self):
        guard = ResourceGuard()
        assert guard.rows_processed == 0


class TestCheckTime:
    def test_passes_within_timeout(self):
        guard = ResourceGuard(timeout_seconds=10)
        guard.check_time()  # should not raise

    def test_raises_after_timeout(self):
        guard = ResourceGuard(timeout_seconds=0)
        time.sleep(0.01)
        with pytest.raises(ResourceExhaustedError) as exc_info:
            guard.check_time()
        assert "timeout" in str(exc_info.value).lower()


class TestIncrementRows:
    def test_passes_under_max_rows(self):
        guard = ResourceGuard(max_rows=10)
        guard.increment_rows(5)
        assert guard.rows_processed == 5

    def test_passes_at_exactly_max_rows(self):
        guard = ResourceGuard(max_rows=10)
        guard.increment_rows(10)
        assert guard.rows_processed == 10

    def test_raises_when_exceeding_max_rows(self):
        guard = ResourceGuard(max_rows=10)
        with pytest.raises(ResourceExhaustedError) as exc_info:
            guard.increment_rows(11)
        assert "row" in str(exc_info.value).lower()

    def test_accumulates_rows_across_calls(self):
        guard = ResourceGuard(max_rows=100)
        guard.increment_rows(30)
        guard.increment_rows(30)
        assert guard.rows_processed == 60

    def test_raises_after_accumulated_exceeds_limit(self):
        guard = ResourceGuard(max_rows=10)
        guard.increment_rows(8)
        with pytest.raises(ResourceExhaustedError):
            guard.increment_rows(3)


class TestCheckResourceLimits:
    def test_passes_for_small_chunk_within_limits(self):
        guard = ResourceGuard(max_rows=100, timeout_seconds=60)
        guard.check_resource_limits(5)
        assert guard.rows_processed == 5

    def test_raises_on_timeout(self):
        guard = ResourceGuard(max_rows=100, timeout_seconds=0)
        time.sleep(0.01)
        with pytest.raises(ResourceExhaustedError) as exc_info:
            guard.check_resource_limits(0)
        assert "timeout" in str(exc_info.value).lower()

    def test_raises_on_row_exceeded(self):
        guard = ResourceGuard(max_rows=5, timeout_seconds=60)
        with pytest.raises(ResourceExhaustedError):
            guard.check_resource_limits(10)

    def test_full_lifecycle_within_limits(self):
        guard = ResourceGuard(max_rows=100, timeout_seconds=60)
        for i in range(10):
            guard.check_resource_limits(10)
        assert guard.rows_processed == 100
