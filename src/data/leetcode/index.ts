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
import { financeBatch20260813 } from "./finance-2026-08-13-b1";
import { financeBatch20260814 } from "./finance-2026-08-14-b1";
import { financeBatch20260815 } from "./finance-2026-08-15-b1";
import { financeBatch20260816 } from "./finance-2026-08-16-b1";
import { financeBatch20260817 } from "./finance-2026-08-17-b1";
import { financeBatch20260818 } from "./finance-2026-08-18-b1";
import { financeBatch20260819 } from "./finance-2026-08-19-b1";
import { financeBatch20260820 } from "./finance-2026-08-20-b1";
import { financeBatch20260821 } from "./finance-2026-08-21-b1";
import { financeBatch20260822 } from "./finance-2026-08-22-b1";
import { financeBatch20260823 } from "./finance-2026-08-23-b1";
import { financeBatch20260824 } from "./finance-2026-08-24-b1";
import { financeBatch20260825 } from "./finance-2026-08-25-b1";
import { financeBatch20260826 } from "./finance-2026-08-26-b1";
import { financeBatch20260827 } from "./finance-2026-08-27-b1";
import { financeBatch20260828 } from "./finance-2026-08-28-b1";
import { financeBatch20260829 } from "./finance-2026-08-29-b1";
import { financeBatch20260830 } from "./finance-2026-08-30-b1";
import { financeBatch20260831 } from "./finance-2026-08-31-b1";
import { financeBatch20260901 } from "./finance-2026-09-01-b1";
import { financeBatch20260902 } from "./finance-2026-09-02-b1";
import { financeBatch20260903 } from "./finance-2026-09-03-b1";

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
  ...financeBatch20260813,
  ...financeBatch20260814,
  ...financeBatch20260815,
  ...financeBatch20260816,
  ...financeBatch20260817,
  ...financeBatch20260818,
  ...financeBatch20260819,
  ...financeBatch20260820,
  ...financeBatch20260821,
  ...financeBatch20260822,
  ...financeBatch20260823,
  ...financeBatch20260824,
  ...financeBatch20260825,
  ...financeBatch20260826,
  ...financeBatch20260827,
  ...financeBatch20260828,
  ...financeBatch20260829,
  ...financeBatch20260830,
  ...financeBatch20260831,
  ...financeBatch20260901,
  ...financeBatch20260902,
  ...financeBatch20260903,
];
