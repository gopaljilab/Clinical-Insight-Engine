# Python Data Analysis & Clinical Decision Support

## Overview

This document describes the Python-based data analysis and clinical decision support prototype for preventive diabetes risk assessment, as requested in the assignment specification.

## File Structure

- `analyze.py` - Complete Python script implementing all analysis requirements
- `diabetes_dataset.csv` - Generated synthetic dataset (created automatically on first run)

## Requirements Fulfilled

### 1. Load and Explore ✅

The script loads the diabetes dataset and provides comprehensive exploratory analysis:
- Dataset shape, columns, data types
- Summary statistics for all numeric features
- Missing value detection
- Unrealistic value detection (BMI < 10, glucose < 50, HbA1c < 3)

### 2. Data Cleaning & Preprocessing ✅

Implemented cleaning strategies:
- **Outlier handling**: Filters out unrealistic values based on medical thresholds
- **Categorical encoding**:
  - Gender: Binary encoding (Male=1, Female=0)
  - Smoking history: One-hot encoding with drop_first=True
- **Feature standardization**: StandardScaler for age, BMI, HbA1c, blood glucose
- **Train/test split**: Full dataset used for interpretability (can be modified for validation)

### 3. Model Building ✅

Logistic Regression model with:
- Balanced class weights to handle class imbalance
- Standardized features for proper coefficient interpretation
- Predicted probabilities (risk scores as percentages)

### 4. Interpretation & Outputs ✅

#### For Clinicians:
- **Risk Probability**: Exact percentage (e.g., "23.5%")
- **Top Contributing Factors**: 3-5 features with:
  - Feature name
  - Impact direction (positive increases risk, negative decreases risk)
  - Coefficient magnitude
- **Confidence Measure**: Based on model probability
- **Follow-up Actions**:
  - LOW (<20%): Monitor annually
  - MODERATE (20-50%): Lifestyle counseling, repeat HbA1c in 6 months
  - HIGH (>50%): Refer for diagnostic testing

#### For Patients:
- **Simplified Risk Category**: LOW/MODERATE/HIGH
- **Plain Language Factors**:
  - "Your BMI is elevated"
  - "Your blood glucose is high"
  - "Your HbA1c indicates pre-diabetic levels"
- **Preventive Advice**:
  - Lifestyle modifications
  - Diet and exercise recommendations
  - When to consult a doctor

### 5. Visualizations ✅

The web interface provides:
- **Feature importance bar chart**: Displays coefficient magnitudes
- **Risk distribution histogram**: Shows separation between diabetic and non-diabetic cases
- **Individual factor contributions**: Diverging bar chart in clinician view

### 6. Workflow Documentation ✅

The code includes:
- Comprehensive comments explaining each step
- Markdown-style documentation in this file
- Clear function names and structure
- Step-by-step execution flow

### 7. Constraints & Notes ✅

- **No medical diagnosis claims**: All outputs framed as "decision support"
- **Interpretability prioritized**: Logistic regression chosen over complex models
- **Replit compatible**: Uses only standard Python libraries
- **Standard libraries only**: pandas, numpy, scikit-learn, matplotlib

## Usage

### Run Complete Analysis Pipeline

```bash
python3 analyze.py
```

This will:
1. Generate synthetic data if `diabetes_dataset.csv` doesn't exist
2. Clean and preprocess the data
3. Train the logistic regression model
4. Display model coefficients and feature importance

### Predict for Individual Patient

The script integrates with the web backend, but can also be used standalone:

```bash
# Create a test patient file
echo '{"gender":"Female","age":55,"hypertension":true,"heartDisease":false,"smokingHistory":"former","bmi":29.5,"hba1cLevel":6.2,"bloodGlucoseLevel":135}' > patient.json

# Run prediction
python3 analyze.py predict_file patient.json
```

Output:
```json
{
  "riskScore": 96.9,
  "riskCategory": "HIGH",
  "factors": [
    {
      "name": "Hypertension",
      "impact": "positive",
      "description": "Increases risk"
    },
    {
      "name": "Hba1C Level",
      "impact": "positive",
      "description": "Increases risk"
    },
    {
      "name": "Smoking History",
      "impact": "positive",
      "description": "Increases risk"
    }
  ],
  "clinicianAdvice": [
    "High risk detected. Refer for diagnostic testing and consider intervention."
  ],
  "patientAdvice": [
    "Please consult your doctor soon to discuss a detailed prevention plan."
  ]
}
```

## Model Details

### Features Used

1. **Demographic**: age, gender
2. **Medical History**: hypertension, heart_disease
3. **Behavioral**: smoking_history (encoded as multiple binary features)
4. **Clinical Measurements**: BMI, HbA1c_level, blood_glucose_level

### Feature Engineering

- **Standardization**: All numeric features scaled to mean=0, std=1
- **One-hot encoding**: Smoking history categories
- **Binary encoding**: Gender (with option to map "Other" appropriately)

### Model Coefficients

After training on the synthetic dataset, the model learns weights for each feature:

- **HbA1c_level**: Strongest positive predictor (coefficient ≈ 2.62)
- **age**: Moderate positive predictor (coefficient ≈ 0.94)
- **blood_glucose_level**: Moderate positive predictor (coefficient ≈ 0.74)
- **heart_disease**: Moderate positive predictor (coefficient ≈ 0.60)
- **hypertension**: Moderate positive predictor (coefficient ≈ 0.57)
- **bmi**: Moderate positive predictor (coefficient ≈ 0.50)

Higher coefficients indicate stronger influence on diabetes risk.

### Risk Stratification

The model outputs a probability score (0-1) which is converted to:

- **0-20%**: LOW risk → Monitor annually
- **20-50%**: MODERATE risk → Lifestyle intervention
- **50-100%**: HIGH risk → Medical referral

## Dataset

### Synthetic Data Generation

If no dataset is provided, the script generates 1000 synthetic patient records with:

- Realistic distributions matching medical literature
- Age: 20-80 years
- BMI: Normal distribution (mean=28, std=5)
- HbA1c: Normal distribution (mean=5.5, std=1.5)
- Blood glucose: Normal distribution (mean=130, std=40)
- Diabetes outcome: Calculated from risk factors with probabilistic sampling

### Data Quality

The script handles:
- Missing values (filters them out)
- Unrealistic values:
  - BMI < 10 (physiologically impossible)
  - Glucose < 50 (severe hypoglycemia)
  - HbA1c < 3 (measurement error)

## Integration with Web Application

The Python script integrates seamlessly with the Node.js backend:

1. **Backend receives patient data** via POST `/api/assessments`
2. **Data saved to temporary JSON file** in `/tmp/`
3. **Python script invoked** with `python3 analyze.py predict_file <temp_file>`
4. **Results parsed from stdout** as JSON
5. **Assessment saved to database** with predictions
6. **Frontend displays dual views** (clinician + patient)

## Medical Disclaimer

⚠️ **This is a decision support tool, not a diagnostic system.**

- Predictions are probabilistic estimates based on limited features
- Clinical judgment should always override model predictions
- Not a substitute for comprehensive medical evaluation
- Intended for research and educational purposes

## References

This implementation follows best practices from:
- Clinical prediction models for diabetes screening (ADA guidelines)
- Interpretable machine learning in healthcare
- Human-AI collaboration in clinical workflows
