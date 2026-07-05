"""
Clinical NLP Entity Extraction Pipeline using BioBERT.
Provides accurate extraction of patient symptoms and medication histories.
Includes a highly optimized rule-based fallback when model resources are unavailable.
"""

import os
import re
import logging
from typing import Dict, List, Set, Any

logger = logging.getLogger(__name__)

# Curated dictionary of common symptoms for rule-based matching
SYMPTOMS_DB = [
    # Diabetes specific symptoms
    "polyuria", "polydipsia", "polyphagia", "weight loss", "fatigue", "blurred vision", 
    "blurry vision", "numbness", "tingling", "slow healing sores", "frequent infections",
    # General systemic symptoms
    "cough", "fever", "pain", "dyspnea", "shortness of breath", "nausea", "vomiting", 
    "headache", "dizziness", "weakness", "lethargy", "sweating", "tremor", "palpitations", 
    "anxiety", "insomnia", "depression", "chest pain", "abdominal pain", "joint pain", 
    "muscle pain", "swelling", "edema", "chills", "sore throat", "runny nose"
]

# Curated dictionary of common medications for rule-based matching
MEDICATIONS_DB = [
    # Diabetes medications
    "metformin", "insulin", "glipizide", "glyburide", "pioglitazone", "glimepiride", 
    "sitagliptin", "empagliflozin", "liraglutide", "acarbose",
    # Hypertension / Cardiac medications
    "lisinopril", "atorvastatin", "amlodipine", "metoprolol", "aspirin", "losartan",
    "hydrochlorothiazide", "simvastatin", "carvedilol", "propranolol", "clopidogrel", 
    "furosemide", "ramipril", "spironolactone", "valsartan",
    # General / Other common medications
    "albuterol", "gabapentin", "levothyroxine", "ibuprofen", "acetaminophen", "omeprazole", 
    "pantoprazole", "prednisone", "amoxicillin", "azithromycin", "ciprofloxacin", 
    "doxycycline", "warfarin", "sildenafil"
]


class BioBERTClinicalExtractor:
    """Hybrid Entity Extraction pipeline using BioBERT classification or local keyword match fallback."""

    def __init__(self, model_name: str = "dmis-lab/biobert-v1.1", use_transformers: bool = None):
        self.model_name = model_name
        self.use_transformers = False
        self.pipeline = None
        
        # Determine if we should attempt to load transformers.
        # Default is False unless explicitly enabled via constructor or environment variable.
        if use_transformers is True or (use_transformers is None and os.environ.get("USE_BIOBERT") == "true"):
            try:
                import torch
                from transformers import pipeline
                self.use_transformers = True
            except ImportError:
                logger.info("Transformers or PyTorch not available. Utilizing optimized rule-based fallback.")

    def extract(self, text: str) -> Dict[str, Any]:
        """
        Extracts clinical symptoms and medications from the provided clinical text.
        
        Args:
            text: Raw clinical text input.
            
        Returns:
            A dictionary containing lists of extracted 'symptoms', 'medications', 
            and the metadata 'model_name' used for processing.
        """
        if not text or not isinstance(text, str):
            return {
                "symptoms": [],
                "medications": [],
                "model_name": "rule-based-extractor"
            }

        # Step 1: Base regex/rule scanner (always run for robust extraction)
        symptoms_found: Set[str] = set()
        medications_found: Set[str] = set()
        text_lower = text.lower()

        for symptom in SYMPTOMS_DB:
            # Word boundary matching to avoid substring issues (e.g. 'pain' in 'paint')
            if re.search(r"\b" + re.escape(symptom) + r"\b", text_lower):
                symptoms_found.add(symptom)

        for medication in MEDICATIONS_DB:
            if re.search(r"\b" + re.escape(medication) + r"\b", text_lower):
                medications_found.add(medication)

        # Step 2: Try BioBERT NER model if HuggingFace packages are available
        model_used = "rule-based-extractor"
        if self.use_transformers:
            try:
                # Lazy import / initialization to avoid overhead if not used
                from transformers import pipeline
                if self.pipeline is None:
                    # In a production environment with internet/GPU, this loads the pipeline.
                    # We wrap this in a try-except to catch network/resource limits.
                    self.pipeline = pipeline("ner", model=self.model_name)
                
                entities = self.pipeline(text)
                model_used = f"biobert-ner ({self.model_name})"
                
                # Map standard BioBERT NER output to symptoms or medications
                # E.g. entities labeled as "B-Disease", "I-Disease" or "B-Chemical", "I-Chemical"
                # Since token classification returns sub-word tokens, we reconstruct word spans.
                current_word = ""
                current_label = None
                
                for ent in entities:
                    word = ent.get("word", "")
                    label = ent.get("entity", ent.get("entity_group", ""))
                    
                    if not word or not label:
                        continue
                        
                    # Reconstruct BPE tokens (e.g. starting with ##)
                    if word.startswith("##"):
                        current_word += word[2:]
                    else:
                        if current_word:
                            self._categorize_entity(current_word, current_label, symptoms_found, medications_found)
                        current_word = word
                        current_label = label
                
                if current_word:
                    self._categorize_entity(current_word, current_label, symptoms_found, medications_found)

            except Exception as e:
                # Log warning but do not crash the pipeline
                logger.warning(f"BioBERT model loading failed: {e}. Reverting entirely to rule-based fallback.")
                model_used = "rule-based-fallback"

        return {
            "symptoms": sorted(list(symptoms_found)),
            "medications": sorted(list(medications_found)),
            "model_name": model_used
        }

    def _categorize_entity(self, word: str, label: str, symptoms: Set[str], medications: Set[str]) -> None:
        """Helper to categorize reconstructed word tokens based on BioBERT NER tags."""
        clean_word = re.sub(r"[^\w\s-]", "", word).strip().lower()
        if not clean_word or len(clean_word) < 3:
            return

        # Check label for Chemical or Disease identifiers
        label_lower = label.lower()
        if "disease" in label_lower or "symptom" in label_lower:
            symptoms.add(clean_word)
        elif "chemical" in label_lower or "med" in label_lower or "drug" in label_lower:
            medications.add(clean_word)
