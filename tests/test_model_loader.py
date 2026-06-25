"""
Unit tests for app/ml/model_loader.py
"""
import os
import sys
import tempfile
import pytest
import unittest.mock

import app.ml.model_loader as model_loader_module


def _inject_fake_joblib(mock_model):
    """Preload a fake joblib into sys.modules so 'import joblib' inside
    load_model() resolves to our mock instead of failing."""
    fake_joblib = unittest.mock.MagicMock()
    fake_joblib.load.return_value = mock_model
    sys.modules["joblib"] = fake_joblib
    return fake_joblib


def _remove_fake_joblib():
    if "joblib" in sys.modules:
        del sys.modules["joblib"]


class TestLoadModelFileNotFound:
    """Tests for FileNotFoundError when model file does not exist."""

    def test_load_model_raises_file_not_found_for_nonexistent_path(self):
        """load_model must raise FileNotFoundError when the model file does not exist."""
        model_loader_module.clear_cache()
        nonexistent = "/tmp/this_model_does_not_exist_12345.pkl"
        if os.path.exists(nonexistent):
            os.remove(nonexistent)

        with pytest.raises(FileNotFoundError) as exc_info:
            model_loader_module.load_model(nonexistent)
        assert "Model file not found" in str(exc_info.value)


class TestLoadModelSingletonCache:
    """Tests for singleton caching behavior."""

    def test_load_model_caches_result_on_first_call(self):
        """load_model should cache the model and return the same instance on subsequent calls."""
        model_loader_module.clear_cache()
        _remove_fake_joblib()

        with tempfile.NamedTemporaryFile(suffix=".pkl", delete=False) as f:
            temp_path = f.name

        try:
            mock_model = {"type": "mock_model"}
            fake_joblib = _inject_fake_joblib(mock_model)

            with unittest.mock.patch(
                "app.ml.security.verify_signature", return_value=True
            ):
                result1 = model_loader_module.load_model(temp_path)
                result2 = model_loader_module.load_model(temp_path)

            # Same reference returned from cache (singleton behavior)
            assert result1 is result2
            # joblib.load called exactly once (second call hit the cache)
            assert fake_joblib.load.call_count == 1
        finally:
            _remove_fake_joblib()
            model_loader_module.clear_cache()
            os.remove(temp_path)

    def test_clear_cache_empties_the_internal_cache(self):
        """clear_cache should empty the module-level _model_cache."""
        model_loader_module.clear_cache()
        assert len(model_loader_module._model_cache) == 0


class TestLoadModelSignatureRejection:
    """Tests for signature verification failure path."""

    def test_load_model_raises_permission_error_when_signature_fails(self):
        """load_model must raise PermissionError when verify_signature returns False."""
        model_loader_module.clear_cache()

        with tempfile.NamedTemporaryFile(suffix=".pkl", delete=False) as f:
            temp_path = f.name

        try:
            with unittest.mock.patch(
                "app.ml.security.verify_signature", return_value=False
            ):
                with pytest.raises(PermissionError) as exc_info:
                    model_loader_module.load_model(temp_path)
            assert "signature verification failed" in str(exc_info.value)
        finally:
            model_loader_module.clear_cache()
            os.remove(temp_path)


class TestLoadModelDeserializationFailure:
    """Tests for RuntimeError when deserialization fails."""

    def test_load_model_raises_runtime_error_when_both_loaders_fail(self):
        """load_model should raise RuntimeError when both joblib.load and safe_pickle_load fail."""
        model_loader_module.clear_cache()
        _remove_fake_joblib()

        with tempfile.NamedTemporaryFile(suffix=".pkl", delete=False) as f:
            temp_path = f.name
            f.write(b"invalid pickle payload that cannot be deserialized")

        try:
            # Inject a fake joblib whose load() raises
            fake_joblib = unittest.mock.MagicMock()
            fake_joblib.load.side_effect = Exception("joblib error")
            sys.modules["joblib"] = fake_joblib

            with unittest.mock.patch(
                "app.ml.security.verify_signature", return_value=True
            ):
                with unittest.mock.patch(
                    "app.ml.security.safe_pickle_load",
                    side_effect=RuntimeError("safe_pickle_load failed"),
                ):
                    with pytest.raises(RuntimeError) as exc_info:
                        model_loader_module.load_model(temp_path)
            assert "Failed to load model" in str(exc_info.value)
        finally:
            _remove_fake_joblib()
            model_loader_module.clear_cache()
            os.remove(temp_path)


class TestGetModel:
    """Tests for the get_model convenience function."""

    def test_get_model_delegates_to_load_model_with_default_path(self):
        """get_model should call load_model and return its result."""
        model_loader_module.clear_cache()
        _remove_fake_joblib()

        mock_model = {"type": "mock_model"}
        fake_joblib = _inject_fake_joblib(mock_model)

        # Create fake model file at the actual DEFAULT_MODEL_PATH location
        fake_model_path = "/tmp/fake_diabetes_model_12345.pkl"
        open(fake_model_path, "w").close()
        with open(fake_model_path + ".sig", "w") as sf:
            sf.write("fake-signature")

        # Replace the default argument stored in load_model's __defaults__ tuple
        original_defaults = model_loader_module.load_model.__defaults__
        model_loader_module.load_model.__defaults__ = (fake_model_path,)
        try:
            with unittest.mock.patch(
                "app.ml.security.verify_signature", return_value=True
            ):
                result = model_loader_module.get_model()
            assert result is mock_model
            assert fake_joblib.load.call_count == 1
        finally:
            model_loader_module.load_model.__defaults__ = original_defaults

        _remove_fake_joblib()
        model_loader_module.clear_cache()
        os.remove(fake_model_path)
        os.remove(fake_model_path + ".sig")
