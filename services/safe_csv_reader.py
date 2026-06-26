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
        
        # Read the file as raw bytes and sanitize
        try:
            with open(filepath, 'rb') as f:
                content_bytes = f.read()
            from app.utils.text_sanitizer import sanitize_text
            sanitized_content = sanitize_text(content_bytes, fallback_to_cp1252=True)
        except Exception as e:
            raise SafeCSVError(f"Failed to read and sanitize CSV: {str(e)}")
        
        # 3. Read Headers first to validate
        import io
        try:
            df_preview = pd.read_csv(
                io.StringIO(sanitized_content), 
                nrows=0,
                engine='c',
                on_bad_lines='error',
                low_memory=True
            )
            validate_headers(df_preview.columns)
        except Exception as e:
            if isinstance(e, ValidationError):
                raise
            raise ValidationError("Malformed CSV: Unable to parse headers")
            
        # 4. Chunked Reading
        chunks = []
        try:
            from app.utils.csv_sanitizer import sanitize_csv_value
            for chunk in pd.read_csv(
                io.StringIO(sanitized_content), 
                chunksize=chunksize,
                engine='c',
                on_bad_lines='error',
                low_memory=True
            ):
                guard.check_resource_limits(len(chunk))
                # Sanitize all string inputs against CSV injection
                for col in chunk.select_dtypes(include=['object']):
                    chunk[col] = chunk[col].apply(sanitize_csv_value)
                chunks.append(chunk)
            
            if not chunks:
                return pd.DataFrame(columns=list(df_preview.columns))
            
            result_df = pd.concat(chunks, ignore_index=True)
            try:
                del chunks, df_preview
                if 'chunk' in locals():
                    del chunk
                import gc
                gc.collect()
            except Exception:
                pass
            return result_df
            
        except ResourceExhaustedError as e:
            raise SafeCSVError(str(e))
        except pd.errors.ParserError as e:
            raise SafeCSVError(f"Malformed CSV structure: {str(e)}")
        except SyntaxError as e:
            raise SafeCSVError(f"Invalid CSV format: {str(e)}")
        except MemoryError:
            raise SafeCSVError("Server memory limit exceeded during processing")
            
    except (ValidationError, SafeCSVError) as e:
        # Re-raise wrapped errors
        raise SafeCSVError(str(e))
    except Exception as e:
        # Catch unexpected exceptions
        raise SafeCSVError(f"Unexpected error parsing CSV: {str(e)}")
