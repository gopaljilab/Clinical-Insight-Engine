"""
Tests for app/utils/csv_sanitizer.py
"""
import pytest
from app.utils.csv_sanitizer import sanitize_csv_value, DANGEROUS_PREFIXES


class TestDangerousPrefixes:
    def test_contains_formula_prefix_chars(self):
        # OWASP-recommended dangerous prefixes for CSV formula injection
        assert "=" in DANGEROUS_PREFIXES
        assert "+" in DANGEROUS_PREFIXES
        assert "-" in DANGEROUS_PREFIXES
        assert "@" in DANGEROUS_PREFIXES
        assert "\t" in DANGEROUS_PREFIXES
        assert "\r" in DANGEROUS_PREFIXES
        assert "\n" in DANGEROUS_PREFIXES


class TestSanitizeCsvValue:
    def test_passthrough_plain_alphanumeric(self):
        result = sanitize_csv_value("John Doe")
        assert result == "John Doe"

    def test_passthrough_numbers(self):
        result = sanitize_csv_value(12345)
        assert result == "12345"
        assert not result.startswith("'")

    def test_passthrough_float(self):
        result = sanitize_csv_value(3.14159)
        assert result == "3.14159"

    def test_none_returns_empty_string(self):
        result = sanitize_csv_value(None)
        assert result == ""

    def test_empty_string_returns_empty(self):
        result = sanitize_csv_value("")
        assert result == ""

    def test_formula_equals_prefix_neutralized(self):
        # =SUM(A1:A10) formula injection
        result = sanitize_csv_value("=SUM(A1:A10)")
        assert result.startswith("'")
        assert "=SUM" in result

    def test_formula_plus_prefix_neutralized(self):
        # +2-3 formula
        result = sanitize_csv_value("+2-3")
        assert result.startswith("'")
        assert "+2" in result

    def test_formula_minus_prefix_neutralized(self):
        # -2+3 formula
        result = sanitize_csv_value("-2+3")
        assert result.startswith("'")
        assert "-2" in result

    def test_formula_at_prefix_neutralized(self):
        # @SUM formula
        result = sanitize_csv_value("@calc")
        assert result.startswith("'")
        assert "@calc" in result

    def test_whitespace_trimmed_before_check(self):
        # "  =cmd" should be trimmed to "=cmd" then neutralized
        result = sanitize_csv_value("  =cmd  ")
        # After strip: "=cmd", first char is "=" so prefixed
        assert result.startswith("'")
        assert "=cmd" in result

    def test_whitespace_only_not_neutralized(self):
        result = sanitize_csv_value("  hello world  ")
        assert result == "hello world"
        assert not result.startswith("'")

    def test_leading_single_quote_preserved(self):
        # A literal single quote is NOT a dangerous prefix (the prefix list
        # contains the chars that START cells, not quote characters)
        result = sanitize_csv_value("'literal quote")
        assert result == "'literal quote"

    def test_tab_prefix_neutralized(self):
        result = sanitize_csv_value("\t=CMD")
        assert result.startswith("'")

    def test_carriage_return_prefix_neutralized(self):
        result = sanitize_csv_value("\r=DANGEROUS")
        assert result.startswith("'")

    def test_newline_prefix_neutralized(self):
        result = sanitize_csv_value("\n=DANGEROUS")
        assert result.startswith("'")

    def test_single_quote_only_not_modified(self):
        result = sanitize_csv_value("'")
        # A literal single quote is not in DANGEROUS_PREFIXES
        assert result == "'"

    def test_real_csv_safe_content(self):
        safe_content = [
            "John Doe",
            "45",
            "Male",
            "No known allergies",
            "2024-01-15",
        ]
        results = [sanitize_csv_value(v) for v in safe_content]
        # None should be modified (no leading formula chars)
        assert all(r == original for r, original in zip(results, safe_content))

    def test_injection_examples_from_owasp(self):
        # Common CSV injection payloads (all should be neutralized)
        payloads = [
            "=HYPERLINK(\"http://evil.com\")",
            "+SELECT+@+FROM+Users",
            "-2+3",
            "@IF(1=1,'T','F')",
            "\t=cmd|' /C calc'!A0",
        ]
        for payload in payloads:
            result = sanitize_csv_value(payload)
            assert result.startswith("'"), f"Payload not neutralized: {payload}"
