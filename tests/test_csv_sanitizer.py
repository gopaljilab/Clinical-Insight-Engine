"""
Unit tests for the CSV injection sanitizer.
Covers OWASP CSV Injection prevention via sanitize_csv_value, sanitize_row,
and export_to_csv_safe.
"""
import os
import sys

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

    def test_preserves_plain_text(self):
        assert sanitize_csv_value("John Doe") == "John Doe"

    def test_preserves_numeric_string(self):
        assert sanitize_csv_value("42") == "42"

    def test_preserves_float(self):
        assert sanitize_csv_value("37.5") == "37.5"

    def test_none_returns_empty_string(self):
        assert sanitize_csv_value(None) == ""

    def test_strips_whitespace(self):
        assert sanitize_csv_value("  hello  ") == "hello"

    def test_prefix_equals_sign_is_neutralized(self):
        assert sanitize_csv_value("=HYPERLINK(...)") == "'=HYPERLINK(...)"

    def test_prefix_plus_sign_is_neutralized(self):
        assert sanitize_csv_value("+cmd|'/C calc'!A0") == "'+cmd|'/C calc'!A0"

    def test_prefix_minus_sign_is_neutralized(self):
        assert sanitize_csv_value("-2+3") == "'-2+3"

    def test_prefix_at_sign_is_neutralized(self):
        assert sanitize_csv_value("@SUM(A1:A10)") == "'@SUM(A1:A10)"

    def test_prefix_tab_is_stripped_and_value_passes(self):
        # Leading tab is stripped by .strip() before dangerous-prefix check
        result = sanitize_csv_value("\tDDE_INIT")
        assert result == "DDE_INIT"

    def test_prefix_cr_is_stripped_and_value_passes(self):
        # Leading CR/LF is stripped by .strip() before dangerous-prefix check
        result = sanitize_csv_value("\r\ncalc!A0")
        assert result == "calc!A0"

    def test_safe_value_unchanged(self):
        safe_values = [
            "Hello, world!",
            "O'Brien",
            "Name <Name>",
            "Normal text",
            "123.45",
            "",
        ]
        for val in safe_values:
            assert sanitize_csv_value(val) == val, f"Expected '{val}' to pass through unchanged"

    def test_integer_passed_as_number(self):
        assert sanitize_csv_value(42) == "42"

    def test_float_passed_as_number(self):
        assert sanitize_csv_value(3.14) == "3.14"


class TestSanitizeRow:
    """Test suite for sanitize_row."""

    def test_sanitizes_all_values_in_dict(self):
        row = {
            "name": "John",
            "formula": "=HYPERLINK(...)",
            "count": "5",
        }
        result = sanitize_row(row)
        assert result["name"] == "John"
        assert result["formula"] == "'=HYPERLINK(...)"
        assert result["count"] == "5"

    def test_empty_dict(self):
        assert sanitize_row({}) == {}

    def test_mixed_safe_and_dangerous_values(self):
        row = {
            "patient": "Jane Doe",
            "email": "jane@example.com",
            "injection": "=cmd|'/C calc'!A0",
        }
        result = sanitize_row(row)
        assert result["patient"] == "Jane Doe"
        assert result["email"] == "jane@example.com"
        assert result["injection"] == "'=cmd|'/C calc'!A0"


class TestExportToCsvSafe:
    """Test suite for export_to_csv_safe."""

    def test_empty_data_returns_empty_string(self):
        assert export_to_csv_safe([]) == ""

    def test_basic_export(self):
        data = [{"name": "Alice", "age": "30"}]
        result = export_to_csv_safe(data)
        assert "name,age" in result
        assert "Alice,30" in result

    def test_bom_prefixed(self):
        data = [{"col": "val"}]
        result = export_to_csv_safe(data)
        assert result.startswith("\ufeff")  # BOM

    def test_formula_injection_neutralized_in_export(self):
        data = [
            {"cell": "=HYPERLINK(...)"},
            {"cell": "Normal text"},
            {"cell": "+malicious"},
        ]
        result = export_to_csv_safe(data)
        assert "'=HYPERLINK(...)" in result
        assert "Normal text" in result
        assert "'+malicious" in result

    def test_fieldnames_order(self):
        data = [{"b": "2", "a": "1"}]
        result = export_to_csv_safe(data, fieldnames=["a", "b"])
        header = result.split("\r\n")[0]
        assert header.startswith("\ufeffa,b")
        row = result.split("\r\n")[1]
        assert row == "1,2"

    def test_extrasaction_ignore(self):
        data = [{"a": "1", "extra": "should be ignored"}]
        result = export_to_csv_safe(data, fieldnames=["a"])
        assert "extra" not in result