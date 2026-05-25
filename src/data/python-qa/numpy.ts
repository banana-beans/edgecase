import type { PyQuestion } from "./index";

// ============================================================
// Numpy / pandas questions — the language of every quant desk.
// These reveal whether the candidate writes idiomatic vectorized
// code or whether they translate from C/Java loops.
// ============================================================

export const numpyQuestions: PyQuestion[] = [
  {
    id: "py-vectorize-this-loop",
    title: "Vectorize This Loop",
    difficulty: "junior",
    category: "numpy",
    signal:
      "The single highest-signal Python question for quant work. If they reach for a for-loop on a numpy array, they're not ready for production code.",
    question:
      "You have a numpy array `prices` of length 1,000,000. Compute the array of log-returns (i.e., log(p[i] / p[i-1]) for each i). Make it as fast as you can. Then time your version vs the naive for-loop.",
    watchFor: [
      "Candidate writes a Python for-loop and is satisfied.",
      "Candidate creates a temporary array unnecessarily.",
      "Strong signal: candidate uses np.diff(np.log(prices)) — the cleanest one-liner.",
    ],
    solution: `import numpy as np
import time

prices = np.random.lognormal(mean=0, sigma=0.01, size=1_000_000).cumprod()

# ----------------------------------------------------------
# Slow — pure Python loop. DON'T DO THIS.
# ----------------------------------------------------------
def slow(prices: np.ndarray) -> np.ndarray:
    # 1. List grown one element at a time (reallocations).
    # 2. Each np.log() call has C overhead — paid 1M times.
    # 3. Final conversion back to ndarray copies the whole thing.
    out = []
    for i in range(1, len(prices)):
        out.append(np.log(prices[i] / prices[i-1]))
    return np.array(out)

# ----------------------------------------------------------
# Better — vectorized, one allocation. THIS is the expected answer.
# ----------------------------------------------------------
def fast(prices: np.ndarray) -> np.ndarray:
    # np.log is a ufunc that operates element-wise on whole arrays.
    # The division is also vectorized. Total: two C-level passes.
    return np.log(prices[1:] / prices[:-1])

# ----------------------------------------------------------
# Even better — one C pass instead of two.
# ----------------------------------------------------------
def fastest(prices: np.ndarray) -> np.ndarray:
    # log(p[i] / p[i-1]) == log(p[i]) - log(p[i-1])
    # Take logs once, then diff. np.diff is a single C call.
    return np.diff(np.log(prices))

# ----------------------------------------------------------
# Time them — typical numbers on a modern laptop:
# ----------------------------------------------------------
#   slow:    ~1500 ms
#   fast:    ~12 ms
#   fastest: ~8 ms
#
# Vectorization is ~100× here. The 'two passes vs one pass' speedup
# is a smaller win — usually only ~1.5× — but matters in inner loops
# of risk computations or backtests.

# ----------------------------------------------------------
# A common trap candidates fall into:
# ----------------------------------------------------------
def looks_vectorized_but_isnt(prices):
    # This LOOKS clean but np.array(...) iterates the generator in
    # Python and allocates a list under the hood. Almost as slow as
    # the explicit loop.
    return np.array([np.log(p2/p1) for p1, p2 in zip(prices[:-1], prices[1:])])

# Rule of thumb: if you see a list comprehension producing numerical
# elements that get fed to np.array(), there's almost always a pure-numpy
# expression that does it 100× faster.

# ----------------------------------------------------------
# What about pandas?
# ----------------------------------------------------------
import pandas as pd
s = pd.Series(prices)
log_returns = np.log(s).diff().dropna()   # idiomatic pandas
# Or: log_returns = np.log(s / s.shift(1)).dropna()
#
# Don't use .apply() or .iterrows() on a numeric series — they degrade
# to per-element Python calls and you've thrown away vectorization.`,
    followUp:
      "Now make a rolling 252-day Sharpe ratio of those log returns. (Filters out candidates who freeze when 'rolling window' enters the conversation.)",
  },

  {
    id: "py-broadcasting",
    title: "Broadcasting Rules",
    difficulty: "mid",
    category: "numpy",
    signal:
      "Whether the candidate can read shape errors and design around them. Critical for any tensor work.",
    question:
      "You have a (1000, 50) matrix `returns` (1000 days × 50 stocks) and a (50,) vector `weights`. Write a one-liner that computes the portfolio return for each day. What about a (1000,) vector — does that work? Why or why not?",
    watchFor: [
      "Candidate doesn't know `@` or `np.dot` for matrix multiplication.",
      "Candidate manually loops over stocks (wrong direction of vectorization).",
      "Candidate doesn't grasp WHY (50,) broadcasts but (1000,) doesn't.",
    ],
    solution: `import numpy as np

returns = np.random.randn(1000, 50) * 0.01
weights = np.random.dirichlet(np.ones(50))    # sums to 1, 50 stocks

# ----------------------------------------------------------
# Portfolio return per day = weighted sum across stocks
# ----------------------------------------------------------
# returns shape: (1000, 50)
# weights shape: (50,)
# We want:       (1000,)  — one number per day

# The cleanest expression: matrix-vector product.
port = returns @ weights        # shape (1000,)
# Equivalent: np.dot(returns, weights), returns.dot(weights)

# ----------------------------------------------------------
# Broadcasting (the elementwise version):
# ----------------------------------------------------------
# (1000, 50) * (50,) → broadcasts to (1000, 50). Then sum axis=1.
port2 = (returns * weights).sum(axis=1)
# Same answer, slower (creates a temp (1000, 50) array).

# ----------------------------------------------------------
# What about (1000,)?
# ----------------------------------------------------------
# returns shape: (1000, 50)
# v       shape: (1000,)
# Broadcasting rule: align trailing axes. (50) vs (1000) — DIFFERENT,
# neither is 1, so this fails:
#   ValueError: operands could not be broadcast together with shapes
#               (1000, 50) (1000,)
#
# To "scale each row by v[i]" you need to make v have shape (1000, 1):
v = np.arange(1000)
returns_scaled = returns * v[:, None]      # shape (1000, 1) → broadcasts
# v[:, None] is shorthand for v.reshape(1000, 1).
# v[None, :] would give shape (1, 1000) — broadcasts the other direction.

# ----------------------------------------------------------
# Broadcasting rules — internalize these:
# ----------------------------------------------------------
# 1. Align shapes RIGHT (trailing axes).
#    (1000, 50)
#    (      50)   ← treated as (1, 50)? No — (50,) — see step 2
#
# 2. Pad the shorter shape with 1s on the LEFT.
#    (1000, 50)
#    (   1, 50)
#
# 3. Two dimensions are "compatible" if they're equal OR one is 1.
#    Result dim = max of the two. A 1 stretches to match.
#
# 4. If incompatible, broadcasting fails.
#
# Pop quizzes:
#   (8,3,4) + (3,4)   → (8,3,4)            ✓
#   (8,1,4) + (3,1)   → (8,3,4)            ✓
#   (8,3,4) + (3,)    → (8,3,4) — (3,) pads to (1,1,3), incompatible at last axis with 4 → fails
#   Last one trips many candidates. Trailing-axis alignment is strict.

# ----------------------------------------------------------
# Quant relevance:
# ----------------------------------------------------------
# - Portfolio returns: returns @ weights
# - Risk decomposition: weights @ cov @ weights
# - Per-stock return adjustment: returns - benchmark[:, None]
# - Greeks across strikes: bs_price(S[:, None], K[None, :], ...) gives
#   a full (n_spots, n_strikes) surface in one call. THIS is why numpy.`,
  },

  {
    id: "py-pandas-apply-trap",
    title: "Why Is This Pandas Code So Slow?",
    difficulty: "mid",
    category: "numpy",
    signal:
      "The single most common pandas anti-pattern. Either the candidate has fought this or they haven't.",
    question:
      "A teammate's pandas code processes 1M rows in 20 minutes. You suspect a bug. Find and fix it:\n\n  def compute_pnl(df: pd.DataFrame) -> pd.DataFrame:\n      df['pnl'] = df.apply(\n          lambda row: row['qty'] * (row['mark'] - row['entry']),\n          axis=1\n      )\n      return df",
    watchFor: [
      "Candidate suggests using `.iterrows()` instead. Also wrong, same problem.",
      "Candidate doesn't know that `.apply(axis=1)` calls the function once per row in Python land.",
      "Strong signal: candidate also mentions dtype mismatches as a separate slowdown source.",
    ],
    solution: `import pandas as pd
import numpy as np

# ----------------------------------------------------------
# The bug: .apply(axis=1) iterates rows in Python.
# Every row is converted to a Series, lambda invoked, result collected.
# For 1M rows: 1M Python function calls + 1M Series objects.
# This is ~1000× slower than vectorized math.
# ----------------------------------------------------------

df = pd.DataFrame({
    "qty":   np.random.randint(1, 100, 1_000_000),
    "entry": np.random.uniform(50, 150, 1_000_000),
    "mark":  np.random.uniform(50, 150, 1_000_000),
})

# Slow — DON'T:
%timeit df.apply(lambda r: r["qty"] * (r["mark"] - r["entry"]), axis=1)
#   ~20s

# Fast — DO:
%timeit df["qty"] * (df["mark"] - df["entry"])
#   ~5ms (4000× faster)

# Why? pandas Series math dispatches to numpy which executes the whole
# column in a single C loop. No Python overhead per row.

def compute_pnl(df: pd.DataFrame) -> pd.DataFrame:
    # Direct column arithmetic — vectorized.
    df = df.copy()                                  # don't mutate input
    df["pnl"] = df["qty"] * (df["mark"] - df["entry"])
    return df

# ----------------------------------------------------------
# When IS .apply(axis=1) acceptable?
# ----------------------------------------------------------
# Almost never. The exceptions:
# 1. Truly row-shaped logic where you can't vectorize — e.g., per-row
#    regex with conditional dispatch. Even then, prefer:
#       df.apply(fn, axis=1, raw=True)  → passes numpy array, not Series
#       Or: convert to records and process with a list comp.
# 2. Tiny DataFrames where the constant factor doesn't matter.

# ----------------------------------------------------------
# Sneaky variant — the dtype trap:
# ----------------------------------------------------------
# If df['qty'] is dtype=object (because someone read a CSV without
# parsing), even vectorized arithmetic falls back to per-element Python.
# Always check df.dtypes after loading.
print(df.dtypes)
#   qty       int64    ✓
#   entry   float64    ✓
#   mark    float64    ✓
# If any of these say 'object' for a numeric column, fix it:
#   df["qty"] = pd.to_numeric(df["qty"], errors="coerce").astype("int64")

# ----------------------------------------------------------
# Mental checklist for slow pandas:
# ----------------------------------------------------------
# 1. Is .apply or .iterrows in the hot path? → vectorize.
# 2. Are columns 'object' dtype when they should be numeric? → cast.
# 3. Is the same operation being done in a Python for-loop over groups?
#    → use df.groupby(...).transform() or numpy split/aggregate.
# 4. Is the DataFrame the wrong shape? Wide-vs-long matters for vectorization.
# 5. Memory pressure causing swap? Switch to int32/float32 where safe.`,
    followUp:
      "Now add a 'sector' column and compute per-sector total PnL — still vectorized.",
  },

  {
    id: "py-rolling-correlation",
    title: "Rolling Correlation Matrix",
    difficulty: "senior",
    category: "numpy",
    signal:
      "Tests pandas fluency on a realistic risk-management computation. Senior devs vectorize this; juniors write triple-nested loops.",
    question:
      "Given a DataFrame `returns` with N stocks (columns) and T daily returns (rows), compute the rolling 60-day correlation matrix at every point in time. Result is a (T-59, N, N) ndarray.",
    watchFor: [
      "Candidate writes nested loops over (t, i, j).",
      "Candidate doesn't know pandas has rolling().corr() but doesn't know its output shape.",
      "Strong signal: candidate notes the O(T·N²·W) cost and considers Welford-style online updates.",
    ],
    solution: `import numpy as np
import pandas as pd

T, N, W = 252 * 5, 50, 60          # 5 years, 50 stocks, 60-day window
returns = pd.DataFrame(
    np.random.randn(T, N) * 0.01,
    columns=[f"s{i}" for i in range(N)],
)

# ----------------------------------------------------------
# pandas one-liner — gives you a stacked DataFrame, not (T,N,N):
# ----------------------------------------------------------
# This returns a MultiIndex (date, stock) DataFrame of correlations.
# Easy to use for indexing; hard to use for matrix operations.
rc = returns.rolling(W).corr()          # shape: (T*N, N)
rc.loc["2026-05-24"]                    # 50×50 corr matrix on that date

# ----------------------------------------------------------
# Numpy version producing (T-W+1, N, N) tensor — what risk engines want:
# ----------------------------------------------------------
# Build it once using cumulative sums for O(T·N²) instead of O(T·W·N²).
# Key identity: for any window of width W,
#     cov(x, y) = (Σxy - Σx·Σy/W) / (W - 1)
# So if we keep running sums of x, y, and xy, we can window-difference
# them to get the cov for every window in O(1) per (i, j) pair per t.

def rolling_corr_tensor(returns: np.ndarray, window: int) -> np.ndarray:
    """Returns (T - window + 1, N, N) corr tensor."""
    T, N = returns.shape
    # Running cumulative sums prepended with a 0-row so we can do
    # cum[t + W] - cum[t] to get a window sum.
    cs = np.concatenate([np.zeros((1, N)), returns.cumsum(0)], axis=0)
    # For Σ x_i x_j we need the outer-product cumsum. (T, N, N) is heavy
    # but unavoidable for this approach — use float32 if memory tight.
    outer = returns[:, :, None] * returns[:, None, :]        # (T, N, N)
    cs_xy = np.concatenate([np.zeros((1, N, N)), outer.cumsum(0)], 0)

    n_windows = T - window + 1
    out = np.empty((n_windows, N, N))
    for t in range(n_windows):
        end = t + window
        # Sum over the window via cumsum difference — O(N²) per t.
        sum_x   = cs[end]    - cs[t]            # (N,)
        sum_xy  = cs_xy[end] - cs_xy[t]         # (N, N)
        mean_x  = sum_x / window                # (N,)
        # cov[i,j] = (sum_xy[i,j] - W * mean_x[i] * mean_x[j]) / (W - 1)
        cov = (sum_xy - window * np.outer(mean_x, mean_x)) / (window - 1)
        std = np.sqrt(np.diag(cov))
        # Outer product of stds gives the normalizer for correlation.
        out[t] = cov / np.outer(std, std)
    return out

corr_t = rolling_corr_tensor(returns.values, W)
print(corr_t.shape)          # (T - W + 1, N, N)

# ----------------------------------------------------------
# Memory note:
# ----------------------------------------------------------
# (T, N, N) for T=1260, N=50 is 1260·50·50·8 bytes = 25 MB. Doable.
# For N=500 it's 2.5 GB. At that scale, you don't materialize the
# whole tensor — you compute per-date on demand, or you reach for
# numba / numpy stride tricks / a true C extension.

# ----------------------------------------------------------
# Why interviewers ask:
# ----------------------------------------------------------
# Real risk systems compute rolling covariances on tens of thousands
# of names. The naive triple-loop solution is unusable. The candidate
# who knows the cumsum trick (or, even better, Welford online update)
# is the one who can write a production risk engine.`,
  },

  {
    id: "py-find-the-bug-nan",
    title: "Find the Bug — NaN Handling",
    difficulty: "mid",
    category: "numpy",
    signal:
      "Quant data has NaNs everywhere. If candidates can't reason about NaN propagation, their P&L will lie to them.",
    question:
      "Spot the bug:\n\n  def mean_active_return(returns: pd.Series, benchmark: pd.Series) -> float:\n      active = returns - benchmark\n      return active.sum() / len(active)\n\nThe series have NaN gaps (different stocks listed on different days). Fix it and explain.",
    watchFor: [
      "Candidate says .mean() handles NaN. Half-right — pandas .mean() skips NaN by default, but the bug is the denominator len(), not the numerator.",
      "Candidate doesn't see that sum() skips NaN but len() includes it.",
      "Strong signal: candidate distinguishes pandas (skips NaN by default) from numpy (propagates NaN by default).",
    ],
    solution: `import pandas as pd
import numpy as np

# ----------------------------------------------------------
# The bug:
# ----------------------------------------------------------
#   active.sum()  → pandas sum() skips NaN by default. Result: sum of
#                   only the valid entries.
#   len(active)   → counts ALL entries, including NaN.
# So we divide a valid-only sum by a total count → biased low whenever
# there are NaNs. The longer the NaN gap, the more biased.

# Demo:
returns   = pd.Series([0.01, np.nan, 0.02, 0.03, np.nan])
benchmark = pd.Series([0.005, 0.005, np.nan, 0.01, 0.01])
active = returns - benchmark
print(active)            # [0.005, NaN, NaN, 0.02, NaN]
# active.sum() == 0.025
# len(active) == 5
# Bad mean: 0.005

# ----------------------------------------------------------
# Fix 1 — use .mean(), which handles NaN consistently:
# ----------------------------------------------------------
def mean_active_return(returns: pd.Series, benchmark: pd.Series) -> float:
    return (returns - benchmark).mean()        # NaN-aware

# This gives 0.025 / 2 (only 2 non-NaN entries) = 0.0125. Correct.

# ----------------------------------------------------------
# Fix 2 — be explicit about what 'mean' means here:
# ----------------------------------------------------------
def mean_active_return(returns: pd.Series, benchmark: pd.Series) -> float:
    active = returns - benchmark
    # .dropna() removes NaN; len() of the result equals .count()
    valid = active.dropna()
    if len(valid) == 0:
        return float("nan")                    # don't divide by zero
    return valid.sum() / len(valid)

# Or in one line:
def mean_active_return(returns, benchmark):
    return (returns - benchmark).dropna().mean()

# ----------------------------------------------------------
# Why this question filters out junior candidates:
# ----------------------------------------------------------
# NaN arithmetic and aggregation behavior differs between libraries:
#
#   numpy:  np.nan + 1     == np.nan
#           np.array([1, np.nan]).sum()  == np.nan      (propagates)
#           np.nansum([1, np.nan])       == 1.0          (skips)
#           np.array([1, np.nan]).mean() == np.nan      (propagates)
#
#   pandas: (pd.Series([1, np.nan])).sum()  == 1.0      (skips, default)
#           (pd.Series([1, np.nan])).mean() == 1.0      (skips, default)
#           (pd.Series([1, np.nan])).count() == 1       (excludes NaN)
#           len(pd.Series([1, np.nan]))     == 2        (includes NaN)
#
# Bug-source-of-life: mixing len() with NaN-skipping aggregations.
# Always use .count() or pre-filter with .dropna().

# ----------------------------------------------------------
# Performance & semantics in production:
# ----------------------------------------------------------
# Real systems often want different NaN semantics in different places:
# - "Missing data → exclude" → .mean(), .count()
# - "Missing data → propagate to mark NaN day" → .mean(skipna=False)
# - "Missing data → fill with last known value" → .ffill().mean()
# Each is a different business rule. Always interrogate the spec.`,
  },

  {
    id: "py-where-vs-mask",
    title: "Boolean Indexing vs np.where",
    difficulty: "junior",
    category: "numpy",
    signal:
      "Tests whether the candidate knows how to filter / branch in vectorized code.",
    question:
      "Given a 1D array `returns`, write three versions of this: produce a new array where positive returns are doubled and non-positive returns are left alone. Discuss which is most idiomatic.",
    watchFor: [
      "Candidate writes a for-loop. Buzzer.",
      "Candidate uses np.where but doesn't know it returns a NEW array (no in-place).",
      "Strong signal: candidate notes np.where(condition) (one arg) is different from np.where(cond, x, y) (three arg).",
    ],
    solution: `import numpy as np

returns = np.random.randn(1_000_000) * 0.01

# ----------------------------------------------------------
# Version A — np.where (most idiomatic for "if/else on every element"):
# ----------------------------------------------------------
# np.where(condition, true_value, false_value) is element-wise ternary.
# Both branches are evaluated for every element (so don't put expensive
# operations in branches you don't need). Returns a NEW array.
out = np.where(returns > 0, returns * 2, returns)

# ----------------------------------------------------------
# Version B — boolean mask + in-place modify (when you want to mutate):
# ----------------------------------------------------------
out = returns.copy()
mask = out > 0
out[mask] *= 2

# This is what you write when you have an expensive transformation
# that you DON'T want to apply to the false-branch elements. np.where
# would compute both branches; mask-assignment only computes one.
#
# Example: out[mask] = scipy.stats.norm.cdf(out[mask]) — only compute
# cdf on the values that need it.

# ----------------------------------------------------------
# Version C — algebraic trick (sometimes the fastest):
# ----------------------------------------------------------
# For this specific transform: double iff positive
#   = returns * (1 + (returns > 0))
# Bool→int conversion gives 0 or 1; addition gives 1 or 2.
# One pass, no branch, no copy. But — only works when you can express
# the transform algebraically; not general.
out = returns * (1 + (returns > 0).astype(returns.dtype))

# ----------------------------------------------------------
# Common confusion — np.where with ONE argument:
# ----------------------------------------------------------
# np.where(condition) returns the INDICES where the condition is true.
# It's the numpy equivalent of np.nonzero(condition).
idx = np.where(returns > 0)          # tuple of arrays, one per axis
returns[idx]                         # all the positive returns

# So np.where has two unrelated signatures:
#   np.where(cond)            → indices (returns a tuple!)
#   np.where(cond, a, b)      → ternary array
# This trips up junior candidates constantly.

# ----------------------------------------------------------
# Performance comparison (1M-element array, on a modern laptop):
# ----------------------------------------------------------
# np.where(c, a, b):  ~3 ms — clean, one allocation
# mask + in-place:    ~2 ms — slightly faster (no double-branch eval)
# algebraic:          ~3 ms — surprisingly not faster despite one pass
# for-loop:           ~600 ms — don't.

# When candidates show me a for-loop on a numpy array, I show them this
# table. It's the single fastest way to communicate why we care about
# vectorization.`,
  },
];
