// Single source of truth for in-app routes. Keep nav + page imports DRY.

export const ROUTES = {
  HOME: "/",
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
  | "probability"
  | "pricing"
  | "stats"
  | "cpp"
  | "grind"
  | "sim";

export const TRACK_META: Record<
  TrackId,
  { title: string; blurb: string; color: string; href: Route }
> = {
  probability: {
    title: "Probability",
    blurb: "EV, Bayes, Markov, brainteasers",
    color: "var(--track-prob)",
    href: ROUTES.PROBABILITY,
  },
  pricing: {
    title: "Pricing",
    blurb: "Black-Scholes, Greeks, binomial",
    color: "var(--track-pricing)",
    href: ROUTES.PRICING,
  },
  stats: {
    title: "Stats",
    blurb: "OLS, time series, cointegration",
    color: "var(--track-stats)",
    href: ROUTES.STATS,
  },
  cpp: {
    title: "C++ / HFT",
    blurb: "OrderBook, lock-free, low-latency",
    color: "var(--track-cpp)",
    href: ROUTES.CPP,
  },
  grind: {
    title: "Grind",
    blurb: "LC-finance code reps",
    color: "var(--track-grind)",
    href: ROUTES.GRIND,
  },
  sim: {
    title: "Sim",
    blurb: "Market-making orderbook",
    color: "var(--track-sim)",
    href: ROUTES.SIM,
  },
};
