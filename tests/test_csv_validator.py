"""
Unit tests for validation.csv_validator functions.
"""
import os
import sys
import unittest
import tempfile

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from validation.csv_validator import (
    validate_file_size,
    validate_headers,
    validate_extension_and_content,
    ValidationError,
    REQUIRED_HEADERS,
)


class TestValidateFileSize(unittest.TestCase):
    """Tests for validate_file_size."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _make_file(self, name, content=b"", size=None):
        path = os.path.join(self.temp_dir, name)
        if size is not None:
            with open(path, "wb") as f:
                f.write(b"x" * size)
        elif content:
            with open(path, "wb") as f:
                f.write(content)
        else:
            with open(path, "w") as f:
                f.write("")
        return path

    def test_file_within_default_limit(self):
        path = self._make_file("small.csv", size=1024)
        # Should not raise
        validate_file_size(path)

    def test_file_exceeding_default_10mb_limit(self):
        path = self._make_file("large.csv", size=11 * 1024 * 1024)
        with self.assertRaises(ValidationError) as ctx:
            validate_file_size(path)
        self.assertIn("exceeds maximum", str(ctx.exception))

    def test_file_exceeding_custom_size_limit(self):
        path = self._make_file("medium.csv", size=201)
        with self.assertRaises(ValidationError) as ctx:
            validate_file_size(path, max_size=200)
        self.assertIn("exceeds maximum", str(ctx.exception))

    def test_file_not_found(self):
        path = os.path.join(self.temp_dir, "does_not_exist.csv")
        with self.assertRaises(ValidationError) as ctx:
            validate_file_size(path)
        self.assertIn("not found", str(ctx.exception))

    def test_file_at_exactly_max_size_is_allowed(self):
        path = self._make_file("exact.csv", size=200)
        validate_file_size(path, max_size=200)


class TestValidateHeaders(unittest.TestCase):
    """Tests for validate_headers."""

    def test_all_required_headers_present(self):
        headers = list(REQUIRED_HEADERS)
        # Should not raise
        validate_headers(headers)

    def test_extra_headers_allowed(self):
        headers = list(REQUIRED_HEADERS) + ["extra_col", "another"]
        validate_headers(headers)

    def test_missing_single_header(self):
        headers = [h for h in REQUIRED_HEADERS if h != "bmi"] + ["bmiX"]
        with self.assertRaises(ValidationError) as ctx:
            validate_headers(headers)
        self.assertIn("Missing required headers", str(ctx.exception))
        self.assertIn("bmi", str(ctx.exception))

    def test_missing_multiple_headers(self):
        headers = ["gender", "age"]
        with self.assertRaises(ValidationError) as ctx:
            validate_headers(headers)
        self.assertIn("Missing required headers", str(ctx.exception))

    def test_empty_header_list(self):
        with self.assertRaises(ValidationError) as ctx:
            validate_headers([])
        self.assertIn("Missing required headers", str(ctx.exception))


class TestValidateExtensionAndContent(unittest.TestCase):
    """Tests for validate_extension_and_content."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _write_binary(self, name, data):
        path = os.path.join(self.temp_dir, name)
        with open(path, "wb") as f:
            f.write(data)
        return path

    def test_valid_csv_extension(self):
        path = self._write_binary("test.csv", b"gender,age\n")
        validate_extension_and_content(path)  # no raise

    def test_valid_txt_extension(self):
        path = self._write_binary("test.txt", b"some data\n")
        validate_extension_and_content(path)  # no raise

    def test_uppercase_csv_extension(self):
        path = self._write_binary("test.CSV", b"gender,age\n")
        validate_extension_and_content(path)  # no raise

    def test_invalid_xlsx_extension(self):
        path = self._write_binary("test.xlsx", b"PK\x03\x04")
        with self.assertRaises(ValidationError) as ctx:
            validate_extension_and_content(path)
        self.assertIn("Invalid file extension", str(ctx.exception))

    def test_invalid_json_extension(self):
        path = self._write_binary("test.json", b"{}")
        with self.assertRaises(ValidationError) as ctx:
            validate_extension_and_content(path)
        self.assertIn("Invalid file extension", str(ctx.exception))

    def test_mz_pe_executable_header_rejected(self):
        # Use .csv extension so the content check is reached (extension is valid)
        path = self._write_binary("malware.csv", b"MZ" + b"\x00" * 100)
        with self.assertRaises(ValidationError) as ctx:
            validate_extension_and_content(path)
        self.assertIn("PE/MZ executable format", str(ctx.exception))

    def test_elf_binary_header_rejected(self):
        path = self._write_binary("binary.csv", b"\x7fELF" + b"\x00" * 100)
        with self.assertRaises(ValidationError) as ctx:
            validate_extension_and_content(path)
        self.assertIn("ELF binary format", str(ctx.exception))

    def test_macho_64_header_rejected(self):
        path = self._write_binary("macho.csv", b"\xfe\xed\xfa\xcf" + b"\x00" * 100)
        with self.assertRaises(ValidationError) as ctx:
            validate_extension_and_content(path)
        self.assertIn("Mach-O binary format", str(ctx.exception))

    def test_macho_fat_header_rejected(self):
        path = self._write_binary("fat_macho.csv", b"\xca\xfe\xba\xbe" + b"\x00" * 100)
        with self.assertRaises(ValidationError) as ctx:
            validate_extension_and_content(path)
        self.assertIn("Mach-O binary format", str(ctx.exception))

    def test_shebang_header_rejected(self):
        # Shebang followed by NUL means binary content, not an actual shebang
        path = self._write_binary("script.csv", b"#!" + b"\x00" * 100)
        with self.assertRaises(ValidationError) as ctx:
            validate_extension_and_content(path)
        self.assertIn("Shebang script headers", str(ctx.exception))

    def test_file_not_found(self):
        path = os.path.join(self.temp_dir, "ghost.csv")
        with self.assertRaises(ValidationError) as ctx:
            validate_extension_and_content(path)
        self.assertIn("not found", str(ctx.exception))

    def test_valid_csv_content_allowed(self):
        path = self._write_binary("data.csv", b"gender,age,hypertension\nFemale,30,0\n")
        validate_extension_and_content(path)  # no raise

    def test_unicode_content_allowed(self):
        path = self._write_binary("unicode.csv", "\u4e2d\u6587,\u540d\u5b57\n".encode("utf-8"))
        validate_extension_and_content(path)  # no raise


if __name__ == "__main__":
    unittest.main()
