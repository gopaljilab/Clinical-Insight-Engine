"""
Text Sanitizer Utility

Provides robust sanitization of clinical text, database records, FHIR payloads,
and clinical notes to prevent crashes, truncation, and encoding-related bugs.
"""
import logging
import unicodedata
from typing import Union, Any

logger = logging.getLogger(__name__)

# List of superscript and subscript characters to preserve during NFKC normalization
SUB_SUPER_CHARS = (
    "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ"
    "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎"
    "ₐₑₒₓₔₕₖₗₘₙₚₛₜ"
)


def decode_bytes(data: bytes, fallback_to_cp1252: bool = False) -> str:
    """
    Decodes bytes to string using UTF-8-sig (with BOM handling) and optional fallbacks.
    
    If fallback_to_cp1252 is True, tries CP1252 and Latin-1 before ignoring invalid bytes.
    If False, directly decodes UTF-8-sig ignoring/replacing invalid sequences.
    """
    try:
        # Fast path: valid UTF-8 / UTF-8 with BOM
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        if fallback_to_cp1252:
            logger.warning(
                "TextSanitizer: Invalid UTF-8 byte sequences detected. "
                "Attempting fallback decoders (CP1252/Latin-1) to preserve legacy content."
            )
            try:
                return data.decode("cp1252")
            except UnicodeDecodeError:
                try:
                    return data.decode("latin-1")
                except Exception as e:
                    logger.warning(
                        f"TextSanitizer: CP1252/Latin-1 fallbacks failed: {e}. "
                        "Decoding as UTF-8 with ignore."
                    )
        else:
            logger.warning(
                "TextSanitizer: Invalid UTF-8 byte sequences detected. "
                "Decoding with UTF-8 replacement/ignore."
            )
        
        return data.decode("utf-8-sig", errors="ignore")


def normalize_unicode_preserving_sub_super(text: str) -> str:
    """Applies NFKC normalization while preserving superscript and subscript characters."""
    placeholders = {}
    temp_text = text
    for i, char in enumerate(SUB_SUPER_CHARS):
        placeholder = f"__SUB_SUPER_{i}__"
        if char in temp_text:
            temp_text = temp_text.replace(char, placeholder)
            placeholders[placeholder] = char

    normalized = unicodedata.normalize("NFKC", temp_text)

    for placeholder, char in placeholders.items():
        normalized = normalized.replace(placeholder, char)

    return normalized


def sanitize_text(text: Union[str, bytes], fallback_to_cp1252: bool = False) -> str:
    """
    Sanitize text or byte string against malformed encodings, null bytes, and control characters.
    
    Performs NFKC normalization, smart quotes/dashes conversions, and whitespace normalization,
    while fully preserving medically relevant symbols like degree symbols, micro/mu, percent, etc.
    """
    if text is None:
        return ""

    if isinstance(text, (bytes, bytearray)):
        text = decode_bytes(bytes(text), fallback_to_cp1252=fallback_to_cp1252)

    if not isinstance(text, str):
        text = str(text)

    # 1. Unicode Normalization preserving subscripts/superscripts
    text = normalize_unicode_preserving_sub_super(text)

    # 2. Remove null bytes (\x00)
    if "\x00" in text:
        logger.warning("TextSanitizer: Null bytes (\\x00) detected and removed.")
        text = text.replace("\x00", "")

    # 3. Remove non-printable control characters while preserving tabs, spaces, and newlines
    # Cc = Control character (like backspace, esc, etc.)
    # Cf = Format character (invisible formatting/junk characters)
    cleaned_chars = []
    removed_control_count = 0
    for c in text:
        cat = unicodedata.category(c)
        if cat == "Cc":
            if c in ("\t", "\n", "\r"):
                cleaned_chars.append(c)
            else:
                removed_control_count += 1
        elif cat == "Cf":
            removed_control_count += 1
        else:
            cleaned_chars.append(c)

    if removed_control_count > 0:
        logger.warning(
            f"TextSanitizer: Removed {removed_control_count} non-printable control characters."
        )
    text = "".join(cleaned_chars)

    # 4. Normalize smart quotes and smart dashes
    SMART_QUOTES = {
        "“": '"', "”": '"',
        "‘": "'", "’": "'",
        "„": '"', "‟": '"',
        "‚": "'", "‛": "'",
        "«": '"', "»": '"',
        "‹": "<", "›": ">"
    }
    SMART_DASHES = {
        "–": "-",  # en-dash
        "—": "-",  # em-dash
    }
    # 5. Normalize unusual/unicode whitespace
    UNUSUAL_WHITESPACE = {
        "\xa0": " ",  # Non-breaking space
        "\u200b": "",  # Zero-width space
    }
    # Other spaces in General Punctuation range
    for code in range(0x2000, 0x200b):
        UNUSUAL_WHITESPACE[chr(code)] = " "
    for code in (0x202f, 0x205f, 0x3000):
        UNUSUAL_WHITESPACE[chr(code)] = " "

    modified_quotes = False
    modified_whitespace = False

    for k, v in SMART_QUOTES.items():
        if k in text:
            text = text.replace(k, v)
            modified_quotes = True

    for k, v in SMART_DASHES.items():
        if k in text:
            text = text.replace(k, v)
            modified_quotes = True

    for k, v in UNUSUAL_WHITESPACE.items():
        if k in text:
            text = text.replace(k, v)
            modified_whitespace = True

    if modified_quotes:
        logger.warning("TextSanitizer: Normalized smart quotes or smart dashes.")
    if modified_whitespace:
        logger.warning("TextSanitizer: Normalized unusual or unicode whitespace.")

    return text


def sanitize_data(data: Any) -> Any:
    """Recursively traverse and sanitize only textual fields (strings) in dicts/lists, leaving other types intact."""
    if isinstance(data, dict):
        return {k: sanitize_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_data(item) for item in data]
    elif isinstance(data, str):
        return sanitize_text(data)
    else:
        return data
