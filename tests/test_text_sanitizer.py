import pytest
import sys
sys.path.insert(0, '.')
from app.utils.text_sanitizer import (
    decode_bytes,
    normalize_unicode_preserving_sub_super,
    sanitize_text,
    sanitize_data,
)


class TestDecodeBytes:
    def test_valid_utf8(self):
        result = decode_bytes(b"hello world")
        assert result == "hello world"

    def test_utf8_with_bom(self):
        result = decode_bytes(b"\xef\xbb\xbfhello")
        assert result == "hello"

    def test_invalid_utf8_with_cp1252_fallback(self):
        # Pound sign encoded in CP1252
        result = decode_bytes(b"\xa3", fallback_to_cp1252=True)
        assert result == "\xa3"

    def test_invalid_utf8_with_latin1_fallback(self):
        result = decode_bytes(b"\xff", fallback_to_cp1252=True)
        assert result == "\xff"

    def test_invalid_utf8_ignore_mode(self):
        # errors="ignore" silently drops invalid byte sequences
        result = decode_bytes(b"\x80\x81", fallback_to_cp1252=False)
        assert result == ""


class TestNormalizeUnicodePreservingSubSuper:
    def test_nfkc_normalization(self):
        # Full-width A -> regular A
        result = normalize_unicode_preserving_sub_super("\uff21")
        assert result == "A"

    def test_preserves_superscripts(self):
        # Superscript 2 should be preserved
        result = normalize_unicode_preserving_sub_super("\u00b2")
        assert result == "\u00b2"

    def test_preserves_subscripts(self):
        # Subscript 2 should be preserved
        result = normalize_unicode_preserving_sub_super("\u2082")
        assert result == "\u2082"

    def test_mixed_normalization_and_preservation(self):
        result = normalize_unicode_preserving_sub_super("\uff21\u00b2")
        assert result == "A\u00b2"


class TestSanitizeText:
    def test_none_returns_empty_string(self):
        result = sanitize_text(None)
        assert result == ""

    def test_removes_null_bytes(self):
        result = sanitize_text("hello\x00world")
        assert "\x00" not in result
        assert "helloworld" in result

    def test_preserves_tabs_newlines(self):
        result = sanitize_text("hello\t\nworld")
        assert "\t" in result
        assert "\n" in result

    def test_normalizes_smart_quotes(self):
        result = sanitize_text("\u201chello\u201d")
        assert result == '"hello"'

    def test_normalizes_smart_single_quotes(self):
        result = sanitize_text("\u2018hello\u2019")
        assert result == "'hello'"

    def test_normalizes_en_dash(self):
        result = sanitize_text("hello\u2013world")
        assert result == "hello-world"

    def test_normalizes_em_dash(self):
        result = sanitize_text("hello\u2014world")
        assert result == "hello-world"

    def test_replaces_non_breaking_space(self):
        result = sanitize_text("hello\xa0world")
        assert result == "hello world"
        assert "\xa0" not in result

    def test_removes_zero_width_space(self):
        result = sanitize_text("hello\u200bworld")
        assert "\u200b" not in result
        assert "helloworld" in result

    def test_bytes_input_with_fallback(self):
        result = sanitize_text(b"hello\xa3world", fallback_to_cp1252=True)
        assert "hello" in result
        assert "\xa3" in result

    def test_numeric_input_coerced_to_string(self):
        result = sanitize_text(12345)
        assert result == "12345"


class TestSanitizeData:
    def test_dict_traversal(self):
        data = {
            "name": "John\xa0Doe",
            "age": 30,
        }
        result = sanitize_data(data)
        assert result["name"] == "John Doe"
        assert result["age"] == 30

    def test_list_traversal(self):
        data = ["hello\xa0world", 42]
        result = sanitize_data(data)
        assert result[0] == "hello world"
        assert result[1] == 42

    def test_nested_dict(self):
        data = {"outer": {"inner": "test\xa0value"}}
        result = sanitize_data(data)
        assert result["outer"]["inner"] == "test value"

    def test_none_returns_none(self):
        result = sanitize_data(None)
        assert result is None

    def test_non_string_non_dict_returns_unchanged(self):
        result = sanitize_data(42)
        assert result == 42
