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

def validate_extension_and_content(filepath):
    _, ext = os.path.splitext(filepath)
    if ext.lower() not in [".csv", ".txt"]:
        raise ValidationError(f"Invalid file extension '{ext}'. Only .csv and .txt are allowed.")
    
    if not os.path.exists(filepath):
        raise ValidationError(f"File not found: {filepath}")
        
    try:
        with open(filepath, 'rb') as f:
            header = f.read(4)
    except Exception as e:
        raise ValidationError(f"Failed to read file for validation: {e}")
        
    if header.startswith(b'MZ'):
        raise ValidationError("PE/MZ executable format is not allowed.")
        
    if header.startswith(b'\x7fELF'):
        raise ValidationError("ELF binary format is not allowed.")
        
    macho_magics = [
        b'\xfe\xed\xfa\xce',
        b'\xfe\xed\xfa\xcf',
        b'\xce\xfa\xed\xfe',
        b'\xcf\xfa\xed\xfe',
        b'\xca\xfe\xba\xbe'
    ]
    for magic in macho_magics:
        if header.startswith(magic):
            raise ValidationError("Mach-O binary format is not allowed.")
            
    if header.startswith(b'#!'):
        raise ValidationError("Shebang script headers are not allowed.")
