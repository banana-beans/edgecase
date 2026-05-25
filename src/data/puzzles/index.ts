// ============================================================
// Quant probability puzzle bank for /probability
// ============================================================

import { probabilityPuzzles } from "./probability";

export type PuzzleDifficulty = "easy" | "medium" | "hard";

export type PuzzleCategory =
  | "counting"
  | "conditional"
  | "expected-value"
  | "distributions"
  | "random-walk"
  | "markov"
  | "brainteaser"
  | "stopping";

export type Puzzle = {
  id: string;
  title: string;
  difficulty: PuzzleDifficulty;
  category: PuzzleCategory;
  /** Where this style of question shows up (informal, no inside info) */
  asked?: string[];
  /** The puzzle statement */
  problem: string;
  /** One-liner that nudges without solving */
  hint: string;
  /** Final answer, terse */
  answer: string;
  /** Intuition + key step. Paragraphs separated by \n\n. */
  solution: string;
  /** Optional Python simulation to verify the answer empirically */
  simulation?: string;
};

export const puzzles: Puzzle[] = [...probabilityPuzzles];
