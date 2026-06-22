"""Unit tests for csv_validator module."""

import os
import sys
import tempfile

import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from validation.csv_validator import (
    ValidationError,
    validate_file_size,
    validate_headers,
    validate_extension_and_content,
)


class TestValidateFileSize:
    def test_passes_for_small_file(self):
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp.write(b"a,b,c\n1,2,3\n")
            tmp_path = tmp.name
        try:
            validate_file_size(tmp_path)
        finally:
            os.remove(tmp_path)

    def test_rejects_missing_file(self):
        with pytest.raises(ValidationError, match="File not found"):
            validate_file_size("/tmp/does_not_exist_12345.csv")

    def test_rejects_oversized_file(self):
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            # Write content larger than MAX_FILE_SIZE (10MB)
            large_content = b"x" * (11 * 1024 * 1024)
            tmp.write(large_content)
            tmp_path = tmp.name
        try:
            with pytest.raises(ValidationError, match="exceeds maximum"):
                validate_file_size(tmp_path)
        finally:
            os.remove(tmp_path)

    def test_respects_custom_max_size(self):
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp.write(b"x" * 100)
            tmp_path = tmp.name
        try:
            # 100 bytes passes with max_size=100
            validate_file_size(tmp_path, max_size=100)
            # 100 bytes fails with max_size=10
            with pytest.raises(ValidationError):
                validate_file_size(tmp_path, max_size=10)
        finally:
            os.remove(tmp_path)


class TestValidateHeaders:
    def test_passes_for_complete_headers(self):
        headers = ["gender", "age", "hypertension", "heart_disease",
                    "smoking_history", "bmi", "HbA1c_level", "blood_glucose_level", "diabetes"]
        validate_headers(headers)

    def test_rejects_missing_required_headers(self):
        headers = ["gender", "age"]
        with pytest.raises(ValidationError, match="Missing required headers"):
            validate_headers(headers)

    def test_allows_extra_headers(self):
        headers = ["gender", "age", "hypertension", "heart_disease",
                    "smoking_history", "bmi", "HbA1c_level", "blood_glucose_level",
                    "diabetes", "extra_column"]
        validate_headers(headers)


class TestValidateExtensionAndContent:
    def test_allows_csv_extension(self):
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
            tmp.write(b"gender,age\nmale,30\n")
            tmp_path = tmp.name
        try:
            validate_extension_and_content(tmp_path)
        finally:
            os.remove(tmp_path)

    def test_allows_txt_extension(self):
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as tmp:
            tmp.write(b"some,text\ndata,here\n")
            tmp_path = tmp.name
        try:
            validate_extension_and_content(tmp_path)
        finally:
            os.remove(tmp_path)

    def test_rejects_xlsx_extension(self):
        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
            tmp.write(b"PK\x03\x04")  # ZIP-based xlsx magic
            tmp_path = tmp.name
        try:
            with pytest.raises(ValidationError, match="Invalid file extension"):
                validate_extension_and_content(tmp_path)
        finally:
            os.remove(tmp_path)

    def test_rejects_mz_pe_header(self):
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
            tmp.write(b"MZ" + b"\x00" * 10)
            tmp_path = tmp.name
        try:
            with pytest.raises(ValidationError, match="PE/MZ executable"):
                validate_extension_and_content(tmp_path)
        finally:
            os.remove(tmp_path)

    def test_rejects_elf_header(self):
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
            tmp.write(b"\x7fELF" + b"\x00" * 10)
            tmp_path = tmp.name
        try:
            with pytest.raises(ValidationError, match="ELF binary"):
                validate_extension_and_content(tmp_path)
        finally:
            os.remove(tmp_path)

    def test_rejects_macho_header(self):
        for magic in [b"\xfe\xed\xfa\xce", b"\xfe\xed\xfa\xcf",
                       b"\xce\xfa\xed\xfe", b"\xcf\xfa\xed\xfe", b"\xca\xfe\xba\xbe"]:
            with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
                tmp.write(magic + b"\x00" * 10)
                tmp_path = tmp.name
            try:
                with pytest.raises(ValidationError, match="Mach-O binary"):
                    validate_extension_and_content(tmp_path)
            finally:
                os.remove(tmp_path)

    def test_rejects_shebang_header(self):
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
            tmp.write(b"#!/bin/bash\necho hello")
            tmp_path = tmp.name
        try:
            with pytest.raises(ValidationError, match="Shebang"):
                validate_extension_and_content(tmp_path)
        finally:
            os.remove(tmp_path)

    def test_rejects_missing_file(self):
        with pytest.raises(ValidationError, match="File not found"):
            validate_extension_and_content("/tmp/does_not_exist_12345.csv")
