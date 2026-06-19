"""Unit tests for app/ml/prediction_cache.py PredictionLRUCache."""

import os
import sys
import time
import unittest.mock

import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from app.ml.prediction_cache import PredictionLRUCache, get_cache  # noqa: E402


class TestPredictionLRUCacheInit:
    def test_default_max_size_and_ttl(self):
        cache = PredictionLRUCache()
        assert cache._max_size == 1000
        assert cache._ttl == 300
        assert cache._hits == 0
        assert cache._misses == 0

    def test_custom_max_size_and_ttl(self):
        cache = PredictionLRUCache(max_size=50, ttl_seconds=60)
        assert cache._max_size == 50
        assert cache._ttl == 60


class TestPredictionLRUCacheGetMiss:
    def test_get_returns_none_for_unseen_input(self):
        cache = PredictionLRUCache()
        result = cache.get({"patient_id": "P001", "age": 45})
        assert result is None

    def test_get_increments_miss_counter_on_cache_miss(self):
        cache = PredictionLRUCache()
        cache.get({"x": 1})
        assert cache._misses == 1


class TestPredictionLRUCacheSetAndGet:
    def test_set_then_get_returns_stored_result(self):
        cache = PredictionLRUCache()
        input_data = {"patient_id": "P001", "age": 45}
        result_data = {"risk_score": 0.73, "category": "HIGH"}
        cache.set(input_data, result_data)
        assert cache.get(input_data) == result_data

    def test_get_increments_hit_counter_on_cache_hit(self):
        cache = PredictionLRUCache()
        cache.set({"x": 1}, "value")
        cache.get({"x": 1})
        assert cache._hits == 1
        assert cache._misses == 0

    def test_identical_input_dicts_produce_same_result(self):
        cache = PredictionLRUCache()
        input1 = {"a": 1, "b": 2}
        input2 = {"a": 1, "b": 2}
        cache.set(input1, "result")
        assert cache.get(input2) == "result"


class TestPredictionLRUCacheMaxSize:
    def test_evicts_oldest_entry_when_over_max_size(self):
        cache = PredictionLRUCache(max_size=3)
        cache.set({"k": 1}, "v1")
        cache.set({"k": 2}, "v2")
        cache.set({"k": 3}, "v3")
        cache.set({"k": 4}, "v4")
        # k=1 should be evicted
        assert cache.get({"k": 1}) is None
        assert cache.get({"k": 2}) == "v2"

    def test_lru_move_to_end_on_access(self):
        cache = PredictionLRUCache(max_size=3)
        cache.set({"k": 1}, "v1")
        cache.set({"k": 2}, "v2")
        cache.set({"k": 3}, "v3")
        # Access k=1 to move it to end
        cache.get({"k": 1})
        cache.set({"k": 4}, "v4")
        # k=2 should now be evicted instead of k=1
        assert cache.get({"k": 1}) == "v1"
        assert cache.get({"k": 2}) is None


class TestPredictionLRUCacheTTL:
    def test_returns_none_for_expired_entry(self):
        cache = PredictionLRUCache(ttl_seconds=0)
        fake_time = [1000.0]  # use list to allow closure mutation

        class FakeTimeModule:
            def time(self):
                return fake_time[0]

        cache._time = FakeTimeModule()

        cache.set({"x": 1}, "value")
        # Advance time past TTL
        fake_time[0] = 1001.0
        result = cache.get({"x": 1})
        assert result is None


class TestPredictionLRUCacheClear:
    def test_clear_removes_all_entries(self):
        cache = PredictionLRUCache()
        cache.set({"k": 1}, "v1")
        cache.set({"k": 2}, "v2")
        cache.clear()
        assert cache.get({"k": 1}) is None
        assert cache.get({"k": 2}) is None
        assert len(cache._cache) == 0


class TestPredictionLRUCacheStats:
    def test_stats_returns_correct_counts(self):
        cache = PredictionLRUCache()
        cache.set({"k": 1}, "v1")
        cache.get({"k": 1})  # hit
        cache.get({"k": 2})  # miss
        stats = cache.stats()
        assert stats["size"] == 1
        assert stats["max_size"] == 1000
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["hit_rate"] == 0.5

    def test_stats_hit_rate_zero_when_empty(self):
        cache = PredictionLRUCache()
        stats = cache.stats()
        assert stats["hit_rate"] == 0


class TestGetCache:
    def test_get_cache_returns_singleton(self):
        c1 = get_cache()
        c2 = get_cache()
        assert c1 is c2
