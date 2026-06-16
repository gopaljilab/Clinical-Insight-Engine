import pytest
from pydantic import ValidationError
from app.schemas.patient_input import PatientInput


def test_valid_patient_input():
    # Valid payload
    payload = {
        "patientName": "Jane Doe",
        "gender": "Female",
        "age": 42,
        "hypertension": True,
        "heartDisease": False,
        "smokingHistory": "never",
        "bmi": 24.5,
        "hba1cLevel": 5.2,
        "bloodGlucoseLevel": 95.0,
        "createdBy": "doctor@hospital.org"
    }
    patient = PatientInput(**payload)
    assert patient.patientName == "Jane Doe"
    assert patient.gender == "Female"
    assert patient.age == 42
    assert patient.hypertension is True
    assert patient.heartDisease is False
    assert patient.smokingHistory == "never"
    assert patient.bmi == 24.5
    assert patient.hba1cLevel == 5.2
    assert patient.bloodGlucoseLevel == 95.0
    assert patient.createdBy == "doctor@hospital.org"


def test_invalid_gender():
    payload = {
        "gender": "Non-binary",
        "age": 42,
        "smokingHistory": "never",
        "bmi": 24.5,
        "hba1cLevel": 5.2,
        "bloodGlucoseLevel": 95.0,
    }
    with pytest.raises(ValidationError) as excinfo:
        PatientInput(**payload)
    assert "Gender must be 'Male' or 'Female'" in str(excinfo.value)


def test_invalid_smoking_history():
    payload = {
        "gender": "Male",
        "age": 42,
        "smokingHistory": "chain-smoker",
        "bmi": 24.5,
        "hba1cLevel": 5.2,
        "bloodGlucoseLevel": 95.0,
    }
    with pytest.raises(ValidationError) as excinfo:
        PatientInput(**payload)
    assert "Invalid smoking history value" in str(excinfo.value)


def test_invalid_created_by():
    payload = {
        "gender": "Male",
        "age": 42,
        "smokingHistory": "never",
        "bmi": 24.5,
        "hba1cLevel": 5.2,
        "bloodGlucoseLevel": 95.0,
        "createdBy": "not-an-email"
    }
    with pytest.raises(ValidationError) as excinfo:
        PatientInput(**payload)
    assert "createdBy must be a valid email" in str(excinfo.value)


def test_reject_out_of_range_clinical_values():
    payload = {
        "gender": "Male",
        "age": 42,
        "smokingHistory": "never",
        "bmi": 5.0,  # below ge=10
        "hba1cLevel": 5.2,
        "bloodGlucoseLevel": 95.0,
    }
    with pytest.raises(ValidationError) as excinfo:
        PatientInput(**payload)
    assert "Input should be greater than or equal to 10" in str(excinfo.value)
