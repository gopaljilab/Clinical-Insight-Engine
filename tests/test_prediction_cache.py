"""
Unit tests for the PredictionLRUCache in app/ml/prediction_cache.py.
Tests cover initialization, get/set, LRU eviction, TTL expiry, hash key
stability, and hit/miss statistics.
"""
import os
import sys
import time
import unittest
from unittest.mock import MagicMock

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from app.ml.prediction_cache import PredictionLRUCache


class MockTime:
    """Controllable time source for TTL testing."""

    def __init__(self, start: float = 1000.0):
        self._now = start

    def time(self) -> float:
        return self._now

    def advance(self, seconds: float) -> None:
        self._now += seconds


class TestPredictionLRUCacheInit(unittest.TestCase):
    """Test suite for PredictionLRUCache initialization."""

    def test_default_values(self):
        cache = PredictionLRUCache()
        self.assertEqual(cache._max_size, 1000)
        self.assertEqual(cache._ttl, 300)
        self.assertEqual(len(cache._cache), 0)

    def test_custom_max_size(self):
        cache = PredictionLRUCache(max_size=100)
        self.assertEqual(cache._max_size, 100)

    def test_custom_ttl(self):
        cache = PredictionLRUCache(ttl_seconds=600)
        self.assertEqual(cache._ttl, 600)


class TestPredictionLRUCacheGetSet(unittest.TestCase):
    """Test suite for get/set operations."""

    def test_set_and_get(self):
        mock_time = MockTime()
        cache = PredictionLRUCache()
        cache._time = mock_time

        input_data = {"age": 45, "bmi": 24.5}
        result = {"prediction": 0, "risk": "LOW"}

        cache.set(input_data, result)
        retrieved = cache.get(input_data)

        self.assertEqual(retrieved, result)

    def test_get_missing_returns_none(self):
        cache = PredictionLRUCache()
        result = cache.get({"unknown": "key"})
        self.assertIsNone(result)

    def test_hash_key_stability(self):
        """Identical inputs produce the same key regardless of dict ordering."""
        cache = PredictionLRUCache()

        input_a = {"age": 45, "bmi": 24.5, "gender": "Male"}
        input_b = {"gender": "Male", "age": 45, "bmi": 24.5}

        key_a = cache._make_key(input_a)
        key_b = cache._make_key(input_b)

        self.assertEqual(key_a, key_b)

    def test_different_inputs_produce_different_keys(self):
        cache = PredictionLRUCache()

        key1 = cache._make_key({"age": 45})
        key2 = cache._make_key({"age": 46})

        self.assertNotEqual(key1, key2)

    def test_get_updates_lru_order(self):
        """Getting an entry moves it to the most-recently-used position."""
        mock_time = MockTime()
        cache = PredictionLRUCache(max_size=3)
        cache._time = mock_time

        cache.set({"n": 1}, "v1")
        cache.set({"n": 2}, "v2")
        cache.set({"n": 3}, "v3")

        # Access n=1 to move it to MRU
        cache.get({"n": 1})

        # Now n=2 should be LRU — evicting one more should drop n=2
        cache.set({"n": 4}, "v4")

        self.assertIsNone(cache.get({"n": 2}))
        self.assertIsNotNone(cache.get({"n": 1}))
        self.assertIsNotNone(cache.get({"n": 3}))
        self.assertIsNotNone(cache.get({"n": 4}))

    def test_set_same_key_updates_value(self):
        mock_time = MockTime()
        cache = PredictionLRUCache()
        cache._time = mock_time

        cache.set({"key": "a"}, "value1")
        cache.set({"key": "a"}, "value2")

        result = cache.get({"key": "a"})
        self.assertEqual(result, "value2")


class TestPredictionLRUCacheEviction(unittest.TestCase):
    """Test suite for LRU eviction."""

    def test_lru_eviction_on_max_size(self):
        cache = PredictionLRUCache(max_size=3)

        cache.set({"n": 1}, "v1")
        cache.set({"n": 2}, "v2")
        cache.set({"n": 3}, "v3")

        # Adding 4th entry evicts the oldest (n=1)
        cache.set({"n": 4}, "v4")

        self.assertIsNone(cache.get({"n": 1}))
        self.assertEqual(cache.get({"n": 2}), "v2")
        self.assertEqual(cache.get({"n": 3}), "v3")
        self.assertEqual(cache.get({"n": 4}), "v4")

    def test_no_eviction_before_max_size(self):
        cache = PredictionLRUCache(max_size=3)

        cache.set({"n": 1}, "v1")
        cache.set({"n": 2}, "v2")

        self.assertEqual(len(cache._cache), 2)
        self.assertIsNotNone(cache.get({"n": 1}))
        self.assertIsNotNone(cache.get({"n": 2}))


class TestPredictionLRUCacheTTL(unittest.TestCase):
    """Test suite for TTL expiry."""

    def test_entry_expires_after_ttl(self):
        mock_time = MockTime(start=1000.0)
        cache = PredictionLRUCache(ttl_seconds=300)
        cache._time = mock_time

        cache.set({"key": "val"}, "result")

        # Within TTL — should hit
        mock_time.advance(100)
        self.assertEqual(cache.get({"key": "val"}), "result")

        # After TTL — should miss
        mock_time.advance(201)
        self.assertIsNone(cache.get({"key": "val"}))

    def test_entry_valid_at_ttl_boundary(self):
        mock_time = MockTime(start=1000.0)
        cache = PredictionLRUCache(ttl_seconds=300)
        cache._time = mock_time

        cache.set({"key": "val"}, "result")
        # At exactly TTL (300s), entry is still valid (strict > comparison)
        mock_time.advance(300)
        self.assertEqual(cache.get({"key": "val"}), "result")

        # Expires at > TTL (strictly greater than 300)
        mock_time.advance(1)
        self.assertIsNone(cache.get({"key": "val"}))


class TestPredictionLRUCacheStats(unittest.TestCase):
    """Test suite for cache statistics."""

    def test_initial_stats(self):
        cache = PredictionLRUCache()
        stats = cache.stats()
        self.assertEqual(stats["hits"], 0)
        self.assertEqual(stats["misses"], 0)
        self.assertEqual(stats["size"], 0)
        self.assertEqual(stats["hit_rate"], 0)

    def test_hit_increments_hits(self):
        mock_time = MockTime()
        cache = PredictionLRUCache()
        cache._time = mock_time

        cache.set({"key": "val"}, "result")
        cache.get({"key": "val"})

        stats = cache.stats()
        self.assertEqual(stats["hits"], 1)
        self.assertEqual(stats["misses"], 0)

    def test_miss_increments_misses(self):
        cache = PredictionLRUCache()
        cache.get({"missing": "key"})
        stats = cache.stats()
        self.assertEqual(stats["misses"], 1)
        self.assertEqual(stats["hits"], 0)

    def test_hit_rate_calculation(self):
        mock_time = MockTime()
        cache = PredictionLRUCache()
        cache._time = mock_time

        cache.set({"a": "1"}, "r1")
        cache.get({"a": "1"})  # hit
        cache.get({"a": "1"})  # hit
        cache.get({"b": "2"})  # miss
        cache.get({"c": "3"})  # miss

        stats = cache.stats()
        self.assertEqual(stats["hits"], 2)
        self.assertEqual(stats["misses"], 2)
        self.assertEqual(stats["hit_rate"], 0.5)


class TestPredictionLRUCacheClear(unittest.TestCase):
    """Test suite for clear operation."""

    def test_clear_removes_all_entries(self):
        cache = PredictionLRUCache()
        cache.set({"a": 1}, "v1")
        cache.set({"b": 2}, "v2")
        cache.clear()
        self.assertEqual(len(cache._cache), 0)
        self.assertIsNone(cache.get({"a": 1}))
        self.assertIsNone(cache.get({"b": 2}))


if __name__ == "__main__":
    unittest.main()