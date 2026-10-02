import time
from typing import Any, Optional, Dict, Tuple

class TTLCache:
    """Lightweight thread-safe in-memory TTL cache with manual key invalidation."""
    def __init__(self, default_ttl: int = 300, max_size: int = 1000):
        self.default_ttl = default_ttl
        self.max_size = max_size
        self._cache: Dict[str, Tuple[Any, float]] = {}

    def get(self, key: str) -> Optional[Any]:
        if key not in self._cache:
            return None
        val, expiry = self._cache[key]
        if time.time() > expiry:
            del self._cache[key]
            return None
        return val

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        if len(self._cache) >= self.max_size:
            # Purge expired or oldest
            now = time.time()
            expired_keys = [k for k, (_, exp) in self._cache.items() if now > exp]
            for k in expired_keys:
                del self._cache[k]
            if len(self._cache) >= self.max_size:
                first_key = next(iter(self._cache))
                del self._cache[first_key]

        effective_ttl = ttl if ttl is not None else self.default_ttl
        self._cache[key] = (value, time.time() + effective_ttl)

    def invalidate(self, prefix: str) -> None:
        """Invalidates all keys starting with prefix."""
        matching = [k for k in list(self._cache.keys()) if k.startswith(prefix)]
        for k in matching:
            self._cache.pop(k, None)

    def clear(self) -> None:
        self._cache.clear()

ttl_cache = TTLCache(default_ttl=300, max_size=1000)
