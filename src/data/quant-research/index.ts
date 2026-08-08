// ============================================================
// Quant Research Q&A — the interview track for a quant research
// role. Nine modules covering the full research workflow, from
// raw data assembly to performance analytics. Every question has
// a "thinking" section: how a working quant reasons before they
// touch the keyboard. Python-heavy, pandas/numpy idioms throughout.
// ============================================================

import { dataQuestions } from "./data";
import { calendarsQuestions } from "./calendars";
import { cleaningQuestions } from "./cleaning";
import { featuresQuestions } from "./features";
import { pitQuestions } from "./pit";
import { statsQuestions } from "./stats";
import { portfolioQuestions } from "./portfolio";
import { backtestQuestions } from "./backtest";
import { analyticsQuestions } from "./analytics";

export type QRModuleId =
  | "data"       // M1 — data assembly: long/wide, pivots, dedup, dtypes
  | "calendars"  // M2 — calendars & alignment: reindex, tz, business days
  | "cleaning"   // M3 — cleaning & corporate actions: splits, outliers, survivorship
  | "features"   // M4 — feature construction: rolling, ranks, z-scores, neutralization
  | "pit"        // M5 — point-in-time discipline: merge_asof, lookahead
  | "stats"      // M6 — statistics: IC, Newey-West, multiple testing, bootstrap
  | "portfolio"  // M7 — portfolio construction: weights, covariance, turnover
  | "backtest"   // M8 — backtest mechanics: lagging, costs, vectorized P&L
  | "analytics"; // M9 — performance analytics: drawdown, Sharpe, attribution

export type QRDifficulty = "warmup" | "core" | "hard";

export type QRQuestion = {
  /** "qr-<module>-<nn>-<slug>" — must be globally unique */
  id: string;
  module: QRModuleId;
  title: string;
  difficulty: QRDifficulty;
  /** The question as an interviewer would actually ask it */
  question: string;
  /** How a quant reasons about this BEFORE writing anything —
   *  the math/probability/stats framing, the tradeoffs, what
   *  matters and what doesn't. This is the learning payload. */
  thinking: string;
  /** The crisp answer you'd want to say out loud */
  answer: string;
  /** Commented, idiomatic python (pandas/numpy). Most questions have one. */
  python?: string;
  /** The common wrong answer or subtle failure mode */
  trap?: string;
  /** Interviewer's ratchet — the next question if you nail this one */
  followUp?: string;
};

export const QR_MODULE_META: Record<
  QRModuleId,
  { label: string; short: string; blurb: string }
> = {
  data: {
    label: "Data Assembly",
    short: "data",
    blurb: "long/wide, pivots, dedup, dtypes",
  },
  calendars: {
    label: "Calendars & Alignment",
    short: "calendars",
    blurb: "reindex, timezones, business days",
  },
  cleaning: {
    label: "Cleaning & Corp Actions",
    short: "cleaning",
    blurb: "splits, outliers, survivorship",
  },
  features: {
    label: "Feature Construction",
    short: "features",
    blurb: "rolling, ranks, z-scores, neutralization",
  },
  pit: {
    label: "Point-in-Time",
    short: "PIT",
    blurb: "merge_asof, lookahead discipline",
  },
  stats: {
    label: "Statistics",
    short: "stats",
    blurb: "IC, Newey-West, multiple testing",
  },
  portfolio: {
    label: "Portfolio Construction",
    short: "portfolio",
    blurb: "weights, covariance, turnover",
  },
  backtest: {
    label: "Backtest Mechanics",
    short: "backtest",
    blurb: "lagging, costs, vectorized P&L",
  },
  analytics: {
    label: "Performance Analytics",
    short: "analytics",
    blurb: "drawdown, Sharpe, attribution",
  },
};

export const quantResearchQuestions: QRQuestion[] = [
  ...dataQuestions,
  ...calendarsQuestions,
  ...cleaningQuestions,
  ...featuresQuestions,
  ...pitQuestions,
  ...statsQuestions,
  ...portfolioQuestions,
  ...backtestQuestions,
  ...analyticsQuestions,
];
