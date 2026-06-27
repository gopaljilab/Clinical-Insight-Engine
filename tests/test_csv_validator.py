"""
Unit tests for validation.csv_validator.

Covers:
- validate_file_size: size limits and missing file
- validate_headers: required headers and missing fields
- validate_extension_and_content: valid extensions, binary/script rejection
"""

import os
import tempfile

import pytest

from validation.csv_validator import (
    ValidationError,
    validate_file_size,
    validate_headers,
    validate_extension_and_content,
    MAX_FILE_SIZE,
    REQUIRED_HEADERS,
)


class TestValidateFileSize:
    def test_passes_for_small_file(self, tmp_path):
        f = tmp_path / "small.csv"
        f.write_bytes(b"a,b,c\n1,2,3\n")
        validate_file_size(str(f))

    def test_passes_for_exactly_max_size(self, tmp_path):
        f = tmp_path / "exact.csv"
        f.write_bytes(b"\x00" * MAX_FILE_SIZE)
        validate_file_size(str(f))

    def test_raises_when_file_too_large(self, tmp_path):
        f = tmp_path / "large.csv"
        f.write_bytes(b"\x00" * (MAX_FILE_SIZE + 1))
        with pytest.raises(ValidationError, match="exceeds maximum allowed size"):
            validate_file_size(str(f))

    def test_raises_when_file_not_found(self):
        with pytest.raises(ValidationError, match="File not found"):
            validate_file_size("/nonexistent/path/file.csv")

    def test_custom_max_size(self, tmp_path):
        f = tmp_path / "medium.csv"
        f.write_bytes(b"\x00" * 100)
        validate_file_size(str(f), max_size=200)


class TestValidateHeaders:
    def test_passes_when_all_required_headers_present(self):
        headers = list(REQUIRED_HEADERS)
        validate_headers(headers)

    def test_passes_when_extra_headers_present(self):
        headers = list(REQUIRED_HEADERS) + ["extra_col", "another"]
        validate_headers(headers)

    def test_raises_when_gender_header_missing(self):
        headers = list(REQUIRED_HEADERS - {"gender"})
        with pytest.raises(ValidationError, match="gender"):
            validate_headers(headers)

    def test_raises_when_multiple_headers_missing(self):
        headers = ["patientName", "other"]
        with pytest.raises(ValidationError) as exc_info:
            validate_headers(headers)
        assert "gender" in str(exc_info.value)
        assert "bmi" in str(exc_info.value)

    def test_raises_case_sensitive(self):
        headers = [h if h != "gender" else "Gender" for h in REQUIRED_HEADERS]
        with pytest.raises(ValidationError, match="gender"):
            validate_headers(headers)


class TestValidateExtensionAndContent:
    def test_accepts_csv_extension(self, tmp_path):
        f = tmp_path / "valid.csv"
        f.write_text("a,b\n1,2\n")
        validate_extension_and_content(str(f))

    def test_accepts_txt_extension(self, tmp_path):
        f = tmp_path / "valid.txt"
        f.write_text("hello\n")
        validate_extension_and_content(str(f))

    def test_rejects_xlsx_extension(self, tmp_path):
        f = tmp_path / "invalid.xlsx"
        f.write_bytes(b"PK\x03\x04")
        with pytest.raises(ValidationError, match="Invalid file extension"):
            validate_extension_and_content(str(f))

    def test_rejects_json_extension(self, tmp_path):
        f = tmp_path / "invalid.json"
        f.write_text("{}")
        with pytest.raises(ValidationError, match="Invalid file extension"):
            validate_extension_and_content(str(f))

    def test_rejects_xml_extension(self, tmp_path):
        f = tmp_path / "invalid.xml"
        f.write_text("<root/>")
        with pytest.raises(ValidationError, match="Invalid file extension"):
            validate_extension_and_content(str(f))

    def test_rejects_pe_mz_binary(self, tmp_path):
        f = tmp_path / "data.csv"
        f.write_bytes(b"MZ" + b"\x00" * 100)
        with pytest.raises(ValidationError, match="PE/MZ executable"):
            validate_extension_and_content(str(f))

    def test_rejects_elf_binary(self, tmp_path):
        f = tmp_path / "data.csv"
        f.write_bytes(b"\x7fELF" + b"\x00" * 100)
        with pytest.raises(ValidationError, match="ELF binary"):
            validate_extension_and_content(str(f))

    def test_rejects_macho_binary_le(self, tmp_path):
        f = tmp_path / "data.csv"
        f.write_bytes(b"\xfe\xed\xfa\xce" + b"\x00" * 100)
        with pytest.raises(ValidationError, match="Mach-O binary"):
            validate_extension_and_content(str(f))

    def test_rejects_macho_binary_le_reverse(self, tmp_path):
        f = tmp_path / "data.csv"
        f.write_bytes(b"\xce\xfa\xed\xfe" + b"\x00" * 100)
        with pytest.raises(ValidationError, match="Mach-O binary"):
            validate_extension_and_content(str(f))

    def test_rejects_macho_fat_binary(self, tmp_path):
        f = tmp_path / "data.csv"
        f.write_bytes(b"\xca\xfe\xba\xbe" + b"\x00" * 100)
        with pytest.raises(ValidationError, match="Mach-O binary"):
            validate_extension_and_content(str(f))

    def test_rejects_shebang_script(self, tmp_path):
        f = tmp_path / "data.csv"
        f.write_bytes(b"#!" + b"\x00" * 100)
        with pytest.raises(ValidationError, match="Shebang script"):
            validate_extension_and_content(str(f))

    def test_raises_when_file_not_found(self):
        with pytest.raises(ValidationError, match="File not found"):
            validate_extension_and_content("/nonexistent/file.csv")

    def test_valid_csv_content_passes(self, tmp_path):
        f = tmp_path / "data.csv"
        f.write_bytes(b"gender,age\nMale,45\n")
        validate_extension_and_content(str(f))
