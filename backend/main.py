"""
main.py — FastAPI backend for the Spreeder speed-reading app.

Provides:
  /upload — Accept a PDF file, extract text, return words.
  /quiz   — Accept a text chunk, call Gemini, return a quiz question.

Run with:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import os
import json
import re
import logging

from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from utils.pdf_parser import extract_words_from_pdf

# ── Logging ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(name)-14s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("spreeder")

# ── Load .env file (so GEMINI_API_KEY is available) ────────────────────
load_dotenv()

# ── Create the FastAPI app ──────────────────────────────────────────────
app = FastAPI(
    title="Spreeder API",
    description="PDF-to-words backend for RSVP speed reading with quiz engine",
    version="2.0.0",
)

# ── CORS — allow the Expo dev client to talk to us ─────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Gemini client (reads GEMINI_API_KEY from environment) ──────────────
genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))
gemini_model = genai.GenerativeModel("gemini-2.5-flash")

# ── Pydantic model for the quiz request body ───────────────────────────
class QuizRequest(BaseModel):
    """The chunk of text the frontend sends for quiz generation."""
    text: str


# ── Health-check endpoint ──────────────────────────────────────────────
@app.get("/")
async def root():
    """Simple health check."""
    return {"status": "ok", "message": "Spreeder API is running 📖"}


# ── PDF upload endpoint ────────────────────────────────────────────────
@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Accept a PDF upload, extract text, and return words.

    Returns:
        {
          "words": ["Hello", "world", "..."],
          "word_count": 2,
          "diagnostics": {
            "page_count": 3,
            "extraction_method": "text" | "ocr" | "hybrid",
            "text_pages": [1, 2],
            "ocr_pages": [3],
            "failed_pages": [],
            "avg_ocr_confidence": 87.5,
            "processing_time_ms": 420.1,
            "warnings": []
          }
        }
    """

    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are accepted. Please upload a .pdf file.",
        )

    # Validate content type (extra safety check)
    if file.content_type and file.content_type != "application/pdf":
        if file.content_type != "application/octet-stream":
            raise HTTPException(
                status_code=400,
                detail=f"Invalid content type: {file.content_type}. Expected application/pdf.",
            )

    try:
        pdf_bytes = await file.read()

        if not pdf_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        result = extract_words_from_pdf(pdf_bytes)

        logger.info(
            "Upload OK: %d words, method=%s, pages=%d, time=%.0fms",
            result.word_count, result.extraction_method,
            result.page_count, result.processing_time_ms,
        )

        return {
            "words": result.words,
            "word_count": result.word_count,
            "diagnostics": {
                "page_count": result.page_count,
                "extraction_method": result.extraction_method,
                "text_pages": result.text_pages,
                "ocr_pages": result.ocr_pages,
                "failed_pages": result.failed_pages,
                "avg_ocr_confidence": round(result.avg_ocr_confidence, 1),
                "processing_time_ms": round(result.processing_time_ms, 1),
                "warnings": result.warnings,
            },
        }

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    except Exception as e:
        logger.exception("PDF processing failed")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process PDF: {str(e)}",
        )


# ── Quiz generation endpoint ──────────────────────────────────────────
QUIZ_SYSTEM_PROMPT = (
    "You are a reading-comprehension quiz generator. "
    "Generate a single, high-quality multiple-choice question based on the "
    "provided text. Return ONLY a valid JSON object with these exact keys:\n"
    "  question        — the question string\n"
    "  options          — an array of exactly 4 answer strings\n"
    "  correctAnswerIndex — integer 0-3 indicating the correct option\n"
    "  explanation      — a brief explanation of the correct answer\n"
    "Do NOT include markdown, code fences, or any text outside the JSON object."
)


@app.post("/quiz")
async def generate_quiz(body: QuizRequest):
    """
    Accept a chunk of text and return a Gemini-generated quiz question.

    Request body:
        { "text": "The quick brown fox ..." }

    Returns:
        {
          "question": "...",
          "options": ["A", "B", "C", "D"],
          "correctAnswerIndex": 2,
          "explanation": "..."
        }
    """

    if not body.text or not body.text.strip():
        raise HTTPException(status_code=400, detail="Text chunk is empty.")

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not set on the server. "
                   "Export it before starting: export GEMINI_API_KEY=...",
        )

    try:
        prompt = (
            f"{QUIZ_SYSTEM_PROMPT}\n\n"
            f"--- TEXT ---\n{body.text}\n--- END TEXT ---"
        )

        response = gemini_model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.0,
                max_output_tokens=1024,
            ),
        )

        raw = ""
        # response.text can raise ValueError if the model returned no
        # valid candidates (safety block, empty thinking response, etc.)
        try:
            raw = response.text or ""
        except ValueError:
            # Fallback: try to extract text from parts directly
            if response.candidates:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, "text") and part.text:
                        raw = part.text
                        break
        if not raw.strip():
            raise ValueError("Gemini returned an empty response. Try again.")

        # ── Robust JSON extraction ─────────────────────────────────
        # Gemini 2.5 Flash may wrap output in ```json ... ``` fences,
        # or include thinking / preamble text before the JSON.
        # Strategy: try raw first, then strip fences, then regex extract.

        def try_parse(s: str):
            s = s.strip()
            try:
                return json.loads(s)
            except json.JSONDecodeError:
                return None

        parsed = try_parse(raw)

        if parsed is None:
            # Strip markdown code fences
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            parsed = try_parse(cleaned)

        if parsed is None:
            # Last resort: find the first { ... } block via greedy regex
            match = re.search(r"\{[\s\S]*\}", raw)
            if match:
                parsed = try_parse(match.group(0))

        if parsed is None:
            raise json.JSONDecodeError("No valid JSON found in response", raw, 0)

        quiz = parsed

        # Validate required keys
        for key in ("question", "options", "correctAnswerIndex", "explanation"):
            if key not in quiz:
                raise ValueError(f"Missing key in GPT response: {key}")

        if not isinstance(quiz["options"], list) or len(quiz["options"]) != 4:
            raise ValueError("options must be an array of exactly 4 items")

        if not isinstance(quiz["correctAnswerIndex"], int) or not (0 <= quiz["correctAnswerIndex"] <= 3):
            raise ValueError("correctAnswerIndex must be an integer 0-3")

        return quiz

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail="GPT returned invalid JSON. Please try again.",
        )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Quiz generation failed: {str(e)}",
        )
