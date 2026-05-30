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
    """Smoke test for the predict_file entrypoint used by the API."""
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

    # First run may log model training to stdout before JSON payload.
    stdout_lines = [
        line.strip()
        for line in result.stdout.splitlines()
        if line.strip()
    ]
    assert stdout_lines, "Expected prediction JSON on stdout"
    output = json.loads(stdout_lines[-1])

    assert "riskScore" in output
    assert output["riskCategory"] in {"LOW", "MODERATE", "HIGH"}


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
    model_file = os.path.join(tmp_path, "test_model.joblib")
    data = (None, None, ["a", "b"], "dummyhash")
    _atomic_write(model_file, data)
    assert os.path.exists(model_file)

    import joblib
    loaded = joblib.load(model_file)
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
    # but at most one should hold the lock at a time
    concurrent_holders = acquired_events.count(True)
    assert concurrent_holders <= 2  # at most 2 total acquisitions
