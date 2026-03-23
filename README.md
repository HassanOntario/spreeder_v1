# 📖 Spreeder — Speed Reading App

A minimal speed-reading mobile app that lets you upload a PDF and read it word-by-word using RSVP (Rapid Serial Visual Presentation).

---

## 🏗️ Project Structure

```
spreeder/
├── App.tsx                  # Main app screen
├── config.ts                # Backend URL, colors, WPM defaults
├── index.ts                 # Expo entry point
├── package.json             # Frontend dependencies
├── tsconfig.json            # TypeScript config
├── components/
│   ├── WordDisplay.tsx      # Single-word RSVP display with pivot letter
│   └── Controls.tsx         # Upload, play/pause, reset, WPM slider
└── backend/
    ├── main.py              # FastAPI server with /upload endpoint
    ├── requirements.txt     # Python dependencies
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

The frontend sends the selected PDF to the backend via an HTTP **POST** request to `/upload`:

1. User taps **"Upload PDF"** → the device file picker opens
2. The selected PDF is wrapped in a `FormData` object
3. `fetch()` POSTs it to `BACKEND_URL/upload`
4. The backend extracts text using PyMuPDF, splits into words, and returns JSON:
   ```json
   { "words": ["Hello", "world", "..."], "word_count": 2 }
   ```
5. The frontend stores the words array in state and begins RSVP playback

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
- **Progress Indicator**: Shows current word position and percentage
- **Play / Pause / Reset**: Full playback control
- **Warm Book Aesthetic**: Soft beige background, serif fonts, dark brown text

---

## 📝 Notes

- The backend uses **PyMuPDF** for PDF text extraction. Scanned PDFs (image-only) will return an error since OCR is not included.
- CORS is fully open (`allow_origins=["*"]`) for development. Restrict this in production.
- The app uses `expo-document-picker` which works in Expo Go — no native build required.
