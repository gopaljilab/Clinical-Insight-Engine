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
    def test_returns_token_for_valid_bearer_header(self):
        """Standard Bearer token format should extract the token."""
        result = extract_bearer_token("Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.sig")
        assert result == "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.sig"

    def test_case_insensitive_bearer_accepted(self):
        """Bearer scheme should be accepted case-insensitively."""
        assert extract_bearer_token("bearer my-token") == "my-token"
        assert extract_bearer_token("BEARER my-token") == "my-token"
        assert extract_bearer_token("BeArEr my-token") == "my-token"

    def test_returns_none_for_none_header(self):
        """None input should return None."""
        assert extract_bearer_token(None) is None

    def test_returns_none_for_empty_string(self):
        """Empty string should return None."""
        assert extract_bearer_token("") is None

    def test_returns_none_for_basic_scheme(self):
        """Basic authentication scheme should return None."""
        result = extract_bearer_token("Basic dXNlcm5hbWU6cGFzc3dvcmQ=")
        assert result is None

    def test_returns_none_for_bearer_with_no_token(self):
        """Malformed Bearer header with no token should return None."""
        assert extract_bearer_token("Bearer") is None

    def test_returns_none_for_single_word_header(self):
        """Single word without scheme should return None."""
        assert extract_bearer_token("just-a-token") is None

    def test_returns_token_with_special_characters(self):
        """Token containing dots, dashes, underscores should be extracted."""
        result = extract_bearer_token("Bearer abc-def_ghi.jkl.mno")
        assert result == "abc-def_ghi.jkl.mno"

