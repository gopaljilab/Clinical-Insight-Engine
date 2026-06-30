"""
Unit tests for the CSV validation module (validation/csv_validator.py).

Covers: validate_file_size, validate_headers, validate_extension_and_content.
"""
import os
import tempfile
import pytest
import validation.csv_validator as csv_validator


class TestValidateFileSize:
    """Test suite for validate_file_size."""

    def test_under_limit_passes(self):
        fd, path = tempfile.mkstemp(suffix=".csv")
        try:
            os.write(fd, b"gender,age\nMale,45\n")
            os.close(fd)
            # Should not raise
            csv_validator.validate_file_size(path)
        finally:
            os.remove(path)

    def test_at_limit_passes(self):
        fd, path = tempfile.mkstemp(suffix=".csv")
        try:
            # MAX_FILE_SIZE = 10MB; write exactly 10MB
            chunk = b"x" * (1024 * 1024)  # 1MB
            for _ in range(10):
                os.write(fd, chunk)
            os.close(fd)
            csv_validator.validate_file_size(path)
        finally:
            os.remove(path)

    def test_over_limit_raises_validation_error(self):
        fd, path = tempfile.mkstemp(suffix=".csv")
        try:
            # Write 11MB (over the 10MB limit)
            chunk = b"x" * (1024 * 1024)  # 1MB
            for _ in range(11):
                os.write(fd, chunk)
            os.close(fd)
            with pytest.raises(csv_validator.ValidationError, match="exceeds maximum"):
                csv_validator.validate_file_size(path)
        finally:
            os.remove(path)

    def test_nonexistent_file_raises_validation_error(self):
        with pytest.raises(csv_validator.ValidationError, match="File not found"):
            csv_validator.validate_file_size("/nonexistent/path/to/file.csv")

    def test_custom_max_size_override(self):
        fd, path = tempfile.mkstemp(suffix=".csv")
        try:
            # Write 5 bytes
            os.write(fd, b"hello")
            os.close(fd)
            # Should fail with max_size=1 byte
            with pytest.raises(csv_validator.ValidationError, match="exceeds maximum"):
                csv_validator.validate_file_size(path, max_size=1)
        finally:
            os.remove(path)


class TestValidateHeaders:
    """Test suite for validate_headers."""

    def test_all_required_headers_present_passes(self):
        headers = ["gender", "age", "hypertension", "heart_disease",
                   "smoking_history", "bmi", "HbA1c_level",
                   "blood_glucose_level", "diabetes"]
        # Should not raise
        csv_validator.validate_headers(headers)

    def test_all_required_headers_plus_extra_passes(self):
        headers = ["gender", "age", "hypertension", "heart_disease",
                   "smoking_history", "bmi", "HbA1c_level",
                   "blood_glucose_level", "diabetes", "extra_col", "another_col"]
        csv_validator.validate_headers(headers)

    def test_missing_single_header_raises_validation_error(self):
        headers = ["gender", "age", "hypertension", "heart_disease",
                   "smoking_history", "bmi", "blood_glucose_level", "diabetes"]
        # Missing HbA1c_level
        with pytest.raises(csv_validator.ValidationError, match="Missing required headers"):
            csv_validator.validate_headers(headers)

    def test_missing_multiple_headers_raises_validation_error(self):
        headers = ["gender", "age"]
        with pytest.raises(csv_validator.ValidationError, match="Missing required headers"):
            csv_validator.validate_headers(headers)

    def test_empty_headers_raises_validation_error(self):
        with pytest.raises(csv_validator.ValidationError, match="Missing required headers"):
            csv_validator.validate_headers([])

    def test_case_sensitive_header_match(self):
        # Headers must match exactly (case-sensitive)
        headers = ["Gender", "age", "hypertension", "heart_disease",
                   "smoking_history", "bmi", "HbA1c_level",
                   "blood_glucose_level", "diabetes"]
        with pytest.raises(csv_validator.ValidationError, match="Missing required headers"):
            csv_validator.validate_headers(headers)


class TestValidateExtensionAndContent:
    """Test suite for validate_extension_and_content."""

    def test_valid_csv_extension_passes(self):
        fd, path = tempfile.mkstemp(suffix=".csv")
        try:
            os.write(fd, b"gender,age\nMale,45\n")
            os.close(fd)
            csv_validator.validate_extension_and_content(path)
        finally:
            os.remove(path)

    def test_valid_txt_extension_passes(self):
        fd, path = tempfile.mkstemp(suffix=".txt")
        try:
            os.write(fd, b"some text data\n")
            os.close(fd)
            csv_validator.validate_extension_and_content(path)
        finally:
            os.remove(path)

    def test_uppercase_csv_extension_passes(self):
        fd, path = tempfile.mkstemp(suffix=".CSV")
        try:
            os.write(fd, b"gender,age\nMale,45\n")
            os.close(fd)
            csv_validator.validate_extension_and_content(path)
        finally:
            os.remove(path)

    def test_invalid_extension_raises_validation_error(self):
        fd, path = tempfile.mkstemp(suffix=".xlsx")
        try:
            os.write(fd, b"gender,age\nMale,45\n")
            os.close(fd)
            with pytest.raises(csv_validator.ValidationError, match="Invalid file extension"):
                csv_validator.validate_extension_and_content(path)
        finally:
            os.remove(path)

    def test_pe_mz_magic_bytes_rejected(self):
        fd, path = tempfile.mkstemp(suffix=".csv")
        try:
            # MZ header (PE executable)
            os.write(fd, b"MZ" + b"\x00" * 100)
            os.close(fd)
            with pytest.raises(csv_validator.ValidationError, match="PE/MZ executable format is not allowed"):
                csv_validator.validate_extension_and_content(path)
        finally:
            os.remove(path)

    def test_elf_magic_bytes_rejected(self):
        fd, path = tempfile.mkstemp(suffix=".csv")
        try:
            # ELF header
            os.write(fd, b"\x7fELF" + b"\x00" * 100)
            os.close(fd)
            with pytest.raises(csv_validator.ValidationError, match="ELF binary format is not allowed"):
                csv_validator.validate_extension_and_content(path)
        finally:
            os.remove(path)

    def test_macho_magic_bytes_rejected(self):
        fd, path = tempfile.mkstemp(suffix=".csv")
        try:
            # Mach-O x86_64 header
            os.write(fd, b"\xfe\xed\xfa\xcf" + b"\x00" * 100)
            os.close(fd)
            with pytest.raises(csv_validator.ValidationError, match="Mach-O binary format is not allowed"):
                csv_validator.validate_extension_and_content(path)
        finally:
            os.remove(path)

    def test_shebang_header_rejected(self):
        fd, path = tempfile.mkstemp(suffix=".csv")
        try:
            os.write(fd, b"#! /usr/bin/env python\n" + b"x" * 50)
            os.close(fd)
            with pytest.raises(csv_validator.ValidationError, match="Shebang script headers are not allowed"):
                csv_validator.validate_extension_and_content(path)
        finally:
            os.remove(path)

    def test_nonexistent_file_raises_validation_error(self):
        with pytest.raises(csv_validator.ValidationError, match="File not found"):
            csv_validator.validate_extension_and_content("/nonexistent/file.csv")
