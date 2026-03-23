/**
 * WordDisplay.tsx — Fixed-anchor RSVP word display.
 *
 * The pivot letter is always pinned to the exact horizontal center of the
 * screen.  The "before" text flows leftward (right-aligned) and the "after"
 * text flows rightward (left-aligned) from that fixed point.
 *
 * If either side would overflow the available half-width the entire word is
 * uniformly scaled down until it fits on a single line.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
} from "react-native";
import { COLORS } from "../config";

// ─── Constants ──────────────────────────────────────────────────────────
const BASE_FONT_SIZE = 42;
const MIN_FONT_SIZE = 16;
/** Horizontal padding on each side of the display area. */
const H_PADDING = 24;

// ─── Pivot index (Spritz-style ORP) ────────────────────────────────────
interface WordDisplayProps {
  word: string;
  totalWords: number;
  currentIndex: number;
}

function getPivotIndex(word: string): number {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 3) return 1;
  if (len <= 5) return 2;
  return Math.floor(len * 0.35);
}

// ─── Component ──────────────────────────────────────────────────────────
export default function WordDisplay({
  word,
  totalWords,
  currentIndex,
}: WordDisplayProps) {
  // Width of the full container (measured via onLayout)
  const [containerWidth, setContainerWidth] = useState(0);

  // Dynamic font size — starts at BASE and shrinks if the word overflows
  const [fontSize, setFontSize] = useState(BASE_FONT_SIZE);

  // Measured widths of each text segment at the *current* font size
  const beforeWidthRef = useRef(0);
  const pivotWidthRef = useRef(0);
  const afterWidthRef = useRef(0);

  // Track whether we're still measuring (hide text to prevent flicker)
  const [measuring, setMeasuring] = useState(false);

  // ── Reset font size whenever the word changes ──────────────────────
  useEffect(() => {
    setFontSize(BASE_FONT_SIZE);
    setMeasuring(true);
  }, [word]);

  // ── Measure the container ──────────────────────────────────────────
  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  // Half the available width (from center to edge, minus padding)
  const halfWidth = containerWidth > 0 ? (containerWidth - H_PADDING * 2) / 2 : 0;

  // ── After all three segments report their widths, check fit ────────
  const pendingMeasures = useRef(0);

  const checkFit = useCallback(() => {
    if (halfWidth <= 0) return;

    // Space needed on the left  = before text + left half of pivot
    const leftNeed = beforeWidthRef.current + pivotWidthRef.current / 2;
    // Space needed on the right = right half of pivot + after text
    const rightNeed = afterWidthRef.current + pivotWidthRef.current / 2;

    const maxNeed = Math.max(leftNeed, rightNeed);

    if (maxNeed > halfWidth && fontSize > MIN_FONT_SIZE) {
      // Scale down proportionally, but drop at least 1 px per step
      const scale = halfWidth / maxNeed;
      const next = Math.max(MIN_FONT_SIZE, Math.floor(fontSize * scale));
      setFontSize(next);
      // measuring remains true — the new size will trigger another measure
    } else {
      // Fits! Reveal the text.
      setMeasuring(false);
    }
  }, [halfWidth, fontSize]);

  /** Called by each hidden measuring <Text> once it's laid out. */
  const onSegmentLayout = useCallback(
    (segment: "before" | "pivot" | "after") =>
      (e: LayoutChangeEvent) => {
        const w = e.nativeEvent.layout.width;
        if (segment === "before") beforeWidthRef.current = w;
        else if (segment === "pivot") pivotWidthRef.current = w;
        else afterWidthRef.current = w;

        pendingMeasures.current += 1;
        // Once all three segments have reported, check fit
        if (pendingMeasures.current >= 3) {
          pendingMeasures.current = 0;
          checkFit();
        }
      },
    [checkFit],
  );

  // ── Idle state (no word loaded) ────────────────────────────────────
  if (!word) {
    return (
      <View style={styles.container} onLayout={onContainerLayout}>
        <Text style={styles.placeholder}>Upload a PDF to start reading</Text>
      </View>
    );
  }

  // ── Split the word around the pivot ────────────────────────────────
  const pivot = getPivotIndex(word);
  const before = word.slice(0, pivot);
  const pivotChar = word[pivot];
  const after = word.slice(pivot + 1);

  const progress =
    totalWords > 0
      ? Math.round(((currentIndex + 1) / totalWords) * 100)
      : 0;

  // Shared text style at the current (possibly scaled) font size
  const dynamicText = { fontSize, letterSpacing: 1, fontFamily: "serif" };

  return (
    <View style={styles.container} onLayout={onContainerLayout}>
      {/* ── Hidden measuring layer ────────────────────
          Absolutely positioned & transparent so it never affects layout.
          Each <Text> fires onLayout so we can read its rendered width. */}
      <View style={styles.measureLayer} pointerEvents="none">
        <Text
          style={[styles.wordText, dynamicText]}
          onLayout={onSegmentLayout("before")}
          numberOfLines={1}
        >
          {before}
        </Text>
        <Text
          style={[styles.wordText, styles.pivotChar, dynamicText]}
          onLayout={onSegmentLayout("pivot")}
          numberOfLines={1}
        >
          {pivotChar}
        </Text>
        <Text
          style={[styles.wordText, dynamicText]}
          onLayout={onSegmentLayout("after")}
          numberOfLines={1}
        >
          {after}
        </Text>
      </View>

      {/* ── Visible fixed-anchor layout ───────────────
          Two equal halves split at the screen centre.
          Left half: right-aligned "before" + left half of pivot.
          Right half: right half of pivot + left-aligned "after". */}
      <View style={[styles.anchorRow, { opacity: measuring ? 0 : 1 }]}>
        {/* LEFT HALF — right-aligned so text butts up against the center */}
        <View style={styles.halfLeft}>
          <Text
            style={[styles.wordText, dynamicText, styles.beforeText]}
            numberOfLines={1}
          >
            {before}
          </Text>
        </View>

        {/* PIVOT — sits exactly at the center dividing line */}
        <Text
          style={[styles.wordText, styles.pivotChar, dynamicText]}
          numberOfLines={1}
        >
          {pivotChar}
        </Text>

        {/* RIGHT HALF — left-aligned so text flows away from the center */}
        <View style={styles.halfRight}>
          <Text
            style={[styles.wordText, dynamicText, styles.afterText]}
            numberOfLines={1}
          >
            {after}
          </Text>
        </View>
      </View>

      {/* ── Pivot guide tick ──────────────────────────── */}
      <View style={styles.guideLine} />

      {/* ── Progress counter ──────────────────────────── */}
      <Text style={styles.progress}>
        {currentIndex + 1} / {totalWords} words ({progress}%)
      </Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: H_PADDING,
  },
  placeholder: {
    fontSize: 18,
    color: COLORS.textMuted,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 28,
  },

  /* ── Hidden measurement layer (off-screen, invisible) ─────────── */
  measureLayer: {
    position: "absolute",
    flexDirection: "row",
    opacity: 0,
  },

  /* ── Visible fixed-anchor row ─────────────────────────────────── */
  anchorRow: {
    flexDirection: "row",
    alignItems: "baseline",
    width: "100%",
    justifyContent: "center",
  },
  halfLeft: {
    flex: 1,
    alignItems: "flex-end",    // right-align → text ends at center
    overflow: "hidden",
  },
  halfRight: {
    flex: 1,
    alignItems: "flex-start",  // left-align → text starts from center
    overflow: "hidden",
  },

  /* ── Text styles ──────────────────────────────────────────────── */
  wordText: {
    color: COLORS.text,
  },
  beforeText: {
    textAlign: "right",
  },
  afterText: {
    textAlign: "left",
  },
  pivotChar: {
    color: COLORS.accent,
    fontWeight: "bold",
  },

  /* ── Guide line & progress ────────────────────────────────────── */
  guideLine: {
    width: 2,
    height: 18,
    backgroundColor: COLORS.accent,
    marginTop: 4,
    borderRadius: 1,
    opacity: 0.6,
  },
  progress: {
    marginTop: 24,
    fontSize: 13,
    color: COLORS.textMuted,
    fontFamily: "serif",
  },
});
