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
  {
    id: "qr-data-20260819-combine-first",
    module: "data",
    title: "combine_first vs fillna for patching gaps from a secondary source",
    difficulty: "core",
    question: `You have a primary vendor's price series with occasional missing days, and a secondary vendor's series that covers most of the same gaps but isn't a strict superset. A teammate writes primary.fillna(secondary) to patch the gaps. Does that work, and how is combine_first different?`,
    thinking: `fillna accepts another aligned object and fills NaNs from it, so primary.fillna(secondary) does work for the simple case -- it fills matching NaN cells. But look closely at what it does NOT do: fillna never changes the caller's index. If secondary has a date primary is entirely missing (not NaN, just absent as a row), that date is silently dropped, because fillna only ever fills cells that already exist in primary's own index. combine_first does two things at once: it unions both indexes first, THEN fills primary's gaps from secondary wherever primary is missing -- so dates only present in the secondary source survive too. The question to ask before picking one: does the secondary vendor ever cover a session primary's index doesn't have at all, not just a NaN cell within it? If yes, fillna quietly throws that day away with no error.`,
    answer: `fillna(other) fills NaN cells using aligned values from other, but the output index never grows beyond primary's original index -- any date secondary has that primary lacks entirely just disappears, no warning. combine_first unions both indexes first, then fills primary's gaps from secondary, so dates only present in the secondary source survive too. Use combine_first whenever the secondary vendor might cover sessions off primary's own calendar; fillna is only equivalent when you already know primary's index spans every legitimate day.`,
    python: `import pandas as pd
import numpy as np

# primary has a NaN gap on 08-04 AND is simply missing 08-06 (no row at all)
primary = pd.Series(
    [101.2, np.nan, 103.5],
    index=pd.to_datetime(["2026-08-03", "2026-08-04", "2026-08-05"]),
)
secondary = pd.Series(
    [101.1, 102.0, 103.6, 104.0],
    index=pd.to_datetime(["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06"]),
)

# fillna: fills the NaN cell, but the output index stays primary's original --
# 2026-08-06 from secondary is dropped, no warning
patched_fillna = primary.fillna(secondary)

# combine_first: unions the indexes FIRST, then fills gaps from secondary --
# 2026-08-06 survives, and 08-04's NaN is patched the same way
patched_combine = primary.combine_first(secondary)

assert len(patched_fillna) == 3      # 08-06 never made it in
assert len(patched_combine) == 4     # 08-06 survived the union`,
    trap: `Assuming fillna(secondary) is "safe" just because it ran without error and filled some NaNs. If secondary has a whole extra trading day primary's index never had -- primary's own vendor missed a session entirely, not merely returned NaN for it -- that day vanishes silently, unlike combine_first which surfaces it by construction.`,
    followUp: `What if you want the opposite priority sometimes -- secondary's value should win over primary's on days you know primary is unreliable? (combine_first always prefers self over other with no exceptions; for selective override by day you need an explicit mask/where, not combine_first's fixed precedence.)`,
  },
  {
    id: "qr-data-20260820-arrow-string-dtype",
    module: "data",
    title: "Arrow-backed strings: string[pyarrow] vs object vs categorical",
    difficulty: "warmup",
    question: `You are loading a table with a free-text trade-note column -- almost every value is unique (broker references, manual override tickets), so it never repeats the way a ticker column does. Profiling shows this object-dtype column dominates memory and string-method runtime. A teammate suggests dtype="string[pyarrow]" rather than converting it to categorical. What does the pyarrow-backed string dtype change under the hood, and why is categorical the wrong tool here specifically?`,
    thinking: `Recall why categorical works so well for tickers: it stores each unique value ONCE plus a small integer code per row, and that only pays off when values repeat heavily. Here almost every note is unique, so the categories dictionary ends up nearly as large as the column itself -- all of categorical's bookkeeping overhead, none of its compression benefit. Object dtype's problem is different: it is an array of pointers to individually heap-allocated Python string objects, each carrying 50-plus bytes of interpreter overhead and scattered across memory with poor cache locality, and every str method loops through them one Python object at a time. A pyarrow-backed string column instead stores all the text in one contiguous columnar buffer with an offsets array marking where each string starts and ends -- the same layout analytic engines use -- so it shrinks memory even when nothing repeats, and vectorized string operations run as compiled Arrow kernels over that buffer instead of a Python-level loop over boxed objects.`,
    answer: `Categorical only helps when values repeat, storing each unique string once plus an integer code per row -- with near-unique free text, the categories dictionary is almost as large as the data, so it buys nothing. pyarrow-backed strings fix a different problem: instead of an array of pointers to separately heap-allocated Python string objects (object dtype), they store all the text in one contiguous columnar buffer with offsets, which is smaller even for unique-heavy columns and lets string methods run as compiled Arrow kernels rather than a Python loop over boxed objects. Use categorical for genuinely repetitive columns, pyarrow strings as the better default for everything else text-like.`,
    python: `import pandas as pd

# high-cardinality, low-repetition text -- a free-text note or unique
# reference, NOT a ticker (tickers repeat heavily over history, so
# categorical wins there -- see the earlier categorical-dtype card;
# this column does not repeat, which is the whole point of this example)
notes = pd.Series(
    ["settled via broker A, ref 88213", "manual override, ticket 4471"] * 500_000
)

obj_mem = notes.astype(object).memory_usage(deep=True)
arrow_mem = notes.astype("string[pyarrow]").memory_usage(deep=True)
cat_mem = notes.astype("category").memory_usage(deep=True)

print(obj_mem, arrow_mem, cat_mem)
# arrow_mem is meaningfully smaller than obj_mem: one contiguous buffer,
# no per-string python object overhead. cat_mem barely helps here since
# almost every value is unique -- the categories dictionary ends up
# nearly the size of the data itself: all cost, no compression benefit

# vectorized string ops run as compiled arrow kernels, not a python loop
# over individual boxed string objects:
flagged = notes.astype("string[pyarrow]").str.contains("override")`,
    trap: `Reflexively converting every object-dtype string column to categorical as a memory fix, without checking cardinality first. On a near-unique column that adds the categories-dictionary overhead on top of the original strings with no compensating win -- check nunique() relative to len() before choosing between categorical and pyarrow-backed strings.`,
    followUp: `Your ticker column DOES repeat heavily (thousands of rows per ticker over a decade). Would you reach for string[pyarrow] there instead of categorical? (No -- categorical's integer-code compression still wins on genuinely repetitive columns; pyarrow strings are the better default specifically for the unique-ish, free-text columns where categorical's dictionary trick doesn't pay off.)`,
  },
  {
    id: "qr-data-20260821-copy-on-write",
    module: "data",
    title: "Copy-on-Write: pandas 2.x changes view vs copy rules",
    difficulty: "core",
    question: `You upgrade a research pipeline to a pandas version with Copy-on-Write enabled by default. A function that used to mutate a slice and have that silently NOT touch the caller's frame still behaves the same way -- but a different old pattern, one that relied on a returned slice sharing memory with its source so a mutation would propagate back, now quietly stops working. What does Copy-on-Write actually change, and what discipline does it reward?`,
    thinking: `Recall the old world: whether df[mask] or df.loc[...] returned a view or a copy was an implementation detail decided by memory layout, which is exactly why SettingWithCopyWarning existed -- pandas could not promise you which one you got, so it warned when it detected a chained mutation on ambiguous ownership. Copy-on-Write resolves the ambiguity by rule rather than by warning: every derived object -- a slice, a filtered subset, a column selection -- starts out SHARING the underlying memory buffer with its parent, but the moment any code writes to either the parent or the derived object, pandas transparently copies the affected block first, so a write can never leak sideways into an object you did not touch. Mechanically this means chained indexing simply cannot silently mutate the original anymore -- it becomes a clean no-op on a copy, which is the correct failure mode, not a silent one -- and code that RELIED on view semantics to propagate a mutation back into a caller's frame breaks, because that reliance was always an accident of memory layout, never a documented contract.`,
    answer: `Copy-on-Write makes every DataFrame derived from another behave as if independent from the moment either object is mutated, by triggering a real copy lazily on the first write rather than deciding view-vs-copy up front from memory layout. Chained indexing no longer risks silently mutating the original -- it deterministically does nothing to the original, matching what .loc-based code already did by best practice. The discipline it rewards: never write code that depends on a returned slice sharing memory with its source; if the caller's frame should change, return the modified frame or mutate the original directly via .loc.`,
    python: `import pandas as pd
pd.set_option("mode.copy_on_write", True)

df = pd.DataFrame({"ticker": ["AAPL", "MSFT"], "close": [190.0, 410.0]})

# a "derived" object shares memory with df until either side is written to
sub = df[df["ticker"] == "AAPL"]

# this write triggers a copy internally -- sub becomes independent, df is
# left completely untouched (no warning needed: the old ambiguity is gone)
sub.loc[:, "close"] = 999.0
print(df.loc[df["ticker"] == "AAPL", "close"].item())   # still 190.0

# the pattern that quietly breaks under CoW: a helper that mutates a slice
# and expects the caller's original frame to see the change
def flag_expensive(frame: pd.DataFrame, cutoff: float) -> None:
    expensive = frame[frame["close"] > cutoff]
    expensive["flag"] = True          # mutates a copy, caller sees nothing

flag_expensive(df, 300.0)
assert "flag" not in df.columns       # the old view-based trick no longer works

# correct pattern: return the modified frame, or mutate via .loc directly
# on the object you actually want changed
df.loc[df["close"] > 300.0, "flag"] = True`,
    trap: `Relying on chained indexing to mutate a caller's frame as a shortcut, verified once on an old pandas version and never revisited. Under Copy-on-Write it degrades from an unreliable warning-emitting bug into a completely silent no-op -- safer for the caller, but code that depended on the old accidental behavior fails with no error message, just data that mysteriously never updated.`,
    followUp: `Does object garbage-collection timing affect whether a later write to df triggers an unnecessary copy? (No -- Copy-on-Write tracks a reference count on the underlying data block, not on Python object lifetime; the block is copied on the first write while any reference to it still exists, so the copy trigger is deterministic and independent of when Python happens to free the derived object.)`,
  },
  {
    id: "qr-data-20260822-low-memory-dtype-guessing",
    module: "data",
    title: "read_csv's chunked dtype guessing (low_memory)",
    difficulty: "warmup",
    question: `You load a 3 GB CSV with pd.read_csv and pandas raises DtypeWarning: Columns (7) have mixed types. You silence it by passing low_memory=False and move on. What was actually happening, and did that fix the problem or hide it?`,
    thinking: `The default low_memory=True parses the file in chunks and infers each column's dtype chunk by chunk, purely to save memory during parsing. If column 7 looks numeric in the early chunks but a later chunk has a stray string in it, pandas already committed to a numeric guess for the earlier chunks and has to reconcile the mismatch -- that reconciliation is exactly the warning, and the column usually still ends up object dtype with genuinely mixed values inside it. low_memory=False reads the whole file before guessing, so pandas makes one consistent inference and the warning goes away -- but that only changes HOW the guess is made, not what data is actually in the file. The messy values are still there, now silently absorbed with no complaint. A warning about data is a data-quality signal, and the fix is to go look at what is actually in that column, not to suppress the mechanism that surfaced it.`,
    answer: `low_memory=True infers dtype chunk by chunk, so a column that looks numeric early and has a stray string later triggers the warning when chunks disagree. low_memory=False reads the whole file first and makes one consistent guess, so the warning disappears -- but the same mixed values are still there, just silently coerced into one dtype (usually object) with no complaint. The real fix is passing explicit dtype= (or loading with dtype=str first to inspect) and finding what the stray values actually are.`,
    python: `import pandas as pd

# small demo: a column that's numeric for a while, then has a stray value
csv_text = "id,volume\\n1,1000\\n2,2000\\n3,N/A\\n4,4000\\n"
from io import StringIO

# default low_memory=True can warn on a real file this size; on a tiny
# demo it will not, but the underlying issue is identical either way
df = pd.read_csv(StringIO(csv_text))
print(df["volume"].dtype)   # object -- "N/A" forced the whole column off numeric

# WRONG instinct: just pass low_memory=False and stop looking
df_quiet = pd.read_csv(StringIO(csv_text), low_memory=False)
print(df_quiet["volume"].dtype)   # still object -- the warning is gone, the bug is not

# RIGHT: find and handle the actual mixed values
bad = pd.to_numeric(df["volume"], errors="coerce").isna() & df["volume"].notna()
print(df.loc[bad])   # inspect "N/A" before deciding to coerce or drop

df["volume"] = pd.to_numeric(df["volume"], errors="coerce")`,
    trap: `Treating low_memory=False as the fix and never looking at column 7 again. The mixed values are now silently coerced into one dtype, and if they were meaningful -- a fat-fingered numeric value formatted as text, a stray unit label -- they corrupt downstream numeric operations with no second warning to catch it.`,
  },
  {
    id: "qr-data-20260823-na-nan-none",
    module: "data",
    title: "pd.NA vs np.nan vs None: three missing-value sentinels",
    difficulty: "warmup",
    question: `A DataFrame column ends up with pd.NA in some rows, np.nan in others (depending on which upstream pipeline touched it), and a stray None slipped in from a raw JSON load. A teammate asks: are these the same missing value under the hood, and does it matter which one shows up in a numeric column?`,
    thinking: `np.nan is a real IEEE-754 float value -- it lives inside a float64 array, propagates through arithmetic (1 + nan is nan), and famously fails self-equality (nan == nan is False), which is exactly why you check isna() instead of ==. pd.NA is pandas' own sentinel built for the newer nullable extension dtypes (Int64, boolean, string) that don't have a native "NaN" the way float64 does -- an integer column can't hold NaN without silently upcasting to float, so Int64 uses pd.NA instead. pd.NA also implements proper three-valued logic: pd.NA == pd.NA returns pd.NA, not True or False, because "is an unknown value equal to another unknown value" genuinely has no answer. None is just a generic Python object with no numeric meaning at all; in an object-dtype column it sits there until something coerces it, and in a numeric-dtype column pandas usually converts it to NaN on the way in. The practical risk: mixing sentinels across a pipeline can leave a column silently object-dtype instead of numeric, which breaks vectorized math with no error, just wrong or NaN results everywhere.`,
    answer: `They're three different objects: np.nan is a float64 NaN that propagates through arithmetic and fails self-equality; pd.NA is pandas' sentinel for nullable extension dtypes (Int64, boolean, string) with three-valued logic where NA == NA is NA, not True; None is a generic Python object that pandas usually coerces to NaN in numeric columns but leaves alone in object columns. Always test with isna()/notna(), never with ==, and check dtype after any operation that could have introduced a stray None or mixed sentinel.`,
    python: `import pandas as pd
import numpy as np

# three sentinels landing in the same conceptual column
s_float = pd.Series([1.0, np.nan, 3.0])             # float64, np.nan
s_nullable = pd.Series([1, pd.NA, 3], dtype="Int64") # nullable Int64, pd.NA
s_object = pd.Series([1, None, 3])                   # plain int column with a hole

print(s_float.dtype, s_nullable.dtype, s_object.dtype)
# float64, Int64, float64 -- None forced an UPCAST to float64 to hold NaN,
# since plain int64 has no missing-value representation at all
# (s_object would stay object dtype if any entry were a non-numeric type)

# self-equality behaves differently -- this is why == for missingness is a bug
print(np.nan == np.nan)   # False
print(pd.NA == pd.NA)     # <NA> -- neither True nor False, three-valued logic

# the only safe check across all three sentinel types
for s in (s_float, s_nullable, s_object):
    print(s.isna().tolist())`,
    trap: `Writing df[df["col"] == np.nan] to filter missing values -- it silently returns zero rows every time, no error, because nan never equals anything including itself. The same instinct with pd.NA is even more insidious: comparisons involving pd.NA propagate NA through boolean masks instead of raising, so a downstream .loc[mask] can silently drop or keep rows in ways that look plausible but aren't what was intended.`,
  },
  {
    id: "qr-data-20260824-frame-equality",
    module: "data",
    title: "Checking two DataFrames for equality: == vs .equals() vs assert_frame_equal",
    difficulty: "warmup",
    question: `You refactor a data-loading pipeline and want to prove the new code produces the exact same price panel as the old one before deleting the old path. A teammate proposes (new_df == old_df).all().all(). Why is that check unreliable here, and what should you use instead?`,
    thinking: `Think about what == actually does cell by cell before trusting the aggregate. Two NaNs never compare equal to each other -- NaN == NaN is False by the IEEE spec -- so any row where both frames legitimately share a missing price makes that whole reduction False even though the frames agree. == also requires identical shape and index to align cleanly; a silently reordered or reindexed frame either misaligns before comparing or raises. And it says nothing about dtype: an int64 column full of 5 next to an Int64 column full of 5 compares equal elementwise while being a real, worth-knowing difference if downstream code branches on dtype. What you actually want is a comparison built for this: DataFrame.equals treats same-position NaNs as equal and checks dtype, or pandas.testing.assert_frame_equal for an assertion with tunable float tolerance.`,
    answer: `(new_df == old_df).all().all() is wrong wherever both frames share a NaN, since NaN never equals NaN, so a perfectly matching row can register as unequal. Use DataFrame.equals(), which treats co-located NaNs as equal and also checks dtype; or, for a test with floating-point tolerance, pandas.testing.assert_frame_equal(a, b, check_dtype=..., rtol=..., atol=...), which gives you a readable diff on failure instead of a single boolean.`,
    python: `import pandas as pd
import numpy as np

old = pd.DataFrame({"close": [185.6, np.nan, 92.1]})
new = pd.DataFrame({"close": [185.6, np.nan, 92.1]})

# WRONG: NaN == NaN is False, so a row both frames agree is missing
# still reads as a mismatch once you .all() the boolean frame
print((new == old).all().all())          # False, even though rows genuinely match

# RIGHT: .equals() treats co-located NaNs as equal AND checks dtype
print(new.equals(old))                   # True

# for a unit test, assert_frame_equal gives a readable diff on failure
# and lets you tolerate float rounding instead of demanding bit-for-bit equality
from pandas.testing import assert_frame_equal
assert_frame_equal(new, old, rtol=1e-8, atol=0.0)`,
    trap: `Trusting a passing (a == b).all().all() as proof two panels are identical purely because the test data set didn't happen to include any missing values -- the moment a future run introduces even one legitimate NaN, the check starts failing on rows that actually match, and the failure looks like a data bug instead of a broken test.`,
    followUp: `assert_frame_equal defaults to checking column order and dtype exactly. What argument would you relax first if the new pipeline is correct but happens to emit columns in a different order or read a column back as float64 instead of Int64?`,
  },
  {
    id: "qr-data-20260825-explode-list-column",
    module: "data",
    title: "Exploding a list-valued column",
    difficulty: "warmup",
    question: `Your feed has one row per (date, ticker) with a "flags" column that's a Python list, like ["late_print", "odd_lot"] -- empty list if nothing was flagged that day. You want one row per (date, ticker, flag) so you can group by flag type and count occurrences. What operation gets you there, and what happens to the rows that had an empty list?`,
    thinking: `Reach for explode(), which is built for exactly this: it takes a list-like column and produces one row per element, replicating every other column's value across the new rows. Before running it, ask what an empty list becomes -- and the answer is not "zero rows." explode() treats an empty list the same way it treats a scalar NaN: it produces exactly one output row with NaN in that column, because dropping the observation entirely would erase the fact that this (date, ticker) pair was checked and found clean, a real and useful state to keep. That matters for what comes right after: a plain groupby("flags") on the exploded frame drops NaN groups by default, so those "checked, no flags" rows quietly vanish from any count unless you ask groupby to keep them. Also check upstream whether "flags" arrived as a real list or as a delimited string like "late_print,odd_lot" that needs a split first.`,
    answer: `Use explode() on the list column -- it fans each row out to one row per list element, copying the other columns along. A row with an empty list does not disappear; explode() turns it into exactly one row with NaN in the flags column, preserving "this pair was checked, nothing was flagged" as its own state. If you then groupby("flags") to count occurrences, remember groupby drops NaN groups by default, so pass dropna=False if you want "no flag" counted as a category too.`,
    python: `import pandas as pd

df = pd.DataFrame({
    "date":   ["2026-08-24", "2026-08-24", "2026-08-25"],
    "ticker": ["AAPL", "MSFT", "AAPL"],
    "flags":  [["late_print", "odd_lot"], [], ["odd_lot"]],
})

# one row per (date, ticker, flag); empty list becomes one NaN row, not zero rows
long = df.explode("flags")
print(len(long))   # 4: 2 + 1 (NaN for MSFT's empty list) + 1

# plain groupby drops the NaN "no flags" rows by default -- silently
# undercounts how many pairs were checked and came back clean
counts_wrong = long.groupby("flags").size()

# dropna=False keeps NaN as its own category
counts_right = long.groupby("flags", dropna=False).size()

# if flags arrived as "late_print,odd_lot" strings instead of real lists,
# split first -- explode only works on actual list-like cells
raw = pd.Series(["late_print,odd_lot", "", "odd_lot"])
as_lists = raw.str.split(",").apply(lambda parts: [p for p in parts if p])`,
    trap: `Assuming rows with an empty list vanish after explode(), then being surprised that groupby("flags").size() undercounts "no flags" pairs. They don't vanish -- they become one NaN row -- but a default groupby silently drops NaN groups, so the undercount happens one step later than where you'd naturally look for it.`,
  },
  {
    id: "qr-data-20260826-sparse-dtype-factor-exposures",
    module: "data",
    title: "Sparse dtypes for mostly-zero factor exposure matrices",
    difficulty: "core",
    question: `You've built a factor-exposure matrix for 3000 stocks against 200 industry/country dummy factors -- each stock loads on exactly one industry and one country, so the matrix is more than 99% zeros. Loading it as a normal float64 DataFrame eats tens of gigabytes and makes every downstream regression slow. What do you do differently, and what's the catch?`,
    thinking: `Recognize that the dense representation stores the same overwhelmingly-zero information over and over: each row of a one-hot industry/country dummy has one 1.0 and hundreds of true zeros, so the real entropy per row is a handful of bits, not 200 floats. pandas' sparse dtype family (SparseArray/SparseDtype), or dropping to scipy.sparse for the regression step, stores only the non-zero positions and values, so memory scales with the number of ACTUAL exposures rather than the theoretical dense shape -- often two to three orders of magnitude smaller here. The catch: sparsity is fragile. Any dense elementwise operation that turns zeros into non-zeros (adding a small constant, most rolling operations) silently densifies the array back to full size, and several pandas/sklearn code paths convert to dense internally without warning -- so you have to verify sparsity survives the actual pipeline end to end, not just the initial load.`,
    answer: `Use a sparse representation -- pandas SparseArray/SparseDtype for storage or scipy.sparse for the regression step -- because a one-hot industry/country dummy matrix is over 99% structural zeros, so memory scales with actual non-zero exposures instead of the full dense shape, often 100x+ smaller. The catch: sparsity is fragile -- any dense elementwise op that turns zeros into non-zeros (adding a constant, most rolling operations) silently densifies the array back to full size, and several pandas/sklearn code paths convert to dense internally without warning, so you have to verify sparsity survives the actual pipeline, not just the initial load.`,
    python: `import numpy as np
import pandas as pd

n_stocks, n_factors = 3000, 200
rng = np.random.default_rng(0)
industry = rng.integers(0, n_factors, n_stocks)

# dense one-hot: n_stocks x n_factors floats, >99% zero
dense = pd.get_dummies(pd.Series(industry), dtype=float)
print("dense memory (MB):", dense.memory_usage(deep=True).sum() / 1e6)

# sparse: same values, only non-zero positions stored
sparse = dense.astype(pd.SparseDtype("float64", fill_value=0.0))
print("sparse memory (MB):", sparse.memory_usage(deep=True).sum() / 1e6)

# danger: an elementwise op that touches every zero destroys sparsity
densified_again = sparse + 1e-9
print("still sparse after +1e-9:",
      isinstance(densified_again.dtypes.iloc[0], pd.SparseDtype))`,
    trap: `Assuming sparsity holds through the whole pipeline once you've converted at load time. A later .fillna(), a broadcasted addition, or passing the frame into a library that doesn't know about SparseDtype densifies it back to full size -- often exactly at the regression step where memory was the whole point of going sparse.`,
    followUp: `Your factor-exposure matrix is sparse, but the covariance matrix you compute from it (via loadings @ factor_cov @ loadings.T) is fully dense even though each individual loadings row is sparse. Why, and does that undermine the memory win?`,
  },
  {
    id: "qr-data-20260827-to-numeric-coerce",
    module: "data",
    title: "to_numeric(errors='coerce') vs astype for a dirty numeric column",
    difficulty: "warmup",
    question: `A vendor's "shares_outstanding" column arrives as strings, and a few rows contain garbage like "N/A" or comma-formatted numbers like "1,234,000". You need it as float64. Why does df["shares_outstanding"].astype(float) blow up, and what's the safer way to coerce it?`,
    thinking: `astype(float) demands every value parse cleanly as a float right now -- one "N/A" or one comma-formatted string and the whole column conversion raises, which is a fine failure mode if you want to catch dirty data but useless if you actually need the column converted. pd.to_numeric(..., errors="coerce") instead tries to parse each value and turns anything it can't parse into NaN rather than raising, so the column always comes back as float64 and you can inspect exactly which rows failed by checking where the result is NaN and the original wasn't already missing. The comma-formatted numbers need one extra step first, since to_numeric doesn't strip thousands separators on its own -- a plain string replace before parsing. The real discipline is never silently accepting the NaNs to_numeric produces without counting them, since a coercion failure on 40% of rows is a pipeline bug, not a data quirk.`,
    answer: `astype(float) requires every entry to parse cleanly and raises on the first one that doesn't, which is unusable on messy vendor data. Use pd.to_numeric(col, errors="coerce"), which converts what it can and turns unparseable entries into NaN instead of raising; strip thousands-separator commas first since to_numeric won't handle that itself. Always count the newly introduced NaNs against the original non-null count -- a large coercion failure rate means a parsing bug, not dirty-but-ignorable data.`,
    python: `import pandas as pd

raw = pd.Series(["1,234,000", "890000", "N/A", "2,000,000", None])

# astype(float) raises immediately on "1,234,000" (comma) and "N/A"
# raw.astype(float)  # ValueError

# strip thousands separators first -- to_numeric doesn't handle commas
cleaned = raw.str.replace(",", "", regex=False)

# errors="coerce": parse what you can, NaN what you can't, never raise
parsed = pd.to_numeric(cleaned, errors="coerce")

# count how many NEW NaNs coercion introduced vs how many were already missing
already_missing = raw.isna().sum()
newly_failed = parsed.isna().sum() - already_missing
print("coercion failures beyond pre-existing NaNs:", newly_failed)  # 1 ("N/A")`,
    trap: `Treating errors="coerce" as a silent cleanup step and moving on without checking how many values it NaN'd out. A schema change upstream -- a new "N/A" sentinel, a currency symbol added to the string -- passes through coerce silently converting every row to NaN, and the pipeline keeps running on an empty column with no error raised anywhere.`,
    followUp: `The same column later starts arriving with a trailing "M" suffix for millions, like "1.2M", from a vendor format change. Does to_numeric(errors="coerce") catch this case, and what would your monitoring need to flag before it silently NaNs out the whole column?`,
  },
  {
    id: "qr-data-20260828-merge-indicator",
    module: "data",
    title: "merge()'s indicator=True: auditing join coverage instead of eyeballing NaNs",
    difficulty: "warmup",
    question: `You're left-merging your daily price panel with a fundamentals table on (ticker, date), and you want to verify that every price row actually found a fundamentals match before trusting the merged frame. What single argument turns that check into something you can groupby, instead of eyeballing NaNs after the fact?`,
    thinking: `Counting NaNs in the merged fundamentals columns after the fact is ambiguous -- a genuinely missing fundamental value (the company just didn't report one) looks identical to a join that silently failed to match at all, for example because one side's date column is a string and the other is a real datetime, so nothing matches and every row is NaN for a completely different reason. pandas' merge(indicator=True) appends a categorical column, conventionally named "_merge", tagging each output row as left_only, right_only, or both, which turns "did the join work" from a guess into a groupby you can run and alert on immediately. It's cheap enough to leave on by default during development and strip before shipping the pipeline.`,
    answer: `Pass indicator=True to merge(). pandas appends a categorical "_merge" column with values left_only, right_only, and both, so groupby("_merge").size() tells you exactly how many rows matched -- catching, for instance, a dtype mismatch that silently zeroes out the whole join, which just counting NaNs in the result can't distinguish from data that's legitimately missing.`,
    python: `import pandas as pd

prices = pd.DataFrame({
    "ticker": ["AAPL", "AAPL", "MSFT"],
    "date": pd.to_datetime(["2026-01-02", "2026-01-03", "2026-01-02"]),
    "close": [190.1, 191.3, 402.5],
})
fundamentals = pd.DataFrame({
    "ticker": ["AAPL", "MSFT"],
    "date": pd.to_datetime(["2026-01-02", "2026-01-05"]),  # MSFT date won't match
    "pe_ratio": [31.2, 34.8],
})

merged = prices.merge(fundamentals, on=["ticker", "date"], how="left", indicator=True)

# groupby the audit column instead of guessing from NaN counts
coverage = merged["_merge"].value_counts()
print(coverage)
# both        1   -> AAPL 2026-01-02 matched
# left_only   2   -> AAPL 2026-01-03 and MSFT 2026-01-02 found no fundamentals row

unmatched = merged.loc[merged["_merge"] == "left_only", ["ticker", "date"]]
print(unmatched)  # exactly which price rows to investigate`,
    trap: `Relying on isna().sum() on the fundamentals columns alone. If a dtype mismatch causes the ENTIRE join to match nothing, every row is left_only and every fundamentals column is NaN -- which looks superficially like "lots of missing fundamentals data" rather than "the join is completely broken," and the fix (cast one side's date column) never gets made because the symptom was misdiagnosed.`,
    followUp: `You need to chain three merges in sequence (prices with fundamentals, then with sector data, then with index membership), and each merge() call with indicator=True wants to reuse the column name "_merge", which collides on the second call. How do you preserve per-merge audit info through the whole chain?`,
  },
  {
    id: "qr-data-20260829-duplicated-keep",
    module: "data",
    title: "duplicated(keep=...): choosing which duplicate row survives",
    difficulty: "warmup",
    question: `Your vendor's daily price file occasionally has two rows for the same (ticker, date) -- a preliminary print and a corrected print a few minutes later, both timestamped in a load_time column. You want to drop the duplicates and keep only the corrected version. What's the one-line fix, and what's the trap if you get the keep argument backwards?`,
    thinking: `pandas.drop_duplicates() defaults to keep="first", which silently keeps whichever row happened to sort first in the file -- not necessarily the economically correct one. The actual intent here is "keep the row with the latest load_time," which means the DataFrame first has to be sorted by load_time (ascending) so that the corrected row lands last for each (ticker, date) group, and then keep="last" picks it. Getting keep="first" instead of keep="last" here doesn't error -- it just silently keeps every preliminary, pre-correction price, which is exactly the kind of bug that only surfaces months later when someone diffs the pipeline's output against the vendor's own corrected history.`,
    answer: `Sort by load_time ascending, then call drop_duplicates(subset=["ticker","date"], keep="last") so the most recently loaded row for each key survives. keep="first" would silently keep the preliminary print instead of the correction -- no error, just a wrong number sitting in the pipeline until someone notices it disagrees with the vendor's own corrected history.`,
    python: `import pandas as pd

df = pd.DataFrame({
    "ticker": ["AAPL", "AAPL", "MSFT"],
    "date": pd.to_datetime(["2026-08-28", "2026-08-28", "2026-08-28"]),
    "close": [190.10, 190.35, 402.50],   # AAPL row 2 is the corrected print
    "load_time": pd.to_datetime([
        "2026-08-28 16:05:00", "2026-08-28 16:22:00", "2026-08-28 16:05:00",
    ]),
})

# sort so the LATEST load for each key ends up last, then keep it
clean = (
    df.sort_values("load_time")
      .drop_duplicates(subset=["ticker", "date"], keep="last")
      .reset_index(drop=True)
)
print(clean[["ticker", "date", "close"]])
# AAPL close is 190.35 -- the correction, not the preliminary 190.10`,
    trap: `Calling drop_duplicates(keep="first") without sorting by load_time first -- since the vendor file's own row order isn't guaranteed to match arrival order, "first" can just as easily mean the preliminary print as the correction, and nothing about the code signals which one you actually got.`,
    followUp: `The vendor sometimes sends three versions of the same row (preliminary, one correction, then a final correction). How would you check, before dropping anything, whether your assumption "later load_time is always more correct" actually holds for this feed?`,
  },
  {
    id: "qr-data-20260830-na-nan-none",
    module: "data",
    title: "pd.NA vs np.nan vs None: three missing-value markers",
    difficulty: "core",
    question: `You're cleaning a mixed-type DataFrame -- a float column, an integer column stored as nullable Int64, and an object column of strings -- and you notice missing values print differently in each: NaN, <NA>, and None. A teammate asks whether these are the same thing and whether df.isna() catches all three. What do you tell them?`,
    thinking: `pandas actually has three missing-value sentinels, and they are not interchangeable under the hood, even though isna() treats them uniformly for you. np.nan is a genuine IEEE-754 float value -- it only really "fits" inside float64 columns, and it has the famous property that nan != nan, so equality checks silently fail where you'd expect them to succeed. None is a plain Python object, sitting in object-dtype columns as an actual sentinel; comparisons work more intuitively (None == None is True) but it can't live in a numeric array without pandas either upcasting the column to object or converting None to NaN. pd.NA is pandas' newer, dtype-agnostic missing marker used by the nullable extension types (Int64, boolean, string) -- it propagates through comparisons as proper three-valued-logic NA rather than silently being False or True, closer to SQL NULL. The practical answer: isna() correctly flags all three, but which one you get depends on the column's dtype, and mixing an operation that assumes float NaN semantics against an Int64 column full of pd.NA can behave unexpectedly.`,
    answer: `They're three distinct missing markers, not synonyms: np.nan is a float64 IEEE value living in float columns, None is a Python object living in object-dtype columns, and pd.NA is pandas' dtype-agnostic marker used by the newer nullable extension types (Int64, boolean, string) with proper three-valued-logic propagation. isna() detects all three uniformly, but which one actually appears in a column depends entirely on that column's dtype, and code that assumes float NaN behavior (like nan != nan) can break silently against a column carrying pd.NA instead.`,
    python: `import pandas as pd
import numpy as np

df = pd.DataFrame({
    "price": [185.6, np.nan, 190.1],        # float64 column -> np.nan
    "shares": pd.array([100, None, 300], dtype="Int64"),  # nullable int -> pd.NA
    "ticker": ["AAPL", None, "MSFT"],       # object column -> None (not upcast)
})

print(df.dtypes.tolist())
print([type(df["price"][1]), type(df["shares"][1]), type(df["ticker"][1])])
# float, pandas NAType, NoneType -- three different sentinel TYPES,
# one for each dtype

# isna() unifies them for detection purposes
print(df.isna().sum())

# but equality semantics differ: float NaN is famously not equal to itself
print(np.nan == np.nan)          # False
print(df["shares"][1] is pd.NA)  # True -- pd.NA is a singleton, safe with "is"

# mixing dtypes with fillna: filling an Int64 column with np.nan
# silently upcasts it to object dtype instead of staying nullable-int
mixed = df["shares"].fillna(np.nan)
print(mixed.dtype)   # object -- not the Int64 you probably wanted`,
    trap: `Using fillna(np.nan) or comparing == np.nan on a nullable Int64 or string column "to be safe." It silently upcasts the column to object dtype rather than raising, so downstream numeric operations degrade in performance and correctness without any warning.`,
    followUp: `Your pipeline reads a CSV with pandas' default settings into a plain int64 column, then a later day's file has a missing value in that same column. What happens to the column's dtype, and would using dtype="Int64" at read time have prevented it? (It upcasts the whole column to float64, exactly like the classic int-with-NaN card -- Int64 at read time keeps it a true nullable integer instead.)`,
  },
  {
    id: "qr-data-20260831-pipe-method-chaining",
    module: "data",
    title: "Method chaining with .pipe() for readable multi-step feature pipelines",
    difficulty: "warmup",
    question: `Your feature pipeline does five sequential steps: filter to a liquid universe, clean outliers, compute a rolling feature, cross-sectionally rank it, then merge in a sector tag. How would you structure that in pandas so a reviewer can read it top to bottom instead of hunting through six reassigned variable names?`,
    thinking: `Wrap each step in a small named function that takes a DataFrame and returns one, then chain them with .pipe() instead of the usual df2 = step_two(df1); df3 = step_three(df2) pattern. The reassignment style is error-prone in a real diff -- insert a new step in the middle and it is easy to forget to bump every reference after it, silently running steps on the wrong intermediate frame. A .pipe() chain reads like a table of contents: each line names the transformation, each function is independently testable and swappable, and reordering steps means moving one line, not renumbering variables. This is purely a readability and maintainability tool -- pandas still executes each step eagerly in order, there's no lazy evaluation or fusion happening.`,
    answer: `Wrap each step in a small named function taking a DataFrame and returning one, then chain them with .pipe(). It reads top-to-bottom like a table of contents, each step is independently testable and swappable, and you avoid the classic bug of forgetting to update a later variable reference after inserting a new step in the middle. It's a readability tool, not a performance one -- pandas still executes each step eagerly.`,
    python: `import pandas as pd

def filter_universe(df: pd.DataFrame) -> pd.DataFrame:
    return df[df["adv_usd"] > 5_000_000]          # liquid names only

def clean_outliers(df: pd.DataFrame) -> pd.DataFrame:
    lo, hi = df["ret"].quantile([0.01, 0.99])
    return df.assign(ret=df["ret"].clip(lo, hi))   # winsorize, don't drop

def add_momentum(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(["ticker", "date"])
    mom = df.groupby("ticker")["ret"].transform(lambda s: s.rolling(21).sum())
    return df.assign(mom_21d=mom)

def rank_cross_section(df: pd.DataFrame) -> pd.DataFrame:
    return df.assign(mom_rank=df.groupby("date")["mom_21d"].rank(pct=True))

def merge_sector(df: pd.DataFrame, sectors: pd.DataFrame) -> pd.DataFrame:
    return df.merge(sectors, on="ticker", how="left")

raw = pd.DataFrame({
    "date": pd.to_datetime(["2024-01-02"] * 3),
    "ticker": ["AAPL", "MSFT", "TSLA"],
    "adv_usd": [8e6, 9e6, 6e6],
    "ret": [0.01, -0.02, 0.03],
})
sectors = pd.DataFrame({"ticker": ["AAPL", "MSFT", "TSLA"], "sector": ["Tech", "Tech", "Auto"]})

# each step reads left-to-right, top-to-bottom -- a reviewer follows the
# whole pipeline without hunting for reassigned variable names
features = (
    raw
    .pipe(filter_universe)
    .pipe(clean_outliers)
    .pipe(add_momentum)
    .pipe(rank_cross_section)
    .pipe(merge_sector, sectors)
)
print(features)`,
    trap: `Reassigning intermediate variables (df1, df2, df3...) instead of chaining. Insert a new step in the middle and it's easy to forget to bump a later reference to point at the new intermediate frame -- a silent wrong-step-order bug that a .pipe() chain eliminates structurally, since there's only ever one chain to reorder.`,
  },
];
