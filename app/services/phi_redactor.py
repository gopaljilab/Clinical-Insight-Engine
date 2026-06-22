"""
PHI Redactor Service

Provides privacy-preserving anonymization of clinical text and patient data structures.
Detects and redacts:
- Patient names
- Email addresses
- Phone numbers
- Dates
- Medical Record Numbers (MRNs) / Patient IDs
- Addresses (street addresses and zip codes)
"""
import re
from typing import Any, Union, Dict, List, Set


class PHIRedactor:
    """Service to detect and redact PHI from clinical text and data structures."""

    def __init__(self):
        # Email address pattern
        self.email_regex = re.compile(
            r'\b[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\b',
            re.IGNORECASE
        )

        # Phone number pattern: supports formats like +1-555-123-4567, (555) 123-4567, 5551234567
        self.phone_regex = re.compile(
            r'(?<!\d)(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)'
        )

        # Date pattern: supports 06/13/2026, 2026-06-13, June 13, 2026, 13 June 2026
        self.date_numeric_regex = re.compile(
            r'\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b'
        )
        months = (
            r'(?:January|February|March|April|May|June|July|August|September|'
            r'October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)'
        )
        self.date_text_regex1 = re.compile(
            r'\b' + months + r'\s+\d{1,2}(?:st|nd|rd|th)?(?:,)?\s+\d{4}\b',
            re.IGNORECASE
        )
        self.date_text_regex2 = re.compile(
            r'\b\d{1,2}(?:st|nd|rd|th)?\s+' + months + r'\s+\d{4}\b',
            re.IGNORECASE
        )

        # Patient ID / MRN indicator patterns (e.g. MRN: 123456, PatientID: ID-12345-X)
        self.mrn_indicator_regex = re.compile(
            r'\b(PatientID|MRN_ID|MRN|ID)[-:\s]+([A-Za-z0-9\-]{4,15})\b',
            re.IGNORECASE
        )
        # Standalone MRN style (e.g., MRN123456, MRN-123-456)
        self.mrn_standalone_regex = re.compile(
            r'\bMRN-?[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\b',
            re.IGNORECASE
        )

        # Address patterns (Street address and zip codes)
        self.street_regex1 = re.compile(
            r'\b\d+\s+[A-Za-z][a-zA-Z0-9\s\.\,]{1,50}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Plaza|Pl|Highway|Hwy|Circle|Cir)\b',
            re.IGNORECASE
        )
        self.street_regex2 = re.compile(
            r'\b\d+\s+(?:Avenue|Ave|Street|St|Road|Rd|Way|Drive|Dr|Boulevard|Blvd|Plaza|Pl)\s+of\s+the\s+[A-Z][a-zA-Z0-9\s]*\b',
            re.IGNORECASE
        )
        self.zip_regex = re.compile(r'\b\d{5}(?:-\d{4})?\b')

        # Heuristics for Patient Name detection in text
        # Sorted by length to avoid premature matches
        self.name_indicators = re.compile(
            r'\b(?:Patient Name|Patient|Name|Mrs\.|Mr\.|Ms\.)[-:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b'
        )

    def redact_text(self, text: str, known_names: Set[str] = None) -> str:
        """
        Redact PHI in a string of text.
        
        Args:
            text: Raw clinical text.
            known_names: Set of known patient names to redact explicitly.
            
        Returns:
            Redacted text.
        """
        if not text:
            return ""

        # 1. Redact known names first (longest names first to avoid partial matches)
        if known_names:
            sorted_names = sorted(list(known_names), key=len, reverse=True)
            escaped_names = [
                re.escape(name)
                for name in sorted_names
                if name and len(name) >= 2
            ]
            if escaped_names:
                combined_pattern = re.compile(
                    r'\b(' + '|'.join(escaped_names) + r')\b',
                    re.IGNORECASE
                )
                text = combined_pattern.sub("[PATIENT_NAME]", text)

        # 2. Redact emails
        text = self.email_regex.sub("[EMAIL]", text)

        # 3. Redact phone numbers
        text = self.phone_regex.sub("[PHONE]", text)

        # 4. Redact dates (excluding single years like 2026 if not in full date format)
        text = self.date_numeric_regex.sub("[DATE]", text)
        text = self.date_text_regex1.sub("[DATE]", text)
        text = self.date_text_regex2.sub("[DATE]", text)

        # 5. Redact Medical Record Numbers (MRN) / IDs
        # STANDALONE MRNs run first to clear them before prefix indicators can partially grab them
        text = self.mrn_standalone_regex.sub("[PATIENT_ID]", text)

        def mrn_replacer(match):
            prefix = match.group(1)
            val = match.group(2)
            if val.lower() in {"yes", "no", "male", "female", "other", "never", "former", "current"}:
                return match.group(0)
            if prefix.lower() == "id" and val.isdigit() and len(val) <= 2:
                return match.group(0)
            
            start_idx = match.group(0).index(val)
            return match.group(0)[:start_idx] + "[PATIENT_ID]"

        text = self.mrn_indicator_regex.sub(mrn_replacer, text)

        # 6. Redact Addresses
        text = self.street_regex1.sub("[ADDRESS]", text)
        text = self.street_regex2.sub("[ADDRESS]", text)
        text = self.zip_regex.sub("[ADDRESS]", text)

        # 7. Redact names based on indicators / patterns
        def name_replacer(match):
            full_match = match.group(0)
            captured_name = match.group(1)
            # Exclude indicator keywords or common value words
            if captured_name.lower() in {"yes", "no", "male", "female", "other", "never", "former", "current", "name", "patient", "mr", "mrs", "ms", "dr"}:
                return full_match
            start_idx = full_match.index(captured_name)
            return full_match[:start_idx] + "[PATIENT_NAME]"

        text = self.name_indicators.sub(name_replacer, text)

        return text

    def redact_patient_data(self, data: Any, known_names: Set[str] = None) -> Any:
        """
        Recursively traverse and redact PHI in patient dictionaries/lists/strings.
        
        Args:
            data: Arbitrary structure (dict, list, string, number, etc.)
            known_names: Set of known names to pass down.
            
        Returns:
            Anonymized/redacted structure.
        """
        if known_names is None:
            known_names = set()

        # If data is a dictionary, inspect key-value pairs
        if isinstance(data, dict):
            # Extract known patient names first before redacting
            local_names = set(known_names)
            for k in ["patientName", "patient_name", "patient"]:
                if k in data and isinstance(data[k], str) and data[k]:
                    local_names.add(data[k])

            redacted_dict = {}
            for k, v in data.items():
                if k in ["patientName", "patient_name"] and isinstance(v, str):
                    redacted_dict[k] = "[PATIENT_NAME]"
                elif k in ["email"] and isinstance(v, str):
                    redacted_dict[k] = "[EMAIL]"
                elif k in ["phone"] and isinstance(v, str):
                    redacted_dict[k] = "[PHONE]"
                elif k in ["dob", "dateOfBirth", "date"] and isinstance(v, str):
                    redacted_dict[k] = "[DATE]"
                elif k in ["patientId", "mrn", "id"] and isinstance(v, str) and not v.isdigit():
                    redacted_dict[k] = "[PATIENT_ID]"
                elif k in ["address"] and isinstance(v, str):
                    redacted_dict[k] = "[ADDRESS]"
                else:
                    redacted_dict[k] = self.redact_patient_data(v, local_names)
            return redacted_dict

        # If data is a list, process each element
        elif isinstance(data, list):
            return [self.redact_patient_data(item, known_names) for item in data]

        # If data is a string, redact it
        elif isinstance(data, str):
            return self.redact_text(data, known_names)

        # Other types remain unchanged
        return data
