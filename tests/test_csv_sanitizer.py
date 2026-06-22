"""
Unit tests for the CSV Sanitizer module.
Tests OWASP formula injection prevention and safe CSV export.
"""
import sys
import os

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
    """Test suite for sanitize_csv_value."""

    def test_none_returns_empty_string(self):
        assert sanitize_csv_value(None) == ""

    def test_plain_string_passes_through(self):
        assert sanitize_csv_value("John Doe") == "John Doe"
        assert sanitize_csv_value("") == ""
        assert sanitize_csv_value("  spaces  ") == "spaces"

    def test_formula_prefix_equals(self):
        """OWASP: = is the primary CSV formula injection prefix."""
        assert sanitize_csv_value("=HYPERLINK(\"http://evil.com\")").startswith("'")
        result = sanitize_csv_value("=2+3")
        assert result.startswith("'")
        assert "=2+3" in result

    def test_formula_prefix_plus(self):
        """OWASP: + can trigger formula evaluation in Excel."""
        result = sanitize_csv_value("+cmd|'/C calc'!A0")
        assert result.startswith("'")

    def test_formula_prefix_minus(self):
        result = sanitize_csv_value("-1+1")
        assert result.startswith("'")

    def test_formula_prefix_at(self):
        """@ triggers function evaluation in some spreadsheet apps."""
        result = sanitize_csv_value("@SUM(A1:A10)")
        assert result.startswith("'")

    def test_tab_prefix(self):
        result = sanitize_csv_value("\t=cmd")
        assert result.startswith("'")

    def test_carriage_return_prefix(self):
        result = sanitize_csv_value("\r=cmd")
        assert result.startswith("'")

    def test_newline_prefix(self):
        result = sanitize_csv_value("\n=cmd")
        assert result.startswith("'")

    def test_whitespace_stripped_before_prefix_check(self):
        """Leading/trailing whitespace is stripped before the dangerous prefix check."""
        # Whitespace-only values are empty after strip -> no prefix
        assert sanitize_csv_value("   ") == ""
        # Whitespace-prefixed safe string
        assert sanitize_csv_value("  Hello  ") == "Hello"

    def test_unknown_prefix_not_modified(self):
        """Prefixes not in DANGEROUS_PREFIXES should not be modified."""
        safe_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        for ch in safe_chars:
            result = sanitize_csv_value(f"{ch}something")
            if ch in DANGEROUS_PREFIXES:
                assert result.startswith("'"), f"{ch} should be neutralized"
            else:
                assert result == f"{ch}something", f"{ch} should pass through"


class TestSanitizeRow:
    """Test suite for sanitize_row."""

    def test_all_values_in_dict_are_sanitized(self):
        row = {
            "name": "John Doe",
            "formula": "=HYPERLINK(\"http://evil.com\")",
            "number": 42,
        }
        result = sanitize_row(row)
        assert result["name"] == "John Doe"
        assert result["formula"].startswith("'")
        # Numbers are converted to strings by sanitize_csv_value
        assert result["number"] == "42"

    def test_empty_dict_returns_empty_dict(self):
        assert sanitize_row({}) == {}

    def test_preserves_key_order(self):
        row = {"b": "=cmd", "a": "safe", "c": 10}
        result = sanitize_row(row)
        assert "b" in result
        assert "a" in result
        assert "c" in result


class TestExportToCsvSafe:
    """Test suite for export_to_csv_safe."""

    def test_empty_list_returns_empty_string(self):
        assert export_to_csv_safe([]) == ""

    def test_valid_data_returns_csv_string(self):
        data = [
            {"name": "John", "age": 45},
            {"name": "Jane", "age": 32},
        ]
        result = export_to_csv_safe(data)
        assert "name" in result
        assert "age" in result
        assert "John" in result
        assert "Jane" in result

    def test_output_starts_with_bom(self):
        """UTF-8 BOM ensures correct Excel rendering."""
        data = [{"name": "Test"}]
        result = export_to_csv_safe(data)
        assert result.startswith("\ufeff")

    def test_formula_injection_values_are_neutralized_in_output(self):
        """Dangerous formula cells are neutralized via single-quote prefix.
        The CSV writer wraps values containing commas/double-quotes in double-quotes,
        so the neutralized leading quote appears after the CSV field delimiter.
        """
        data = [
            {"cell": "=HYPERLINK(\"http://evil.com\")"},
            {"cell": "+cmd"},
        ]
        result = export_to_csv_safe(data)
        lines = result.strip().split('\r\n')
        # The neutralized value starts with a single-quote inside the CSV field
        assert "'=HYPERLINK" in lines[1], f"Formula not neutralized: {lines[1]}"
        assert "'+cmd" in lines[2], f"Formula not neutralized: {lines[2]}"

    def test_fieldnames_parameter(self):
        """fieldnames parameter overrides dict key ordering."""
        data = [{"b": 1, "a": 2}]
        result = export_to_csv_safe(data, fieldnames=["a", "b"])
        # a should appear before b in the header
        a_pos = result.index("a")
        b_pos = result.index("b")
        assert a_pos < b_pos, "fieldnames order should be respected"

    def test_extrasaction_ignore(self):
        """Keys not in fieldnames are ignored."""
        data = [{"name": "John", "extra": "should be ignored"}]
        result = export_to_csv_safe(data, fieldnames=["name"])
        assert "extra" not in result
        assert "should be ignored" not in result

    def test_numeric_values_not_modified(self):
        """Numbers are not subject to formula injection."""
        data = [{"value": 42}, {"value": -12.5}]
        result = export_to_csv_safe(data)
        assert "42" in result
        assert "-12.5" in result
