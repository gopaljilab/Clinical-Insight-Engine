import pandas as pd
from validation.csv_validator import validate_file_size, validate_headers, ValidationError, validate_extension_and_content
from services.resource_guard import ResourceGuard, ResourceExhaustedError

class SafeCSVError(Exception):
    pass

def read_csv_safely(filepath, chunksize=10000, max_rows=150000, timeout_seconds=30):
    try:
        # 1. Size & Extension/Content Validation
        validate_file_size(filepath)
        validate_extension_and_content(filepath)
        
        # 2. Resource Guard
        guard = ResourceGuard(max_rows=max_rows, timeout_seconds=timeout_seconds)
        
        # 3. Read Headers first to validate
        try:
            df_preview = pd.read_csv(filepath, nrows=0)
            validate_headers(df_preview.columns)
        except Exception as e:
            if isinstance(e, ValidationError):
                raise
            raise ValidationError("Malformed CSV: Unable to parse headers")
            
        # 4. Chunked Reading
        chunks = []
        try:
            from app.utils.csv_sanitizer import sanitize_csv_value
            for chunk in pd.read_csv(filepath, chunksize=chunksize):
                guard.check_resource_limits(len(chunk))
                # Sanitize all string inputs against CSV injection
                for col in chunk.select_dtypes(include=['object']):
                    chunk[col] = chunk[col].apply(sanitize_csv_value)
                chunks.append(chunk)
            
            if not chunks:
                return pd.DataFrame(columns=list(df_preview.columns))
            return pd.concat(chunks, ignore_index=True)
            
        except ResourceExhaustedError as e:
            raise SafeCSVError(str(e))
        except UnicodeDecodeError:
            raise SafeCSVError("Unsupported file encoding")
        except pd.errors.ParserError:
            raise SafeCSVError("Malformed CSV structure")
        except MemoryError:
            raise SafeCSVError("Server memory limit exceeded during processing")
            
    except (ValidationError, SafeCSVError) as e:
        # Re-raise wrapped errors
        raise SafeCSVError(str(e))
    except Exception as e:
        # Catch unexpected exceptions
        raise SafeCSVError(f"Unexpected error parsing CSV: {str(e)}")
