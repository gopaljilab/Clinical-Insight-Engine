import io
import os
import pickle
import tempfile

import pytest

from app.ml.security import (
    SafeUnpickler,
    compute_signature,
    get_signing_secret,
    safe_pickle_load,
    verify_signature,
    write_signature,
)


class TestSafeUnpickler:
    def test_allowed_module_builtins(self):
        """Built-in types from the 'builtins' module are allowed."""
        data = pickle.dumps({"key": "value"})
        result = SafeUnpickler(io.BytesIO(data)).load()
        assert result == {"key": "value"}

    def test_refuses_os_module(self):
        """Unpickling a class from the 'os' module raises UnpicklingError."""
        buf = io.BytesIO()
        with pytest.raises(pickle.UnpicklingError) as exc_info:
            SafeUnpickler(buf).find_class("os", "system")
        assert "forbidden module" in str(exc_info.value)

    def test_refuses_subprocess_module(self):
        """Unpickling a class from the 'subprocess' module raises UnpicklingError."""
        buf = io.BytesIO()
        with pytest.raises(pickle.UnpicklingError) as exc_info:
            SafeUnpickler(buf).find_class("subprocess", "Popen")
        assert "forbidden module" in str(exc_info.value)

    def test_refuses_unknown_module(self):
        """Unpickling a class from an arbitrary unknown module raises UnpicklingError."""
        buf = io.BytesIO()
        with pytest.raises(pickle.UnpicklingError) as exc_info:
            SafeUnpickler(buf).find_class("os", "path")
        assert "forbidden module" in str(exc_info.value)

    def test_allows_numpy_module(self):
        """numpy module is in the allowed prefix list and does not raise."""
        buf = io.BytesIO()
        # Should not raise
        SafeUnpickler(buf).find_class("numpy", "int64")


class TestSafePickleLoad:
    def test_loads_safe_pickle(self):
        """safe_pickle_load successfully deserializes a safe pickle stream."""
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pkl") as f:
            pickle.dump({"score": 0.85, "category": "HIGH"}, f)
            f.flush()
            with open(f.name, "rb") as fh:
                result = safe_pickle_load(fh)
            os.unlink(f.name)
        assert result == {"score": 0.85, "category": "HIGH"}


class TestComputeSignature:
    def test_returns_hex_digest(self):
        """compute_signature returns a 64-character hexadecimal string."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"test clinical data")
            f.flush()
            sig = compute_signature(f.name)
            os.unlink(f.name)
        assert len(sig) == 64
        assert all(c in "0123456789abcdef" for c in sig)

    def test_deterministic(self):
        """compute_signature is deterministic for the same file content."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"deterministic content")
            f.flush()
            sig1 = compute_signature(f.name)
            sig2 = compute_signature(f.name)
            os.unlink(f.name)
        assert sig1 == sig2

    def test_different_content_different_signature(self):
        """Different file contents produce different signatures."""
        with tempfile.NamedTemporaryFile(delete=False) as f1:
            f1.write(b"content a")
            f1.flush()
            sig1 = compute_signature(f1.name)

        with tempfile.NamedTemporaryFile(delete=False) as f2:
            f2.write(b"content b")
            f2.flush()
            sig2 = compute_signature(f2.name)
            os.unlink(f2.name)

        os.unlink(f1.name)
        assert sig1 != sig2


class TestVerifySignature:
    def test_returns_false_when_sig_file_missing(self):
        """verify_signature returns False when no .sig file exists."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"some content")
            f.flush()
            result = verify_signature(f.name)
            os.unlink(f.name)
        assert result is False

    def test_returns_true_for_valid_signature(self):
        """verify_signature returns True when the .sig matches the file content."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"matching content")
            f.flush()
            write_signature(f.name)
            result = verify_signature(f.name)
            os.unlink(f.name + ".sig")
            os.unlink(f.name)
        assert result is True

    def test_returns_false_for_tampered_signature(self):
        """verify_signature returns False when the .sig does not match content."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"original content")
            f.flush()
            write_signature(f.name)
            with open(f.name, "wb") as tf:
                tf.write(b"tampered content")
            result = verify_signature(f.name)
            os.unlink(f.name + ".sig")
            os.unlink(f.name)
        assert result is False


class TestWriteSignature:
    def test_creates_sig_file(self):
        """write_signature creates a .sig file next to the target file."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"some data")
            f.flush()
            sig_path = f.name + ".sig"
            if os.path.exists(sig_path):
                os.unlink(sig_path)
            write_signature(f.name)
            assert os.path.exists(sig_path)
            content = open(sig_path).read()
            assert len(content.strip()) == 64
            os.unlink(sig_path)
            os.unlink(f.name)
