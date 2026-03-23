"""
pdf_parser.py — Extracts and cleans text from a PDF file.

Uses PyMuPDF (fitz) to read each page of the uploaded PDF,
then splits the text into individual words for RSVP display.
"""

import fitz  # PyMuPDF
import re
from typing import List


def extract_words_from_pdf(pdf_bytes: bytes) -> List[str]:
    """
    Given raw PDF bytes, extract all text and return a clean list of words.

    Args:
        pdf_bytes: The raw bytes of the uploaded PDF file.

    Returns:
        A list of individual words extracted from the PDF.

    Raises:
        ValueError: If the PDF is empty or contains no extractable text.
    """

    # Open the PDF from memory
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    # Check if the PDF has any pages
    if doc.page_count == 0:
        doc.close()
        raise ValueError("The uploaded PDF has no pages.")

    # Extract text from every page
    full_text = ""
    for page in doc:
        full_text += page.get_text()

    doc.close()

    # Check if any text was extracted
    if not full_text.strip():
        raise ValueError(
            "No readable text found in this PDF. "
            "It may be a scanned image or contain only non-text content."
        )

    # --- Clean the text ---
    # Replace newlines and tabs with spaces
    full_text = full_text.replace("\n", " ").replace("\t", " ")

    # Remove excessive whitespace
    full_text = re.sub(r"\s+", " ", full_text).strip()

    # Split into individual words and filter out empty strings
    words = [word for word in full_text.split(" ") if word]

    if not words:
        raise ValueError("The PDF was processed but no words were found.")

    return words
