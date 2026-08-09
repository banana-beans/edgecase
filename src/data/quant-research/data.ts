import type { QRQuestion } from "./index";

// ============================================================
// Module 1 -- Data Assembly
// long/wide reshaping, pivot vs pivot_table, melt/stack/unstack,
// dedup policy, concat vs merge, dtype discipline, categoricals,
// memory footprint, MultiIndex basics.
// 13 questions: 3 warmup, 7 core, 3 hard.
// ============================================================

export const dataQuestions: QRQuestion[] = [
  {
    id: "qr-data-01-long-vs-wide",
    module: "data",
    title: "Long vs wide format",
    difficulty: "warmup",
    question: `You load daily closing prices as a table with three columns: date, ticker, close -- one row per ticker per day. Your teammate says "make it wide before you compute returns." What does wide format mean here, and why does each shape exist?`,
    thinking: `First get the two shapes straight. Long format (also called tidy) has one observation per row: date, ticker, close. Wide format has one row per date and one column per ticker, so the table is a date-by-ticker matrix. Ask yourself what operation comes next. Returns, rolling means, and correlations are all per-ticker time-series operations -- in wide format each of those is one vectorized call over the whole matrix, and pandas aligns everything by the shared date index for free. Long format wins when you are storing, appending, or joining: new tickers are just new rows, no schema change, and metadata like sector joins naturally on the ticker column. A working rule: store long, compute wide. Also ask what a missing (date, ticker) pair looks like in each shape -- in long it is an absent row you can miss; in wide it becomes a visible NaN hole.`,
    answer: `Long format is one row per (date, ticker) observation; wide format is a date-indexed matrix with one column per ticker. Wide is for computation: pct_change, rolling stats, and correlations vectorize across all tickers at once with automatic date alignment. Long is for storage and joins: appending data or attaching metadata never changes the schema. Typical workflow: keep the master data long, pivot to wide right before numeric work.`,
    python: `import pandas as pd

# long: one row per observation -- how vendors usually ship data
long = pd.DataFrame({
    "date":   pd.to_datetime(["2024-01-02", "2024-01-02", "2024-01-03", "2024-01-03"]),
    "ticker": ["AAPL", "MSFT", "AAPL", "MSFT"],
    "close":  [185.6, 370.9, 184.2, 373.2],
})

# wide: rows = dates, columns = tickers. This is the compute shape.
wide = long.pivot(index="date", columns="ticker", values="close")

# now per-ticker time-series math is one vectorized call for ALL tickers
rets = wide.pct_change()          # daily simple returns, every ticker at once

# and going back to long is one call too
back_to_long = wide.reset_index().melt(
    id_vars="date", var_name="ticker", value_name="close"
)`,
    trap: `Computing returns while the data is still long, e.g. df["close"].pct_change() on the stacked column. That divides AAPL's close by MSFT's previous row wherever tickers are adjacent -- garbage returns with no error raised. If you must stay long, you need groupby("ticker") first; in wide format the mistake is impossible.`,
    followUp: `Your wide matrix has NaN holes because tickers IPO'd at different times. Which downstream computations silently handle that, and which quietly give you a shorter overlap than you think (hint: corr)?`,
  },
  {
    id: "qr-data-02-melt-wide-to-long",
    module: "data",
    title: "Melt: wide back to long",
    difficulty: "warmup",
    question: `A vendor sends you a spreadsheet where each row is a date and there are 500 columns, one per ticker. You need it in a database table with columns date, ticker, close. How do you reshape it, and what do you check afterwards?`,
    thinking: `This is wide-to-long, the inverse of pivot, and the tool is melt (or stack, which does the same via the index). Before reshaping, ask what is actually in those 500 columns: are they all prices, or did the vendor sneak in a volume or a currency column that will get melted into fake tickers? Then think about what melt does to missing data: a NaN cell in the wide matrix becomes an explicit row with a NaN value in long format. Decide on purpose whether to keep those rows (they record "no observation that day", useful for audit) or drop them (cleaner storage). Finally, sanity-check the row count: it should be roughly n_dates times n_tickers minus the NaN cells you dropped. A reshape that silently loses or invents rows is the classic first-week data bug.`,
    answer: `Use melt: keep date as the identifier column, turn the 500 ticker columns into a ticker column and a close column. Or equivalently set date as the index and call stack. Afterwards verify: column names really were all tickers, the row count matches dates times tickers minus dropped NaNs, dtypes are datetime/string/float, and there is exactly one row per (date, ticker) pair.`,
    python: `import pandas as pd

# wide: dates down the side, one column per ticker
wide = pd.read_csv("closes.csv", parse_dates=["date"])

# melt: date stays as an id column, the 500 ticker columns
# collapse into (ticker, close) pairs
long = wide.melt(id_vars="date", var_name="ticker", value_name="close")

# NaN cells became NaN rows -- decide explicitly what to do with them
long = long.dropna(subset=["close"])   # here: drop non-observations

# sanity checks before this goes anywhere near a database
assert long.duplicated(["date", "ticker"]).sum() == 0   # one row per pair
n_cells = wide.shape[0] * (wide.shape[1] - 1)           # dates x tickers
n_nan = int(wide.drop(columns="date").isna().sum().sum())
assert len(long) == n_cells - n_nan                     # nothing lost/invented`,
    trap: `Forgetting that melt turns every non-id column into rows. If the sheet had a stray column like "currency" or "notes", it becomes a fake ticker named currency with text in the close column -- which then silently forces the whole close column to object dtype.`,
  },
  {
    id: "qr-data-03-concat-vs-merge",
    module: "data",
    title: "concat vs merge",
    difficulty: "warmup",
    question: `You have 2023 prices in one DataFrame and 2024 prices in another, same columns. Separately, you have a table mapping ticker to sector. Which operation combines each pair, and how do you decide between concat and merge in general?`,
    thinking: `Ask one question: am I adding more of the same observations, or am I attaching new attributes to existing observations? More rows of the same schema -- 2023 plus 2024 prices -- is stacking, which is concat along axis 0. New columns keyed by some identifier -- sector for each ticker -- is a relational join, which is merge. The failure modes differ, so the choice matters. Concat's risks are duplicated rows where the two files overlap (did the 2023 file end exactly where 2024 starts?) and silently misaligned or unioned columns if the schemas drift. Merge's risks are key mismatches: tickers in the price file missing from the sector map (rows silently dropped on an inner join, or NaN sector on a left join) and unexpected duplicate keys fanning rows out. Always know your expected row count before and check it after.`,
    answer: `Stacking same-schema data is concat: pd.concat([px23, px24]) adds rows. Attaching attributes by key is merge: prices.merge(sectors, on="ticker", how="left") adds columns. Rule of thumb: concat grows rows with the same columns, merge grows columns using a key. After concat, check for overlap duplicates at the seam; after merge, check for unmatched keys and that the row count did not change.`,
    python: `import pandas as pd

# --- stacking: same schema, more observations -> concat ---
px = pd.concat([px23, px24], ignore_index=True)

# the seam is where bugs live: did both files include Dec 29, 2023?
dupes = px.duplicated(["date", "ticker"]).sum()
assert dupes == 0, "overlapping rows at the year boundary"

# --- attaching attributes: keyed lookup -> merge ---
n_before = len(px)
px = px.merge(sectors, on="ticker", how="left",
              validate="many_to_one")   # each ticker maps to ONE sector row

# left join keeps all price rows; unmatched tickers show up as NaN sector
assert len(px) == n_before             # merge must not fan out rows
missing = px.loc[px["sector"].isna(), "ticker"].unique()
# investigate missing -- do not silently drop them`,
    trap: `Using merge with how="inner" to attach sectors and never noticing that tickers absent from the sector map vanished from your price data entirely. Inner joins delete rows without a warning; default to left joins plus an explicit check of what failed to match.`,
    followUp: `The sector file has two rows for one ticker because it changed sector mid-year. What does validate="many_to_one" do now, and how should sector really be keyed?`,
  },
  {
    id: "qr-data-04-pivot-vs-pivot-table",
    module: "data",
    title: "pivot vs pivot_table",
    difficulty: "core",
    question: `You pivot a vendor file of daily closes from long to wide and pandas raises: "Index contains duplicate entries, cannot reshape". A colleague says just switch pivot to pivot_table, it handles that. Do you take the advice?`,
    thinking: `Understand why the error exists before making it go away. pivot is a pure reshape: it requires exactly one value per (index, column) cell and refuses to guess when there are two. pivot_table is an aggregation: given duplicates it applies a reducer, mean by default, and returns a number for every cell without complaint. So the colleague's advice does not fix your problem -- it hides it. Duplicate (date, ticker) rows in a price file mean something is wrong upstream: the file was double-loaded, two vendor feeds got mixed, or a correction row was appended after the original. Averaging the original and the corrected price produces a value that never traded. First ask: why are there duplicates, which copy is authoritative, and what dedup rule encodes that? Only then reshape -- with pivot, so any future duplicates blow up loudly again.`,
    answer: `No. The error is pivot doing its job: two rows claim the same (date, ticker) cell. pivot_table would silently average them -- if one row is a corrected price, you would get a price that never existed. Right response: inspect the duplicates, decide the policy (e.g. keep the last-loaded correction), drop_duplicates accordingly, then use pivot so duplicates keep failing loudly in the future. pivot_table is for intentional aggregation, not duplicate laundering.`,
    python: `import pandas as pd

# reproduce and INSPECT the duplicates first -- never skip this step
dup_mask = long.duplicated(["date", "ticker"], keep=False)  # keep=False marks all copies
dups = long[dup_mask].sort_values(["ticker", "date"])
# look at them: same price twice (harmless reload) or different (correction)?

# policy: file rows are in load order, later row is the vendor correction
clean = (long
         .drop_duplicates(["date", "ticker"], keep="last")  # keep the correction
         )

# pivot stays strict -- future duplicates will raise again, which we WANT
wide = clean.pivot(index="date", columns="ticker", values="close")

# pivot_table by contrast would have done this silently:
#   wide_bad = long.pivot_table(index="date", columns="ticker",
#                               values="close", aggfunc="mean")
# averaging a fat-fingered 1856.0 with the corrected 185.6 -> nonsense price`,
    trap: `Reaching for pivot_table to silence the duplicate error. It "works" every time and quietly averages contradictory rows -- interviewers use this question specifically to see whether you treat errors as information or as obstacles.`,
    followUp: `The duplicates turn out to be identical rows from a double-load. Does keep="last" vs keep="first" matter now, and what cheap assertion would catch a double-load before pivot ever runs?`,
  },
  {
    id: "qr-data-05-dedup-policy",
    module: "data",
    title: "Deduplication policy",
    difficulty: "core",
    question: `Your daily loader appends vendor files into one price table. Today you discover about 2% of (date, ticker) pairs appear twice, sometimes with different closes. Walk me through how you deduplicate.`,
    thinking: `Resist the urge to type drop_duplicates immediately -- dedup is a policy decision, and the policy depends on why the duplicates exist. Split the duplicates into two buckets. Exact duplicates (every column identical) are almost always re-loaded files; keeping either copy is safe. Conflicting duplicates (same key, different close) mean two sources of truth: vendor corrections, two feeds merged, or a parsing bug. For those, ask which copy is authoritative. If files carry a load timestamp or arrive in order, "latest load wins" implements vendor corrections correctly. If two vendors are mixed, you need a vendor precedence rule instead. Whatever you choose, make it deterministic: sort by the tiebreak column first, because drop_duplicates keep="last" depends on row order. Then measure -- how many conflicts, how large the price gaps -- because a 2% conflict rate with big gaps is an upstream bug, not a cleaning chore.`,
    answer: `First separate exact duplicates from conflicting ones. Exact ones: drop, either copy is fine. Conflicting ones: decide which source is authoritative -- usually latest load timestamp wins, implementing vendor corrections -- then sort by that column and drop_duplicates(keep="last") on (date, ticker). Log the count and size of conflicts; if prices differ materially, escalate upstream rather than just cleaning. And add a uniqueness assertion to the loader so this never accumulates silently again.`,
    python: `import pandas as pd

key = ["date", "ticker"]

# measure before touching anything
dup_all = px.duplicated(key, keep=False)
exact = px.duplicated(keep=False)              # duplicate across ALL columns
conflicting = dup_all & ~exact                 # same key, different payload
n_conf = int(conflicting.sum())
# if conflicts are common or price gaps are large, this is an upstream bug

# deterministic policy: latest load_ts wins (vendor corrections overwrite)
clean = (px
         .sort_values(key + ["load_ts"])       # order defines "last"
         .drop_duplicates(key, keep="last"))

# quantify what the policy threw away, for the audit log
dropped = px.loc[dup_all].groupby(key)["close"].nunique()
n_real_conflicts = int((dropped > 1).sum())

# guardrail so the loader fails fast next time
assert not clean.duplicated(key).any()`,
    trap: `Calling drop_duplicates(subset=["date","ticker"]) without sorting first. keep="first" or "last" then depends on whatever row order the concat happened to produce -- your dataset becomes non-reproducible and changes every time the loader runs in a different order.`,
    followUp: `One vendor restates prices up to a week later. Your backtest ran on the original values, production would use the restated ones. Which price should a point-in-time backtest actually see?`,
  },
  {
    id: "qr-data-06-int-with-nan",
    module: "data",
    title: "Integers with missing values",
    difficulty: "core",
    question: `You load a volume column that should be whole numbers, but df["volume"].dtype comes back float64, and 1000000 prints as 1000000.0. What happened, and what are your options?`,
    thinking: `The cause is a pandas classic: the column has missing values, and the default NumPy int64 dtype has no way to represent NaN -- NaN is a floating-point concept. So pandas silently upcasts the whole column to float64 to make room for the NaN. Ask yourself what actually breaks. Cosmetics aside, float64 has a 53-bit integer mantissa, so volumes are exact up to about 9 quadrillion -- fine for equities. The real dangers are joins (an id column upcast to float can fail to match its int counterpart, and 1234.0 written to a CSV no longer round-trips as an id) and semantics (NaN-contaminated arithmetic). The modern fix is the nullable Int64 extension dtype -- capital I -- which stores integers plus a separate missingness mask, so values stay integers and missing prints as <NA>. Weigh that against the cost: some libraries still expect NumPy dtypes.`,
    answer: `The column contains NaNs, and NumPy int64 cannot hold NaN, so pandas upcast to float64 -- standard behavior, not a parsing bug. Options: accept float64 (exact for integers up to 2^53, fine for volume math); use the nullable Int64 dtype, which keeps true integers with a separate <NA> mask; or fill the missing values and downcast, only if zero genuinely means "no volume". Be strictest with identifier columns, where float formatting breaks joins and round-trips.`,
    python: `import pandas as pd
import numpy as np

# the silent upcast in one line
s = pd.Series([100, 200, None])
# s.dtype -> float64, values 100.0, 200.0, NaN (int64 can't hold NaN)

# option 1: nullable integer dtype -- note the capital I in "Int64"
s_int = pd.Series([100, 200, None], dtype="Int64")
# s_int.dtype -> Int64, prints 100, 200, <NA>; stays integer

# ask for it at load time so the upcast never happens
df = pd.read_csv("prices.csv", dtype={"volume": "Int64", "sid": "Int64"})

# option 2: fill-then-downcast -- ONLY if 0 truly means "did not trade"
vol = df["volume"].fillna(0).astype(np.int64)

# why identifiers deserve the most care:
a = pd.DataFrame({"sid": pd.array([1, 2, None], dtype="Int64")})
b = pd.DataFrame({"sid": [1, 2, 3]})              # plain int64
m = a.merge(b, on="sid")   # works; but if sid had become float64 via CSV
                           # round-trip ("1.0"), the join keys stop matching`,
    trap: `Running fillna(0) on volume just to get ints back. Zero volume is a real market state (halted or simply untraded), so you have destroyed the distinction between "no data" and "traded nothing" -- and any liquidity filter downstream now treats them identically.`,
    followUp: `Same issue, but the column is an integer security id used as a merge key across five tables. What loading discipline prevents the float upcast from ever touching a key column?`,
  },
  {
    id: "qr-data-07-categorical-tickers",
    module: "data",
    title: "Categorical dtype for tickers",
    difficulty: "core",
    question: `Your long-format panel has 3,000 tickers and 10 years of daily rows -- about 7.5 million rows -- and the ticker column alone dominates memory. What dtype change helps, how does it work, and where can it bite you?`,
    thinking: `Ask what the ticker column really is: millions of repetitions of only 3,000 distinct strings. Storing each occurrence as a separate Python string object costs 50+ bytes per row of pointers and object overhead. The categorical dtype exploits the repetition: pandas stores the 3,000 unique strings once, plus a compact integer code per row (int16 suffices for 3,000 categories, 2 bytes instead of 50+). That is roughly an order-of-magnitude saving, and groupby("ticker") gets faster too, because pandas groups on the integer codes. Then think about the sharp edges, because there are real ones: string methods may need care, comparing two categoricals with different category sets raises, concat of frames whose categories differ silently falls back to object dtype (your saving evaporates without an error), and merging on category keys can behave surprisingly. So convert late, or manage a shared category set across frames.`,
    answer: `Convert ticker to categorical: astype("category"). Pandas keeps one copy of each unique string and stores a small integer code per row -- with 3,000 tickers that is about 2 bytes per row instead of 50-plus, roughly 10x smaller, and groupbys speed up because they operate on the codes. Caveats: concatenating frames with mismatched category sets silently degrades back to object dtype, and cross-frame comparisons or merges want identical categories -- so either convert after assembly or share one CategoricalDtype everywhere.`,
    python: `import pandas as pd

# measure first -- deep=True is required to count actual string bytes
before = df["ticker"].memory_usage(deep=True)

df["ticker"] = df["ticker"].astype("category")
after = df["ticker"].memory_usage(deep=True)
# typically ~10x smaller: 3,000 strings stored once + int16 code per row

# groupby now works on integer codes -- faster than string hashing
# observed=True skips categories with no rows (and silences the warning)
daily_mean = df.groupby("ticker", observed=True)["close"].mean()

# THE trap: concat with mismatched categories degrades silently
a = df_2023.copy()
b = df_2024.copy()          # 2024 has new IPO tickers -> different categories
both = pd.concat([a, b])
# both["ticker"].dtype is now object -- saving gone, no warning raised

# fix: one shared dtype built from the union of all tickers
all_tickers = sorted(set(a["ticker"]) | set(b["ticker"]))
shared = pd.CategoricalDtype(categories=all_tickers)
a["ticker"] = a["ticker"].astype(shared)
b["ticker"] = b["ticker"].astype(shared)
both = pd.concat([a, b])    # stays categorical`,
    trap: `Converting each yearly file to categorical independently and then concatenating. The category sets differ (new listings, delistings), so concat silently falls back to object dtype -- the memory win disappears and nothing warns you. Convert after assembly, or share one CategoricalDtype.`,
  },
  {
    id: "qr-data-08-stack-unstack",
    module: "data",
    title: "stack, unstack, and MultiIndex",
    difficulty: "core",
    question: `You have a DataFrame indexed by (date, ticker) -- a MultiIndex -- with columns close and volume. Explain what unstack does here, what stack does, and when you'd reach for them instead of pivot and melt.`,
    thinking: `Picture the MultiIndex as two stacked key columns that have been moved into the row labels. unstack takes the innermost index level (ticker here) and rotates it up into the columns, giving you a wide frame -- and because you have two value columns, the result gets two-level columns: (close, AAPL), (close, MSFT), (volume, AAPL), and so on. stack is the exact inverse: it rotates a column level down into the row index. So stack/unstack are the index-based twins of melt/pivot -- same geometry, different starting point. Reach for them when your data is already MultiIndexed, typically right after a groupby over two keys, because they are then one call with no reset_index round-trip. Ask also what happens to missing combinations: unstack materializes every (date, ticker) cell, so absent pairs surface as NaN -- which is often exactly the visibility you want.`,
    answer: `unstack pivots the inner index level (ticker) into columns, turning the (date, ticker)-indexed frame into a date-indexed wide frame -- with two-level columns since there are two value columns. stack is the inverse, rotating a column level back into the index. They are pivot/melt for data that already lives in a MultiIndex, so they shine right after two-key groupbys. Side effect worth knowing: unstack fills absent (date, ticker) combinations with NaN, making missing data visible.`,
    python: `import pandas as pd

# panel indexed by (date, ticker) -- e.g. what a two-key groupby returns
panel = long.set_index(["date", "ticker"]).sort_index()

# unstack: rotate ticker (innermost level) up into the columns
wide = panel.unstack("ticker")
# columns are now a 2-level MultiIndex: (close, AAPL), (volume, AAPL), ...

# select one field -> plain date x ticker matrix, ready for time-series math
closes = wide["close"]
rets = closes.pct_change()

# stack: the exact inverse -- rotate the ticker column level back down
# future_stack=True is the pandas >= 2.2 engine (old default is deprecated)
restored = wide.stack("ticker", future_stack=True)

# the idiomatic habitat: straight after a two-key groupby
sector_flow = (trades
               .groupby(["date", "sector"])["notional"].sum()  # MultiIndex Series
               .unstack("sector")                              # date x sector matrix
               )`,
    trap: `Forgetting that unstacking a frame with several value columns creates two-level columns. Code that then does wide["AAPL"] raises a KeyError -- you must select the field first, wide["close"]["AAPL"], or grab wide["close"] as the matrix you actually wanted.`,
    followUp: `After unstack, some (date, ticker) cells are NaN because those tickers had not listed yet. rets.mean(axis=1) still returns a number every day -- what is it averaging over, and is that what you want?`,
  },
  {
    id: "qr-data-09-float32-vs-float64",
    module: "data",
    title: "float32 vs float64",
    difficulty: "core",
    question: `To halve memory, a teammate proposes storing your entire research price and returns store in float32 instead of float64. Where is that safe, where is it dangerous, and what would you propose instead?`,
    thinking: `Start from what the dtypes give you: float64 carries about 15-16 significant decimal digits, float32 only about 7. Now walk through where each column's precision actually gets consumed. A single price like 185.63 fits comfortably in 7 digits. The danger is never the stored value -- it is accumulation. Compounding thousands of daily returns, summing millions of P&L cells, computing covariance via sums of squared deviations: each operation grinds away digits, and starting from 7 leaves nothing for the grind. Classic symptom: a long cumprod of float32 returns visibly drifts from the float64 answer, or a variance computed two mathematically equivalent ways disagrees in the third digit. Index-like data has its own trap: a Unix timestamp needs 10 digits, so float32 mangles it outright. The pragmatic split: float32 is a storage and transport format; float64 is the compute format. Store compressed, upcast on load for anything that accumulates.`,
    answer: `float32 halves memory and gives about 7 significant digits -- fine for storing individual prices or returns, and standard in ML feature pipelines. It is dangerous wherever error accumulates: compounding returns over years, large sums, covariance and regression internals, and anything index-like such as timestamps or ids. My proposal: keep float32 as the at-rest format on disk, upcast to float64 at load time for computation, and never let ids or timestamps be floats at all. Memory pressure is usually better solved with categoricals and chunking than by degrading compute precision.`,
    trap: `Benchmarking the dtype change on a spot-check -- individual prices match to 5 decimals, ship it -- without testing the accumulated quantities. The corruption only shows up in long cumprods, covariance matrices, and regression betas, exactly the numbers you rarely eyeball.`,
    followUp: `Your covariance matrix in float32 comes back with a small negative eigenvalue and Cholesky fails. Why does reduced precision produce a non-positive-definite matrix, and what are two fixes?`,
  },
  {
    id: "qr-data-10-memory-footprint",
    module: "data",
    title: "Auditing a DataFrame's memory",
    difficulty: "core",
    question: `A colleague's research notebook dies with an out-of-memory error loading a 2 GB CSV that "should easily fit" in 32 GB of RAM. How do you audit where the memory goes, and what are the standard fixes, in order of impact?`,
    thinking: `First kill the intuition that file size predicts memory: 2 GB on disk routinely becomes 10-20 GB in RAM. Ask where the blow-up comes from. Text is the usual culprit: a CSV field of 6 characters costs 6 bytes on disk but 50-plus bytes as a Python string object in an object-dtype column. Then numbers stored as text with stray characters silently parse to object dtype too, costing both memory and correctness. Then dates left as strings instead of datetime64. The audit tool is memory_usage(deep=True) -- deep matters, because without it pandas reports only the 8-byte pointers for object columns, hilariously understating them. Fix in impact order: repeated strings to categorical (10x on those columns), drop columns you never load (usecols), correct numeric widths, and if it still hurts, chunked processing or a columnar format like Parquet that preserves dtypes. Also remember the loader itself needs transient overhead beyond the final frame.`,
    answer: `Run df.memory_usage(deep=True) -- deep=True is essential, otherwise object columns report pointer size only -- and sort. Almost always object-dtype string columns dominate. Fixes by impact: convert repeated strings (tickers, exchanges) to categorical; load only needed columns with usecols; parse dates to datetime64 and fix numbers that parsed as object; downcast oversized numerics; and for the long term switch storage to Parquet, which stores dtypes and loads column-selectively. If it still does not fit, process in chunks.`,
    python: `import pandas as pd

# --- audit: where does the memory actually go? ---
mem = df.memory_usage(deep=True).sort_values(ascending=False)
# deep=True counts real string bytes; without it an object column of
# 50-char strings reports 8 bytes/row -- pure fiction

# object columns are the usual offenders; list them with their cardinality
obj_cols = df.select_dtypes(include="object").nunique()

# --- fixes, biggest lever first ---
# 1) low-cardinality strings -> categorical (often ~10x on that column)
for col in ["ticker", "exchange", "currency"]:
    df[col] = df[col].astype("category")

# 2) don't load what you don't use, and set dtypes AT read time
df = pd.read_csv(
    "big.csv",
    usecols=["date", "ticker", "close", "volume"],
    dtype={"ticker": "category", "volume": "Int64"},
    parse_dates=["date"],       # datetime64: 8 bytes vs ~60 as string
)

# 3) longer term: columnar storage with dtypes baked in
df.to_parquet("big.parquet")   # later reads: select columns, no re-parsing`,
    trap: `Trusting df.memory_usage() or df.info() without deep=True. Object columns show up as 8 bytes per row -- the pointer, not the string -- so the audit points you at the wrong columns and the real hog looks innocent.`,
  },
  {
    id: "qr-data-11-merge-validation",
    module: "data",
    title: "Merging two vendors safely",
    difficulty: "hard",
    question: `You are combining daily closes from two vendors into one master table: vendor A is your primary, vendor B fills A's gaps and cross-checks. Design the merge. What must you verify before, during, and after?`,
    thinking: `Before writing any join, interrogate the keys. Do the vendors even agree on ticker symbology -- is Berkshire BRK.B in one and BRK-B in the other? Unharmonized symbols cause silent non-matches that look like missing data. Are dates the same convention (trade date vs settlement date)? Is each vendor genuinely unique on (date, ticker)? If not, the merge fans out rows multiplicatively. During the merge, encode your assumptions so violations raise: validate="one_to_one" asserts key uniqueness on both sides, and indicator=True labels each row left_only, right_only, or both -- your coverage map for free. After: reconcile prices where both vendors report, because disagreement beyond a few basis points means a corporate-action or timing difference you must resolve before trusting either. Then implement precedence -- A wins, B fills A's holes -- as an explicit combine step, not as an accident of join order.`,
    answer: `First harmonize symbology and date conventions, and verify each vendor is unique on (date, ticker). Then outer-merge on the harmonized key with validate="one_to_one" so duplicate keys raise, and indicator=True so I can count left-only, right-only, and matched rows. Where both report, compute the price discrepancy and investigate anything beyond tolerance -- usually corporate-action timing. Finally apply precedence explicitly: A's close, filled with B's where A is missing, keeping a source column for audit.`,
    python: `import pandas as pd

key = ["date", "sym"]   # sym = harmonized symbol, mapped BEFORE merging

# pre-flight: each vendor must be unique on the key, or the join fans out
assert not a.duplicated(key).any(), "vendor A has duplicate keys"
assert not b.duplicated(key).any(), "vendor B has duplicate keys"

m = a.merge(
    b, on=key, how="outer",
    suffixes=("_a", "_b"),
    validate="one_to_one",   # raises if uniqueness ever breaks -- cheap insurance
    indicator=True,          # labels each row: left_only / right_only / both
)

coverage = m["_merge"].value_counts()
# large left_only or right_only blocks = symbology mismatch or coverage gap

# reconcile where both vendors report a price
both = m["_merge"] == "both"
rel_gap = (m.loc[both, "close_a"] / m.loc[both, "close_b"] - 1).abs()
suspect = m.loc[both].loc[rel_gap > 0.001]   # >10bp: likely corp-action timing
# investigate suspect before trusting either vendor on those days

# explicit precedence: A wins, B fills A's gaps -- plus an audit trail
m["close"] = m["close_a"].fillna(m["close_b"])
m["source"] = m["close_a"].notna().map({True: "A", False: "B"})`,
    trap: `Merging on raw vendor symbols. BRK.B vs BRK-B, or a ticker reused by a different company after a delisting, produces silent non-matches and even wrong matches -- the merge "succeeds" and the damage surfaces months later. Symbology mapping comes before any join, ideally via a security master with permanent ids.`,
    followUp: `Vendor B marks its prices as split-adjusted, vendor A as unadjusted. Your reconciliation flags every stock that ever split. In which representation should the master table store prices, and where do adjustments belong?`,
  },
  {
    id: "qr-data-12-panel-shape-strategy",
    module: "data",
    title: "Choosing a panel shape strategy",
    difficulty: "hard",
    question: `You are designing the data layer for a small research stack: 5,000 stocks, daily data, prices plus 40 signal columns. Long format, wide format, or one wide matrix per field? Argue for a layout and tell me where it hurts.`,
    thinking: `Refuse to pick a single shape in the abstract -- enumerate the access patterns first. Time-series ops (rolling stats, returns) want date-by-ticker matrices. Cross-sectional ops (daily ranks, z-scores, neutralization) want the same matrices, worked row-wise. Joins with metadata and point-in-time filters want long. Appending a day of data wants whatever appends cheaply. The layout that serves compute best is a dict of wide matrices, one per field: closes, volume, each signal -- every matrix date-by-ticker, all sharing identical indexes. That last clause is the real design decision: pin one master (calendar, universe) pair and force every matrix onto it, so cross-field operations align by construction rather than by accident. The costs, honestly: NaN-heavy matrices when the universe churns (memory waste), schema rigidity (adding a field means building a whole new matrix), metadata does not fit matrices at all, and alignment discipline must be enforced or field-vs-field operations silently misalign. So: store long on disk, serve aligned wide matrices in memory.`,
    answer: `Store long on disk -- one row per (date, ticker), appends and joins are natural, Parquet-friendly. Serve research from a dict of wide date-by-ticker matrices, one per field, all reindexed onto a single master calendar and universe so every cross-field expression aligns by construction. Where it hurts: universe churn makes matrices NaN-heavy; adding fields means rebuilding matrices; metadata stays long forever; and the whole scheme rests on the alignment discipline -- one unaligned matrix quietly corrupts every expression it touches.`,
    trap: `Letting each wide matrix keep its own index -- whatever dates and tickers that field happened to have. Pandas will happily align two differently-indexed matrices in an expression, unioning indexes and injecting NaNs, so signals times prices returns a plausible-looking frame that is quietly wrong at every edge. One master index, asserted everywhere.`,
    followUp: `Your universe is point-in-time: stocks enter and exit the index over the decade. Fixed matrix columns for the union of all members, or ragged per-date universes? What does each choice do to survivorship handling?`,
  },
  {
    id: "qr-data-13-dtype-drift-concat",
    module: "data",
    title: "Silent dtype drift in pipelines",
    difficulty: "hard",
    question: `A daily job concatenates each new day's file onto a growing price table. Months later, someone notices df["close"].dtype is object and everything downstream is slow. Nothing ever raised an error. Reconstruct what likely happened and how to make this fail loudly.`,
    thinking: `Work backwards from the rule: an object-dtype numeric column means at least one non-numeric value got in, and pandas downgraded the whole column rather than lose data. Now think about which single day did it. Candidates: a file where the vendor wrote N/A or a dash for a halted stock's close; a European-formatted file with comma decimals; a header row swallowed as data; a currency symbol; or an empty file that parsed a footer. The insidious part is the mechanics of the drift: concat takes the common denominator of dtypes, so one object-dtype day poisons the entire concatenated column forever after -- and nothing raises, because object dtype is a legal dtype. Comparisons even keep "working" via string ordering. The fix is a schema contract at the boundary: parse each incoming file with explicit dtypes so bad values raise at read time, or validate the frame's dtypes immediately after parsing, before concat. Boundaries fail loudly; interiors then stay clean.`,
    answer: `Some single day's file contained a non-numeric close -- a vendor "N/A", comma decimals, a stray header -- so that day parsed as object, and concat silently downgraded the whole accumulated column, since concat takes the lowest common dtype and object is legal. Fix: enforce a schema at ingestion -- explicit dtype= in read_csv so bad values raise immediately, or a post-parse assertion that every column matches the expected dtype -- and repair the history with to_numeric(errors="coerce") plus inspection of what got coerced.`,
    python: `import pandas as pd
import numpy as np

# --- forensics on the existing table: find the poison rows ---
as_num = pd.to_numeric(df["close"], errors="coerce")  # unparseable -> NaN
bad = df.loc[as_num.isna() & df["close"].notna()]
# inspect bad: "N/A"? "1.234,56"? a repeated header "close"? Now you know
# which day and which vendor quirk started the drift.

# repair, consciously: coerce, then decide what NaN closes mean
df["close"] = as_num

# --- prevention: a schema contract at the ingestion boundary ---
SCHEMA = {"close": "float64", "volume": "Int64", "ticker": "category"}

def load_day(path: str) -> pd.DataFrame:
    day = pd.read_csv(path, dtype=SCHEMA, parse_dates=["date"])
    # dtype= makes a bad value raise HERE, at the file, on the day it arrives
    # -- not months later as mystery slowness
    return day

# belt and braces: assert before every concat; one object day poisons all
def safe_append(table: pd.DataFrame, day: pd.DataFrame) -> pd.DataFrame:
    for col, dt in SCHEMA.items():
        assert str(day[col].dtype) == dt, "schema drift in " + col
    return pd.concat([table, day], ignore_index=True)`,
    trap: `Fixing the symptom with a one-off astype(float) on the accumulated table without finding which values were non-numeric. astype raises on "N/A" -- so people switch to errors="coerce" and silently NaN out rows they never looked at, converting a loud data-quality signal into invisible missing prices.`,
    followUp: `Same pipeline, subtler drift: a day's file is missing the volume column entirely, and concat fills it with NaN, upcasting Int64 -- no error. What does a real schema validation layer check beyond dtypes?`,
  },
  {
    id: "qr-data-20260808-chained-indexing",
    module: "data",
    title: "Chained indexing and SettingWithCopyWarning",
    difficulty: "warmup",
    question: `You clean a price panel with df[df["volume"] == 0]["close"] = np.nan to null out closes on zero-volume days. Pandas raises a SettingWithCopyWarning, and when you check afterward the closes are unchanged. What happened, and how do you fix it?`,
    thinking: `Two square-bracket operations chained together are two separate calls: df[mask] first, then ["close"] = ... on whatever that returned. Pandas cannot promise df[mask] is a view into the original frame -- it is often an intermediate copy -- so the assignment can land on a throwaway object instead of df itself, with no reliable way to know which without inspecting internals. That ambiguity is exactly what the warning flags: your code "worked" by luck before, or silently no-ops now. The fix is not to suppress the warning but to remove the chain: do the row selection and the column write in ONE call, so there is only a single indexing operation and no ambiguity about the target.`,
    answer: `Chained indexing performs two separate operations, and the first one may return a copy rather than a view -- so the assignment can silently miss the original DataFrame. Collapse it into a single .loc call: df.loc[mask, "close"] = value. One operation, one unambiguous target, no warning.`,
    python: `import pandas as pd
import numpy as np

# WRONG: chained indexing -- two separate __getitem__/__setitem__ calls.
# df[mask] may return a copy; the assignment can land on that copy
# and never touch df. Pandas warns because it cannot tell you which.
df[df["volume"] == 0]["close"] = np.nan   # SettingWithCopyWarning, silently ineffective

# RIGHT: a single .loc call -- one operation, unambiguous target.
df.loc[df["volume"] == 0, "close"] = np.nan

# if you genuinely want a separate frame to mutate, say so explicitly
zero_vol = df[df["volume"] == 0].copy()
zero_vol["close"] = np.nan   # fine: zero_vol is intentionally independent`,
    trap: `Silencing the warning with pd.options.mode.chained_assignment = None instead of fixing the chain. That deletes the signal, not the bug -- the assignment can still be a no-op, now with nothing to catch it in code review.`,
    followUp: `You now write df2 = df[df["volume"] == 0]; df2["close"] = np.nan on purpose, intending df2 as an independent frame. Pandas still warns. Why, and what one method call removes the ambiguity?`,
  },
  {
    id: "qr-data-20260809-json-normalize",
    module: "data",
    title: "Flattening nested vendor JSON",
    difficulty: "core",
    question: `A new vendor's REST API returns each day's data as nested JSON: a list of records where each record has a flat date and ticker but the fundamentals are nested three levels deep, e.g. record["financials"]["income_statement"]["revenue"]. You need this as a flat DataFrame with columns like financials.income_statement.revenue for downstream joins. Walk me through building it and what to check.`,
    thinking: `Reach for json_normalize, which flattens nested dicts into dotted column names in one call. But first ask two questions about the payload's shape. Does the nesting depth and key set stay IDENTICAL across every record, or do some records simply omit an optional key -- because json_normalize is forgiving by design, an absent nested key silently produces NaN rather than an error, so schema drift across records is invisible unless you check for it explicitly. Second, is any nested field actually a repeating LIST -- multiple filings, multiple share classes -- rather than a fixed dict? Normalizing without telling json_normalize about that list leaves it as a single opaque Python object sitting in one cell; the DataFrame looks flat in a repr but one column silently holds lists, and every vectorized operation on it either errors confusingly or coerces to string.`,
    answer: `Use pd.json_normalize with sep="." for dotted column names on nested scalar fields, and record_path plus meta for any field that is actually a repeating list, so each list item becomes its own row instead of one opaque cell. Verify afterward: check that the expected columns exist (an optional nested key missing from a record silently becomes NaN, not an error) and that dtypes are clean, since a numeric leaf that is sometimes None, sometimes a number, and sometimes a string ends up object dtype.`,
    python: `import pandas as pd

# raw: list of dicts as returned by the vendor API, one entry per (ticker, date)
raw = [
    {"date": "2026-08-07", "ticker": "AAPL",
     "financials": {"income_statement": {"revenue": 94.9e9, "eps": 1.64}}},
    {"date": "2026-08-07", "ticker": "MSFT",
     "financials": {"income_statement": {"revenue": 62.0e9}}},  # eps missing here
]

# sep="." gives dotted column names matching the nested path -- easy to reason about
flat = pd.json_normalize(raw, sep=".")
# columns: date, ticker, financials.income_statement.revenue, financials.income_statement.eps

# MSFT's missing eps becomes NaN, not a KeyError -- json_normalize is forgiving
# BY DESIGN, so schema drift across records is invisible unless you check for it
expected_cols = {"date", "ticker", "financials.income_statement.revenue",
                  "financials.income_statement.eps"}
assert expected_cols.issubset(flat.columns)

# if a record instead carries a LIST of filings (repeating), record_path
# explodes it into one row per item; meta carries the flat id columns along
raw_multi = [{"ticker": "AAPL", "filings": [{"q": 1, "eps": 1.5}, {"q": 2, "eps": 1.6}]}]
exploded = pd.json_normalize(raw_multi, record_path="filings", meta="ticker", sep=".")
# WITHOUT record_path, "filings" would land as one cell holding a raw Python list --
# looks fine in a repr, breaks every vectorized op that touches it`,
    trap: `Calling json_normalize on the raw payload without record_path when a field is actually a repeating list (multiple filings, multiple share classes). The list survives as a single object in one cell -- the DataFrame looks flat but one column silently holds Python lists, and a merge or a numeric op on it either errors confusingly or coerces the whole column to string.`,
    followUp: `Different tickers in the same batch have the nested revenue key at completely different depths because two vendors were merged upstream into one feed. What is more robust than dot-path column names for reconciling those two schemas?`,
  },
];
