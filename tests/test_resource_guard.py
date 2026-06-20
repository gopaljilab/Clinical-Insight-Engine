"""
Unit tests for the ResourceGuard class in services/resource_guard.py.

Covers row count limits, processing timeout enforcement, and combined
resource limit checks to prevent DoS via oversized CSV uploads.
"""
import os
import sys
import time
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from services.resource_guard import ResourceGuard, ResourceExhaustedError


class TestResourceGuard(unittest.TestCase):
    """Test suite for ResourceGuard."""

    def test_check_time_raises_after_timeout(self):
        """Verify that check_time raises ResourceExhaustedError after timeout."""
        guard = ResourceGuard(timeout_seconds=0)  # expires immediately
        time.sleep(0.01)
        with self.assertRaises(ResourceExhaustedError) as ctx:
            guard.check_time()
        self.assertIn("timeout", str(ctx.exception).lower())

    def test_check_time_does_not_raise_before_timeout(self):
        """Verify check_time is a no-op before timeout expires."""
        guard = ResourceGuard(timeout_seconds=10)
        # Should not raise
        guard.check_time()

    def test_increment_rows_raises_at_max(self):
        """Verify increment_rows raises when max_rows is exceeded."""
        guard = ResourceGuard(max_rows=5)
        guard.increment_rows(5)
        with self.assertRaises(ResourceExhaustedError) as ctx:
            guard.increment_rows(1)
        self.assertIn("row", str(ctx.exception).lower())

    def test_increment_rows_does_not_raise_below_max(self):
        """Verify increment_rows accepts increments up to the limit."""
        guard = ResourceGuard(max_rows=10)
        guard.increment_rows(5)
        guard.increment_rows(4)
        # Just under max - should not raise
        self.assertEqual(guard.rows_processed, 9)

    def test_increment_rows_raises_exactly_at_max(self):
        """Verify increment_rows raises when incrementing to exactly max_rows."""
        guard = ResourceGuard(max_rows=10)
        with self.assertRaises(ResourceExhaustedError):
            guard.increment_rows(11)

    def test_check_resource_limits_calls_time_and_rows(self):
        """Verify check_resource_limits enforces both time and row limits."""
        # Time-limited: check_resource_limits calls check_time which should raise
        guard_time = ResourceGuard(timeout_seconds=0, max_rows=100000)
        time.sleep(0.01)
        with self.assertRaises(ResourceExhaustedError):
            guard_time.check_resource_limits(1)

        # Row-limited: check_resource_limits increments rows, so need > max_rows + 1
        guard_rows = ResourceGuard(timeout_seconds=60, max_rows=3)
        with self.assertRaises(ResourceExhaustedError):
            guard_rows.check_resource_limits(4)  # 0 + 4 > 3

    def test_normal_operation_multiple_increments(self):
        """Verify multiple small increments below thresholds do not raise."""
        guard = ResourceGuard(max_rows=100, timeout_seconds=60)
        for i in range(10):
            guard.increment_rows(5)
        self.assertEqual(guard.rows_processed, 50)
        guard.check_time()  # Should not raise
        guard.check_resource_limits(5)  # Within limits (50 + 5 = 55 <= 100)
        self.assertEqual(guard.rows_processed, 55)

    def test_boundary_exactly_at_max_rows(self):
        """Verify exactly at max_rows is allowed; exceeding by 1 raises."""
        guard = ResourceGuard(max_rows=5)
        guard.increment_rows(5)
        # At exactly max_rows - should not raise
        guard.increment_rows(0)
        # Exceeding max_rows by 1 should raise
        with self.assertRaises(ResourceExhaustedError):
            guard.increment_rows(1)

    def test_boundary_exactly_at_timeout(self):
        """Verify exactly at timeout boundary raises ResourceExhaustedError."""
        guard = ResourceGuard(timeout_seconds=0, max_rows=100000)
        # Immediately at boundary
        with self.assertRaises(ResourceExhaustedError):
            guard.check_time()


if __name__ == "__main__":
    unittest.main()
