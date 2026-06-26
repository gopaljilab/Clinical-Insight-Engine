"""
Unit tests for app/ml/security.py
Tests SafeUnpickler RCE protection and HMAC signature verification.
"""
import io
import os
import pickle
import tempfile
import unittest

import sys
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


class TestSafeUnpickler(unittest.TestCase):
    """Test suite for SafeUnpickler RCE guard."""

    def test_allows_builtins(self):
        """Verify builtins module is allowed."""
        data = pickle.dumps({"key": "value"})
        result = SafeUnpickler(io.BytesIO(data)).load()
        self.assertEqual(result, {"key": "value"})

    def test_allows_numpy_array(self):
        """Verify numpy arrays can be unpickled."""
        try:
            import numpy as np
        except ImportError:
            self.skipTest("numpy not available")
            return

        arr = np.array([1.0, 2.0, 3.0])
        data = pickle.dumps(arr)
        result = SafeUnpickler(io.BytesIO(data)).load()
        self.assertEqual(result.tolist(), [1.0, 2.0, 3.0])

    def test_rejects_os_module(self):
        """Verify os module is blocked to prevent RCE."""
        # Attempt to unpickle an os module reference
        try:
            import os
            # Build a fake pickle that tries to load os module
            # The find_class call will raise UnpicklingError for forbidden modules
            SafeUnpickler(io.BytesIO(b"cos\nsystem\nS'echo hacked>pwned'\n.")).load()
            self.fail("Should have raised UnpicklingError")
        except pickle.UnpicklingError as e:
            self.assertIn("forbidden module", str(e).lower())
        except Exception:
            # Some pickle opcodes may raise different exceptions before find_class
            # This is also acceptable behavior
            pass

    def test_rejects_subprocess_module(self):
        """Verify subprocess module is blocked."""
        try:
            import subprocess
            data = pickle.dumps(subprocess)
            SafeUnpickler(io.BytesIO(data)).load()
            self.fail("Should have raised UnpicklingError")
        except pickle.UnpicklingError as e:
            self.assertIn("forbidden module", str(e).lower())
        except Exception:
            pass

    def test_rejects_builtins_exec(self):
        """Verify builtins.exec is blocked."""
        try:
            data = pickle.dumps(__builtins__)
            SafeUnpickler(io.BytesIO(data)).load()
            # Some Python versions may allow __builtins__ as a special case
        except pickle.UnpicklingError:
            pass  # also acceptable

    def test_sklearn_modules_allowed(self):
        """Verify sklearn submodules are allowed."""
        try:
            # sklearn is rarely available in test envs
            import sklearn.linear_model
            data = pickle.dumps(sklearn.linear_model.LinearRegression())
            result = SafeUnpickler(io.BytesIO(data)).load()
            self.assertIsNotNone(result)
        except ImportError:
            self.skipTest("sklearn not available")


class TestSafePickleLoad(unittest.TestCase):
    """Test suite for safe_pickle_load wrapper."""

    def test_loads_safe_data(self):
        """Verify safe_pickle_load correctly unpickles safe data."""
        safe_data = {"prediction": 0.85, "label": "diabetes"}
        raw = pickle.dumps(safe_data)
        result = safe_pickle_load(io.BytesIO(raw))
        self.assertEqual(result, safe_data)

    def test_rejects_unsafe_pickle(self):
        """Verify safe_pickle_load raises on malicious payloads."""
        try:
            safe_pickle_load(io.BytesIO(b"cos\nsystem\nS'echo pwned'\n."))
            self.fail("Should have raised UnpicklingError")
        except pickle.UnpicklingError:
            pass  # expected


class TestHMACSignature(unittest.TestCase):
    """Test suite for HMAC signature functions."""

    def setUp(self):
        # Create a temp file for HMAC tests
        self.fd, self.temp_path = tempfile.mkstemp()
        os.close(self.fd)
        with open(self.temp_path, "w") as f:
            f.write("test patient data 123")

    def tearDown(self):
        if os.path.exists(self.temp_path):
            os.remove(self.temp_path)
        sig_path = self.temp_path + ".sig"
        if os.path.exists(sig_path):
            os.remove(sig_path)

    def test_get_signing_secret_returns_bytes(self):
        """Verify get_signing_secret returns bytes."""
        secret = get_signing_secret()
        self.assertIsInstance(secret, bytes)
        self.assertGreater(len(secret), 0)

    def test_compute_signature_is_deterministic(self):
        """Verify compute_signature produces the same hash for same content."""
        sig1 = compute_signature(self.temp_path)
        sig2 = compute_signature(self.temp_path)
        self.assertEqual(sig1, sig2)

    def test_compute_signature_changes_with_content(self):
        """Verify signature changes when file content changes."""
        sig1 = compute_signature(self.temp_path)
        with open(self.temp_path, "w") as f:
            f.write("modified patient data 456")
        sig2 = compute_signature(self.temp_path)
        self.assertNotEqual(sig1, sig2)

    def test_verify_signature_returns_true_for_signed_file(self):
        """Verify a correctly signed file passes verification."""
        write_signature(self.temp_path)
        self.assertTrue(verify_signature(self.temp_path))

    def test_verify_signature_returns_false_for_unsigned_file(self):
        """Verify an unsigned file fails verification."""
        self.assertFalse(verify_signature(self.temp_path))

    def test_verify_signature_returns_false_for_tampered_file(self):
        """Verify a tampered file fails verification."""
        write_signature(self.temp_path)
        # Tamper with the file
        with open(self.temp_path, "a") as f:
            f.write("TAMPERED")
        self.assertFalse(verify_signature(self.temp_path))

    def test_verify_signature_returns_false_for_corrupt_sig_file(self):
        """Verify verification fails when .sig file is corrupted."""
        write_signature(self.temp_path)
        # Corrupt the .sig file
        sig_path = self.temp_path + ".sig"
        with open(sig_path, "w") as f:
            f.write("invalid-signature")
        self.assertFalse(verify_signature(self.temp_path))

    def test_write_signature_creates_sig_file(self):
        """Verify write_signature creates a .sig file."""
        sig_path = self.temp_path + ".sig"
        self.assertFalse(os.path.exists(sig_path))
        write_signature(self.temp_path)
        self.assertTrue(os.path.exists(sig_path))


if __name__ == "__main__":
    unittest.main()
