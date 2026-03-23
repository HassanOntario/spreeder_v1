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
};
