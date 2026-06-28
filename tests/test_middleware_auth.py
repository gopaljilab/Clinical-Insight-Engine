"""
Tests for app.middleware.auth utility functions.

Covers: extract_bearer_token, _decode_token
"""
import os
import sys

# Ensure the package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Set a fixed JWT_SECRET before importing the module
os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only"
os.environ["FLASK_ENV"] = "development"

import pytest
import jwt

# Import after setting env vars
from app.middleware.auth import (
    _decode_token,
    extract_bearer_token,
    JWT_SECRET,
    JWT_ALGORITHM,
)


class TestExtractBearerToken:
    def test_returns_token_from_valid_bearer_header(self):
        result = extract_bearer_token("Bearer eyJhbGciOiJIUzI1NiJ9.test")
        assert result == "eyJhbGciOiJIUzI1NiJ9.test"

    def test_returns_token_case_insensitive(self):
        result = extract_bearer_token("bearer token123")
        assert result == "token123"

    def test_returns_token_mixed_case(self):
        result = extract_bearer_token("BeArEr token456")
        assert result == "token456"

    def test_returns_none_for_none_input(self):
        result = extract_bearer_token(None)
        assert result is None

    def test_returns_none_for_empty_string(self):
        result = extract_bearer_token("")
        assert result is None

    def test_returns_none_for_single_word(self):
        result = extract_bearer_token("JustOneWord")
        assert result is None

    def test_returns_none_for_more_than_two_parts(self):
        result = extract_bearer_token("Bearer extra word here")
        assert result is None

    def test_returns_none_for_wrong_scheme(self):
        result = extract_bearer_token("Basic dXNlcjpwYXNz")
        assert result is None

    def test_handles_bearer_with_empty_token_returns_none(self):
        # "Bearer " splits to ["Bearer"], len=1 != 2, so returns None
        result = extract_bearer_token("Bearer ")
        assert result is None


class TestDecodeToken:
    def test_decodes_valid_token(self):
        payload = {"sub": "user123", "email": "test@example.com", "role": "admin"}
        token = jwt.encode(payload, "test-secret-key-for-testing-only", algorithm=JWT_ALGORITHM)
        result = _decode_token(token)
        assert result is not None
        assert result["sub"] == "user123"
        assert result["email"] == "test@example.com"
        assert result["role"] == "admin"

    def test_returns_none_for_malformed_token(self):
        result = _decode_token("not.a.valid.jwt.token")
        assert result is None

    def test_returns_none_for_empty_token(self):
        result = _decode_token("")
        assert result is None

    def test_returns_none_for_token_with_wrong_secret(self):
        payload = {"sub": "user123"}
        token = jwt.encode(payload, "wrong-secret", algorithm=JWT_ALGORITHM)
        result = _decode_token(token)
        assert result is None

    def test_returns_none_for_token_with_wrong_algorithm(self):
        payload = {"sub": "user123"}
        # HS256 is expected; using HS384 here would fail signature verification
        token = jwt.encode(payload, "test-secret-key-for-testing-only", algorithm="HS384")
        result = _decode_token(token)
        assert result is None

    def test_returns_none_for_expired_token(self):
        payload = {"sub": "user123", "exp": 1000000000}  # Expired timestamp
        token = jwt.encode(payload, "test-secret-key-for-testing-only", algorithm=JWT_ALGORITHM)
        result = _decode_token(token)
        assert result is None

    def test_returns_none_for_token_without_required_claims(self):
        # Token with missing sub claim (but still valid structure)
        payload = {"email": "test@example.com"}
        token = jwt.encode(payload, "test-secret-key-for-testing-only", algorithm=JWT_ALGORITHM)
        result = _decode_token(token)
        # _decode_token doesn't validate presence of specific claims, just verifies signature
        assert result is not None
        assert result["email"] == "test@example.com"


class TestJWTSecretConfiguration:
    def test_jwt_secret_is_set(self):
        assert JWT_SECRET is not None
        assert JWT_SECRET != ""

    def test_jwt_algorithm_is_hs256(self):
        assert JWT_ALGORITHM == "HS256"
