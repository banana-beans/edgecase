// ============================================================
// Math 101 — the minimum to attack /probability and /stats.
// ============================================================
// 22 lessons covering probability foundations, calculus refresh,
// and linear algebra basics. Each lesson is one concept; "code"
// is small Python that *demonstrates* the math, not requires it.
// ============================================================

import { math101Lessons } from "./lessons";

export type MathTier = "prob" | "calc" | "linalg";

export type MathLesson = {
  id: string;
  order: number;
  title: string;
  tier: MathTier;
  /** One paragraph: what the concept IS, in English. */
  concept: string;
  /** Python that demonstrates / verifies the concept. */
  code: string;
  /** Deeper explanation: why this matters, common pitfalls. */
  explanation: string;
  /** Tiny practice problem. */
  exercise?: string;
};

export const math101: MathLesson[] = [...math101Lessons].sort(
  (a, b) => a.order - b.order
);
