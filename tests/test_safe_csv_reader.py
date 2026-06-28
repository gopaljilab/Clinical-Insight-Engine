"""
Unit tests for services/safe_csv_reader.py
"""
import os
import tempfile
import pytest
import pandas as pd
from services.safe_csv_reader import read_csv_safely, SafeCSVError


class TestReadCSVSafely:
    """Tests for read_csv_safely()."""

    def _write_csv(self, content: str, suffix=".csv") -> str:
        """Write content to a temporary CSV file and return the path."""
        fd, path = tempfile.mkstemp(suffix=suffix, prefix="test_csv_")
        os.write(fd, content.encode("utf-8"))
        os.close(fd)
        return path

    def teardown_method(self, method):
        """Clean up any temp files referenced in the test."""
        pass

    # Required columns per validate_headers (clinical dataset)
    REQUIRED_HEADERS = "diabetes,gender,hypertension,blood_glucose_level,heart_disease,bmi,smoking_history,HbA1c_level,age\n"

    def test_valid_csv_is_read_successfully(self):
        """A well-formed CSV is parsed into a DataFrame with correct columns."""
        content = self.REQUIRED_HEADERS + "0,Female,0,120,0,24.5,never,5.2,42\n"
        path = self._write_csv(content)

        try:
            df = read_csv_safely(path)
            assert isinstance(df, pd.DataFrame)
            assert len(df) == 1
            assert df.iloc[0]["gender"] == "Female"
            assert float(df.iloc[0]["age"]) == 42
        finally:
            os.unlink(path)

    def test_csv_with_whitespace_is_handled(self):
        """CSV with extra whitespace in cells is parsed correctly."""
        content = self.REQUIRED_HEADERS + "0,Female,0,120,0,24.5,never,5.2,  42  \n"
        path = self._write_csv(content)

        try:
            df = read_csv_safely(path)
            assert len(df) == 1
            assert "age" in df.columns
        finally:
            os.unlink(path)

    def test_empty_csv_returns_empty_dataframe(self):
        """A CSV with only headers and no data rows returns an empty DataFrame."""
        path = self._write_csv(self.REQUIRED_HEADERS)

        try:
            df = read_csv_safely(path)
            assert isinstance(df, pd.DataFrame)
            assert len(df) == 0
        finally:
            os.unlink(path)

    def test_non_csv_extension_raises_safe_csv_error(self):
        """A file with a non-.csv extension raises SafeCSVError."""
        content = self.REQUIRED_HEADERS + "0,Female,0,120,0,24.5,never,5.2,42\n"
        path = self._write_csv(content, suffix=".json")

        try:
            with pytest.raises(SafeCSVError):
                read_csv_safely(path)
        finally:
            os.unlink(path)

    def test_invalid_csv_structure_raises_safe_csv_error(self):
        """A CSV with unclosed quotes causes a parsing error."""
        # Unclosed quote in a CSV field causes pandas to raise ParserError
        content = self.REQUIRED_HEADERS + '0,Female,0,120,0,24.5,never,5.2,42,"unclosed\n'
        path = self._write_csv(content)

        try:
            with pytest.raises(SafeCSVError) as excinfo:
                read_csv_safely(path)
            assert "SafeCSVError" in type(excinfo.value).__name__ or "CSV" in str(excinfo.value)
        finally:
            os.unlink(path)

    def test_oversized_file_raises_safe_csv_error(self):
        """A file exceeding the row limit raises SafeCSVError."""
        # Build a CSV with more rows than max_rows (set to 3)
        data_rows = "".join([
            "0,Female,0,120,0,24.5,never,5.2,30\n" for _ in range(5)
        ])
        content = self.REQUIRED_HEADERS + data_rows
        path = self._write_csv(content)

        try:
            with pytest.raises(SafeCSVError) as excinfo:
                read_csv_safely(path, max_rows=3)
            assert "row" in str(excinfo.value).lower() or "limit" in str(excinfo.value).lower()
        finally:
            os.unlink(path)

    def test_timeout_raises_safe_csv_error(self):
        """A file processed beyond the timeout raises SafeCSVError."""
        content = self.REQUIRED_HEADERS + "0,Female,0,120,0,24.5,never,5.2,30\n"
        path = self._write_csv(content)

        try:
            with pytest.raises(SafeCSVError) as excinfo:
                read_csv_safely(path, timeout_seconds=0)
            assert "timeout" in str(excinfo.value).lower()
        finally:
            os.unlink(path)

    def test_resource_guard_row_count_exceeded_raises_safe_csv_error(self):
        """ResourceGuard raises ResourceExhaustedError when row limit is exceeded."""
        from services.resource_guard import ResourceGuard, ResourceExhaustedError

        guard = ResourceGuard(max_rows=3, timeout_seconds=30)
        with pytest.raises(ResourceExhaustedError):
            guard.increment_rows(10)

    def test_resource_guard_time_exceeded_raises_safe_csv_error(self):
        """ResourceGuard raises ResourceExhaustedError when time limit is exceeded."""
        import time
        from services.resource_guard import ResourceGuard, ResourceExhaustedError

        guard = ResourceGuard(max_rows=150000, timeout_seconds=0)
        with pytest.raises(ResourceExhaustedError):
            guard.check_time()

    def test_safe_csv_error_class_exists(self):
        """SafeCSVError is a subclass of Exception."""
        from services.safe_csv_reader import SafeCSVError
        err = SafeCSVError("test message")
        assert isinstance(err, Exception)
        assert str(err) == "test message"

    def test_read_csv_safely_with_custom_chunksize(self):
        """A valid CSV is processed correctly with a custom chunksize."""
        data = "".join([
            f"0,Female,0,120,0,24.5,never,5.2,{i}\n" for i in range(3)
        ])
        content = self.REQUIRED_HEADERS + data
        path = self._write_csv(content)

        try:
            df = read_csv_safely(path, chunksize=2)
            assert isinstance(df, pd.DataFrame)
            assert len(df) == 3
        finally:
            os.unlink(path)

    def test_safe_csv_error_wraps_validation_error(self):
        """SafeCSVError wraps ValidationError from csv_validator."""
        content = "x,y\n1,2\n"
        path = self._write_csv(content, suffix=".pdf")  # invalid extension

        try:
            with pytest.raises(SafeCSVError):
                read_csv_safely(path)
        finally:
            os.unlink(path)
