"""
Unit tests for app/schemas/patient_input.py Pydantic schemas.

Covers:
- PatientInput: valid construction, optional fields, field validators,
  range constraints, zero-value rejection
- PredictionResponse: from_probability static factory method
"""

import pytest
from pydantic import ValidationError

from app.schemas.patient_input import PatientInput, PredictionResponse


class TestPatientInput:
    def test_valid_construction_all_fields(self):
        inp = PatientInput(
            gender="Male",
            age=45,
            hypertension=False,
            heartDisease=False,
            smokingHistory="never",
            bmi=28.5,
            hba1cLevel=5.5,
            bloodGlucoseLevel=110.0,
            patientName="John Doe",
            createdBy="provider@example.com",
        )
        assert inp.gender == "Male"
        assert inp.age == 45

    def test_optional_fields_can_be_omitted(self):
        inp = PatientInput(
            gender="Female",
            age=30,
            smokingHistory="never",
            bmi=22.0,
            hba1cLevel=5.0,
            bloodGlucoseLevel=100.0,
        )
        assert inp.patientName is None
        assert inp.createdBy is None

    def test_gender_validator_accepts_male(self):
        inp = PatientInput(
            gender="Male",
            age=45,
            smokingHistory="never",
            bmi=28.0,
            hba1cLevel=5.5,
            bloodGlucoseLevel=110.0,
        )
        assert inp.gender == "Male"

    def test_gender_validator_accepts_female(self):
        inp = PatientInput(
            gender="Female",
            age=45,
            smokingHistory="never",
            bmi=28.0,
            hba1cLevel=5.5,
            bloodGlucoseLevel=110.0,
        )
        assert inp.gender == "Female"

    def test_gender_validator_rejects_other(self):
        with pytest.raises(ValidationError) as exc_info:
            PatientInput(
                gender="Unknown",
                age=45,
                smokingHistory="never",
                bmi=28.0,
                hba1cLevel=5.5,
                bloodGlucoseLevel=110.0,
            )
        assert "gender" in str(exc_info.value).lower()

    def test_smoking_history_validator_accepts_valid_values(self):
        for val in ["never", "No Info", "current", "former"]:
            inp = PatientInput(
                gender="Male",
                age=45,
                smokingHistory=val,
                bmi=28.0,
                hba1cLevel=5.5,
                bloodGlucoseLevel=110.0,
            )
            assert inp.smokingHistory == val

    def test_smoking_history_validator_rejects_invalid(self):
        with pytest.raises(ValidationError) as exc_info:
            PatientInput(
                gender="Male",
                age=45,
                smokingHistory="sometimes",
                bmi=28.0,
                hba1cLevel=5.5,
                bloodGlucoseLevel=110.0,
            )
        assert "smoking" in str(exc_info.value).lower()

    def test_created_by_validator_accepts_valid_email(self):
        inp = PatientInput(
            gender="Male",
            age=45,
            smokingHistory="never",
            bmi=28.0,
            hba1cLevel=5.5,
            bloodGlucoseLevel=110.0,
            createdBy="doctor@hospital.org",
        )
        assert inp.createdBy == "doctor@hospital.org"

    def test_created_by_validator_rejects_non_email(self):
        with pytest.raises(ValidationError) as exc_info:
            PatientInput(
                gender="Male",
                age=45,
                smokingHistory="never",
                bmi=28.0,
                hba1cLevel=5.5,
                bloodGlucoseLevel=110.0,
                createdBy="not-an-email",
            )
        assert "createdby" in str(exc_info.value).lower()

    def test_age_range_constraint_enforced(self):
        with pytest.raises(ValidationError):
            PatientInput(
                gender="Male",
                age=0,
                smokingHistory="never",
                bmi=28.0,
                hba1cLevel=5.5,
                bloodGlucoseLevel=110.0,
            )
        with pytest.raises(ValidationError):
            PatientInput(
                gender="Male",
                age=121,
                smokingHistory="never",
                bmi=28.0,
                hba1cLevel=5.5,
                bloodGlucoseLevel=110.0,
            )

    def test_bmi_range_constraint_enforced(self):
        with pytest.raises(ValidationError):
            PatientInput(
                gender="Male",
                age=45,
                smokingHistory="never",
                bmi=9.9,
                hba1cLevel=5.5,
                bloodGlucoseLevel=110.0,
            )
        with pytest.raises(ValidationError):
            PatientInput(
                gender="Male",
                age=45,
                smokingHistory="never",
                bmi=61.0,
                hba1cLevel=5.5,
                bloodGlucoseLevel=110.0,
            )

    def test_hba1c_range_constraint_enforced(self):
        with pytest.raises(ValidationError):
            PatientInput(
                gender="Male",
                age=45,
                smokingHistory="never",
                bmi=28.0,
                hba1cLevel=2.9,
                bloodGlucoseLevel=110.0,
            )
        with pytest.raises(ValidationError):
            PatientInput(
                gender="Male",
                age=45,
                smokingHistory="never",
                bmi=28.0,
                hba1cLevel=15.1,
                bloodGlucoseLevel=110.0,
            )

    def test_blood_glucose_range_constraint_enforced(self):
        with pytest.raises(ValidationError):
            PatientInput(
                gender="Male",
                age=45,
                smokingHistory="never",
                bmi=28.0,
                hba1cLevel=5.5,
                bloodGlucoseLevel=49.0,
            )
        with pytest.raises(ValidationError):
            PatientInput(
                gender="Male",
                age=45,
                smokingHistory="never",
                bmi=28.0,
                hba1cLevel=5.5,
                bloodGlucoseLevel=401.0,
            )

    def test_zero_bmi_rejected(self):
        with pytest.raises(ValidationError, match="bmi"):
            PatientInput(
                gender="Male",
                age=45,
                smokingHistory="never",
                bmi=0,
                hba1cLevel=5.5,
                bloodGlucoseLevel=110.0,
            )

    def test_zero_hba1c_rejected(self):
        with pytest.raises(ValidationError, match="hba1c"):
            PatientInput(
                gender="Male",
                age=45,
                smokingHistory="never",
                bmi=28.0,
                hba1cLevel=0,
                bloodGlucoseLevel=110.0,
            )

    def test_zero_blood_glucose_rejected(self):
        with pytest.raises(ValidationError):
            PatientInput(
                gender="Male",
                age=45,
                smokingHistory="never",
                bmi=28.0,
                hba1cLevel=5.5,
                bloodGlucoseLevel=0,
            )


class TestPredictionResponse:
    def test_from_probability_low_risk(self):
        resp = PredictionResponse.from_probability(0.15)
        assert resp.prediction == 0
        assert resp.probability == 0.15
        assert resp.risk_level == "LOW"

    def test_from_probability_medium_risk(self):
        resp = PredictionResponse.from_probability(0.45)
        assert resp.prediction == 0
        assert resp.risk_level == "MEDIUM"

    def test_from_probability_high_risk(self):
        resp = PredictionResponse.from_probability(0.7)
        assert resp.prediction == 1
        assert resp.risk_level == "HIGH"

    def test_from_probability_threshold_at_05(self):
        resp = PredictionResponse.from_probability(0.5)
        assert resp.prediction == 1

    def test_from_probability_just_below_05(self):
        resp = PredictionResponse.from_probability(0.4999)
        assert resp.prediction == 0

    def test_from_probability_rounds_probability(self):
        resp = PredictionResponse.from_probability(0.123456789)
        assert resp.probability == 0.1235

    def test_from_probability_at_boundaries(self):
        resp_low = PredictionResponse.from_probability(0.2999)
        assert resp_low.risk_level == "LOW"

        resp_med = PredictionResponse.from_probability(0.3)
        assert resp_med.risk_level == "MEDIUM"

        resp_high = PredictionResponse.from_probability(0.5999)
        assert resp_high.risk_level == "MEDIUM"

        resp_very_high = PredictionResponse.from_probability(0.6)
        assert resp_very_high.risk_level == "HIGH"
