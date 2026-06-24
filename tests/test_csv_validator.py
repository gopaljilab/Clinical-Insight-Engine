import io
import os
import tempfile

import pytest

from validation.csv_validator import (
    ValidationError,
    validate_extension_and_content,
    validate_file_size,
    validate_headers,
)


class TestValidateFileSize:
    def test_accepts_small_file(self):
        """Files under 10MB pass validation without error."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"x" * 1024)  # 1KB
            f.flush()
            # Should not raise
            validate_file_size(f.name)
            os.unlink(f.name)

    def test_accepts_file_at_limit(self):
        """A file at exactly the 10MB limit passes validation."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            # Write exactly 10MB
            chunk = b"x" * (1024 * 1024)
            for _ in range(10):
                f.write(chunk)
            f.flush()
            validate_file_size(f.name)
            os.unlink(f.name)

    def test_rejects_file_over_limit(self):
        """Files over 10MB raise ValidationError."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            # Write 10MB + 1 byte
            chunk = b"x" * (1024 * 1024)
            for _ in range(10):
                f.write(chunk)
            f.write(b"x")
            f.flush()
            with pytest.raises(ValidationError) as exc_info:
                validate_file_size(f.name)
            assert "10.00MB" in str(exc_info.value)
            os.unlink(f.name)

    def test_raises_for_nonexistent_file(self):
        """validate_file_size raises ValidationError for a missing file."""
        with pytest.raises(ValidationError) as exc_info:
            validate_file_size("/nonexistent/path/to/file.csv")
        assert "not found" in str(exc_info.value)


class TestValidateHeaders:
    def test_accepts_all_required_headers(self):
        """All required headers present: no error raised."""
        headers = [
            "gender", "age", "hypertension", "heart_disease",
            "smoking_history", "bmi", "HbA1c_level",
            "blood_glucose_level", "diabetes",
        ]
        # Should not raise
        validate_headers(headers)

    def test_accepts_extra_headers(self):
        """Extra headers beyond the required set are accepted."""
        headers = [
            "gender", "age", "hypertension", "heart_disease",
            "smoking_history", "bmi", "HbA1c_level",
            "blood_glucose_level", "diabetes", "patient_id", "notes",
        ]
        validate_headers(headers)

    def test_raises_for_missing_headers(self):
        """Missing required headers cause ValidationError listing them."""
        headers = ["gender", "age"]
        with pytest.raises(ValidationError) as exc_info:
            validate_headers(headers)
        err = str(exc_info.value)
        assert "Missing required headers" in err
        assert "hypertension" in err
        assert "heart_disease" in err

    def test_raises_for_empty_headers(self):
        """Empty header list raises ValidationError for all required fields."""
        with pytest.raises(ValidationError) as exc_info:
            validate_headers([])
        assert "Missing required headers" in str(exc_info.value)


class TestValidateExtensionAndContent:
    def test_accepts_csv_extension(self):
        """.csv extension is accepted."""
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            f.write(b"gender,age\nMale,45\n")
            f.flush()
            validate_extension_and_content(f.name)
            os.unlink(f.name)

    def test_accepts_txt_extension(self):
        """.txt extension is accepted."""
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
            f.write(b"gender,age\nFemale,30\n")
            f.flush()
            validate_extension_and_content(f.name)
            os.unlink(f.name)

    def test_case_insensitive_csv(self):
        """.CSV and .CSV are accepted regardless of case."""
        with tempfile.NamedTemporaryFile(suffix=".CSV", delete=False) as f:
            f.write(b"gender,age\nMale,45\n")
            f.flush()
            validate_extension_and_content(f.name)
            os.unlink(f.name)

    def test_rejects_xlsx_extension(self):
        """XLSX files are rejected."""
        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f:
            f.write(b"PK\x03\x04")  # ZIP/XLSX magic
            f.flush()
            with pytest.raises(ValidationError) as exc_info:
                validate_extension_and_content(f.name)
            assert "Invalid file extension" in str(exc_info.value)
            os.unlink(f.name)

    def test_rejects_json_extension(self):
        """JSON files are rejected."""
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            f.write(b'{"key": "value"}')
            f.flush()
            with pytest.raises(ValidationError) as exc_info:
                validate_extension_and_content(f.name)
            assert "Invalid file extension" in str(exc_info.value)
            os.unlink(f.name)

    def test_rejects_pe_mz_binary(self):
        """PE/MZ executable format is rejected by magic byte check."""
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            f.write(b"MZ" + b"\x00" * 100)
            f.flush()
            with pytest.raises(ValidationError) as exc_info:
                validate_extension_and_content(f.name)
            assert "PE/MZ" in str(exc_info.value)
            os.unlink(f.name)

    def test_rejects_elf_binary(self):
        """ELF binary format is rejected by magic byte check."""
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            f.write(b"\x7fELF" + b"\x00" * 100)
            f.flush()
            with pytest.raises(ValidationError) as exc_info:
                validate_extension_and_content(f.name)
            assert "ELF" in str(exc_info.value)
            os.unlink(f.name)

    def test_rejects_macho_binary(self):
        """Mach-O binary format is rejected by magic byte check."""
        for magic in [b"\xfe\xed\xfa\xce", b"\xfe\xed\xfa\xcf", b"\xce\xfa\xed\xfe"]:
            with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
                f.write(magic + b"\x00" * 100)
                f.flush()
                with pytest.raises(ValidationError) as exc_info:
                    validate_extension_and_content(f.name)
                assert "Mach-O" in str(exc_info.value)
                os.unlink(f.name)

    def test_rejects_shebang_script(self):
        """Files starting with a shebang are rejected."""
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            f.write(b"#!/usr/bin/env python3\nprint('hello')\n")
            f.flush()
            with pytest.raises(ValidationError) as exc_info:
                validate_extension_and_content(f.name)
            assert "Shebang" in str(exc_info.value)
            os.unlink(f.name)

    def test_raises_for_nonexistent_file(self):
        """Nonexistent file raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            validate_extension_and_content("/nonexistent/file.csv")
        assert "not found" in str(exc_info.value)
