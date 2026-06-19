"""Unit tests for app/ml/model_loader.py singleton caching."""

import os
import sys
import tempfile
import shutil

import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from app.ml import model_loader  # noqa: E402


class TestLoadModelFileNotFound:
    def test_raises_filenotfound_for_missing_model(self):
        with pytest.raises(FileNotFoundError) as exc_info:
            model_loader.load_model("/nonexistent/path/to/model.pkl")
        assert "not found" in str(exc_info.value).lower()

    def test_raises_filenotfound_for_invalid_absolute_path(self):
        with pytest.raises(FileNotFoundError):
            model_loader.load_model("/tmp/this_does_not_exist_12345.pkl")


class TestLoadModelSignatureVerification:
    def test_raises_permission_error_when_sig_missing(self):
        """Model file without .sig file should fail verification."""
        with tempfile.TemporaryDirectory() as tmpdir:
            model_path = os.path.join(tmpdir, "model.pkl")
            # Create an empty file (not a real pickle)
            with open(model_path, "wb") as f:
                f.write(b"not a pickle")

            with pytest.raises(PermissionError) as exc_info:
                model_loader.load_model(model_path)
            assert "signature verification failed" in str(exc_info.value).lower()


class TestClearCache:
    def test_clear_cache_succeeds_after_load_attempt(self):
        """clear_cache should not raise even if nothing is cached."""
        model_loader.clear_cache()  # should not raise

    def test_clear_cache_allows_fresh_load_after_error(self):
        """After clear_cache, load_model retries from scratch."""
        model_loader.clear_cache()
        # A missing file should still raise FileNotFoundError after clearing
        with pytest.raises(FileNotFoundError):
            model_loader.load_model("/tmp/nonexistent_model_xyz.pkl")


class TestGetModel:
    def test_get_model_loads_default(self):
        """get_model should return a model (may raise if default is missing)."""
        model_loader.clear_cache()
        # The default model path may or may not exist; this tests the call path
        try:
            result = model_loader.get_model()
            assert result is not None
        except FileNotFoundError:
            pass  # default model not present in test env — acceptable


class TestCacheBehavior:
    def test_cached_model_is_returned_on_second_call(self):
        """load_model should return the same cached object on repeated calls."""
        with tempfile.TemporaryDirectory() as tmpdir:
            model_path = os.path.join(tmpdir, "model.pkl")
            # Create a minimal pickle with a list
            import pickle
            sentinel = object()
            with open(model_path, "wb") as f:
                pickle.dump(sentinel, f)

            # Write a valid HMAC sig
            import hmac
            import hashlib
            secret = b"clinical-insight-engine-dev-secret"
            h = hmac.new(secret, digestmod=hashlib.sha256)
            with open(model_path, "rb") as f:
                h.update(f.read())
            with open(model_path + ".sig", "w") as f:
                f.write(h.hexdigest())

            model_loader.clear_cache()
            result1 = model_loader.load_model(model_path)
            result2 = model_loader.load_model(model_path)

            # Should be the same object (singleton)
            assert result1 is result2
