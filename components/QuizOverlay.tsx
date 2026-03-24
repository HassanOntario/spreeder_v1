/**
 * QuizOverlay.tsx — Full-screen blurred overlay that shows a GPT-generated
 * multiple-choice question.
 *
 * Lifecycle:
 *   1. RSVP pauses → overlay appears (blurs the word behind it).
 *   2. User picks an answer → immediate Correct / Incorrect feedback.
 *   3. User taps "Continue Reading" → overlay dismisses, RSVP resumes.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { COLORS } from "../config";

// ─── Types ──────────────────────────────────────────────────────────────
export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

interface QuizOverlayProps {
  /** null while still loading from the API. */
  quiz: QuizQuestion | null;
  /** True while the API call is in flight. */
  isLoading: boolean;
  /** Error message if the API call failed. */
  errorMessage: string | null;
  /** Called when the user finishes the quiz and wants to resume reading. */
  onResume: () => void;
  /** Called to retry a failed quiz generation. */
  onRetry: () => void;
}

export default function QuizOverlay({
  quiz,
  isLoading,
  errorMessage,
  onResume,
  onRetry,
}: QuizOverlayProps) {
  // Which option the user tapped (null = hasn't answered yet)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const answered = selectedIndex !== null;
  const isCorrect = answered && quiz ? selectedIndex === quiz.correctAnswerIndex : false;

  // ── Loading state ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Generating quiz…</Text>
        </View>
      </View>
    );
  }

  // ── Error state ────────────────────────────────────────────────────
  if (errorMessage || !quiz) {
    return (
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>
            {errorMessage || "Failed to generate quiz."}
          </Text>
          <View style={styles.errorButtons}>
            <TouchableOpacity
              style={[styles.btn, styles.retryBtn]}
              onPress={onRetry}
              activeOpacity={0.7}
            >
              <Text style={styles.btnText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.skipBtn]}
              onPress={onResume}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnText, styles.skipBtnText]}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── Quiz question ──────────────────────────────────────────────────
  return (
    <View style={styles.overlay}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {/* Question */}
          <Text style={styles.questionLabel}>📝  Comprehension Check</Text>
          <Text style={styles.questionText}>{quiz.question}</Text>

          {/* Options */}
          {quiz.options.map((option, idx) => {
            const letter = String.fromCharCode(65 + idx); // A, B, C, D
            let optionStyle = styles.option;
            let optionTextStyle = styles.optionText;

            if (answered) {
              if (idx === quiz.correctAnswerIndex) {
                optionStyle = { ...styles.option, ...styles.optionCorrect };
                optionTextStyle = { ...styles.optionText, ...styles.optionTextCorrect };
              } else if (idx === selectedIndex) {
                optionStyle = { ...styles.option, ...styles.optionIncorrect };
                optionTextStyle = { ...styles.optionText, ...styles.optionTextIncorrect };
              }
            }

            return (
              <TouchableOpacity
                key={idx}
                style={optionStyle}
                onPress={() => {
                  if (!answered) setSelectedIndex(idx);
                }}
                activeOpacity={answered ? 1 : 0.7}
                disabled={answered}
              >
                <Text style={optionTextStyle}>
                  {letter}.  {option}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Feedback */}
          {answered && (
            <View style={styles.feedbackSection}>
              <Text
                style={[
                  styles.feedbackBadge,
                  isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect,
                ]}
              >
                {isCorrect ? "✓  Correct!" : "✗  Incorrect"}
              </Text>

              <Text style={styles.explanationText}>{quiz.explanation}</Text>

              <TouchableOpacity
                style={[styles.btn, styles.resumeBtn]}
                onPress={onResume}
                activeOpacity={0.7}
              >
                <Text style={[styles.btnText, styles.resumeBtnText]}>
                  Continue Reading →
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    // Subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },

  // Loading
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: COLORS.textMuted,
    fontFamily: "serif",
    textAlign: "center",
  },

  // Error
  errorIcon: {
    fontSize: 32,
    textAlign: "center",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    fontFamily: "serif",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  errorButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },

  // Question
  questionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.accent,
    fontFamily: "serif",
    marginBottom: 8,
  },
  questionText: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "serif",
    lineHeight: 24,
    marginBottom: 20,
  },

  // Options
  option: {
    borderWidth: 2,
    borderColor: COLORS.surface,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    backgroundColor: COLORS.white,
  },
  optionCorrect: {
    borderColor: COLORS.correct,
    backgroundColor: "#eafaf1",
  },
  optionIncorrect: {
    borderColor: COLORS.incorrect,
    backgroundColor: "#fdecea",
  },
  optionText: {
    fontSize: 15,
    color: COLORS.text,
    fontFamily: "serif",
    lineHeight: 21,
  },
  optionTextCorrect: {
    color: COLORS.correct,
    fontWeight: "600",
  },
  optionTextIncorrect: {
    color: COLORS.incorrect,
    fontWeight: "600",
  },

  // Feedback
  feedbackSection: {
    marginTop: 16,
    alignItems: "center",
  },
  feedbackBadge: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "serif",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 10,
  },
  feedbackCorrect: {
    backgroundColor: "#eafaf1",
    color: COLORS.correct,
  },
  feedbackIncorrect: {
    backgroundColor: "#fdecea",
    color: COLORS.incorrect,
  },
  explanationText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontFamily: "serif",
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 16,
  },

  // Buttons
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  retryBtn: {
    backgroundColor: COLORS.accent,
  },
  skipBtn: {
    backgroundColor: COLORS.surface,
  },
  skipBtnText: {
    color: COLORS.textMuted,
  },
  resumeBtn: {
    backgroundColor: COLORS.accent,
    width: "100%",
  },
  resumeBtnText: {
    color: COLORS.white,
  },
  btnText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.white,
    fontFamily: "serif",
  },
});
