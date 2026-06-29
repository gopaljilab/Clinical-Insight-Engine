"""
Unit tests for services/safe_csv_reader.py — safe CSV reading with validation and resource guards.
"""
import os
import sys
import io
import tempfile
import unittest
from unittest import mock

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from services.safe_csv_reader import SafeCSVError, read_csv_safely
from validation.csv_validator import ValidationError
from services.resource_guard import ResourceExhaustedError


class TestSafeCSVReader(unittest.TestCase):
    """Tests for read_csv_safely function."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _write_csv(self, content, filename="test.csv"):
        path = os.path.join(self.temp_dir, filename)
        with open(path, "wb") as f:
            f.write(content)
        return path

    def test_valid_csv_returns_dataframe(self):
        """Valid CSV with required headers returns a pandas DataFrame."""
        csv_content = (
            b"gender,age,hypertension,heart_disease,smoking_history,bmi,HbA1c_level,blood_glucose_level,diabetes\n"
            b"Male,45,0,0,never,24.5,5.2,95,0\n"
        )
        path = self._write_csv(csv_content)
        result = read_csv_safely(path)
        self.assertEqual(len(result), 1)
        self.assertEqual(result.iloc[0]["gender"], "Male")
        self.assertEqual(result.iloc[0]["age"], 45)

    def test_file_exceeding_max_size_raises_safe_csv_error(self):
        """File exceeding MAX_FILE_SIZE raises SafeCSVError."""
        csv_content = b"gender,age\nMale,45\n" + b"x" * (11 * 1024 * 1024)  # > 10MB
        path = self._write_csv(csv_content)
        with self.assertRaises(SafeCSVError) as ctx:
            read_csv_safely(path)
        self.assertIn("File exceeds maximum allowed size", str(ctx.exception))

    def test_invalid_extension_raises_safe_csv_error(self):
        """File with invalid extension raises SafeCSVError."""
        path = self._write_csv(b"gender,age\nMale,45\n", "test.txt")
        with self.assertRaises((SafeCSVError, ValidationError)):
            read_csv_safely(path)

    def test_pe_executable_header_raises_safe_csv_error(self):
        """File with MZ/PE executable header raises SafeCSVError."""
        # MZ header (0x4D 0x5A = "MZ")
        path = self._write_csv(b"MZ" + b"\x00" * 100, "test.csv")
        with self.assertRaises((SafeCSVError, ValidationError)):
            read_csv_safely(path)

    def test_elf_binary_header_raises_safe_csv_error(self):
        """File with ELF binary header raises SafeCSVError."""
        # ELF magic bytes
        path = self._write_csv(b"\x7fELF" + b"\x00" * 100, "test.csv")
        with self.assertRaises((SafeCSVError, ValidationError)):
            read_csv_safely(path)

    def test_missing_required_headers_raises_safe_csv_error(self):
        """CSV missing required headers raises SafeCSVError."""
        csv_content = b"gender,age\nMale,45\n"
        path = self._write_csv(csv_content)
        with self.assertRaises((SafeCSVError, ValidationError)) as ctx:
            read_csv_safely(path)
        self.assertIn("Missing required headers", str(ctx.exception))

    def test_max_rows_exceeded_raises_safe_csv_error(self):
        """CSV with more rows than max_rows raises SafeCSVError."""
        # Generate a CSV with more rows than max_rows=5
        header = b"gender,age,hypertension,heart_disease,smoking_history,bmi,HbA1c_level,blood_glucose_level,diabetes\n"
        rows = b"Male,45,0,0,never,24.5,5.2,95,0\n" * 10
        path = self._write_csv(header + rows)
        with self.assertRaises(SafeCSVError) as ctx:
            read_csv_safely(path, max_rows=5, chunksize=3)
        self.assertIn("Maximum row count", str(ctx.exception))

    def test_empty_csv_returns_empty_dataframe(self):
        """CSV with only headers and no data rows returns empty DataFrame."""
        csv_content = b"gender,age,hypertension,heart_disease,smoking_history,bmi,HbA1c_level,blood_glucose_level,diabetes\n"
        path = self._write_csv(csv_content)
        result = read_csv_safely(path)
        self.assertEqual(len(result), 0)
        self.assertIsNotNone(result)

    def test_sanitizes_csv_injection_in_cell_values(self):
        """CSV cell values containing formula injection prefixes are sanitized."""
        csv_content = (
            b"gender,age,hypertension,heart_disease,smoking_history,bmi,HbA1c_level,blood_glucose_level,diabetes\n"
            b"=SUM(A1:A10),45,0,0,never,24.5,5.2,95,0\n"
        )
        path = self._write_csv(csv_content)
        result = read_csv_safely(path)
        # The = prefix should be neutralized by the sanitizer
        cell_value = str(result.iloc[0]["gender"])
        self.assertTrue(cell_value.startswith("'") or "=SUM" not in cell_value)
