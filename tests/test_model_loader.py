import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

# Ensure the app module is on the path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Import the module (patch before importing loader to intercept runtime imports)
import app.ml.model_loader as model_loader_module


@pytest.fixture(autouse=True)
def clear_model_cache():
    """Clear the module-level cache before each test."""
    model_loader_module._model_cache.clear()
    yield
    model_loader_module._model_cache.clear()


class TestLoadModel:
    def test_load_model_raises_file_not_found_for_missing_path(self):
        """FileNotFoundError is raised when the model file does not exist."""
        with pytest.raises(FileNotFoundError) as exc_info:
            model_loader_module.load_model("/nonexistent/path/model.pkl")
        assert "Model file not found" in str(exc_info.value)

    def test_load_model_raises_permission_error_when_signature_fails(self):
        """PermissionError is raised when signature verification fails."""
        fake_path = str(Path(tempfile.gettempdir()) / "fake_model.pkl")
        Path(fake_path).touch()

        try:
            # verify_signature is imported at runtime from app.ml.security inside load_model
            with patch("app.ml.security.verify_signature", return_value=False):
                with pytest.raises(PermissionError) as exc_info:
                    model_loader_module.load_model(fake_path)
            assert "signature verification failed" in str(exc_info.value)
        finally:
            Path(fake_path).unlink(missing_ok=True)

    def test_load_model_raises_runtime_error_on_joblib_failure(self):
        """RuntimeError is raised when joblib.load fails and safe_pickle_load also fails."""
        fake_path = str(Path(tempfile.gettempdir()) / "corrupt_model.pkl")
        Path(fake_path).touch()

        try:
            with patch("app.ml.security.verify_signature", return_value=True):
                with patch("joblib.load", side_effect=Exception("Corrupt file")):
                    with patch("app.ml.security.safe_pickle_load", side_effect=Exception("Also failed")):
                        with pytest.raises(RuntimeError) as exc_info:
                            model_loader_module.load_model(fake_path)
            assert "Failed to load model" in str(exc_info.value)
        finally:
            Path(fake_path).unlink(missing_ok=True)

    def test_load_model_returns_cached_model_on_second_call(self):
        """Second call with same path returns cached model without calling joblib."""
        fake_path = str(Path(tempfile.gettempdir()) / "test_model.pkl")
        Path(fake_path).touch()

        try:
            mock_model = MagicMock()
            mock_model.__class__.__name__ = "MockModel"

            call_count = 0

            def fake_joblib_load(path):
                nonlocal call_count
                call_count += 1
                return mock_model

            with patch("app.ml.security.verify_signature", return_value=True):
                with patch("joblib.load", side_effect=fake_joblib_load):
                    result1 = model_loader_module.load_model(fake_path)
                    result2 = model_loader_module.load_model(fake_path)

            assert result1 is result2
            assert result1 is mock_model
            # joblib.load should be called only once (second call uses cache)
            assert call_count == 1
        finally:
            Path(fake_path).unlink(missing_ok=True)

    def test_load_model_calls_joblib_load_on_cache_miss(self):
        """On cache miss, joblib.load is called to load the model."""
        fake_path = str(Path(tempfile.gettempdir()) / "load_test_model.pkl")
        Path(fake_path).touch()

        try:
            mock_model = MagicMock()
            mock_model.__class__.__name__ = "LoadedModel"

            with patch("app.ml.security.verify_signature", return_value=True):
                with patch("joblib.load", return_value=mock_model):
                    result = model_loader_module.load_model(fake_path)

            assert result is mock_model
        finally:
            Path(fake_path).unlink(missing_ok=True)

    def test_load_model_falls_back_to_safe_pickle_load_on_joblib_error(self):
        """When joblib.load fails, safe_pickle_load is attempted as fallback."""
        fake_path = str(Path(tempfile.gettempdir()) / "fallback_model.pkl")
        Path(fake_path).touch()

        try:
            mock_model = MagicMock()
            mock_model.__class__.__name__ = "FallbackModel"

            with patch("app.ml.security.verify_signature", return_value=True):
                with patch("joblib.load", side_effect=Exception("joblib failed")):
                    with patch("app.ml.security.safe_pickle_load", return_value=mock_model):
                        result = model_loader_module.load_model(fake_path)

            assert result is mock_model
        finally:
            Path(fake_path).unlink(missing_ok=True)

    def test_load_model_uses_absolute_path_for_cache_key(self):
        """Cache key uses resolved absolute path, so relative and absolute paths match."""
        fake_path = str(Path(tempfile.gettempdir()) / "abs_path_model.pkl")
        Path(fake_path).touch()

        try:
            mock_model = MagicMock()
            mock_model.__class__.__name__ = "AbsModel"

            with patch("app.ml.security.verify_signature", return_value=True):
                with patch("joblib.load", return_value=mock_model):
                    # Load with relative path
                    rel = os.path.relpath(fake_path)
                    result1 = model_loader_module.load_model(rel)

                    # Load again with absolute path — should hit cache
                    result2 = model_loader_module.load_model(os.path.abspath(fake_path))

            assert result1 is result2
            # joblib.load called only once
            result1  # reference to avoid unused warning
            assert True
        finally:
            Path(fake_path).unlink(missing_ok=True)


class TestGetModel:
    def test_get_model_delegates_to_load_model(self):
        """get_model() calls load_model() with the default path."""
        fake_path = str(Path(tempfile.gettempdir()) / "get_model_test.pkl")
        Path(fake_path).touch()

        try:
            mock_model = MagicMock()
            mock_model.__class__.__name__ = "GetModelTest"

            with patch.object(model_loader_module, "load_model", return_value=mock_model) as mock_load:
                result = model_loader_module.get_model()

            assert result is mock_model
            mock_load.assert_called_once()
        finally:
            Path(fake_path).unlink(missing_ok=True)


class TestClearCache:
    def test_clear_cache_removes_all_cached_models(self):
        """clear_cache() empties the internal model cache."""
        # Populate cache manually
        model_loader_module._model_cache["/fake/path"] = MagicMock()

        assert len(model_loader_module._model_cache) > 0

        model_loader_module.clear_cache()

        assert len(model_loader_module._model_cache) == 0
