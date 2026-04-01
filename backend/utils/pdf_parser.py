"""
pdf_parser.py — Robust PDF text extraction with OCR fallback.

Pipeline:
  1. Try standard PyMuPDF (fitz) text extraction.
  2. If too little text is found, fall back to OCR via Tesseract.
  3. Return words + diagnostics metadata.
"""

from __future__ import annotations

import io
import logging
import re
import time
from dataclasses import dataclass, field
from typing import List, Optional

import fitz  # PyMuPDF

logger = logging.getLogger("pdf_parser")

# ── Thresholds ────────────────────────────────────────────────────────
# If standard extraction yields fewer words per page than this, try OCR.
MIN_WORDS_PER_PAGE = 5
# Minimum OCR confidence (0-100) to accept a page's OCR text.
MIN_OCR_CONFIDENCE = 30


# ── Result dataclass ──────────────────────────────────────────────────
@dataclass
class ExtractionResult:
    """Structured result from PDF text extraction."""

    words: List[str]
    word_count: int = 0
    page_count: int = 0
    extraction_method: str = "unknown"  # "text", "ocr", "hybrid"
    ocr_pages: List[int] = field(default_factory=list)
    text_pages: List[int] = field(default_factory=list)
    failed_pages: List[int] = field(default_factory=list)
    avg_ocr_confidence: float = 0.0
    processing_time_ms: float = 0.0
    warnings: List[str] = field(default_factory=list)


# ── Helpers ───────────────────────────────────────────────────────────
def _clean_text(raw: str) -> List[str]:
    """Normalize whitespace and split into non-empty word tokens."""
    text = raw.replace("\n", " ").replace("\t", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return [w for w in text.split(" ") if w]


def _ocr_available() -> bool:
    """Check whether pytesseract + Pillow are importable."""
    try:
        import pytesseract  # noqa: F401
        from PIL import Image  # noqa: F401
        return True
    except ImportError:
        return False


def _ocr_page(page: fitz.Page, dpi: int = 300) -> tuple[str, float]:
    """
    Render a single page to an image and run Tesseract OCR.

    Returns:
        (extracted_text, confidence)  — confidence in 0-100 range.
    """
    import pytesseract
    from PIL import Image

    # Render page to a high-res pixmap
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img = Image.open(io.BytesIO(pix.tobytes("png")))

    # Get detailed OCR data for confidence metric
    ocr_data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    confidences = [
        int(c)
        for c, txt in zip(ocr_data["conf"], ocr_data["text"])
        if str(c) != "-1" and txt.strip()
    ]
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0

    # Get the actual text
    text = pytesseract.image_to_string(img)
    return text, avg_conf


# ── Main extraction function ─────────────────────────────────────────
def extract_words_from_pdf(pdf_bytes: bytes) -> ExtractionResult:
    """
    Given raw PDF bytes, extract text via the best available strategy.

    Strategy:
        1. Attempt standard fitz text extraction on every page.
        2. For pages that yield fewer than MIN_WORDS_PER_PAGE words,
           fall back to OCR (if available).
        3. Collect diagnostics and return an ExtractionResult.

    Args:
        pdf_bytes: The raw bytes of the uploaded PDF file.

    Returns:
        An ExtractionResult with words and diagnostics.

    Raises:
        ValueError: If the PDF is empty or no text could be extracted.
    """

    t_start = time.perf_counter()
    result = ExtractionResult(words=[])

    # ── Open document ─────────────────────────────────────────────
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError(f"Failed to open PDF: {exc}") from exc

    result.page_count = doc.page_count
    if doc.page_count == 0:
        doc.close()
        raise ValueError("The uploaded PDF has no pages.")

    has_ocr = _ocr_available()
    if not has_ocr:
        logger.warning("pytesseract/Pillow not installed — OCR fallback disabled")
        result.warnings.append("OCR fallback unavailable (pytesseract not installed)")

    all_words: List[str] = []
    ocr_confidences: List[float] = []

    # ── Per-page extraction ───────────────────────────────────────
    for page_num, page in enumerate(doc, start=1):
        # Strategy 1: standard text extraction
        raw_text = page.get_text()
        words = _clean_text(raw_text)

        if len(words) >= MIN_WORDS_PER_PAGE:
            # Good — standard extraction worked
            all_words.extend(words)
            result.text_pages.append(page_num)
            logger.debug("Page %d: text extraction OK (%d words)", page_num, len(words))
            continue

        # Strategy 2: OCR fallback
        if has_ocr:
            logger.info("Page %d: only %d words via text — trying OCR", page_num, len(words))
            try:
                ocr_text, confidence = _ocr_page(page)
                ocr_words = _clean_text(ocr_text)

                if confidence >= MIN_OCR_CONFIDENCE and len(ocr_words) > len(words):
                    all_words.extend(ocr_words)
                    result.ocr_pages.append(page_num)
                    ocr_confidences.append(confidence)
                    logger.info(
                        "Page %d: OCR success (%d words, %.1f%% confidence)",
                        page_num, len(ocr_words), confidence,
                    )
                    continue
                else:
                    # OCR didn't help — keep whatever text extraction gave us
                    logger.warning(
                        "Page %d: OCR low quality (conf=%.1f%%, %d words) — using text fallback",
                        page_num, confidence, len(ocr_words),
                    )
                    if words:
                        all_words.extend(words)
                        result.text_pages.append(page_num)
                    else:
                        result.failed_pages.append(page_num)
                    continue

            except Exception as exc:
                logger.error("Page %d: OCR failed — %s", page_num, exc)
                result.warnings.append(f"Page {page_num}: OCR error — {exc}")
                if words:
                    all_words.extend(words)
                    result.text_pages.append(page_num)
                else:
                    result.failed_pages.append(page_num)
                continue

        # No OCR available — use whatever text extraction gave us
        if words:
            all_words.extend(words)
            result.text_pages.append(page_num)
        else:
            result.failed_pages.append(page_num)
            logger.warning("Page %d: no text extracted and no OCR available", page_num)

    doc.close()

    # ── Finalize result ───────────────────────────────────────────
    result.words = all_words
    result.word_count = len(all_words)
    result.processing_time_ms = (time.perf_counter() - t_start) * 1000

    if ocr_confidences:
        result.avg_ocr_confidence = sum(ocr_confidences) / len(ocr_confidences)

    # Determine extraction method label
    if result.ocr_pages and result.text_pages:
        result.extraction_method = "hybrid"
    elif result.ocr_pages:
        result.extraction_method = "ocr"
    else:
        result.extraction_method = "text"

    # Add warnings for failed pages
    if result.failed_pages:
        result.warnings.append(
            f"Pages with no extractable text: {result.failed_pages}"
        )

    if not all_words:
        raise ValueError(
            "No readable text found in this PDF. "
            "It may be a scanned image that OCR could not process, "
            "or it contains only non-text content."
        )

    logger.info(
        "PDF processed: %d words, %d pages, method=%s, time=%.0fms",
        result.word_count, result.page_count,
        result.extraction_method, result.processing_time_ms,
    )

    return result
