"""
Prediction Response Cache

LRU cache for ML inference results.
Avoids redundant model calls for identical patient inputs.
"""
import hashlib
import json
import logging
from collections import OrderedDict
from threading import Lock
from typing import Any, Optional

logger = logging.getLogger(__name__)


class PredictionLRUCache:
    """Thread-safe LRU cache for prediction results."""

    def __init__(self, max_size: int = 1000, ttl_seconds: int = 300):
        """
        Args:
            max_size: Maximum number of cached entries.
            ttl_seconds: Time-to-live for each cache entry in seconds.
        """
        import time
        self._cache: OrderedDict = OrderedDict()
        self._max_size = max_size
        self._ttl = ttl_seconds
        self._lock = Lock()
        self._time = time
        self._hits = 0
        self._misses = 0

    def _make_key(self, input_data: dict) -> str:
        """Create a stable hash key from input parameters."""
        serialized = json.dumps(input_data, sort_keys=True)
        return hashlib.sha256(serialized.encode()).hexdigest()[:16]

    def get(self, input_data: dict) -> Optional[Any]:
        """Retrieve cached prediction if available and not expired."""
        key = self._make_key(input_data)
        with self._lock:
            if key not in self._cache:
                self._misses += 1
                return None

            entry, timestamp = self._cache[key]
            if self._time.time() - timestamp > self._ttl:
                del self._cache[key]
                self._misses += 1
                return None

            # Move to end (most recently used)
            self._cache.move_to_end(key)
            self._hits += 1
            logger.debug(f"Cache hit (key={key})")
            return entry

    def set(self, input_data: dict, result: Any) -> None:
        """Store a prediction result in the cache."""
        key = self._make_key(input_data)
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            self._cache[key] = (result, self._time.time())

            # Evict oldest entry if over capacity
            if len(self._cache) > self._max_size:
                evicted = self._cache.popitem(last=False)
                logger.debug(f"Evicted cache entry")

    def stats(self) -> dict:
        """Return cache hit/miss statistics."""
        total = self._hits + self._misses
        return {
            "size": len(self._cache),
            "max_size": self._max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(self._hits / total, 3) if total else 0,
        }

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()


# Module-level singleton
_prediction_cache = PredictionLRUCache(max_size=1000, ttl_seconds=300)


def get_cache() -> PredictionLRUCache:
    return _prediction_cache
