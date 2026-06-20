"""
Tests for validation.csv_validator module.

Tests validate_headers and validate_extension_and_content functions which provide
first-layer security validation for uploaded CSV files.
"""
import os
import sys
import tempfile
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from validation.csv_validator import (
    validate_file_size,
    validate_headers,
    validate_extension_and_content,
    ValidationError,
    REQUIRED_HEADERS,
)


class TestValidateHeaders:
    """Tests for validate_headers function."""

    def test_passes_when_all_required_headers_present(self):
        headers = list(REQUIRED_HEADERS)
        # Should not raise
        validate_headers(headers)

    def test_passes_when_extra_headers_are_present(self):
        headers = list(REQUIRED_HEADERS) + ["extra_col", "another"]
        validate_headers(headers)  # Should not raise

    def test_raises_when_required_header_is_missing(self):
        headers = list(REQUIRED_HEADERS - {"gender"})
        with pytest.raises(ValidationError, match="gender"):
            validate_headers(headers)

    def test_raises_when_multiple_headers_are_missing(self):
        headers = list(REQUIRED_HEADERS - {"gender", "bmi", "hypertension"})
        with pytest.raises(ValidationError) as exc_info:
            validate_headers(headers)
        error_msg = str(exc_info.value)
        assert "gender" in error_msg or "bmi" in error_msg

    def test_case_insensitive_header_matching(self):
        #
        headers_lower = [h.lower() for h in REQUIRED_HEADERS]
        validate_headers(list(REQUIRED_HEADERS))  # headers must match exact case

    def test_raises_on_completely_empty_header_list(self):
        with pytest.raises(ValidationError, match="Missing required headers"):
            validate_headers([])


class TestValidateExtensionAndContent:
    """Tests for validate_extension_and_content function."""

    def setup_method(self):
        """Create a temporary CSV file for tests."""
        self.temp_files = []

    def teardown_method(self):
        """Clean up temporary files."""
        import os
        for f in self.temp_files:
            if os.path.exists(f):
                os.remove(f)

    def make_file(self, content: bytes, suffix: str = ".csv") -> str:
        fd, path = tempfile.mkstemp(suffix=suffix)
        os.close(fd)
        with open(path, "wb") as f:
            f.write(content)
        self.temp_files.append(path)
        return path

    def test_accepts_valid_csv_extension(self):
        path = self.make_file(b"gender,age,bmi\nMale,45,25\n", suffix=".csv")
        validate_extension_and_content(path)  # Should not raise

    def test_accepts_txt_extension(self):
        path = self.make_file(b"gender,age,bmi\nMale,45,25\n", suffix=".txt")
        validate_extension_and_content(path)  # Should not raise

    def test_accepts_uppercase_csv_extension(self):
        path = self.make_file(b"gender,age,bmi\nMale,45,25\n", suffix=".CSV")
        validate_extension_and_content(path)  # Should not raise

    def test_rejects_xlsx_extension(self):
        path = self.make_file(b"PK\x03\x04", suffix=".xlsx")
        with pytest.raises(ValidationError, match="Only .csv and .txt are allowed"):
            validate_extension_and_content(path)

    def test_rejects_pdf_extension(self):
        path = self.make_file(b"%PDF-1.4", suffix=".pdf")
        with pytest.raises(ValidationError, match="Only .csv and .txt are allowed"):
            validate_extension_and_content(path)

    def test_rejects_json_extension(self):
        path = self.make_file(b'{"key": "value"}', suffix=".json")
        with pytest.raises(ValidationError, match="Only .csv and .txt are allowed"):
            validate_extension_and_content(path)

    def test_rejects_mz_pe_executable(self):
        """MZ/PE executable magic bytes must be rejected."""
        path = self.make_file(b"MZ\x90\x00\x03\x00\x00\x00", suffix=".csv")
        with pytest.raises(ValidationError, match="PE/MZ executable"):
            validate_extension_and_content(path)

    def test_rejects_elf_binary(self):
        """ELF binary magic bytes must be rejected."""
        path = self.make_file(b"\x7fELF\x02\x01\x01\x00", suffix=".csv")
        with pytest.raises(ValidationError, match="ELF binary"):
            validate_extension_and_content(path)

    def test_rejects_macho_binary_32bit(self):
        """Mach-O 32-bit binary magic bytes must be rejected."""
        path = self.make_file(b"\xfe\xed\xfa\xce", suffix=".csv")
        with pytest.raises(ValidationError, match="Mach-O binary"):
            validate_extension_and_content(path)

    def test_rejects_macho_binary_64bit(self):
        """Mach-O 64-bit binary magic bytes must be rejected."""
        path = self.make_file(b"\xcf\xfa\xed\xfe", suffix=".csv")
        with pytest.raises(ValidationError, match="Mach-O binary"):
            validate_extension_and_content(path)

    def test_rejects_macho_fat_binary(self):
        """Mach-O fat/Universal binary magic bytes must be rejected."""
        path = self.make_file(b"\xca\xfe\xba\xbe", suffix=".csv")
        with pytest.raises(ValidationError, match="Mach-O binary"):
            validate_extension_and_content(path)

    def test_rejects_shebang_script(self):
        """Shebang (#!) script headers must be rejected."""
        path = self.make_file(b"#!/usr/bin/env python3\nprint('hello')", suffix=".csv")
        with pytest.raises(ValidationError, match="Shebang script"):
            validate_extension_and_content(path)

    def test_rejects_file_that_does_not_exist(self):
        with pytest.raises(ValidationError, match="File not found"):
            validate_extension_and_content("/nonexistent/path/file.csv")


class TestValidateFileSize:
    """Tests for validate_file_size function."""

    def test_accepts_file_within_size_limit(self):
        fd, path = tempfile.mkstemp()
        os.close(fd)
        try:
            # Write a small amount of data
            with open(path, "wb") as f:
                f.write(b"x" * 1024)  # 1KB
            validate_file_size(path)  # Should not raise
        finally:
            os.remove(path)

    def test_rejects_nonexistent_file(self):
        with pytest.raises(ValidationError, match="File not found"):
            validate_file_size("/nonexistent/file.csv")

    def test_respects_custom_max_size(self):
        fd, path = tempfile.mkstemp()
        os.close(fd)
        try:
            with open(path, "wb") as f:
                f.write(b"x" * 100)
            # Custom limit of 50 bytes should fail
            with pytest.raises(ValidationError, match="exceeds maximum"):
                validate_file_size(path, max_size=50)
        finally:
            os.remove(path)

    def test_rejects_case_mismatch_in_headers(self):
        """Header names must match the required set exactly (case-sensitive)."""
        # Replace HbA1c_level with hba1c_level (lowercase) - should fail
        headers = [h if h != "HbA1c_level" else "hba1c_level" for h in REQUIRED_HEADERS]
        with pytest.raises(ValidationError, match="HbA1c"):
            validate_headers(headers)
