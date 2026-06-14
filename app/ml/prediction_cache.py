from collections import OrderedDict
import time
from typing import Optional

class PredictionLRUCache:
    """Thread-safe LRU cache for prediction results."""

    def __init__(self, max_size: int = 1000, ttl_seconds: int = 300):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.cache = OrderedDict()
        self.lock = threading.Lock()

    def _make_key(self, input_data: dict) -> str:
        return hash(frozenset(input_data.items()))

    def get(self, input_data: dict) -> Optional[Any]:
        with self.lock:
            key = self._make_key(input_data)
            if key in self.cache:
                value, timestamp = self.cache[key]
                if time.time() - timestamp > self.ttl_seconds:
                    del self.cache[key]
                    return None
                else:
                    self.cache.move_to_end(key)
                    return value
        return None

    def set(self, input_data: dict, result: Any) -> None:
        with self.lock:
            key = self._make_key(input_data)
            if len(self.cache) >= self.max_size:
                self.cache.popitem(last=False)
            self.cache[key] = (result, time.time())
            self.cache.move_to_end(key)

    def stats(self) -> dict:
        return {
            "hits": sum(1 for _, timestamp in self.cache.values() if time.time() - timestamp <= self.ttl_seconds),
            "misses": len(self.cache) - sum(1 for _, timestamp in self.cache.values() if time.time() - timestamp <= self.ttl_seconds),
            "size": len(self.cache)
        }

    def clear(self) -> None:
        with self.lock:
            self.cache.clear()
