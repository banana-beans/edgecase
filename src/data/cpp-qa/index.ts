// ============================================================
// C++ for HFT/quant interviews
// ============================================================
// Patterns + idioms + traps. Format is "annotated pattern":
// the code, when to use it, what it costs, what an interviewer
// would push you on. Modern C++ (17/20/23).
// ============================================================
//
// IMPORTANT — TEMPLATE LITERAL ESCAPING
// All code strings here use plain backticks. JavaScript's `${...}`
// interpolation must NEVER appear unescaped in these strings. C++
// syntax doesn't need ${...} naturally, but if you ever paste code
// that has it, escape as \${...}. This caught the learner agent.
// ============================================================

import { foundations } from "./foundations";
import { memory } from "./memory";
import { concurrency } from "./concurrency";
import { hft } from "./hft";

export type CppLevel = "foundations" | "modern" | "memory" | "concurrency" | "hft";

export type CppPattern = {
  id: string;
  title: string;
  level: CppLevel;
  /** What an interviewer is testing when they ask about this */
  signal: string;
  /** The pattern itself */
  code: string;
  /** When you'd reach for this, and when you wouldn't */
  whenToUse: string;
  /** Common bugs / interview gotchas */
  trap?: string;
  /** Optional follow-up to ratchet difficulty */
  followUp?: string;
};

export const cppPatterns: CppPattern[] = [
  ...foundations,
  ...memory,
  ...concurrency,
  ...hft,
];
