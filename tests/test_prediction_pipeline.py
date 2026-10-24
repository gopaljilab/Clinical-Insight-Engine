import numpy as np
import pytest
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from analyze import interpret_predictions_batch, validate_assessment_input
from app.ml.prediction_cache import get_cache


PATIENT = {
    "age": 52,
    "gender": "Female",
    "hypertension": True,
    "heartDisease": False,
    "smokingHistory": "former",
    "bmi": 30.1,
    "hba1cLevel": 6.4,
    "bloodGlucoseLevel": 148,
}

FEATURES = [
    "age", "hypertension", "heart_disease", "bmi", "HbA1c_level",
    "blood_glucose_level", "insulin", "skin_thickness", "gender_Male",
    "smoke_current", "smoke_former", "smoke_never",
]


class RecordingScaler:
    def __init__(self):
        self.values = None

    def transform(self, values):
        self.values = values.copy()
        return values


class ReversedClassModel:
    classes_ = np.array([1, 0])
    coef_ = np.zeros((1, len(FEATURES)))

    def predict_proba(self, values):
        return np.tile([0.73, 0.27], (len(values), 1))


def test_feature_order_preprocessing_and_positive_class_probability():
    get_cache().clear()
    scaler = RecordingScaler()
    result = interpret_predictions_batch(
        ReversedClassModel(), scaler, FEATURES, [dict(PATIENT)],
    )[0]

    assert scaler.values[0].tolist() == [
        52, 1, 0, 30.1, 6.4, 148, 80, 20, 0, 0, 1, 0,
    ]
    assert result["riskScore"] == 73.0
    assert result["prediction_method"] == "ml_model"
    assert result["fallback_used"] is False
    assert "modelConfidence" not in result
    assert "confidenceInterval" not in result


def test_factor_contribution_uses_standardized_value_and_preserves_direction():
    class StandardizingScaler:
        def transform(self, values):
            scaled = np.zeros_like(values, dtype=float)
            scaled[:, FEATURES.index("age")] = (values[:, FEATURES.index("age")] - 50) / 10
            return scaled

    class AgeCoefficientModel(ReversedClassModel):
        coef_ = np.zeros((1, len(FEATURES)))
        coef_[0, FEATURES.index("age")] = 1.0

    get_cache().clear()
    patient = {**PATIENT, "age": 23}
    result = interpret_predictions_batch(
        AgeCoefficientModel(), StandardizingScaler(), FEATURES, [patient],
    )[0]

    assert result["factors"][0]["name"] == "Age"
    assert result["factors"][0]["impact"] == "negative"
    assert result["factors"][0]["logOdds"] == -2.7


def test_input_validation_rejects_missing_invalid_and_nonfinite_fields():
    assert validate_assessment_input(dict(PATIENT)) == PATIENT
    for invalid in (
        {key: value for key, value in PATIENT.items() if key != "gender"},
        {**PATIENT, "gender": "Other"},
        {**PATIENT, "smokingHistory": "ever"},
        {**PATIENT, "age": True},
        {**PATIENT, "hypertension": 1},
        {**PATIENT, "bmi": float("nan")},
        {**PATIENT, "bloodGlucoseLevel": 401},
    ):
        with pytest.raises(ValueError):
            validate_assessment_input(invalid)


def test_local_python_daemon_integration_uses_the_model():
    root = Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory(prefix="cie-inference-") as temporary_dir:
        isolated = Path(temporary_dir)
        for name in ("analyze.py", "diabetes_dataset.csv"):
            shutil.copy2(root / name, isolated / name)
        for name in ("app", "services", "validation"):
            shutil.copytree(root / name, isolated / name, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        for name in ("diabetes_model.pkl", "diabetes_model.pkl.sig"):
            source = root / name
            if source.exists():
                shutil.copy2(source, isolated / name)

        request = {"requestId": "integration", "input": PATIENT}
        process = subprocess.run(
            [sys.executable, "analyze.py", "daemon"],
            input=json.dumps(request) + "\n",
            text=True,
            capture_output=True,
            cwd=isolated,
            timeout=90,
            check=False,
        )
        assert process.returncode == 0, process.stderr
        responses = [json.loads(line) for line in process.stdout.splitlines() if line.strip()]
        ready = next(item for item in responses if item.get("type") == "ready")
        prediction = next(item["prediction"] for item in responses if item.get("requestId") == "integration")

        assert ready["model_loaded"] is True
        assert prediction["prediction_method"] == "ml_model"
        assert prediction["fallback_used"] is False
        assert prediction["model_version"] == ready["model_version"]
        assert "modelConfidence" not in prediction
