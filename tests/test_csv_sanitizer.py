"""
Unit tests for the OWASP CSV injection prevention utility.
"""
import unittest
import sys
import os

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from app.utils.csv_sanitizer import sanitize_csv_value, sanitize_row, export_to_csv_safe


class TestSanitizeCsvValue(unittest.TestCase):
    """Test suite for sanitize_csv_value."""

    def test_null_input(self):
        """None input returns empty string."""
        self.assertEqual(sanitize_csv_value(None), "")

    def test_empty_string(self):
        """Empty string returns empty string."""
        self.assertEqual(sanitize_csv_value(""), "")
        self.assertEqual(sanitize_csv_value("  "), "")

    def test_normal_text(self):
        """Normal text without formula prefix passes through unchanged."""
        self.assertEqual(sanitize_csv_value("John Doe"), "John Doe")
        self.assertEqual(sanitize_csv_value("HbA1c: 6.5%"), "HbA1c: 6.5%")
        self.assertEqual(sanitize_csv_value("normal_value"), "normal_value")

    def test_positive_numeric_strings_not_modified(self):
        """Positive numeric-looking strings are not prepended with quote."""
        self.assertEqual(sanitize_csv_value("123"), "123")
        self.assertEqual(sanitize_csv_value("0"), "0")
        self.assertEqual(sanitize_csv_value("3.14159"), "3.14159")
        self.assertEqual(sanitize_csv_value("6.5"), "6.5")

    def test_negative_number_strings_escaped(self):
        """Negative number strings are escaped because they start with - (a dangerous prefix).
        Note: This is a known quirk of the implementation - the negative sign is treated
        as a formula prefix even though it is a valid numeric value."""
        self.assertEqual(sanitize_csv_value("-12.5"), "'-12.5")
        self.assertEqual(sanitize_csv_value("-99"), "'-99")
        self.assertEqual(sanitize_csv_value("-12.345"), "'-12.345")

    def test_integer_input(self):
        """Integer input is converted to string."""
        self.assertEqual(sanitize_csv_value(42), "42")
        self.assertEqual(sanitize_csv_value(0), "0")

    def test_equals_prefix(self):
        """Value starting with = gets single-quote prepended."""
        result = sanitize_csv_value("=HYPERLINK(\"http://evil.com\")")
        self.assertEqual(result, "'=HYPERLINK(\"http://evil.com\")")

    def test_plus_prefix(self):
        """Value starting with + gets single-quote prepended."""
        result = sanitize_csv_value("+cmd|'/c calc'!A0")
        self.assertEqual(result, "'+cmd|'/c calc'!A0")

    def test_minus_prefix(self):
        """Value starting with - gets single-quote prepended."""
        result = sanitize_csv_value("-1+1=2")
        self.assertEqual(result, "'-1+1=2")

    def test_at_prefix(self):
        """Value starting with @ gets single-quote prepended."""
        result = sanitize_csv_value("@SUM(1,2,3)")
        self.assertEqual(result, "'@SUM(1,2,3)")

    def test_whitespace_before_formula_prefix(self):
        """Leading whitespace is trimmed first, exposing formula prefix for escaping."""
        result = sanitize_csv_value("   =formula")
        self.assertEqual(result, "'=formula")

    def test_whitespace_normal_string(self):
        """Leading and trailing whitespace is trimmed on normal strings."""
        self.assertEqual(sanitize_csv_value("  normal  "), "normal")


class TestSanitizeRow(unittest.TestCase):
    """Test suite for sanitize_row."""

    def test_empty_row(self):
        """Empty dict returns empty dict."""
        result = sanitize_row({})
        self.assertEqual(result, {})

    def test_normal_row(self):
        """Normal values pass through."""
        row = {"name": "Alice", "age": "30", "bmi": "24.5"}
        result = sanitize_row(row)
        self.assertEqual(result, {"name": "Alice", "age": "30", "bmi": "24.5"})

    def test_row_with_formula_injection(self):
        """Formula injection cells are escaped in row."""
        row = {"name": "Bob", "formula": "=cmd|'/c calc'", "note": "@SUM(A1:A10)"}
        result = sanitize_row(row)
        self.assertEqual(result["name"], "Bob")
        self.assertEqual(result["formula"], "'=cmd|'/c calc'")
        self.assertEqual(result["note"], "'@SUM(A1:A10)")

    def test_row_with_none_values(self):
        """None values become empty string in row."""
        row = {"name": None, "age": 25, "note": None}
        result = sanitize_row(row)
        self.assertEqual(result["name"], "")
        self.assertEqual(result["age"], "25")
        self.assertEqual(result["note"], "")

    def test_row_preserves_keys(self):
        """sanitize_row preserves dict key order."""
        row = {"z": "z_val", "a": "a_val", "m": "m_val"}
        result = sanitize_row(row)
        self.assertEqual(list(result.keys()), ["z", "a", "m"])


class TestExportToCsvSafe(unittest.TestCase):
    """Test suite for export_to_csv_safe."""

    def test_empty_data(self):
        """Empty list returns empty string."""
        result = export_to_csv_safe([])
        self.assertEqual(result, "")

    def test_basic_export(self):
        """Basic dict export produces valid CSV."""
        data = [
            {"name": "Alice", "age": "30"},
            {"name": "Bob", "age": "25"},
        ]
        result = export_to_csv_safe(data)
        # Should contain BOM
        self.assertTrue(result.startswith("\ufeff"))
        # Should contain headers
        self.assertIn("name", result)
        self.assertIn("age", result)
        # Should contain data rows
        self.assertIn("Alice", result)
        self.assertIn("Bob", result)

    def test_export_with_formula_injection(self):
        """Formula injection in export data is escaped."""
        data = [
            {"cell": "=HYPERLINK(\"http://evil.com\")"},
            {"cell": "normal"},
        ]
        result = export_to_csv_safe(data)
        # The formula should be escaped with single quote
        self.assertIn("'=HYPERLINK", result)

    def test_custom_fieldnames(self):
        """Custom fieldnames override default key ordering."""
        data = [{"a": "1", "b": "2"}]
        result = export_to_csv_safe(data, fieldnames=["b", "a"])
        # The first column header should be 'b'
        self.assertIn("b", result.split("\r\n")[0])

    def test_bom_present(self):
        """UTF-8 BOM is prepended for Excel compatibility."""
        data = [{"name": "Test"}]
        result = export_to_csv_safe(data)
        self.assertEqual(result[0], "\ufeff")


if __name__ == "__main__":
    unittest.main()
