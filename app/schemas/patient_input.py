"""
Pydantic schemas for patient input validation.
Validates all clinical parameters before ML model inference.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional


class PatientInput(BaseModel):
    """Validated patient input for diabetes/disease risk prediction."""

    age: float = Field(..., ge=0, le=130, description="Patient age in years")
    glucose: float = Field(..., ge=0, le=1000, description="Plasma glucose concentration (mg/dL)")
    blood_pressure: float = Field(..., ge=0, le=300, description="Diastolic blood pressure (mmHg)")
    skin_thickness: float = Field(..., ge=0, le=100, description="Triceps skin fold thickness (mm)")
    insulin: float = Field(..., ge=0, le=1000, description="2-Hour serum insulin (mu U/ml)")
    bmi: float = Field(..., ge=0, le=100, description="Body mass index (weight/height^2)")
    diabetes_pedigree: float = Field(..., ge=0, le=10, description="Diabetes pedigree function")
    pregnancies: Optional[int] = Field(default=0, ge=0, le=20, description="Number of pregnancies")

    @field_validator("glucose", "blood_pressure", "skin_thickness", "insulin", "bmi")
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
                "age": 45,
                "glucose": 120,
                "blood_pressure": 80,
                "skin_thickness": 20,
                "insulin": 85,
                "bmi": 28.5,
                "diabetes_pedigree": 0.5,
                "pregnancies": 2,
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
