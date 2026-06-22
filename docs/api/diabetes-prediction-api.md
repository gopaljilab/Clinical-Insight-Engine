# Diabetes Prediction API

## Overview
The core machine learning inference route for calculating patient risk.

## `POST /api/assessments`

Accepts clinical biomarkers and returns a calculated risk score, categories, and explainability factors.

### Request Body
```json
{
  "patientName": "John Doe",
  "age": 45,
  "gender": "Male",
  "bmi": 28.5,
  "hypertension": true,
  "heartDisease": false,
  "smokingHistory": "former",
  "hba1cLevel": 6.8,
  "bloodGlucoseLevel": 110
}
```

### Response
```json
{
  "id": 1,
  "patientName": "John Doe",
  "riskScore": "42.5",
  "riskCategory": "MODERATE",
  "factors": [
    {
      "name": "HbA1c Level",
      "impact": "positive",
      "description": "Elevated HbA1c suggests prolonged metabolic stress."
    }
  ],
  "recommendations": [
    {
      "action": "Dietary modification",
      "message": "Focus on lowering carbohydrate intake to manage HbA1c."
    }
  ]
}
```

### Authentication
Requires a valid session cookie or Bearer token depending on the environment. Unauthorized requests will return `401`.
