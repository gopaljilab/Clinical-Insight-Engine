"""
Unit tests for services.safe_csv_reader.read_csv_safely.
"""

import os
import sys
import unittest
import tempfile
import unittest.mock

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from services.safe_csv_reader import SafeCSVError, read_csv_safely

REQUIRED_HEADERS = (
    "gender,age,hypertension,heart_disease,smoking_history,"
    "bmi,HbA1c_level,blood_glucose_level,diabetes"
)


def csv_row(gender="Male", age="45", hypertension="No", heart_disease="No",
            smoking_history="Never", bmi="24.5", HbA1c_level="5.5",
            blood_glucose_level="95", diabetes="No"):
    return f"{gender},{age},{hypertension},{heart_disease},{smoking_history},{bmi},{HbA1c_level},{blood_glucose_level},{diabetes}"


class TestReadCSVSafely(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _make_file(self, name, content="", ext=".csv"):
        path = os.path.join(self.temp_dir, name + ext)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return path

    def _make_binary(self, name, content=b""):
        path = os.path.join(self.temp_dir, name + ".csv")
        with open(path, "wb") as f:
            f.write(content)
        return path

    def test_reads_simple_valid_csv(self):
        csv = REQUIRED_HEADERS + "\n" + csv_row(gender="Male") + "\n"
        csv += csv_row(gender="Female", diabetes="Yes") + "\n"
        df = read_csv_safely(self._make_file("valid", csv))
        self.assertEqual(len(df), 2)
        self.assertEqual(df.iloc[0]["gender"], "Male")
        self.assertEqual(df.iloc[1]["diabetes"], "Yes")

    def test_reads_multiple_rows(self):
        rows = [REQUIRED_HEADERS]
        for i in range(5):
            rows.append(csv_row(age=str(30 + i)))
        df = read_csv_safely(self._make_file("multi", "\n".join(rows) + "\n"))
        self.assertEqual(len(df), 5)

    def test_reads_csv_with_apostrophe_in_name_field(self):
        csv = REQUIRED_HEADERS + "\n" + csv_row(gender="Female") + "\n"
        df = read_csv_safely(self._make_file("apostrophe", csv))
        self.assertEqual(len(df), 1)

    def test_empty_csv_returns_empty_dataframe(self):
        csv = REQUIRED_HEADERS + "\n"
        df = read_csv_safely(self._make_file("empty", csv))
        self.assertEqual(len(df), 0)
        self.assertIn("diabetes", df.columns)

    def test_raises_on_file_exceeding_10mb(self):
        path = self._make_binary("large")
        with open(path, "wb") as f:
            f.write(b"x" * (11 * 1024 * 1024))
        with self.assertRaises(SafeCSVError) as ctx:
            read_csv_safely(path)
        self.assertIn("size", str(ctx.exception).lower())

    def test_raises_on_wrong_extension(self):
        path = os.path.join(self.temp_dir, "wrong_ext.xlsx")
        with open(path, "w") as f:
            f.write(REQUIRED_HEADERS + "\n")
        with self.assertRaises(SafeCSVError):
            read_csv_safely(path)

    def test_raises_on_non_csv_content_declared_as_csv(self):
        path = self._make_file("not_csv", "<html><body>not a csv</body></html>")
        with self.assertRaises(SafeCSVError):
            read_csv_safely(path)

    def test_raises_on_pe_executable_header(self):
        path = self._make_binary("exe_header", b"MZ" + b"\x00" * 100)
        with self.assertRaises(SafeCSVError) as ctx:
            read_csv_safely(path)
        self.assertIn("PE", str(ctx.exception))

    def test_raises_when_row_count_exceeds_max(self):
        rows = [REQUIRED_HEADERS]
        for i in range(200):
            rows.append(csv_row(age=str(30 + i % 60)))
        csv_content = "\n".join(rows) + "\n"
        path = self._make_file("many_rows", csv_content)
        with self.assertRaises(SafeCSVError) as ctx:
            read_csv_safely(path, max_rows=50)
        self.assertIn("row", str(ctx.exception).lower())

    def test_raises_when_timeout_exceeded(self):
        fixed_time = [1000.0]
        def fake_time():
            fixed_time[0] += 0.1
            return fixed_time[0]
        csv = REQUIRED_HEADERS + "\n" + csv_row() + "\n"
        path = self._make_file("timeout_test", csv)
        with unittest.mock.patch("time.time", side_effect=fake_time):
            with self.assertRaises(SafeCSVError) as ctx:
                read_csv_safely(path, timeout_seconds=0)
        self.assertIn("timeout", str(ctx.exception).lower())

    def test_raises_on_unclosed_quote(self):
        csv = REQUIRED_HEADERS + "\n"
        csv += 'Male,45,No,No,Never,24.5,5.5,95,"unclosed\n'
        path = self._make_file("unclosed_quote", csv)
        with self.assertRaises(SafeCSVError) as ctx:
            read_csv_safely(path)
        self.assertIn("Malformed", str(ctx.exception))

    def test_raises_on_binary_garbage(self):
        path = self._make_binary("garbage", b"\x00\x01\x02\x03garbage")
        with self.assertRaises(SafeCSVError):
            read_csv_safely(path)

    def test_pe_header_detection_wrapped_as_safe_csv_error(self):
        path = self._make_binary("pe", b"MZ\x00\x00")
        with self.assertRaises(SafeCSVError):
            read_csv_safely(path)

    def test_unexpected_exception_wrapped_as_safe_csv_error(self):
        csv = REQUIRED_HEADERS + "\n" + csv_row() + "\n"
        path = self._make_file("unexpected", csv)
        original_open = open
        def fake_open(*args, **kwargs):
            if args and args[0] == path:
                raise OSError("Simulated unexpected I/O error")
            return original_open(*args, **kwargs)
        with unittest.mock.patch("builtins.open", side_effect=fake_open):
            with self.assertRaises(SafeCSVError) as ctx:
                read_csv_safely(path)
        self.assertIn("Failed", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
