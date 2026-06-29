"""
Unit tests for app/middleware/auth.py — JWT bearer token extraction.
"""
import os
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from app.middleware.auth import extract_bearer_token


class TestExtractBearerToken:
    def test_valid_bearer_token(self):
        """Valid Bearer token header returns the token value."""
        result = extract_bearer_token("Bearer eyJhbGciOiJIUzI1NiJ9.test.signature")
        assert result == "eyJhbGciOiJIUzI1NiJ9.test.signature"

    def test_bearer_case_insensitive(self):
        """Bearer scheme is matched case-insensitively."""
        result = extract_bearer_token("bearer mytoken123")
        assert result == "mytoken123"
        result = extract_bearer_token("BEARER mytoken456")
        assert result == "mytoken456"

    def test_none_header_returns_none(self):
        """None authorization header returns None."""
        assert extract_bearer_token(None) is None

    def test_empty_string_returns_none(self):
        """Empty string authorization header returns None."""
        assert extract_bearer_token("") is None

    def test_basic_auth_scheme_returns_none(self):
        """Basic auth scheme returns None (wrong scheme)."""
        result = extract_bearer_token("Basic dXNlcjpwYXNz")
        assert result is None

    def test_bearer_without_token_returns_none(self):
        """Bearer with no token value (no space) returns None."""
        result = extract_bearer_token("Bearer")
        assert result is None

    def test_bearer_with_extra_parts_returns_none(self):
        """Bearer with more than 2 parts returns None."""
        result = extract_bearer_token("Bearer token extra")
        assert result is None

    def test_no_scheme_returns_none(self):
        """Header without a scheme returns None."""
        result = extract_bearer_token("just_a_token_string")
        assert result is None

    def test_bearer_with_trailing_space_only(self):
        """Bearer with only trailing whitespace (no actual token) returns None."""
        result = extract_bearer_token("Bearer ")
        assert result is None

    def test_bearer_with_newline_in_token(self):
        """Bearer token with newlines splits on whitespace, more than 2 parts -> None."""
        result = extract_bearer_token("Bearer token\nwith\nnewlines")
        assert result is None
