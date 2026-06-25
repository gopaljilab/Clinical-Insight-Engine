"""
Unit tests for app/ml/prediction_cache.py
"""
import time
import pytest
import unittest.mock

from app.ml.prediction_cache import PredictionLRUCache, get_cache


class TestPredictionLRUCacheGet:
    """Tests for PredictionLRUCache.get() behavior."""

    def test_get_returns_none_for_missing_key(self):
        """get() should return None when the key is not in the cache."""
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        result = cache.get({"patientId": "nonexistent"})
        assert result is None

    def test_get_returns_cached_value(self):
        """get() should return the stored value when key exists and is not expired."""
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        cache.set({"patientId": "P001"}, {"riskScore": 0.75})

        result = cache.get({"patientId": "P001"})
        assert result == {"riskScore": 0.75}

    def test_get_moves_key_to_most_recently_used_position(self):
        """Accessing a key should move it to the end (most recently used)."""
        cache = PredictionLRUCache(max_size=3, ttl_seconds=300)
        cache.set({"id": "A"}, "val_a")
        cache.set({"id": "B"}, "val_b")
        cache.set({"id": "C"}, "val_c")

        # Access A (moves it to most recently used)
        cache.get({"id": "A"})

        # Add D which should evict the LRU item (B, since A was just accessed)
        cache.set({"id": "D"}, "val_d")

        # B should be evicted
        assert cache.get({"id": "B"}) is None
        # A should still be there (was accessed)
        assert cache.get({"id": "A"}) == "val_a"


class TestPredictionLRUCacheSet:
    """Tests for PredictionLRUCache.set() behavior."""

    def test_set_stores_value(self):
        """set() should store the value and get() should retrieve it."""
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        cache.set({"patientId": "P002"}, {"prediction": "diabetes", "score": 0.9})

        result = cache.get({"patientId": "P002"})
        assert result == {"prediction": "diabetes", "score": 0.9}

    def test_set_updates_existing_key(self):
        """set() on an existing key should update its value."""
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        cache.set({"id": "X"}, "old_value")
        cache.set({"id": "X"}, "new_value")

        assert cache.get({"id": "X"}) == "new_value"


class TestPredictionLRUCacheTTLEviction:
    """Tests for TTL-based expiration."""

    def test_get_returns_none_after_ttl_expires(self):
        """get() should return None after the TTL has elapsed."""
        fake_time = {"value": 1000.0}

        class FakeTime:
            def time(self):
                return fake_time["value"]

        cache = PredictionLRUCache(max_size=100, ttl_seconds=60)
        cache._time = FakeTime()

        cache.set({"id": "T1"}, "value_at_1000")

        # Advance time past TTL
        fake_time["value"] = 1061.0

        result = cache.get({"id": "T1"})
        assert result is None

    def test_set_overwrites_ttl_for_existing_key(self):
        """Updating a key via set() should refresh its TTL."""
        fake_time = {"value": 1000.0}

        class FakeTime:
            def time(self):
                return fake_time["value"]

        cache = PredictionLRUCache(max_size=100, ttl_seconds=60)
        cache._time = FakeTime()

        cache.set({"id": "T2"}, "original")
        fake_time["value"] = 1050.0  # 50 seconds later

        # Access but do NOT set (TTL still at 1000 + 60 = 1060)
        # TTL not yet expired at 1050

        fake_time["value"] = 1059.0
        assert cache.get({"id": "T2"}) == "original"

        # Now refresh TTL by setting again
        cache.set({"id": "T2"}, "refreshed")

        # Advance time to original TTL expiry + 1
        fake_time["value"] = 1061.0

        # Original TTL (1000+60) is expired but refreshed TTL (1059+60) is not
        assert cache.get({"id": "T2"}) == "refreshed"


class TestPredictionLRUCacheMaxSizeEviction:
    """Tests for max_size-based LRU eviction."""

    def test_cache_evicts_oldest_entry_when_over_capacity(self):
        """When max_size is exceeded, the oldest (LRU) entry should be evicted."""
        cache = PredictionLRUCache(max_size=2, ttl_seconds=300)
        cache.set({"id": "L1"}, "val1")
        cache.set({"id": "L2"}, "val2")

        # Cache is at capacity (2)
        cache.set({"id": "L3"}, "val3")

        # L1 should be evicted (it was the first/oldest entry)
        assert cache.get({"id": "L1"}) is None
        assert cache.get({"id": "L2"}) == "val2"
        assert cache.get({"id": "L3"}) == "val3"


class TestPredictionLRUCacheStats:
    """Tests for cache statistics."""

    def test_stats_reports_hit_miss_counts(self):
        """stats() should return accurate hit/miss counts and hit_rate."""
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        cache.set({"id": "S1"}, "val1")

        # Miss
        cache.get({"id": "MISS"})

        # Hit
        cache.get({"id": "S1"})

        # Miss
        cache.get({"id": "S1"})

        stats = cache.stats()
        # 1 miss (MISS key), 2 hits (both S1 gets)
        assert stats["hits"] == 2
        assert stats["misses"] == 1
        assert stats["hit_rate"] == round(2 / 3, 3)
        assert stats["size"] == 1
        assert stats["max_size"] == 100


class TestPredictionLRUCacheClear:
    """Tests for cache clearing."""

    def test_clear_removes_all_entries(self):
        """clear() should empty the cache and reset stats."""
        cache = PredictionLRUCache(max_size=100, ttl_seconds=300)
        cache.set({"id": "C1"}, "v1")
        cache.set({"id": "C2"}, "v2")

        cache.clear()

        assert cache.get({"id": "C1"}) is None
        assert cache.get({"id": "C2"}) is None
        assert len(cache._cache) == 0


class TestGetCache:
    """Tests for the module-level get_cache singleton."""

    def test_get_cache_returns_singleton_instance(self):
        """get_cache() should return the same instance on repeated calls."""
        cache1 = get_cache()
        cache2 = get_cache()
        assert cache1 is cache2
