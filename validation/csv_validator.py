import os

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_ROWS = 150000

REQUIRED_HEADERS = {
    "gender", "age", "hypertension", "heart_disease", "smoking_history", 
    "bmi", "HbA1c_level", "blood_glucose_level", "diabetes"
}

class ValidationError(Exception):
    pass

def validate_file_size(filepath, max_size=None):
    if max_size is None:
        max_size = MAX_FILE_SIZE
    
    if not os.path.exists(filepath):
        raise ValidationError(f"File not found: {filepath}")
    
    file_size = os.path.getsize(filepath)
    if file_size > max_size:
        raise ValidationError(f"File exceeds maximum allowed size of {max_size / (1024*1024):.2f}MB")
        
def validate_headers(headers):
    missing = REQUIRED_HEADERS - set(headers)
    if missing:
        raise ValidationError(f"Missing required headers: {', '.join(missing)}")
