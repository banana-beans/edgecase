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
  {
    id: "qr-data-20260811-groupby-transform-vs-apply",
    module: "data",
    title: "GroupBy transform vs apply: the silent shape trap",
    difficulty: "warmup",
    question: `You need to demean a return column within each sector and keep every row aligned to its original position for a later merge. A teammate writes df.groupby(sector)[ret].apply(lambda g: g - g.mean()) and it runs fine today. Why do you ask them to use transform instead, and what could go wrong later if they do not?`,
    thinking: `transform has a contract enforced by pandas: it must return one output value per input row, so pandas can hand you back a Series that is index-aligned to the original frame every time, and it dispatches to fast, vectorized per-group code paths for common reductions. apply has no such contract -- it hands each group's sub-frame to your function and stitches together whatever comes back, inferring the shape from the result. Today the lambda returns a same-length Series per group, so apply happens to behave like transform, just slower because it loops through groups in Python. But apply's behavior is a property of what the function returns, not of what you intended -- change the lambda to something that collapses a group to one number (a legitimate, common edit, like adding a summary stat next to it) and the SAME call silently switches from a row-aligned broadcast to a group-collapsed aggregation, with no error, just a differently shaped and now misaligned result.`,
    answer: `transform enforces a one-output-row-per-input-row contract, so its result always aligns back to the original index, and pandas routes common cases through fast vectorized paths instead of a Python loop over groups. apply infers its output shape from whatever the function returns, so the identical call can silently flip between a row-aligned broadcast and a group-collapsing aggregation depending on a small, unrelated edit inside the lambda -- with no error to flag the change. Use transform whenever the operation is meant to broadcast back to every row; reserve apply for genuinely group-shaped results.`,
    python: `import pandas as pd

df = pd.DataFrame({
    "sector": ["tech", "tech", "fin", "fin"],
    "ret":    [0.02, 0.04, -0.01, 0.03],
})

# RIGHT: transform guarantees row-aligned output, fast vectorized path
df["ret_demeaned"] = df.groupby("sector")["ret"].transform(lambda g: g - g.mean())

# apply happens to look identical today...
df["ret_demeaned_apply"] = df.groupby("sector")["ret"].apply(lambda g: g - g.mean())
# ...but a tiny, plausible edit changes its OUTPUT SHAPE, not just its value:
collapsed = df.groupby("sector")["ret"].apply(lambda g: g.mean())  # one row per GROUP now
# collapsed has a sector-level index, not the original row index --
# merging it back requires a join, not a plain column assignment

# performance: transform uses cython paths for common reductions;
# apply always pays the python-level per-group loop
# %timeit df.groupby("sector")["ret"].transform("mean")          # fast
# %timeit df.groupby("sector")["ret"].apply(lambda g: g.mean())  # much slower`,
    trap: `Assuming a passing test today proves apply is safe here. The bug does not live in the data, it lives in the function body -- a future refactor of the lambda (adding a second summary line, early-returning a scalar for one edge-case group) changes apply's output shape without changing a single line outside the lambda, and the assignment that used to broadcast cleanly now raises or silently reindexes with NaNs.`,
    followUp: `When would apply be the right tool instead of transform? (When the per-group computation genuinely needs multiple columns jointly, like a per-sector regression, or when you deliberately want a group-collapsed result -- transform cannot do either.)`,
  },
  {
    id: "qr-data-20260810-groupby-multi-agg",
    module: "data",
    title: "Flattening MultiIndex columns after groupby.agg",
    difficulty: "warmup",
    question: `You compute daily per-ticker stats with df.groupby("ticker").agg({"close": ["mean", "std"], "volume": "sum"}) and the result's columns come back as a confusing two-level MultiIndex like ("close", "mean"). Downstream code that expects a column named avg_close breaks. What is happening and how do you get flat, readable column names?`,
    thinking: `agg with a dict of lists returns one column level per aggregation function alongside the original field name, because pandas has no way to know you want "close_mean" as a single string -- it hands you the (field, func) pair as a tuple and leaves flattening to you. This is a case where the API optimizes for expressiveness over convenience: multiple stats per field is a common ask, so it defaults to the layout it can build for free, a MultiIndex, rather than guessing a naming convention. Reach for two idiomatic fixes: rename via named aggregation with a tuple of (source column, function), which lets you assign each output column its own flat name inline, or join the tuple levels yourself with an underscore after the fact. Named aggregation is generally the better habit because the flat name is declared at the same place the computation happens, not maintained as a separate renaming step, so it cannot drift out of sync when someone later adds another aggregation.`,
    answer: `agg with a dict of lists produces one MultiIndex column per (field, function) pair since pandas will not guess a flat name for you. Either flatten after the fact by joining the levels with an underscore, or better, use named aggregation -- groupby(...).agg(avg_close=("close", "mean"), ...) -- which declares the flat output name at the point of computation so it cannot drift out of sync later.`,
    python: `import pandas as pd

df = pd.DataFrame({
    "ticker": ["AAPL", "AAPL", "MSFT", "MSFT"],
    "close":  [185.6, 184.2, 370.9, 373.2],
    "volume": [50_000_000, 48_000_000, 22_000_000, 21_000_000],
})

# dict-of-lists agg -> two-level MultiIndex columns: ("close","mean"), etc.
raw = df.groupby("ticker").agg({"close": ["mean", "std"], "volume": "sum"})

# fix 1: flatten after the fact by joining the levels
raw.columns = ["_".join(col).strip("_") for col in raw.columns]

# fix 2 (preferred): named aggregation declares the flat name up front,
# so a renaming step can never drift out of sync with the aggregations
clean = df.groupby("ticker").agg(
    avg_close=("close", "mean"),
    std_close=("close", "std"),
    total_volume=("volume", "sum"),
)`,
    trap: `Indexing the MultiIndex result with raw["close"] and getting back a two-column frame (mean and std both), then feeding that into code expecting a single Series -- the failure surfaces downstream as a confusing shape error, far from where the ambiguous column selection actually happened.`,
    followUp: `You add a custom aggregation passed as a plain Python function instead of a string. What does its column name look like in the MultiIndex, and how does named aggregation handle that case differently?`,
  },
  {
    id: "qr-data-20260812-stable-sort-price-time",
    module: "data",
    title: "Stable sort for price-time priority",
    difficulty: "warmup",
    question: `You're reconstructing a limit order book from a raw trade log that isn't in price order. You need to sort resting orders by price for matching, but orders at the same price must stay in original arrival order (price-time priority). Does sort_values give you that for free, or do you need to do something else?`,
    thinking: `Recall what "stable" means for a sort: ties keep their original relative order instead of being shuffled arbitrarily. pandas' default sort_values kind is quicksort, which is fast but not guaranteed stable -- two orders at the same price can come out in either order, and that ordering is arbitrary, not necessarily wrong-looking, so the bug hides easily. Price-time priority is exactly a stability requirement: the sort key is price, and the IMPLICIT secondary key is arrival order, which is already encoded in the row order of a log that arrived in sequence. A stable sort preserves that secondary key for free; an unstable one silently discards it. The fix costs nothing -- kind="stable" (mergesort under the hood) is still O(n log n).`,
    answer: `pandas' default sort ("quicksort") is not guaranteed stable, so orders tied on price can silently be reordered, breaking time priority. Pass kind="stable" (or "mergesort") to sort_values so ties keep their original relative order -- that original row order already IS the arrival/time-priority order, since the log arrives in sequence. Same O(n log n) cost, correct result.`,
    python: `import pandas as pd

orders = pd.DataFrame({
    "order_id": [101, 102, 103, 104],
    "price":    [100.5, 100.0, 100.5, 100.0],   # two ties at each price level
    # arrival order IS the row order -- no separate timestamp column needed
})

# WRONG: default kind="quicksort" is NOT guaranteed stable -- ties can
# silently swap, corrupting time priority within a price level
unstable = orders.sort_values("price")

# RIGHT: kind="stable" (mergesort under the hood) preserves the original
# row order among ties, which is the arrival/time-priority order
book = orders.sort_values("price", kind="stable")
# within price 100.5: order 101 stays ahead of order 103 (arrived first)
# within price 100.0: order 102 stays ahead of order 104

assert book.query("price == 100.5")["order_id"].tolist() == [101, 103]`,
    trap: `Assuming sort_values is always stable because "that's usually how sorting works." NumPy's default quicksort is not stable and pandas inherits that default; only kind="stable" or "mergesort" guarantees it, and the difference is invisible until two orders tie on price and get silently swapped.`,
  },
  {
    id: "qr-data-20260813-wide-to-long-multi-stub",
    module: "data",
    title: "wide_to_long for multi-horizon columns",
    difficulty: "core",
    question: `A signal file has columns permno, ret_1m, ret_3m, ret_12m, vol_1m, vol_3m, vol_12m -- one row per stock, horizon baked into the column name. You need long format: permno, horizon, ret, vol. melt alone turns every column into its own row and loses the pairing between ret_3m and vol_3m. What do you use instead, and how does it know which columns belong together?`,
    thinking: `Plain melt cannot do this because it has no concept of "these two columns share a horizon" -- it just stacks every value column into one generic column, so ret_3m and vol_3m end up as two unrelated rows instead of two fields of the same observation. What you actually have is TWO stub variables (ret, vol) each varying across the SAME suffix (1m, 3m, 12m), and pandas has a dedicated tool for exactly that shape: wide_to_long. You tell it the stubnames (the prefixes, ret and vol), which column holds the row id (permno), and the pattern of the suffix. It matches every stubname against every suffix, pulls the paired columns onto the same output row, and puts the suffix into a new index level -- so ret_3m and vol_3m land on the identical (permno, 3m) row automatically. The one sharp edge: it is strict about exact stub-plus-suffix matching, so a stray inconsistently named column (ret_ytd with no matching vol_ytd) either gets silently dropped or raises, depending on version -- always diff the input and output column counts.`,
    answer: `Use pd.wide_to_long with stubnames=["ret", "vol"], i=\"permno\", j=\"horizon\", sep="_" and a suffix pattern matching 1m, 3m, 12m. It pairs each stubname with each matching suffix and places both fields of a horizon on the same output row, which melt cannot do since melt has no notion of columns being paired. Always check the row and column counts before and after -- a stub without a matching suffix for one variable gets silently dropped rather than raising.`,
    python: `import pandas as pd

wide = pd.DataFrame({
    "permno": [10001, 10002],
    "ret_1m": [0.02, -0.01], "ret_3m": [0.05, 0.01], "ret_12m": [0.18, 0.04],
    "vol_1m": [0.15, 0.22], "vol_3m": [0.16, 0.21], "vol_12m": [0.19, 0.24],
})

# stubnames = the shared prefixes; j names the new column holding the suffix;
# suffix= restricts matching to exactly these horizon tokens
long = pd.wide_to_long(
    wide, stubnames=["ret", "vol"], i="permno", j="horizon",
    sep="_", suffix="1m|3m|12m",
).reset_index()
# one row per (permno, horizon), with ret and vol correctly paired

# sanity check: no columns silently dropped for lacking a stub partner
n_expected = wide.shape[0] * 3   # 2 permnos x 3 horizons
assert len(long) == n_expected`,
    trap: `Reaching for melt and then trying to re-pair ret and vol afterward with a string-split-and-pivot. It works, but it is exactly what wide_to_long already does in one call -- and the manual version is where an off-by-one in the split silently mismatches a ret row to the wrong vol row.`,
    followUp: `One stock is missing its vol_12m column entirely because that horizon wasn't available yet for a recent IPO. What does wide_to_long do with that row, and is silently dropping it or silently NaN-filling it the behavior you want here?`,
  },
  {
    id: "qr-data-20260814-explode-list-column",
    module: "data",
    title: "Exploding list-valued columns with explode()",
    difficulty: "warmup",
    question: `A positions feed gives you one row per (date, trader) with an "instruments" column holding a Python list of tickers held that day, plus a "notional" column for the trader's total exposure. You need one row per (date, trader, ticker) to join against a per-ticker return series. What's the pandas call, and what's the catch with the notional column afterward?`,
    thinking: `explode() takes a column of list-likes and gives you one row per element, replicating every other column's value across the new rows. That's exactly what you want for instruments, but every scalar column -- including notional -- gets copied unchanged onto each fanned-out row, not divided. So after exploding a 2-instrument row with notional 1,000,000, you get two rows that each say notional=1,000,000, which reads like a per-instrument number but is actually the trader's whole position repeated. Before joining, always check: did the row count multiply the way you expected, and does every duplicated scalar column still mean what its name implies, or does it need dividing (equal-weight split) or dropping to avoid double-counting exposure downstream.`,
    answer: `Use positions.explode("instruments", ignore_index=True) -- it produces one row per list element and duplicates every other column's value onto each new row. The catch: notional doesn't get split across instruments, it's copied verbatim, so post-explode it means "this trader's total notional" repeated on every row, not a per-instrument figure. If you need a per-instrument number, divide it yourself (e.g. by list length) before or after exploding.`,
    python: `import pandas as pd

positions = pd.DataFrame({
    "date": ["2024-06-03", "2024-06-03"],
    "trader": ["A", "B"],
    "instruments": [["AAPL", "MSFT"], ["GOOG"]],
    "notional": [1_000_000, 500_000],
})

exploded = positions.explode("instruments", ignore_index=True)
# notional is COPIED, not split: both AAPL and MSFT rows still say 1,000,000
print(exploded)

# fix, if you actually want a per-instrument figure: divide before exploding
per_instrument = positions.assign(
    notional=positions["notional"] / positions["instruments"].str.len()
).explode("instruments", ignore_index=True)
assert per_instrument["notional"].sum() == positions["notional"].sum()`,
    trap: `Treating the exploded notional as already being per-instrument and summing it across a trader's rows -- that silently multiplies their exposure by however many instruments they held that day.`,
    followUp: `How would you validate the exploded row count matches your expectation before you trust anything downstream of it?`,
  },
  {
    id: "qr-data-20260815-boolean-mask-and-or",
    module: "data",
    title: "Boolean masks: & vs and, and precedence",
    difficulty: "warmup",
    question: `You write df[df["sector"] == "tech" and df["mktcap"] > 1e9] to filter big tech names and pandas raises ValueError: The truth value of a Series is ambiguous. What's actually going wrong, and what's the fix -- including a precedence trap that bites even after you fix the first part?`,
    thinking: `Python's and/or call bool() on each operand to decide which branch to take, and bool() of a Series with more than one element is deliberately undefined -- pandas has no way to collapse a thousand True/False values into one truth value, so it refuses to guess and raises instead of picking something arbitrary. The fix is pandas' elementwise operators, & | ~, which are overloaded to compare Series position by position and return a boolean Series, exactly what filtering needs. But this trades one gotcha for another: in python, & binds TIGHTER than comparison operators like ==, the opposite of and/or's precedence. So df["sector"] == "tech" & df["mktcap"] > 1e9 without parentheses evaluates the & first, between "tech" and a Series -- not the comparison you intended. Every individual comparison needs its own parentheses before combining with &.`,
    answer: `and/or force python to call bool() on each side, and bool() of a multi-element Series is ambiguous by design, so pandas raises rather than silently picking an element. Use the elementwise operators & | ~ instead, which compare position-by-position. The follow-on trap: & binds tighter than ==, so you must parenthesize each comparison: df[(df["sector"] == "tech") & (df["mktcap"] > 1e9)] -- omitting the parens silently changes what gets evaluated first.`,
    python: `import pandas as pd

df = pd.DataFrame({
    "sector": ["tech", "tech", "fin"],
    "mktcap": [2.0e9, 0.5e9, 3.0e9],
})

# WRONG: raises ValueError -- "and" tries to call bool() on a Series
# big_tech = df[df["sector"] == "tech" and df["mktcap"] > 1e9]

# WRONG: no ValueError, but silently wrong -- & binds before ==
# bad = df[df["sector"] == "tech" & df["mktcap"] > 1e9]

# RIGHT: elementwise & with each comparison parenthesized
big_tech = df[(df["sector"] == "tech") & (df["mktcap"] > 1e9)]

# same idea for "or" -> "|", and negation "not" -> "~"
not_tech = df[~(df["sector"] == "tech")]`,
    trap: `Fixing the ValueError by switching to & but forgetting the parentheses. The code stops crashing -- Python happily evaluates "tech" & df["mktcap"], which errors on a string-vs-Series &, or if types align differently just silently produces the wrong mask. A clean run is not proof the filter is correct.`,
    followUp: `You need to combine four conditions and the parenthesized & chain is getting unreadable. What's the more scalable alternative for many conditions -- np.select, or building the mask incrementally with named boolean Series?`,
  },
  {
    id: "qr-data-20260816-multiindex-loc-indexslice",
    module: "data",
    title: "Slicing a MultiIndex safely with pd.IndexSlice",
    difficulty: "core",
    question: `You've pivoted a panel into a DataFrame with a MultiIndex on the columns (level 0 = field, like "close" or "volume"; level 1 = ticker). How do you select every ticker's "close" column at once, and why does df["close", "AAPL"] sometimes work fine while a partial slice across levels breaks?`,
    thinking: `A MultiIndex is really a hierarchy of tuples, and pandas needs it lexsorted at every level to do fast, safe partial slicing -- an unsorted MultiIndex silently falls back to slower paths and can raise UnsortedIndexError the moment you try a partial slice. Plain bracket indexing like df["close", "AAPL"] works because it's a single, fully-specified tuple with no ambiguity. The trouble starts the moment you want to fix one level while slicing across the other -- select the whole "close" level for every ticker, or combine that with a row date range -- because a bare tuple can't express "this exact label here, any value there" cleanly. pd.IndexSlice builds a proper per-level slicer object so .loc reads unambiguously: this label or slice at level 0, that one at level 1, composing correctly with row slicing too. First move on any MultiIndex-column frame: sort_index(axis=1) once, then always slice through .loc with IndexSlice instead of nested bracket chains.`,
    answer: `Sort the MultiIndex columns once with df.sort_index(axis=1) so partial slicing is fast and won't raise UnsortedIndexError, then slice with pd.IndexSlice: df.loc[:, pd.IndexSlice["close", :]] selects the "close" field across every ticker, and composes cleanly with row slicing. Bare tuple indexing like df["close","AAPL"] works for one fully-specified tuple but breaks down the moment you need a partial slice on one level while fixing the other.`,
    python: `import pandas as pd
import numpy as np

dates = pd.date_range("2026-01-01", periods=5, freq="B")
tickers = ["AAPL", "MSFT", "GOOG"]
fields = ["close", "volume"]

cols = pd.MultiIndex.from_product([fields, tickers], names=["field", "ticker"])
rng = np.random.default_rng(0)
df = pd.DataFrame(rng.normal(100, 5, (5, 6)), index=dates, columns=cols)

# sort once -- required for fast, safe partial MultiIndex slicing
df = df.sort_index(axis=1)

idx = pd.IndexSlice
# every ticker's close column, every date
close_all = df.loc[:, idx["close", :]]

# close for AAPL and MSFT only, over the first 3 dates -- composes
# a row slice with a partial column slice in one clean call
subset = df.loc[dates[:3], idx["close", ["AAPL", "MSFT"]]]

# works, but only because the tuple is fully specified -- doesn't
# generalize the moment you need a partial slice on either level
single = df["close", "AAPL"]`,
    trap: `Assuming df.loc[("close", slice(None))] and df.loc[:, ("close", slice(None))] behave the same. The first slices ROWS with a 2-tuple label (usually a KeyError against a single-level row index); the second correctly targets columns. IndexSlice removes this footgun by making the axis and the per-level slices explicit.`,
    followUp: `You need to swap which level is outermost -- ticker first, field second -- for a downstream step. What's the one-line call, and why can it silently produce an unsorted index again? (df.swaplevel(axis=1) then sort_index(axis=1) again -- swaplevel reorders the tuples without re-sorting them.)`,
  },
  {
    id: "qr-data-20260817-concat-keys-vendor-tagging",
    module: "data",
    title: "Tagging vendor origin with pd.concat(keys=...)",
    difficulty: "core",
    question: `You're combining daily bars from two vendors (Bloomberg and a cheaper alt-data provider) into one DataFrame for a reconciliation check. How do you stack them so you can still tell, row by row, which vendor a given observation came from -- without adding a manual "source" column yourself?`,
    thinking: `The naive move is looping over vendors and manually assigning df["source"] = name before concatenating -- it works but it's boilerplate you'll repeat every time you add a feed. pd.concat has a keys parameter built for exactly this: pass a list of labels alongside the list of DataFrames and it prepends a new outer index level carrying that label, one level per input frame, with zero manual column-writing. The result is a MultiIndex on rows (or columns, with axis=1) where level 0 is the vendor tag and the rest is each frame's original index -- so you can .xs() out one vendor's slice, or groupby(level=0) to compare vendors, without ever having typed a source column by hand.`,
    answer: `Pass keys=["bloomberg", "altdata"] to pd.concat alongside the list of DataFrames; it prepends a new outer index level holding that label, so every row carries its vendor tag automatically. Slice one vendor with df.xs("bloomberg", level=0), or compare across vendors with groupby(level=0) -- no manual source column needed, and it generalizes cleanly as more feeds get added.`,
    python: `import pandas as pd
import numpy as np

dates = pd.date_range("2026-01-01", periods=4, freq="B")
bbg = pd.DataFrame({"close": [101.2, 101.5, 100.9, 102.1]}, index=dates)
alt = pd.DataFrame({"close": [101.3, 101.4, 100.8, 102.3]}, index=dates)

# keys= adds a new outer index level -- no manual "source" column needed
combined = pd.concat([bbg, alt], keys=["bloomberg", "altdata"], names=["source", "date"])

# pull one vendor's slice back out
bbg_only = combined.xs("bloomberg", level="source")

# compare vendors' closes side by side, one row per date, one col per vendor
by_vendor = combined["close"].unstack(level="source")
by_vendor["diff"] = by_vendor["bloomberg"] - by_vendor["altdata"]`,
    trap: `Forgetting names= on concat leaves the new level unlabeled, so groupby(level=0) still works but downstream code referencing level="source" by name breaks -- always name the keys level explicitly.`,
    followUp: `Same trick with axis=1 instead of row-wise -- what changes? (It prepends a MultiIndex COLUMN level instead, useful when both vendors report the same dates but you want columns like (bloomberg, close) side by side rather than stacking rows.)`,
  },
  {
    id: "qr-data-20260818-merge-validate-param",
    module: "data",
    title: "merge()'s validate= parameter: catching a silent duplicate-key blowup",
    difficulty: "core",
    question: `You're merging a price panel (one row per ticker per day) against a static reference table that's supposed to have exactly one row per ticker. The merge runs fine, no error, but afterward you notice the row count roughly tripled and P&L numbers are impossible. What likely happened, and how do you make this fail loudly next time instead of silently?`,
    thinking: `pd.merge doesn't care whether your join key is unique on either side by default -- it just does whatever many-to-many cartesian expansion the keys imply. If the reference table secretly has duplicate ticker rows (a stale re-listing, a vendor's ticker recycled across two entities, a header row read in twice), every price row matching that ticker gets multiplied by however many reference rows share the key. Nothing errors: you get a bigger DataFrame with each price duplicated 2x or 3x, and any downstream P&L or notional sum silently inflates by that same factor. The fix that catches this at the source rather than downstream: pass validate=... to merge, e.g. validate="many_to_one" when you expect the right side unique per key. It raises a MergeError immediately if that assumption is violated, instead of letting a silently duplicated frame propagate into a wrong Sharpe ratio three steps later.`,
    answer: `merge() has no obligation to warn you about duplicate keys -- if the reference table has repeated tickers, every matching price row gets multiplied out for each duplicate, silently inflating row count and any downstream sum. Pass validate="many_to_one" (or "one_to_one", "one_to_many" depending on the expected shape) to merge -- pandas checks key uniqueness on the relevant side(s) and raises a MergeError immediately if violated, turning a silent data-quality bug into a loud one at the point of the merge.`,
    python: `import pandas as pd

prices = pd.DataFrame({
    "ticker": ["AAPL", "AAPL", "MSFT", "MSFT"],
    "date": pd.to_datetime(["2026-08-17", "2026-08-18"] * 2),
    "close": [227.1, 228.4, 412.0, 414.5],
})

# bug: a stale re-listing left two reference rows for AAPL
ref = pd.DataFrame({
    "ticker": ["AAPL", "AAPL", "MSFT"],
    "sector": ["Tech", "Tech", "Tech"],
})

# validate= raises instead of silently duplicating every AAPL price row
try:
    merged = prices.merge(ref, on="ticker", validate="many_to_one")
except pd.errors.MergeError as exc:
    print("caught bad reference data before it touched P&L:", exc)

# after dedup, the same merge passes cleanly
ref_clean = ref.drop_duplicates(subset="ticker")
merged = prices.merge(ref_clean, on="ticker", validate="many_to_one")`,
    trap: `Trusting a shape check (len(merged) == len(prices)) to catch this after the fact. It only works if you remember to add it every single merge -- validate= makes the check structural and impossible to forget, and it fires before the bad frame is ever used.`,
    followUp: `What's the equivalent guard when you expect BOTH sides to have unique keys, like joining two reference tables together? (validate="one_to_one" -- raises if either side has duplicate keys.)`,
  },
];
