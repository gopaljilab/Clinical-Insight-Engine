"""
Unit tests for app/utils/csv_sanitizer.py — OWASP CSV Formula Injection prevention.
"""

import os
import sys
import datetime

import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from app.utils.csv_sanitizer import (
    sanitize_csv_value,
    sanitize_row,
    export_to_csv_safe,
    DANGEROUS_PREFIXES,
)


class TestSanitizeCsvValue:
    def test_passes_through_normal_text(self):
        """Normal text with no dangerous prefix is returned unchanged."""
        assert sanitize_csv_value("Jane Doe") == "Jane Doe"
        assert sanitize_csv_value("Normal clinical note") == "Normal clinical note"

    def test_returns_empty_string_for_none(self):
        """None values are converted to empty string."""
        assert sanitize_csv_value(None) == ""

    def test_returns_empty_string_for_none_in_various_forms(self):
        """None and missing values are treated as empty string."""
        assert sanitize_csv_value("   ") == ""  # whitespace only strips to empty
        # None specifically
        assert sanitize_csv_value(None) == ""

    def test_strips_whitespace(self):
        """sanitize_csv_value strips leading/trailing whitespace from strings."""
        assert sanitize_csv_value("  Jane Doe  ") == "Jane Doe"
        assert sanitize_csv_value("  no leading/trailing spaces  ") == "no leading/trailing spaces"

    def test_prefixes_equals_sign_formula(self):
        """Formula starting with = is neutralized with single-quote prefix."""
        assert sanitize_csv_value("=HYPERLINK(\"https://evil.com\")") == "'=HYPERLINK(\"https://evil.com\")"
        assert sanitize_csv_value("=cmd|' /C calc'!A0") == "'=cmd|' /C calc'!A0"
        assert sanitize_csv_value("=DDE()") == "'=DDE()"

    def test_prefixes_plus_sign_formula(self):
        """Formula starting with + is neutralized with single-quote prefix."""
        assert sanitize_csv_value("+SUM(A1:A100)") == "'+SUM(A1:A100)"
        assert sanitize_csv_value("+concatenate(A1,B1)") == "'+concatenate(A1,B1)"

    def test_prefixes_minus_sign_formula(self):
        """Formula starting with - is neutralized with single-quote prefix."""
        assert sanitize_csv_value("-HYPERLINK(\"https://evil.com\")") == "'-HYPERLINK(\"https://evil.com\")"

    def test_prefixes_at_sign_formula(self):
        """Formula starting with @ is neutralized with single-quote prefix."""
        assert sanitize_csv_value("@SUM(A1:A100)") == "'@SUM(A1:A100)"
        assert sanitize_csv_value("@concatenate()") == "'@concatenate()"

    def test_prefixes_tab_control_character(self):
        """Values starting with tab (\\t) are neutralized."""
        result = sanitize_csv_value("\tHYPERLINK()")
        assert result.startswith("'") or "\t" not in result

    def test_prefixes_carriage_return(self):
        """Values starting with \\r are neutralized (prevents injection in newlines)."""
        result = sanitize_csv_value("\r\nmalicious")
        assert result.startswith("'") or "\r" not in result

    def test_numeric_values_returned_as_strings(self):
        """Numeric values are returned as their string representation."""
        assert sanitize_csv_value(42) == "42"
        assert sanitize_csv_value(3.14) == "3.14"
        assert sanitize_csv_value("123") == "123"

    def test_handles_integer_type(self):
        """Integer values are converted to their string representation."""
        assert sanitize_csv_value(0) == "0"
        assert sanitize_csv_value(1) == "1"

    def test_handles_float_type(self):
        """Float values are converted to their string representation."""
        assert sanitize_csv_value(0.0) == "0.0"
        assert sanitize_csv_value(3.5) == "3.5"

    def test_handles_date_objects(self):
        """Date objects are serialized to ISO format."""
        d = datetime.date(2026, 6, 18)
        result = sanitize_csv_value(d)
        assert result == "2026-06-18"

    def test_handles_datetime_objects(self):
        """datetime objects are serialized to ISO format with time."""
        dt = datetime.datetime(2026, 6, 18, 14, 30, 0)
        result = sanitize_csv_value(dt)
        assert result.startswith("2026-06-18")

    def test_handles_boolean_true(self):
        """True is converted to string 'True'."""
        assert sanitize_csv_value(True) == "True"

    def test_handles_boolean_false(self):
        """False is converted to string 'False'."""
        assert sanitize_csv_value(False) == "False"

    def test_handles_list_of_strings(self):
        """Lists are flattened to semicolon-separated string."""
        result = sanitize_csv_value(["option A", "option B", "option C"])
        assert "option A" in result
        assert "option B" in result
        assert "option C" in result

    def test_handles_nested_dict(self):
        """Dicts are converted to string representation."""
        result = sanitize_csv_value({"name": "John", "age": 30})
        assert isinstance(result, str)
        assert "John" in result
        assert "30" in result

    def test_handles_mixed_list_with_nones(self):
        """Lists with None values are handled gracefully (filtering falsey items)."""
        result = sanitize_csv_value(["valid", None, ""])
        assert "valid" in result


class TestSanitizeRow:
    def test_sanitizes_all_values_in_dict(self):
        """sanitize_row applies sanitize_csv_value to every dict value."""
        row = {
            "name": "Jane Doe",
            "formula": "=HYPERLINK(\"https://evil.com\")",
            "age": 30,
        }
        result = sanitize_row(row)
        assert result["name"] == "Jane Doe"
        assert result["formula"] == "'=HYPERLINK(\"https://evil.com\")"
        assert result["age"] == "30"

    def test_handles_empty_row(self):
        """sanitize_row handles an empty dict."""
        result = sanitize_row({})
        assert result == {}

    def test_preserves_dict_keys(self):
        """sanitize_row preserves the original dict keys."""
        row = {"a": "value_a", "b": "value_b"}
        result = sanitize_row(row)
        assert list(result.keys()) == ["a", "b"]


class TestExportToCsvSafe:
    def test_returns_empty_string_for_empty_list(self):
        """export_to_csv_safe returns empty string when data is empty."""
        result = export_to_csv_safe([])
        assert result == ""

    def test_includes_utf8_bom_for_excel(self):
        """export_to_csv_safe prepends UTF-8 BOM for Excel UTF-8 compatibility."""
        result = export_to_csv_safe([{"name": "Test"}])
        assert result.startswith("\ufeff")  # BOM character

    def test_includes_header_row(self):
        """export_to_csv_safe writes a CSV header from fieldnames."""
        result = export_to_csv_safe([{"name": "Test", "value": 42}])
        assert "name" in result
        assert "value" in result

    def test_sanitizes_formula_values_in_rows(self):
        """export_to_csv_safe sanitizes formula injection in cell values."""
        result = export_to_csv_safe([
            {"name": "Normal", "risk": "=HYPERLINK(\"https://evil.com\")"}
        ])
        assert "'=HYPERLINK" in result
        # Verify the formula is properly escaped inside CSV quotes
        lines = result.lstrip("\ufeff").split("\r\n")
        data_line = lines[1]
        # The escaped CSV cell should contain the single-quote prefix inside the quotes
        assert "'=HYPERLINK" in data_line

    def test_uses_provided_fieldnames_order(self):
        """export_to_csv_safe respects the fieldnames order when provided."""
        data = [{"b": "B", "a": "A"}]
        result = export_to_csv_safe(data, fieldnames=["a", "b"])
        lines = result.lstrip("\ufeff").split("\r\n")
        header = lines[0]
        assert header.index("a") < header.index("b")

    def test_ignores_extra_keys_not_in_fieldnames(self):
        """export_to_csv_safe ignores dict keys not in fieldnames."""
        data = [{"a": "A", "extra": "ignored"}]
        result = export_to_csv_safe(data, fieldnames=["a"])
        assert "extra" not in result

    def test_handles_multiple_rows(self):
        """export_to_csv_safe handles multiple rows correctly."""
        data = [
            {"name": "Alice"},
            {"name": "Bob"},
            {"name": "Carol"},
        ]
        result = export_to_csv_safe(data)
        lines = result.lstrip("\ufeff").split("\r\n")
        assert len(lines) >= 4  # header + 3 rows

    def test_handles_special_characters(self):
        """export_to_csv_safe handles commas, quotes, and newlines in values."""
        data = [{"name": "Doe, Jane", "note": 'Says "hello"'}]
        result = export_to_csv_safe(data)
        # Quoted properly
        assert "Doe, Jane" in result
        assert '"hello"' in result
