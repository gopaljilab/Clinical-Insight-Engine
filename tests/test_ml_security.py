"""pytest unit tests for app/ml/security.py"""
import io
import os
import tempfile
import pytest
from pickle import UnpicklingError
from app.ml.security import (
    SafeUnpickler,
    safe_pickle_load,
    get_signing_secret,
    compute_signature,
    verify_signature,
    write_signature,
)


class TestSafeUnpickler:
    def test_find_class_allows_builtins_module(self):
        loader = SafeUnpickler(io.BytesIO())
        cls = loader.find_class("builtins", "str")
        assert cls is str

    def test_find_class_allows_numpy_module(self):
        loader = SafeUnpickler(io.BytesIO())
        cls = loader.find_class("numpy", "int64")
        assert cls is not None

    def test_find_class_allows_numpy_submodule(self):
        loader = SafeUnpickler(io.BytesIO())
        cls = loader.find_class("numpy.core.multiarray", "_reconstruct")
        assert cls is not None

    def test_find_class_rejects_os_module(self):
        loader = SafeUnpickler(io.BytesIO())
        with pytest.raises(UnpicklingError) as exc_info:
            loader.find_class("os", "system")
        assert "forbidden module" in str(exc_info.value)

    def test_find_class_rejects_subprocess_module(self):
        loader = SafeUnpickler(io.BytesIO())
        with pytest.raises(UnpicklingError) as exc_info:
            loader.find_class("subprocess", "run")
        assert "forbidden module" in str(exc_info.value)

    def test_find_class_rejects_arbitrary_unknown_module(self):
        loader = SafeUnpickler(io.BytesIO())
        with pytest.raises(UnpicklingError) as exc_info:
            loader.find_class("random", "module")
        assert "forbidden module" in str(exc_info.value)

    def test_find_class_allows_sklearn_prefix(self):
        pytest.importorskip("sklearn")
        loader = SafeUnpickler(io.BytesIO())
        cls = loader.find_class("sklearn.tree._classes", "DecisionTreeClassifier")
        assert cls is not None


class TestSafePickleLoad:
    def test_safe_pickle_load_with_safe_data(self):
        # Pickle a plain Python list (uses builtins)
        import pickle
        buf = io.BytesIO()
        pickler = pickle.Pickler(buf)
        pickler.dump([1, 2, 3])
        buf.seek(0)
        result = safe_pickle_load(buf)
        assert result == [1, 2, 3]

    def test_safe_pickle_load_uses_safe_unpickler(self):
        # Verify safe_pickle_load uses SafeUnpickler by checking it rejects os.system
        import pickle
        malicious_payload = (
            b"\x80\x04\x95\x18\x00\x00\x00\x00\x00\x00\x00"
            b"\x8c\x02os\x94\x8c\x06system\x93\x94\x8c\x04ls\x94\x85\x94."
        )
        buf = io.BytesIO(malicious_payload)
        with pytest.raises(UnpicklingError):
            safe_pickle_load(buf)


class TestGetSigningSecret:
    def test_returns_session_secret_when_set(self, monkeypatch):
        monkeypatch.setenv("SESSION_SECRET", "my-session-secret-key-that-is-long-enough")
        secret = get_signing_secret()
        assert secret == b"my-session-secret-key-that-is-long-enough"

    def test_returns_jwt_secret_when_session_not_set(self, monkeypatch):
        monkeypatch.delenv("SESSION_SECRET", raising=False)
        monkeypatch.setenv("JWT_SECRET", "my-jwt-secret-key-that-is-long-enough")
        secret = get_signing_secret()
        assert secret == b"my-jwt-secret-key-that-is-long-enough"

    def test_returns_dev_fallback_when_no_secrets_set(self, monkeypatch):
        monkeypatch.delenv("SESSION_SECRET", raising=False)
        monkeypatch.delenv("JWT_SECRET", raising=False)
        secret = get_signing_secret()
        assert secret == b"clinical-insight-engine-dev-secret"


class TestComputeSignature:
    def test_produces_sha256_hex_string(self):
        with tempfile.NamedTemporaryFile(mode="wb", delete=False) as f:
            f.write(b"hello world")
            f.flush()
            sig = compute_signature(f.name)
        assert all(c in "0123456789abcdef" for c in sig)
        assert len(sig) == 64  # SHA-256 hex

    def test_deterministic_same_content_same_signature(self):
        content = b"deterministic content"
        with tempfile.NamedTemporaryFile(mode="wb", delete=False) as f1:
            f1.write(content)
            path1 = f1.name
        with tempfile.NamedTemporaryFile(mode="wb", delete=False) as f2:
            f2.write(content)
            path2 = f2.name
        try:
            assert compute_signature(path1) == compute_signature(path2)
        finally:
            os.unlink(path1)
            os.unlink(path2)

    def test_different_content_produces_different_signature(self):
        with tempfile.NamedTemporaryFile(mode="wb", delete=False) as f1:
            f1.write(b"content A")
            path1 = f1.name
        with tempfile.NamedTemporaryFile(mode="wb", delete=False) as f2:
            f2.write(b"content B")
            path2 = f2.name
        try:
            assert compute_signature(path1) != compute_signature(path2)
        finally:
            os.unlink(path1)
            os.unlink(path2)

    def test_reads_file_in_chunks(self):
        # Large file (> 65536 bytes) to test chunked reading
        with tempfile.NamedTemporaryFile(mode="wb", delete=False) as f:
            f.write(b"x" * 100000)
            f.flush()
            path = f.name
        try:
            sig = compute_signature(path)
            assert len(sig) == 64
        finally:
            os.unlink(path)


class TestVerifySignature:
    def setup_method(self):
        self._created_files = []

    def teardown_method(self):
        for path in self._created_files:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass
            try:
                os.unlink(path + ".sig")
            except FileNotFoundError:
                pass

    def _make_file(self, content=b"test content"):
        f = tempfile.NamedTemporaryFile(mode="wb", delete=False)
        f.write(content)
        f.flush()
        self._created_files.append(f.name)
        return f.name

    def test_returns_true_when_sig_file_matches(self):
        path = self._make_file(b"file content")
        sig = compute_signature(path)
        with open(path + ".sig", "w") as sf:
            sf.write(sig)
        assert verify_signature(path) is True

    def test_returns_false_when_sig_file_is_missing(self):
        path = self._make_file(b"some content")
        assert verify_signature(path) is False

    def test_returns_false_when_content_has_changed(self):
        path = self._make_file(b"original content")
        sig = compute_signature(path)
        with open(path + ".sig", "w") as sf:
            sf.write(sig)
        # Modify the file after signing
        with open(path, "wb") as f2:
            f2.write(b"modified content")
        assert verify_signature(path) is False

    def test_returns_false_when_sig_file_corrupted(self):
        path = self._make_file(b"some content")
        with open(path + ".sig", "w") as sf:
            sf.write("invalid_hex_signature_garbage")
        assert verify_signature(path) is False


class TestWriteSignature:
    def setup_method(self):
        self._created_files = []

    def teardown_method(self):
        for path in self._created_files:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass
            try:
                os.unlink(path + ".sig")
            except FileNotFoundError:
                pass

    def _make_file(self, content=b"test content"):
        f = tempfile.NamedTemporaryFile(mode="wb", delete=False)
        f.write(content)
        f.flush()
        self._created_files.append(f.name)
        return f.name

    def test_creates_sig_file_next_to_target(self):
        path = self._make_file(b"test content for write")
        write_signature(path)
        assert os.path.exists(path + ".sig")
        with open(path + ".sig") as sf:
            assert sf.read().strip() == compute_signature(path)

    def test_overwrites_existing_sig_file(self):
        path = self._make_file(b"content")
        write_signature(path)
        with open(path + ".sig", "w") as sf:
            sf.write("old_sig_value")
        write_signature(path)
        with open(path + ".sig") as sf:
            assert sf.read().strip() != "old_sig_value"
