"""
Unit tests for app/utils/text_sanitizer.py
"""
import pytest
from app.utils.text_sanitizer import (
    decode_bytes,
    normalize_unicode_preserving_sub_super,
    sanitize_text,
    sanitize_data,
)


class TestDecodeBytes:
    def test_valid_utf8(self):
        result = decode_bytes(b"Hello, World!")
        assert result == "Hello, World!"

    def test_utf8_with_bom(self):
        result = decode_bytes(b"\xef\xbb\xbfHello")
        assert result == "Hello"

    def test_fallback_to_cp1252(self):
        # 0x93 is a smart quote in CP1252, not valid UTF-8
        result = decode_bytes(b"\x93Hello\x94", fallback_to_cp1252=True)
        assert "Hello" in result

    def test_fallback_to_latin1(self):
        # 0xe0 is valid in Latin-1
        result = decode_bytes(b"\xe0 Hello", fallback_to_cp1252=False)
        assert "Hello" in result

    def test_invalid_bytes_with_ignore(self):
        # Invalid UTF-8: continuation byte without start byte
        result = decode_bytes(b"Hello\x80World", fallback_to_cp1252=False)
        assert "Hello" in result
        assert "World" in result


class TestNormalizeUnicodePreservingSubSuper:
    def test_preserves_superscript_numbers(self):
        text = "HbA1c 10\u00b9\u00b2"
        result = normalize_unicode_preserving_sub_super(text)
        assert "\u00b9" in result  # superscript 1
        assert "\u00b2" in result  # superscript 2

    def test_preserves_subscript_numbers(self):
        text = "H\u2082O"
        result = normalize_unicode_preserving_sub_super(text)
        assert "\u2082" in result  # subscript 2

    def test_preserves_subscript_letters(self):
        text = "Na\u2091"
        result = normalize_unicode_preserving_sub_super(text)
        assert "\u2091" in result  # subscript e

    def test_normalizes_mixed_content(self):
        text = "HbA1c \u00b9\u00b2 and Na\u2091"
        result = normalize_unicode_preserving_sub_super(text)
        assert "HbA1c" in result
        # superscripts and subscripts are preserved (not converted to digits)
        assert "\u00b9" in result or "\u00b2" in result

    def test_no_subscripts_superscripts_unchanged(self):
        text = "Normal text only."
        result = normalize_unicode_preserving_sub_super(text)
        assert result == "Normal text only."

    def test_empty_string(self):
        result = normalize_unicode_preserving_sub_super("")
        assert result == ""


class TestSanitizeText:
    def test_none_input(self):
        result = sanitize_text(None)
        assert result == ""

    def test_bytes_input_with_valid_utf8(self):
        result = sanitize_text(b"Hello")
        assert result == "Hello"

    def test_bytes_input_with_bom(self):
        result = sanitize_text(b"\xef\xbb\xbfHello")
        assert result == "Hello"

    def test_null_bytes_removed(self):
        result = sanitize_text("Hello\x00World")
        assert "\x00" not in result
        assert "Hello" in result
        assert "World" in result

    def test_control_chars_removed_except_tab_newline(self):
        # bell (0x07), backspace (0x08), form feed (0x0C) should be removed
        text = "Hello\x07World\x08More\x0CMore"
        result = sanitize_text(text)
        assert "\x07" not in result
        assert "\x08" not in result
        assert "\x0C" not in result

    def test_tabs_preserved(self):
        result = sanitize_text("Hello\tWorld")
        assert "\t" in result

    def test_newlines_preserved(self):
        result = sanitize_text("Hello\nWorld")
        assert "\n" in result

    def test_carriage_return_preserved(self):
        result = sanitize_text("Hello\rWorld")
        assert "\r" in result

    def test_smart_quotes_normalized(self):
        result = sanitize_text("\u201cHello\u201d")
        assert result == '"Hello"'

    def test_single_smart_quotes_normalized(self):
        result = sanitize_text("\u2018Hello\u2019")
        assert result == "'Hello'"

    def test_em_dash_normalized(self):
        result = sanitize_text("Hello\u2014World")
        assert result == "Hello-World"

    def test_en_dash_normalized(self):
        result = sanitize_text("Hello\u2013World")
        assert result == "Hello-World"

    def test_non_breaking_space_normalized(self):
        result = sanitize_text("Hello\xa0World")
        assert "\xa0" not in result
        assert " " in result

    def test_zero_width_space_normalized(self):
        result = sanitize_text("Hello\u200bWorld")
        assert "\u200b" not in result

    def test_non_string_non_bytes_converted_to_string(self):
        result = sanitize_text(12345)
        assert result == "12345"

    def test_empty_string(self):
        result = sanitize_text("")
        assert result == ""

    def test_preserves_medical_symbols(self):
        # Degree symbol should be preserved
        # Note: U+00B5 (micro sign) NFKC-normalizes to U+03BC (Greek mu) - both display as mu
        text = "37.5\u00b0C, 10\u00b5g/mL, 95%"
        result = sanitize_text(text)
        assert "\u00b0" in result
        assert "%" in result
        # After NFKC normalization, micro sign becomes Greek mu; both are visually identical mu
        assert "mu" in result.lower() or "\u03bc" in result or "\u00b5" in result


class TestSanitizeData:
    def test_dict_with_strings(self):
        data = {"name": "John\x00Doe", "note": "Hello"}
        result = sanitize_data(data)
        assert "\x00" not in result["name"]
        assert result["name"] == "JohnDoe"
        assert result["note"] == "Hello"

    def test_list_with_mixed_types(self):
        data = ["Hello\x00World", 42, True, None, {"key": "val\x00ue"}]
        result = sanitize_data(data)
        assert result[0] == "HelloWorld"
        assert result[1] == 42
        assert result[2] is True
        assert result[3] is None
        assert "val" in result[4]["key"]

    def test_nested_dict(self):
        data = {
            "outer": {
                "inner": "Test\x00Value",
            }
        }
        result = sanitize_data(data)
        assert "Test" in result["outer"]["inner"]

    def test_string_passthrough(self):
        result = sanitize_data("already a string")
        assert result == "already a string"

    def test_number_passthrough(self):
        result = sanitize_data(3.14159)
        assert result == 3.14159

    def test_none_passthrough(self):
        result = sanitize_data(None)
        assert result is None

    def test_empty_dict(self):
        result = sanitize_data({})
        assert result == {}

    def test_empty_list(self):
        result = sanitize_data([])
        assert result == []

    def test_deeply_nested(self):
        data = [[[{"val": "Test\x00Value"}]]]
        result = sanitize_data(data)
        assert "Test" in result[0][0][0]["val"]
