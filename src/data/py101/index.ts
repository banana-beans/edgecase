// ============================================================
// Python 101 — from zero programming experience to ready for
// the /python interview track.
// ============================================================
//
// Concepts are ORDERED. Don't shuffle this one. Each lesson builds
// on the previous; if you skip ahead and feel lost, go back two.
// ============================================================

import { py101Lessons } from "./lessons";

export type LessonTier = "intro" | "core" | "applied";

export type Lesson = {
  id: string;
  /** Used for sort + progression. Earlier = more foundational. */
  order: number;
  title: string;
  tier: LessonTier;
  /** One- or two-line summary of the concept */
  concept: string;
  /** Runnable Python code that illustrates it */
  code: string;
  /** What's happening line-by-line; uses \n for paragraph breaks */
  explanation: string;
  /** Common beginner mistake or surprise */
  gotcha?: string;
  /** Tiny practice problem the reader can do in their head */
  exercise?: string;
};

export const py101: Lesson[] = [...py101Lessons].sort(
  (a, b) => a.order - b.order
);
