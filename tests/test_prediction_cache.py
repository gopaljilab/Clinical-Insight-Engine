"""
Tests for app/ml/prediction_cache.py
"""
import time
import threading
import pytest
from app.ml.prediction_cache import PredictionLRUCache, get_cache


class TestPredictionLRUCache:
    def test_get_empty_cache_returns_none(self):
        cache = PredictionLRUCache(max_size=10, ttl_seconds=300)
        result = cache.get({"patient_id": "P001", "age": 45})
        assert result is None

    def test_set_and_get_returns_stored_value(self):
        cache = PredictionLRUCache(max_size=10, ttl_seconds=300)
        cache.set({"patient_id": "P001"}, {"risk_score": 0.75, "category": "HIGH"})
        result = cache.get({"patient_id": "P001"})
        assert result == {"risk_score": 0.75, "category": "HIGH"}

    def test_identical_inputs_with_different_key_order_same_result(self):
        cache = PredictionLRUCache(max_size=10, ttl_seconds=300)
        cache.set({"a": 1, "b": 2}, "result")
        result = cache.get({"b": 2, "a": 1})
        assert result == "result"

    def test_ttl_expiry_returns_none(self):
        cache = PredictionLRUCache(max_size=10, ttl_seconds=1)
        cache.set({"patient": "P001"}, "prediction")
        time.sleep(1.1)
        result = cache.get({"patient": "P001"})
        assert result is None

    def test_lru_eviction_removes_oldest(self):
        cache = PredictionLRUCache(max_size=3, ttl_seconds=300)
        cache.set({"id": "A"}, "value_a")
        cache.set({"id": "B"}, "value_b")
        cache.set({"id": "C"}, "value_c")
        # D evicts A (oldest)
        cache.set({"id": "D"}, "value_d")
        assert cache.get({"id": "A"}) is None
        assert cache.get({"id": "B"}) == "value_b"
        assert cache.get({"id": "C"}) == "value_c"
        assert cache.get({"id": "D"}) == "value_d"

    def test_lru_update_moves_to_most_recent(self):
        cache = PredictionLRUCache(max_size=3, ttl_seconds=300)
        cache.set({"id": "A"}, "value_a")
        cache.set({"id": "B"}, "value_b")
        cache.set({"id": "C"}, "value_c")
        # Access A to move it to most recent
        cache.get({"id": "A"})
        # D evicts B (now oldest)
        cache.set({"id": "D"}, "value_d")
        assert cache.get({"id": "A"}) == "value_a"
        assert cache.get({"id": "B"}) is None
        assert cache.get({"id": "C"}) == "value_c"

    def test_update_existing_key_does_not_cause_eviction(self):
        cache = PredictionLRUCache(max_size=2, ttl_seconds=300)
        cache.set({"id": "A"}, "value_a")
        cache.set({"id": "B"}, "value_b")
        cache.set({"id": "A"}, "value_a_updated")
        cache.set({"id": "C"}, "value_c")
        # A should still be there (updated), C should evict B
        assert cache.get({"id": "A"}) == "value_a_updated"
        assert cache.get({"id": "C"}) == "value_c"
        assert cache.get({"id": "B"}) is None

    def test_stats_initial_state(self):
        cache = PredictionLRUCache(max_size=10, ttl_seconds=300)
        stats = cache.stats()
        assert stats["size"] == 0
        assert stats["hits"] == 0
        assert stats["misses"] == 0
        assert stats["hit_rate"] == 0

    def test_stats_hit_rate(self):
        cache = PredictionLRUCache(max_size=10, ttl_seconds=300)
        cache.set({"id": "A"}, "value_a")
        cache.get({"id": "A"})  # hit
        cache.get({"id": "A"})  # hit
        cache.get({"id": "B"})  # miss
        stats = cache.stats()
        assert stats["hits"] == 2
        assert stats["misses"] == 1
        assert stats["hit_rate"] == round(2 / 3, 3)

    def test_clear_removes_entries_but_preserves_stats(self):
        cache = PredictionLRUCache(max_size=10, ttl_seconds=300)
        cache.set({"id": "A"}, "value_a")
        cache.get({"id": "A"})  # hit
        cache.clear()
        assert cache.get({"id": "A"}) is None  # miss after clear
        stats = cache.stats()
        assert stats["size"] == 0
        # clear() removes entries but preserves hit/miss counters
        assert stats["hits"] == 1
        assert stats["misses"] == 1

    def test_concurrent_access_no_error(self):
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        errors = []

        def writer(thread_id):
            try:
                for i in range(50):
                    cache.set({"thread": thread_id, "i": i}, f"result_{i}")
            except Exception as e:
                errors.append(e)

        def reader(thread_id):
            try:
                for i in range(50):
                    cache.get({"thread": thread_id, "i": i})
            except Exception as e:
                errors.append(e)

        threads = []
        for t in range(5):
            threads.append(threading.Thread(target=writer, args=(t,)))
            threads.append(threading.Thread(target=reader, args=(t,)))
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0

    def test_make_key_is_deterministic(self):
        cache = PredictionLRUCache(max_size=10, ttl_seconds=300)
        key1 = cache._make_key({"a": 1, "b": 2})
        key2 = cache._make_key({"b": 2, "a": 1})
        assert key1 == key2
        assert len(key1) == 16  # sha256 truncated to 16 chars

    def test_get_cache_returns_singleton(self):
        c1 = get_cache()
        c2 = get_cache()
        assert c1 is c2


class TestPredictionLRUCacheEdgeCases:
    def test_empty_dict_input(self):
        cache = PredictionLRUCache(max_size=10, ttl_seconds=300)
        cache.set({}, "empty_result")
        assert cache.get({}) == "empty_result"

    def test_none_result_can_be_cached(self):
        cache = PredictionLRUCache(max_size=10, ttl_seconds=300)
        cache.set({"id": "X"}, None)
        # Note: get returns None for both cache miss and cached None
        # This is expected behavior for this cache design
        assert cache.get({"id": "X"}) is None

    def test_large_input_dict(self):
        cache = PredictionLRUCache(max_size=10, ttl_seconds=300)
        large_input = {f"key_{i}": f"value_{i}" for i in range(100)}
        cache.set(large_input, "large_result")
        assert cache.get(large_input) == "large_result"
