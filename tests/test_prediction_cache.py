import sys
import time
from pathlib import Path
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.ml.prediction_cache import PredictionLRUCache


class TestPredictionLRUCacheMakeKey:
    """Tests for _make_key()."""

    def test_same_input_produces_same_key(self):
        cache = PredictionLRUCache()
        input1 = {"bmi": 28.5, "hba1cLevel": 6.2}
        input2 = {"bmi": 28.5, "hba1cLevel": 6.2}
        assert cache._make_key(input1) == cache._make_key(input2)

    def test_different_input_produces_different_key(self):
        cache = PredictionLRUCache()
        input1 = {"bmi": 28.5}
        input2 = {"bmi": 30.0}
        assert cache._make_key(input1) != cache._make_key(input2)

    def test_key_order_independent(self):
        cache = PredictionLRUCache()
        input1 = {"a": 1, "b": 2}
        input2 = {"b": 2, "a": 1}
        assert cache._make_key(input1) == cache._make_key(input2)

    def test_key_is_16_characters_long(self):
        cache = PredictionLRUCache()
        key = cache._make_key({"test": "data"})
        assert len(key) == 16
        assert key.isalnum()


class TestPredictionLRUCacheGetSet:
    """Tests for get() and set()."""

    def test_cache_miss_returns_none_on_empty_cache(self):
        cache = PredictionLRUCache()
        result = cache.get({"bmi": 28.5})
        assert result is None

    def test_cache_hit_returns_stored_result(self):
        cache = PredictionLRUCache()
        input_data = {"bmi": 28.5, "hba1cLevel": 6.2}
        stored_result = {"prediction": 0, "probability": 0.25}
        cache.set(input_data, stored_result)
        result = cache.get(input_data)
        assert result == stored_result

    def test_get_increments_miss_counter_on_cache_miss(self):
        cache = PredictionLRUCache()
        cache.get({"bmi": 28.5})
        stats = cache.stats()
        assert stats["misses"] == 1
        assert stats["hits"] == 0

    def test_get_increments_hit_counter_on_cache_hit(self):
        cache = PredictionLRUCache()
        cache.set({"bmi": 28.5}, {"result": "test"})
        cache.get({"bmi": 28.5})  # first get: hit
        cache.get({"bmi": 28.5})  # second get: hit
        stats = cache.stats()
        assert stats["misses"] == 0
        assert stats["hits"] == 2

    def test_set_overwrites_existing_entry(self):
        cache = PredictionLRUCache()
        input_data = {"bmi": 28.5}
        cache.set(input_data, {"result": "first"})
        cache.set(input_data, {"result": "second"})
        result = cache.get(input_data)
        assert result == {"result": "second"}

    def test_cache_respects_max_size(self):
        cache = PredictionLRUCache(max_size=2)
        cache.set({"id": 1}, "result1")
        cache.set({"id": 2}, "result2")
        cache.set({"id": 3}, "result3")
        stats = cache.stats()
        assert stats["size"] == 2


class TestPredictionLRUCacheLRU:
    """Tests for LRU eviction behavior."""

    def test_lru_eviction_removes_least_recently_used(self):
        cache = PredictionLRUCache(max_size=2)
        cache.set({"id": 1}, "result1")
        cache.set({"id": 2}, "result2")
        # Access id=1 to make it most recently used
        cache.get({"id": 1})
        # Add new entry, should evict id=2
        cache.set({"id": 3}, "result3")

        assert cache.get({"id": 2}) is None  # evicted
        assert cache.get({"id": 1}) is not None  # still present
        assert cache.get({"id": 3}) is not None  # present

    def test_set_on_existing_key_moves_to_end(self):
        cache = PredictionLRUCache(max_size=3)
        cache.set({"id": 1}, "r1")
        cache.set({"id": 2}, "r2")
        cache.set({"id": 3}, "r3")
        # Re-set id=1 to make it most recently used
        cache.set({"id": 1}, "r1_updated")
        # Add id=4, should evict id=2 (least recently used)
        cache.set({"id": 4}, "r4")

        assert cache.get({"id": 2}) is None  # evicted
        assert cache.get({"id": 1}) is not None  # still present


class TestPredictionLRUCacheTTL:
    """Tests for TTL expiration."""

    def test_expired_entry_returns_none(self):
        # Create cache with very short TTL
        mock_time = MagicMock()
        mock_time.time.return_value = 1000.0
        cache = PredictionLRUCache(ttl_seconds=10)
        cache._time = mock_time

        cache.set({"bmi": 28.5}, {"result": "test"})

        # Advance time beyond TTL
        mock_time.time.return_value = 1011.0
        result = cache.get({"bmi": 28.5})
        assert result is None

    def test_nonexpired_entry_returns_result(self):
        mock_time = MagicMock()
        mock_time.time.return_value = 1000.0
        cache = PredictionLRUCache(ttl_seconds=60)
        cache._time = mock_time

        cache.set({"bmi": 28.5}, {"result": "test"})

        # Advance time but still within TTL
        mock_time.time.return_value = 1050.0
        result = cache.get({"bmi": 28.5})
        assert result == {"result": "test"}


class TestPredictionLRUCacheStats:
    """Tests for stats()."""

    def test_stats_returns_correct_hit_rate(self):
        cache = PredictionLRUCache()
        cache.set({"a": 1}, "r")
        cache.get({"a": 1})  # hit
        cache.get({"a": 1})  # hit
        cache.get({"b": 2})  # miss

        stats = cache.stats()
        assert stats["hits"] == 2
        assert stats["misses"] == 1
        assert stats["hit_rate"] == round(2 / 3, 3)

    def test_stats_returns_zero_hit_rate_on_empty(self):
        cache = PredictionLRUCache()
        stats = cache.stats()
        assert stats["hit_rate"] == 0

    def test_stats_size_reflects_cache_contents(self):
        cache = PredictionLRUCache()
        cache.set({"a": 1}, "r1")
        cache.set({"b": 2}, "r2")
        stats = cache.stats()
        assert stats["size"] == 2


class TestPredictionLRUCacheClear:
    """Tests for clear()."""

    def test_clear_removes_all_entries(self):
        cache = PredictionLRUCache()
        cache.set({"a": 1}, "r1")
        cache.set({"b": 2}, "r2")
        cache.clear()
        stats = cache.stats()
        assert stats["size"] == 0

    def test_clear_keeps_hit_miss_counters(self):
        cache = PredictionLRUCache()
        cache.set({"a": 1}, "r1")
        cache.get({"a": 1})  # hit
        cache.clear()
        stats = cache.stats()
        # clear() does not reset counters (per source implementation)
        assert stats["hits"] == 1
        assert stats["misses"] == 0
