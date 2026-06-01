"""
JWT Authentication Middleware

Protects clinical ML endpoints from unauthenticated access.
Validates Bearer JWT tokens on every protected request.
"""
import os
import logging
from functools import wraps
from typing import Optional

logger = logging.getLogger(__name__)

JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"


def _decode_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT token.
    Returns the payload dict or None if invalid.
    """
    try:
        import jwt
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except Exception as e:
        logger.warning(f"Token validation failed: {e}")
        return None


def extract_bearer_token(authorization_header: str) -> Optional[str]:
    """Extract token from 'Bearer <token>' header."""
    if not authorization_header:
        return None
    parts = authorization_header.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


# Flask decorator
def require_auth(f):
    """
    Flask route decorator that requires valid JWT authentication.

    Usage:
        @app.route("/predict", methods=["POST"])
        @require_auth
        def predict():
            ...
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            from flask import request, jsonify
            auth_header = request.headers.get("Authorization", "")
            token = extract_bearer_token(auth_header)

            if not token:
                return jsonify({"error": "Authentication required", "code": 401}), 401

            payload = _decode_token(token)
            if not payload:
                return jsonify({"error": "Invalid or expired token", "code": 401}), 401

            # Attach user info to request context
            request.current_user = payload
            return f(*args, **kwargs)
        except ImportError:
            logger.error("Flask not available — skipping auth decorator")
            return f(*args, **kwargs)
    return decorated
