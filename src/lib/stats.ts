// ============================================================
// Lightweight stats primitives for interactive demos.
// ============================================================

/** Deterministic PRNG so demos are reproducible. xorshift32. */
export function makeRng(seed: number) {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) - 0.5;   // uniform in [-0.5, 0.5)
  };
}

/** Box-Muller from a uniform-in-[-0.5, 0.5) RNG. Returns standard normal. */
export function randNormal(rng: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rng() + 0.5;
  while (v === 0) v = rng() + 0.5;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Simple linear regression y = a + b·x. Returns intercept, slope, R². */
export function ols(xs: number[], ys: number[]): { a: number; b: number; r2: number } {
  const n = xs.length;
  if (n < 2) return { a: 0, b: 0, r2: 0 };
  let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
    sxx += xs[i] * xs[i];
    sxy += xs[i] * ys[i];
    syy += ys[i] * ys[i];
  }
  const meanX = sx / n;
  const meanY = sy / n;
  const ssXX = sxx - n * meanX * meanX;
  const ssXY = sxy - n * meanX * meanY;
  const ssYY = syy - n * meanY * meanY;
  const b = ssXY / ssXX;
  const a = meanY - b * meanX;
  const r2 = ssYY > 0 ? (ssXY * ssXY) / (ssXX * ssYY) : 0;
  return { a, b, r2 };
}

/** Generate an AR(1) series: x_t = phi · x_{t-1} + noise. */
export function ar1(n: number, phi: number, noiseSd: number, rng: () => number): number[] {
  const out = new Array<number>(n);
  out[0] = randNormal(rng) * noiseSd;
  for (let i = 1; i < n; i++) {
    out[i] = phi * out[i - 1] + randNormal(rng) * noiseSd;
  }
  return out;
}

/** Sample autocorrelation at lag k. */
export function autocorr(x: number[], k: number): number {
  const n = x.length;
  const mean = x.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n - k; i++) {
    num += (x[i] - mean) * (x[i + k] - mean);
  }
  for (let i = 0; i < n; i++) {
    den += (x[i] - mean) ** 2;
  }
  return den > 0 ? num / den : 0;
}
