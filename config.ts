/**
 * config.ts — App-wide configuration constants.
 *
 * Change BACKEND_URL to your machine's local IP when testing
 * on a physical device, or use localhost for the iOS simulator.
 */

// ─── Backend URL ──────────────────────────────────────────────────────
// • iOS Simulator / Web: "http://localhost:8000" works fine.
// • Android Emulator:    use "http://10.0.2.2:8000"
// • Physical device:     use your computer's LAN IP, e.g. "http://192.168.1.42:8000"
export const BACKEND_URL = "http://localhost:8000";

// ─── Reading defaults ─────────────────────────────────────────────────
export const DEFAULT_WPM = 300;   // Words per minute on first launch
export const MIN_WPM = 100;
export const MAX_WPM = 600;
export const WPM_STEP = 25;       // Step size for WPM adjustment buttons

// ─── Dynamic delay tuning ─────────────────────────────────────────────
// Words with more characters than this get extra display time so the
// reader can absorb them on a narrow mobile screen.
export const LONG_WORD_THRESHOLD = 8;     // characters

// If the viewport (screen width) is below this many points, every word
// gets a readability boost because scaled-down text is harder to parse.
export const NARROW_VIEWPORT_PX = 380;    // points (px on web)

// How much extra time to add when a condition is met.
// The boosts are additive: a long word on a narrow screen gets both.
export const LONG_WORD_DELAY_BOOST = 0.40;   // +40 %
export const NARROW_VP_DELAY_BOOST = 0.25;   // +25 %

// ─── Theme colours (warm book aesthetic) ──────────────────────────────
export const COLORS = {
  background: "#f5f1e6",    // Soft beige / parchment
  surface: "#ece5d3",       // Slightly darker beige for cards
  text: "#2c2417",          // Dark brown
  textMuted: "#8a7d6b",     // Lighter brown for secondary text
  accent: "#b4854e",        // Warm gold/amber for buttons
  accentPressed: "#96703e", // Darker gold for pressed state
  error: "#c0392b",         // Soft red for errors
  white: "#ffffff",
  // Quiz-specific
  correct: "#27ae60",       // Green for correct answers
  incorrect: "#c0392b",     // Red for incorrect answers
  overlay: "rgba(44, 36, 23, 0.55)",  // Semi-transparent dark overlay for blur
};

// ─── Quiz strategy definitions ────────────────────────────────────────
export type QuizStrategy = "micro" | "segmented" | "postgame";

/** How many words between quizzes for each strategy. */
export const STRATEGY_INTERVALS: Record<QuizStrategy, number> = {
  micro: 100,       // Quiz every 100 words
  segmented: 500,   // Quiz every 500 words
  postgame: Infinity, // Quiz only at the very end
};

export const STRATEGY_LABELS: Record<QuizStrategy, { title: string; desc: string }> = {
  micro:     { title: "Micro",     desc: "Quiz every 100 words" },
  segmented: { title: "Segmented", desc: "Quiz every 500 words" },
  postgame:  { title: "Post-Game", desc: "Quiz at the end" },
};
