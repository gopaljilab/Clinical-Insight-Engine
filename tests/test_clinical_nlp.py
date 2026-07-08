"""
Unit tests for the BioBERT entity extraction pipeline (app/services/clinical_nlp.py).
"""

import os
import sys
import pytest
import types

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from app.services.clinical_nlp import BioBERTClinicalExtractor


class TestBioBERTClinicalExtractor:
    def test_extract_symptoms(self):
        """Verify that common symptoms are extracted correctly."""
        extractor = BioBERTClinicalExtractor()
        text = "Patient complains of severe polyuria, blurred vision, and persistent fatigue."
        result = extractor.extract(text)
        
        assert "polyuria" in result["symptoms"]
        assert "blurred vision" in result["symptoms"]
        assert "fatigue" in result["symptoms"]
        # Ensure no medications are incorrectly extracted
        assert len(result["medications"]) == 0

    def test_extract_medications(self):
        """Verify that common medications are extracted correctly."""
        extractor = BioBERTClinicalExtractor()
        text = "The patient was prescribed metformin 500mg and lisinopril daily."
        result = extractor.extract(text)
        
        assert "metformin" in result["medications"]
        assert "lisinopril" in result["medications"]
        # Ensure no symptoms are incorrectly extracted
        assert len(result["symptoms"]) == 0

    def test_extract_both(self):
        """Verify both symptoms and medications can be extracted from the same text."""
        extractor = BioBERTClinicalExtractor()
        text = "Symptoms include severe fever and cough. The patient takes aspirin."
        result = extractor.extract(text)
        
        assert "fever" in result["symptoms"]
        assert "cough" in result["symptoms"]
        assert "aspirin" in result["medications"]

    def test_empty_and_none_input(self):
        """Verify extraction handles empty/None/invalid inputs gracefully."""
        extractor = BioBERTClinicalExtractor()
        
        # Test None
        result_none = extractor.extract(None)
        assert result_none == {"symptoms": [], "medications": [], "model_name": "rule-based-extractor"}
        
        # Test empty string
        result_empty = extractor.extract("")
        assert result_empty == {"symptoms": [], "medications": [], "model_name": "rule-based-extractor"}

    def test_malformed_input_types(self):
        """Verify that non-string values return empty lists and do not crash the parser."""
        extractor = BioBERTClinicalExtractor()
        
        assert extractor.extract(12345) == {"symptoms": [], "medications": [], "model_name": "rule-based-extractor"}
        assert extractor.extract([]) == {"symptoms": [], "medications": [], "model_name": "rule-based-extractor"}
        assert extractor.extract({}) == {"symptoms": [], "medications": [], "model_name": "rule-based-extractor"}

    def test_case_insensitivity(self):
        """Verify extraction works regardless of letter case."""
        extractor = BioBERTClinicalExtractor()
        text = "METFORMIN and COUGH reported."
        result = extractor.extract(text)
        
        assert "metformin" in result["medications"]
        assert "cough" in result["symptoms"]

    def test_mock_transformers_pipeline(self):
        """Verify the pipeline reconstruction and categorization logic works when transformers is active."""
        mock_pipeline_called = False
        
        def mock_pipeline(task, model):
            nonlocal mock_pipeline_called
            mock_pipeline_called = True
            
            def run_ner(text):
                return [
                    {"word": "cough", "entity": "B-Disease"},
                    {"word": "met", "entity": "B-Chemical"},
                    {"word": "##form", "entity": "I-Chemical"},
                    {"word": "##in", "entity": "I-Chemical"},
                ]
            return run_ner
            
        # We manually patch the module structure to mock transformers and torch imports
        mock_transformers = types.ModuleType("transformers")
        mock_transformers.pipeline = mock_pipeline
        sys.modules["transformers"] = mock_transformers
        
        mock_torch = types.ModuleType("torch")
        sys.modules["torch"] = mock_torch
        
        try:
            extractor = BioBERTClinicalExtractor(use_transformers=True)
            result = extractor.extract("cough metformin")
            
            assert mock_pipeline_called is True
            assert "cough" in result["symptoms"]
            # Reconstructed from "met" + "##form" + "##in"
            assert "metformin" in result["medications"]
            assert "biobert-ner" in result["model_name"]
        finally:
            # Clean up sys.modules mock
            sys.modules.pop("transformers", None)
            sys.modules.pop("torch", None)
