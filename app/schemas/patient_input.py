"""
Pydantic schemas for patient input validation.
Validates all clinical parameters before ML model inference.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional


class PatientInput(BaseModel):
    """Validated patient input for diabetes/disease risk prediction."""

    patientName: Optional[str] = Field(default=None, min_length=1, description="Patient name")
    gender: str = Field(..., description="Gender (Male or Female)")
    age: int = Field(..., ge=1, le=120, description="Patient age in years")
    hypertension: bool = Field(default=False, description="Whether the patient has hypertension")
    heartDisease: bool = Field(default=False, description="Whether the patient has heart disease")
    smokingHistory: str = Field(..., description="Smoking history")
    bmi: float = Field(..., ge=10, le=60, description="Body mass index")
    hba1cLevel: float = Field(..., ge=3, le=15, description="HbA1c level")
    bloodGlucoseLevel: float = Field(..., ge=50, le=400, description="Blood glucose level")
    createdBy: Optional[str] = Field(default=None, description="Creator email")

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v):
        if v not in ["Male", "Female"]:
            raise ValueError("Gender must be 'Male' or 'Female'")
        return v

    @field_validator("smokingHistory")
    @classmethod
    def validate_smoking_history(cls, v):
        if v not in ["never", "No Info", "current", "former"]:
            raise ValueError("Invalid smoking history value")
        return v

    @field_validator("createdBy")
    @classmethod
    def validate_created_by(cls, v):
        if v is not None and "@" not in v:
            raise ValueError("createdBy must be a valid email")
        return v

    @field_validator("bmi", "hba1cLevel", "bloodGlucoseLevel")
    @classmethod
    def reject_zero_clinical_values(cls, v, info):
        """Zero values are clinically invalid for most measurements."""
        if v == 0:
            raise ValueError(
                f"{info.field_name} cannot be 0 — please enter a valid clinical measurement"
            )
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "patientName": "John Doe",
                "gender": "Male",
                "age": 45,
                "hypertension": False,
                "heartDisease": False,
                "smokingHistory": "never",
                "bmi": 28.5,
                "hba1cLevel": 5.5,
                "bloodGlucoseLevel": 120.0,
                "createdBy": "provider@example.com",
            }
        }
    }


class PredictionResponse(BaseModel):
    """Standard prediction API response."""
    prediction: int = Field(..., description="0 = No diabetes, 1 = Diabetes")
    probability: float = Field(..., ge=0, le=1, description="Confidence score")
    risk_level: str = Field(..., description="LOW / MEDIUM / HIGH")
    message: str

    @staticmethod
    def from_probability(prob: float) -> "PredictionResponse":
        prediction = 1 if prob >= 0.5 else 0
        if prob < 0.3:
            risk = "LOW"
            msg = "Low risk of diabetes detected."
        elif prob < 0.6:
            risk = "MEDIUM"
            msg = "Moderate risk detected. Recommend further evaluation."
        else:
            risk = "HIGH"
            msg = "High risk detected. Immediate clinical review recommended."
        return PredictionResponse(
            prediction=prediction, probability=round(prob, 4),
            risk_level=risk, message=msg
        )
