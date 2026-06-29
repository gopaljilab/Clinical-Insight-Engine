"""
Tests for app/utils/text_sanitizer.py
"""
import pytest
from app.utils.text_sanitizer import (
    sanitize_text,
    sanitize_data,
    normalize_unicode_preserving_sub_super,
    decode_bytes,
)


class TestDecodeBytes:
    def test_valid_utf8_bytes(self):
        result = decode_bytes(b"hello world")
        assert result == "hello world"

    def test_utf8_with_bom(self):
        result = decode_bytes(b"\xef\xbb\xbfhello")
        assert result == "hello"

    def test_invalid_utf8_with_fallback(self):
        result = decode_bytes(b"hello \x80 world", fallback_to_cp1252=False)
        assert "hello" in result

    def test_invalid_utf8_with_cp1252_fallback(self):
        result = decode_bytes(b"caf\xe9", fallback_to_cp1252=True)
        assert "caf" in result


class TestNormalizeUnicodePreservingSubSuper:
    def test_normalizes_composed_chars(self):
        # NFKC normalizes composed characters (result contains e or e-acute)
        result = normalize_unicode_preserving_sub_super("caf\xe9")
        assert result and len(result) > 0

    def test_preserves_superscripts(self):
        result = normalize_unicode_preserving_sub_super("x\u00b2 + y\u00b2")
        assert "\u00b2" in result

    def test_preserves_subscripts(self):
        result = normalize_unicode_preserving_sub_super("H\u2082O")
        assert "\u2082" in result


class TestSanitizeText:
    def test_passthrough_plain_string(self):
        result = sanitize_text("hello world")
        assert result == "hello world"

    def test_null_bytes_removed(self):
        result = sanitize_text("hello\x00world")
        assert "\x00" not in result
        assert "helloworld" == result

    def test_tabs_and_newlines_preserved(self):
        result = sanitize_text("line1\n\tline2\r\n")
        assert "\n" in result
        assert "\t" in result

    def test_non_printable_control_removed(self):
        result = sanitize_text("hello\x07world")
        assert "\x07" not in result

    def test_smart_quotes_normalized(self):
        result = sanitize_text("\u201chello\u201d \u2018world\u2019")
        assert "\u201c" not in result
        assert '"' in result

    def test_smart_dashes_normalized(self):
        result = sanitize_text("hello\u2013world\u2014end")
        assert "\u2013" not in result
        assert "\u2014" not in result
        assert result == "hello-world-end"

    def test_non_breaking_space_normalized(self):
        result = sanitize_text("hello\xa0world")
        assert "\xa0" not in result
        assert " " in result

    def test_zero_width_space_removed(self):
        result = sanitize_text("hello\u200bworld")
        assert "\u200b" not in result

    def test_nfkc_normalization_with_subscripts(self):
        result = sanitize_text("H\u2082SO\u2084")
        assert "\u2082" in result
        assert "\u2084" in result

    def test_bytes_input_converted(self):
        result = sanitize_text(b"hello world")
        assert result == "hello world"

    def test_none_input_returns_empty(self):
        result = sanitize_text(None)
        assert result == ""

    def test_non_string_converted(self):
        result = sanitize_text(12345)
        assert result == "12345"


class TestSanitizeData:
    def test_dict_recursive_traversal(self):
        data = {
            "name": "John\x00Doe",
            "bio": "\u201cEngineer\u201d",
        }
        result = sanitize_data(data)
        assert "\x00" not in result["name"]
        assert "\u201c" not in result["bio"]

    def test_list_recursive_traversal(self):
        data = ["hello\n", "\x00world", "normal"]
        result = sanitize_data(data)
        assert "\x00" not in result[1]
        assert "normal" == result[2]

    def test_nested_dict_and_list(self):
        data = {
            "patients": [
                {"name": "Jane\u2013Doe"},
                {"notes": "ok\x00here"},
            ]
        }
        result = sanitize_data(data)
        assert "\u2013" not in result["patients"][0]["name"]
        assert "\x00" not in result["patients"][1]["notes"]

    def test_non_text_values_untouched(self):
        data = {"count": 42, "active": True, "rate": 3.14}
        result = sanitize_data(data)
        assert result["count"] == 42
        assert result["active"] is True
        assert result["rate"] == 3.14
