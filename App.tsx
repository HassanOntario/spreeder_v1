/**
 * App.tsx — Main screen of the Spreeder speed-reading app.
 *
 * This single-screen app lets you:
 *  1. Pick a PDF from your device
 *  2. Upload it to the Python backend
 *  3. Read the extracted words one at a time (RSVP style)
 *  4. Control playback speed with a slider
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  Alert,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";

import WordDisplay from "./components/WordDisplay";
import Controls from "./components/Controls";
import { BACKEND_URL, DEFAULT_WPM, COLORS } from "./config";

export default function App() {
  // ── State ──────────────────────────────────────────────────────────
  const [words, setWords] = useState<string[]>([]);        // All words from the PDF
  const [currentIndex, setCurrentIndex] = useState(0);     // Which word we're on
  const [isPlaying, setIsPlaying] = useState(false);        // Playback running?
  const [wpm, setWpm] = useState(DEFAULT_WPM);              // Words per minute
  const [isLoading, setIsLoading] = useState(false);         // Upload in progress?
  const [error, setError] = useState<string | null>(null);   // Error message

  // Ref to hold the interval ID so we can clear it from anywhere
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Playback timer ─────────────────────────────────────────────────
  // Recalculate the interval whenever WPM changes or playback toggles.
  useEffect(() => {
    // Always clear the previous interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isPlaying && words.length > 0) {
      const delay = 60000 / wpm; // ms per word

      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= words.length - 1) {
            // Reached the end — stop playback
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, delay);
    }

    // Cleanup on unmount or dependency change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, wpm, words.length]);

  // ── Upload a PDF ───────────────────────────────────────────────────
  const handleUpload = useCallback(async () => {
    try {
      setError(null);

      // Open the document picker (PDFs only)
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      // User cancelled
      if (result.canceled) return;

      const file = result.assets[0];
      if (!file) return;

      setIsLoading(true);
      setIsPlaying(false);

      // Build a FormData payload
      const formData = new FormData();

      // React Native's FormData expects this shape for files
      formData.append("file", {
        uri: file.uri,
        name: file.name || "document.pdf",
        type: file.mimeType || "application/pdf",
      } as any);

      // Send to backend
      const response = await fetch(`${BACKEND_URL}/upload`, {
        method: "POST",
        body: formData,
        headers: {
          // Let fetch set the Content-Type with boundary automatically
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.detail || `Server error: ${response.status}`
        );
      }

      const data = await response.json();

      if (!data.words || data.words.length === 0) {
        throw new Error("No words were extracted from the PDF.");
      }

      // Success — load the words into state
      setWords(data.words);
      setCurrentIndex(0);
      setIsPlaying(false);
    } catch (err: any) {
      const message = err.message || "Something went wrong.";
      setError(message);
      Alert.alert("Upload Error", message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Playback controls ──────────────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    if (currentIndex >= words.length - 1 && !isPlaying) {
      // If at end, restart from beginning on Play
      setCurrentIndex(0);
    }
    setIsPlaying((prev) => !prev);
  }, [currentIndex, words.length, isPlaying]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(0);
  }, []);

  const handleWpmChange = useCallback((newWpm: number) => {
    setWpm(Math.round(newWpm));
  }, []);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Spreeder</Text>
        <Text style={styles.subtitle}>Speed Reading, Simplified</Text>
      </View>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Main word display area */}
      <WordDisplay
        word={words.length > 0 ? words[currentIndex] : ""}
        totalWords={words.length}
        currentIndex={currentIndex}
      />

      {/* Controls at the bottom */}
      <Controls
        hasWords={words.length > 0}
        isPlaying={isPlaying}
        wpm={wpm}
        isLoading={isLoading}
        onUpload={handleUpload}
        onPlayPause={handlePlayPause}
        onReset={handleReset}
        onWpmChange={handleWpmChange}
      />
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    alignItems: "center",
    paddingTop: Platform.OS === "android" ? 48 : 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.text,
    fontFamily: "serif",
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontFamily: "serif",
    marginTop: 2,
  },
  errorBanner: {
    backgroundColor: "#fdecea",
    marginHorizontal: 24,
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    textAlign: "center",
  },
});
