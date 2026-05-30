import sys
import json
import os
import hashlib
import tempfile
import time
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
import joblib

DATA_FILE = "diabetes_dataset.csv"
MODEL_FILE = "diabetes_model.joblib"
LOCK_FILE = MODEL_FILE + ".lock"
LOCK_TIMEOUT = 60
LOCK_POLL_INTERVAL = 0.1

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

def generate_correlation_heatmap(df, output_path="correlation_heatmap.png"):
    """
    Generate and save a correlation heatmap for numeric dataset columns.
    """
    import matplotlib.pyplot as plt
    import seaborn as sns

    numeric_df = df.select_dtypes(include=["number"])

    if numeric_df.empty:
        raise ValueError("No numeric columns found for correlation heatmap.")

    correlation_matrix = numeric_df.corr()

    plt.figure(figsize=(10, 8))

    sns.heatmap(
        correlation_matrix,
        annot=True,
        cmap="coolwarm",
        fmt=".2f",
        linewidths=0.5
    )

    plt.title("Correlation Heatmap - Diabetes Dataset")
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()

    print(f"Correlation heatmap saved as {output_path}")


def train_model_pipeline():
    """Loads data, preprocesses it, and trains a logistic regression model from scratch."""
    if not os.path.exists(DATA_FILE):
        return None, None, None
    
    df = pd.read_csv(DATA_FILE)
    
    # Check for missing values and unrealistic zeros
    clinical_cols = ['bmi', 'HbA1c_level', 'blood_glucose_level']
    for col in clinical_cols:
        thresholds = {'bmi': 10, 'HbA1c_level': 3, 'blood_glucose_level': 50}
        invalid_mask = (df[col] < thresholds[col]) | (df[col].isna())
        if invalid_mask.any():
            df.loc[invalid_mask, col] = df[col].median()

    # Data Cleaning & Preprocessing
    df = df[df['gender'] != 'Other'] 
    df['gender_Male'] = (df['gender'] == 'Male').astype(int)
    
    smoking_dummies = pd.get_dummies(df['smoking_history'], prefix='smoke', drop_first=True)
    df = pd.concat([df, smoking_dummies], axis=1)
    
    features = ['age', 'hypertension', 'heart_disease', 'bmi', 'HbA1c_level', 'blood_glucose_level', 'gender_Male'] + list(smoking_dummies.columns)
    
    X = df[features]
    y = df['diabetes']
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    model = LogisticRegression(class_weight='balanced')
    model.fit(X_scaled, y)
    
    return model, scaler, features


def _compute_dataset_hash(filepath: str) -> str | None:
    """Compute SHA-256 hash of the dataset file contents."""
    if not os.path.exists(filepath):
        return None
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            hasher.update(chunk)
    return hasher.hexdigest()


def _acquire_lock(timeout=LOCK_TIMEOUT):
    """Acquire an exclusive lock on the model file using a sidecar lock file.

    Blocks up to `timeout` seconds, polling every 100ms.
    Returns True if the lock was acquired, False if the timeout was reached.
    """
    end_time = time.time() + timeout
    while time.time() < end_time:
        try:
            fd = os.open(LOCK_FILE, os.O_CREAT | os.O_EXCL | os.O_RDWR)
            with os.fdopen(fd, 'w') as f:
                f.write(str(os.getpid()))
            return True
        except FileExistsError:
            _clean_stale_lock()
            time.sleep(LOCK_POLL_INTERVAL)
    return False


def _release_lock():
    """Release the exclusive lock."""
    try:
        if os.path.exists(LOCK_FILE):
            os.remove(LOCK_FILE)
    except OSError:
        pass


def _clean_stale_lock():
    """Remove the lock file if it is older than 5 minutes (stale from a crash)."""
    try:
        mtime = os.path.getmtime(LOCK_FILE)
        if time.time() - mtime > 300:
            os.remove(LOCK_FILE)
    except OSError:
        pass


def _atomic_write(filepath, data):
    """Write data atomically to filepath using a temporary file and rename.

    Uses tempfile.mkstemp in the same directory as the target file to
    ensure an atomic os.replace() on the same filesystem. This prevents
    concurrent readers from seeing a partially written file.
    """
    dirpath = os.path.dirname(filepath) or '.'
    fd, tmp_path = tempfile.mkstemp(dir=dirpath, suffix='.tmp')
    try:
        os.close(fd)
        joblib.dump(data, tmp_path)
        os.replace(tmp_path, filepath)
    except BaseException:
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except OSError:
            pass
        raise


def save_pretrained_model():
    """Train the model pipeline and atomically serialize the artifacts to disk.

    Acquires a file lock and uses an atomic write (tempfile + os.replace)
    to prevent cache corruption from concurrent access.
    """
    if not _acquire_lock():
        print("Could not acquire lock for saving model.", file=sys.stderr)
        return False
    try:
        model, scaler, features = train_model_pipeline()
        if model is None:
            print("Failed to train model. Ensure diabetes_dataset.csv is present.")
            return False
        dataset_hash = _compute_dataset_hash(DATA_FILE)
        _atomic_write(MODEL_FILE, (model, scaler, features, dataset_hash))
        print(f"Model successfully serialized to {MODEL_FILE}")
        return True
    finally:
        _release_lock()


def get_model():
    """Load pre-trained model, scaler, and features from disk with dataset change detection.

    Computes a SHA-256 hash of the current dataset and compares it against the
    hash stored at training time. If the dataset has changed (or no valid cache
    exists), the model is retrained automatically.

    Uses file locking and atomic writes to prevent cache corruption when
    multiple processes concurrently access the model file.
    """
    current_hash = _compute_dataset_hash(DATA_FILE)

    # Try to load the cached model without locking first (fast path)
    if os.path.exists(MODEL_FILE):
        try:
            model_data = joblib.load(MODEL_FILE)
            if isinstance(model_data, tuple) and len(model_data) >= 3:
                model, scaler, features = model_data[:3]
                cached_hash = model_data[3] if len(model_data) >= 4 else None
                if current_hash is not None and current_hash == cached_hash:
                    return model, scaler, features
                print("Dataset has changed. Retraining model...", file=sys.stderr)
        except Exception as e:
            print(f"Failed to load pre-trained model: {e}", file=sys.stderr)

    # Acquire lock before retraining and writing
    if not _acquire_lock():
        print("Could not acquire lock for model retraining.", file=sys.stderr)
        return None, None, None

    try:
        # Double-check after acquiring lock: another process may have
        # already retrained and written a fresh model while we waited
        if os.path.exists(MODEL_FILE):
            try:
                model_data = joblib.load(MODEL_FILE)
                if isinstance(model_data, tuple) and len(model_data) >= 3:
                    cached_hash = model_data[3] if len(model_data) >= 4 else None
                    if current_hash is not None and current_hash == cached_hash:
                        return model_data[0], model_data[1], model_data[2]
            except Exception:
                pass

        # No valid cache — train from scratch and atomically write
        model, scaler, features = train_model_pipeline()
        if model is not None:
            _atomic_write(MODEL_FILE, (model, scaler, features, current_hash))
            print(f"Model trained and saved to {MODEL_FILE}")
        return model, scaler, features
    finally:
        _release_lock()

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
    risk_score = round(prob * 100, 1)
    
    # Calculate feature contributions for this individual (coefficient * scaled value)
    contributions = model.coef_[0] * X_input[0]
    
    # Calculate confidence interval using the standard error of the predicted probability.
    # For a Bernoulli proportion p, SE = sqrt(p * (1 - p)).
    # Multiplying by 1.96 gives an approximate 95% CI.
    # This produces a wider interval for borderline predictions (p near 0.5)
    # and a narrower interval for high-confidence predictions (p near 0 or 1).
    se = (prob * (1 - prob)) ** 0.5
    margin = round(1.96 * se * 100, 1)
    lower_ci = round(max(0, risk_score - margin), 1)
    upper_ci = round(min(100, risk_score + margin), 1)
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
        "modelConfidence": round(float(max(prob, 1 - prob)), 4)
    }

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "predict_file":
        with open(sys.argv[2], 'r') as f:
            data = json.load(f)
        model, scaler, features = get_model()
        result = interpret_prediction(model, scaler, features, data)
        print(json.dumps(result))
    elif len(sys.argv) > 1 and sys.argv[1] == "train":
        if not os.path.exists(DATA_FILE):
            print("Dataset not found. Creating synthetic dataset...")
            create_synthetic_data()
        success = save_pretrained_model()
        if success:
            model, scaler, features = get_model()
            print(f"Features used: {features}")
            print(f"Model Coefficients (Weights): {model.coef_[0]}")
    else:
        # Step 1-6: Execution when run directly
        print("Running complete exploratory and modeling pipeline...\n")
        if not os.path.exists(DATA_FILE):
            print("Dataset not found. Creating synthetic dataset...")
            create_synthetic_data()
        model, scaler, features = get_model()
        if model is None:
            print("Failed to load dataset.")
        else:
            df = pd.read_csv(DATA_FILE)
            generate_correlation_heatmap(df)
            
            print("Model trained successfully.")
            print(f"Features used: {features}")
            print(f"Model Coefficients (Weights): {model.coef_[0]}")
            print("Use 'python analyze.py predict_file <json_file>' to run a prediction.")
