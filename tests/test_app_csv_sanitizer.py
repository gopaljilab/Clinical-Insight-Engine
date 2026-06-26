"""
Unit tests for app/utils/csv_sanitizer.py - OWASP CSV injection prevention.
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
        """None input is sanitized to empty string."""
        assert sanitize_csv_value(None) == ""

    def test_empty_string_returns_empty(self):
        """Empty string input is returned as empty string."""
        assert sanitize_csv_value("") == ""

    def test_normal_string_unchanged(self):
        """Normal alphanumeric strings pass through unchanged."""
        assert sanitize_csv_value("John Doe") == "John Doe"
        assert sanitize_csv_value("Patient Name") == "Patient Name"

    def test_whitespace_trimmed(self):
        """Leading and trailing whitespace is stripped."""
        assert sanitize_csv_value("  hello  ") == "hello"

    def test_numeric_string_unchanged(self):
        """Numeric strings pass through as-is."""
        assert sanitize_csv_value("42") == "42"
        assert sanitize_csv_value("3.14") == "3.14"

    def test_integer_passthrough(self):
        """Integer values are converted to string."""
        assert sanitize_csv_value(42) == "42"

    def test_float_passthrough(self):
        """Float values are converted to string."""
        assert sanitize_csv_value(3.14) == "3.14"

    def test_formula_prefix_equals_neutralized(self):
        """Values starting with = get a single quote prepended."""
        result = sanitize_csv_value("=1+1")
        assert result == "'=1+1"
        assert result[0] == "'"

    def test_formula_prefix_plus_neutralized(self):
        """Values starting with + get a single quote prepended."""
        result = sanitize_csv_value("+SUM(A1:A10)")
        assert result == "'+SUM(A1:A10)"
        assert result[0] == "'"

    def test_formula_prefix_minus_neutralized(self):
        """Values starting with - get a single quote prepended."""
        result = sanitize_csv_value("-cmd")
        assert result == "'-cmd"

    def test_formula_prefix_at_neutralized(self):
        """Values starting with @ get a single quote prepended."""
        result = sanitize_csv_value("@calc")
        assert result == "'@calc"

    def test_formula_prefix_tab_stripped_before_check(self):
        """Leading tab is stripped by str().strip(), so prefix check sees 'cell'."""
        # After strip(), the value is 'cell' which has no dangerous prefix
        result = sanitize_csv_value("\tcell")
        assert result == "cell"

    def test_formula_prefix_carriage_return_stripped(self):
        """Leading CR is stripped by str().strip(), so prefix check sees 'cell'."""
        result = sanitize_csv_value("\rcell")
        assert result == "cell"

    def test_formula_prefix_newline_stripped(self):
        """Leading newline is stripped by str().strip(), so prefix check sees 'cell'."""
        result = sanitize_csv_value("\ncell")
        assert result == "cell"

    def test_cmd_injection_example_neutralized(self):
        """CMD.exe command injection example is neutralized."""
        result = sanitize_csv_value("=CMD|'/C calc'!A0")
        assert result == "'=CMD|'/C calc'!A0"

    def test_hyperlink_injection_neutralized(self):
        """Hyperlink injection is neutralized."""
        result = sanitize_csv_value("=HYPERLINK(...)")
        assert result == "'=HYPERLINK(...)"

    def test_dangerous_prefixes_constant_defined(self):
        """DANGEROUS_PREFIXES includes all expected characters."""
        expected = ("=", "+", "-", "@", "\t", "\r", "\n")
        assert DANGEROUS_PREFIXES == expected

    def test_already_safe_with_prefix_preserved(self):
        """A value that already starts with a quote is not double-quoted."""
        result = sanitize_csv_value("'already safe")
        assert result == "'already safe"


class TestSanitizeRow:
    """Test suite for sanitize_row."""

    def test_empty_dict_returns_empty_dict(self):
        """Empty input dict returns empty dict."""
        assert sanitize_row({}) == {}

    def test_normal_row_unchanged(self):
        """Row with normal values has values sanitized (unchanged)."""
        row = {"name": "John", "age": "30"}
        result = sanitize_row(row)
        assert result == {"name": "John", "age": "30"}

    def test_formula_injection_in_row_values_neutralized(self):
        """Formula injection in row values is neutralized."""
        row = {"formula": "=1+1", "safe": "value"}
        result = sanitize_row(row)
        assert result["formula"] == "'=1+1"
        assert result["safe"] == "value"

    def test_mixed_safe_and_unsafe_values(self):
        """Row with mixed values sanitizes unsafe ones."""
        row = {"name": "John", "data": "=cmd", "code": "ABC123"}
        result = sanitize_row(row)
        assert result["name"] == "John"
        assert result["data"] == "'=cmd"
        assert result["code"] == "ABC123"

    def test_null_values_in_row(self):
        """Null values in row are sanitized to empty strings."""
        row = {"name": None, "value": "test"}
        result = sanitize_row(row)
        assert result["name"] == ""
        assert result["value"] == "test"


class TestExportToCsvSafe:
    """Test suite for export_to_csv_safe."""

    def test_empty_data_returns_empty_string(self):
        """Empty list returns empty string (early return before BOM logic)."""
        result = export_to_csv_safe([])
        assert result == ""

    def test_single_row_with_headers(self):
        """Single row with headers produces valid CSV with BOM."""
        data = [{"name": "John", "age": "30"}]
        result = export_to_csv_safe(data)
        assert "\ufeff" in result  # BOM present
        assert "name" in result
        assert "John" in result
        assert "age" in result
        assert "30" in result

    def test_multiple_rows(self):
        """Multiple rows produce CSV with all values."""
        data = [
            {"name": "John", "age": "30"},
            {"name": "Jane", "age": "25"},
        ]
        result = export_to_csv_safe(data)
        assert "John" in result
        assert "Jane" in result
        assert "30" in result
        assert "25" in result

    def test_formula_injection_in_export_neutralized(self):
        """Formula injection values in export data are sanitized."""
        data = [{"formula": "=1+1", "safe": "value"}]
        result = export_to_csv_safe(data)
        # The formula value should have a quote prefix
        assert "'=1+1" in result

    def test_custom_fieldnames(self):
        """Custom fieldnames determine column order."""
        data = [{"a": "1", "b": "2"}]
        result = export_to_csv_safe(data, fieldnames=["b", "a"])
        bom_pos = result.find("\ufeff")
        header_line = result[bom_pos:].split("\r\n")[0]
        # First column should be 'b' (custom order)
        assert header_line.startswith("\ufeffb,a")

    def test_bom_for_excel_utf8(self):
        """Export includes BOM for Excel UTF-8 compatibility."""
        data = [{"name": "Test"}]
        result = export_to_csv_safe(data)
        # BOM character
        assert result[0] == "\ufeff"


if __name__ == "__main__":
    import unittest
    unittest.main()
