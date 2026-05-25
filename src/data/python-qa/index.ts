// ============================================================
// Python interview questions for quant dev candidates
// ============================================================
// These are questions I would ask if I were screening for a quant
// dev role. Mix of: Python language traps, numpy/pandas idioms,
// performance, OOP design, and "implement this finance primitive."
// Every solution is heavily commented line-by-line.
// ============================================================

import { languageQuestions } from "./language";
import { numpyQuestions } from "./numpy";
import { financeQuestions } from "./finance";
import { designQuestions } from "./design";

export type PyDifficulty = "junior" | "mid" | "senior";

export type PyCategory =
  | "language"      // Python-specific gotchas (mutable defaults, GIL, is vs ==)
  | "numpy"         // vectorization, broadcasting, pandas
  | "finance"       // implement BS, OLS, EMA, drawdown, etc.
  | "design";       // small system design — orderbook, position tracker

export type PyQuestion = {
  id: string;
  title: string;
  difficulty: PyDifficulty;
  category: PyCategory;
  /** What this question reveals about a candidate */
  signal: string;
  /** The question as you'd actually ask it in an interview */
  question: string;
  /** Common ways junior candidates trip up */
  watchFor?: string[];
  /** Reference solution. Heavily commented. Use template-literal-safe code. */
  solution: string;
  /** Optional follow-up question to ratchet difficulty */
  followUp?: string;
};

export const pythonQuestions: PyQuestion[] = [
  ...languageQuestions,
  ...numpyQuestions,
  ...financeQuestions,
  ...designQuestions,
];
