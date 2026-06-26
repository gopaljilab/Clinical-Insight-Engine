"""pytest unit tests for app/ml/prediction_cache.py"""
import time
import pytest
from unittest.mock import patch
from app.ml.prediction_cache import PredictionLRUCache, get_cache


class TestPredictionLRUCacheGetSet:
    def test_get_returns_none_for_cache_miss_on_empty_cache(self):
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        result = cache.get({"patient_id": "p123", "features": [1, 2, 3]})
        assert result is None

    def test_get_returns_cached_value_after_set(self):
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        cache.set({"patient_id": "p123"}, {"risk_score": 0.75})
        result = cache.get({"patient_id": "p123"})
        assert result == {"risk_score": 0.75}

    def test_set_stores_result_with_timestamp(self):
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        cache.set({"input": "data"}, {"output": "result"})
        stats = cache.stats()
        assert stats["size"] == 1

    def test_get_increments_hits_on_cache_hit(self):
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        cache.set({"key": "value"}, "cached_result")
        cache.get({"key": "value"})
        cache.get({"key": "value"})
        stats = cache.stats()
        assert stats["hits"] == 2

    def test_get_increments_misses_on_cache_miss(self):
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        cache.get({"missing": "key"})
        cache.get({"another": "missing"})
        stats = cache.stats()
        assert stats["misses"] == 2

    def test_set_with_same_key_moves_to_end_most_recently_used(self):
        cache = PredictionLRUCache(max_size=3, ttl_seconds=300)
        cache.set({"a": 1}, "val_a")
        cache.set({"b": 2}, "val_b")
        cache.set({"c": 3}, "val_c")
        # Access 'a' to make it most recently used
        cache.get({"a": 1})
        # Add new entry, which should evict 'b' (least recently used)
        cache.set({"d": 4}, "val_d")
        stats = cache.stats()
        assert stats["size"] == 3
        # 'a' should still be accessible
        assert cache.get({"a": 1}) == "val_a"
        # 'b' should have been evicted
        assert cache.get({"b": 2}) is None


class TestPredictionLRUCacheEviction:
    def test_lru_eviction_removes_oldest_entry_when_max_size_exceeded(self):
        cache = PredictionLRUCache(max_size=2, ttl_seconds=300)
        cache.set({"k": 1}, "v1")
        cache.set({"k": 2}, "v2")
        cache.set({"k": 3}, "v3")  # should evict k=1
        assert cache.get({"k": 1}) is None
        assert cache.get({"k": 2}) == "v2"
        assert cache.get({"k": 3}) == "v3"

    def test_set_existing_key_does_not_count_as_new_entry(self):
        cache = PredictionLRUCache(max_size=2, ttl_seconds=300)
        cache.set({"k": 1}, "v1")
        cache.set({"k": 2}, "v2")
        cache.set({"k": 1}, "v1_updated")  # re-set existing key
        cache.set({"k": 3}, "v3")  # should evict k=2 (not k=1)
        assert cache.get({"k": 1}) == "v1_updated"
        assert cache.get({"k": 2}) is None


class TestPredictionLRUCacheTTL:
    def test_get_returns_none_after_ttl_expires(self):
        cache = PredictionLRUCache(max_size=100, ttl_seconds=1)
        cache.set({"key": "val"}, "result")
        assert cache.get({"key": "val"}) == "result"
        time.sleep(1.1)
        assert cache.get({"key": "val"}) is None

    def test_stats_hit_rate_zero_when_all_misses(self):
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        cache.get({"a": 1})
        cache.get({"b": 2})
        stats = cache.stats()
        assert stats["hit_rate"] == 0

    def test_stats_hit_rate_correct_after_mixed_operations(self):
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        cache.set({"k": 1}, "v")
        cache.get({"k": 1})  # hit
        cache.get({"k": 1})  # hit
        cache.get({"missing": 1})  # miss
        stats = cache.stats()
        assert stats["hits"] == 2
        assert stats["misses"] == 1
        assert stats["hit_rate"] == pytest.approx(0.667, abs=0.001)


class TestPredictionLRUCacheClear:
    def test_clear_removes_all_entries(self):
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        cache.set({"a": 1}, "va")
        cache.set({"b": 2}, "vb")
        cache.clear()
        stats = cache.stats()
        assert stats["size"] == 0
        assert cache.get({"a": 1}) is None
        assert cache.get({"b": 2}) is None

    def test_clear_keeps_hit_miss_counters(self):
        # clear() only removes cache entries, not counters
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        cache.set({"k": 1}, "v")
        cache.get({"k": 1})
        cache.get({"missing": 1})
        cache.clear()
        stats = cache.stats()
        # Counters persist across clear
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["size"] == 0


class TestPredictionLRUCacheMakeKey:
    def test_make_key_produces_stable_key_for_identical_inputs(self):
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        key1 = cache._make_key({"patient_id": "p123", "features": [1, 2, 3]})
        key2 = cache._make_key({"patient_id": "p123", "features": [1, 2, 3]})
        assert key1 == key2

    def test_make_key_order_independent_for_dicts(self):
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        key1 = cache._make_key({"a": 1, "b": 2})
        key2 = cache._make_key({"b": 2, "a": 1})
        assert key1 == key2

    def test_make_key_differs_for_different_inputs(self):
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        key1 = cache._make_key({"patient_id": "p123"})
        key2 = cache._make_key({"patient_id": "p456"})
        assert key1 != key2

    def test_make_key_returns_16_char_hex_string(self):
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        key = cache._make_key({"test": "data"})
        assert len(key) == 16
        assert all(c in "0123456789abcdef" for c in key)


class TestPredictionLRUCacheEdgeCases:
    def test_zero_max_size_allows_no_entries(self):
        cache = PredictionLRUCache(max_size=0, ttl_seconds=300)
        cache.set({"key": "val"}, "result")
        assert cache.get({"key": "val"}) is None

    def test_negative_ttl_treated_as_expired(self):
        cache = PredictionLRUCache(max_size=100, ttl_seconds=-1)
        cache.set({"key": "val"}, "result")
        # Immediately expired
        assert cache.get({"key": "val"}) is None


class TestGetCache:
    def test_get_cache_returns_predictionlrucache_instance(self):
        cache = get_cache()
        assert isinstance(cache, PredictionLRUCache)

    def test_get_cache_returns_same_instance(self):
        cache1 = get_cache()
        cache2 = get_cache()
        assert cache1 is cache2

    def test_get_cache_singleton_persists_across_calls(self):
        cache = get_cache()
        initial_size = cache.stats()["size"]
        # Add an entry
        cache.set({"singleton": "test"}, "value")
        # Get a new reference
        cache2 = get_cache()
        assert cache2.get({"singleton": "test"}) == "value"
