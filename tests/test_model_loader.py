"""
Unit tests for app/ml/model_loader.py
"""
import os
import sys
import tempfile
import threading
from pathlib import Path
from unittest import mock

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from app.ml.model_loader import (
    load_model,
    DEFAULT_MODEL_PATH,
    _model_cache,
    clear_cache,
)


class TestLoadModel:
    """Test suite for load_model function."""

    def setup_method(self):
        """Clear cache before each test."""
        clear_cache()

    def teardown_method(self):
        """Clear cache after each test."""
        clear_cache()

    def test_raises_FileNotFoundError_for_missing_model(self, tmp_path):
        """Verify FileNotFoundError is raised when the model file does not exist."""
        fake_path = str(tmp_path / "nonexistent_model.pkl")
        with pytest.raises(FileNotFoundError) as exc_info:
            load_model(fake_path)
        assert "not found" in str(exc_info.value).lower()

    def test_returns_same_instance_on_second_call(self, tmp_path):
        """Verify singleton caching: second call returns the cached model."""
        model_file = tmp_path / "fake_model.pkl"
        model_file.write_bytes(b"fake model bytes")

        # Patch both joblib.load and the security.verify_signature
        mock_joblib = mock.MagicMock(load=mock.MagicMock(return_value={"type": "diabetes_model"}))
        with mock.patch.dict(sys.modules, {"joblib": mock_joblib}):
            with mock.patch("app.ml.security.verify_signature", return_value=True):
                model1 = load_model(str(model_file))
                model2 = load_model(str(model_file))
                assert model1 is model2, "Second call should return cached instance"

    def test_populates_model_cache_after_first_load(self, tmp_path):
        """Verify _model_cache is populated after first load."""
        model_file = tmp_path / "cache_test_model.pkl"
        model_file.write_bytes(b"test model bytes")

        abs_path = str(Path(model_file).resolve())
        assert abs_path not in _model_cache

        mock_joblib = mock.MagicMock(load=mock.MagicMock(return_value={"type": "test_model"}))
        with mock.patch.dict(sys.modules, {"joblib": mock_joblib}):
            with mock.patch("app.ml.security.verify_signature", return_value=True):
                load_model(str(model_file))

        assert abs_path in _model_cache

    def test_thread_safety_double_checked_locking(self, tmp_path):
        """Verify two concurrent calls do not load the model twice (double-checked locking)."""
        model_file = tmp_path / "thread_test_model.pkl"
        model_file.write_bytes(b"thread model bytes")

        load_count = 0
        count_lock = threading.Lock()

        def counting_load(*args, **kwargs):
            with count_lock:
                nonlocal load_count
                load_count += 1
            return {"type": "concurrent_model"}

        mock_joblib = mock.MagicMock(load=mock.MagicMock(side_effect=counting_load))
        with mock.patch.dict(sys.modules, {"joblib": mock_joblib}):
            with mock.patch("app.ml.security.verify_signature", return_value=True):
                t1 = threading.Thread(target=load_model, args=(str(model_file),))
                t2 = threading.Thread(target=load_model, args=(str(model_file),))
                t1.start()
                t2.start()
                t1.join()
                t2.join()

        # The double-checked locking pattern should ensure only one load
        assert load_count == 1, f"Expected 1 load, got {load_count}"


import pytest
