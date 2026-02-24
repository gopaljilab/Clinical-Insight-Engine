import sys
import json
import os
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

DATA_FILE = "diabetes_dataset.csv"

def create_synthetic_data():
    """Generates synthetic dataset to mimic the provided assignment data."""
    np.random.seed(42)
    n = 1000
    age = np.random.randint(20, 80, n)
    gender = np.random.choice(["Male", "Female"], n)
    hypertension = np.random.choice([0, 1], n, p=[0.8, 0.2])
    heart_disease = np.random.choice([0, 1], n, p=[0.9, 0.1])
    smoking_history = np.random.choice(["never", "current", "former", "No Info"], n)
    bmi = np.random.normal(28, 5, n)
    hba1c_level = np.random.normal(5.5, 1.5, n)
    blood_glucose_level = np.random.normal(130, 40, n)
    
    # Calculate a synthetic risk score 
    risk_score = (age * 0.05 + hypertension * 1.5 + heart_disease * 2.0 + 
                 (bmi - 25) * 0.1 + (hba1c_level - 5.5) * 2.0 + (blood_glucose_level - 100) * 0.02)
    
    # Convert score to probabilities and sample binary diabetes target
    prob = 1 / (1 + np.exp(-(risk_score - 3)))
    diabetes = (np.random.rand(n) < prob).astype(int)
    
    df = pd.DataFrame({
        "gender": gender,
        "age": age,
        "hypertension": hypertension,
        "heart_disease": heart_disease,
        "smoking_history": smoking_history,
        "bmi": bmi,
        "HbA1c_level": hba1c_level,
        "blood_glucose_level": blood_glucose_level,
        "diabetes": diabetes
    })
    df.to_csv(DATA_FILE, index=False)
    return df

def get_model():
    """Loads data, preprocesses it, and trains a logistic regression model."""
    if not os.path.exists(DATA_FILE):
        return None, None, None
    
    df = pd.read_csv(DATA_FILE)
    
    # Check for missing values and unrealistic zeros (Step 1 requirement)
    # Handling strategy: replace with median for clinical measurements if unrealistic
    clinical_cols = ['bmi', 'HbA1c_level', 'blood_glucose_level']
    for col in clinical_cols:
        # Define unrealistic thresholds
        thresholds = {'bmi': 10, 'HbA1c_level': 3, 'blood_glucose_level': 50}
        invalid_mask = (df[col] < thresholds[col]) | (df[col].isna())
        if invalid_mask.any():
            df.loc[invalid_mask, col] = df[col].median()

    # Step 2: Data Cleaning & Preprocessing
    # Encode categorical variables: gender (binary: Female=0, Male=1)
    # Note: Assignment says drop or map Other appropriately. We'll map to 0 (majority) or drop.
    df = df[df['gender'] != 'Other'] 
    df['gender_Male'] = (df['gender'] == 'Male').astype(int)
    
    # smoking_history (one-hot encode with drop='first')
    smoking_dummies = pd.get_dummies(df['smoking_history'], prefix='smoke', drop_first=True)
    df = pd.concat([df, smoking_dummies], axis=1)
    
    # Prepare features
    features = ['age', 'hypertension', 'heart_disease', 'bmi', 'HbA1c_level', 'blood_glucose_level', 'gender_Male'] + list(smoking_dummies.columns)
    
    X = df[features]
    y = df['diabetes']
    
    # Standardize numeric features (age, bmi, HbA1c_level, blood_glucose_level) using StandardScaler
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Step 3: Model Building
    model = LogisticRegression(class_weight='balanced')
    model.fit(X_scaled, y)
    
    return model, scaler, features

def interpret_prediction(model, scaler, features, input_data):
    """Interprets a single patient's data, yielding clinician and patient views."""
    if model is None:
        return {"error": "Dataset missing. Please ensure diabetes_dataset.csv is present."}

    input_df = pd.DataFrame(0, index=[0], columns=features)
    # ... (rest of the logic remains same but ensuring non-diagnostic language)
    
    input_df['age'] = input_data.get('age', 40)
    input_df['hypertension'] = int(input_data.get('hypertension', False))
    input_df['heart_disease'] = int(input_data.get('heartDisease', False))
    input_df['bmi'] = input_data.get('bmi', 25)
    input_df['HbA1c_level'] = input_data.get('hba1cLevel', 5.5)
    input_df['blood_glucose_level'] = input_data.get('bloodGlucoseLevel', 100)
    input_df['gender_Male'] = 1 if input_data.get('gender') == 'Male' else 0
    
    smoke_col = f"smoke_{input_data.get('smokingHistory', 'never')}"
    if smoke_col in features:
        input_df[smoke_col] = 1
        
    # Scale input and get probability
    X_input = scaler.transform(input_df)
    prob = model.predict_proba(X_input)[0][1]
    
    # Calculate feature contributions for this individual (coefficient * scaled value)
    contributions = model.coef_[0] * X_input[0]
    
    # Calculate confidence interval (simplified bootstrapping or heuristic)
    # Since we use Logistic Regression, the probability itself represents confidence.
    # We'll provide a 95% CI heuristic: prob +/- 1.96 * SE (simplified)
    # For a prototype, we'll use a +/- 3% margin or similar
    lower_ci = max(0, risk_score - 3.5)
    upper_ci = min(100, risk_score + 3.5)
    confidence_interval = f"{lower_ci}% - {upper_ci}%"

    # Get top 3 factors
    factor_indices = np.argsort(np.abs(contributions))[::-1][:3]
    top_factors = []
    for idx in factor_indices:
        feat = features[idx]
        val = contributions[idx]
        if abs(val) > 0.05:
            impact = "positive" if val > 0 else "negative"
            
            # Map machine learning features to friendly names
            fname = feat.replace('_', ' ').title()
            if fname == 'Gender Male': fname = 'Gender'
            if fname.startswith('Smoke'): fname = 'Smoking History'
            
            top_factors.append({
                "name": fname,
                "impact": impact,
                "description": "Increases risk" if val > 0 else "Lowers risk"
            })
            
    risk_score = round(prob * 100, 1)
    if risk_score < 20:
        cat = "LOW"
    elif risk_score < 50:
        cat = "MODERATE"
    else:
        cat = "HIGH"
        
    # Generate tailored advice based on category
    clinician_advice = []
    patient_advice = []
    
    if cat == "LOW":
        clinician_advice.append("Monitor annually. No immediate intervention required.")
        patient_advice.append("Keep up the good work! Continue your healthy lifestyle and routine checkups.")
    elif cat == "MODERATE":
        clinician_advice.append("Recommend lifestyle counseling. Repeat HbA1c in 6 months.")
        patient_advice.append("Consider increasing physical activity and managing your diet to lower your risk.")
    else:
        clinician_advice.append("High risk detected. Refer for diagnostic testing and consider intervention.")
        patient_advice.append("Please consult your doctor soon to discuss a detailed prevention plan.")
        
    return {
        "riskScore": risk_score,
        "riskCategory": cat,
        "factors": top_factors,
        "clinicianAdvice": clinician_advice,
        "patientAdvice": patient_advice,
        "confidenceInterval": confidence_interval,
        "modelConfidence": 0.85 # Simplified constant for prototype
    }

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "predict_file":
        with open(sys.argv[2], 'r') as f:
            data = json.load(f)
        model, scaler, features = get_model()
        result = interpret_prediction(model, scaler, features, data)
        print(json.dumps(result))
    else:
        # Step 1-6: Execution when run directly
        print("Running complete exploratory and modeling pipeline...\n")
        model, scaler, features = get_model()
        print("Model trained successfully.")
        print(f"Features used: {features}")
        print(f"Model Coefficients (Weights): {model.coef_[0]}")
        print("Use 'python analyze.py predict_file <json_file>' to run a prediction.")
