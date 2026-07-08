"""
Unit tests for the PredictionLRUCache service.
"""
import os
import sys
import unittest

# Ensure repository root is on the path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from app.ml.prediction_cache import PredictionLRUCache


class TestPredictionCacheKey(unittest.TestCase):
    """Test suite for PredictionLRUCache._make_key."""

    def setUp(self):
        self.cache = PredictionLRUCache()

    def test_key_is_full_sha256_hexdigest_length(self):
        """Cache keys must be the full 64-character SHA-256 hexdigest,
        not a truncated slice, to avoid shrinking the effective keyspace."""
        key = self.cache._make_key({"age": 45, "bmi": 27.5})
        self.assertEqual(len(key), 64)
        # Every character must be a valid hex digit.
        int(key, 16)

    def test_distinct_inputs_produce_distinct_keys(self):
        """Two structurally different patient inputs must never collide."""
        patient_a = {
            "patientId": "A001",
            "age": 45,
            "bmi": 31.2,
            "hypertension": True,
            "heartDisease": False,
        }
        patient_b = {
            "patientId": "B002",
            "age": 62,
            "bmi": 22.4,
            "hypertension": False,
            "heartDisease": True,
        }
        key_a = self.cache._make_key(patient_a)
        key_b = self.cache._make_key(patient_b)
        self.assertNotEqual(key_a, key_b)

    def test_adversarial_near_duplicate_inputs_do_not_collide(self):
        """A fixed adversarial pair of near-identical inputs (differing by
        a single field) must still produce different full-length keys —
        the scenario the 16-char truncation put at risk."""
        base = {"patientId": "P100", "age": 50, "bmi": 25.0}
        variant = {"patientId": "P100", "age": 50, "bmi": 25.0000001}
        self.assertNotEqual(
            self.cache._make_key(base),
            self.cache._make_key(variant),
        )

    def test_identical_inputs_produce_identical_keys(self):
        """Key generation must be deterministic regardless of dict key
        insertion order (sort_keys=True)."""
        ordered_one = {"age": 40, "bmi": 24.1, "patientId": "P200"}
        ordered_two = {"patientId": "P200", "bmi": 24.1, "age": 40}
        self.assertEqual(
            self.cache._make_key(ordered_one),
            self.cache._make_key(ordered_two),
        )

    def test_many_inputs_produce_unique_keys(self):
        """Sanity check across a larger batch of distinct inputs: no
        collisions should occur among the full-length keys."""
        keys = set()
        for i in range(2000):
            key = self.cache._make_key({"patientId": f"P{i}", "age": i % 90})
            self.assertNotIn(key, keys)
            keys.add(key)
        self.assertEqual(len(keys), 2000)


class TestPredictionCacheBehavior(unittest.TestCase):
    """Regression tests verifying cache hit/miss behavior is unchanged
    after switching to full-length keys."""

    def setUp(self):
        self.cache = PredictionLRUCache(max_size=2, ttl_seconds=300)

    def test_cache_miss_then_hit(self):
        input_data = {"patientId": "P1", "age": 55}
        self.assertIsNone(self.cache.get(input_data))

        result = {"riskScore": 42, "riskCategory": "MODERATE"}
        self.cache.set(input_data, result)

        cached = self.cache.get(input_data)
        self.assertEqual(cached, result)

        stats = self.cache.stats()
        self.assertEqual(stats["hits"], 1)
        self.assertEqual(stats["misses"], 1)

    def test_lru_eviction_still_works(self):
        self.cache.set({"patientId": "P1"}, {"riskScore": 1})
        self.cache.set({"patientId": "P2"}, {"riskScore": 2})
        # Exceeds max_size=2, should evict the oldest entry (P1).
        self.cache.set({"patientId": "P3"}, {"riskScore": 3})

        self.assertIsNone(self.cache.get({"patientId": "P1"}))
        self.assertEqual(self.cache.get({"patientId": "P2"}), {"riskScore": 2})
        self.assertEqual(self.cache.get({"patientId": "P3"}), {"riskScore": 3})

    def test_different_patients_never_share_a_cached_result(self):
        """Direct regression test for the collision hazard described in
        the issue: two different patients' inputs must never resolve to
        the same cache entry."""
        patient_a = {"patientId": "A1", "age": 70, "bmi": 33.0}
        patient_b = {"patientId": "B1", "age": 29, "bmi": 19.5}

        self.cache.set(patient_a, {"riskScore": 90, "riskCategory": "HIGH"})

        # Patient B has never been cached, so this must be a miss —
        # not an accidental hit on patient A's entry.
        self.assertIsNone(self.cache.get(patient_b))


if __name__ == "__main__":
    unittest.main()