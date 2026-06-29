"""
Unit tests for the PHI Redaction Middleware decorator.
"""
import os
import sys
import unittest
from unittest.mock import patch, MagicMock

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)


class TestPhiRedactionMiddlewareDisabled(unittest.TestCase):
    """Tests when ENABLE_PHI_REDACTION is False."""

    @patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", False)
    def test_only_sanitization_when_redaction_disabled(self):
        """When ENABLE_PHI_REDACTION is False, PHIRedactor is not called."""
        from app.middleware.phi_redaction import phi_redaction_middleware
        from app.services.phi_redactor import PHIRedactor

        with patch.object(PHIRedactor, "redact_patient_data") as mock_redact:
            mock_func = MagicMock(return_value="result")
            decorated = phi_redaction_middleware(mock_func)
            decorated(input_data={"name": "John"})
            mock_redact.assert_not_called()


class TestPhiRedactionMiddlewareEnabled(unittest.TestCase):
    """Tests when ENABLE_PHI_REDACTION is True."""

    @patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True)
    def test_dict_arg_redacted(self):
        """Dict argument is redacted via PHIRedactor.redact_patient_data."""
        from app.middleware.phi_redaction import phi_redaction_middleware
        from app.services.phi_redactor import PHIRedactor

        with patch.object(PHIRedactor, "redact_patient_data") as mock_redact:
            mock_redact.return_value = {"name": "[PATIENT_NAME]"}
            mock_func = MagicMock(return_value="result")
            decorated = phi_redaction_middleware(mock_func)

            result = decorated(input_data={"name": "John Doe"})

            mock_redact.assert_called_once()
            self.assertEqual(result, "result")

    @patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True)
    def test_list_of_dicts_redacted(self):
        """List containing dicts is redacted via PHIRedactor.redact_patient_data."""
        from app.middleware.phi_redaction import phi_redaction_middleware
        from app.services.phi_redactor import PHIRedactor

        with patch.object(PHIRedactor, "redact_patient_data") as mock_redact:
            mock_redact.return_value = [{"name": "[PATIENT_NAME]"}]
            mock_func = MagicMock(return_value="result")
            decorated = phi_redaction_middleware(mock_func)

            data = [{"name": "John Doe"}, {"name": "Jane Smith"}]
            result = decorated(input_data_list=data)

            mock_redact.assert_called_once()
            self.assertEqual(result, "result")

    @patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True)
    def test_text_kwarg_triggered_by_key_name(self):
        """Keyword arg 'text' matches PHI list, value is redacted via redact_patient_data."""
        from app.middleware.phi_redaction import phi_redaction_middleware
        from app.services.phi_redactor import PHIRedactor

        with patch.object(PHIRedactor, "redact_patient_data") as mock_redact:
            mock_redact.return_value = "[REDACTED]"
            mock_func = MagicMock(return_value="result")
            decorated = phi_redaction_middleware(mock_func)

            long_text = "Patient John Doe visited the clinic on 2026-01-15"
            result = decorated(text=long_text)

            # 'text' matches ['input_data', 'input_data_list', 'patient_data', 'data', 'text', 'notes']
            # so redact_patient_data is called (value type dict/list/str triggers redaction path)
            mock_redact.assert_called_once()
            self.assertEqual(result, "result")

    @patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True)
    def test_positional_string_only_redacted_if_long_or_phi_indicator(self):
        """Positional string >30 chars with PHI indicator is redacted."""
        from app.middleware.phi_redaction import phi_redaction_middleware
        from app.services.phi_redactor import PHIRedactor

        with patch.object(PHIRedactor, "redact_text") as mock_redact_text:
            mock_redact_text.return_value = "[REDACTED]"
            mock_func = MagicMock(return_value="result")
            decorated = phi_redaction_middleware(mock_func)

            # Positional arg (not kwarg), contains PHI indicator "Patient"
            result = decorated("Patient John Doe MRN12345 visited clinic")

            mock_redact_text.assert_called_once()
            self.assertEqual(result, "result")

    @patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True)
    def test_positional_short_string_without_phi_not_redacted(self):
        """Short positional string without PHI indicators passes through without redaction."""
        from app.middleware.phi_redaction import phi_redaction_middleware
        from app.services.phi_redactor import PHIRedactor

        with patch.object(PHIRedactor, "redact_text") as mock_redact_text:
            mock_func = MagicMock(return_value="result")
            decorated = phi_redaction_middleware(mock_func)

            # Short positional string, no PHI indicators
            result = decorated("hello world")

            mock_redact_text.assert_not_called()
            self.assertEqual(result, "result")

    @patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True)
    def test_features_kwarg_not_redacted(self):
        """Keyword arg 'features' is NOT redacted (sklearn feature list)."""
        from app.middleware.phi_redaction import phi_redaction_middleware
        from app.services.phi_redactor import PHIRedactor

        with patch.object(PHIRedactor, "redact_patient_data") as mock_redact:
            mock_func = MagicMock(return_value="result")
            decorated = phi_redaction_middleware(mock_func)

            result = decorated(features=["age", "bp", "cholesterol"])

            mock_redact.assert_not_called()
            self.assertEqual(result, "result")

    @patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True)
    def test_model_kwarg_not_redacted(self):
        """Keyword arg 'model' is NOT redacted (sklearn model class)."""
        from app.middleware.phi_redaction import phi_redaction_middleware
        from app.services.phi_redactor import PHIRedactor

        with patch.object(PHIRedactor, "redact_patient_data") as mock_redact:
            mock_scaler = MagicMock()
            mock_func = MagicMock(return_value="result")
            decorated = phi_redaction_middleware(mock_func)

            result = decorated(model=mock_scaler)

            mock_redact.assert_not_called()
            self.assertEqual(result, "result")

    @patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True)
    def test_scaler_kwarg_not_redacted(self):
        """Keyword arg 'scaler' is NOT redacted."""
        from app.middleware.phi_redaction import phi_redaction_middleware
        from app.services.phi_redactor import PHIRedactor

        with patch.object(PHIRedactor, "redact_patient_data") as mock_redact:
            mock_scaler = MagicMock()
            mock_func = MagicMock(return_value="result")
            decorated = phi_redaction_middleware(mock_func)

            result = decorated(scaler=mock_scaler)

            mock_redact.assert_not_called()
            self.assertEqual(result, "result")

    @patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True)
    def test_notes_kwarg_is_redacted(self):
        """Keyword arg 'notes' matches PHI list, value is redacted."""
        from app.middleware.phi_redaction import phi_redaction_middleware
        from app.services.phi_redactor import PHIRedactor

        with patch.object(PHIRedactor, "redact_patient_data") as mock_redact:
            mock_redact.return_value = "[REDACTED]"
            mock_func = MagicMock(return_value="result")
            decorated = phi_redaction_middleware(mock_func)

            result = decorated(notes="Patient John Doe MRN123")

            mock_redact.assert_called_once()
            self.assertEqual(result, "result")

    @patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True)
    def test_non_dict_non_list_non_string_args_pass_through(self):
        """Non-dict/list/string positional args (int, float, None) pass through."""
        from app.middleware.phi_redaction import phi_redaction_middleware
        from app.services.phi_redactor import PHIRedactor

        with patch.object(PHIRedactor, "redact_patient_data") as mock_redact:
            mock_func = MagicMock(return_value="result")
            decorated = phi_redaction_middleware(mock_func)

            result = decorated(42, None, 3.14, patient_data={"name": "John"})

            self.assertEqual(result, "result")
            # Only patient_data kwarg triggers redaction
            self.assertEqual(mock_redact.call_count, 1)
