/**
 * Controls.tsx — Playback and speed controls for the reader.
 *
 * Provides:
 *  • Upload PDF button
 *  • Play / Pause toggle
 *  • Reset button
 *  • WPM speed slider with -/+ buttons
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import Slider from "@react-native-community/slider";
import { COLORS, MIN_WPM, MAX_WPM, WPM_STEP } from "../config";

interface ControlsProps {
  /** Whether words are loaded and ready to play. */
  hasWords: boolean;
  /** Whether playback is currently running. */
  isPlaying: boolean;
  /** Current speed in words per minute. */
  wpm: number;
  /** Whether a PDF is currently being uploaded/processed. */
  isLoading: boolean;
  /** Called when the user taps "Upload PDF". */
  onUpload: () => void;
  /** Called when the user taps Play or Pause. */
  onPlayPause: () => void;
  /** Called when the user taps Reset. */
  onReset: () => void;
  /** Called when the user changes WPM. */
  onWpmChange: (wpm: number) => void;
}

export default function Controls({
  hasWords,
  isPlaying,
  wpm,
  isLoading,
  onUpload,
  onPlayPause,
  onReset,
  onWpmChange,
}: ControlsProps) {
  /** Clamp WPM within bounds. */
  const adjustWpm = (delta: number) => {
    const next = Math.max(MIN_WPM, Math.min(MAX_WPM, wpm + delta));
    onWpmChange(next);
  };

  return (
    <View style={styles.container}>
      {/* ── Upload button ──────────────────────────── */}
      <TouchableOpacity
        style={[styles.btn, styles.uploadBtn]}
        onPress={onUpload}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        <Text style={styles.btnText}>
          {isLoading ? "Processing…" : "📄  Upload PDF"}
        </Text>
      </TouchableOpacity>

      {/* ── Playback buttons (only show when words are loaded) ── */}
      {hasWords && (
        <View style={styles.playbackRow}>
          <TouchableOpacity
            style={[styles.btn, styles.controlBtn]}
            onPress={onReset}
            activeOpacity={0.7}
          >
            <Text style={styles.btnText}>⏮  Reset</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.controlBtn, styles.playBtn]}
            onPress={onPlayPause}
            activeOpacity={0.7}
          >
            <Text style={[styles.btnText, styles.playBtnText]}>
              {isPlaying ? "⏸  Pause" : "▶  Play"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Speed controls ─────────────────────────── */}
      {hasWords && (
        <View style={styles.speedSection}>
          <Text style={styles.speedLabel}>{wpm} WPM</Text>

          <View style={styles.sliderRow}>
            {/* Minus button */}
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => adjustWpm(-WPM_STEP)}
              activeOpacity={0.6}
            >
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>

            {/* Slider */}
            <Slider
              style={styles.slider}
              minimumValue={MIN_WPM}
              maximumValue={MAX_WPM}
              step={WPM_STEP}
              value={wpm}
              onValueChange={onWpmChange}
              minimumTrackTintColor={COLORS.accent}
              maximumTrackTintColor={COLORS.surface}
              thumbTintColor={COLORS.accent}
            />

            {/* Plus button */}
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => adjustWpm(WPM_STEP)}
              activeOpacity={0.6}
            >
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.speedRange}>
            <Text style={styles.rangeText}>{MIN_WPM}</Text>
            <Text style={styles.rangeText}>{MAX_WPM}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: "center",
  },

  // Buttons
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadBtn: {
    backgroundColor: COLORS.accent,
    width: "100%",
    marginBottom: 16,
  },
  controlBtn: {
    backgroundColor: COLORS.surface,
    flex: 1,
    marginHorizontal: 6,
  },
  playBtn: {
    backgroundColor: COLORS.accent,
  },
  btnText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "serif",
  },
  playBtnText: {
    color: COLORS.white,
  },

  // Playback row
  playbackRow: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 20,
  },

  // Speed section
  speedSection: {
    width: "100%",
    alignItems: "center",
  },
  speedLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "serif",
    marginBottom: 8,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  slider: {
    flex: 1,
    height: 40,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    lineHeight: 24,
  },
  speedRange: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 44,
    marginTop: 2,
  },
  rangeText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
});
