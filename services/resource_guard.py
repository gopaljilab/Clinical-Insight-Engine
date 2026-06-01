import time

class ResourceExhaustedError(Exception):
    pass

class ResourceGuard:
    def __init__(self, max_rows=150000, timeout_seconds=30):
        self.max_rows = max_rows
        self.timeout_seconds = timeout_seconds
        self.start_time = time.time()
        self.rows_processed = 0

    def check_time(self):
        if time.time() - self.start_time > self.timeout_seconds:
            raise ResourceExhaustedError("Processing timeout exceeded")
            
    def increment_rows(self, count):
        self.rows_processed += count
        if self.rows_processed > self.max_rows:
            raise ResourceExhaustedError(f"Maximum row count ({self.max_rows}) exceeded")
            
    def check_resource_limits(self, chunk_rows):
        self.check_time()
        self.increment_rows(chunk_rows)
