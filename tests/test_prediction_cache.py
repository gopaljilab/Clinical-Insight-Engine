"""
Unit tests for app/ml/prediction_cache.py — PredictionLRUCache.
"""
import os
import sys
import time

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from app.ml.prediction_cache import PredictionLRUCache


class TestPredictionLRUCache:
    def test_cache_miss_on_empty_cache(self):
        """get() returns None when cache is empty."""
        cache = PredictionLRUCache(max_size=10, ttl_seconds=300)
        result = cache.get({"patient_id": "abc123"})
        assert result is None

    def test_cache_hit_returns_stored_result(self):
        """get() returns stored result on cache hit."""
        cache = PredictionLRUCache(max_size=10, ttl_seconds=300)
        cache.set({"patient_id": "abc123"}, {"risk": "low", "score": 0.2})
        result = cache.get({"patient_id": "abc123"})
        assert result == {"risk": "low", "score": 0.2}

    def test_ttl_expiry_returns_none(self):
        """Entry older than ttl_seconds is evicted and get() returns None."""
        cache = PredictionLRUCache(max_size=10, ttl_seconds=1)
        cache.set({"patient_id": "abc123"}, {"risk": "high"})
        time.sleep(1.1)
        result = cache.get({"patient_id": "abc123"})
        assert result is None

    def test_lru_eviction_when_over_max_size(self):
        """Inserting beyond max_size evicts the oldest entry."""
        cache = PredictionLRUCache(max_size=2, ttl_seconds=300)
        cache.set({"id": "A"}, "result_a")
        cache.set({"id": "B"}, "result_b")
        cache.set({"id": "C"}, "result_c")
        # A should be evicted
        assert cache.get({"id": "A"}) is None
        # B and C should still be present
        assert cache.get({"id": "B"}) == "result_b"
        assert cache.get({"id": "C"}) == "result_c"

    def test_key_deduplication_updates_entry_and_bumps_lru(self):
        """Setting same input updates result and bumps LRU position."""
        cache = PredictionLRUCache(max_size=2, ttl_seconds=300)
        cache.set({"id": "A"}, "v1")
        cache.set({"id": "B"}, "v2")
        cache.set({"id": "A"}, "v1_updated")
        # Both A and B should be present; A's value is updated
        assert cache.get({"id": "A"}) == "v1_updated"
        assert cache.get({"id": "B"}) == "v2"

    def test_stats_tracks_hits_and_misses(self):
        """stats() returns correct hit/miss/size/max_size/hit_rate."""
        cache = PredictionLRUCache(max_size=10, ttl_seconds=300)
        cache.set({"id": "A"}, "a")
        cache.set({"id": "B"}, "b")
        cache.get({"id": "A"})  # hit
        cache.get({"id": "C"})  # miss
        cache.get({"id": "C"})  # miss
        stats = cache.stats()
        assert stats["hits"] == 1
        assert stats["misses"] == 2
        assert stats["size"] == 2
        assert stats["max_size"] == 10
        assert stats["hit_rate"] == round(1 / 3, 3)

    def test_hit_rate_is_zero_with_no_requests(self):
        """hit_rate is 0 when no get() calls have been made."""
        cache = PredictionLRUCache(max_size=10, ttl_seconds=300)
        stats = cache.stats()
        assert stats["hit_rate"] == 0

    def test_clear_empties_cache(self):
        """clear() empties the cache and resets counters."""
        cache = PredictionLRUCache(max_size=10, ttl_seconds=300)
        cache.set({"id": "A"}, "a")
        cache.set({"id": "B"}, "b")
        cache.get({"id": "A"})
        cache.clear()
        # Check stats immediately after clear (before any more get calls)
        stats = cache.stats()
        assert stats["size"] == 0
        assert stats["hits"] == 0
        assert stats["misses"] == 0
        # Verify entries are gone
        assert cache.get({"id": "A"}) is None
        assert cache.get({"id": "B"}) is None

    def test_expired_entry_not_returned_but_already_evicted(self):
        """Expired entry returns None; no error on second get()."""
        cache = PredictionLRUCache(max_size=10, ttl_seconds=1)
        cache.set({"id": "X"}, "val_x")
        time.sleep(1.1)
        result1 = cache.get({"id": "X"})
        result2 = cache.get({"id": "X"})
        assert result1 is None
        assert result2 is None

    def test_identical_dicts_with_different_key_order_produce_same_key(self):
        """sort_keys=True ensures key order does not affect cache lookup."""
        cache = PredictionLRUCache(max_size=10, ttl_seconds=300)
        cache.set({"b": 2, "a": 1}, "v1")
        result = cache.get({"a": 1, "b": 2})
        assert result == "v1"
