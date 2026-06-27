"""
Unit tests for app/ml/security.py — HMAC signature verification and safe pickle loading.
"""

import os
import sys
import tempfile
import pickle

import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from app.ml.security import (
    SafeUnpickler,
    safe_pickle_load,
    get_signing_secret,
    compute_signature,
    verify_signature,
    write_signature,
)


class TestSafeUnpickler:
    def test_allows_numpy_core_multiarray(self):
        """SafeUnpickler allows numpy.core.multiarray which is needed for numpy arrays."""
        import numpy as np
        arr = np.array([1, 2, 3])
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(pickle.dumps(arr))
            f.flush()
            try:
                with open(f.name, "rb") as fh:
                    result = safe_pickle_load(fh)
                assert result.tolist() == [1, 2, 3]
            finally:
                os.remove(f.name)

    def test_blocks_os_module(self):
        """SafeUnpickler rejects pickled os module references (RCE prevention)."""
        su = SafeUnpickler.__new__(SafeUnpickler)
        su.ALLOWED_MODULES = set()
        su.ALLOWED_MODULE_PREFIXES = []
        with pytest.raises(pickle.UnpicklingError, match="Refused to unpickle"):
            su.find_class("os", "system")

    def test_blocks_subprocess_module(self):
        """SafeUnpickler rejects subprocess module references."""
        su = SafeUnpickler.__new__(SafeUnpickler)
        with pytest.raises(pickle.UnpicklingError, match="Refused to unpickle"):
            su.find_class("subprocess", "Popen")

    def test_allows_numpy(self):
        """SafeUnpickler allows numpy module (whitelisted)."""
        su = SafeUnpickler.__new__(SafeUnpickler)
        # Should not raise
        result = su.find_class("numpy", "ndarray")
        assert result is not None

    def test_allows_sklearn_module_prefix(self):
        """SafeUnpickler allows sklearn. prefixed modules (prefix check logic)."""
        su = SafeUnpickler.__new__(SafeUnpickler)
        # Test the prefix check — sklearn.linear_model should pass the prefix check
        # without actually importing sklearn (which may not be installed in all envs)
        allowed = any("sklearn.linear_model".startswith(p) for p in su.ALLOWED_MODULE_PREFIXES)
        assert allowed is True
        # Also verify a non-whitelisted prefix fails
        denied = any("malicious.module".startswith(p) for p in su.ALLOWED_MODULE_PREFIXES)
        assert denied is False


class TestSignatureFunctions:
    def test_compute_signature_returns_hex_string(self):
        """compute_signature returns a hex digest string."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"hello world")
            f.flush()
            try:
                sig = compute_signature(f.name)
                assert isinstance(sig, str)
                assert len(sig) == 64  # SHA-256 hex length
                assert all(c in "0123456789abcdef" for c in sig)
            finally:
                os.remove(f.name)

    def test_compute_signature_is_deterministic(self):
        """compute_signature produces the same result for the same file content."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"test content")
            f.flush()
            try:
                sig1 = compute_signature(f.name)
                sig2 = compute_signature(f.name)
                assert sig1 == sig2
            finally:
                os.remove(f.name)

    def test_compute_signature_changes_with_content(self):
        """compute_signature changes when file content changes."""
        with tempfile.NamedTemporaryFile(delete=False) as f1:
            f1.write(b"content A")
            f1.flush()
            f1_name = f1.name
        with tempfile.NamedTemporaryFile(delete=False) as f2:
            f2.write(b"content B")
            f2.flush()
            f2_name = f2.name
        try:
            sig1 = compute_signature(f1_name)
            sig2 = compute_signature(f2_name)
            assert sig1 != sig2
        finally:
            os.remove(f1_name)
            os.remove(f2_name)

    def test_write_signature_creates_sideload_file(self):
        """write_signature creates a .sig sidecar file next to the target."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"hello")
            f.flush()
            f_name = f.name
        sig_name = f_name + ".sig"
        try:
            assert not os.path.exists(sig_name)
            write_signature(f_name)
            assert os.path.exists(sig_name)
            with open(sig_name) as fh:
                content = fh.read().strip()
            assert len(content) == 64
            # Should match what compute_signature returns
            assert content == compute_signature(f_name)
        finally:
            if os.path.exists(f_name):
                os.remove(f_name)
            if os.path.exists(sig_name):
                os.remove(sig_name)

    def test_verify_signature_returns_true_when_valid(self):
        """verify_signature returns True when .sig file matches current file content."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"test data")
            f.flush()
            f_name = f.name
        sig_name = f_name + ".sig"
        try:
            write_signature(f_name)
            result = verify_signature(f_name)
            assert result is True
        finally:
            if os.path.exists(f_name):
                os.remove(f_name)
            if os.path.exists(sig_name):
                os.remove(sig_name)

    def test_verify_signature_returns_false_when_missing(self):
        """verify_signature returns False when .sig file does not exist."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"test data")
            f.flush()
            f_name = f.name
        try:
            result = verify_signature(f_name)
            assert result is False
        finally:
            if os.path.exists(f_name):
                os.remove(f_name)

    def test_verify_signature_returns_false_when_tampered(self):
        """verify_signature returns False when file content does not match .sig."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"original content")
            f.flush()
            f_name = f.name
        sig_name = f_name + ".sig"
        try:
            write_signature(f_name)
            # Tamper with the file
            with open(f_name, "wb") as fh:
                fh.write(b"tampered content")
            result = verify_signature(f_name)
            assert result is False
        finally:
            if os.path.exists(f_name):
                os.remove(f_name)
            if os.path.exists(sig_name):
                os.remove(sig_name)

    def test_verify_signature_returns_false_for_corrupted_sig(self):
        """verify_signature returns False when .sig file content is corrupted."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"test data")
            f.flush()
            f_name = f.name
        sig_name = f_name + ".sig"
        try:
            write_signature(f_name)
            # Corrupt the .sig file
            with open(sig_name, "w") as fh:
                fh.write("bad_signature_data")
            result = verify_signature(f_name)
            assert result is False
        finally:
            if os.path.exists(f_name):
                os.remove(f_name)
            if os.path.exists(sig_name):
                os.remove(sig_name)


class TestGetSigningSecret:
    def test_get_signing_secret_returns_bytes(self):
        """get_signing_secret returns a bytes object."""
        result = get_signing_secret()
        assert isinstance(result, bytes)

    def test_get_signing_secret_uses_session_secret_when_set(self, monkeypatch):
        """get_signing_secret uses SESSION_SECRET env var when available."""
        monkeypatch.setenv("SESSION_SECRET", "my-test-secret")
        result = get_signing_secret()
        assert result == b"my-test-secret"

    def test_get_signing_secret_falls_back_to_jwt_secret(self, monkeypatch):
        """get_signing_secret falls back to JWT_SECRET when SESSION_SECRET is unset."""
        monkeypatch.delenv("SESSION_SECRET", raising=False)
        monkeypatch.setenv("JWT_SECRET", "jwt-test-secret")
        result = get_signing_secret()
        assert result == b"jwt-test-secret"

    def test_get_signing_secret_falls_back_to_dev_secret(self, monkeypatch):
        """get_signing_secret falls back to dev default when no env vars are set."""
        monkeypatch.delenv("SESSION_SECRET", raising=False)
        monkeypatch.delenv("JWT_SECRET", raising=False)
        result = get_signing_secret()
        assert result == b"clinical-insight-engine-dev-secret"
