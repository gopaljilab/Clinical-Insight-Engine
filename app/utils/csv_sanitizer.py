"""
CSV Injection Sanitizer

Prevents CSV injection (Formula Injection) attacks by escaping
dangerous leading characters in cell values before export.

Reference: https://owasp.org/www-community/attacks/CSV_Injection
"""
import csv
import io
from typing import Any


DANGEROUS_PREFIXES = ('=', '+', '-', '@', '\t', '\r', '\n')


def sanitize_csv_value(value: Any) -> str:
    """
    Sanitize a single CSV cell value against formula injection.

    Prepends a single quote to neutralize formula characters.
    This follows OWASP's recommended mitigation.

    Args:
        value: The cell value to sanitize.

    Returns:
        Sanitized string safe for CSV export.
    """
    if value is None:
        return ""

    s = str(value).strip()

    if s and s[0] in DANGEROUS_PREFIXES:
        # Prepend single quote to neutralize the formula (OWASP recommended)
        return "'" + s

    return s


def sanitize_row(row: dict) -> dict:
    """Sanitize all values in a dictionary row."""
    return {k: sanitize_csv_value(v) for k, v in row.items()}


def export_to_csv_safe(data: list[dict], fieldnames: list[str] = None) -> str:
    """
    Export a list of dicts to a sanitized CSV string.

    Args:
        data: List of row dictionaries.
        fieldnames: Column order. Defaults to keys of first row.

    Returns:
        Sanitized CSV string with BOM for Excel UTF-8 compatibility.
    """
    if not data:
        return ""

    cols = fieldnames or list(data[0].keys())
    output = io.StringIO()

    writer = csv.DictWriter(
        output,
        fieldnames=cols,
        extrasaction="ignore",
        lineterminator="\r\n",
    )
    writer.writeheader()

    for row in data:
        sanitized = sanitize_row(row)
        writer.writerow({k: sanitized.get(k, "") for k in cols})

    return "﻿" + output.getvalue()  # BOM for Excel
