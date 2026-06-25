"""
Unit tests for the CSV validation module.
Tests file-size limits, header enforcement, extension filtering, and
binary/script header rejection for uploaded files.
"""
import os
import sys
import tempfile

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
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"x" * 1024)
            path = f.name
        try:
            validate_file_size(path, max_size=1024 * 1024)
        except ValidationError:
            raise AssertionError("Should not have raised for small file")
        finally:
            os.unlink(path)

    def test_raises_for_oversized_file(self):
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"x" * 1024)
            path = f.name
        try:
            validate_file_size(path, max_size=512)
            raise AssertionError("Should have raised ValidationError")
        except ValidationError as e:
            assert "exceed" in str(e).lower()
        finally:
            os.unlink(path)

    def test_raises_for_missing_file(self):
        try:
            validate_file_size("/nonexistent/path/file.csv")
            raise AssertionError("Should have raised ValidationError")
        except ValidationError as e:
            assert "not found" in str(e).lower()

    def test_uses_default_max_size(self):
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"x" * 1024)
            path = f.name
        try:
            # Default is MAX_FILE_SIZE = 10MB; a small file passes
            validate_file_size(path)
        except ValidationError:
            raise AssertionError("Should not have raised")
        finally:
            os.unlink(path)


class TestValidateHeaders:
    def test_passes_when_all_headers_present(self):
        headers = ["gender", "age", "hypertension", "heart_disease",
                   "smoking_history", "bmi", "HbA1c_level",
                   "blood_glucose_level", "diabetes"]
        validate_headers(headers)  # should not raise

    def test_passes_with_extra_headers(self):
        headers = ["gender", "age", "hypertension", "heart_disease",
                   "smoking_history", "bmi", "HbA1c_level",
                   "blood_glucose_level", "diabetes", "extra_col"]
        validate_headers(headers)  # should not raise

    def test_raises_missing_headers(self):
        headers = ["gender", "age"]  # missing most required
        try:
            validate_headers(headers)
            raise AssertionError("Should have raised ValidationError")
        except ValidationError as e:
            assert "missing" in str(e).lower()
            # Should list at least some of the missing headers
            msg = str(e).lower()
            assert any(h in msg for h in ["hypertension", "heart_disease", "bmi"])

    def test_raises_for_completely_empty_headers(self):
        try:
            validate_headers([])
            raise AssertionError("Should have raised ValidationError")
        except ValidationError:
            pass


class TestValidateExtensionAndContent:
    def test_accepts_csv_extension(self):
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            path = f.name
        try:
            validate_extension_and_content(path)
        except ValidationError:
            raise AssertionError("Should not raise for .csv")
        finally:
            os.unlink(path)

    def test_accepts_txt_extension(self):
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
            path = f.name
        try:
            validate_extension_and_content(path)
        except ValidationError:
            raise AssertionError("Should not raise for .txt")
        finally:
            os.unlink(path)

    def test_rejects_exe_extension(self):
        with tempfile.NamedTemporaryFile(suffix=".exe", delete=False) as f:
            path = f.name
        try:
            validate_extension_and_content(path)
            raise AssertionError("Should have raised ValidationError")
        except ValidationError as e:
            assert "extension" in str(e).lower()
        finally:
            os.unlink(path)

    def test_rejects_sh_extension(self):
        with tempfile.NamedTemporaryFile(suffix=".sh", delete=False) as f:
            path = f.name
        try:
            validate_extension_and_content(path)
            raise AssertionError("Should have raised ValidationError")
        except ValidationError as e:
            assert "extension" in str(e).lower()
        finally:
            os.unlink(path)

    def test_rejects_pe_mz_binary(self):
        # PE/MZ executable magic bytes
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            f.write(b"MZ" + b"\x00" * 100)
            path = f.name
        try:
            validate_extension_and_content(path)
            raise AssertionError("Should have raised ValidationError")
        except ValidationError as e:
            assert "executable" in str(e).lower() or "not allowed" in str(e).lower()
        finally:
            os.unlink(path)

    def test_rejects_elf_binary(self):
        # ELF magic bytes
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            f.write(b"\x7fELF" + b"\x00" * 100)
            path = f.name
        try:
            validate_extension_and_content(path)
            raise AssertionError("Should have raised ValidationError")
        except ValidationError as e:
            assert "not allowed" in str(e).lower()
        finally:
            os.unlink(path)

    def test_rejects_macho_binary(self):
        # Mach-O magic bytes
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            f.write(b"\xfe\xed\xfa\xce" + b"\x00" * 100)
            path = f.name
        try:
            validate_extension_and_content(path)
            raise AssertionError("Should have raised ValidationError")
        except ValidationError as e:
            assert "not allowed" in str(e).lower()
        finally:
            os.unlink(path)

    def test_rejects_shebang_header(self):
        # Shebang header
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            f.write(b"#!/bin/bash\necho hello\n")
            path = f.name
        try:
            validate_extension_and_content(path)
            raise AssertionError("Should have raised ValidationError")
        except ValidationError as e:
            assert "shebang" in str(e).lower() or "not allowed" in str(e).lower()
        finally:
            os.unlink(path)

    def test_accepts_normal_csv_content(self):
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            f.write(b"name,age,city\nAlice,30,NYC\n")
            path = f.name
        try:
            validate_extension_and_content(path)
        except ValidationError:
            raise AssertionError("Should not raise for normal CSV content")
        finally:
            os.unlink(path)

    def test_raises_for_missing_file(self):
        try:
            validate_extension_and_content("/nonexistent/file.csv")
            raise AssertionError("Should have raised ValidationError")
        except ValidationError as e:
            assert "not found" in str(e).lower()
