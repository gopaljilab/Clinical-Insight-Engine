"""
Unit tests for services.safe_csv_reader.read_csv_safely.

Covers:
- successful CSV read with required headers and sanitization
- missing file raises SafeCSVError
- invalid extension raises SafeCSVError
- malformed CSV raises SafeCSVError
- resource exhaustion raises SafeCSVError
- empty CSV with headers returns empty DataFrame with correct columns
"""

import os
import tempfile

import pandas as pd
import pytest

from services.safe_csv_reader import SafeCSVError, read_csv_safely
from services.resource_guard import ResourceExhaustedError


class TestReadCSVSafely:
    def test_reads_valid_csv(self, tmp_path):
        csv = tmp_path / "valid.csv"
        csv.write_text(
            "gender,age,hypertension,heart_disease,smoking_history,"
            "bmi,HbA1c_level,blood_glucose_level,diabetes\n"
            "Male,45,0,0,never,28.5,5.5,110,0\n"
            "Female,52,1,0,former,31.2,6.8,130,0\n"
        )
        df = read_csv_safely(str(csv))
        assert len(df) == 2
        assert "gender" in df.columns

    def test_raises_when_file_not_found(self):
        with pytest.raises(SafeCSVError, match="File not found"):
            read_csv_safely("/nonexistent/path/data.csv")

    def test_raises_for_invalid_extension(self, tmp_path):
        csv = tmp_path / "data.xlsx"
        csv.write_text("gender,age\nMale,45\n")
        with pytest.raises(SafeCSVError, match="Invalid file extension"):
            read_csv_safely(str(csv))

    def test_raises_for_malformed_csv(self, tmp_path):
        csv = tmp_path / "bad.csv"
        csv.write_text(
            "gender,age,hypertension,heart_disease,smoking_history,"
            "bmi,HbA1c_level,blood_glucose_level,diabetes\n"
            '"unclosed quote\n1,2,3,4,5,6,7,8,9\n'
        )
        with pytest.raises(SafeCSVError, match="Malformed CSV"):
            read_csv_safely(str(csv))

    def test_raises_for_missing_columns(self, tmp_path):
        csv = tmp_path / "missing_cols.csv"
        csv.write_text("gender,age\nMale,45\n")
        with pytest.raises(SafeCSVError):
            read_csv_safely(str(csv))

    def test_returns_empty_dataframe_with_headers_for_empty_file(self, tmp_path):
        csv = tmp_path / "empty.csv"
        csv.write_text(
            "gender,age,hypertension,heart_disease,smoking_history,"
            "bmi,HbA1c_level,blood_glucose_level,diabetes\n"
        )
        df = read_csv_safely(str(csv))
        assert len(df) == 0
        assert list(df.columns) == [
            "gender", "age", "hypertension", "heart_disease", "smoking_history",
            "bmi", "HbA1c_level", "blood_glucose_level", "diabetes",
        ]

    def test_raises_on_max_rows_exceeded(self, tmp_path):
        csv = tmp_path / "big.csv"
        header = (
            "gender,age,hypertension,heart_disease,smoking_history,"
            "bmi,HbA1c_level,blood_glucose_level,diabetes\n"
        )
        rows = "\n".join(
            "Male,45,0,0,never,28.5,5.5,110,0"
            for _ in range(5)
        )
        csv.write_text(header + rows)
        with pytest.raises(SafeCSVError, match="Maximum row count"):
            read_csv_safely(str(csv), max_rows=3)

    def test_raises_on_missing_required_headers(self, tmp_path):
        csv = tmp_path / "missing_header.csv"
        csv.write_text("gender,age\nMale,45\n")
        with pytest.raises(SafeCSVError, match="Missing required headers"):
            read_csv_safely(str(csv))

    def test_reads_chunked_csv_correctly(self, tmp_path):
        csv = tmp_path / "chunked.csv"
        header = (
            "gender,age,hypertension,heart_disease,smoking_history,"
            "bmi,HbA1c_level,blood_glucose_level,diabetes\n"
        )
        rows = "\n".join(
            f"Male,{i},0,0,never,28.5,5.5,110,0"
            for i in range(100)
        )
        csv.write_text(header + rows)
        df = read_csv_safely(str(csv), chunksize=10, max_rows=200)
        assert len(df) == 100
