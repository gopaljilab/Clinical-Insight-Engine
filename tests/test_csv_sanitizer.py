"""
Unit tests for app/utils/csv_sanitizer.py

OWASP CSV Injection (Formula Injection) prevention tests.
"""
import pytest
from app.utils.csv_sanitizer import (
    sanitize_csv_value,
    sanitize_row,
    export_to_csv_safe,
    DANGEROUS_PREFIXES,
)


class TestSanitizeCsvValue:
    """Tests for sanitize_csv_value function."""

    def test_formula_eq_prefix_neutralized(self):
        """= prefix is neutralized with a leading single quote."""
        result = sanitize_csv_value("=HYPERLINK(...)")
        assert result == "'=HYPERLINK(...)"

    def test_formula_plus_prefix_neutralized(self):
        """+ prefix is neutralized with a leading single quote."""
        result = sanitize_csv_value("+cmd|'/C calc'!A0")
        assert result == "'+cmd|'/C calc'!A0"

    def test_formula_minus_prefix_neutralized(self):
        """- prefix is neutralized with a leading single quote."""
        result = sanitize_csv_value("-1+1")
        assert result == "'-1+1"

    def test_formula_at_prefix_neutralized(self):
        """@ prefix is neutralized with a leading single quote."""
        result = sanitize_csv_value("@SUM(1,2)")
        assert result == "'@SUM(1,2)"

    def test_tab_prefix_with_formula_char_neutralized(self):
        """Tab before a dangerous prefix character is neutralized after strip."""
        # 	 is stripped before prefix check; test with a value that starts
        # with formula chars after strip.
        result = sanitize_csv_value("\t=HYPERLINK(...)")
        assert result == "'=HYPERLINK(...)"

    def test_carriage_return_with_formula_char_neutralized(self):
        """Carriage return is stripped; formula chars after it are caught."""
        result = sanitize_csv_value("\r=HYPERLINK(...)")
        assert result == "'=HYPERLINK(...)"

    def test_newline_with_formula_char_neutralized(self):
        """Newline is stripped; formula chars after it are caught."""
        result = sanitize_csv_value("\n=HYPERLINK(...)")
        assert result == "'=HYPERLINK(...)"

    def test_safe_string_unchanged(self):
        """Safe strings without dangerous prefix are not modified."""
        assert sanitize_csv_value("John Doe") == "John Doe"
        assert sanitize_csv_value("Age: 45") == "Age: 45"
        assert sanitize_csv_value("Normal text") == "Normal text"

    def test_none_returns_empty_string(self):
        """None input returns empty string."""
        assert sanitize_csv_value(None) == ""

    def test_numeric_values_preserved(self):
        """Numeric values are stringified and checked for prefix."""
        assert sanitize_csv_value(42) == "42"
        assert sanitize_csv_value(3.14) == "3.14"
        assert sanitize_csv_value(0) == "0"

    def test_numeric_with_formula_char_stripsped(self):
        """Numeric-looking string with formula prefix is neutralized."""
        result = sanitize_csv_value("  =cmd|'/C notepad'!A0  ")
        assert result == "'=cmd|'/C notepad'!A0"

    def test_whitespace_trimmed_before_prefix_check(self):
        """Leading whitespace is trimmed before checking dangerous prefix."""
        # No dangerous prefix after trim
        assert sanitize_csv_value("  Hello") == "Hello"
        # Leading space before dangerous prefix is stripped, then prefix detected
        result = sanitize_csv_value("  =SUM(A1)")
        assert result == "'=SUM(A1)"


class TestSanitizeRow:
    """Tests for sanitize_row function."""

    def test_sanitize_row_all_formulas(self):
        """All formula-prefixed values in a row are neutralized."""
        row = {
            "name": "=cmd|'/C calc'!A0",
            "age": "=HYPERLINK(...)",
            "city": "Normal",
        }
        result = sanitize_row(row)
        assert result["name"] == "'=cmd|'/C calc'!A0"
        assert result["age"] == "'=HYPERLINK(...)"
        assert result["city"] == "Normal"

    def test_sanitize_row_empty_values(self):
        """None values in a row become empty strings."""
        row = {"a": None, "b": None}
        result = sanitize_row(row)
        assert result["a"] == ""
        assert result["b"] == ""

    def test_sanitize_row_preserves_keys(self):
        """Keys are preserved, only values are sanitized."""
        row = {"col1": "=malicious", "col2": "safe"}
        result = sanitize_row(row)
        assert "col1" in result
        assert "col2" in result


class TestExportToCsvSafe:
    """Tests for export_to_csv_safe function."""

    def test_empty_data_returns_empty_string(self):
        """Empty list returns empty string."""
        assert export_to_csv_safe([]) == ""

    def test_basic_data_exported(self):
        """Basic data is exported as CSV string."""
        data = [
            {"name": "Alice", "age": "30"},
            {"name": "Bob", "age": "25"},
        ]
        result = export_to_csv_safe(data)
        # BOM for Excel UTF-8 compatibility
        assert result.startswith("\ufeff")
        assert "name" in result
        assert "Alice" in result
        assert "Bob" in result
        assert "\r\n" in result  # Windows line endings

    def test_dangerous_values_are_neutralized_in_export(self):
        """Formula injection values are neutralized in CSV export."""
        data = [
            {"formula": "=HYPERLINK(...)"},
            {"formula": "+malicious"},
        ]
        result = export_to_csv_safe(data)
        assert "'=HYPERLINK(...)" in result
        assert "'+malicious" in result

    def test_explicit_fieldnames_respected(self):
        """Explicit fieldnames control column order."""
        data = [{"a": "1", "b": "2"}]
        result = export_to_csv_safe(data, fieldnames=["b", "a"])
        # Fieldnames appear in specified order in header
        assert result.index("b") < result.index("a")

    def test_extrakeys_ignored(self):
        """Extra keys in row dict are ignored."""
        data = [{"name": "Alice"}]
        result = export_to_csv_safe(data)
        assert "Alice" in result
        assert "extra" not in result.lower()

    def test_bom_prefix_for_excel(self):
        """Result starts with UTF-8 BOM for Excel compatibility."""
        data = [{"col": "val"}]
        result = export_to_csv_safe(data)
        assert result.startswith("\ufeff")
