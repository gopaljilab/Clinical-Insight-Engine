import sys
import json
import os
import hashlib
import tempfile
import time
import numpy as np
import pandas as pd
from app.ml.prediction_cache import get_cache
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
import pickle

from services.safe_csv_reader import read_csv_safely, SafeCSVError

LOCK_TIMEOUT = 60
LOCK_POLL_INTERVAL = 0.1

# Resolve paths relative to this script's directory so the files are
# found regardless of the working directory (e.g., in Docker or when
# spawned by the Node.js server from a different CWD).
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(SCRIPT_DIR, "attached_assets", "diabetes_dataset.csv")
# Fall back to the legacy location if attached_assets doesn't have it
if not os.path.exists(DATA_FILE):
    DATA_FILE = os.path.join(SCRIPT_DIR, "diabetes_dataset.csv")
MODEL_FILE = os.path.join(SCRIPT_DIR, "diabetes_model.pkl")
LOCK_FILE = MODEL_FILE + ".lock"

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
        return None, None, None, None
    
    try:
        df = read_csv_safely(DATA_FILE)
    except SafeCSVError as e:
        print(f"Error loading dataset: {e}", file=sys.stderr)
        return None, None, None, None
    
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
    
    # Compute covariance matrix of coefficients (accounting for balanced class weights)
    X_design = np.hstack([np.ones((X_scaled.shape[0], 1)), X_scaled])
    p = model.predict_proba(X_scaled)[:, 1]
    
    classes = np.unique(y)
    class_weights = len(y) / (len(classes) * np.bincount(y))
    sample_weights = class_weights[y.values]
    
    D = sample_weights * p * (1 - p)
    I = np.dot(X_design.T * D, X_design)
    C = getattr(model, 'C', 1.0)
    I_reg = np.eye(X_design.shape[1])
    I_reg[0, 0] = 0.0  # Do not regularize intercept
    I += (1.0 / C) * I_reg
    cov_beta = np.linalg.inv(I)
    
    return model, scaler, features, cov_beta


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
        with open(tmp_path, 'wb') as f:
            pickle.dump(data, f)
        
        from app.ml.security import write_signature
        write_signature(tmp_path)
        
        os.replace(tmp_path, filepath)
        # Also move the signature file to match the filepath
        if os.path.exists(tmp_path + ".sig"):
            os.replace(tmp_path + ".sig", filepath + ".sig")
    except BaseException:
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            if os.path.exists(tmp_path + ".sig"):
                os.remove(tmp_path + ".sig")
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
        model, scaler, features, cov_beta = train_model_pipeline()
        if model is None:
            print("Failed to train model. Ensure diabetes_dataset.csv is present.", file=sys.stderr)
            return False
        dataset_hash = _compute_dataset_hash(DATA_FILE)
        try:
            mtime = os.path.getmtime(DATA_FILE)
            size = os.path.getsize(DATA_FILE)
        except OSError:
            mtime, size = None, None
        _atomic_write(MODEL_FILE, (model, scaler, features, dataset_hash, cov_beta, mtime, size))
        print(f"Model successfully serialized to {MODEL_FILE}", file=sys.stderr)
        return True
    finally:
        _release_lock()


def train_and_evaluate():
    """Train on a hold-out split, compute metrics, then retrain on full data.

    Outputs a JSON line with evaluation metrics and dataset statistics,
    then saves the full-data model to disk.

    Returns a dict of metrics and dataset stats (also printed to stdout).
    """
    if not os.path.exists(DATA_FILE):
        print(json.dumps({"error": "Dataset not found"}))
        return None

    try:
        df = read_csv_safely(DATA_FILE)
    except SafeCSVError as e:
        print(json.dumps({"error": f"Error loading dataset: {e}"}))
        return None

    clinical_cols = ['bmi', 'HbA1c_level', 'blood_glucose_level']
    for col in clinical_cols:
        thresholds = {'bmi': 10, 'HbA1c_level': 3, 'blood_glucose_level': 50}
        invalid_mask = (df[col] < thresholds[col]) | (df[col].isna())
        if invalid_mask.any():
            df.loc[invalid_mask, col] = df[col].median()

    df = df[df['gender'] != 'Other']
    df['gender_Male'] = (df['gender'] == 'Male').astype(int)

    smoking_dummies = pd.get_dummies(df['smoking_history'], prefix='smoke', drop_first=True)
    df = pd.concat([df, smoking_dummies], axis=1)

    features = ['age', 'hypertension', 'heart_disease', 'bmi', 'HbA1c_level', 'blood_glucose_level', 'gender_Male'] + list(smoking_dummies.columns)

    X = df[features].values
    y = df['diabetes'].values

    start_time = time.time()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = LogisticRegression(class_weight='balanced')
    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    y_proba = model.predict_proba(X_test_scaled)[:, 1]

    accuracy = float(accuracy_score(y_test, y_pred))
    precision = float(precision_score(y_test, y_pred, zero_division=0))
    recall = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))
    try:
        auc = float(roc_auc_score(y_test, y_proba))
    except Exception:
        auc = None

    class_balance = df['diabetes'].value_counts().to_dict()
    class_balance = {str(k): int(v) for k, v in class_balance.items()}

    feature_stats = {}
    for col in features:
        if col in df.columns:
            feature_stats[col] = {
                "mean": float(df[col].mean()),
                "std": float(df[col].std())
            }

    num_samples = int(len(df))
    num_features = int(len(features))

    dataset_hash = _compute_dataset_hash(DATA_FILE)
    try:
        mtime = os.path.getmtime(DATA_FILE)
        size = os.path.getsize(DATA_FILE)
    except OSError:
        mtime, size = None, None

    result = {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1_score": f1,
        "auc_roc": auc,
        "dataset_hash": dataset_hash,
        "num_samples": num_samples,
        "num_features": num_features,
        "class_balance": class_balance,
        "feature_distributions": feature_stats,
        "dataset_mtime": mtime,
        "dataset_size": size,
    }

    # Retrain on full data and save
    scaler_full = StandardScaler()
    X_scaled_full = scaler_full.fit_transform(X)
    model_full = LogisticRegression(class_weight='balanced')
    model_full.fit(X_scaled_full, y)

    X_design = np.hstack([np.ones((X_scaled_full.shape[0], 1)), X_scaled_full])
    p = model_full.predict_proba(X_scaled_full)[:, 1]
    classes = np.unique(y)
    class_weights_arr = len(y) / (len(classes) * np.bincount(y))
    sample_weights = class_weights_arr[y]
    D = sample_weights * p * (1 - p)
    I_mat = np.dot(X_design.T * D, X_design)
    C_val = getattr(model_full, 'C', 1.0)
    I_reg = np.eye(X_design.shape[1])
    I_reg[0, 0] = 0.0
    I_mat += (1.0 / C_val) * I_reg
    cov_beta = np.linalg.inv(I_mat)

    training_duration_ms = int((time.time() - start_time) * 1000)
    result["training_duration_ms"] = training_duration_ms

    _atomic_write(MODEL_FILE, (model_full, scaler_full, features, dataset_hash, cov_beta, mtime, size))
    print(f"Model saved to {MODEL_FILE}", file=sys.stderr)

    print(json.dumps(result))
    return result


def get_model():
    """Load pre-trained model, scaler, and features from disk with dataset change detection."""
    try:
        current_mtime = os.path.getmtime(DATA_FILE)
        current_size = os.path.getsize(DATA_FILE)
    except OSError:
        current_mtime, current_size = None, None

    current_hash = None

    def get_current_hash():
        nonlocal current_hash
        if current_hash is None:
            current_hash = _compute_dataset_hash(DATA_FILE)
        return current_hash

    from app.ml.security import verify_signature, safe_pickle_load

    if os.path.exists(MODEL_FILE):
        try:
            if not verify_signature(MODEL_FILE):
                raise PermissionError(
                    f"Signature verification failed for: {MODEL_FILE}. "
                    "Refusing to load untrusted model file to prevent Remote Code Execution."
                )
            with open(MODEL_FILE, 'rb') as f:
                model_data = safe_pickle_load(f)
            if isinstance(model_data, tuple) and len(model_data) >= 3:
                model, scaler, features = model_data[:3]
                cached_hash = model_data[3] if len(model_data) >= 4 else None
                cov_beta = model_data[4] if len(model_data) >= 5 else None
                cached_mtime = model_data[5] if len(model_data) >= 6 else None
                cached_size = model_data[6] if len(model_data) >= 7 else None

                if (current_mtime is not None and current_size is not None and
                    cached_mtime == current_mtime and cached_size == current_size and
                    cov_beta is not None):
                    return model, scaler, features, cov_beta

                h = get_current_hash()
                if h is not None and h == cached_hash and cov_beta is not None:
                    if _acquire_lock():
                        try:
                            _atomic_write(MODEL_FILE, (model, scaler, features, h, cov_beta, current_mtime, current_size))
                        finally:
                            _release_lock()
                    return model, scaler, features, cov_beta

                print("Dataset has changed. Retraining model...", file=sys.stderr)
        except Exception as e:
            print(f"Failed to load pre-trained model: {e}", file=sys.stderr)

    if not _acquire_lock():
        print("Could not acquire lock for model retraining.", file=sys.stderr)
        return None, None, None, None

    try:
        if os.path.exists(MODEL_FILE):
            try:
                if not verify_signature(MODEL_FILE):
                    raise PermissionError(
                        f"Signature verification failed for: {MODEL_FILE}. "
                        "Refusing to load untrusted model file to prevent Remote Code Execution."
                    )
                with open(MODEL_FILE, 'rb') as f:
                    model_data = safe_pickle_load(f)
                if isinstance(model_data, tuple) and len(model_data) >= 3:
                    cached_hash = model_data[3] if len(model_data) >= 4 else None
                    cov_beta = model_data[4] if len(model_data) >= 5 else None
                    cached_mtime = model_data[5] if len(model_data) >= 6 else None
                    cached_size = model_data[6] if len(model_data) >= 7 else None

                    if (current_mtime is not None and current_size is not None and
                        cached_mtime == current_mtime and cached_size == current_size and
                        cov_beta is not None):
                        return model_data[0], model_data[1], model_data[2], cov_beta

                    h = get_current_hash()
                    if h is not None and h == cached_hash and cov_beta is not None:
                        _atomic_write(MODEL_FILE, (model_data[0], model_data[1], model_data[2], h, cov_beta, current_mtime, current_size))
                        return model_data[0], model_data[1], model_data[2], cov_beta
            except Exception:
                pass

        model, scaler, features, cov_beta = train_model_pipeline()
        if model is not None:
            h = get_current_hash()
            _atomic_write(MODEL_FILE, (model, scaler, features, h, cov_beta, current_mtime, current_size))
            print(f"Model trained and saved to {MODEL_FILE}", file=sys.stderr)
        return model, scaler, features, cov_beta
    finally:
        _release_lock()

def interpret_predictions_batch(model, scaler, features, input_data_list, cov_beta=None):
    """Vectorized batch prediction for a list of patient records using NumPy."""
    if model is None:
        return {"error": "Dataset missing. Please ensure diabetes_dataset.csv is present."}

    n_samples = len(input_data_list)
    n_features = len(features)

    # Pre-allocate a 2D NumPy array of zeros
    X_input = np.zeros((n_samples, n_features))

    # Map feature names to their indices in the feature list for O(1) lookup
    feature_indices = {feat: idx for idx, feat in enumerate(features)}

    # We will build arrays for warnings and cache hits
    results = [None] * n_samples
    cache = get_cache()
    
    # We first extract index values and fill the numpy matrix in a single pass
    imputed_fields_list = [[] for _ in range(n_samples)]
    for i, input_data in enumerate(input_data_list):
        cached = cache.get(input_data)
        if cached is not None:
            results[i] = cached
            continue
            
        def _safe_get(data, key, default_val, field_label=None):
            val = data.get(key)
            if val is None or val == "" or pd.isna(val):
                if field_label:
                    imputed_fields_list[i].append(field_label)
                return default_val
            return val

        # Fill the non-dummy features using the pre-mapped indices
        X_input[i, feature_indices['age']] = _safe_get(input_data, 'age', 40)
        X_input[i, feature_indices['hypertension']] = int(_safe_get(input_data, 'hypertension', False))
        X_input[i, feature_indices['heart_disease']] = int(_safe_get(input_data, 'heartDisease', False))
        X_input[i, feature_indices['bmi']] = float(_safe_get(input_data, 'bmi', 25.0, 'BMI'))
        X_input[i, feature_indices['HbA1c_level']] = float(_safe_get(input_data, 'hba1cLevel', 5.5, 'HbA1c Level'))
        X_input[i, feature_indices['blood_glucose_level']] = float(_safe_get(input_data, 'bloodGlucoseLevel', 100.0, 'Blood Glucose Level'))
        
        gender_value = _safe_get(input_data, 'gender', 'Female')
        X_input[i, feature_indices['gender_Male']] = 1 if gender_value == 'Male' else 0
        
        smoking_history = _safe_get(input_data, 'smokingHistory', 'never')
        smoke_col = f"smoke_{smoking_history}"
        if smoke_col in feature_indices:
            X_input[i, feature_indices[smoke_col]] = 1
            
    # Now we perform vectorized scaling and prediction for all samples in one go!
    uncached_indices = [idx for idx, res in enumerate(results) if res is None]
    
    if uncached_indices:
        X_uncached = X_input[uncached_indices]
        X_scaled = scaler.transform(X_uncached)
        probs = model.predict_proba(X_scaled)[:, 1]
        
        # Calculate vectorized confidence intervals if cov_beta is available
        if cov_beta is not None:
            # Prepend 1 for intercept to all samples
            x0 = np.hstack((np.ones((len(uncached_indices), 1)), X_scaled))
            
            # Vectorized variance calculation: diag(x0 * cov_beta * x0^T)
            # Efficiently computing diagonal elements only
            variance = np.sum(x0.dot(cov_beta) * x0, axis=1)
            se_logits = np.sqrt(np.maximum(0.0, variance))
            
            # Vectorized decision function
            z0 = model.decision_function(X_scaled)
            
            lower_logits = z0 - 1.96 * se_logits
            upper_logits = z0 + 1.96 * se_logits
            
            lower_probs = 1.0 / (1.0 + np.exp(-lower_logits))
            upper_probs = 1.0 / (1.0 + np.exp(-upper_logits))
            
            lower_cis = np.round(np.clip(lower_probs * 100, 0.0, 100.0), 1)
            upper_cis = np.round(np.clip(upper_probs * 100, 0.0, 100.0), 1)
        else:
            # Fallback to binomial standard error
            ses = (probs * (1 - probs)) ** 0.5
            margins = np.round(1.96 * ses * 100, 1)
            risk_scores = np.round(probs * 100, 1)
            lower_cis = np.round(np.maximum(0.0, risk_scores - margins), 1)
            upper_cis = np.round(np.minimum(100.0, risk_scores + margins), 1)
            
        # Post-process and construct results for uncached samples
        for i, original_idx in enumerate(uncached_indices):
            input_data = input_data_list[original_idx]
            prob = probs[i]
            risk_score = round(prob * 100, 1)
            lower_ci = lower_cis[i]
            upper_ci = upper_cis[i]
            confidence_interval = f"{lower_ci}% - {upper_ci}%"
            
            contributions = model.coef_[0] * X_uncached[i]
            factor_indices = np.argsort(np.abs(contributions))[::-1][:3]
            top_factors = []
            for idx in factor_indices:
                feat = features[idx]
                val = contributions[idx]
                if abs(val) > 0.05:
                    impact = "positive" if val > 0 else "negative"
                    if feat == 'HbA1c_level':
                        fname = 'HbA1c Level'
                    elif feat == 'bmi':
                        fname = 'BMI'
                    elif feat.startswith('smoke'):
                        fname = 'Smoking History'
                    else:
                        fname = feat.replace('_', ' ').title()
                        if fname == 'Gender Male': fname = 'Gender'
                    
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

            for factor in top_factors:
                if factor["impact"] == "positive":
                    fname = factor["name"]
                    if fname == "HbA1c Level":
                        clinician_advice.append("Review glycemic control and consider initiating or adjusting therapy.")
                        patient_advice.append("Focus on managing your blood sugar through diet and prescribed medications.")
                    elif fname == "Blood Glucose Level":
                        clinician_advice.append("Immediate follow-up on elevated glucose levels may be necessary.")
                        patient_advice.append("Monitor your daily glucose readings closely and follow your meal plan.")
                    elif fname == "BMI":
                        clinician_advice.append("Discuss weight management strategies and nutritional counseling.")
                        patient_advice.append("Work on achieving a healthier weight through balanced nutrition and regular exercise.")
                    elif fname == "Hypertension":
                        clinician_advice.append("Optimize blood pressure management and monitor for complications.")
                        patient_advice.append("Regularly check your blood pressure and reduce salt intake.")
                    elif fname == "Smoking History":
                        clinician_advice.append("Provide smoking cessation resources and support.")
                        patient_advice.append("Quitting smoking is one of the most effective ways to reduce your diabetes risk.")
                    elif fname == "Heart Disease":
                        clinician_advice.append("Coordinate care with cardiology and manage cardiovascular risk factors.")
                        patient_advice.append("Manage your heart health as it is closely linked to diabetes risk.")
                    elif fname == "Age":
                        clinician_advice.append("Consider age-related metabolic changes in the management plan.")
                        patient_advice.append("As you get older, it's more important to stay active and monitor your health.")
            
            gender_value = input_data.get('gender', 'Female')
            gender_outside_training_distribution = gender_value not in ('Male', 'Female')
            
            result = {
                "riskScore": risk_score,
                "riskCategory": cat,
                "factors": top_factors,
                "clinicianAdvice": clinician_advice,
                "patientAdvice": patient_advice,
                "confidenceInterval": confidence_interval,
                "modelConfidence": round(float(max(prob, 1 - prob)), 4),
                "is_partial_data": len(imputed_fields_list[original_idx]) > 0,
                "imputed_fields": imputed_fields_list[original_idx]
            }
            if gender_outside_training_distribution:
                result["warning"] = (
                    f"Gender value '{gender_value}' was not present in the model's training data. "
                    "The patient has been encoded as Female for this prediction. "
                    "Results should be interpreted with caution for this demographic."
                )
            
            cache.set(input_data, result)
            results[original_idx] = result
            
    return results

def interpret_prediction(model, scaler, features, input_data, cov_beta=None):
    """Interprets a single patient's data, yielding clinician and patient views."""
    res = interpret_predictions_batch(model, scaler, features, [input_data], cov_beta)
    if isinstance(res, dict):
        return res
    if isinstance(res, list) and len(res) > 0:
        return res[0]
    return res

def counterfactual_analysis(model, scaler, features, input_data, cov_beta=None):
    """
    Performs what-if counterfactual analysis.
    input_data: dict with 'original' (full assessment) and 'perturbations' (list of overrides).
    Returns original prediction + ranked perturbation results.
    """
    original = input_data["original"]
    perturbations = input_data.get("perturbations", [])

    # Build all variants: original + each perturbation applied on top of original
    variants = [original]
    labels = ["original"]
    for p in perturbations:
        variant = dict(original)
        for key, value in p.items():
            if key in original:
                variant[key] = value
        variants.append(variant)
        desc = "; ".join(f"{k}:{original.get(k, '?')}->{p[k]}" for k in p)
        labels.append(desc)

    results = interpret_predictions_batch(model, scaler, features, variants, cov_beta)
    if isinstance(results, dict) and "error" in results:
        return results

    original_result = results[0]
    perturbation_results = []
    for i in range(1, len(results)):
        r = results[i]
        risk_reduction = round(original_result["riskScore"] - r["riskScore"], 1)
        perturbation_results.append({
            "delta": labels[i],
            "riskScore": r["riskScore"],
            "riskCategory": r["riskCategory"],
            "factors": r.get("factors", []),
            "riskReduction": risk_reduction,
            "confidenceInterval": r.get("confidenceInterval"),
            "modelConfidence": r.get("modelConfidence"),
        })

    perturbation_results.sort(key=lambda x: x["riskReduction"], reverse=True)

    return {
        "original": original_result,
        "perturbations": perturbation_results,
        "ranked": perturbation_results,
    }

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "predict_file":
        if len(sys.argv) > 2:
            # SECURITY: Resolve the input path and validate it is within an
            # allowed directory to prevent path traversal attacks.
            # The Node backend always writes temp files to the OS temp directory;
            # we also allow the script directory and CWD for test/CLI usage.
            raw_input_path = sys.argv[2]
            resolved_input = os.path.realpath(raw_input_path)
            _allowed_dirs = {
                os.path.realpath(SCRIPT_DIR),
                os.path.realpath(tempfile.gettempdir()),
                os.path.realpath(os.getcwd()),
            }
            if not any(
                resolved_input == d or resolved_input.startswith(d + os.sep)
                for d in _allowed_dirs
            ):
                print(
                    "Error: Access denied. File path resolves outside allowed directories.",
                    file=sys.stderr,
                )
                sys.exit(1)
            with open(resolved_input, 'r') as f:
                data = json.load(f)
        else:
            data = json.load(sys.stdin)
        model, scaler, features, cov_beta = get_model()
        if isinstance(data, list):
            results = interpret_predictions_batch(model, scaler, features, data, cov_beta)
            print(json.dumps(results))
        else:
            result = interpret_prediction(model, scaler, features, data, cov_beta)
            print(json.dumps(result))
    elif len(sys.argv) > 1 and sys.argv[1] == "counterfactual":
        if len(sys.argv) > 2:
            with open(sys.argv[2], 'r') as f:
                data = json.load(f)
        else:
            data = json.load(sys.stdin)
        model, scaler, features, cov_beta = get_model()
        result = counterfactual_analysis(model, scaler, features, data, cov_beta)
        print(json.dumps(result))
    elif len(sys.argv) > 1 and sys.argv[1] == "train":
        if not os.path.exists(DATA_FILE):
            print("Dataset not found. Creating synthetic dataset...")
            create_synthetic_data()
        success = save_pretrained_model()
        if success:
            model, scaler, features, cov_beta = get_model()
            print(f"Features used: {features}")
            print(f"Model Coefficients (Weights): {model.coef_[0]}")
    else:
        print("Running complete exploratory and modeling pipeline...\n")
        if not os.path.exists(DATA_FILE):
            print("Dataset not found. Creating synthetic dataset...")
            create_synthetic_data()
        model, scaler, features, cov_beta = get_model()
        if model is None:
            print("Failed to load dataset.")
        else:
            try:
                df = read_csv_safely(DATA_FILE)
                generate_correlation_heatmap(df)
            except SafeCSVError as e:
                print(f"Error generating correlation heatmap: {e}", file=sys.stderr)
            
            print("Model trained successfully.")
            print(f"Features used: {features}")
            print(f"Model Coefficients (Weights): {model.coef_[0]}")
            print("Use 'python analyze.py predict_file <json_file>' to run a prediction.")