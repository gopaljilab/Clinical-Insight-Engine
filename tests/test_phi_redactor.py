"""
Unit tests for the PHI Redaction service and middleware.
"""
import os
import sys
import unittest
from unittest.mock import patch
import pytest

# Ensure repository root is on the path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from app.services.phi_redactor import PHIRedactor
from app.middleware.phi_redaction import phi_redaction_middleware
from app.config import settings


class TestPHIRedactor(unittest.TestCase):
    """Test suite for the PHIRedactor service."""

    def setUp(self):
        self.redactor = PHIRedactor()

    def test_email_redaction(self):
        """Verify email addresses are properly redacted."""
        text = "Please send records to john.doe@example.com and jane_doe+test@gmail.org."
        expected = "Please send records to [EMAIL] and [EMAIL]."
        self.assertEqual(self.redactor.redact_text(text), expected)

    def test_phone_redaction(self):
        """Verify various phone number formats are redacted."""
        test_cases = [
            ("Call +1-555-123-4567 for info", "Call [PHONE] for info"),
            ("Reach us at 555-123-4567.", "Reach us at [PHONE]."),
            ("Dial (555) 123-4567 immediately", "Dial [PHONE] immediately"),
            ("Number: +15551234567", "Number: [PHONE]"),
            ("Dial 555.123.4567", "Dial [PHONE]"),
        ]
        for text, expected in test_cases:
            with self.subTest(text=text):
                self.assertEqual(self.redactor.redact_text(text), expected)

    def test_date_redaction(self):
        """Verify dash/slash dates and written dates are redacted."""
        test_cases = [
            ("DOB: 06/13/2026", "DOB: [DATE]"),
            ("Admitted on 2026-06-13", "Admitted on [DATE]"),
            ("Discharged: 6-13-26", "Discharged: [DATE]"),
            ("Date of birth: June 13, 2026", "Date of birth: [DATE]"),
            ("Born on 13 June 2026", "Born on [DATE]"),
            ("DOB: Jan 1, 1980", "DOB: [DATE]"),
        ]
        for text, expected in test_cases:
            with self.subTest(text=text):
                self.assertEqual(self.redactor.redact_text(text), expected)

    def test_patient_id_redaction(self):
        """Verify Medical Record Numbers (MRN) and patient IDs are redacted."""
        test_cases = [
            ("Patient MRN123456 has arrived", "Patient [PATIENT_ID] has arrived"),
            ("MRN: 99988877", "MRN: [PATIENT_ID]"),
            ("PatientID: ID-12345-X", "PatientID: [PATIENT_ID]"),
            ("Record MRN-999-123", "Record [PATIENT_ID]"),
        ]
        for text, expected in test_cases:
            with self.subTest(text=text):
                self.assertEqual(self.redactor.redact_text(text), expected)

    def test_address_redaction(self):
        """Verify street addresses and zip codes are redacted."""
        test_cases = [
            ("Lives at 123 Main Street, Boston", "Lives at [ADDRESS], Boston"),
            ("Address: 999 Broadway Blvd", "Address: [ADDRESS]"),
            ("Zip code is 02115-4432", "Zip code is [ADDRESS]"),
            ("Mail to 500 Avenue of the Americas, 10001", "Mail to [ADDRESS], [ADDRESS]"),
        ]
        for text, expected in test_cases:
            with self.subTest(text=text):
                self.assertEqual(self.redactor.redact_text(text), expected)

    def test_known_patient_name_redaction(self):
        """Verify known patient names are redacted from text when context is provided."""
        text = "John Doe is a 45-year-old male. Please review Doe's charts."
        known = {"John Doe", "Doe"}
        # Case insensitive word matching
        expected = "[PATIENT_NAME] is a 45-year-old male. Please review [PATIENT_NAME]'s charts."
        self.assertEqual(self.redactor.redact_text(text, known), expected)

        # Standalone name pattern heuristics (Patient: <Name>)
        text_with_indicator = "Patient Name: Mary Smith"
        self.assertEqual(self.redactor.redact_text(text_with_indicator), "Patient Name: [PATIENT_NAME]")

    def test_multiple_phi_entities(self):
        """Verify a clinical note containing multiple PHI elements is completely redacted."""
        note = (
            "Clinical Note:\n"
            "Patient: Jane Doe, DOB: 06/13/2026, MRN: MRN888777\n"
            "Phone: 555-123-4567, Email: jane.doe@example.com\n"
            "Address: 456 Oak Road, Boston, MA 02111\n"
            "Reason for visit: Diabetes screening."
        )
        expected = (
            "Clinical Note:\n"
            "Patient: [PATIENT_NAME], DOB: [DATE], MRN: [PATIENT_ID]\n"
            "Phone: [PHONE], Email: [EMAIL]\n"
            "Address: [ADDRESS], Boston, MA [ADDRESS]\n"
            "Reason for visit: Diabetes screening."
        )
        # Traversed as patient data (where Jane Doe is the known patient name)
        patient_data = {
            "patientName": "Jane Doe",
            "notes": note
        }
        redacted = self.redactor.redact_patient_data(patient_data)
        self.assertEqual(redacted["patientName"], "[PATIENT_NAME]")
        self.assertEqual(redacted["notes"], expected)

    def test_empty_input(self):
        """Verify empty string, None, and empty structures do not crash."""
        self.assertEqual(self.redactor.redact_text(""), "")
        self.assertEqual(self.redactor.redact_text(None), "")
        self.assertEqual(self.redactor.redact_patient_data({}), {})
        self.assertEqual(self.redactor.redact_patient_data(None), None)
        self.assertEqual(self.redactor.redact_patient_data([]), [])

    def test_large_note_input(self):
        """Verify performance and memory stability on extremely large notes."""
        import time
        # 10,000 characters note containing random PHI every few sentences
        single_block = "Patient: John Doe has MRN123456. Email is john@example.com. Phone is 555-123-4567. "
        large_note = single_block * 200 # ~16,000 characters
        
        start_time = time.time()
        redacted = self.redactor.redact_text(large_note, {"John Doe"})
        end_time = time.time()
        
        duration = end_time - start_time
        # Redaction should take less than 100ms
        self.assertLess(duration, 0.1)
        self.assertNotIn("John Doe", redacted)
        self.assertNotIn("MRN123456", redacted)
        self.assertNotIn("john@example.com", redacted)
        self.assertNotIn("555-123-4567", redacted)


class TestPHIRedactionMiddleware(unittest.TestCase):
    """Test suite for the PHI Redaction middleware decorator."""

    @phi_redaction_middleware
    def dummy_predict(self, model, scaler, features, input_data, cov_beta=None):
        return input_data

    @phi_redaction_middleware
    def dummy_predict_batch(self, model, scaler, features, input_data_list, cov_beta=None):
        return input_data_list

    def test_middleware_redacts_single_input(self):
        """Verify single patient record is redacted when passed to decorated function."""
        # When ENABLE_PHI_REDACTION is True (default)
        record = {
            "patientName": "Alice Smith",
            "age": 50,
            "email": "alice@hospital.org",
            "notes": "Patient Alice Smith (MRN999222) checked in on 2026-06-13."
        }
        
        result = self.dummy_predict(None, None, [], record)
        
        self.assertEqual(result["patientName"], "[PATIENT_NAME]")
        self.assertEqual(result["email"], "[EMAIL]")
        self.assertEqual(
            result["notes"],
            "Patient [PATIENT_NAME] ([PATIENT_ID]) checked in on [DATE]."
        )

    def test_middleware_redacts_batch_input(self):
        """Verify list of patient records is redacted when passed to decorated function."""
        records = [
            {
                "patientName": "Alice Smith",
                "email": "alice@hospital.org"
            },
            {
                "patientName": "Bob Jones",
                "email": "bob@hospital.org"
            }
        ]
        
        result = self.dummy_predict_batch(None, None, [], records)
        
        self.assertEqual(result[0]["patientName"], "[PATIENT_NAME]")
        self.assertEqual(result[0]["email"], "[EMAIL]")
        self.assertEqual(result[1]["patientName"], "[PATIENT_NAME]")
        self.assertEqual(result[1]["email"], "[EMAIL]")

    @patch("app.middleware.phi_redaction.ENABLE_PHI_REDACTION", False)
    def test_middleware_disabled_feature_flag(self):
        """Verify data passes through unchanged when ENABLE_PHI_REDACTION is False."""
        record = {
            "patientName": "Alice Smith",
            "email": "alice@hospital.org"
        }
        
        # We need to manually simulate settings being False or use patch
        with patch('app.config.settings.ENABLE_PHI_REDACTION', False):
            @phi_redaction_middleware
            def test_func(data):
                return data
                
            result = test_func(record)
            self.assertEqual(result["patientName"], "Alice Smith")
            self.assertEqual(result["email"], "alice@hospital.org")


if __name__ == "__main__":
    unittest.main()
