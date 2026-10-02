import asyncio
import logging
import time
from collections import defaultdict
from typing import Any

logger = logging.getLogger("cognipath.ai_helper")

# Circuit Breaker state
_CONSECUTIVE_FAILURES = defaultdict(int)
_LAST_FAILURE_TIME = defaultdict(float)
_CIRCUIT_OPEN_DURATION = 30.0  # 30 seconds circuit breaker open time

async def gemini_generate(client: Any, model: str, contents: Any, timeout: float = 20.0, max_retries: int = 2) -> Any:
    """Shared async wrapper for Gemini API generate_content with retry, exponential backoff, timeout guard & circuit breaker."""
    global _CONSECUTIVE_FAILURES, _LAST_FAILURE_TIME

    # Check Circuit Breaker
    now = time.time()
    if _CONSECUTIVE_FAILURES[model] >= 5:
        if now - _LAST_FAILURE_TIME[model] < _CIRCUIT_OPEN_DURATION:
            logger.warning("[AI Circuit Breaker] Circuit is OPEN due to consecutive failures. Returning fallback.")
            raise RuntimeError("AI service temporarily unavailable (circuit breaker open).")
        else:
            # Half-open: reset failure count
            _CONSECUTIVE_FAILURES[model] = 0

    if not client:
        raise ValueError("Gemini client is not initialized.")

    def _call_gemini():
        return client.models.generate_content(
            model=model,
            contents=contents
        )

    last_err = None
    for attempt in range(max_retries + 1):
        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(_call_gemini),
                timeout=timeout
            )
            # Success: reset circuit breaker
            _CONSECUTIVE_FAILURES[model] = 0
            return response
        except asyncio.TimeoutError:
            last_err = TimeoutError(f"AI generation timed out after {timeout}s.")
            logger.warning("[AI Helper] Attempt %d/%d timed out.", attempt + 1, max_retries + 1)
        except Exception as e:
            last_err = e
            logger.warning("[AI Helper] Attempt %d/%d failed: %s", attempt + 1, max_retries + 1, e)

        if attempt < max_retries:
            backoff_delay = 0.5 * (2 ** attempt)  # 0.5s, 1.0s
            await asyncio.sleep(backoff_delay)

    # All retries failed
    _CONSECUTIVE_FAILURES[model] += 1
    _LAST_FAILURE_TIME[model] = time.time()
    logger.error("[AI Helper] All %d attempts failed. Consecutive failures: %d", max_retries + 1, _CONSECUTIVE_FAILURES[model])
    raise last_err
