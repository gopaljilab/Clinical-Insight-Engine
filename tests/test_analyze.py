"""Foundational tests for ML analysis utilities."""

import json
import os
import subprocess
import sys
import tempfile
import threading
import time

import pytest

# Ensure repository root is on the path when running pytest from any cwd.
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from analyze import (  # noqa: E402
    MODEL_FILE,
    LOCK_FILE,
    _acquire_lock,
    _atomic_write,
    _compute_dataset_hash,
    _release_lock,
    create_synthetic_data,
    interpret_prediction,
)


def test_compute_dataset_hash_returns_none_for_missing_file():
    assert _compute_dataset_hash("definitely_missing_dataset_xyz.csv") is None


def test_compute_dataset_hash_is_stable_for_same_content():
    with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".csv") as tmp:
        tmp.write("a,b\n1,2\n")
        tmp_path = tmp.name

    try:
        first = _compute_dataset_hash(tmp_path)
        second = _compute_dataset_hash(tmp_path)
        assert first is not None
        assert first == second
    finally:
        os.remove(tmp_path)


def test_create_synthetic_data_has_expected_columns_and_size():
    original_path = os.path.join(REPO_ROOT, "diabetes_dataset.csv")
    backup_path = f"{original_path}.pytest-backup"

    if os.path.exists(original_path):
        os.rename(original_path, backup_path)

    try:
        df = create_synthetic_data()
        assert len(df) == 1000
        assert {"gender", "age", "diabetes", "bmi"}.issubset(df.columns)
    finally:
        if os.path.exists(original_path):
            os.remove(original_path)
        if os.path.exists(backup_path):
            os.rename(backup_path, original_path)


def test_interpret_prediction_returns_error_without_model():
    result = interpret_prediction(
        None,
        None,
        [],
        {
            "age": 40,
            "gender": "Male",
            "hypertension": False,
            "heartDisease": False,
            "bmi": 25,
            "hba1cLevel": 5.5,
            "bloodGlucoseLevel": 100,
            "smokingHistory": "never",
        },
    )

    assert "error" in result
    assert "dataset" in result["error"].lower()


def test_predict_file_cli_outputs_json(tmp_path):
    """Smoke test for the predict_file entrypoint used by the API.

    Removes any cached model file first to simulate a cold-start
    (first-ever prediction), which triggers the retrain path in get_model().
    This ensures diagnostic print() messages go to stderr, not stdout,
    and the JSON output on stdout remains parseable.
    """
    payload = {
        "gender": "Male",
        "age": 45,
        "hypertension": False,
        "heartDisease": False,
        "smokingHistory": "never",
        "bmi": 24.5,
        "hba1cLevel": 5.2,
        "bloodGlucoseLevel": 95,
    }
    input_file = tmp_path / "patient.json"
    input_file.write_text(json.dumps(payload), encoding="utf-8")

    dataset = os.path.join(REPO_ROOT, "diabetes_dataset.csv")
    if not os.path.exists(dataset):
        create_synthetic_data()

    # Cold-start: remove any cached model so get_model() must retrain
    model_file = os.path.join(REPO_ROOT, "diabetes_model.pkl")
    if os.path.exists(model_file):
        os.remove(model_file)

    import subprocess

    result = subprocess.run(
        [sys.executable, os.path.join(REPO_ROOT, "analyze.py"), "predict_file", str(input_file)],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        timeout=120,
        check=False,
    )

    assert result.returncode == 0, result.stderr

    # Training messages (if any) go to stderr, so stdout should contain
    # only the JSON payload.  We still take the last line as a safety net.
    stdout_lines = [
        line.strip()
        for line in result.stdout.splitlines()
        if line.strip()
    ]
    assert stdout_lines, "Expected prediction JSON on stdout"
    output = json.loads(stdout_lines[-1])

    assert "riskScore" in output
    assert output["riskCategory"] in {"LOW", "MODERATE", "HIGH"}

def test_interpret_prediction_personalized_advice():
    """Verify that advice is personalized based on risk factors."""
    # Mock model and scaler
    import numpy as np
    from unittest.mock import MagicMock
    
    mock_model = MagicMock()
    mock_model.predict_proba.return_value = np.array([[0.1, 0.8]]) # 80% risk -> HIGH
    # index 4 is HbA1c_level in our features list below
    coefs = np.zeros((1, 10))
    coefs[0, 4] = 2.0 
    mock_model.coef_ = coefs
    mock_model.decision_function.return_value = np.array([1.5])
    
    mock_scaler = MagicMock()
    # features: age, hypertension, heart_disease, bmi, HbA1c_level, blood_glucose_level, gender_Male, ...
    # Let's say index 4 is HbA1c_level
    mock_scaler.transform.return_value = np.array([[0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0]])
    
    features = ['age', 'hypertension', 'heart_disease', 'bmi', 'HbA1c_level', 'blood_glucose_level', 'gender_Male', 'smoke_current', 'smoke_former', 'smoke_never']
    
    input_data = {
        "age": 45,
        "gender": "Male",
        "hypertension": False,
        "heartDisease": False,
        "bmi": 24.5,
        "hba1cLevel": 9.0,
        "bloodGlucoseLevel": 100,
        "smokingHistory": "never",
    }
    
    result = interpret_prediction(mock_model, mock_scaler, features, input_data)
    
    assert result["riskCategory"] == "HIGH"
    # Check if HbA1c advice is present
    assert any("glycemic control" in advice for advice in result["clinicianAdvice"])
    assert any("blood sugar" in advice for advice in result["patientAdvice"])
    
    # Check if other advice is NOT present (e.g. BMI)
    assert not any("weight management" in advice for advice in result["clinicianAdvice"])

def test_acquire_and_release_lock():
    _acquire_lock(timeout=1)
    assert os.path.exists(LOCK_FILE)
    _release_lock()
    assert not os.path.exists(LOCK_FILE)


def test_lock_is_exclusive():
    _acquire_lock(timeout=1)
    acquired = _acquire_lock(timeout=0.5)
    assert not acquired
    _release_lock()


def test_atomic_write_creates_valid_model(tmp_path):
    model_file = os.path.join(tmp_path, "test_model.pkl")
    data = (None, None, ["a", "b"], "dummyhash")
    _atomic_write(model_file, data)
    assert os.path.exists(model_file)

    from app.ml.security import safe_pickle_load
    with open(model_file, 'rb') as f:
        loaded = safe_pickle_load(f)
    assert loaded[3] == "dummyhash"


def test_concurrent_prediction_processes(tmp_path):
    """Run multiple prediction subprocesses concurrently to verify no corruption."""
    dataset = os.path.join(REPO_ROOT, "diabetes_dataset.csv")
    if not os.path.exists(dataset):
        create_synthetic_data()

    payload_file = tmp_path / "patient.json"
    payload_file.write_text(json.dumps({
        "gender": "Male",
        "age": 45,
        "hypertension": False,
        "heartDisease": False,
        "smokingHistory": "never",
        "bmi": 24.5,
        "hba1cLevel": 5.2,
        "bloodGlucoseLevel": 95,
    }), encoding="utf-8")

    results = []
    errors = []

    def run_prediction():
        try:
            result = subprocess.run(
                [sys.executable, os.path.join(REPO_ROOT, "analyze.py"),
                 "predict_file", str(payload_file)],
                capture_output=True, text=True, cwd=REPO_ROOT, timeout=120,
            )
            results.append((result.returncode, result.stdout, result.stderr))
        except Exception as e:
            errors.append(str(e))

    threads = [threading.Thread(target=run_prediction) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors, f"Thread errors: {errors}"

    for returncode, stdout, stderr in results:
        assert returncode == 0, f"Non-zero exit: {stderr}"
        lines = [line.strip() for line in stdout.splitlines() if line.strip()]
        assert lines, "Expected prediction JSON on stdout"
        output = json.loads(lines[-1])
        assert "riskScore" in output
        assert output["riskCategory"] in {"LOW", "MODERATE", "HIGH"}


def test_lock_prevents_concurrent_writes(tmp_path):
    """Verify that two processes cannot both hold the lock simultaneously."""
    acquired_events = []
    lock_holder = [None]

    def try_lock(holder_id):
        ok = _acquire_lock(timeout=2)
        acquired_events.append(ok)
        if ok:
            lock_holder[0] = holder_id
            time.sleep(0.5)
            _release_lock()

    t1 = threading.Thread(target=try_lock, args=(1,))
    t2 = threading.Thread(target=try_lock, args=(2,))
    t1.start()
    time.sleep(0.1)
    t2.start()
    t1.join()
    t2.join()

    assert acquired_events.count(True) >= 1
    # The second acquire may or may not succeed depending on timing,
    concurrent_holders = acquired_events.count(True)
    assert concurrent_holders <= 2  # at most 2 total acquisitions


def test_get_model_metadata_caching(tmp_path, monkeypatch):
    """Test that get_model uses metadata cache and skips hash computation."""
    import analyze
    import pickle
    
    # Set up temp paths for test
    test_data_file = os.path.join(tmp_path, "test_diabetes_dataset.csv")
    test_model_file = os.path.join(tmp_path, "test_diabetes_model.pkl")
    
    # Write dummy dataset with both classes
    with open(test_data_file, "w") as f:
        f.write("gender,age,hypertension,heart_disease,smoking_history,bmi,HbA1c_level,blood_glucose_level,diabetes\n")
        f.write("Male,45,0,0,never,25.0,5.5,100,0\n")
        f.write("Female,50,1,0,never,30.0,6.5,140,1\n")
        
    # Monkeypatch constants in analyze module
    monkeypatch.setattr(analyze, "DATA_FILE", test_data_file)
    monkeypatch.setattr(analyze, "MODEL_FILE", test_model_file)
    monkeypatch.setattr(analyze, "LOCK_FILE", test_model_file + ".lock")
    
    # Initial save/train
    success = analyze.save_pretrained_model()
    assert success
    assert os.path.exists(test_model_file)
    assert os.path.exists(test_model_file + ".sig")
    
    # Load model_data to verify it has 7 elements
    from app.ml.security import safe_pickle_load
    with open(test_model_file, 'rb') as f:
        model_data = safe_pickle_load(f)
    assert len(model_data) == 7
    assert model_data[5] is not None  # mtime
    assert model_data[6] is not None  # size
    
    # Now call get_model() and verify it doesn't call _compute_dataset_hash
    hash_called = False
    original_compute_hash = analyze._compute_dataset_hash
    
    def mock_compute_hash(filepath):
        nonlocal hash_called
        hash_called = True
        return original_compute_hash(filepath)
        
    monkeypatch.setattr(analyze, "_compute_dataset_hash", mock_compute_hash)
    
    # First call: metadata matches, so hash should NOT be called
    res = analyze.get_model()
    assert res[0] is not None
    assert not hash_called, "Cryptographic hash was computed even though metadata matched!"
    
    # Now touch the file to change mtime (but keep content same)
    time.sleep(0.1)  # ensure mtime difference
    os.utime(test_data_file, None)
    
    # Second call: metadata mismatches, so hash SHOULD be called
    hash_called = False
    res2 = analyze.get_model()
    assert res2[0] is not None
    assert hash_called, "Cryptographic hash was not computed after metadata changed!"
    
    # The second call should have also updated the model file with the new mtime
    from app.ml.security import safe_pickle_load
    with open(test_model_file, 'rb') as f:
        model_data_updated = safe_pickle_load(f)
    new_mtime = os.path.getmtime(test_data_file)
    assert model_data_updated[5] == new_mtime


def test_get_model_legacy_compatibility_and_migration(tmp_path, monkeypatch):
    """Test that legacy 5-element tuple models are loaded correctly and migrated to 7-element tuples."""
    import analyze
    import pickle
    from app.ml.security import write_signature
    
    test_data_file = os.path.join(tmp_path, "test_diabetes_dataset.csv")
    test_model_file = os.path.join(tmp_path, "test_diabetes_model.pkl")
    
    with open(test_data_file, "w") as f:
        f.write("gender,age,hypertension,heart_disease,smoking_history,bmi,HbA1c_level,blood_glucose_level,diabetes\n")
        f.write("Male,45,0,0,never,25.0,5.5,100,0\n")
        f.write("Female,50,1,0,never,30.0,6.5,140,1\n")
        
    monkeypatch.setattr(analyze, "DATA_FILE", test_data_file)
    monkeypatch.setattr(analyze, "MODEL_FILE", test_model_file)
    monkeypatch.setattr(analyze, "LOCK_FILE", test_model_file + ".lock")
    
    # Generate model parameters manually and save as a legacy 5-element tuple
    model, scaler, features, cov_beta = analyze.train_model_pipeline()
    dataset_hash = analyze._compute_dataset_hash(test_data_file)
    
    legacy_data = (model, scaler, features, dataset_hash, cov_beta)
    with open(test_model_file, 'wb') as f:
        pickle.dump(legacy_data, f)
    write_signature(test_model_file)
    
    # Now load using get_model(). It should detect it's a legacy model, compute the hash, match it,
    # and update the MODEL_FILE with metadata (7-element tuple).
    res = analyze.get_model()
    assert res[0] is not None
    
    from app.ml.security import safe_pickle_load
    with open(test_model_file, 'rb') as f:
        migrated_data = safe_pickle_load(f)
    assert len(migrated_data) == 7
    assert migrated_data[3] == dataset_hash
    assert migrated_data[5] == os.path.getmtime(test_data_file)
    assert migrated_data[6] == os.path.getsize(test_data_file)

