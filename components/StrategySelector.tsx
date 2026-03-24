/**
 * StrategySelector.tsx — Lets the user choose a quiz strategy before reading.
 *
 * Three options:
 *   Micro      — quiz every 100 words
 *   Segmented  — quiz every 500 words
 *   Post-Game  — quiz only at the end of the text
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  COLORS,
  QuizStrategy,
  STRATEGY_LABELS,
} from "../config";

interface StrategySelectorProps {
  /** The currently selected strategy. */
  selected: QuizStrategy;
  /** Called when the user picks a strategy. */
  onSelect: (strategy: QuizStrategy) => void;
}

const STRATEGIES: QuizStrategy[] = ["micro", "segmented", "postgame"];

export default function StrategySelector({
  selected,
  onSelect,
}: StrategySelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>📝  Quiz Strategy</Text>

      <View style={styles.row}>
        {STRATEGIES.map((key) => {
          const isActive = key === selected;
          const { title, desc } = STRATEGY_LABELS[key];

          return (
            <TouchableOpacity
              key={key}
              style={[styles.card, isActive && styles.cardActive]}
              onPress={() => onSelect(key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cardTitle, isActive && styles.cardTitleActive]}>
                {title}
              </Text>
              <Text style={[styles.cardDesc, isActive && styles.cardDescActive]}>
                {desc}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  heading: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "serif",
    marginBottom: 8,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  card: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.surface,
    backgroundColor: COLORS.surface,
    alignItems: "center",
  },
  cardActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.background,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textMuted,
    fontFamily: "serif",
  },
  cardTitleActive: {
    color: COLORS.accent,
  },
  cardDesc: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontFamily: "serif",
    marginTop: 2,
    textAlign: "center",
  },
  cardDescActive: {
    color: COLORS.text,
  },
});
