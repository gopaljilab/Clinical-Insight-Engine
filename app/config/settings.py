"""
Configuration settings for the Clinical Insight Engine Python pipeline.
"""
import os

# Privacy/Anonymization feature flags
ENABLE_PHI_REDACTION = os.environ.get("ENABLE_PHI_REDACTION", "true").lower() == "true"
