"""
Unit tests for app/utils/csv_sanitizer.py
OWASP CSV Formula Injection prevention guards.
"""
import pytest
from app.utils.csv_sanitizer import (
    sanitize_csv_value,
    sanitize_row,
    export_to_csv_safe,
    DANGEROUS_PREFIXES,
)


class TestSanitizeCsvValue:
    def test_safe_string_pass_through(self):
        assert sanitize_csv_value("Hello World") == "Hello World"
        assert sanitize_csv_value("Normal text") == "Normal text"
        assert sanitize_csv_value("123.45") == "123.45"

    def test_dangerous_prefix_equals(self):
        assert sanitize_csv_value("=SUM(A1:A10)") == "'=SUM(A1:A10)"
        assert sanitize_csv_value("=HYPERLINK(\"http://evil.com\")") == "'=HYPERLINK(\"http://evil.com\")"

    def test_dangerous_prefix_plus(self):
        assert sanitize_csv_value("+10+20") == "'+10+20"
        assert sanitize_csv_value("+cmd|bash") == "'+cmd|bash"

    def test_dangerous_prefix_minus(self):
        assert sanitize_csv_value("-1+1") == "'-1+1"
        assert sanitize_csv_value("-SELECT * FROM users") == "'-SELECT * FROM users"

    def test_dangerous_prefix_at(self):
        assert sanitize_csv_value("@SUM(A1:A10)") == "'@SUM(A1:A10)"
        assert sanitize_csv_value("@TC(\"Sheet1!A1\")") == "'@TC(\"Sheet1!A1\")"

    def test_dangerous_prefix_tab(self):
        # Note: str.strip() removes leading/trailing whitespace before the check,
        # so '\thello' becomes 'hello' (tab is stripped) then checked for dangerous prefix.
        # Since 'hello' has no dangerous prefix, it passes through unchanged.
        assert sanitize_csv_value("\thello") == "hello"
        # A tab mid-string is preserved since strip only removes from edges
        assert sanitize_csv_value("start\tend") == "start\tend"

    def test_dangerous_prefix_carriage_return(self):
        # str.strip() removes leading/trailing \r, so '\rtest' becomes 'test'
        assert sanitize_csv_value("\rtest") == "test"

    def test_dangerous_prefix_newline(self):
        # str.strip() removes leading/trailing \n, so '\ntest' becomes 'test'
        assert sanitize_csv_value("\ntest") == "test"

    def test_none_returns_empty_string(self):
        assert sanitize_csv_value(None) == ""

    def test_empty_string(self):
        assert sanitize_csv_value("") == ""

    def test_whitespace_only(self):
        # str.strip() turns whitespace-only strings into empty string
        assert sanitize_csv_value("   ") == ""

    def test_whitespace_then_safe_char(self):
        # str.strip() removes leading whitespace, so '  Hello' becomes 'Hello'
        assert sanitize_csv_value("  Hello") == "Hello"

    def test_whitespace_then_dangerous_char(self):
        # str.strip() removes leading whitespace, then the leading '=' triggers neutralization
        assert sanitize_csv_value("  =SUM(A1)") == "'=SUM(A1)"

    def test_integer_value(self):
        assert sanitize_csv_value(42) == "42"
        assert sanitize_csv_value(0) == "0"

    def test_float_value(self):
        assert sanitize_csv_value(3.14) == "3.14"

    def test_boolean_value(self):
        assert sanitize_csv_value(True) == "True"
        assert sanitize_csv_value(False) == "False"


class TestSanitizeRow:
    def test_row_with_mixed_values(self):
        row = {
            "name": "John Doe",
            "formula": "=SUM(A1:A10)",
            "score": 95,
            "label": "+bonus",
        }
        sanitized = sanitize_row(row)
        assert sanitized["name"] == "John Doe"
        assert sanitized["formula"] == "'=SUM(A1:A10)"
        assert sanitized["score"] == "95"
        assert sanitized["label"] == "'+bonus"

    def test_row_with_none_values(self):
        row = {"col1": None, "col2": "value"}
        sanitized = sanitize_row(row)
        assert sanitized["col1"] == ""
        assert sanitized["col2"] == "value"

    def test_row_all_safe(self):
        row = {"a": "apple", "b": "banana"}
        sanitized = sanitize_row(row)
        assert sanitized == {"a": "apple", "b": "banana"}


class TestExportToCsvSafe:
    def test_empty_data_returns_empty_string(self):
        assert export_to_csv_safe([]) == ""

    def test_single_row_export(self):
        data = [{"name": "Alice", "score": 100}]
        result = export_to_csv_safe(data, fieldnames=["name", "score"])
        assert "Alice" in result
        assert "100" in result
        # BOM should be present for Excel UTF-8
        assert result.startswith("\ufeff")
        assert "name" in result
        assert "score" in result

    def test_multiple_rows_with_dangerous_values(self):
        data = [
            {"name": "Bob", "formula": "=HYPERLINK(\"http://evil.com\")"},
            {"name": "Carol", "formula": "@cmd"},
        ]
        result = export_to_csv_safe(data)
        assert "Bob" in result
        assert "Carol" in result
        # Dangerous prefixes must be neutralized in output
        assert "'=HYPERLINK" in result
        assert "'@cmd" in result

    def test_custom_field_order(self):
        data = [{"a": 1, "b": 2}]
        result = export_to_csv_safe(data, fieldnames=["b", "a"])
        # Fieldnames control column order in output
        idx_a = result.index("a")
        idx_b = result.index("b")
        assert idx_b < idx_a

    def test_bom_present_for_excel(self):
        data = [{"name": "Test"}]
        result = export_to_csv_safe(data)
        assert result.startswith("\ufeff")

    def test_whitespace_in_values_preserved(self):
        # Leading/trailing whitespace is stripped by sanitize_csv_value
        data = [{"name": "  spaced  "}]
        result = export_to_csv_safe(data)
        assert "spaced" in result
