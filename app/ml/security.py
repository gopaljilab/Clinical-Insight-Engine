import hmac
import hashlib
import os

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
