// ============================================================
// LeetCode-style problem bank for /grind
// ============================================================
// Tap-to-reveal interview practice. Lightweight by design: hand
// curated seed + finance-flavored set, room to grow.
// ============================================================

import { seedProblems } from "./seed";
import { financeProblems } from "./finance";
import { financeBatch20260808 } from "./finance-2026-08-08-b1";
import { financeBatch20260809 } from "./finance-2026-08-09-b1";
import { financeBatch20260810 } from "./finance-2026-08-10-b1";
import { financeBatch20260811 } from "./finance-2026-08-11-b1";
import { financeBatch20260812 } from "./finance-2026-08-12-b1";

export type Difficulty = "easy" | "medium" | "hard";

export type LeetCodeProblem = {
  id: string;
  title: string;
  difficulty: Difficulty;
  topics: string[];
  problem: string;
  examples: Array<{ input: string; output: string; explanation?: string }>;
  constraints?: string[];
  approach: string;
  code: string;
  language: "python" | "cpp" | "typescript";
  complexity: { time: string; space: string };
  leetcodeNumber?: number;
};

export const leetcodeProblems: LeetCodeProblem[] = [
  ...seedProblems,
  ...financeProblems,
  ...financeBatch20260808,
  ...financeBatch20260809,
  ...financeBatch20260810,
  ...financeBatch20260811,
  ...financeBatch20260812,
];
