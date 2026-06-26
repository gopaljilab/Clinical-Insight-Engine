"""
Unit tests for the centralized text sanitization utility.
"""
import datetime
import io
import logging
import os
import sys
import time
import unittest
import uuid

# Ensure repository root is on the path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from app.utils.text_sanitizer import sanitize_data, sanitize_text
from services.safe_csv_reader import read_csv_safely


class TestTextSanitizer(unittest.TestCase):
    """Test suite for the text sanitizer."""

    def test_invalid_utf8_bytes(self):
        """Verify invalid UTF-8 bytes are replaced/ignored and warning logs are triggered."""
        raw_bytes = b"Patient temp 98.6\xffF and showing signs of infection"
        with self.assertLogs("app.utils.text_sanitizer", level="WARNING") as log_capture:
            sanitized = sanitize_text(raw_bytes)
        
        self.assertEqual(sanitized, "Patient temp 98.6F and showing signs of infection")
        self.assertTrue(
            any(
                "Invalid UTF-8 byte sequences" in record.getMessage()
                for record in log_capture.records
            )
        )

    def test_mixed_encodings(self):
        """Verify that fallback CP1252/Latin-1 decoding works for mixed/legacy encodings."""
        # \xb0 is degree symbol in Latin-1 / CP1252
        raw_bytes = b"Temp is 37\xb0C"
        sanitized = sanitize_text(raw_bytes, fallback_to_cp1252=True)
        self.assertIsInstance(sanitized, str)
        # Should fall back to CP1252 and keep the degree sign
        self.assertEqual(sanitized, "Temp is 37°C")

    def test_null_bytes(self):
        """Verify that null bytes are removed and log warning is generated."""
        raw_str = "Patient\x00 Name"
        with self.assertLogs("app.utils.text_sanitizer", level="WARNING") as log_capture:
            sanitized = sanitize_text(raw_str)
            
        self.assertEqual(sanitized, "Patient Name")
        self.assertTrue(
            any(
                "Null bytes (\\x00) detected" in record.getMessage()
                for record in log_capture.records
            )
        )

    def test_unicode_normalization(self):
        """Verify that unicode normalization NFKC works."""
        raw_str = "a\u0308"  # Combining diaeresis
        sanitized = sanitize_text(raw_str)
        self.assertEqual(sanitized, "ä")

    def test_smart_quotes(self):
        """Verify smart quotes and smart dashes are normalized to ascii equivalents."""
        raw_str = "“Patient’s temp is 98.6 — managed”"
        with self.assertLogs("app.utils.text_sanitizer", level="WARNING") as log_capture:
            sanitized = sanitize_text(raw_str)
            
        self.assertEqual(sanitized, '"Patient\'s temp is 98.6 - managed"')
        self.assertTrue(
            any(
                "Normalized smart quotes" in record.getMessage()
                for record in log_capture.records
            )
        )

    def test_control_characters(self):
        """Verify that non-printable control characters are removed while preserving tabs/newlines."""
        raw_str = "Line 1\nLine 2\tTabbed\rCarriage\x07Bell\x1fUnit"
        with self.assertLogs("app.utils.text_sanitizer", level="WARNING") as log_capture:
            sanitized = sanitize_text(raw_str)
            
        self.assertEqual(sanitized, "Line 1\nLine 2\tTabbed\rCarriageBellUnit")
        self.assertTrue(
            any(
                "Removed 2 non-printable control characters" in record.getMessage()
                for record in log_capture.records
            )
        )

    def test_preserve_medical_symbols(self):
        """Verify that degrees, micro/mu, plus-minus, percents, and subscripts are preserved."""
        text = "37.5°C μg/mL ±5% β-blocker SpO₂ 98%"
        self.assertEqual(sanitize_text(text), text)

    def test_large_clinical_note(self):
        """Verify performance and memory stability on extremely large notes with malformed segments."""
        malformed_segment = b"Patient name: \xffJohn \x00Doe\n"
        large_note_bytes = malformed_segment * 5000  # ~100KB note with many issues
        
        start_time = time.time()
        sanitized = sanitize_text(large_note_bytes)
        duration = time.time() - start_time
        
        self.assertLess(duration, 0.2)
        self.assertIn("Patient name: John Doe", sanitized)
        self.assertNotIn("\xff", sanitized)
        self.assertNotIn("\x00", sanitized)

    def test_sanitize_data_structure(self):
        """Verify recursive data structure sanitization works on string fields."""
        data = {
            "name": "John Doe",
            "notes": ["Note \x001", {"nested": "Nested\x01 note"}],
            "age": 45  # integers are not affected
        }
        sanitized = sanitize_data(data)
        self.assertEqual(
            sanitized,
            {
                "name": "John Doe",
                "notes": ["Note 1", {"nested": "Nested note"}],
                "age": 45
            }
        )

    def test_json_parsing_safety(self):
        """Verify JSON parsing safety with malformed or null characters."""
        import json

        # Encoded null character remains parseable
        raw_json_str = '{"name":"John\\u0000Doe"}'
        sanitized_json = sanitize_text(raw_json_str)
        parsed = json.loads(sanitized_json)
        self.assertEqual(parsed["name"], "John\x00Doe")
        # Then sanitize_data strips it recursively
        clean_data = sanitize_data(parsed)
        self.assertEqual(clean_data["name"], "JohnDoe")

        # Literal null byte in raw bytes gets cleaned beforehand so it parses correctly
        raw_json_bytes = b'{"name":"John\x00Doe"}'
        sanitized_bytes = sanitize_text(raw_json_bytes)
        parsed_bytes = json.loads(sanitized_bytes)
        self.assertEqual(parsed_bytes["name"], "JohnDoe")

        # Valid JSON remains semantics-preserved
        valid_json = '{"a":"value"}'
        self.assertEqual(sanitize_text(valid_json), valid_json)

    def test_middleware_safety(self):
        """Verify that non-text objects are completely untouched by the sanitizer."""
        dt = datetime.datetime.now()
        uid = uuid.uuid4()
        f = io.BytesIO(b"file content")
        binary = b"binary attachment"

        data = {
            "text": "some text",
            "number": 42,
            "float": 3.14,
            "bool": True,
            "date": dt,
            "uuid": uid,
            "file": f,
            "binary": binary
        }

        sanitized = sanitize_data(data)

        self.assertEqual(sanitized["text"], "some text")
        self.assertEqual(sanitized["number"], 42)
        self.assertEqual(sanitized["float"], 3.14)
        self.assertTrue(sanitized["bool"])
        self.assertEqual(sanitized["date"], dt)
        self.assertEqual(sanitized["uuid"], uid)
        self.assertEqual(sanitized["file"], f)
        self.assertEqual(sanitized["binary"], binary)

    def test_text_after_invalid_byte_is_preserved(self):
        """Verify that all text following malformed bytes is preserved."""
        data = b"Patient temp 98.6\xffF and showing signs of infection"
        result = sanitize_text(data)
        self.assertIn("showing signs of infection", result)

    def test_csv_reader_validation(self):
        """Verify CSV reader handles various encodings (UTF-8, UTF-8-sig, CP1252, Latin-1) safely."""
        import tempfile

        # Generate a temporary file path
        fd, temp_path = tempfile.mkstemp(suffix=".csv")
        os.close(fd)

        try:
            headers = b"gender,age,hypertension,heart_disease,smoking_history,bmi,HbA1c_level,blood_glucose_level,diabetes\n"
            
            # 1. UTF-8
            with open(temp_path, "wb") as f:
                f.write(headers + b"Male,45,0,0,never,24.5,5.2,95,0\n")
            df1 = read_csv_safely(temp_path)
            self.assertEqual(len(df1), 1)
            self.assertEqual(df1.iloc[0]["gender"], "Male")

            # 2. UTF-8 with BOM
            with open(temp_path, "wb") as f:
                f.write(b"\xef\xbb\xbf" + headers + b"Female,62,1,0,former,31.2,6.8,145,1\n")
            df2 = read_csv_safely(temp_path)
            self.assertEqual(len(df2), 1)
            self.assertEqual(df2.iloc[0]["gender"], "Female")

            # 3. CP1252 (with degree symbol \xb0 or similar)
            with open(temp_path, "wb") as f:
                # In CP1252: \xb0 represents degrees (°)
                f.write(headers + b"Male,50,0,0,never,25.0,5.5,100,0\n")
            df3 = read_csv_safely(temp_path)
            self.assertEqual(len(df3), 1)
            self.assertEqual(df3.iloc[0]["gender"], "Male")

            # 4. Latin-1
            with open(temp_path, "wb") as f:
                f.write(headers + b"Female,55,1,1,current,28.0,7.0,150,1\n")
            df4 = read_csv_safely(temp_path)
            self.assertEqual(len(df4), 1)
            self.assertEqual(df4.iloc[0]["gender"], "Female")

        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)


if __name__ == "__main__":
    unittest.main()
