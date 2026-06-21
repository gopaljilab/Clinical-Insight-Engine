"""
Tests for app.utils.csv_sanitizer — OWASP CSV formula injection prevention.
"""
import pytest
from app.utils.csv_sanitizer import (
    sanitize_csv_value,
    sanitize_row,
    export_to_csv_safe,
    DANGEROUS_PREFIXES,
)


class TestSanitizeCsvValue:
    def test_returns_empty_string_for_none(self):
        assert sanitize_csv_value(None) == ""

    def test_returns_empty_string_for_empty_string(self):
        assert sanitize_csv_value("") == ""

    def test_leaves_plain_text_unchanged(self):
        assert sanitize_csv_value("Jane Doe") == "Jane Doe"

    def test_leaves_plain_positive_numbers_unchanged(self):
        assert sanitize_csv_value(42) == "42"
        assert sanitize_csv_value("0") == "0"

    def test_prepends_single_quote_for_negative_numbers(self):
        # negative numbers start with '-' which is in DANGEROUS_PREFIXES
        assert sanitize_csv_value(-12.5) == "'-12.5"
        assert sanitize_csv_value("-99") == "'-99"

    def test_prepends_single_quote_for_equals_prefix(self):
        assert sanitize_csv_value("=HYPERLINK(\"https://evil.com\")") == "'=HYPERLINK(\"https://evil.com\")"
        assert sanitize_csv_value("=1+1") == "'=1+1"

    def test_prepends_single_quote_for_plus_prefix(self):
        assert sanitize_csv_value("+SUM(A1:A10)") == "'+SUM(A1:A10)"
        assert sanitize_csv_value("+cmd|'/c calc'!A0") == "'+cmd|'/c calc'!A0"

    def test_prepends_single_quote_for_minus_prefix(self):
        assert sanitize_csv_value("-2-2") == "'-2-2"

    def test_prepends_single_quote_for_at_sign_prefix(self):
        assert sanitize_csv_value("@echo off") == "'@echo off"

    def test_strips_whitespace_before_checking_prefix(self):
        assert sanitize_csv_value("  =HYPERLINK(\"x\")") == "'=HYPERLINK(\"x\")"
        assert sanitize_csv_value("   Jane") == "Jane"

    def test_strips_whitespace(self):
        # sanitize_csv_value calls strip(), so leading/trailing whitespace is removed
        assert sanitize_csv_value("  hello") == "hello"
        assert sanitize_csv_value("hello  ") == "hello"


class TestSanitizeRow:
    def test_sanitizes_all_values_in_row(self):
        row = {
            "name": "Jane",
            "formula": "=HYPERLINK(\"https://evil.com\")",
            "score": 42,
            "note": None,
        }
        result = sanitize_row(row)
        assert result["name"] == "Jane"
        assert result["formula"] == "'=HYPERLINK(\"https://evil.com\")"
        assert result["score"] == "42"
        assert result["note"] == ""

    def test_sanitizes_empty_row(self):
        assert sanitize_row({}) == {}


class TestExportToCsvSafe:
    def test_returns_empty_string_for_empty_list(self):
        assert export_to_csv_safe([]) == ""

    def test_exports_sanitized_rows_with_bom(self):
        data = [
            {"name": "Jane", "risk": "=HYPERLINK(\"evil\")"},
            {"name": "Bob", "risk": "Normal"},
        ]
        result = export_to_csv_safe(data)
        assert "\ufeff" in result  # BOM
        assert "name,risk" in result
        assert "Jane" in result
        assert "'=HYPERLINK" in result  # formula sanitized

    def test_respects_custom_fieldnames(self):
        data = [{"a": 1, "b": 2}]
        result = export_to_csv_safe(data, fieldnames=["b", "a"])
        assert "b,a" in result
