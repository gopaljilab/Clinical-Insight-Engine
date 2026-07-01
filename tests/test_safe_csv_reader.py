"""
Unit tests for services.safe_csv_reader read_csv_safely function.
"""
import os
import sys
import unittest
import tempfile
import shutil

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from services.safe_csv_reader import read_csv_safely, SafeCSVError
from validation.csv_validator import ValidationError


class TestReadCSVSafely(unittest.TestCase):
    """Tests for read_csv_safely."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _make_file(self, name, content=""):
        path = os.path.join(self.temp_dir, name)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return path

    def test_successful_read_with_valid_csv(self):
        content = (
            "gender,age,hypertension,heart_disease,smoking_history,"
            "bmi,HbA1c_level,blood_glucose_level,diabetes\n"
            "Female,45,0,0,never,22.5,6.2,140,0\n"
            "Male,60,1,1,current,31.0,9.5,220,1\n"
        )
        path = self._make_file("valid.csv", content)
        df = read_csv_safely(path)
        self.assertEqual(len(df), 2)
        self.assertIn("gender", df.columns)
        self.assertEqual(df.iloc[0]["gender"], "Female")
        self.assertEqual(df.iloc[1]["diabetes"], 1)

    def test_raises_safe_csv_error_when_file_too_large(self):
        # Create a file that exceeds the 10MB default limit
        path = self._make_file("large.csv", "")
        with open(path, "wb") as f:
            f.write(b"x" * (11 * 1024 * 1024))

        with self.assertRaises(SafeCSVError) as ctx:
            read_csv_safely(path)
        self.assertIn("exceeds maximum", str(ctx.exception))

    def test_raises_safe_csv_error_when_required_headers_missing(self):
        content = "gender,age,bmi\nFemale,45,22.5\n"
        path = self._make_file("missing_headers.csv", content)

        with self.assertRaises(SafeCSVError) as ctx:
            read_csv_safely(path)
        # The error message should indicate missing headers
        self.assertIn("Missing required", str(ctx.exception))

    def test_raises_safe_csv_error_when_file_contains_pe_binary_header(self):
        # A .csv file that starts with an MZ (PE executable) header should be rejected
        path = self._make_file("fake.csv", "")
        with open(path, "wb") as f:
            f.write(b'MZ' + b'\x00' * 20 + b'dummy content\n')

        with self.assertRaises(SafeCSVError) as ctx:
            read_csv_safely(path)
        self.assertIn("PE", str(ctx.exception))

    def test_raises_safe_csv_error_when_row_count_exceeds_max_rows(self):
        # Create a valid CSV with more rows than max_rows (100)
        required_headers = (
            "gender,age,hypertension,heart_disease,smoking_history,"
            "bmi,HbA1c_level,blood_glucose_level,diabetes\n"
        )
        rows = "\n".join(
            f"Male,{i % 80 + 20},0,0,never,25.0,6.0,130,0"
            for i in range(150)
        )
        content = required_headers + rows + "\n"
        path = self._make_file("too_many_rows.csv", content)

        with self.assertRaises(SafeCSVError) as ctx:
            read_csv_safely(path, max_rows=100, timeout_seconds=30)
        self.assertIn("row count", str(ctx.exception).lower())

    def test_returns_dataframe_with_correct_columns_on_success(self):
        content = (
            "gender,age,hypertension,heart_disease,smoking_history,"
            "bmi,HbA1c_level,blood_glucose_level,diabetes\n"
            "Female,45,0,0,never,22.5,6.2,140,0\n"
        )
        path = self._make_file("columns.csv", content)
        df = read_csv_safely(path)
        for col in ["gender", "age", "bmi", "HbA1c_level", "blood_glucose_level"]:
            self.assertIn(col, df.columns)

    def test_raises_safe_csv_error_for_invalid_extension(self):
        # Use a .json file which is explicitly not allowed
        path = self._make_file("data.json", '{"gender": "Female"}')

        with self.assertRaises(SafeCSVError) as ctx:
            read_csv_safely(path)
        self.assertIn("extension", str(ctx.exception).lower())

    def test_raises_safe_csv_error_when_file_not_found(self):
        path = os.path.join(self.temp_dir, "nonexistent.csv")

        with self.assertRaises(SafeCSVError) as ctx:
            read_csv_safely(path)
        self.assertIn("not found", str(ctx.exception).lower())
