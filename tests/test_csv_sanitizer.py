import pytest
import sys
sys.path.insert(0, '.')
from app.utils.csv_sanitizer import (
    sanitize_csv_value,
    sanitize_row,
    export_to_csv_safe,
)


class TestSanitizeCsvValue:
    def test_plain_text_unchanged(self):
        assert sanitize_csv_value("hello world") == "hello world"

    def test_equals_prefix_neutralized(self):
        # OWASP formula injection: =HYPERLINK
        result = sanitize_csv_value("=HYPERLINK(\"http://evil.com\")")
        assert result.startswith("'")
        assert "HYPERLINK" in result

    def test_plus_prefix_neutralized(self):
        # + is treated as formula in Excel
        result = sanitize_csv_value("+cmd|'/C calc'!A0")
        assert result.startswith("'")

    def test_minus_prefix_neutralized(self):
        result = sanitize_csv_value("-2+3")
        assert result.startswith("'")

    def test_at_prefix_neutralized(self):
        # @ triggers formula in some contexts
        result = sanitize_csv_value("@SUM(1,2)")
        assert result.startswith("'")

    def test_tab_prefix_leading_whitespace_stripped_before_check(self):
        # Note: strip() removes leading \t before the dangerous prefix check,
        # so "\t\thidden" becomes "hidden" and is NOT neutralized.
        result = sanitize_csv_value("\t\thidden")
        assert result == "hidden"

    def test_carriage_return_stripped(self):
        result = sanitize_csv_value("\r\ninjected")
        assert result == "injected"

    def test_newline_stripped(self):
        # Newline is stripped by strip() before the dangerous prefix check
        result = sanitize_csv_value("\nvalue")
        assert result == "value"

    def test_empty_string_unchanged(self):
        assert sanitize_csv_value("") == ""

    def test_none_returns_empty(self):
        assert sanitize_csv_value(None) == ""

    def test_numeric_unchanged(self):
        assert sanitize_csv_value(42) == "42"

    def test_float_unchanged(self):
        assert sanitize_csv_value(3.14) == "3.14"

    def test_leading_space_stripped(self):
        # Leading space is stripped before the dangerous prefix check
        assert sanitize_csv_value(" normal value") == "normal value"

    def test_uppercase_formula_unchanged(self):
        # Uppercase letters are fine
        assert sanitize_csv_value("FORMULA") == "FORMULA"

    def test_mixed_safe_content(self):
        result = sanitize_csv_value("Patient record #123")
        assert result == "Patient record #123"


class TestSanitizeRow:
    def test_sanitizes_all_values(self):
        row = {
            "name": "=cmd",
            "value": "normal",
            "score": 42,
        }
        result = sanitize_row(row)
        assert result["name"].startswith("'")
        assert result["value"] == "normal"
        assert result["score"] == "42"

    def test_empty_row(self):
        result = sanitize_row({})
        assert result == {}

    def test_mixed_safe_unsafe(self):
        row = {
            "formula": "=DDE-server",
            "plain": "plain text",
        }
        result = sanitize_row(row)
        assert result["formula"].startswith("'")
        assert result["plain"] == "plain text"


class TestExportToCsvSafe:
    def test_empty_data_returns_empty_string(self):
        result = export_to_csv_safe([])
        assert result == ""

    def test_single_row(self):
        data = [{"name": "John", "score": 42}]
        result = export_to_csv_safe(data)
        assert "name" in result
        assert "score" in result
        assert "John" in result

    def test_formula_injection_neutralized_in_export(self):
        data = [{"value": "=HYPERLINK(\"http://evil.com\")"}]
        result = export_to_csv_safe(data)
        assert result.count("'") >= 1

    def test_has_bom_prefix_for_excel_utf8(self):
        data = [{"name": "test"}]
        result = export_to_csv_safe(data)
        assert result.startswith("\ufeff")

    def test_custom_fieldnames(self):
        data = [{"a": 1, "b": 2}]
        result = export_to_csv_safe(data, fieldnames=["b", "a"])
        lines = result.split("\r\n")
        header = lines[0]
        assert header.index("b") < header.index("a")

    def test_uses_lf_crlf_line_endings(self):
        data = [{"x": "1"}, {"x": "2"}]
        result = export_to_csv_safe(data)
        assert "\r\n" in result

    def test_ignores_extra_columns(self):
        data = [{"a": 1, "b": 2, "c": 3}]
        result = export_to_csv_safe(data, fieldnames=["a", "b"])
        assert "c" not in result
