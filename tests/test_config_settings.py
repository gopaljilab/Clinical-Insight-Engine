"""
Unit tests for app/config/settings.py — configuration defaults and env var overrides.
"""
import os
import sys
from unittest import mock

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)


class TestConfigSettings:
    def test_enable_phi_redaction_defaults_to_true(self):
        """ENABLE_PHI_REDACTION defaults to True when the env var is not set."""
        with mock.patch.dict(os.environ, {}, clear=True):
            # Re-import to pick up the mocked environment
            import importlib
            import app.config.settings as settings_module
            importlib.reload(settings_module)
            assert settings_module.ENABLE_PHI_REDACTION is True

    def test_enable_phi_redaction_true_when_env_var_is_true(self):
        """ENABLE_PHI_REDACTION is True when env var is 'true'."""
        with mock.patch.dict(os.environ, {"ENABLE_PHI_REDACTION": "true"}, clear=True):
            import importlib
            import app.config.settings as settings_module
            importlib.reload(settings_module)
            assert settings_module.ENABLE_PHI_REDACTION is True

    def test_enable_phi_redaction_false_when_env_var_is_false(self):
        """ENABLE_PHI_REDACTION is False when env var is 'false'."""
        with mock.patch.dict(os.environ, {"ENABLE_PHI_REDACTION": "false"}, clear=True):
            import importlib
            import app.config.settings as settings_module
            importlib.reload(settings_module)
            assert settings_module.ENABLE_PHI_REDACTION is False

    def test_enable_phi_redaction_false_when_env_var_is_0(self):
        """ENABLE_PHI_REDACTION is False when env var is '0'."""
        with mock.patch.dict(os.environ, {"ENABLE_PHI_REDACTION": "0"}, clear=True):
            import importlib
            import app.config.settings as settings_module
            importlib.reload(settings_module)
            assert settings_module.ENABLE_PHI_REDACTION is False

    def test_enable_phi_redaction_true_for_uppercase_true(self):
        """ENABLE_PHI_REDACTION is True when env var is 'TRUE' (uppercase)."""
        with mock.patch.dict(os.environ, {"ENABLE_PHI_REDACTION": "TRUE"}, clear=True):
            import importlib
            import app.config.settings as settings_module
            importlib.reload(settings_module)
            assert settings_module.ENABLE_PHI_REDACTION is True

    def test_enable_phi_redaction_false_for_non_boolean_strings(self):
        """Non-boolean string values default to False."""
        with mock.patch.dict(os.environ, {"ENABLE_PHI_REDACTION": "disabled"}, clear=True):
            import importlib
            import app.config.settings as settings_module
            importlib.reload(settings_module)
            assert settings_module.ENABLE_PHI_REDACTION is False
