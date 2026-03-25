# 📖 Spreeder — Speed Reading App

A speed-reading mobile app that lets you upload a PDF and read it word-by-word using RSVP (Rapid Serial Visual Presentation), with an AI-powered comprehension quiz engine powered by Google Gemini.

---

## 🏗️ Project Structure

```
spreeder/
├── App.tsx                  # Main app screen + quiz engine logic
├── config.ts                # Backend URL, colors, WPM defaults, quiz strategy config
├── index.ts                 # Expo entry point
├── package.json             # Frontend dependencies
├── tsconfig.json            # TypeScript config
├── components/
│   ├── WordDisplay.tsx      # Single-word RSVP display with pivot letter
│   ├── Controls.tsx         # Upload, play/pause, reset, WPM slider
│   ├── StrategySelector.tsx # Quiz strategy picker (Micro / Segmented / Post-Game)
│   └── QuizOverlay.tsx      # Full-screen multiple-choice quiz overlay
└── backend/
    ├── main.py              # FastAPI server with /upload and /quiz endpoints
    ├── requirements.txt     # Python dependencies
    ├── .env.example         # Template for environment variables
    └── utils/
        ├── __init__.py
        └── pdf_parser.py    # PDF text extraction logic
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18+) & npm
- **Python** (3.9+)
- **Expo Go** app on your phone (from App Store / Google Play), or an iOS Simulator / Android Emulator
- **Gemini API key** — get one free at [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)

---

### 1. Start the Backend

```bash
# Navigate to the backend folder
cd backend

# Create a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Set up your Gemini API key
cp .env.example .env
# Then edit .env and replace the placeholder with your real key:
# GEMINI_API_KEY=your-gemini-api-key-here

# Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be running at **http://localhost:8000**.

You can verify it's working by visiting http://localhost:8000 in your browser — you should see:
```json
{"status": "ok", "message": "Spreeder API is running 📖"}
```

---

### 2. Start the Frontend

```bash
# From the project root (the spreeder/ folder), install dependencies
npm install

# Start the Expo dev server
npx expo start
```

Then:
- **iOS Simulator**: Press `i` in the terminal
- **Android Emulator**: Press `a` in the terminal
- **Physical device**: Scan the QR code with Expo Go

---

## 🔌 How Frontend Connects to Backend

### PDF Upload (`/upload`)

The frontend sends the selected PDF to the backend via an HTTP **POST** request to `/upload`:

1. User taps **"Upload PDF"** → the device file picker opens
2. The selected PDF is wrapped in a `FormData` object
3. `fetch()` POSTs it to `BACKEND_URL/upload`
4. The backend extracts text using PyMuPDF, splits into words, and returns JSON:
   ```json
   { "words": ["Hello", "world", "..."], "word_count": 2 }
   ```
5. The frontend stores the words array in state and begins RSVP playback

### Quiz Generation (`/quiz`)

At configurable checkpoints during playback, the frontend sends a text chunk to the backend for quiz generation:

1. RSVP playback pauses automatically at the quiz checkpoint
2. The frontend POSTs the recent text chunk to `BACKEND_URL/quiz`:
   ```json
   { "text": "The quick brown fox ..." }
   ```
3. The backend sends the chunk to **Google Gemini** (`gemini-2.5-flash`) and parses the response
4. A multiple-choice question is returned:
   ```json
   {
     "question": "What did the fox do?",
     "options": ["Slept", "Jumped", "Ran", "Ate"],
     "correctAnswerIndex": 1,
     "explanation": "The fox jumped over the lazy dog."
   }
   ```
5. The `QuizOverlay` appears over the blurred reading view; after the user answers, RSVP resumes

### Configuring the Backend URL

Edit the `BACKEND_URL` constant in **`config.ts`**:

| Running on              | Use this URL                          |
|-------------------------|---------------------------------------|
| iOS Simulator           | `http://localhost:8000`               |
| Android Emulator        | `http://10.0.2.2:8000`               |
| Physical device (WiFi)  | `http://<your-computer-ip>:8000`      |

To find your computer's IP: run `ifconfig` (macOS) or `ipconfig` (Windows) and look for your WiFi adapter's IP.

---

## ✨ Features

- **RSVP Reading**: Words displayed one at a time in a fixed position
- **Pivot Letter Highlight**: The optimal fixation character is highlighted (Spritz-style)
- **Speed Control**: Slider + buttons from 100 to 600 WPM
- **Real-time Speed Changes**: Adjusting WPM updates playback instantly
- **Dynamic Word Delay**: Long words (>8 chars) and narrow screens automatically get extra display time
- **Progress Indicator**: Shows current word position and percentage
- **Play / Pause / Reset**: Full playback control
- **Warm Book Aesthetic**: Soft beige background, serif fonts, dark brown text
- **AI Comprehension Quizzes**: Gemini-generated multiple-choice questions with answer explanations
- **Three Quiz Strategies** (selectable before reading):
  - **Micro** — quiz every 100 words for intensive practice
  - **Segmented** — quiz every 500 words for chapter-style checkpoints
  - **Post-Game** — single quiz at the very end of the text

---

## 📝 Notes

- The backend uses **PyMuPDF** for PDF text extraction. Scanned PDFs (image-only) will return an error since OCR is not included.
- The quiz endpoint requires a valid `GEMINI_API_KEY` set in `backend/.env`. The server returns a clear `500` error if the key is missing.
- CORS is fully open (`allow_origins=["*"]`) for development. Restrict this in production.
- The app uses `expo-document-picker` which works in Expo Go — no native build required.
