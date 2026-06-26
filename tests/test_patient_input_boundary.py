"""
Boundary tests for app/schemas/patient_input.py — PredictionResponse and edge cases.
"""
import pytest
from pydantic import ValidationError
from app.schemas.patient_input import PatientInput, PredictionResponse


class TestPredictionResponseFromProbability:
    def test_probability_zero_returns_low_risk(self):
        resp = PredictionResponse.from_probability(0.0)
        assert resp.prediction == 0
        assert resp.risk_level == "LOW"
        assert resp.message != ""

    def test_probability_at_lower_boundary(self):
        resp = PredictionResponse.from_probability(0.299)
        assert resp.prediction == 0
        assert resp.risk_level == "LOW"

    def test_probability_at_low_medium_threshold(self):
        resp = PredictionResponse.from_probability(0.3)
        assert resp.prediction == 0
        assert resp.risk_level == "MEDIUM"

    def test_probability_just_below_medium(self):
        resp = PredictionResponse.from_probability(0.299)
        assert resp.risk_level == "LOW"
        resp2 = PredictionResponse.from_probability(0.3)
        assert resp2.risk_level == "MEDIUM"

    def test_probability_at_fifty(self):
        resp = PredictionResponse.from_probability(0.5)
        assert resp.prediction == 1
        assert resp.risk_level == "MEDIUM"

    def test_probability_just_below_high_threshold(self):
        resp = PredictionResponse.from_probability(0.599)
        assert resp.risk_level == "MEDIUM"

    def test_probability_at_high_threshold(self):
        resp = PredictionResponse.from_probability(0.6)
        assert resp.prediction == 1
        assert resp.risk_level == "HIGH"

    def test_probability_just_above_high_threshold(self):
        resp = PredictionResponse.from_probability(0.601)
        assert resp.risk_level == "HIGH"

    def test_probability_one_returns_high_risk(self):
        resp = PredictionResponse.from_probability(1.0)
        assert resp.prediction == 1
        assert resp.risk_level == "HIGH"

    def test_probability_rounded_to_four_decimals(self):
        resp = PredictionResponse.from_probability(0.123456789)
        assert resp.probability == 0.1235

    def test_prediction_is_zero_below_fifty(self):
        resp = PredictionResponse.from_probability(0.49)
        assert resp.prediction == 0
        resp2 = PredictionResponse.from_probability(0.5)
        assert resp2.prediction == 1

    def test_prediction_is_one_at_and_above_fifty(self):
        resp = PredictionResponse.from_probability(0.5)
        assert resp.prediction == 1
        resp2 = PredictionResponse.from_probability(0.99)
        assert resp2.prediction == 1


class TestPatientInputBoundaryConditions:
    def test_zero_hba1c_rejected(self):
        payload = {
            "gender": "Male",
            "age": 45,
            "smokingHistory": "never",
            "bmi": 25.0,
            "hba1cLevel": 0,
            "bloodGlucoseLevel": 100,
        }
        with pytest.raises(ValidationError) as excinfo:
            PatientInput(**payload)
        # Pydantic ge constraint rejects zero before the custom validator runs
        assert "greater than or equal to 3" in str(excinfo.value)

    def test_zero_blood_glucose_rejected(self):
        payload = {
            "gender": "Female",
            "age": 45,
            "smokingHistory": "never",
            "bmi": 25.0,
            "hba1cLevel": 5.2,
            "bloodGlucoseLevel": 0,
        }
        with pytest.raises(ValidationError) as excinfo:
            PatientInput(**payload)
        # Pydantic ge constraint rejects zero before the custom validator runs
        assert "greater than or equal to 50" in str(excinfo.value)

    def test_age_at_lower_boundary_valid(self):
        payload = {
            "gender": "Male",
            "age": 1,
            "smokingHistory": "never",
            "bmi": 20.0,
            "hba1cLevel": 5.0,
            "bloodGlucoseLevel": 100,
        }
        patient = PatientInput(**payload)
        assert patient.age == 1

    def test_age_zero_invalid(self):
        payload = {
            "gender": "Male",
            "age": 0,
            "smokingHistory": "never",
            "bmi": 20.0,
            "hba1cLevel": 5.0,
            "bloodGlucoseLevel": 100,
        }
        with pytest.raises(ValidationError):
            PatientInput(**payload)

    def test_age_at_upper_boundary_valid(self):
        payload = {
            "gender": "Male",
            "age": 120,
            "smokingHistory": "never",
            "bmi": 20.0,
            "hba1cLevel": 5.0,
            "bloodGlucoseLevel": 100,
        }
        patient = PatientInput(**payload)
        assert patient.age == 120

    def test_age_above_120_invalid(self):
        payload = {
            "gender": "Male",
            "age": 121,
            "smokingHistory": "never",
            "bmi": 20.0,
            "hba1cLevel": 5.0,
            "bloodGlucoseLevel": 100,
        }
        with pytest.raises(ValidationError):
            PatientInput(**payload)

    def test_bmi_at_lower_boundary_valid(self):
        payload = {
            "gender": "Male",
            "age": 30,
            "smokingHistory": "never",
            "bmi": 10.0,
            "hba1cLevel": 5.0,
            "bloodGlucoseLevel": 100,
        }
        patient = PatientInput(**payload)
        assert patient.bmi == 10.0

    def test_bmi_below_10_invalid(self):
        payload = {
            "gender": "Male",
            "age": 30,
            "smokingHistory": "never",
            "bmi": 9.9,
            "hba1cLevel": 5.0,
            "bloodGlucoseLevel": 100,
        }
        with pytest.raises(ValidationError):
            PatientInput(**payload)

    def test_bmi_at_upper_boundary_valid(self):
        payload = {
            "gender": "Female",
            "age": 30,
            "smokingHistory": "never",
            "bmi": 60.0,
            "hba1cLevel": 5.0,
            "bloodGlucoseLevel": 100,
        }
        patient = PatientInput(**payload)
        assert patient.bmi == 60.0

    def test_bmi_above_60_invalid(self):
        payload = {
            "gender": "Female",
            "age": 30,
            "smokingHistory": "never",
            "bmi": 60.1,
            "hba1cLevel": 5.0,
            "bloodGlucoseLevel": 100,
        }
        with pytest.raises(ValidationError):
            PatientInput(**payload)

    def test_hba1c_at_lower_boundary_valid(self):
        payload = {
            "gender": "Male",
            "age": 30,
            "smokingHistory": "never",
            "bmi": 25.0,
            "hba1cLevel": 3.0,
            "bloodGlucoseLevel": 100,
        }
        patient = PatientInput(**payload)
        assert patient.hba1cLevel == 3.0

    def test_hba1c_below_3_invalid(self):
        payload = {
            "gender": "Male",
            "age": 30,
            "smokingHistory": "never",
            "bmi": 25.0,
            "hba1cLevel": 2.9,
            "bloodGlucoseLevel": 100,
        }
        with pytest.raises(ValidationError):
            PatientInput(**payload)

    def test_hba1c_at_upper_boundary_valid(self):
        payload = {
            "gender": "Male",
            "age": 30,
            "smokingHistory": "never",
            "bmi": 25.0,
            "hba1cLevel": 15.0,
            "bloodGlucoseLevel": 100,
        }
        patient = PatientInput(**payload)
        assert patient.hba1cLevel == 15.0

    def test_hba1c_above_15_invalid(self):
        payload = {
            "gender": "Male",
            "age": 30,
            "smokingHistory": "never",
            "bmi": 25.0,
            "hba1cLevel": 15.1,
            "bloodGlucoseLevel": 100,
        }
        with pytest.raises(ValidationError):
            PatientInput(**payload)

    def test_created_by_none_is_valid(self):
        payload = {
            "gender": "Male",
            "age": 30,
            "smokingHistory": "never",
            "bmi": 25.0,
            "hba1cLevel": 5.0,
            "bloodGlucoseLevel": 100,
            "createdBy": None,
        }
        patient = PatientInput(**payload)
        assert patient.createdBy is None

    def test_patient_name_can_be_omitted(self):
        payload = {
            "gender": "Male",
            "age": 30,
            "smokingHistory": "never",
            "bmi": 25.0,
            "hba1cLevel": 5.0,
            "bloodGlucoseLevel": 100,
        }
        patient = PatientInput(**payload)
        assert patient.patientName is None
