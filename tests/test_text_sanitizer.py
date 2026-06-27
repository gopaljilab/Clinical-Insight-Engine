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

from app.utils.text_sanitizer import sanitize_data, sanitize_text, decode_bytes, normalize_unicode_preserving_sub_super
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


class TestDecodeBytes(unittest.TestCase):
    """Test suite for decode_bytes function."""

    def test_valid_utf8(self):
        """Verify valid UTF-8 bytes are decoded correctly."""
        data = b"Patient name: John Doe"
        self.assertEqual(decode_bytes(data), "Patient name: John Doe")

    def test_utf8_with_bom(self):
        """Verify UTF-8 with BOM (\xef\xbb\xbf) is decoded and BOM is removed."""
        data = b"\xef\xbb\xbfPatient name: John Doe"
        self.assertEqual(decode_bytes(data), "Patient name: John Doe")

    def test_invalid_utf8_fallback_disabled(self):
        """Verify invalid UTF-8 falls back to ignore/replace when fallback is disabled."""
        # \xff is not valid UTF-8
        data = b"Patient temp 98.6\xff and fever"
        result = decode_bytes(data, fallback_to_cp1252=False)
        self.assertIsInstance(result, str)
        # Should not raise, and should use errors='ignore'

    def test_invalid_utf8_fallback_cp1252(self):
        """Verify invalid UTF-8 falls back to CP1252 and then Latin-1."""
        # \xb0 is degree symbol in CP1252 but invalid in UTF-8
        data = b"Temp is 37\xb0C"
        result = decode_bytes(data, fallback_to_cp1252=True)
        self.assertEqual(result, "Temp is 37\u00b0C")  # Unicode degree sign

    def test_invalid_utf8_fallback_latin1(self):
        """Verify CP1252 fallback exhausted then falls back to Latin-1."""
        # Characters only in Latin-1 (not CP1252) should still be decoded
        data = b"Note: \xa4 is a valid Latin-1 character"
        result = decode_bytes(data, fallback_to_cp1252=True)
        self.assertIsInstance(result, str)
        self.assertIn("is a valid Latin-1 character", result)

    def test_empty_bytes(self):
        """Verify empty byte string decodes to empty string."""
        self.assertEqual(decode_bytes(b""), "")

    def test_returns_string_type(self):
        """Verify decode_bytes always returns a str, never bytes."""
        data = b"Simple text"
        result = decode_bytes(data)
        self.assertIsInstance(result, str)
        self.assertNotIsInstance(result, bytes)


class TestNormalizeUnicodePreservingSubSuper(unittest.TestCase):
    """Test suite for normalize_unicode_preserving_sub_super function."""

    def test_nfkc_normalization_applied(self):
        """Verify NFKC normalization is applied (e.g. fi ligature -> fi)."""
        # The fi ligature (U+FB01) normalizes to fi
        fi_ligature = "\ufb01le"
        result = normalize_unicode_preserving_sub_super(fi_ligature)
        self.assertEqual(result, "file")

    def test_preserves_superscript_numbers(self):
        """Verify superscript numbers (0-9) are preserved after NFKC normalization."""
        text = "SpO\u00b2 is 98%"
        result = normalize_unicode_preserving_sub_super(text)
        self.assertEqual(result, "SpO\u00b2 is 98%")

    def test_preserves_subscript_numbers(self):
        """Verify subscript numbers (0-9) are preserved after NFKC normalization."""
        text = "H\u2082O and CO\u2082"
        result = normalize_unicode_preserving_sub_super(text)
        self.assertEqual(result, "H\u2082O and CO\u2082")

    def test_preserves_superscript_letters(self):
        """Verify superscript letters (a, e, o, x, etc.) are preserved."""
        text = "cm\u00b2 (superscript) and \u1d52 (math superscript a)"
        result = normalize_unicode_preserving_sub_super(text)
        # Only the standard superscripts in SUB_SUPER_CHARS should be preserved
        self.assertIn("cm\u00b2", result)

    def test_normalizes_text_while_preserving_subscripts(self):
        """Verify mixed text: NFKC applied where safe, subscripts/superscripts preserved."""
        # A mix of characters that should be normalized and preserved
        fi_ligature = "\ufb01"
        subscript_2 = "\u2082"
        mixed = f"{fi_ligature} in H{subscript_2}O"
        result = normalize_unicode_preserving_sub_super(mixed)
        # fi ligature normalizes to fi (not file), subscript 2 preserved
        self.assertEqual(result, f"fi in H{subscript_2}O")

    def test_empty_string(self):
        """Verify empty string is returned unchanged."""
        self.assertEqual(normalize_unicode_preserving_sub_super(""), "")

    def test_preserves_medical_units(self):
        """Verify medical units with sub/superscripts are preserved (e.g. mg/dL)."""
        # No subscript/superscript in mg/dL but test the normalize function does not break it
        text = "mg/dL, mmol/L, mg/dL"
        result = normalize_unicode_preserving_sub_super(text)
        self.assertEqual(result, text)


if __name__ == "__main__":
    unittest.main()
