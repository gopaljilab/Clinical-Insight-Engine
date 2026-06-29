"""
Unit tests for app/ml/model_loader.py — ML model singleton caching.
"""
import os
import sys
import tempfile

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)


class TestLoadModel:
    def test_file_not_found_error_for_missing_model(self):
        """FileNotFoundError is raised when model_path does not exist."""
        from app.ml.model_loader import load_model
        import pytest
        with pytest.raises(FileNotFoundError):
            load_model("/nonexistent/path/to/model.pkl")

    def test_permission_error_when_signature_verification_fails(self):
        """PermissionError is raised when model file is not signed."""
        from unittest.mock import patch
        from app.ml.model_loader import load_model
        import pytest

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pkl") as f:
            f.write(b"not a real model")
            f.flush()
            f_name = f.name

        try:
            with patch(
                "app.ml.security.verify_signature",
                return_value=False,
            ):
                with pytest.raises(PermissionError, match="signature verification failed"):
                    load_model(f_name)
        finally:
            os.remove(f_name)

    def test_cache_hit_returns_same_instance(self):
        """Subsequent calls return the same cached instance without reloading."""
        from unittest.mock import patch, MagicMock
        from app.ml.model_loader import load_model, clear_cache

        clear_cache()

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pkl") as f:
            f.write(b"dummy")
            f.flush()
            f_name = f.name

        call_count = 0
        mock_model = MagicMock()

        def mock_verify(path):
            return True

        def mock_joblib_load(path):
            nonlocal call_count
            call_count += 1
            return mock_model

        try:
            with patch("app.ml.security.verify_signature", side_effect=mock_verify):
                with patch("joblib.load", side_effect=mock_joblib_load):
                    result1 = load_model(f_name)
                    result2 = load_model(f_name)
                    assert result1 is result2
                    assert call_count == 1
        finally:
            clear_cache()
            os.remove(f_name)

    def test_runtime_error_when_all_load_strategies_fail(self):
        """RuntimeError is raised when both joblib and safe_pickle_load fail."""
        from unittest.mock import patch
        from app.ml.model_loader import load_model
        import pytest

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pkl") as f:
            f.write(b"not pickleable")
            f.flush()
            f_name = f.name

        try:
            with patch("app.ml.security.verify_signature", return_value=True):
                with patch("joblib.load", side_effect=Exception("joblib failed")):
                    with patch(
                        "app.ml.security.safe_pickle_load",
                        side_effect=Exception("pickle failed"),
                    ):
                        with pytest.raises(RuntimeError, match="Failed to load model"):
                            load_model(f_name)
        finally:
            os.remove(f_name)


class TestGetModel:
    def test_get_model_calls_load_model_and_returns_result(self):
        """get_model() returns the result of load_model()."""
        from unittest.mock import patch, MagicMock
        from app.ml.model_loader import get_model, clear_cache

        clear_cache()

        mock_model = MagicMock()

        with patch("app.ml.model_loader.load_model", return_value=mock_model) as mock_load:
            result = get_model()
            assert result is mock_model
            mock_load.assert_called_once_with()

        clear_cache()


class TestClearCache:
    def test_clear_cache_empties_internal_cache(self):
        """clear_cache() empties the model cache so subsequent calls reload from disk."""
        from unittest.mock import patch, MagicMock
        from app.ml.model_loader import load_model, clear_cache, _model_cache

        clear_cache()

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pkl") as f:
            f.write(b"modela")
            f.flush()
            f_name = f.name

        load_count = 0

        def mock_verify(path):
            return True

        def mock_joblib_load(path):
            nonlocal load_count
            load_count += 1
            mock_instance = MagicMock()
            mock_instance.__class__.__name__ = "ModelA"
            return mock_instance

        try:
            with patch("app.ml.security.verify_signature", side_effect=mock_verify):
                with patch("joblib.load", side_effect=mock_joblib_load):
                    result1 = load_model(f_name)
                    assert load_count == 1

                    result2 = load_model(f_name)
                    assert load_count == 1
                    assert result1 is result2

                    clear_cache()

                    result3 = load_model(f_name)
                    assert load_count == 2
                    assert result3 is not result1
        finally:
            clear_cache()
            os.remove(f_name)
