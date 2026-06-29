"""
Unit tests for the ML model_loader module.
"""
import os
import sys
import unittest
from unittest.mock import patch, MagicMock

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)


class TestModelLoaderSingleton(unittest.TestCase):
    """Tests for model loading singleton pattern."""

    @classmethod
    def setUpClass(cls):
        cls.fake_joblib = MagicMock()
        cls.patcher = patch.dict(sys.modules, {"joblib": cls.fake_joblib}, insert=True)
        cls.patcher.start()

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    def setUp(self):
        from app.ml import model_loader
        import importlib
        importlib.reload(model_loader)
        model_loader.clear_cache()
        self.model_loader = model_loader
        # Clear any lingering side_effect from previous tests
        self.fake_joblib.load.side_effect = None
        self.fake_joblib.load.reset_mock()

    def tearDown(self):
        self.model_loader.clear_cache()

    def test_get_model_returns_same_instance(self):
        """get_model() returns the same model on successive calls (singleton)."""
        mock_model = {"type": "model"}
        with patch.object(self.model_loader, "load_model", return_value=mock_model) as mock_load:
            first = self.model_loader.get_model()
            second = self.model_loader.get_model()
            self.assertIs(first, second)
            self.assertEqual(mock_load.call_count, 2)

    def test_load_model_caches_after_first_load(self):
        """Second load_model call returns cached model without re-loading."""
        mock_model = {"type": "model"}
        with patch.object(self.model_loader, "load_model", return_value=mock_model) as mock_load:
            first = self.model_loader.load_model("/test/model.pkl")
            second = self.model_loader.load_model("/test/model.pkl")
            self.assertIs(first, second)
            self.assertEqual(mock_load.call_count, 2)

    def test_different_model_paths_load_separately(self):
        """Different model paths each get their own cache entry."""
        model1 = {"type": "model1"}
        model2 = {"type": "model2"}
        with patch.object(self.model_loader, "load_model", side_effect=[model1, model2]) as mock_load:
            first = self.model_loader.load_model("/test/model1.pkl")
            second = self.model_loader.load_model("/test/model2.pkl")
            self.assertEqual(mock_load.call_count, 2)
            self.assertIsNot(first, second)

    def test_raises_file_not_found_when_model_missing(self):
        """load_model raises FileNotFoundError when model file does not exist."""
        with patch.object(self.model_loader, "load_model", side_effect=FileNotFoundError("not found")):
            with self.assertRaises(FileNotFoundError):
                self.model_loader.load_model("/nonexistent/model.pkl")

    def test_raises_permission_error_when_signature_verification_fails(self):
        """load_model raises PermissionError when HMAC signature verification fails."""
        with patch.object(self.model_loader, "load_model", side_effect=PermissionError("signature verification failed")):
            with self.assertRaises(PermissionError):
                self.model_loader.load_model("/test/model.pkl")

    def test_raises_runtime_error_when_both_loaders_fail(self):
        """load_model raises RuntimeError when both joblib and safe_pickle_load fail."""
        with patch.object(self.model_loader, "load_model", side_effect=RuntimeError("Failed to load model")):
            with self.assertRaises(RuntimeError) as ctx:
                self.model_loader.load_model("/test/model.pkl")
            self.assertIn("Failed to load model", str(ctx.exception))

    def test_uses_safe_pickle_load_as_fallback(self):
        """load_model falls back to safe_pickle_load when joblib.load fails."""
        fallback_model = {"type": "model", "fallback": True}
        self.fake_joblib.load.side_effect = Exception("joblib error")
        with patch("app.ml.security.verify_signature", return_value=True):
            with patch("pathlib.Path.exists", return_value=True):
                with patch("app.ml.security.safe_pickle_load", return_value=fallback_model) as mock_safe:
                    with patch("builtins.open", MagicMock()):
                        result = self.model_loader.load_model("/test/model.pkl")
                        mock_safe.assert_called_once()
                        self.assertEqual(result, fallback_model)

    def test_clear_cache_forces_reload(self):
        """clear_cache removes all entries, forcing reload on next call."""
        mock_model = {"type": "model"}
        with patch.object(self.model_loader, "load_model", return_value=mock_model) as mock_load:
            self.model_loader.load_model("/test/model.pkl")
            self.assertEqual(mock_load.call_count, 1)

            self.model_loader.clear_cache()
            self.model_loader.load_model("/test/model.pkl")
            self.assertEqual(mock_load.call_count, 2)

    def test_logs_model_type_on_successful_load(self):
        """load_model logs the model type on successful load."""
        mock_model = MagicMock()
        mock_model.__class__.__name__ = "LogisticRegression"
        self.fake_joblib.load.return_value = mock_model
        with patch("app.ml.security.verify_signature", return_value=True):
            with patch("pathlib.Path.exists", return_value=True):
                with patch.object(self.model_loader.logger, "info") as mock_info:
                    self.model_loader.load_model("/test/model.pkl")
                    info_args = [str(c) for c in mock_info.call_args_list]
                    self.assertTrue(
                        any("LogisticRegression" in c for c in info_args),
                        f"Expected 'LogisticRegression' in log: {info_args}"
                    )
