// Single source of truth for in-app routes. Keep nav + page imports DRY.

export const ROUTES = {
  HOME: "/",
  PY101: "/py-101",
  MATH101: "/math-101",
  NP101: "/np-101",
  PYTHON: "/python",
  PROBABILITY: "/probability",
  PRICING: "/pricing",
  STATS: "/stats",
  CPP: "/cpp",
  GRIND: "/grind",
  SIM: "/sim",
  PROFILE: "/profile",
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];

export type TrackId =
  | "py101"
  | "math101"
  | "np101"
  | "python"
  | "probability"
  | "pricing"
  | "stats"
  | "cpp"
  | "grind"
  | "sim";

export type TrackStatus = "active" | "soon";

export type TrackGroup = "foundations" | "interview";

export const TRACK_META: Record<
  TrackId,
  { title: string; blurb: string; color: string; href: Route; status: TrackStatus; group: TrackGroup }
> = {
  py101: {
    title: "Python 101",
    blurb: "From print() to classes. Start here.",
    color: "#22c55e",
    href: ROUTES.PY101,
    status: "active",
    group: "foundations",
  },
  math101: {
    title: "Math 101",
    blurb: "Probability, calculus, linear algebra",
    color: "#22c55e",
    href: ROUTES.MATH101,
    status: "active",
    group: "foundations",
  },
  np101: {
    title: "Numpy + Pandas",
    blurb: "Arrays, dataframes, vectorization",
    color: "#22c55e",
    href: ROUTES.NP101,
    status: "active",
    group: "foundations",
  },
  python: {
    title: "Python Q&A",
    blurb: "Interview questions w/ commented solutions",
    color: "var(--accent-blue)",
    href: ROUTES.PYTHON,
    status: "active",
    group: "interview",
  },
  probability: {
    title: "Probability",
    blurb: "EV, Bayes, Markov, brainteasers",
    color: "var(--track-prob)",
    href: ROUTES.PROBABILITY,
    status: "active",
    group: "interview",
  },
  grind: {
    title: "Grind",
    blurb: "LC-finance code reps",
    color: "var(--track-grind)",
    href: ROUTES.GRIND,
    status: "active",
    group: "interview",
  },
  pricing: {
    title: "Pricing",
    blurb: "Black-Scholes, Greeks, binomial",
    color: "var(--track-pricing)",
    href: ROUTES.PRICING,
    status: "active",
    group: "interview",
  },
  stats: {
    title: "Stats",
    blurb: "OLS, time series, cointegration",
    color: "var(--track-stats)",
    href: ROUTES.STATS,
    status: "active",
    group: "interview",
  },
  cpp: {
    title: "C++ / HFT",
    blurb: "OrderBook, lock-free, low-latency",
    color: "var(--track-cpp)",
    href: ROUTES.CPP,
    status: "active",
    group: "interview",
  },
  sim: {
    title: "Sim",
    blurb: "Market-making orderbook",
    color: "var(--track-sim)",
    href: ROUTES.SIM,
    status: "soon",
    group: "interview",
  },
};
