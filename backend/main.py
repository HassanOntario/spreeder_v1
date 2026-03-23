"""
main.py — FastAPI backend for the Spreeder speed-reading app.

Provides a single /upload endpoint that accepts a PDF file,
extracts text, and returns a JSON array of words for RSVP display.

Run with:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from utils.pdf_parser import extract_words_from_pdf

# ── Create the FastAPI app ──────────────────────────────────────────────
app = FastAPI(
    title="Spreeder API",
    description="PDF-to-words backend for RSVP speed reading",
    version="1.0.0",
)

# ── CORS — allow the Expo dev client to talk to us ─────────────────────
# In production, restrict origins to your actual domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # Allow all origins during development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
        JSON object with a "words" array, e.g.:
        { "words": ["Hello", "world", "..."], "word_count": 2 }
    """

    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are accepted. Please upload a .pdf file.",
        )

    # Validate content type (extra safety check)
    if file.content_type and file.content_type != "application/pdf":
        # Some clients don't send content_type, so we only reject if it's
        # explicitly wrong (not missing).
        if file.content_type != "application/octet-stream":
            raise HTTPException(
                status_code=400,
                detail=f"Invalid content type: {file.content_type}. Expected application/pdf.",
            )

    try:
        # Read the uploaded file bytes
        pdf_bytes = await file.read()

        if not pdf_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        # Extract words using our parser
        words = extract_words_from_pdf(pdf_bytes)

        return {
            "words": words,
            "word_count": len(words),
        }

    except ValueError as e:
        # Errors from our parser (empty PDF, no text, etc.)
        raise HTTPException(status_code=422, detail=str(e))

    except Exception as e:
        # Unexpected errors
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process PDF: {str(e)}",
        )
