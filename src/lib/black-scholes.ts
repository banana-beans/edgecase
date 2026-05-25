// ============================================================
// Black-Scholes pricing + Greeks, in pure TypeScript.
// ============================================================
// No external math libs — we implement the normal CDF and PDF
// directly so the page stays light. Accurate to ~1e-7, plenty for
// teaching intuition.
// ============================================================

/** Standard normal PDF: (1/√(2π)) · exp(-x²/2). */
export function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Standard normal CDF. Uses Abramowitz & Stegun 26.2.17 — a polynomial
 * approximation accurate to ~7.5e-8 absolute error. Plenty for UI.
 */
export function normCdf(x: number): number {
  // Constants from the A&S approximation
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

export type BsInputs = {
  S: number;       // spot price
  K: number;       // strike
  T: number;       // time to expiry in years
  r: number;       // risk-free rate (continuously compounded)
  sigma: number;   // implied vol (annualized)
};

export type Greeks = {
  price: number;
  delta: number;
  gamma: number;
  vega: number;     // per 1.00 unit of vol (so a $1 change in IV is vega/100)
  theta: number;   // per year — divide by 365 for per calendar day
  rho: number;     // per 1.00 unit of rate
};

/** d1 and d2 — the two quantities used everywhere in BS. */
export function d1d2({ S, K, T, r, sigma }: BsInputs): [number, number] {
  // Degenerate cases — guard against div-by-zero at expiry / zero vol
  const safeT = Math.max(T, 1e-12);
  const safeSigma = Math.max(sigma, 1e-12);
  const sqrtT = Math.sqrt(safeT);
  const d1 = (Math.log(S / K) + (r + 0.5 * safeSigma * safeSigma) * safeT) / (safeSigma * sqrtT);
  const d2 = d1 - safeSigma * sqrtT;
  return [d1, d2];
}

export function callPrice(inp: BsInputs): number {
  const { S, K, T, r } = inp;
  const [d1, d2] = d1d2(inp);
  return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
}

export function putPrice(inp: BsInputs): number {
  const { S, K, T, r } = inp;
  const [d1, d2] = d1d2(inp);
  return K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1);
}

export function callGreeks(inp: BsInputs): Greeks {
  const { S, K, T, r, sigma } = inp;
  const [d1, d2] = d1d2(inp);
  const sqrtT = Math.sqrt(Math.max(T, 1e-12));
  const pdf_d1 = normPdf(d1);
  const discK = K * Math.exp(-r * T);
  return {
    price: S * normCdf(d1) - discK * normCdf(d2),
    delta: normCdf(d1),
    gamma: pdf_d1 / (S * sigma * sqrtT),
    vega:  S * pdf_d1 * sqrtT,
    theta: -S * pdf_d1 * sigma / (2 * sqrtT) - r * discK * normCdf(d2),
    rho:   K * T * Math.exp(-r * T) * normCdf(d2),
  };
}

export function putGreeks(inp: BsInputs): Greeks {
  const { S, K, T, r, sigma } = inp;
  const [d1, d2] = d1d2(inp);
  const sqrtT = Math.sqrt(Math.max(T, 1e-12));
  const pdf_d1 = normPdf(d1);
  const discK = K * Math.exp(-r * T);
  return {
    price: discK * normCdf(-d2) - S * normCdf(-d1),
    delta: normCdf(d1) - 1,
    gamma: pdf_d1 / (S * sigma * sqrtT),
    vega:  S * pdf_d1 * sqrtT,
    theta: -S * pdf_d1 * sigma / (2 * sqrtT) + r * discK * normCdf(-d2),
    rho:  -K * T * Math.exp(-r * T) * normCdf(-d2),
  };
}
