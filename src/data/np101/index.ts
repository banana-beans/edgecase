// ============================================================
// Numpy + Pandas 101 — bridge from Python basics to /python Q&A.
// ============================================================

import { np101Lessons } from "./lessons";

export type NpTier = "numpy" | "pandas" | "applied";

export type NpLesson = {
  id: string;
  order: number;
  title: string;
  tier: NpTier;
  concept: string;
  code: string;
  explanation: string;
  exercise?: string;
};

export const np101: NpLesson[] = [...np101Lessons].sort(
  (a, b) => a.order - b.order
);
