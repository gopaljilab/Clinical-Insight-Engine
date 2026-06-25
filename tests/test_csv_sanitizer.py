"""
Unit tests for the CSV sanitization utility.
Tests formula-injection prevention, row sanitization, and safe CSV export.
"""
import os
import sys
import tempfile

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from app.utils.csv_sanitizer import sanitize_csv_value, sanitize_row, export_to_csv_safe


class TestSanitizeCsvValue:
    def test_escapes_formula_equals_prefix(self):
        assert sanitize_csv_value("=CMD|'calc'!A0") == "'=CMD|'calc'!A0"

    def test_escapes_formula_plus_prefix(self):
        assert sanitize_csv_value("+SELECT * FROM users--") == "'+SELECT * FROM users--"

    def test_escapes_formula_hyphen_prefix(self):
        assert sanitize_csv_value("-1+2") == "'-1+2"

    def test_escapes_formula_at_prefix(self):
        assert sanitize_csv_value("@HYPERLINK(\"http://evil.com\")") == "'@HYPERLINK(\"http://evil.com\")"

    def test_passthrough_plain_string(self):
        assert sanitize_csv_value("Hello World") == "Hello World"

    def test_passthrough_number(self):
        assert sanitize_csv_value(42) == "42"
        assert sanitize_csv_value(3.14) == "3.14"

    def test_null_returns_empty_string(self):
        assert sanitize_csv_value(None) == ""

    def test_empty_string_unchanged(self):
        assert sanitize_csv_value("") == ""

    def test_whitespace_only_becomes_empty(self):
        # The implementation strips whitespace first, then returns empty if falsy
        assert sanitize_csv_value("   ") == ""

    def test_mixed_case_formula_prefix_still_escaped(self):
        # The sanitizer only checks for lowercase prefixes based on the FORMULA_PREFIX_PATTERN
        # But inputs with uppercase = may still be dangerous
        assert sanitize_csv_value("=MALICIOUS") == "'=MALICIOUS"


class TestSanitizeRow:
    def test_sanitizes_all_dict_values(self):
        row = {
            "name": "John",
            "formula": "=CMD|'calc'!A0",
            "age": 30,
            "notes": None,
        }
        result = sanitize_row(row)
        assert result["name"] == "John"
        assert result["formula"] == "'=CMD|'calc'!A0"
        assert result["age"] == "30"
        assert result["notes"] == ""

    def test_preserves_keys(self):
        row = {"a": 1, "b": 2}
        result = sanitize_row(row)
        assert list(result.keys()) == ["a", "b"]

    def test_empty_row_returns_empty_strings(self):
        result = sanitize_row({})
        assert result == {}


class TestExportToCsvSafe:
    def test_produces_valid_csv_string(self):
        data = [
            {"name": "Alice", "score": 100},
            {"name": "Bob", "score": 50},
        ]
        result = export_to_csv_safe(data, fieldnames=["name", "score"])
        # Output uses BOM + CRLF
        assert "name,score" in result
        assert "Alice,100" in result
        assert "Bob,50" in result

    def test_escapes_dangerous_cells_in_export(self):
        data = [{"cell": "=CMD|'calc'!A0"}]
        result = export_to_csv_safe(data, fieldnames=["cell"])
        assert "=CMD" not in result or "'=CMD" in result

    def test_handles_empty_data_list(self):
        # Empty data list returns empty string (no header emitted)
        result = export_to_csv_safe([], fieldnames=["name", "age"])
        assert result == ""

    def test_defaults_fieldnames_from_first_row(self):
        data = [{"x": 1, "y": 2}]
        result = export_to_csv_safe(data)
        assert "x,y" in result

    def test_handles_numeric_values(self):
        data = [{"a": 1, "b": 2.5}]
        result = export_to_csv_safe(data)
        assert "1,2.5" in result
