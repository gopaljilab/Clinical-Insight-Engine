# jet.credentials -- Jetro Credential Vault helper
# Usage: from jet.credentials import get_credential, has_credential
import json, os

_CREDS_CACHE = None


def _load():
    global _CREDS_CACHE
    if _CREDS_CACHE is None:
        raw = os.environ.get("JET_CREDENTIALS", "{}")
        try:
            _CREDS_CACHE = json.loads(raw)
        except json.JSONDecodeError:
            _CREDS_CACHE = {}
    return _CREDS_CACHE


def get_credential(domain):
    """Get credential for a domain.

    Returns dict with: username, password, loginUrl, loginSelectors
    or None if not found. Supports partial domain matching.
    """
    creds = _load()
    if domain in creds:
        return creds[domain]
    for stored_domain, cred in creds.items():
        if domain.endswith(stored_domain) or stored_domain.endswith(domain):
            return cred
    return None


def has_credential(domain):
    """Check if a credential exists for the given domain."""
    return get_credential(domain) is not None


def get_all_credentials():
    """Get all available credentials as {domain: {username, password, ...}}."""
    return _load()
