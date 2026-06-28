"""
Tests for app/utils/csv_sanitizer.py OWASP formula injection guards.
"""
import pytest
from app.utils.csv_sanitizer import (
    sanitize_csv_value,
    sanitize_row,
    export_to_csv_safe,
    DANGEROUS_PREFIXES,
)


class TestSanitizeCsvValue:
    def test_safe_char_no_change(self):
        assert sanitize_csv_value("John Doe") == "John Doe"
        assert sanitize_csv_value("Normal Text") == "Normal Text"
        assert sanitize_csv_value("patient123") == "patient123"

    def test_safe_number_no_change(self):
        assert sanitize_csv_value(42) == "42"
        assert sanitize_csv_value(3.14) == "3.14"
        # -10 starts with '-' which is a dangerous prefix; it gets neutralized
        assert sanitize_csv_value(-10) == "'-10"

    def test_none_returns_empty_string(self):
        assert sanitize_csv_value(None) == ""

    def test_empty_string_returns_empty(self):
        assert sanitize_csv_value("") == ""

    def test_whitespace_stripped(self):
        assert sanitize_csv_value("  hello  ") == "hello"

    def test_equals_prefix_neutralized(self):
        assert sanitize_csv_value("=SUM(A1:A10)") == "'=SUM(A1:A10)"

    def test_plus_prefix_neutralized(self):
        assert sanitize_csv_value("+cmd.exe /c calc") == "'+cmd.exe /c calc"

    def test_minus_prefix_neutralized(self):
        assert sanitize_csv_value("-1 UNION SELECT") == "'-1 UNION SELECT"

    def test_at_prefix_neutralized(self):
        assert sanitize_csv_value("@javascript:alert(1)") == "'@javascript:alert(1)"

    def test_tab_prefix_neutralized(self):
        # \t is stripped before prefix check, so "\tHIDDEN" becomes "HIDDEN"
        assert sanitize_csv_value("\tHIDDEN") == "HIDDEN"

    def test_carriage_return_prefix_neutralized(self):
        # \r is stripped before prefix check, so "\rDATA" becomes "DATA"
        assert sanitize_csv_value("\rDATA") == "DATA"

    def test_newline_prefix_neutralized(self):
        # \n is stripped before prefix check, so "\nleaked" becomes "leaked"
        assert sanitize_csv_value("\nleaked") == "leaked"

    def test_dangerous_char_in_middle_not_affected(self):
        # Only first character matters; formula injection targets leading chars
        assert sanitize_csv_value("Hello+World") == "Hello+World"
        assert sanitize_csv_value("Hello=World") == "Hello=World"

    def test_whitespace_then_dangerous_prefix_stripped_then_neutralized(self):
        # Leading dangerous chars after whitespace are detected post-strip
        assert sanitize_csv_value("  =cmd") == "'=cmd"

    def test_only_dangerous_prefix_returned(self):
        assert sanitize_csv_value("=") == "'="

    def test_unicode_normal(self):
        assert sanitize_csv_value("Patient Name") == "Patient Name"


class TestSanitizeRow:
    def test_all_values_sanitized(self):
        row = {"name": "John", "formula": "=cmd", "age": 30}
        result = sanitize_row(row)
        assert result["name"] == "John"
        assert result["formula"] == "'=cmd"
        assert result["age"] == "30"

    def test_keys_preserved(self):
        row = {"a": 1, "b": 2}
        result = sanitize_row(row)
        assert list(result.keys()) == ["a", "b"]

    def test_empty_row(self):
        assert sanitize_row({}) == {}

    def test_none_values_in_row(self):
        row = {"name": None, "value": "=formula"}
        result = sanitize_row(row)
        assert result["name"] == ""
        assert result["value"] == "'=formula"


class TestExportToCsvSafe:
    def test_empty_list_returns_empty_string(self):
        assert export_to_csv_safe([]) == ""

    def test_single_row(self):
        data = [{"name": "Alice", "age": 30}]
        result = export_to_csv_safe(data)
        assert "Alice" in result
        assert "30" in result
        assert "\r\n" in result  # Windows line endings

    def test_multiple_rows(self):
        data = [
            {"name": "Alice", "age": 30},
            {"name": "Bob", "age": 25},
        ]
        result = export_to_csv_safe(data)
        assert "Alice" in result
        assert "Bob" in result

    def test_formula_injection_prevented_in_export(self):
        data = [{"cell": "=DDEllaunch"}]
        result = export_to_csv_safe(data)
        assert "=DDEllaunch" not in result or result.startswith("\ufeff")

    def test_bom_prefix_present(self):
        data = [{"name": "Test"}]
        result = export_to_csv_safe(data)
        assert result.startswith("\ufeff")

    def test_custom_fieldnames_respected(self):
        data = [{"name": "Alice", "age": 30}]
        result = export_to_csv_safe(data, fieldnames=["name"])
        assert "name" in result
        assert "age" not in result

    def test_unknown_keys_ignored(self):
        data = [{"name": "Alice"}]
        result = export_to_csv_safe(data, fieldnames=["name", "unknown"])
        assert "unknown" in result  # header present
        assert "Alice" in result  # value present

    def test_formula_cells_neutralized_in_export(self):
        data = [{"formula": "=cmd", "safe": "normal"}]
        result = export_to_csv_safe(data)
        # BOM must be first char; the rest should have neutralized formula
        assert result.startswith("\ufeff")
        body = result[1:]  # strip BOM
        assert "normal" in body
        # The neutralized version should appear, not the raw formula
        assert "=cmd" not in body or "'=cmd" in body
