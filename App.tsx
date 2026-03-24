/**
 * App.tsx — Main screen of the Spreeder speed-reading app.
 *
 * Features:
 *  1. Pick a PDF → upload to backend → get words
 *  2. RSVP playback with dynamic per-word delay
 *  3. Quiz engine: pauses RSVP at configurable intervals, calls GPT-4o-mini
 *     via the backend /quiz endpoint, shows an overlay quiz, then resumes.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  Alert,
  Platform,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";

import WordDisplay from "./components/WordDisplay";
import Controls from "./components/Controls";
import StrategySelector from "./components/StrategySelector";
import QuizOverlay, { QuizQuestion } from "./components/QuizOverlay";
import {
  BACKEND_URL,
  DEFAULT_WPM,
  COLORS,
  LONG_WORD_THRESHOLD,
  NARROW_VIEWPORT_PX,
  LONG_WORD_DELAY_BOOST,
  NARROW_VP_DELAY_BOOST,
  QuizStrategy,
  STRATEGY_INTERVALS,
} from "./config";

export default function App() {
  // ── Core RSVP state ────────────────────────────────────────────────
  const [words, setWords] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(DEFAULT_WPM);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Quiz engine state ──────────────────────────────────────────────
  const [strategy, setStrategy] = useState<QuizStrategy>("segmented");
  const [quizActive, setQuizActive] = useState(false);       // Is the overlay showing?
  const [quizLoading, setQuizLoading] = useState(false);      // API call in flight?
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizData, setQuizData] = useState<QuizQuestion | null>(null);
  /** Word index of the last quiz checkpoint (so we don't re-trigger). */
  const lastQuizIndexRef = useRef(-1);
  /** The text chunk that was sent for the current/pending quiz. */
  const quizChunkRef = useRef("");

  // Reactive viewport width
  const { width: viewportWidth } = useWindowDimensions();

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Dynamic delay calculator ───────────────────────────────────────
  const getDelayForWord = useCallback(
    (word: string): number => {
      let delay = 60000 / wpm;
      if (word.length > LONG_WORD_THRESHOLD) delay *= 1 + LONG_WORD_DELAY_BOOST;
      if (viewportWidth < NARROW_VIEWPORT_PX) delay *= 1 + NARROW_VP_DELAY_BOOST;
      return delay;
    },
    [wpm, viewportWidth],
  );

  // ── Quiz threshold check ───────────────────────────────────────────
  // Returns true if the RSVP should pause for a quiz at `idx`.
  const shouldQuizAt = useCallback(
    (idx: number): boolean => {
      const interval = STRATEGY_INTERVALS[strategy];

      // Post-game: only quiz when we've reached the very last word
      if (strategy === "postgame") {
        return idx >= words.length - 1 && lastQuizIndexRef.current < words.length - 1;
      }

      // Micro / Segmented: quiz every `interval` words
      if (interval === Infinity) return false;

      // Find the next checkpoint *after* the last quiz
      const baseCheckpoint = lastQuizIndexRef.current < 0 ? interval - 1 : lastQuizIndexRef.current + interval;

      return idx >= baseCheckpoint;
    },
    [strategy, words.length],
  );

  // ── Build the text chunk for the quiz ──────────────────────────────
  const buildQuizChunk = useCallback(
    (endIdx: number): string => {
      const interval = STRATEGY_INTERVALS[strategy];
      const start =
        strategy === "postgame"
          ? 0
          : Math.max(0, endIdx - interval + 1);
      return words.slice(start, endIdx + 1).join(" ");
    },
    [strategy, words],
  );

  // ── Call the backend /quiz endpoint ────────────────────────────────
  const fetchQuiz = useCallback(
    async (textChunk: string) => {
      setQuizLoading(true);
      setQuizError(null);
      setQuizData(null);
      quizChunkRef.current = textChunk;

      try {
        const res = await fetch(`${BACKEND_URL}/quiz`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textChunk }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.detail || `Server error: ${res.status}`);
        }

        const data: QuizQuestion = await res.json();
        setQuizData(data);
      } catch (e: any) {
        setQuizError(e.message || "Quiz generation failed.");
      } finally {
        setQuizLoading(false);
      }
    },
    [],
  );

  // ── Trigger a quiz (pause RSVP + show overlay) ─────────────────────
  const triggerQuiz = useCallback(
    (atIndex: number) => {
      setIsPlaying(false);
      setQuizActive(true);
      lastQuizIndexRef.current = atIndex;
      const chunk = buildQuizChunk(atIndex);
      fetchQuiz(chunk);
    },
    [buildQuizChunk, fetchQuiz],
  );

  // ── Resume after quiz ──────────────────────────────────────────────
  const handleQuizResume = useCallback(() => {
    setQuizActive(false);
    setQuizData(null);
    setQuizError(null);

    // If we're at the very end, don't auto-play
    if (currentIndex >= words.length - 1) return;

    // Advance past the quiz checkpoint and resume
    setCurrentIndex((prev) => prev + 1);
    setIsPlaying(true);
  }, [currentIndex, words.length]);

  // ── Retry a failed quiz with the same chunk ────────────────────────
  const handleQuizRetry = useCallback(() => {
    fetchQuiz(quizChunkRef.current);
  }, [fetchQuiz]);

  // ── Playback timer (per-word setTimeout chain) ─────────────────────
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Don't run the timer while a quiz is showing
    if (!isPlaying || words.length === 0 || quizActive) return;

    const scheduleNext = () => {
      setCurrentIndex((prev) => {
        // ── End of text ────────────────────────────────────────────
        if (prev >= words.length - 1) {
          // If postgame and we haven't quizzed yet, trigger quiz
          if (strategy === "postgame" && lastQuizIndexRef.current < words.length - 1) {
            setTimeout(() => triggerQuiz(prev), 0);
            return prev;
          }
          setIsPlaying(false);
          return prev;
        }

        const nextIndex = prev + 1;

        // ── Quiz checkpoint? ───────────────────────────────────────
        if (shouldQuizAt(nextIndex)) {
          // Pause and trigger quiz at the *current* index (we haven't
          // shown nextIndex yet, so quiz covers text up to nextIndex).
          setTimeout(() => triggerQuiz(nextIndex), 0);
          return nextIndex;  // show the word, then the overlay appears
        }

        // Schedule the next tick
        timeoutRef.current = setTimeout(
          scheduleNext,
          getDelayForWord(words[nextIndex]),
        );

        return nextIndex;
      });
    };

    timeoutRef.current = setTimeout(
      scheduleNext,
      getDelayForWord(words[currentIndex]),
    );

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isPlaying, wpm, words.length, viewportWidth, quizActive, strategy]);

  // ── Upload a PDF ───────────────────────────────────────────────────
  const handleUpload = useCallback(async () => {
    try {
      setError(null);

      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      const file = result.assets[0];
      if (!file) return;

      setIsLoading(true);
      setIsPlaying(false);
      setQuizActive(false);
      lastQuizIndexRef.current = -1;

      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name || "document.pdf",
        type: file.mimeType || "application/pdf",
      } as any);

      const response = await fetch(`${BACKEND_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Server error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.words || data.words.length === 0) {
        throw new Error("No words were extracted from the PDF.");
      }

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
      setCurrentIndex(0);
      lastQuizIndexRef.current = -1;  // Reset quiz checkpoints on restart
    }
    setIsPlaying((prev) => !prev);
  }, [currentIndex, words.length, isPlaying]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(0);
    setQuizActive(false);
    lastQuizIndexRef.current = -1;
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

      {/* Strategy selector (shown when words are loaded) */}
      {words.length > 0 && !isPlaying && !quizActive && (
        <StrategySelector selected={strategy} onSelect={setStrategy} />
      )}

      {/* Main word display area — blurred when quiz is active */}
      <View style={[styles.wordArea, quizActive && styles.wordAreaBlurred]}>
        <WordDisplay
          word={words.length > 0 ? words[currentIndex] : ""}
          totalWords={words.length}
          currentIndex={currentIndex}
        />
      </View>

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

      {/* Quiz overlay (renders above everything when active) */}
      {quizActive && (
        <QuizOverlay
          quiz={quizData}
          isLoading={quizLoading}
          errorMessage={quizError}
          onResume={handleQuizResume}
          onRetry={handleQuizRetry}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  wordArea: {
    flex: 1,
  },
  wordAreaBlurred: {
    opacity: 0.15,
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
