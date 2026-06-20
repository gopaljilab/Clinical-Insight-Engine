"""
Tests for app.middleware.phi_redaction.phi_redaction_middleware decorator.

This decorator automatically redacts PHI from function arguments before
passing them through to the wrapped function.
"""
import os
import sys
import tempfile
import pytest

# Ensure the app package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.middleware.phi_redaction import phi_redaction_middleware


def make_mock_redactor():
    """Create a mock PHIRedactor for testing."""
    from app.services.phi_redactor import PHIRedactor
    return PHIRedactor()


class TestPhiRedactionMiddlewareDisabled:
    """Tests when ENABLE_PHI_REDACTION is False (sanitization only)."""

    def test_disabled_only_sanitizes_dict_arguments(self, monkeypatch):
        """When disabled, arguments are sanitized but PHI is not redacted."""
        monkeypatch.setattr("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", False)

        captured_args = None

        @phi_redaction_middleware
        def target_fn(patient_data):
            nonlocal captured_args
            captured_args = patient_data
            return "ok"

        result = target_fn({"patientName": "John Doe", "email": "john@example.com"})
        assert result == "ok"
        # PHI should NOT be redacted when disabled
        assert captured_args["patientName"] == "John Doe"
        assert captured_args["email"] == "john@example.com"

    def test_disabled_does_not_redact_string_phi(self, monkeypatch):
        """When disabled, PHI-like strings are passed through unchanged."""
        monkeypatch.setattr("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", False)

        captured_args = None

        @phi_redaction_middleware
        def target_fn(text):
            nonlocal captured_args
            captured_args = text
            return "ok"

        result = target_fn("My patient John Doe is 45 years old")
        assert result == "ok"
        # Not redacted when disabled
        assert captured_args == "My patient John Doe is 45 years old"


class TestPhiRedactionMiddlewareEnabled:
    """Tests when ENABLE_PHI_REDACTION is True (full redaction)."""

    def test_enabled_redacts_dict_phi_keys(self, monkeypatch):
        """PHI keys in dict arguments are redacted when enabled."""
        monkeypatch.setattr("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True)

        captured_args = None

        @phi_redaction_middleware
        def target_fn(data):
            nonlocal captured_args
            captured_args = data
            return "ok"

        result = target_fn({"patientName": "Alice Smith", "bmi": 25.0})
        assert result == "ok"
        # patientName should be redacted
        assert captured_args["patientName"] == "[PATIENT_NAME]"
        # Non-PHI key should be unchanged
        assert captured_args["bmi"] == 25.0

    def test_enabled_redacts_list_of_dicts(self, monkeypatch):
        """A list of dicts is traversed and each dict with PHI is redacted."""
        monkeypatch.setattr("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True)

        captured_args = None

        @phi_redaction_middleware
        def target_fn(data_list):
            nonlocal captured_args
            captured_args = data_list
            return "ok"

        result = target_fn([
            {"patientName": "Bob Jones", "age": 30},
            {"patientName": "Carol White", "age": 40},
        ])
        assert result == "ok"
        assert captured_args[0]["patientName"] == "[PATIENT_NAME]"
        assert captured_args[1]["patientName"] == "[PATIENT_NAME]"
        assert captured_args[0]["age"] == 30
        assert captured_args[1]["age"] == 40

    def test_enabled_bypasses_model_and_scaler_kwargs(self, monkeypatch):
        """Non-PHI keyword args (model, scaler, features) bypass redaction."""
        monkeypatch.setattr("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True)

        from sklearn.linear_model import LinearRegression
        import numpy as np

        captured_kwargs = None

        @phi_redaction_middleware
        def target_fn(model=None, scaler=None, features=None, **kwargs):
            nonlocal captured_kwargs
            captured_kwargs = {"model": model, "scaler": scaler, "features": features, **kwargs}
            return "ok"

        mock_model = LinearRegression()
        mock_scaler = "MockScaler"
        feature_names = ["age", "bmi", "glucose"]

        result = target_fn(model=mock_model, scaler=mock_scaler, features=feature_names)
        assert result == "ok"
        # These should pass through unchanged (not be converted to [REDACTED])
        assert captured_kwargs["model"] is mock_model
        assert captured_kwargs["scaler"] == mock_scaler
        assert captured_kwargs["features"] == feature_names

    def test_enabled_redacts_phi_keyword_args(self, monkeypatch):
        """Keyword args with PHI names (patient_data, data, notes) are redacted."""
        monkeypatch.setattr("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True)

        captured_kwargs = None

        @phi_redaction_middleware
        def target_fn(input_data=None, notes=None):
            nonlocal captured_kwargs
            captured_kwargs = {"input_data": input_data, "notes": notes}
            return "ok"

        result = target_fn(
            input_data={"patientName": "David Lee"},
            notes="Patient David Lee has diabetes",
        )
        assert result == "ok"
        assert captured_kwargs["input_data"]["patientName"] == "[PATIENT_NAME]"
        assert "[PATIENT_NAME]" in captured_kwargs["notes"]

    def test_enabled_preserves_numeric_args(self, monkeypatch):
        """Numeric arguments pass through without redaction."""
        monkeypatch.setattr("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True)

        captured_args = None

        @phi_redaction_middleware
        def target_fn(age, bmi, glucose):
            nonlocal captured_args
            captured_args = (age, bmi, glucose)
            return "ok"

        result = target_fn(45, 28.5, 150.0)
        assert result == "ok"
        assert captured_args == (45, 28.5, 150.0)

    def test_enabled_short_string_unchanged(self, monkeypatch):
        """Short strings (< 30 chars, no PHI indicators) are not redacted."""
        monkeypatch.setattr("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", True)

        captured_args = None

        @phi_redaction_middleware
        def target_fn(text):
            nonlocal captured_args
            captured_args = text
            return "ok"

        result = target_fn("Diabetes management plan")
        assert result == "ok"
        # Short strings without PHI indicators pass through
        assert captured_args == "Diabetes management plan"
