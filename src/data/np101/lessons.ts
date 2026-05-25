import type { NpLesson } from "./index";

// ============================================================
// 20 numpy + pandas lessons. Foundation for the /python Q&A.
// ============================================================

export const np101Lessons: NpLesson[] = [
  {
    id: "np-import",
    order: 1,
    title: "Setup — import numpy as np",
    tier: "numpy",
    concept:
      "numpy is THE numerical library for Python. Install with `pip install numpy`. By convention, imported as `np`.",
    code: `import numpy as np

# Numpy's main type: ndarray (n-dimensional array).
# Like a Python list, but fixed-type, fixed-size, and ~100x faster.

a = np.array([1, 2, 3, 4, 5])
print(a)             # [1 2 3 4 5]
print(type(a))       # <class 'numpy.ndarray'>
print(a.dtype)       # int64 (or int32 on Windows)
print(a.shape)       # (5,)  — 1D array of length 5

# Lists vs arrays:
[1, 2, 3] * 3        # [1, 2, 3, 1, 2, 3, 1, 2, 3]  — list repetition
np.array([1, 2, 3]) * 3   # [3, 6, 9]               — element-wise math`,
    explanation:
      "Numpy is what makes Python useful for quant work. A list of a million numbers in Python uses ~50 MB and each operation is slow. A numpy array uses ~8 MB and operations are 100x faster because the math runs in C under the hood.\n\nThe import-as-np convention is universal. Don't `from numpy import *`.",
    exercise:
      "Create a numpy array of the squares 0² through 9².",
  },

  {
    id: "np-creation",
    order: 2,
    title: "Creating Arrays",
    tier: "numpy",
    concept:
      "Several ways to build arrays: from a list, with zeros/ones, with a range, or with random numbers.",
    code: `import numpy as np

# From a Python list
a = np.array([1.0, 2.0, 3.0])
print(a)

# Constant-filled
zeros = np.zeros(5)              # [0. 0. 0. 0. 0.]
ones  = np.ones(3)               # [1. 1. 1.]
full  = np.full(4, 7.5)          # [7.5 7.5 7.5 7.5]

# Like Python's range, but as an array
r = np.arange(10)                # [0 1 2 ... 9]
r2 = np.arange(0, 1, 0.1)        # [0.0 0.1 ... 0.9]

# Evenly spaced — give the COUNT instead of the step
ls = np.linspace(0, 1, 5)        # [0. 0.25 0.5 0.75 1.]

# Random
rng = np.random.default_rng(0)   # seed for reproducibility
print(rng.random(3))             # uniform [0, 1)
print(rng.normal(0, 1, 5))       # 5 standard normals`,
    explanation:
      "These functions cover ~95% of array creation. `np.arange` for index-style ranges, `np.linspace` for evenly-spaced grids (good for plotting), `np.zeros/ones` for pre-allocated buffers.\n\nAlways seed your RNG when you want reproducible demos. `default_rng` is the modern API — old code may use `np.random.seed()` which has subtle pitfalls.",
    exercise:
      "Create a 100-element array of 1's followed by a 100-element array of 0's, then concatenate them.",
  },

  {
    id: "np-shapes",
    order: 3,
    title: "Shape and Reshape",
    tier: "numpy",
    concept:
      "An array's `shape` is a tuple of its dimensions. `.reshape(...)` rearranges values into a new shape without copying data.",
    code: `import numpy as np

a = np.arange(12)
print(a.shape)            # (12,)  — 1D

# Reshape into 3 rows, 4 cols
m = a.reshape(3, 4)
print(m.shape)            # (3, 4)
print(m)
# [[ 0  1  2  3]
#  [ 4  5  6  7]
#  [ 8  9 10 11]]

# Use -1 to mean "fill in the rest"
m2 = a.reshape(2, -1)     # (2, 6)
m3 = a.reshape(-1, 2)     # (6, 2)

# Add a new axis
v = np.array([1, 2, 3])    # shape (3,)
col = v[:, None]           # shape (3, 1) — column vector
row = v[None, :]           # shape (1, 3) — row vector

# Useful when broadcasting requires explicit dims (you'll see this constantly)`,
    explanation:
      "Shape is the foundation of numpy. Most beginner bugs are 'I have shape (50,) but I needed (50, 1)'. The fix is usually `[:, None]` or `.reshape(-1, 1)`.\n\n`-1` in reshape means 'whatever makes it fit'. Saves you from computing the dimension manually.",
    exercise:
      "Take np.arange(20) and reshape it into a 4x5 matrix. Then take row 2.",
  },

  {
    id: "np-indexing",
    order: 4,
    title: "Indexing and Slicing",
    tier: "numpy",
    concept:
      "Like Python lists but extended. Slice each dimension. Negative indices work. Slicing returns a VIEW (no copy).",
    code: `import numpy as np

a = np.arange(10)
print(a[0])             # 0
print(a[-1])            # 9
print(a[2:5])           # [2, 3, 4]

# 2D arrays — comma-separated indices
m = np.arange(20).reshape(4, 5)
# [[ 0  1  2  3  4]
#  [ 5  6  7  8  9]
#  [10 11 12 13 14]
#  [15 16 17 18 19]]

print(m[1, 2])          # 7   — row 1, col 2
print(m[1])             # [5, 6, 7, 8, 9]   — row 1
print(m[:, 2])          # [2, 7, 12, 17]    — column 2
print(m[1:3, 2:4])      # 2x2 sub-block

# Slices share memory with the original. Modifying the slice modifies the original.
sub = m[1:3]
sub[0, 0] = 999
print(m[1, 0])          # 999  — original was modified

# .copy() makes an independent copy
safe = m[1:3].copy()
safe[0, 0] = -1
print(m[1, 0])          # 999  — original unchanged`,
    explanation:
      "Numpy slicing is COMMA-separated, not bracket-chained. `m[1, 2]` works; `m[1][2]` works but creates an intermediate (slower).\n\nViews-vs-copies is a real footgun. If you slice and modify, you're modifying the original. Use `.copy()` when you need independence.",
    exercise:
      "Given m = np.arange(20).reshape(4, 5), get the last column.",
  },

  {
    id: "np-vectorized-math",
    order: 5,
    title: "Vectorized Math",
    tier: "numpy",
    concept:
      "Arithmetic on arrays operates element-wise, in C. 100x faster than Python loops, and one line.",
    code: `import numpy as np

a = np.array([1.0, 2.0, 3.0, 4.0])
b = np.array([10.0, 20.0, 30.0, 40.0])

print(a + b)           # [11 22 33 44]
print(a * b)           # [10 40 90 160]
print(b / a)           # [10. 10. 10. 10.]
print(a ** 2)          # [1 4 9 16]

# Scalar broadcasts to every element
print(a + 100)         # [101 102 103 104]

# Universal functions (ufuncs) — operate element-wise
print(np.sqrt(a))      # [1. 1.414... 1.732... 2.]
print(np.log(b))       # [2.302... 2.995... 3.401... 3.688...]
print(np.exp([0, 1]))  # [1.        2.71828...]

# Compare element-wise → returns a bool array
print(a > 2)           # [False False True True]`,
    explanation:
      "This is the BIG win of numpy. A loop over 1M elements in Python takes seconds; the equivalent numpy expression takes milliseconds. The entire numerical Python ecosystem (pandas, scipy, sklearn, pytorch) is built on this.\n\nRule: NEVER use a Python loop to iterate a numpy array element-by-element. Find the vectorized equivalent.",
    exercise:
      "Given prices = np.array([100, 102, 99, 105]), compute returns vectorized: r[i] = prices[i+1] / prices[i] - 1.",
  },

  {
    id: "np-broadcasting",
    order: 6,
    title: "Broadcasting",
    tier: "numpy",
    concept:
      "When two arrays have different shapes, numpy 'stretches' the smaller one to match — without copying. Powerful but error-prone if you don't visualize the shapes.",
    code: `import numpy as np

# Scalar broadcasts to any shape
a = np.arange(6).reshape(2, 3)
print(a + 100)
# [[100 101 102]
#  [103 104 105]]

# (2, 3) + (3,) → broadcasts the (3,) across each row
print(a + np.array([10, 20, 30]))
# [[10 21 32]
#  [13 24 35]]

# (2, 3) + (2, 1) → broadcasts the column across each col
print(a + np.array([[100], [200]]))
# [[100 101 102]
#  [203 204 205]]

# RULE: align shapes RIGHT. Two dims are compatible if equal OR one is 1.
# (2, 3) and (3,) → align as (2, 3) vs (1, 3) → OK, becomes (2, 3)
# (2, 3) and (2,) → align as (2, 3) vs (2,)  → NOT OK (mismatched trailing dim)
# Fix: a + np.array([100, 200])[:, None]      # (2,) → (2, 1) → broadcasts`,
    explanation:
      "Broadcasting is what makes numpy so concise. But the rule for which shapes are compatible is strict and counterintuitive at first.\n\nThe rule: starting from the LAST dimension, two arrays' shapes are compatible if each pair of dims is either equal, or one of them is 1. Otherwise, error.\n\nWhen you get the inevitable shape error, the fix is almost always `[:, None]` (add a column dim) or `[None, :]` (add a row dim).",
    exercise:
      "Subtract the per-column mean from a (1000, 50) matrix in one line. (Hint: matrix.mean(axis=0) is shape (50,) and broadcasts.)",
  },

  {
    id: "np-reductions",
    order: 7,
    title: "Reductions — sum, mean, std, max",
    tier: "numpy",
    concept:
      "Reductions collapse an array along one or more axes. By default they collapse everything to a scalar; with `axis=k` they collapse along just that axis.",
    code: `import numpy as np

m = np.arange(12).reshape(3, 4)
# [[ 0  1  2  3]
#  [ 4  5  6  7]
#  [ 8  9 10 11]]

print(m.sum())          # 66    — entire array
print(m.sum(axis=0))    # [12 15 18 21]   — sum each column (collapse rows)
print(m.sum(axis=1))    # [6 22 38]       — sum each row (collapse cols)

print(m.mean())         # 5.5
print(m.std())          # 3.45...
print(m.min(), m.max()) # 0 11

# Argmax / argmin — INDEX of the max/min
print(m.argmax())            # 11 (flat index)
print(m.argmax(axis=0))      # [2 2 2 2] — index of max in each column

# Cumulative versions
print(np.cumsum([1, 2, 3, 4]))      # [1 3 6 10]
print(np.cummax([3, 1, 4, 1, 5]))   # [3 3 4 4 5]    — running max
print(np.cumprod([1, 2, 3, 4]))     # [1 2 6 24]`,
    explanation:
      "Reductions are the bread and butter. Every aggregation — total volume, daily mean, max drawdown — is a reduction.\n\nThe `axis` argument trips beginners. Mnemonic: `axis=k` says 'eliminate axis k'. axis=0 eliminates the row axis, leaving you with a per-column result.",
    exercise:
      "Given returns = (252, 50) array (1 year of daily returns for 50 stocks), compute each stock's annualized mean (just `mean(axis=0) * 252`).",
  },

  {
    id: "np-boolean-mask",
    order: 8,
    title: "Boolean Masking",
    tier: "numpy",
    concept:
      "Index an array with a boolean array of the same shape to select only the True positions. The most expressive way to filter.",
    code: `import numpy as np

x = np.array([10, -5, 7, -3, 0, 12, -1])

mask = x > 0
print(mask)             # [True False True False False True False]
print(x[mask])          # [10 7 12]
print(x[x > 0])         # same thing, inline

# Assign through a mask
x[x < 0] = 0
print(x)                # [10 0 7 0 0 12 0]

# Combining masks: USE & and |, NOT and/or
returns = np.array([0.01, -0.02, 0.005, -0.01, 0.03])
big_move = (np.abs(returns) > 0.01)
print(returns[big_move])     # [-0.02, 0.03]

# Why & not "and"?
# "and" / "or" are Python boolean operators — they work on SINGLE booleans.
# For element-wise on arrays, use the bitwise & | ~ — they're overloaded.
# Always parenthesize: (a > 0) & (b > 0). Operator precedence is tricky.`,
    explanation:
      "Boolean masks are how you filter without a Python loop. `x[x > 0]` is one line of C code under the hood.\n\nThe `&`/`|`/`~` instead of `and`/`or`/`not` is a constant source of bugs. Remember: bitwise for arrays, logical for single booleans.",
    exercise:
      "Given returns, count how many are negative. (Hint: `(returns < 0).sum()`.)",
  },

  {
    id: "np-where",
    order: 9,
    title: "np.where — Element-wise if-else",
    tier: "numpy",
    concept:
      "`np.where(cond, a, b)` returns an array picking from `a` where `cond` is True, from `b` otherwise. Element-wise ternary.",
    code: `import numpy as np

x = np.array([1, -2, 3, -4, 5])

# Clip negatives to zero
clipped = np.where(x < 0, 0, x)
print(clipped)              # [1 0 3 0 5]

# Sign function (NaN-safe)
print(np.where(x > 0, 1, np.where(x < 0, -1, 0)))   # [1 -1 1 -1 1]

# 2-arg np.where returns INDICES where condition is True
print(np.where(x > 0))      # (array([0, 2, 4]),)
# Useful when you need the positions, not just the values.

# np.clip — convenience for bounded clipping
print(np.clip(x, 0, 4))     # [1 0 3 0 4]`,
    explanation:
      "Whenever you'd write `if x: a else: b` for every element, reach for np.where. It's vectorized and reads cleanly.\n\n`np.clip(x, lo, hi)` is shorthand for `np.where(x < lo, lo, np.where(x > hi, hi, x))`. Common in risk code (clip notional, clip leverage, etc).",
    exercise:
      "Given prices, build an array where each entry is 'up' (1), 'down' (-1), or 'flat' (0) based on the change from the previous price.",
  },

  {
    id: "np-random",
    order: 10,
    title: "Random — The Modern API",
    tier: "numpy",
    concept:
      "Use `np.random.default_rng(seed)` instead of `np.random.seed()`. Each rng object is independent and reproducible.",
    code: `import numpy as np

rng = np.random.default_rng(42)

print(rng.random(5))                  # uniform [0, 1)
print(rng.integers(0, 10, 5))         # 5 ints in [0, 10)
print(rng.normal(0, 1, 5))            # 5 standard normals
print(rng.choice([1, 2, 3, 4], size=5))  # sample with replacement

# Reproducibility
rng1 = np.random.default_rng(42)
rng2 = np.random.default_rng(42)
print(rng1.normal(0, 1, 3))   # same as below
print(rng2.normal(0, 1, 3))

# Simulate stock returns under GBM
n_days = 252
mu = 0.0005
sigma = 0.01
returns = rng.normal(mu, sigma, n_days)
prices = 100 * np.exp(np.cumsum(returns))   # GBM: log-returns sum, exp gives prices
print(prices[:5])`,
    explanation:
      "`np.random.default_rng` is the new (numpy 1.17+) generator API. It's faster, more flexible, and avoids global-state bugs that plagued the old API.\n\nReproducibility is critical in quant research. Always seed your RNG explicitly in any code that other people (or future-you) might run.",
    exercise:
      "Simulate 10,000 trials of a fair coin flip. Compute the empirical probability of heads. Should be near 0.5.",
  },

  {
    id: "np-stacking",
    order: 11,
    title: "Stacking and Concatenation",
    tier: "numpy",
    concept:
      "Combine arrays: concatenate along an existing axis, stack to create a new axis. `np.concatenate`, `np.stack`, `np.vstack`, `np.hstack`.",
    code: `import numpy as np

a = np.array([1, 2, 3])
b = np.array([4, 5, 6])

# Concatenate along the only axis
print(np.concatenate([a, b]))     # [1 2 3 4 5 6]

# Stack — adds a new axis
print(np.stack([a, b]))           # shape (2, 3), 2 rows
# [[1 2 3]
#  [4 5 6]]

print(np.stack([a, b], axis=1))   # shape (3, 2), 2 cols
# [[1 4]
#  [2 5]
#  [3 6]]

# Friendly aliases
np.vstack([a, b])      # like stack(axis=0)
np.hstack([a, b])      # like concatenate(axis=0) for 1D; for 2D it's column-stack

# Splitting — opposite of stacking
m = np.arange(12).reshape(3, 4)
left, right = np.split(m, 2, axis=1)
print(left.shape, right.shape)    # (3, 2) (3, 2)`,
    explanation:
      "These show up constantly when you assemble data. Stack daily returns into a (T, N) matrix, concatenate train + test sets, hstack a constant column for OLS intercept.\n\nThe difference: concatenate joins along an EXISTING axis (output has the same number of dims). stack creates a NEW axis (output has +1 dim).",
    exercise:
      "Build a (10, 3) matrix where column 0 is all 1's, column 1 is arange(10), column 2 is arange(10)**2.",
  },

  {
    id: "np-linalg",
    order: 12,
    title: "Linear Algebra — @ and np.linalg",
    tier: "numpy",
    concept:
      "`A @ B` is matrix multiplication. `np.linalg.solve(A, b)` solves Ax = b. `np.linalg.inv(A)` is the inverse (but use solve when you can).",
    code: `import numpy as np

# Matrix multiplication
A = np.array([[1, 2], [3, 4]])
v = np.array([5, 6])

print(A @ v)              # [17 39]  matrix-vector multiply
print(A @ A)              # 2x2 result, matrix-matrix multiply

# Solve a linear system A x = b
# E.g., 2 stocks, find weights making portfolio return == target
A = np.array([[0.01, 0.02], [0.03, 0.01]])   # 2 days x 2 stocks of returns
b = np.array([0.015, 0.02])                   # target portfolio return each day
x = np.linalg.solve(A, b)
print(x)            # weights

# Inverse — works but slower + numerically iffier than solve
A_inv = np.linalg.inv(A)
print(A_inv @ b)          # same result as solve

# OLS regression: β = (X'X)^(-1) X' y, BUT — use lstsq for stability
X = np.random.randn(100, 3)
y = X @ np.array([1.0, -0.5, 2.0]) + np.random.randn(100) * 0.1
beta, *_ = np.linalg.lstsq(X, y, rcond=None)
print(beta)               # ≈ [1, -0.5, 2]`,
    explanation:
      "Most regression code, factor model code, Markowitz code reduces to a few np.linalg calls. Learn `@`, `solve`, `lstsq`, `inv`, `eig`. They cover 95% of linear algebra in quant Python.\n\nRule: prefer `solve(A, b)` over `inv(A) @ b`. It's faster and more numerically stable.",
    exercise:
      "Solve: 2x + 3y = 8 and x - y = 1. Use np.linalg.solve.",
  },

  // ---------- PANDAS ----------
  {
    id: "pd-series",
    order: 13,
    title: "Pandas Series — Labeled 1D Arrays",
    tier: "pandas",
    concept:
      "A Series is a 1D array WITH AN INDEX (labels). Like a column of a spreadsheet. Built on top of numpy.",
    code: `import pandas as pd

# From a list
s = pd.Series([100, 101, 99, 102], index=["mon", "tue", "wed", "thu"])
print(s)
# mon    100
# tue    101
# wed     99
# thu    102

print(s["wed"])           # 99  — label-based lookup
print(s.iloc[2])          # 99  — position-based lookup

# Vectorized math (just like numpy)
print(s + 10)
print(s.mean(), s.std())

# Time-indexed Series — the bread and butter of quant
import pandas as pd
dates = pd.date_range("2026-01-01", periods=10, freq="D")
prices = pd.Series([100 + i * 0.5 for i in range(10)], index=dates)
print(prices)`,
    explanation:
      "Series is essentially 'numpy + labels'. The labels (called the 'index') make selecting and aligning data much nicer than raw numpy.\n\nQuant work is mostly time series — DataFrame and Series with date indexes. Get comfortable with pd.date_range and DatetimeIndex.",
    exercise:
      "Build a Series of squares 0² through 9² indexed by 'a' through 'j'.",
  },

  {
    id: "pd-dataframe",
    order: 14,
    title: "DataFrame — Labeled 2D Tables",
    tier: "pandas",
    concept:
      "A DataFrame is a 2D table: rows (indexed) and columns (named). Each column is a Series of its own dtype.",
    code: `import pandas as pd

# From a dict of columns
df = pd.DataFrame({
    "symbol": ["AAPL", "MSFT", "GOOG", "TSLA"],
    "price":  [175.30, 320.50, 2840.10, 250.00],
    "qty":    [100, 50, 5, 20],
})
print(df)
print(df.shape)              # (4, 3)
print(df.columns)            # Index(['symbol', 'price', 'qty'])

# Pick a column → Series
print(df["price"])
print(df.price)              # attribute access — works for valid names

# Pick multiple columns → DataFrame
print(df[["symbol", "price"]])

# Compute a new column
df["notional"] = df["price"] * df["qty"]
print(df)

# Filter rows (boolean indexing same as numpy)
big = df[df["notional"] > 10000]
print(big)`,
    explanation:
      "DataFrame is the workhorse of quant Python. Read a CSV, you get a DataFrame. Manipulate columns, you stay in DataFrame land. Most of pandas is variations on 'select rows, transform columns, aggregate'.\n\nDF columns are SERIES. Math between columns is vectorized. Filtering uses boolean indexing.",
    exercise:
      "Build a DataFrame with columns 'date' (5 consecutive days), 'price' (your choice), 'volume'. Add a column 'dollar_volume'.",
  },

  {
    id: "pd-read-csv",
    order: 15,
    title: "Reading CSVs",
    tier: "pandas",
    concept:
      "`pd.read_csv(path)` loads a CSV into a DataFrame. Tons of options for handling dates, missing values, types.",
    code: `import pandas as pd

# Basic read
df = pd.read_csv("prices.csv")

# Parse dates automatically — usually want for time series
df = pd.read_csv("prices.csv", parse_dates=["date"])

# Use a column as the index
df = pd.read_csv("prices.csv", parse_dates=["date"], index_col="date")

# Common args you'll set:
#   sep=","         — separator (default comma)
#   header=0        — which row has the header
#   usecols=[...]   — only read certain columns
#   dtype={...}     — force types per column
#   na_values=[...] — values to treat as NaN

# Write back out
df.to_csv("processed.csv")

# Check what you got
print(df.head())          # first 5 rows
print(df.tail())          # last 5
print(df.info())          # dtypes + memory
print(df.describe())      # summary stats per numeric column`,
    explanation:
      "Reading data is the first 30 seconds of every quant analysis. Master pd.read_csv's arguments — `parse_dates`, `index_col`, `dtype` are the big ones.\n\nFor multi-GB files, use `chunksize=` and iterate. For binary formats: `pd.read_parquet` is faster and smaller than CSV.",
    exercise:
      "Create a small DataFrame and write it to CSV, then read it back. Verify the dtypes match.",
  },

  {
    id: "pd-selection",
    order: 16,
    title: ".loc and .iloc — Selecting Rows",
    tier: "pandas",
    concept:
      ".loc[] uses LABELS (index values). .iloc[] uses INTEGER POSITIONS. Both can select rows, columns, or both.",
    code: `import pandas as pd

df = pd.DataFrame(
    {"price": [100, 101, 99, 102, 98]},
    index=pd.date_range("2026-01-01", periods=5, freq="D"),
)

# .loc — by label
print(df.loc["2026-01-03"])         # row for that date
print(df.loc["2026-01-02":"2026-01-04"])    # slice INCLUSIVE on both ends!

# .iloc — by integer position
print(df.iloc[0])                    # first row
print(df.iloc[0:3])                  # rows 0, 1, 2 (exclusive end like Python)
print(df.iloc[-1])                   # last row

# Combined row + column
df2 = pd.DataFrame({
    "price": [100, 101, 99],
    "vol":   [1000, 2000, 1500],
})
print(df2.loc[0, "price"])        # 100
print(df2.iloc[0, 0])             # 100

# Boolean indexing — common
big = df[df["price"] > 100]`,
    explanation:
      "The most common pandas confusion. Rule: `.loc` for what you SEE (labels), `.iloc` for the underlying numeric positions.\n\nWatch out: `.loc` slicing is INCLUSIVE on both ends (like database queries), unlike Python and `.iloc` which are exclusive on the end.",
    exercise:
      "Given df indexed by dates, select all rows from March 2026.",
  },

  {
    id: "pd-groupby",
    order: 17,
    title: "groupby — Aggregate by Category",
    tier: "pandas",
    concept:
      "Split-apply-combine. Group rows by a key, apply an aggregation to each group, combine the results.",
    code: `import pandas as pd

trades = pd.DataFrame({
    "symbol":  ["AAPL", "MSFT", "AAPL", "GOOG", "MSFT", "AAPL"],
    "qty":     [100, 50, 75, 5, 25, 200],
    "price":   [175.30, 320.50, 176.10, 2840.0, 321.0, 175.80],
})

# Total quantity per symbol
print(trades.groupby("symbol")["qty"].sum())
# symbol
# AAPL    375
# GOOG      5
# MSFT     75

# Multiple aggregations
print(trades.groupby("symbol").agg({
    "qty":   "sum",
    "price": ["mean", "max"],
}))

# Custom aggregation via lambda
trades["notional"] = trades["qty"] * trades["price"]
vwap = trades.groupby("symbol").apply(
    lambda g: (g["notional"]).sum() / g["qty"].sum()
)
print(vwap)`,
    explanation:
      "groupby is THE most useful pandas operation. Daily P&L by strategy, average return by sector, win rate by hour of day — all groupbys.\n\nMental model: 'split into pieces, run a function on each piece, glue the results back together'.",
    exercise:
      "Given trades, compute the max price per symbol.",
  },

  {
    id: "pd-rolling",
    order: 18,
    title: "rolling — Windowed Operations",
    tier: "pandas",
    concept:
      "`.rolling(window).agg()` applies an aggregation over a sliding window. Indispensable for moving averages, vol, signals.",
    code: `import pandas as pd
import numpy as np

prices = pd.Series(
    np.random.RandomState(0).randn(100).cumsum() + 100,
    index=pd.date_range("2026-01-01", periods=100, freq="D"),
)

# 20-day moving average
ma20 = prices.rolling(20).mean()
print(ma20.head(25))      # first 19 are NaN (not enough data)

# 20-day rolling std (volatility)
vol = prices.rolling(20).std()

# Custom rolling function
rng_high = prices.rolling(5).max()    # high over last 5 days

# rolling on a DataFrame — applies to every column
returns = prices.pct_change()
features = pd.DataFrame({
    "ma_20":   prices.rolling(20).mean(),
    "vol_20":  returns.rolling(20).std() * np.sqrt(252),  # annualized
    "z_score": (prices - prices.rolling(20).mean()) / prices.rolling(20).std(),
})
print(features.tail())`,
    explanation:
      "Rolling windows are how you turn raw prices into FEATURES. Every technical indicator (SMA, EMA, Bollinger, RSI) is some kind of rolling operation.\n\nThe first `window-1` rows are NaN by design (not enough history). Always `.dropna()` or guard for it.",
    exercise:
      "Given a Series of daily returns, compute the rolling 60-day Sharpe ratio (mean/std, annualized).",
  },

  {
    id: "pd-nan",
    order: 19,
    title: "Handling NaN",
    tier: "pandas",
    concept:
      "Missing values appear as `NaN`. Most pandas aggregations SKIP NaN automatically. But you must reason about whether that's what you want.",
    code: `import pandas as pd
import numpy as np

s = pd.Series([1.0, np.nan, 3.0, np.nan, 5.0])

# isna() / notna() — boolean masks for missing data
print(s.isna())            # [False True False True False]
print(s.count())           # 3  (non-NaN entries)

# Aggregations skip NaN by default
print(s.sum())             # 9.0   (1 + 3 + 5)
print(s.mean())            # 3.0   (9 / 3, not 9 / 5)

# Drop NaN
print(s.dropna())

# Fill NaN
print(s.fillna(0))         # [1 0 3 0 5]
print(s.fillna(method="ffill"))   # forward-fill — last observation carried forward
print(s.fillna(method="bfill"))   # back-fill

# Interpolate
print(s.interpolate())            # [1 2 3 4 5] — linear

# CRITICAL: len() vs .count()
print(len(s))              # 5  — includes NaN
print(s.count())           # 3  — excludes NaN`,
    explanation:
      "Quant data is FULL of NaN — holidays, delisted stocks, missing ticks. Always think about how each step handles them.\n\nMost frequent bug: dividing a sum by len() instead of count(). The mean is correct (skips NaN); doing it manually as `sum / len` divides by the WRONG denominator.",
    exercise:
      "Given a DataFrame of returns with random NaN, compute each column's mean two ways: `.mean()` and `.sum() / .count()`. They should agree.",
  },

  {
    id: "pd-time",
    order: 20,
    title: "Time-Indexed Data",
    tier: "applied",
    concept:
      "DatetimeIndex unlocks date-aware operations: string slicing, frequency conversion, resampling.",
    code: `import pandas as pd
import numpy as np

idx = pd.date_range("2026-01-01", "2026-12-31", freq="B")   # business days
prices = pd.Series(np.cumsum(np.random.randn(len(idx))) + 100, index=idx)

# String slicing — natural date queries
print(prices["2026-03"])              # all of March
print(prices["2026-01":"2026-03"])    # Jan through March

# Resample — convert frequency. Like groupby for time.
monthly = prices.resample("M").last()      # month-end prices
print(monthly.head())

weekly_high = prices.resample("W").max()   # weekly high
weekly_returns = prices.resample("W").last().pct_change()

# Shift — lag a Series. Returns NaN at the edge.
prev_day = prices.shift(1)
returns = prices / prev_day - 1            # or prices.pct_change()

# Time deltas
delta = idx[-1] - idx[0]
print(delta.days)               # number of days

# Day of week / quarter / etc.
print(idx.dayofweek.tolist()[:5])      # 0 = Monday
print(idx.quarter[:5].tolist())`,
    explanation:
      "DatetimeIndex makes time series in pandas a joy. Resample is especially powerful — go from daily to monthly with one call.\n\nFor live trading systems, you also need timezones. `tz_localize` and `tz_convert` handle that. (Not covered here — when you need them, look them up.)",
    exercise:
      "Given a daily Series, compute weekly returns: take last price each week, then pct_change.",
  },
];
