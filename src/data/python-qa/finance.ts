import type { PyQuestion } from "./index";

// ============================================================
// "Implement this finance primitive" questions.
// Every quant interview hits at least one of these.
// ============================================================

export const financeQuestions: PyQuestion[] = [
  {
    id: "py-black-scholes",
    title: "Implement Black-Scholes",
    difficulty: "mid",
    category: "finance",
    signal:
      "The single most-asked quant Python interview question. Tests math + numpy + ability to write clean numeric code.",
    question:
      "Implement the Black-Scholes price for a European call and put. Then add the five Greeks (delta, gamma, vega, theta, rho). Don't import any options libraries. You may use scipy.stats.norm.",
    watchFor: [
      "Candidate forgets to express σ and T in consistent units (years).",
      "Candidate's vega/theta are off by a factor of 100 or 365 (units convention slip).",
      "Strong signal: candidate writes it vectorized so it handles arrays of S, K, T.",
    ],
    solution: `import numpy as np
from scipy.stats import norm

# ----------------------------------------------------------
# Black-Scholes-Merton — European call and put, no dividends.
# ----------------------------------------------------------
# S:     spot price
# K:     strike
# T:     time to expiry, in YEARS
# r:     risk-free rate, continuously compounded, annualized
# sigma: implied volatility, annualized
#
# All of these can be scalars OR numpy arrays; this implementation
# vectorizes naturally because every numpy op broadcasts.

def d1_d2(S, K, T, r, sigma):
    # The two terms that show up everywhere in BS-land.
    # We compute them once and reuse — slightly faster, and any
    # numerical issues (e.g., very-small T) only happen in one place.
    sqrt_T = np.sqrt(T)
    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * sqrt_T)
    d2 = d1 - sigma * sqrt_T
    return d1, d2

def bs_call(S, K, T, r, sigma):
    # Forward intuition: a call is "buy S, financed at rate r, conditional
    # on S_T > K." The two terms are exactly that, weighted by
    # risk-neutral probabilities.
    d1, d2 = d1_d2(S, K, T, r, sigma)
    return S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)

def bs_put(S, K, T, r, sigma):
    # By put-call parity: C - P = S - K·e^{-rT}, so P = C - S + K·e^{-rT}.
    # We could derive directly; here we use the direct formula for clarity.
    d1, d2 = d1_d2(S, K, T, r, sigma)
    return K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)

# ----------------------------------------------------------
# The five Greeks — all derived from d1 and d2.
# ----------------------------------------------------------
# Convention: returned in their "natural" units. So:
#   delta is unitless (sensitivity to a $1 move in spot, expressed as $)
#   gamma is per $ (units: 1/$)
#   vega  is per 100% vol move ("per 1.00 unit of sigma")
#         Many practitioners quote vega per 1 vol-POINT (1%) — divide by 100.
#   theta is per YEAR. Divide by 365 for per-day, by 252 for per-trading-day.
#   rho   is per 100% rate move. Divide by 100 for per-1%-rate.

def delta_call(S, K, T, r, sigma):
    d1, _ = d1_d2(S, K, T, r, sigma)
    return norm.cdf(d1)

def delta_put(S, K, T, r, sigma):
    d1, _ = d1_d2(S, K, T, r, sigma)
    return norm.cdf(d1) - 1          # delta_call - 1 (put-call parity)

def gamma(S, K, T, r, sigma):
    # Identical for call and put. norm.pdf(d1)/(S·σ·√T)
    d1, _ = d1_d2(S, K, T, r, sigma)
    return norm.pdf(d1) / (S * sigma * np.sqrt(T))

def vega(S, K, T, r, sigma):
    # Identical for call and put. S·norm.pdf(d1)·√T
    d1, _ = d1_d2(S, K, T, r, sigma)
    return S * norm.pdf(d1) * np.sqrt(T)

def theta_call(S, K, T, r, sigma):
    d1, d2 = d1_d2(S, K, T, r, sigma)
    # Two terms: vol bleed (always negative for long options) and
    # rate carry. Sign convention: theta is the change in price per
    # unit of TIME ELAPSED, so it's normally negative for long calls.
    term1 = -S * norm.pdf(d1) * sigma / (2 * np.sqrt(T))
    term2 = -r * K * np.exp(-r * T) * norm.cdf(d2)
    return term1 + term2

def theta_put(S, K, T, r, sigma):
    d1, d2 = d1_d2(S, K, T, r, sigma)
    term1 = -S * norm.pdf(d1) * sigma / (2 * np.sqrt(T))
    term2 = r * K * np.exp(-r * T) * norm.cdf(-d2)
    return term1 + term2

def rho_call(S, K, T, r, sigma):
    _, d2 = d1_d2(S, K, T, r, sigma)
    return K * T * np.exp(-r * T) * norm.cdf(d2)

def rho_put(S, K, T, r, sigma):
    _, d2 = d1_d2(S, K, T, r, sigma)
    return -K * T * np.exp(-r * T) * norm.cdf(-d2)

# ----------------------------------------------------------
# Sanity check: ATM 1-year call with vol 20%, rate 5%.
# ----------------------------------------------------------
S, K, T, r, sigma = 100, 100, 1.0, 0.05, 0.20
print(f"call:  {bs_call(S, K, T, r, sigma):.4f}")     # ~ 10.4506
print(f"put:   {bs_put (S, K, T, r, sigma):.4f}")     # ~  5.5735
print(f"delta: {delta_call(S, K, T, r, sigma):.4f}")  # ~ 0.6368 — note ATM call delta > 0.5
print(f"gamma: {gamma(S, K, T, r, sigma):.4f}")       # ~ 0.0188
print(f"vega:  {vega(S, K, T, r, sigma):.4f}")        # ~ 37.524 (per 1.00 vol)
print(f"theta: {theta_call(S, K, T, r, sigma)/365:.4f}")  # ~ −0.018/day

# ----------------------------------------------------------
# Why ATM delta > 0.5 (a classic follow-up):
# ----------------------------------------------------------
# Under BS, log-spot is normally distributed with mean (r - σ²/2)T and
# variance σ²T. The drift term is POSITIVE (interest accumulates), so
# the median terminal spot is above today's spot — meaning the call is
# in-the-money more than 50% of the time. Delta ≈ N(d1) reflects this.
# At higher r or T, the asymmetry grows. At r=0, delta_ATM ≈ 0.5.

# ----------------------------------------------------------
# Implied vol — solving the inverse problem:
# ----------------------------------------------------------
# Given a market price C*, find sigma such that bs_call(...) == C*.
# Standard method: Newton's method on f(sigma) = bs_call(sigma) - C*.
# f'(sigma) is exactly vega — which we already have.
def implied_vol_call(C_star, S, K, T, r, tol=1e-6, max_iter=100):
    sigma = 0.20                   # decent starting guess
    for _ in range(max_iter):
        diff = bs_call(S, K, T, r, sigma) - C_star
        if abs(diff) < tol:
            return sigma
        v = vega(S, K, T, r, sigma)
        if v < 1e-12:              # avoid divide-by-zero on degenerate options
            return float("nan")
        sigma -= diff / v
        if sigma <= 0:
            sigma = 0.0001         # keep it in a valid region
    return sigma                   # didn't converge — return last guess`,
    followUp:
      "Now price a European call by Monte Carlo and verify it converges to your BS price as N → ∞.",
  },

  {
    id: "py-max-drawdown",
    title: "Max Drawdown of an Equity Curve",
    difficulty: "junior",
    category: "finance",
    signal:
      "Tests vectorized thinking on a real metric. Many candidates write nested loops.",
    question:
      "Given an array of daily equity values, compute the max drawdown (the largest peak-to-trough decline as a fraction). Then return the (peak_date, trough_date) where it happened.",
    watchFor: [
      "Candidate uses a nested loop (O(n²)).",
      "Candidate gets confused about whether to return drawdown as positive or negative.",
      "Strong signal: candidate spots np.maximum.accumulate immediately.",
    ],
    solution: `import numpy as np
import pandas as pd

equity = (1 + np.random.randn(2520) * 0.01).cumprod() * 100  # 10y daily

# ----------------------------------------------------------
# Vectorized — O(n), one pass.
# ----------------------------------------------------------
def max_drawdown(equity: np.ndarray) -> tuple[float, int, int]:
    """Returns (drawdown_as_negative_fraction, peak_idx, trough_idx)."""
    # Running maximum up to each time t. np.maximum.accumulate is a
    # ufunc reduce — runs in C, no Python loop.
    running_max = np.maximum.accumulate(equity)
    # Drawdown at each point: (current - peak) / peak. Always ≤ 0.
    drawdowns = (equity - running_max) / running_max
    # Trough = position of the worst drawdown.
    trough = int(np.argmin(drawdowns))
    # Peak = the running max as of the trough — but we want the INDEX
    # of that peak, not just its value. Search backward from trough for
    # the position where running_max first reached its current value.
    peak = int(np.argmax(equity[:trough + 1]))
    return float(drawdowns[trough]), peak, trough

dd, peak, trough = max_drawdown(equity)
print(f"max drawdown: {dd:.2%}  from index {peak} to {trough}")

# ----------------------------------------------------------
# Why the np.maximum.accumulate trick is fast:
# ----------------------------------------------------------
# A naive expression of "running max up to t" would be:
#   running_max = np.array([equity[:i+1].max() for i in range(n)])
# which is O(n²) and runs the Python interpreter n times.
# np.maximum.accumulate is the right tool: it walks the array once
# in C, maintaining the running max. Similarly: np.minimum.accumulate,
# np.add.accumulate (≡ cumsum), np.multiply.accumulate (≡ cumprod).

# ----------------------------------------------------------
# Pandas version — same logic, slightly cleaner with dates:
# ----------------------------------------------------------
def max_drawdown_pd(equity: pd.Series) -> dict:
    running_max = equity.cummax()
    drawdowns = equity / running_max - 1
    trough_date = drawdowns.idxmin()
    peak_date   = equity.loc[:trough_date].idxmax()
    return {
        "drawdown": float(drawdowns.min()),
        "peak_date":   peak_date,
        "trough_date": trough_date,
        "recovery_date": (
            equity.loc[trough_date:].ge(running_max.loc[trough_date]).idxmax()
            if equity.loc[trough_date:].ge(running_max.loc[trough_date]).any()
            else None         # never recovered (still underwater)
        ),
    }

# Notice the recovery-date computation: we look for the first date AFTER
# the trough where equity gets back up to the previous peak. \`idxmax()\`
# on a boolean series returns the first True — but only if there IS one.
# If we never recover, .any() is False and we return None. Common
# real-world case: a strategy that's still underwater years later.

# ----------------------------------------------------------
# Convention conversation — bring it up before you hand it in:
# ----------------------------------------------------------
# Some shops report drawdown as a positive percentage (e.g., "20%"),
# others as a negative number (e.g., "−0.20"). Always ask which sign
# convention the team uses. Same with Sharpe (annualized? excess?
# arithmetic or geometric?). Conventions kill careers.`,
    followUp:
      "Now compute time-under-water (number of trading days spent below the previous peak).",
  },

  {
    id: "py-sharpe",
    title: "Annualized Sharpe Ratio",
    difficulty: "junior",
    category: "finance",
    signal:
      "Basic but reveals whether the candidate knows the SQRT(252) scaling and what 'excess return' means.",
    question:
      "Given a numpy array of daily returns, compute the annualized Sharpe ratio assuming a risk-free rate of 2% per year. Don't use any pre-built libraries.",
    watchFor: [
      "Candidate forgets the √252 annualization factor.",
      "Candidate subtracts 0.02 from each daily return (wrong — that's 2% per DAY).",
      "Strong signal: candidate notes the difference between geometric and arithmetic Sharpe.",
    ],
    solution: `import numpy as np

daily_returns = np.random.randn(2520) * 0.01 + 0.0005     # 10y daily

# ----------------------------------------------------------
# Annualized Sharpe from daily returns.
# ----------------------------------------------------------
def sharpe(returns: np.ndarray, rf_annual: float = 0.02,
           periods_per_year: int = 252) -> float:
    # Convert ANNUAL risk-free rate to PER-PERIOD.
    # Continuously compounded: rf_per = rf_annual / periods_per_year
    # is the standard approximation. (For monthly, exact is
    # (1 + rf_annual)**(1/12) - 1, but for daily the difference is
    # smaller than other measurement noise.)
    rf_per = rf_annual / periods_per_year

    excess = returns - rf_per
    # Arithmetic Sharpe (the standard reporting convention):
    #   mean(excess) / std(excess), then scale by √(periods_per_year)
    # The √N scaling comes from: if daily returns are iid,
    #   mean over N days  scales by N
    #   std  over N days  scales by √N
    # so Sharpe (a ratio) scales by N/√N = √N.
    sigma = excess.std(ddof=1)     # ddof=1 → sample std, unbiased
    if sigma == 0:
        return float("nan")        # constant returns → undefined Sharpe
    return excess.mean() / sigma * np.sqrt(periods_per_year)

print(f"Sharpe: {sharpe(daily_returns):.2f}")

# ----------------------------------------------------------
# Why ddof=1 matters:
# ----------------------------------------------------------
# numpy's .std() defaults to ddof=0 (population standard deviation).
# Pandas defaults to ddof=1 (sample, unbiased estimator).
# This is a common silent-discrepancy bug between numpy and pandas
# implementations of the same metric.
#
# For 2520 daily samples, the difference is ~0.02%. For 30-day Sharpe,
# it's much larger — the difference between -0.5 and -0.55 in Sharpe.

# ----------------------------------------------------------
# Arithmetic vs geometric Sharpe — interview follow-up:
# ----------------------------------------------------------
# Arithmetic version (above) treats returns as additive.
# Geometric version uses log returns:
#
#   log_returns = np.log(1 + returns)
#   geo_sharpe = log_returns.mean() / log_returns.std(ddof=1) * np.sqrt(252)
#
# Differences:
# - For small daily returns, log(1+r) ≈ r and they agree to leading order.
# - Geometric is multiplicatively invariant — independent of unit choice.
# - Sophisticated shops report both. Some report neither and use Sortino,
#   Calmar, or Omega ratios that penalize losses asymmetrically.

# ----------------------------------------------------------
# Pandas one-liner for completeness:
# ----------------------------------------------------------
import pandas as pd
def sharpe_pd(r: pd.Series, rf: float = 0.02) -> float:
    excess = r - rf/252
    return excess.mean() / excess.std() * np.sqrt(252)

# Note: pandas .std() is ddof=1 by default, so this is consistent with
# the explicit numpy version above (where we passed ddof=1).`,
  },

  {
    id: "py-ema",
    title: "Implement EMA (Exponentially Weighted Moving Average)",
    difficulty: "mid",
    category: "finance",
    signal:
      "EMA is the building block of half of all technical signals. Tests both the math and whether the candidate knows pandas' .ewm().",
    question:
      "Implement EMA over an array of prices, parameterized by a half-life (in periods). Do it three ways: pure-Python loop, numpy, and pandas. Discuss when you'd use each.",
    watchFor: [
      "Candidate doesn't know what half-life means (the period over which weight drops to 1/2).",
      "Candidate's numpy version has an O(n) loop — fine, just acknowledge that EMA is inherently sequential.",
      "Strong signal: candidate notes EMA is a one-pole IIR filter, and mentions adjust=False in pandas.",
    ],
    solution: `import numpy as np
import pandas as pd

prices = np.cumsum(np.random.randn(10_000) * 0.5) + 100

# ----------------------------------------------------------
# EMA recursion: y[t] = α · x[t] + (1 - α) · y[t-1]
# ----------------------------------------------------------
# α (the smoothing factor) controls how fast the EMA reacts.
# half_life (H) = number of periods for the weight to halve:
#   (1 - α)^H = 0.5   →   α = 1 - 2^(-1/H)

def alpha_from_half_life(half_life: float) -> float:
    return 1 - 2 ** (-1 / half_life)

# ----------------------------------------------------------
# Version 1 — pure Python loop. Slow but unambiguous.
# ----------------------------------------------------------
def ema_python(x: list[float], half_life: float) -> list[float]:
    alpha = alpha_from_half_life(half_life)
    out = [x[0]]                     # seed with the first observation
    for v in x[1:]:
        out.append(alpha * v + (1 - alpha) * out[-1])
    return out

# ----------------------------------------------------------
# Version 2 — numpy. Still O(n) sequential, but ~10x faster than pure
# Python because the math inside the loop is C-level scalar ops.
# ----------------------------------------------------------
def ema_numpy(x: np.ndarray, half_life: float) -> np.ndarray:
    alpha = alpha_from_half_life(half_life)
    one_minus = 1 - alpha
    out = np.empty_like(x, dtype=float)
    out[0] = x[0]
    for i in range(1, len(x)):
        out[i] = alpha * x[i] + one_minus * out[i - 1]
    return out

# Closed-form 'all-at-once' EMA via cumulative-product weights exists
# but for non-trivial \`alpha\` it's prone to floating overflow for long
# arrays. Stick with the recursive loop — see scipy.signal.lfilter for
# a vectorized version if you really need speed.

# ----------------------------------------------------------
# Version 3 — pandas. Always use this for production. Vectorized in C,
# handles NaN, lets you specify half_life directly.
# ----------------------------------------------------------
def ema_pandas(x: pd.Series, half_life: float) -> pd.Series:
    return x.ewm(halflife=half_life, adjust=False).mean()
    # adjust=False uses the recursive formula above.
    # adjust=True (the default) uses a slightly different weighting
    # that gives correct results even when the input is short.
    # For online / streaming use, you almost always want adjust=False.

# ----------------------------------------------------------
# Sanity check — all three should agree to numerical precision:
# ----------------------------------------------------------
hl = 20
a = ema_python(prices.tolist(), hl)
b = ema_numpy(prices, hl)
c = ema_pandas(pd.Series(prices), hl).values

assert np.allclose(a, b)
assert np.allclose(b, c)

# ----------------------------------------------------------
# When you'd use each:
# ----------------------------------------------------------
# - pandas (.ewm):  default for everything. Battle-tested, NaN-aware.
# - numpy loop:     when you have a NaN-free array and need to inline
#                   the recursion inside a larger numba/cython routine.
# - pure Python:    only for teaching / illustrating the recursion.
#
# - SIMD / scipy.signal.lfilter: when you need to apply MANY different
#   EMAs to the same series (e.g., a bank of half-lives) and the
#   vectorization across the bank gives you the speedup.

# ----------------------------------------------------------
# Quant context — why EMA is everywhere:
# ----------------------------------------------------------
# - Vol estimation: EMA of squared returns ≈ RiskMetrics EWMA, λ = 0.94.
#   In our notation: alpha = 1 - 0.94 = 0.06, half-life ≈ 11 days.
# - Signal smoothing: most "fast/slow MA cross" strategies are EMA based.
# - Latency-vs-noise tradeoff: lower half-life = faster response, more
#   noise. The right half-life is regime-dependent.`,
  },

  {
    id: "py-monte-carlo-call",
    title: "Monte Carlo Price a European Call",
    difficulty: "mid",
    category: "finance",
    signal:
      "Tests numpy fluency on a finance task that scales naturally. Also reveals whether the candidate knows variance reduction.",
    question:
      "Price a European call by Monte Carlo simulation under risk-neutral GBM. With N = 1,000,000 paths, how close to the Black-Scholes price should you expect to get? Show the price and a 95% confidence interval. Then apply ONE variance reduction technique.",
    watchFor: [
      "Candidate forgets to discount the payoff back to today (e^{-rT}).",
      "Candidate uses Python loop over paths instead of vectorizing.",
      "Strong signal: candidate uses antithetic variates or control variates.",
    ],
    solution: `import numpy as np
from scipy.stats import norm

# ----------------------------------------------------------
# Risk-neutral GBM at maturity (single-step, since payoff only
# depends on terminal price for a European option):
#   S_T = S_0 · exp( (r - σ²/2)·T + σ·√T · Z )      where Z ~ N(0,1)
# ----------------------------------------------------------

def mc_european_call(S, K, T, r, sigma, N: int = 1_000_000,
                     seed: int | None = 42) -> tuple[float, float]:
    rng = np.random.default_rng(seed)
    Z = rng.standard_normal(N)
    # Sample N terminal prices in one vector op.
    ST = S * np.exp((r - 0.5 * sigma**2) * T + sigma * np.sqrt(T) * Z)
    # Payoff of a European call at expiry: max(S_T - K, 0).
    payoff = np.maximum(ST - K, 0.0)
    # Discount back. PV = e^{-rT} · E[payoff under risk-neutral measure]
    disc_payoff = np.exp(-r * T) * payoff
    price = disc_payoff.mean()
    # Standard error of the mean = std(payoff) / sqrt(N), then discount.
    se = disc_payoff.std(ddof=1) / np.sqrt(N)
    return price, se

# ----------------------------------------------------------
# Sanity check vs BS:
# ----------------------------------------------------------
S, K, T, r, sigma = 100, 100, 1.0, 0.05, 0.20
price, se = mc_european_call(S, K, T, r, sigma)
print(f"MC:  {price:.4f} ± {1.96*se:.4f} (95% CI)")
# BS analytical:
d1 = (np.log(S/K) + (r + sigma**2/2)*T) / (sigma * np.sqrt(T))
d2 = d1 - sigma * np.sqrt(T)
bs = S * norm.cdf(d1) - K * np.exp(-r*T) * norm.cdf(d2)
print(f"BS:  {bs:.4f}")

# Expected: MC and BS agree to within ~0.01 for N=1M. The 95% CI half-
# width should be ~1.96 · σ_payoff / √N. For ATM at-the-money calls
# with σ=20%, σ_payoff ≈ 14, so CI half-width ≈ 0.027.

# ----------------------------------------------------------
# Variance reduction — antithetic variates:
# ----------------------------------------------------------
# For each Z we draw, also use -Z. The two paths are perfectly negatively
# correlated, so averaging their payoffs cuts variance by ~50% (much more
# for symmetric payoffs). Cost: same number of payoff evals as before
# if we keep total N the same; OR same accuracy with N/2 random draws.

def mc_call_antithetic(S, K, T, r, sigma, N: int = 1_000_000,
                       seed: int | None = 42) -> tuple[float, float]:
    rng = np.random.default_rng(seed)
    half = N // 2
    Z = rng.standard_normal(half)
    # Build the antithetic pair.
    Zp = np.concatenate([Z, -Z])      # length N, half negative-coupled
    ST = S * np.exp((r - 0.5 * sigma**2) * T + sigma * np.sqrt(T) * Zp)
    payoff = np.maximum(ST - K, 0.0)
    disc_payoff = np.exp(-r * T) * payoff
    # Standard error accounts for pairing: average each pair first.
    pairs = (disc_payoff[:half] + disc_payoff[half:]) / 2
    price = pairs.mean()
    se = pairs.std(ddof=1) / np.sqrt(half)
    return price, se

price_av, se_av = mc_call_antithetic(S, K, T, r, sigma)
print(f"MC+AV: {price_av:.4f} ± {1.96*se_av:.4f}")
# se_av should be ~0.7x smaller than se from the plain MC. For 1M paths,
# you usually see CI half-width drop from ~0.027 to ~0.020.

# ----------------------------------------------------------
# Control variates — even better for European options:
# ----------------------------------------------------------
# Use a related quantity with known mean (e.g., the underlying S_T,
# whose expectation under risk-neutral is S_0 · e^{rT}). Adjust the
# MC payoff using the deviation of this control from its known mean.
def mc_call_control_variate(S, K, T, r, sigma, N: int = 1_000_000,
                            seed: int | None = 42) -> tuple[float, float]:
    rng = np.random.default_rng(seed)
    Z = rng.standard_normal(N)
    ST = S * np.exp((r - 0.5 * sigma**2) * T + sigma * np.sqrt(T) * Z)
    payoff = np.maximum(ST - K, 0.0) * np.exp(-r * T)
    # Control: discounted underlying. Known mean = S0.
    control = ST * np.exp(-r * T)
    # Optimal coefficient = Cov(payoff, control) / Var(control)
    cov = np.cov(payoff, control, ddof=1)
    beta = cov[0, 1] / cov[1, 1]
    adjusted = payoff - beta * (control - S)
    return adjusted.mean(), adjusted.std(ddof=1) / np.sqrt(N)

# Control variates can drop variance another 2-5× over antithetic alone.

# ----------------------------------------------------------
# Interview pivot — they will ask:
# ----------------------------------------------------------
# "What if the option were American / path-dependent?" Then you can't
# use the one-step terminal trick. You simulate the full path with M
# time steps, leading to longstaff-schwartz for American (regression on
# continuation value) or path-tracking for Asian / barrier.`,
  },

  {
    id: "py-ols-from-scratch",
    title: "OLS Regression from Scratch",
    difficulty: "senior",
    category: "finance",
    signal:
      "Tests linear algebra fluency + numerical literacy. Many candidates can call sklearn.LinearRegression but can't derive what it does.",
    question:
      "Implement multivariate OLS — β = (X'X)^{-1} X' y. Return coefficients, standard errors, t-stats, and R². Don't use sklearn or statsmodels. Discuss what could go numerically wrong.",
    watchFor: [
      "Candidate uses np.linalg.inv() directly (numerically poor — use lstsq or solve).",
      "Candidate doesn't add a constant column.",
      "Strong signal: candidate mentions QR decomposition or SVD as a more stable alternative.",
    ],
    solution: `import numpy as np

# ----------------------------------------------------------
# OLS for y = X β + ε, with ε ~ N(0, σ²I).
# X is n × k (k = #features INCLUDING the constant column).
# ----------------------------------------------------------
def ols(X: np.ndarray, y: np.ndarray) -> dict:
    n, k = X.shape

    # ----------------------------------------------------------
    # The formula everyone knows: β = (X'X)^{-1} X'y.
    # ----------------------------------------------------------
    # DON'T do this directly with np.linalg.inv. (X'X)^{-1} is
    # numerically unstable when columns are near-collinear. The
    # condition number squares when you form X'X explicitly.

    # ----------------------------------------------------------
    # Better: np.linalg.lstsq solves min ||X β - y||² via SVD.
    # ----------------------------------------------------------
    beta, residuals, rank, sv = np.linalg.lstsq(X, y, rcond=None)

    # If rank < k, the design matrix is rank-deficient. lstsq returns a
    # minimum-norm solution; flag it so the caller knows the model is
    # under-identified.
    rank_deficient = rank < k

    # ----------------------------------------------------------
    # Residuals and σ̂²
    # ----------------------------------------------------------
    y_hat = X @ beta
    resid = y - y_hat
    # Degrees of freedom: n - k (subtract the k estimated parameters)
    dof = n - k
    if dof <= 0:
        raise ValueError("Not enough observations for the number of regressors")
    sigma2 = (resid @ resid) / dof          # unbiased estimator

    # ----------------------------------------------------------
    # Standard errors of β: sqrt(diag(σ̂² (X'X)^{-1}))
    # ----------------------------------------------------------
    # For (X'X)^{-1} we use np.linalg.pinv via the SVD-based pseudoinverse.
    # If you're confident X is full-rank, np.linalg.inv(X.T @ X) works
    # but is faster only marginally; pinv is the safe default.
    XtX_inv = np.linalg.pinv(X.T @ X)
    var_beta = sigma2 * XtX_inv
    se_beta = np.sqrt(np.diag(var_beta))

    # ----------------------------------------------------------
    # t-statistics — β_i / SE(β_i). |t| > ~2 suggests significance.
    # ----------------------------------------------------------
    # Handle SE=0 (perfectly collinear with another column) gracefully.
    with np.errstate(divide="ignore", invalid="ignore"):
        t_stats = np.where(se_beta > 0, beta / se_beta, np.nan)

    # ----------------------------------------------------------
    # R² — fraction of variance in y explained by the model.
    # ----------------------------------------------------------
    # Total sum of squares (TSS) is variation around the mean of y.
    # R² = 1 - RSS / TSS. Adjusted R² penalizes adding regressors.
    y_centered = y - y.mean()
    tss = y_centered @ y_centered
    rss = resid @ resid
    r2 = 1 - rss / tss
    r2_adj = 1 - (1 - r2) * (n - 1) / dof

    return {
        "beta":         beta,
        "se":           se_beta,
        "t":            t_stats,
        "residuals":    resid,
        "sigma2":       sigma2,
        "r2":           float(r2),
        "r2_adj":       float(r2_adj),
        "rank_def":     rank_deficient,
    }

# ----------------------------------------------------------
# Example — regress excess returns on Fama-French factor mock:
# ----------------------------------------------------------
n, k_features = 500, 3
np.random.seed(0)
X_features = np.random.randn(n, k_features)
true_beta = np.array([1.2, -0.5, 0.3])
noise = np.random.randn(n) * 0.5
y = X_features @ true_beta + 0.05 + noise        # 0.05 intercept

# Add constant column FIRST. Forgetting this is the #1 bug.
X = np.column_stack([np.ones(n), X_features])

result = ols(X, y)
print("coefs:    ", result["beta"])              # ~ [0.05, 1.2, -0.5, 0.3]
print("std err:  ", result["se"])
print("t-stats:  ", result["t"])
print("R² adj:    ", f"{result['r2_adj']:.4f}")

# ----------------------------------------------------------
# What can go wrong — failure modes:
# ----------------------------------------------------------
# 1. Multicollinearity: two columns near-linear-dependent. lstsq gives
#    a min-norm solution but t-stats become unreliable. Check condition
#    number: cond = np.linalg.cond(X). If > 1e10, you have a problem.
#
# 2. Forgot the intercept. Coefficient on the actual constant gets
#    smeared into the other betas. Always include a constant column
#    unless you have a specific reason not to (e.g., regression through
#    the origin for orthogonalized factor models).
#
# 3. Heteroskedasticity: residual variance not constant. Standard errors
#    are too small → t-stats too big → spurious significance. Fix:
#    White / heteroskedasticity-consistent (HC) standard errors.
#       hc0 = X' diag(resid²) X, then SE = sqrt(diag(XtX_inv @ hc0 @ XtX_inv))
#
# 4. Autocorrelated residuals (time-series data). Same issue as #3.
#    Fix: Newey-West (HAC) standard errors.
#
# 5. Outliers: a single bad data point can swamp β. Robust regression
#    (Huber loss) or just sigma-clip + re-fit if you know your data.`,
  },

  {
    id: "py-backtester-skeleton",
    title: "Minimum Viable Backtester",
    difficulty: "senior",
    category: "finance",
    signal:
      "Tests OOP design under finance constraints: lookahead bias, position sizing, transaction costs. Anyone with backtesting scars writes this differently than someone who's only read about it.",
    question:
      "Sketch the smallest possible event-driven backtester. It should take daily bars and a strategy function that decides target position based on history-to-date, then compute P&L net of transaction costs. Highlight the lookahead-bias guard.",
    watchFor: [
      "Candidate's strategy function sees future data (uses df instead of df.iloc[:t+1]).",
      "Candidate ignores transaction costs entirely.",
      "Strong signal: candidate distinguishes 'signal time' vs 'execution time' (you signal on close, execute next open).",
    ],
    solution: `import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import Callable

# ----------------------------------------------------------
# Type definition of a strategy. It receives the history of bars UP TO
# AND INCLUDING today, plus the current position, and returns a TARGET
# position for the NEXT bar (we execute on next open).
# ----------------------------------------------------------
Strategy = Callable[[pd.DataFrame, float], float]
# Signature: strategy(history: pd.DataFrame, current_pos: float) -> target_pos

@dataclass
class BacktestResult:
    equity:    pd.Series          # equity curve, indexed by date
    positions: pd.Series          # position at start of each day
    returns:   pd.Series          # daily return of the strategy
    trades:    int                # number of position-change events

def backtest(
    bars: pd.DataFrame,           # columns: open, close (at minimum)
    strategy: Strategy,
    initial_equity: float = 1.0,
    cost_bps: float = 1.0,        # cost per side, in basis points of notional
) -> BacktestResult:
    """Daily-bar backtester with execution at next open.

    Conventions:
    - Signal generated using info available through day t's close.
    - Execution happens at open of day t+1.
    - P&L credited from open of t+1 through close of t+1, then the
      next signal is computed using close-of-t+1, and so on.
    - Costs charged as a fraction of |Δposition| × execution price.
    """

    n = len(bars)
    if n < 2:
        raise ValueError("Need at least 2 bars to backtest.")

    equity = np.zeros(n)
    equity[0] = initial_equity
    positions = np.zeros(n)       # position HELD going INTO each day
    daily_ret = np.zeros(n)
    n_trades = 0

    # ----------------------------------------------------------
    # The lookahead-bias guard — the most important line in this file:
    # ----------------------------------------------------------
    # We pass strategy ONLY history through day t (inclusive). It cannot
    # see day t+1 close, t+1 open, or anything ahead. Many homemade
    # backtesters pass \`bars\` to the strategy and let it index itself —
    # that's how you accidentally make a strategy that "knows" tomorrow.
    # Better: explicitly slice and pass.

    for t in range(n - 1):
        # History through close-of-t. shape: (t+1, ...)
        history = bars.iloc[: t + 1]
        # Strategy decides what we'll be holding starting at open-of-(t+1).
        target = strategy(history, positions[t])

        # Cost of the trade. Only charged if position changes.
        size_change = abs(target - positions[t])
        exec_price = bars["open"].iloc[t + 1]
        cost = size_change * exec_price * (cost_bps / 10_000) if size_change > 0 else 0.0

        if size_change > 0:
            n_trades += 1

        # P&L of the next day:
        # - We hold \`target\` units from open of t+1 through close of t+1.
        # - $ change per unit = close(t+1) - open(t+1).
        price_change = bars["close"].iloc[t + 1] - bars["open"].iloc[t + 1]
        pnl = target * price_change - cost

        # Convert $ P&L to RETURN on current equity.
        ret = pnl / equity[t]
        daily_ret[t + 1] = ret
        equity[t + 1] = equity[t] * (1 + ret)
        positions[t + 1] = target

    return BacktestResult(
        equity    = pd.Series(equity,    index=bars.index),
        positions = pd.Series(positions, index=bars.index),
        returns   = pd.Series(daily_ret, index=bars.index),
        trades    = n_trades,
    )

# ----------------------------------------------------------
# Example strategy: SMA crossover (long when fast > slow).
# ----------------------------------------------------------
def sma_crossover(history: pd.DataFrame, current_pos: float) -> float:
    if len(history) < 50:
        return 0.0                # not enough history → flat
    fast = history["close"].iloc[-20:].mean()
    slow = history["close"].iloc[-50:].mean()
    return 1.0 if fast > slow else 0.0    # long-flat strategy

# ----------------------------------------------------------
# Example run:
# ----------------------------------------------------------
dates = pd.date_range("2020-01-01", periods=1000, freq="B")
prices = (1 + np.random.randn(1000) * 0.01).cumprod() * 100
bars = pd.DataFrame(
    {"open": prices, "close": prices * (1 + np.random.randn(1000) * 0.002)},
    index=dates,
)
result = backtest(bars, sma_crossover)
print(f"final equity: {result.equity.iloc[-1]:.4f}")
print(f"trades: {result.trades}")

# ----------------------------------------------------------
# What this skeleton DELIBERATELY DOES NOT model — be honest about it:
# ----------------------------------------------------------
# - Slippage beyond a simple bps cost. Real fills move with market impact.
# - Liquidity constraints: can't trade more than X% of ADV without moving the market.
# - Borrow costs (for short positions).
# - Discrete share sizing (this assumes infinitely divisible positions).
# - Order types and partial fills.
# - Survivorship bias if you don't include delisted tickers.
# - Snooping bias if you tune parameters on the same data you backtest.
# - Trade scheduling: real systems split big trades across the day (VWAP/TWAP).
#
# Each of these can flip a backtest from "great" to "underwater" in practice.
# A good interview answer acknowledges these LIMITATIONS up front.`,
    followUp:
      "Now extend it to handle leverage / short positions correctly. (Bonus: model borrow costs.)",
  },
];
