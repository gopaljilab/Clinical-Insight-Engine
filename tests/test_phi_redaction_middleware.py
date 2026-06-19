"""
Unit tests for app/middleware/phi_redaction.py
phi_redaction_middleware decorator behavior.
"""
import pytest
import sys
from unittest.mock import patch, MagicMock

# Ensure app is importable
sys.path.insert(0, ".")

from app.middleware.phi_redaction import phi_redaction_middleware


class TestPhiRedactionMiddleware:
    """Tests for phi_redaction_middleware decorator."""

    def test_no_redaction_when_flag_disabled(self):
        """When ENABLE_PHI_REDACTION is False, function is called with sanitized args."""
        @phi_redaction_middleware
        def example_fn(data):
            return data

        mock_result = {"patientName": "John Doe", "email": "john@example.com"}
        with patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", False):
            result = example_fn(mock_result)
        assert result == mock_result

    def test_dict_argument_is_redacted_when_enabled(self):
        """When ENABLE_PHI_REDACTION is True, dict arguments are redacted."""
        @phi_redaction_middleware
        def example_fn(data):
            return data

        with patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True):
            result = example_fn({"patientName": "John Doe", "email": "john@example.com"})
        assert result["patientName"] == "[PATIENT_NAME]"
        assert result["email"] == "[EMAIL]"

    def test_list_of_dicts_is_redacted_when_enabled(self):
        """When ENABLE_PHI_REDACTION is True, list of dicts are redacted."""
        @phi_redaction_middleware
        def example_fn(data_list):
            return data_list

        input_data = [
            {"patientName": "Alice Smith", "bmi": 25.0},
            {"patientName": "Bob Jones", "bmi": 30.1},
        ]
        with patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True):
            result = example_fn(input_data)
        assert result[0]["patientName"] == "[PATIENT_NAME]"
        assert result[1]["patientName"] == "[PATIENT_NAME]"

    def test_list_of_strings_is_redacted_when_enabled(self):
        """When ENABLE_PHI_REDACTION is True, list of strings is redacted."""
        @phi_redaction_middleware
        def example_fn(texts):
            return texts

        input_data = ["Patient John Doe has an appointment", "Email: john@example.com"]
        with patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True):
            result = example_fn(input_data)
        assert "[PATIENT_NAME]" in result[0] or "[PATIENT_NAME]" in result[1]

    def test_string_argument_with_phi_is_redacted(self):
        """Long clinical text strings with PHI indicators are redacted."""
        @phi_redaction_middleware
        def example_fn(text):
            return text

        clinical_text = "Patient Name: John Doe, MRN: 12345, Phone: 555-123-4567"
        with patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True):
            result = example_fn(clinical_text)
        assert "John Doe" not in result or "555-123-4567" not in result

    def test_string_argument_short_non_phi_passes_through(self):
        """Short strings that don't look like PHI are passed through unchanged."""
        @phi_redaction_middleware
        def example_fn(text):
            return text

        with patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True):
            result = example_fn("hello")
        assert result == "hello"

    def test_model_parameter_not_redacted(self):
        """The 'model' parameter is whitelisted and not redacted."""
        @phi_redaction_middleware
        def predict_fn(model, input_data):
            return {"model": model, "data": input_data}

        mock_model = MagicMock()
        mock_model.__class__.__name__ = "LogisticRegression"
        input_dict = {"patientName": "Test Patient"}
        with patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True):
            result = predict_fn(mock_model, input_dict)
        # model should be passed through unchanged
        assert result["model"] is mock_model

    def test_scaler_parameter_not_redacted(self):
        """The 'scaler' parameter is whitelisted and not redacted."""
        @phi_redaction_middleware
        def scale_fn(scaler, data):
            return {"scaler": scaler, "data": data}

        mock_scaler = MagicMock()
        input_dict = {"patientName": "Test Patient"}
        with patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True):
            result = scale_fn(mock_scaler, input_dict)
        assert result["scaler"] is mock_scaler

    def test_features_parameter_not_redacted(self):
        """The 'features' parameter is whitelisted and not redacted."""
        @phi_redaction_middleware
        def train_fn(features, labels):
            return {"features": features, "labels": labels}

        features = [1.0, 2.0, 3.0]
        labels = [0, 1]
        with patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True):
            result = train_fn(features, labels)
        assert result["features"] == features
        assert result["labels"] == labels

    def test_input_data_kwarg_is_redacted(self):
        """The 'input_data' keyword argument is redacted."""
        @phi_redaction_middleware
        def process_fn(input_data=None):
            return input_data

        input_dict = {"patientName": "Jane Doe"}
        with patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True):
            result = process_fn(input_data=input_dict)
        assert result["patientName"] == "[PATIENT_NAME]"

    def test_notes_kwarg_is_redacted(self):
        """The 'notes' keyword argument is redacted."""
        @phi_redaction_middleware
        def process_fn(notes=None):
            return notes

        with patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True):
            result = process_fn(notes="Patient Name: Jane Doe")
        assert "Jane Doe" not in result

    def test_text_kwarg_is_redacted(self):
        """The 'text' keyword argument is redacted."""
        @phi_redaction_middleware
        def process_fn(text=None):
            return text

        with patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True):
            result = process_fn(text="Email: test@example.com")
        assert "test@example.com" not in result

    def test_mixed_args_and_kwargs(self):
        """Both positional and keyword arguments are processed correctly."""
        @phi_redaction_middleware
        def mixed_fn(pos_arg, input_data=None, notes=None):
            return {"pos": pos_arg, "data": input_data, "notes": notes}

        with patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True):
            result = mixed_fn(
                {"patientName": "John Doe"},
                input_data={"bmi": 25.0},
                notes="Contact: john@example.com"
            )
        assert result["pos"]["patientName"] == "[PATIENT_NAME]"
        assert result["data"]["bmi"] == 25.0
        assert "john@example.com" not in result["notes"]

    def test_non_dict_non_list_non_str_args_pass_through(self):
        """Numeric and None arguments are passed through without redaction."""
        @phi_redaction_middleware
        def numeric_fn(n, f, flag):
            return {"n": n, "f": f, "flag": flag}

        with patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True):
            result = numeric_fn(42, 3.14, True)
        assert result["n"] == 42
        assert result["f"] == 3.14
        assert result["flag"] is True

    def test_sanitization_applied_before_redaction(self):
        """Sanitization (from text_sanitizer) is always applied before PHI redaction."""
        @phi_redaction_middleware
        def sanitize_test_fn(data):
            return data

        # Text with null byte should have null removed even when redaction is enabled
        input_dict = {"notes": "Name:\x00John"}
        with patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True):
            result = sanitize_test_fn(input_dict)
        # Null byte should have been stripped by sanitize_data
        assert "\x00" not in str(result.get("notes", ""))
