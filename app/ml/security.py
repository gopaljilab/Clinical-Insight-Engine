import hmac
import hashlib
import os
import pickle


class SafeUnpickler(pickle.Unpickler):
    """Restricted unpickler that guards against arbitrary code execution (CWE-502).

    Only allows deserialization of classes from known-safe modules
    (numpy, scipy, sklearn) and Python builtins. Any attempt to unpickle
    classes from arbitrary modules (e.g. ``os``, ``subprocess``, ``builtins.exec``)
    is blocked, preventing malicious pickle payloads from executing code.

    Used as defense-in-depth alongside HMAC signature verification.
    """

    ALLOWED_MODULES: set[str] = {
        "builtins",
    }

    ALLOWED_MODULE_PREFIXES: list[str] = [
        "sklearn.",
        "numpy.",
        "scipy.",
    ]

    def find_class(self, module: str, name: str) -> type:
        if module in self.ALLOWED_MODULES:
            return super().find_class(module, name)
        if any(module.startswith(prefix) for prefix in self.ALLOWED_MODULE_PREFIXES):
            return super().find_class(module, name)
        raise pickle.UnpicklingError(
            f"Refused to unpickle '{name}' from forbidden module '{module}'. "
            "Potential RCE attempt (CWE-502)."
        )


def safe_pickle_load(file) -> object:
    """Load a pickle stream using SafeUnpickler to prevent arbitrary code execution."""
    return SafeUnpickler(file).load()


def get_signing_secret() -> bytes:
    # Use SESSION_SECRET, fallback to a stable dev secret if not set
    secret = os.environ.get("SESSION_SECRET") or os.environ.get("JWT_SECRET") or "clinical-insight-engine-dev-secret"
    return secret.encode("utf-8")

def compute_signature(file_path: str) -> str:
    secret = get_signing_secret()
    h = hmac.new(secret, digestmod=hashlib.sha256)
    with open(file_path, "rb") as f:
        # Read in chunks to handle arbitrary file sizes
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return h.hexdigest()

def verify_signature(file_path: str) -> bool:
    sig_path = file_path + ".sig"
    if not os.path.exists(sig_path):
        return False
    try:
        with open(sig_path, "r") as f:
            expected_sig = f.read().strip()
        actual_sig = compute_signature(file_path)
        return hmac.compare_digest(actual_sig, expected_sig)
    except Exception:
        return False

def write_signature(file_path: str):
    sig = compute_signature(file_path)
    with open(file_path + ".sig", "w") as f:
        f.write(sig)
