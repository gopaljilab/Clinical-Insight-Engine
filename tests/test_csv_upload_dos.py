import os
import tempfile
import pytest
import pandas as pd
from validation.csv_validator import ValidationError
from services.safe_csv_reader import read_csv_safely, SafeCSVError

@pytest.fixture
def temp_csv():
    fd, path = tempfile.mkstemp(suffix=".csv")
    os.close(fd)
    yield path
    if os.path.exists(path):
        os.remove(path)

def test_valid_csv_success(temp_csv):
    df = pd.DataFrame({
        "gender": ["Male", "Female"],
        "age": [45, 62],
        "hypertension": [0, 1],
        "heart_disease": [0, 0],
        "smoking_history": ["never", "former"],
        "bmi": [24.5, 31.2],
        "HbA1c_level": [5.2, 6.8],
        "blood_glucose_level": [95, 145],
        "diabetes": [0, 1]
    })
    df.to_csv(temp_csv, index=False)
    
    # Should read without error
    result = read_csv_safely(temp_csv)
    assert len(result) == 2
    assert "gender" in result.columns

def test_malformed_headers(temp_csv):
    df = pd.DataFrame({
        "gender": ["Male"],
        "wrong_column": [123]
    })
    df.to_csv(temp_csv, index=False)
    
    with pytest.raises(SafeCSVError, match="Missing required headers"):
        read_csv_safely(temp_csv)

def test_oversized_file(temp_csv, monkeypatch):
    df = pd.DataFrame({
        "gender": ["Male"],
        "age": [45],
        "hypertension": [0],
        "heart_disease": [0],
        "smoking_history": ["never"],
        "bmi": [24.5],
        "HbA1c_level": [5.2],
        "blood_glucose_level": [95],
        "diabetes": [0]
    })
    df.to_csv(temp_csv, index=False)
    
    import validation.csv_validator as validator
    original_max = validator.MAX_FILE_SIZE
    validator.MAX_FILE_SIZE = 1 # 1 byte
    try:
        with pytest.raises(SafeCSVError, match="exceeds maximum allowed size"):
            read_csv_safely(temp_csv)
    finally:
        validator.MAX_FILE_SIZE = original_max

def test_excessive_row_count(temp_csv):
    df = pd.DataFrame({
        "gender": ["Male"] * 10,
        "age": [45] * 10,
        "hypertension": [0] * 10,
        "heart_disease": [0] * 10,
        "smoking_history": ["never"] * 10,
        "bmi": [24.5] * 10,
        "HbA1c_level": [5.2] * 10,
        "blood_glucose_level": [95] * 10,
        "diabetes": [0] * 10
    })
    df.to_csv(temp_csv, index=False)
    
    with pytest.raises(SafeCSVError, match="(Maximum row count|Malformed CSV|Invalid CSV|Unexpected error)"):
        read_csv_safely(temp_csv, max_rows=5, chunksize=2)

def test_corrupted_csv(temp_csv):
    with open(temp_csv, "wb") as f:
        f.write(b'\x81\x81\x81\x81\x81')
    
    with pytest.raises(SafeCSVError):
        read_csv_safely(temp_csv, chunksize=1)

def test_memory_stress_case(temp_csv):
    df = pd.DataFrame({
        "gender": ["Male"] * 100,
        "age": [45] * 100,
        "hypertension": [0] * 100,
        "heart_disease": [0] * 100,
        "smoking_history": ["never"] * 100,
        "bmi": [24.5] * 100,
        "HbA1c_level": [5.2] * 100,
        "blood_glucose_level": [95] * 100,
        "diabetes": [0] * 100
    })
    df.to_csv(temp_csv, index=False)
    
    # Process with very small chunks to simulate bounded memory usage
    result = read_csv_safely(temp_csv, chunksize=10, max_rows=150)
    assert len(result) == 100
