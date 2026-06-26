"""
Unit tests for validation/csv_validator.py
Tests file size, header, and content validation guards.
"""
import os
import tempfile
import unittest

import sys
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from validation.csv_validator import (
    ValidationError,
    validate_file_size,
    validate_headers,
    validate_extension_and_content,
)


def make_csv(path):
    csv_path = path + ".csv"
    with open(csv_path, "wb") as f:
        f.write(b"header\nvalue")
    return csv_path


def safe_remove(path):
    if os.path.exists(path):
        os.remove(path)


class TestValidateFileSize(unittest.TestCase):
    def setUp(self):
        fd, self.temp_path = tempfile.mkstemp()
        os.close(fd)

    def tearDown(self):
        safe_remove(self.temp_path)

    def test_accepts_file_within_default_limit(self):
        with open(self.temp_path, "wb") as f:
            f.write(b"x" * 1024)
        validate_file_size(self.temp_path)

    def test_rejects_file_exceeding_default_limit(self):
        with open(self.temp_path, "wb") as f:
            f.write(b"x" * (11 * 1024 * 1024))
        with self.assertRaises(ValidationError) as ctx:
            validate_file_size(self.temp_path)
        self.assertIn("exceeds maximum", str(ctx.exception))

    def test_rejects_file_exceeding_custom_limit(self):
        with open(self.temp_path, "wb") as f:
            f.write(b"x" * 200)
        with self.assertRaises(ValidationError) as ctx:
            validate_file_size(self.temp_path, max_size=100)
        self.assertIn("exceeds maximum", str(ctx.exception))

    def test_accepts_file_at_exact_limit(self):
        with open(self.temp_path, "wb") as f:
            f.write(b"x" * (10 * 1024 * 1024))
        validate_file_size(self.temp_path)

    def test_raises_for_nonexistent_file(self):
        with self.assertRaises(ValidationError) as ctx:
            validate_file_size("/nonexistent/path/file.csv")
        self.assertIn("not found", str(ctx.exception))


class TestValidateHeaders(unittest.TestCase):
    def test_passes_with_all_required_headers(self):
        headers = [
            "gender", "age", "hypertension", "heart_disease",
            "smoking_history", "bmi", "HbA1c_level",
            "blood_glucose_level", "diabetes"
        ]
        validate_headers(headers)

    def test_passes_with_extra_headers(self):
        headers = [
            "gender", "age", "hypertension", "heart_disease",
            "smoking_history", "bmi", "HbA1c_level",
            "blood_glucose_level", "diabetes", "extra_column"
        ]
        validate_headers(headers)

    def test_raises_for_single_missing_header(self):
        headers = ["gender", "age", "hypertension"]
        with self.assertRaises(ValidationError) as ctx:
            validate_headers(headers)
        self.assertIn("Missing required headers", str(ctx.exception))

    def test_raises_for_multiple_missing_headers(self):
        headers = ["gender", "age"]
        with self.assertRaises(ValidationError) as ctx:
            validate_headers(headers)
        error_msg = str(ctx.exception)
        for missing in ["hypertension", "heart_disease", "smoking_history"]:
            self.assertIn(missing, error_msg)


class TestValidateExtensionAndContent(unittest.TestCase):
    def test_accepts_csv_extension(self):
        fd, path = tempfile.mkstemp()
        os.close(fd)
        csv_path = make_csv(path)
        validate_extension_and_content(csv_path)
        safe_remove(csv_path)

    def test_accepts_txt_extension(self):
        fd, path = tempfile.mkstemp()
        os.close(fd)
        txt_path = path + ".txt"
        with open(txt_path, "wb") as f:
            f.write(b"header\nvalue")
        validate_extension_and_content(txt_path)
        safe_remove(txt_path)

    def test_rejects_exe_extension(self):
        fd, path = tempfile.mkstemp()
        os.close(fd)
        exe_path = path + ".exe"
        with open(exe_path, "wb") as f:
            f.write(b"MZ" + b"\x00" * 100)
        with self.assertRaises(ValidationError) as ctx:
            validate_extension_and_content(exe_path)
        self.assertIn("Invalid file extension", str(ctx.exception))
        safe_remove(exe_path)

    def test_rejects_python_extension(self):
        fd, path = tempfile.mkstemp()
        os.close(fd)
        py_path = path + ".py"
        with open(py_path, "wb") as f:
            f.write(b"print('malicious')")
        with self.assertRaises(ValidationError):
            validate_extension_and_content(py_path)
        safe_remove(py_path)

    def test_rejects_pe_binary_header_in_csv(self):
        fd, path = tempfile.mkstemp()
        os.close(fd)
        csv_path = path + ".csv"
        with open(csv_path, "wb") as f:
            f.write(b"MZ" + b"\x90" * 10 + b"PE\0\0")
        with self.assertRaises(ValidationError) as ctx:
            validate_extension_and_content(csv_path)
        self.assertIn("PE/MZ", str(ctx.exception))
        safe_remove(csv_path)

    def test_rejects_elf_binary_header_in_csv(self):
        fd, path = tempfile.mkstemp()
        os.close(fd)
        csv_path = path + ".csv"
        with open(csv_path, "wb") as f:
            f.write(b"\x7fELF" + b"\x00" * 100)
        with self.assertRaises(ValidationError) as ctx:
            validate_extension_and_content(csv_path)
        self.assertIn("ELF", str(ctx.exception))
        safe_remove(csv_path)

    def test_rejects_macho_binary_header_in_csv(self):
        for magic in [b"\xfe\xed\xfa\xce", b"\xfe\xed\xfa\xcf", b"\xca\xfe\xba\xbe"]:
            fd, path = tempfile.mkstemp()
            os.close(fd)
            csv_path = path + ".csv"
            with open(csv_path, "wb") as f:
                f.write(magic + b"\x00" * 100)
            with self.assertRaises(ValidationError) as ctx:
                validate_extension_and_content(csv_path)
            self.assertIn("Mach-O", str(ctx.exception))
            safe_remove(csv_path)

    def test_rejects_shebang_header_in_csv(self):
        fd, path = tempfile.mkstemp()
        os.close(fd)
        csv_path = path + ".csv"
        with open(csv_path, "wb") as f:
            f.write(b"#! /bin/bash\necho hacked")
        with self.assertRaises(ValidationError) as ctx:
            validate_extension_and_content(csv_path)
        self.assertIn("Shebang", str(ctx.exception))
        safe_remove(csv_path)


if __name__ == "__main__":
    unittest.main()
