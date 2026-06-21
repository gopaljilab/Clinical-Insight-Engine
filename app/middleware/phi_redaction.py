"""
PHI Redaction Middleware

Python middleware decorator that automatically redacts PHI in function inputs.
"""
from functools import wraps
from app.config.settings import ENABLE_PHI_REDACTION
from app.services.phi_redactor import PHIRedactor


def phi_redaction_middleware(func):
    """
    Middleware decorator to redact PHI in patient records and clinical text.
    
    Checks ENABLE_PHI_REDACTION settings. If True, redacts PHI from all dict,
    list, and string parameters before calling the decorated function.
    Always sanitizes inputs to prevent pipeline crashes on encoding issues.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        from app.utils.text_sanitizer import sanitize_data

        # Always sanitize positional and keyword arguments first
        sanitized_args = tuple(sanitize_data(arg) for arg in args)
        sanitized_kwargs = {k: sanitize_data(v) for k, v in kwargs.items()}

        if not ENABLE_PHI_REDACTION:
            return func(*sanitized_args, **sanitized_kwargs)

        redactor = PHIRedactor()
        
        # Redact positional arguments
        redacted_args = []
        for arg in sanitized_args:
            # Check for standard parameters (model, scaler, features) that do not require redaction
            # These are typically non-dict, non-list, or structural parameters, but we must be
            # careful not to redact sklearn Model/Scaler classes or list of feature names.
            # We only redact list of input dicts, single input dicts, or clinical text strings.
            # If it's a list, check if it contains dicts or strings.
            if isinstance(arg, dict):
                redacted_args.append(redactor.redact_patient_data(arg))
            elif isinstance(arg, list) and len(arg) > 0 and isinstance(arg[0], (dict, str)):
                redacted_args.append(redactor.redact_patient_data(arg))
            elif isinstance(arg, str):
                # Only redact string argument if it's not a feature name or file path
                # Standard file paths or feature names don't look like PHI, but let's be safe:
                # if the string has multiple words or is clinical notes, redact it.
                if len(arg) > 30 or "@" in arg or any(ind in arg for ind in ["Name", "Patient", "MRN", "Phone", "Address"]):
                    redacted_args.append(redactor.redact_text(arg))
                else:
                    redacted_args.append(arg)
            else:
                redacted_args.append(arg)

        # Redact keyword arguments
        redacted_kwargs = {}
        for k, v in sanitized_kwargs.items():
            if k in ["input_data", "input_data_list", "patient_data", "data", "text", "notes"]:
                redacted_kwargs[k] = redactor.redact_patient_data(v)
            elif isinstance(v, (dict, list, str)) and k not in ["features", "model", "scaler"]:
                redacted_kwargs[k] = redactor.redact_patient_data(v)
            else:
                redacted_kwargs[k] = v

        return func(*redacted_args, **redacted_kwargs)
        
    return wrapper
