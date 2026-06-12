"""
ML Model Loader — loads model once at startup.
Prevents repeated disk I/O on every prediction request.
"""
import os
import logging
import hashlib
from pathlib import Path
from threading import Lock

logger = logging.getLogger(__name__)

_model_cache = {}
_lock = Lock()

DEFAULT_MODEL_PATH = os.environ.get("MODEL_PATH", "models/diabetes_model.pkl")


def load_model(model_path: str = DEFAULT_MODEL_PATH):
    """
    Load ML model with singleton caching.
    Thread-safe: uses a lock to prevent duplicate loading.

    Args:
        model_path: Path to the serialized model file.

    Returns:
        Loaded model object.

    Raises:
        FileNotFoundError: If model file does not exist.
        RuntimeError: If model loading fails.
    """
    abs_path = str(Path(model_path).resolve())

    if abs_path in _model_cache:
        logger.debug(f"Model cache hit: {abs_path}")
        return _model_cache[abs_path]

    with _lock:
        # Double-checked locking
        if abs_path in _model_cache:
            return _model_cache[abs_path]

        if not Path(abs_path).exists():
            raise FileNotFoundError(f"Model file not found: {abs_path}")

        logger.info(f"Loading ML model from: {abs_path}")
        
        from app.ml.security import verify_signature
        if not verify_signature(abs_path):
            raise PermissionError(
                f"Model signature verification failed for: {abs_path}. "
                "Refusing to deserialize untrusted model file to prevent Remote Code Execution."
            )

        try:
            import joblib
            model = joblib.load(abs_path)
        except Exception:
            try:
                from app.ml.security import safe_pickle_load
                with open(abs_path, "rb") as f:
                    model = safe_pickle_load(f)
            except Exception as e:
                raise RuntimeError(f"Failed to load model: {e}") from e

        _model_cache[abs_path] = model
        logger.info(f"Model loaded successfully. Type: {type(model).__name__}")
        return model


def get_model():
    """Get the cached model instance. Loads it if not already loaded."""
    return load_model()


def clear_cache():
    """Clear the model cache (useful for testing or hot-reload)."""
    with _lock:
        _model_cache.clear()
    logger.info("Model cache cleared.")
