"""
Unit tests for app.utils.csv_sanitizer OWASP formula injection guard.
"""
import os
import sys
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from app.utils.csv_sanitizer import (
    sanitize_csv_value,
    sanitize_row,
    export_to_csv_safe,
)


class TestSanitizeCsvValue(unittest.TestCase):
    """Tests for sanitize_csv_value OWASP formula injection guard."""

    def test_none_returns_empty_string(self):
        self.assertEqual(sanitize_csv_value(None), "")

    def test_empty_string_returns_empty_string(self):
        self.assertEqual(sanitize_csv_value(""), "")

    def test_whitespace_only_returns_empty(self):
        self.assertEqual(sanitize_csv_value("   "), "")

    def test_normal_string_unchanged(self):
        self.assertEqual(sanitize_csv_value("John Doe"), "John Doe")

    def test_normal_string_with_leading_space_preserved(self):
        # Function strips leading/trailing whitespace before checking prefix
        self.assertEqual(sanitize_csv_value("  Alice"), "Alice")

    def test_normal_string_with_trailing_space_preserved(self):
        self.assertEqual(sanitize_csv_value("Alice  "), "Alice")

    def test_formula_equals_prefix_neutralized(self):
        # OWASP critical: leading = triggers formula interpretation in Excel/Sheets
        result = sanitize_csv_value("=HYPERLINK(\"http://evil.com\")")
        self.assertEqual(result, "'=HYPERLINK(\"http://evil.com\")")

    def test_formula_plus_prefix_neutralized(self):
        # OWASP: + triggers formula in Excel
        result = sanitize_csv_value("+cmd")
        self.assertEqual(result, "'+cmd")

    def test_formula_minus_prefix_neutralized(self):
        # OWASP: - triggers formula in Excel
        result = sanitize_csv_value("-malicious")
        self.assertEqual(result, "'-malicious")

    def test_formula_at_prefix_neutralized(self):
        # OWASP: @ triggers formula in Excel
        result = sanitize_csv_value("@calc")
        self.assertEqual(result, "'@calc")

    def test_formula_tab_prefix_neutralized(self):
        # After strip(), leading tab is gone so no dangerous prefix remains
        result = sanitize_csv_value("\thidden")
        self.assertEqual(result, "hidden")

    def test_formula_carriage_return_prefix_neutralized(self):
        # After strip(), leading CR is gone so no dangerous prefix remains
        result = sanitize_csv_value("\rmalicious")
        self.assertEqual(result, "malicious")

    def test_numeric_string_not_prefixed(self):
        # Positive numerics are safe; negative sign triggers DANGEOUS_PREFIXES guard
        self.assertEqual(sanitize_csv_value("42"), "42")
        self.assertEqual(sanitize_csv_value("3.14"), "3.14")
        # - prefix is in DANGEOUS_PREFIXES, so negative numbers get neutralized
        self.assertEqual(sanitize_csv_value("-99.5"), "'-99.5")

    def test_integer_as_number_unchanged(self):
        self.assertEqual(sanitize_csv_value(42), "42")
        self.assertEqual(sanitize_csv_value(0), "0")

    def test_float_unchanged(self):
        self.assertEqual(sanitize_csv_value(3.14159), "3.14159")

    def test_boolean_unchanged(self):
        self.assertEqual(sanitize_csv_value(True), "True")
        self.assertEqual(sanitize_csv_value(False), "False")

    def test_single_quote_inside_value_not_escaped(self):
        # Single quote in the middle is not a prefix, should be kept as-is
        self.assertEqual(sanitize_csv_value("O'Brien"), "O'Brien")

    def test_double_quote_inside_value_unchanged(self):
        self.assertEqual(sanitize_csv_value('say "hi"'), 'say "hi"')

    def test_unicode_content_unchanged(self):
        self.assertEqual(sanitize_csv_value("\u4e2d\u6587"), "\u4e2d\u6587")


class TestSanitizeRow(unittest.TestCase):
    """Tests for sanitize_row."""

    def test_mixed_safe_and_dangerous_values(self):
        row = {
            "name": "Alice",
            "formula": "=HYPERLINK(...)",
            "count": 42,
            "note": "@mention",
        }
        result = sanitize_row(row)
        self.assertEqual(result["name"], "Alice")
        self.assertEqual(result["formula"], "'=HYPERLINK(...)")
        self.assertEqual(result["count"], "42")
        self.assertEqual(result["note"], "'@mention")

    def test_empty_row(self):
        result = sanitize_row({})
        self.assertEqual(result, {})

    def test_all_null_values(self):
        row = {"col1": None, "col2": None}
        result = sanitize_row(row)
        self.assertEqual(result["col1"], "")
        self.assertEqual(result["col2"], "")


class TestExportToCsvSafe(unittest.TestCase):
    """Tests for export_to_csv_safe."""

    def test_empty_data_returns_empty_string(self):
        self.assertEqual(export_to_csv_safe([]), "")

    def test_output_has_utf8_bom(self):
        # BOM is required for Excel UTF-8 compatibility
        result = export_to_csv_safe([{"name": "Alice", "age": 30}])
        self.assertTrue(result.startswith("\ufeff"))

    def test_header_row_included(self):
        result = export_to_csv_safe([{"name": "Alice", "age": 30}])
        self.assertIn("name", result)
        self.assertIn("age", result)

    def test_data_rows_included(self):
        result = export_to_csv_safe([{"name": "Alice", "age": 30}])
        self.assertIn("Alice", result)
        self.assertIn("30", result)

    def test_dangerous_formula_cell_in_output(self):
        data = [{"cell": "=HYPERLINK(...)"}]
        result = export_to_csv_safe(data)
        # Should have BOM + header + data with neutralized formula
        self.assertTrue(result.startswith("\ufeff"))
        self.assertIn("'=HYPERLINK(...)", result)

    def test_custom_fieldnames_order(self):
        data = [{"name": "Bob", "score": 99}]
        result = export_to_csv_safe(data, fieldnames=["score", "name"])
        # Header should match fieldnames order
        lines = result.split("\r\n")
        self.assertIn("score,name", lines[0])

    def test_multiple_rows(self):
        data = [
            {"name": "Alice", "score": 100},
            {"name": "Bob", "score": 85},
        ]
        result = export_to_csv_safe(data)
        self.assertIn("Alice", result)
        self.assertIn("Bob", result)
        self.assertIn("100", result)
        self.assertIn("85", result)


if __name__ == "__main__":
    unittest.main()
