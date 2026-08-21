import type { QRQuestion } from "./index";

// ============================================================
// M5 -- Point-in-Time Discipline: merge_asof mechanics,
// availability vs effective dates, restatements, universe
// reconstruction, lookahead detection, and the classic traps
// (bfill, centered rolling, full-sample z-score).
// 13 questions: 3 warmup / 7 core / 3 hard.
// ============================================================

export const pitQuestions: QRQuestion[] = [
  {
    id: "qr-pit-01-what-is-lookahead",
    module: "pit",
    title: "What lookahead bias does",
    difficulty: "warmup",
    question: `What is lookahead bias, and why does it INFLATE backtest performance rather than just adding noise?`,
    thinking: `Define it precisely first: lookahead bias means a simulated decision at time t uses information that was not actually available at time t. Then ask the key question -- why does this bias results UP instead of just making them random? Because future information is correlated with future returns. If your feature accidentally contains Tuesday's price and you use it to "predict" Tuesday's return, you are not adding random noise -- you are adding the answer key. Even tiny leaks compound: a signal that peeks one day ahead at a fraction of the data can double a Sharpe ratio, because genuine predictive edges in markets are tiny (correlations of 0.02-0.05), so even a weak echo of the future dwarfs them. That is why point-in-time (PIT) discipline -- reconstructing exactly what was knowable at each timestamp -- is the foundation the whole research stack sits on.`,
    answer: `Lookahead bias is using information in a simulated decision that was not available at decision time. It inflates rather than randomizes results because future data is correlated with the returns you are scoring against -- you are grading yourself with the answer key in hand. Since real edges are tiny, even a small leak dominates them, which is why impossibly high backtest Sharpes are the classic symptom.`,
    trap: `Saying "it adds noise to the backtest". Noise would be forgivable -- it averages out. Lookahead is a systematic upward bias, and it is worst exactly where it is hardest to see: subtle leaks through preprocessing steps rather than obvious ones through the signal itself.`,
    followUp: `Name three places lookahead can enter WITHOUT the signal formula referencing the future. (Full-sample normalization, backward-filled missing data, and a universe defined by today's index membership -- all covered later in this module.)`,
  },
  {
    id: "qr-pit-02-availability-vs-effective",
    module: "pit",
    title: "Availability date vs effective date",
    difficulty: "warmup",
    question: `A company's Q4 earnings cover the quarter ending December 31 but are announced on February 15. Which date do you use when joining earnings onto your daily price panel, and what are these two dates called?`,
    thinking: `Every piece of data has two timestamps and you must never confuse them. The EFFECTIVE date (or period end) is what the data is ABOUT -- December 31, the last day of the quarter being reported. The AVAILABILITY date (announcement or filing date) is when the market could first KNOW it -- February 15. For trading simulations the only date that matters for alignment is availability: on January 20 you did not know Q4 earnings, so a backtest that uses them on January 20 is trading on information from the future. Joining on the effective date is the single most common source of lookahead in fundamental strategies, and it flatters exactly the strategies that look best in interviews -- earnings-based signals appear to "predict" the announcement move because they already contain it. If the vendor only supplies effective dates, you must impose a conservative reporting lag yourself.`,
    answer: `Join on February 15, the availability date -- the first moment the market knew the numbers. December 31 is the effective date, describing what period the data covers, and joining on it lets the backtest trade six weeks before the information existed. Rule: effective date describes the data, availability date aligns the data.`,
    python: `import pandas as pd

# earnings: one row per (ticker, fiscal quarter), with BOTH dates.
#   period_end  = effective date (what the data is about)
#   ann_date    = availability date (when the market learned it)
# prices: daily panel with (date, ticker).

# merge_asof: for each price row, grab the most recent earnings
# row whose ann_date is AT OR BEFORE the price date. Both frames
# must be sorted by the 'on' key -- merge_asof requires it.
earnings = earnings.sort_values('ann_date')
prices = prices.sort_values('date')

panel = pd.merge_asof(
    prices,
    earnings[['ann_date', 'ticker', 'eps']],
    left_on='date',
    right_on='ann_date',   # availability date -- NEVER period_end
    by='ticker',           # match within each ticker separately
    direction='backward',  # only look into the past
)

# Result: on Jan 20 the row carries Q3 eps (announced last
# fall). Q4 eps first appears on Feb 15 -- exactly like live.`,
    trap: `Joining on period_end "because that is the date column the vendor put first". Vendors routinely ship fundamentals keyed by fiscal period; the availability date may be a secondary column or missing entirely. If it is missing, you must add a conservative lag -- not shrug and use period end.`,
    followUp: `The announcement hits at 4:30pm on February 15, after the close. Is February 15 still the right availability date for a close-to-close backtest? (No -- first tradable close is February 16; timestamp granularity matters.)`,
  },
  {
    id: "qr-pit-03-merge-asof-direction",
    module: "pit",
    title: "merge_asof direction",
    difficulty: "warmup",
    question: `pd.merge_asof has direction equal to backward, forward, or nearest. Explain what each does and which one is the only PIT-safe choice for joining data onto a trading timeline.`,
    thinking: `Picture standing on a trading date and reaching for the reference table. Backward: take the most recent reference row at or before your date -- "the last thing I knew". Forward: take the next row at or after your date -- reaching into the future. Nearest: whichever is closer in time, which half the time is the future. For point-in-time joins only backward mimics reality, because at decision time you can only possess what has already been published. Then ask when the others are legitimately useful, because the interviewer will: forward and nearest are fine for LABELING, not for features -- e.g. attaching the next earnings announcement to each date so you can study returns leading INTO events, where the future reference is the thing being predicted, not an input. The danger zone is using forward or nearest to fill feature columns: silent, severe lookahead.`,
    answer: `Backward picks the latest reference row at or before each left-hand timestamp -- the last known value, which is what a live system would have. Forward picks the next row at or after, and nearest picks the closer of the two -- both can pull future rows. For features, backward is the only PIT-safe direction. Forward and nearest are only defensible for building labels or event studies where the future row is the target, not an input.`,
    python: `import pandas as pd

# trades: decision timestamps. quotes: reference data updates.
trades = trades.sort_values('ts')
quotes = quotes.sort_values('ts')

# PIT-safe: last known quote at or before each trade time.
safe = pd.merge_asof(trades, quotes, on='ts',
                     direction='backward')

# LOOKAHEAD if used as a feature: grabs the NEXT quote,
# which did not exist yet at decision time.
leaky = pd.merge_asof(trades, quotes, on='ts',
                      direction='forward')

# Half-lookahead: whichever side is closer. Still leaky.
also_leaky = pd.merge_asof(trades, quotes, on='ts',
                           direction='nearest')

# Legitimate 'forward' use -- as a LABEL: time until the next
# earnings announcement, a thing you are predicting toward.
next_ann = pd.merge_asof(trades, anns, on='ts',
                         direction='forward')
next_ann['days_to_ann'] = (next_ann['ann_ts']
                           - next_ann['ts']).dt.days`,
    trap: `Note the boundary: backward includes rows with EXACTLY equal timestamps (allow_exact_matches=True by default). If your reference row is stamped at the same instant as the decision but was actually published milliseconds later -- or after the close of that stamp date -- an exact match is itself a leak. Set allow_exact_matches=False when equality means "not yet knowable".`,
  },
  {
    id: "qr-pit-04-merge-asof-tolerance-by",
    module: "pit",
    title: "merge_asof by-groups and tolerance",
    difficulty: "core",
    question: `You merge_asof quarterly fundamentals onto daily prices for 3000 tickers. Why do you need the by argument, and what problem does tolerance solve?`,
    thinking: `Two independent failure modes. Without by='ticker', merge_asof matches on time alone across the ENTIRE reference table -- so Apple's Monday row can pick up Zoom's fundamentals if Zoom filed more recently. The join runs without error and the output looks plausible, which is what makes it lethal; by performs the as-of match within each ticker separately. Tolerance addresses staleness: backward-asof reaches indefinitely far into the past, so a ticker that stopped filing two years ago (delisting, halt, data gap) still carries its last known fundamentals forward forever. Your "value" signal is then ranking live companies against ghosts of stale data. tolerance=pd.Timedelta('135D') says: if the last filing is older than ~4.5 months (one quarter plus a filing lag), return NaN instead -- and NaN is the truthful answer, because a live system would flag that data as stale too.`,
    answer: `by='ticker' scopes the as-of match within each ticker; without it the join silently matches across companies on time alone. tolerance caps how stale a match may be -- backward-asof otherwise carries a last-known value forward forever, so dead or halted names keep years-old fundamentals. A tolerance of about one reporting period plus filing lag turns overly stale data into NaN, which is what a live system would tell you.`,
    python: `import pandas as pd

# fund: (ann_date, ticker, book_value) -- one row per filing.
# px:   (date, ticker, close) -- daily panel.
# merge_asof demands sorting by the time key on both sides.
fund = fund.sort_values('ann_date')
px = px.sort_values('date')

panel = pd.merge_asof(
    px,
    fund,
    left_on='date',
    right_on='ann_date',
    by='ticker',                      # match within ticker
    direction='backward',             # only the past
    tolerance=pd.Timedelta('135D'),   # ~1 quarter + filing lag
)
# Rows whose latest filing is >135 days old get NaN book_value
# instead of a zombie value -- rank them out, do not trade them.

# Diagnostics you should actually run:
staleness = (panel['date'] - panel['ann_date']).dt.days
# 1) how stale is the typical matched filing?
med_stale = staleness.median()
# 2) what fraction of rows failed the tolerance (NaN)?
miss_rate = panel['book_value'].isna().mean()
# A spike in miss_rate flags a feed outage BEFORE it becomes
# a mystery in the backtest.`,
    trap: `Forgetting that with by-groups the sort requirement is on the time key overall, and an unsorted frame raises -- but a subtler bug does not: duplicate ann_date rows per ticker (amended filings same day) make the match arbitrary among duplicates. Deduplicate deliberately, keeping the row a live system would have kept.`,
    followUp: `Why is 135 days a reasonable tolerance for quarterly US fundamentals but wrong for annual-only international filers? (Their gap between filings is ~12 months plus lag -- tolerance must match the reporting cadence of the data.)`,
  },
  {
    id: "qr-pit-05-restatements",
    module: "pit",
    title: "Restatements and first-reported data",
    difficulty: "core",
    question: `A company reports Q4 EPS of 2.10 in February, then restates it to 1.40 in June. Your vendor's current database shows 1.40 for Q4. What is wrong with backtesting on that, and how should the data be structured?`,
    thinking: `Ask what a trader in March actually knew: 2.10. The restated 1.40 did not exist until June. A "current" database silently overwrites history with the corrected value, so a backtest run today feeds March-you a number June-you learned -- lookahead through data revision rather than through timestamps. This is insidiously selective, too: restatements are more common when something went wrong at the company, so the corrections are correlated with future bad returns. Backtesting on corrected data means your signal quietly sidesteps disasters it could never have seen coming -- inflating performance exactly on the names where real money would have been lost. The fix is vintage (also called point-in-time or snapshot) data: every value carries the date it was PUBLISHED, restatements append new rows instead of overwriting, and the as-of join picks whichever row was the latest published as of the simulation date.`,
    answer: `The current database has been retroactively corrected -- a March simulation would see June's restated 1.40, which is lookahead via revision. Worse, restatements correlate with trouble, so corrected data lets the backtest dodge blowups it could not have dodged live. You need vintage data: each (ticker, period) keeps every published version with its publication date, and an as-of join on publication date reproduces exactly what was known when.`,
    python: `import pandas as pd

# vintages: append-only fact table. NOTHING is ever overwritten.
#   ticker, period_end, pub_date, eps
# The restatement is simply a second row for the same period:
#   AAA  2025-12-31  2026-02-15  2.10   <- first-reported
#   AAA  2025-12-31  2026-06-10  1.40   <- restatement

def eps_asof(vintages, asof_date):
    # What did the market believe about each period on asof_date?
    # 1) drop rows published after the as-of date (unknowable)
    known = vintages[vintages['pub_date'] <= asof_date]
    # 2) among the remaining versions of each period, keep the
    #    most recently published one -- the belief at the time
    known = known.sort_values('pub_date')
    latest = known.groupby(['ticker', 'period_end']).tail(1)
    return latest

# March sim date -> returns 2.10 (only version then published).
mar = eps_asof(vintages, pd.Timestamp('2026-03-15'))
# July sim date -> returns 1.40 (restatement now known).
jul = eps_asof(vintages, pd.Timestamp('2026-07-15'))

# Vendors sell this as 'point-in-time fundamentals'; if all
# you have is a current snapshot, no lag hack fully fixes it.`,
    trap: `"Just use first-reported values everywhere." Closer to honest, but wrong in the other direction: after June, live traders DID know 1.40, and a simulation running through autumn should use it. The correct rule is not first-reported, it is latest-known-as-of-each-date.`,
    followUp: `Same machinery, different field: analyst estimate revisions arrive continuously. What does the vintage table look like there, and what new signal falls out of it for free? (Revision momentum -- the CHANGES in beliefs are themselves a classic signal.)`,
  },
  {
    id: "qr-pit-06-universe-reconstruction",
    module: "pit",
    title: "As-of-then universe reconstruction",
    difficulty: "core",
    question: `You backtest a strategy from 2010 using today's S&P 500 members as the universe. Why is the result inflated, and how do you build the universe correctly?`,
    thinking: `Ask what "today's members" secretly conditions on. A company is in the index today because it survived and grew -- so backtesting on today's list means your 2010 universe already excludes everything that later went bankrupt, was delisted, or shrank, and includes 2010-era small caps that you only know matter because they later won (you would be buying Nvidia in 2010 because 2026-you knows how that movie ends). This is survivorship bias plus its mirror image, inclusion bias, and both push returns up -- classic studies put the flattery at several percent per year. The fix is reconstructing the universe as-of-then: a membership table of (ticker, add_date, drop_date) intervals, from which you derive who was actually in the index on each historical date. Every downstream step -- ranks, z-scores, neutralization -- must run on that day's true member set, because cross-sectional statistics change when the roster changes.`,
    answer: `Using today's members conditions on survival and success that was unknowable in 2010 -- dead companies are excluded and future winners pre-included, inflating returns materially. Correct approach: maintain membership intervals (add date, drop date) and reconstruct each date's actual roster, so every cross-sectional computation runs on the stocks a 2010 trader could really have held -- including the ones that later went to zero.`,
    python: `import pandas as pd
import numpy as np

# members: one row per membership spell:
#   ticker, add_date, drop_date (NaT = still a member today)
# dates: DatetimeIndex of backtest days.

# Open-ended spells: treat NaT as 'far future' for comparisons.
drop = members['drop_date'].fillna(pd.Timestamp('2262-01-01'))

# Build a boolean panel: was ticker t a member on date d?
# Vectorized via numpy broadcasting -- no date loop.
d = dates.values[:, None]                  # (n_dates, 1)
add = members['add_date'].values[None, :]  # (1, n_spells)
drp = drop.values[None, :]
in_spell = (d >= add) & (d < drp)          # (n_dates, n_spells)

univ = pd.DataFrame(in_spell, index=dates,
                    columns=members['ticker'].values)
# Same ticker can have multiple spells (dropped, re-added):
# a ticker is in the universe if ANY of its spells covers d.
univ = univ.T.groupby(level=0).any().T

# Enforce it everywhere downstream: mask before ranking, so
# per-date stats use only that day's true roster.
sig_in_univ = sig.where(univ)
ranks = sig_in_univ.rank(axis=1, pct=True)`,
    trap: `Fixing the universe but leaving the PRICE data survivorship-biased -- a vendor file that only contains currently listed tickers has already deleted the bankruptcies. The universe table and the return data must both include the dead.`,
    followUp: `Index adds and drops are announced days before they take effect. For a strategy trading the announcement, which date belongs in your membership table? (Both -- announcement date is the information event, effective date is when index funds must trade. Same availability-vs-effective split as fundamentals.)`,
  },
  {
    id: "qr-pit-07-bfill-trap",
    module: "pit",
    title: "The bfill trap",
    difficulty: "core",
    question: `A teammate fills missing values in a feature panel with df.bfill() because "it fills the gaps and the backtest improves". Explain what bfill does on a time axis and why the improvement is fake.`,
    thinking: `Spell out the mechanics: bfill (backward fill) propagates the NEXT valid observation backward in time -- a gap on Tuesday gets filled with Thursday's value. On a time-indexed feature, that plants future data in past rows by construction. Then reason about why the backtest "improves": the filled value is not just future data, it is future data that correlates with returns over exactly the gap period -- if the feature is price-linked, Tuesday now partially knows where things stood on Thursday. The tell in their own sentence is "the backtest improved": a pure data-cleaning step has no business improving performance, and any preprocessing change that does should be treated as a lookahead alarm until proven otherwise. The honest direction is ffill (forward fill) -- carrying the LAST KNOWN value forward, which is what a live system genuinely has -- with a staleness limit so dead names do not carry ghosts forever.`,
    answer: `bfill copies the next future observation backward into the gap -- Tuesday's hole is filled with Thursday's value, which is textbook lookahead on any time axis. The backtest improves precisely BECAUSE information leaked, and that improvement is the red flag: cleaning steps should not add alpha. Use ffill, which carries the last known value forward like a live system would, with a limit so values cannot go stale indefinitely.`,
    python: `import pandas as pd
import numpy as np

# feat: wide feature panel, index = dates ascending,
# columns = tickers, with gaps (NaN) from data outages.

# WRONG: pulls FUTURE values backward into the gap.
leaky = feat.bfill()

# RIGHT: carry the last KNOWN value forward, and cap staleness
# so a name that stopped updating goes NaN after 5 days
# instead of trading on fossils.
safe = feat.ffill(limit=5)

# Prove the leak to your teammate mechanically: truncate the
# data at a cutoff and compare the 'past' after each fill.
cut = feat.index[len(feat) // 2]
full_fill = feat.bfill()
trunc_fill = feat.loc[:cut].bfill()
# Rows at/before the cutoff DIFFER -> the fill used the future.
leak_rows = (full_fill.loc[:cut]
             .ne(trunc_fill)
             .any(axis=1)
             .sum())

# Same test on ffill: past rows identical -> no leak.
same = feat.ffill(limit=5).loc[:cut].equals(
    feat.loc[:cut].ffill(limit=5))   # True`,
    trap: `Believing ffill is unconditionally safe. Forward-filling is PIT-honest but can still be WRONG: filling a delisted stock's price forward for months creates phantom tradability. ffill needs a limit and a delisting mask -- honest direction, bounded staleness.`,
    followUp: `interpolate() also looks innocent. Which interpolation methods leak and why? (Linear interpolation between the previous and NEXT point uses the future endpoint -- it is bfill wearing a suit.)`,
  },
  {
    id: "qr-pit-08-rolling-center-trap",
    module: "pit",
    title: "The rolling center=True trap",
    difficulty: "core",
    question: `Someone smooths a signal with rolling(21, center=True).mean() and the strategy's Sharpe doubles. What happened?`,
    thinking: `Unpack what center=True changes: instead of the window ENDING at row t (21 past days), the window is CENTERED on t -- 10 days of past, today, and 10 days of FUTURE. The smoothed value at each date is now an average that includes ten days of prices that had not happened yet. Then reason about why this particular leak is so flattering for a trading signal: a centered moving average turns each point into a preview of the local trend -- the smoothed series peaks and troughs roughly WITH the raw series rather than lagging it, so a strategy trading its slope appears to catch turning points with impossible timing. Doubling the Sharpe from a "smoothing tweak" is exactly the cleaning-step-adds-alpha alarm again. Centered windows are legitimate tools -- for offline visualization, seasonal decomposition, or labeling historical regimes -- anywhere output does not feed a time-t decision.`,
    answer: `center=True shifts the window to straddle each date -- with a 21-day window, ten of the averaged observations are in the future. The smoothed signal effectively previews the local trend, so trades appear to anticipate turning points they were actually told about. It is fine for plots and offline analysis, never for features. Trailing windows only: rolling(21) with the default center=False.`,
    python: `import pandas as pd
import numpy as np

# sig: raw daily signal, index ascending dates.

# WRONG for features: window spans t-10 .. t+10.
smooth_leaky = sig.rolling(21, center=True).mean()

# RIGHT: trailing window, spans t-20 .. t. Lags, but honest.
smooth_safe = sig.rolling(21, min_periods=15).mean()

# If the trailing lag genuinely hurts, the honest upgrade is
# heavier recent weighting -- NOT a peek at the future:
smooth_ewm = sig.ewm(halflife=5, min_periods=15).mean()

# Mechanical proof of the leak (truncation test again):
cut = sig.index[len(sig) // 2]
a = sig.rolling(21, center=True).mean().loc[:cut]
b = sig.loc[:cut].rolling(21, center=True).mean()
n_changed = a.ne(b).sum()   # >0: past output depends on future
# The last 10 pre-cutoff rows differ -- exactly the half-window
# of future data each centered value consumes.

c = sig.rolling(21).mean().loc[:cut]
d = sig.loc[:cut].rolling(21).mean()
assert c.equals(d)          # trailing window: past is stable`,
    trap: `The same bug hides in scipy filters and signal-processing helpers: savgol_filter, zero-phase filtfilt, and most 'smoothing' utilities are centered or two-pass by design. Anything advertised as zero-lag on historical data is telling you it reads the future.`,
    followUp: `Why does the truncation test flag exactly the last 10 rows before the cutoff? (Each centered value needs 10 future rows; the final 10 rows lose part of their forward half when you truncate -- the leak radius equals the forward half-window.)`,
  },
  {
    id: "qr-pit-09-full-sample-zscore-trap",
    module: "pit",
    title: "The full-sample z-score trap",
    difficulty: "core",
    question: `A researcher normalizes a time-series feature as x minus x.mean() over x.std(), computed over the whole 15-year sample, before backtesting. What is the leak, and what should they do instead?`,
    thinking: `The formula looks static and harmless -- that is what makes this the most common leak in quant code. Ask what the 2011 rows are being divided by: a standard deviation computed from 2011 THROUGH 2025. The 2011 backtest decisions depend on volatility that had not happened yet. Then reason about how the damage manifests: it is subtle, not catastrophic, which makes it worse. Full-sample stats tell early rows where the eventual center and scale of the distribution will be -- if the feature trends over the sample, early z-scores are systematically signed by future knowledge, and threshold-based rules ("trade when z exceeds 2") fire with calibration no live system could have had. The honest alternatives, in order of preference: expanding-window stats (each row normalized by its own past only), rolling-window stats (bounded memory), or per-date cross-sectional stats, which use only today's rows and are inherently PIT-safe.`,
    answer: `Full-sample mean and std let every early row see the future's distribution -- 2011 values are scaled by 2025 volatility. Thresholded rules then fire with impossibly good calibration. Replace with expanding statistics (each row sees only its own past, plus a min_periods burn-in), a rolling window if you want bounded memory, or cross-sectional per-date normalization which cannot leak by construction. In live trading you could not compute the full-sample version -- that is the litmus test.`,
    python: `import pandas as pd
import numpy as np

# x: daily time-series feature, index ascending.

# WRONG: mean/std summarize the ENTIRE sample, including the
# future relative to every early row.
z_leaky = (x - x.mean()) / x.std()

# RIGHT (expanding): row t is normalized by stats of rows <= t.
m = x.expanding(min_periods=252).mean()
s = x.expanding(min_periods=252).std()
z_exp = (x - m) / s
# NOTE: even this has a subtle off-by-one -- stats INCLUDE row
# t itself. For strict discipline, shift the stats by one day:
z_strict = (x - m.shift(1)) / s.shift(1)

# RIGHT (rolling): recent-regime scale, bounded memory.
z_roll = (x - x.rolling(756, min_periods=252).mean()) / (
    x.rolling(756, min_periods=252).std())

# The litmus test, mechanized: recompute on truncated data and
# compare the shared history. Leaky version changes; expanding
# version does not.
cut = x.index[len(x) // 2]
assert not (x - x.mean()).loc[:cut].equals(
    (x.loc[:cut] - x.loc[:cut].mean()))
assert z_exp.loc[:cut].equals(
    ((x - m) / s).loc[:cut])`,
    trap: `The same crime with different aliases: fitting sklearn's StandardScaler, a PCA, or ANY model on the full sample before backtesting. If a fitted object's parameters depend on all rows, every transformed row inherits the future. Fit on the past, apply forward -- always.`,
    followUp: `Cross-sectional per-date z-scores were called inherently safe. Why exactly? (They aggregate over stocks WITHIN one date, never over time -- there is no future row in the computation to leak from.)`,
  },
  {
    id: "qr-pit-10-reporting-lag",
    module: "pit",
    title: "Imposing a reporting lag",
    difficulty: "core",
    question: `Your fundamentals vendor provides only fiscal period end dates -- no announcement dates. You cannot buy better data this week. How do you make this usable with minimal lookahead risk?`,
    thinking: `The principled answer is "get PIT data", but interviewers ask this precisely because real desks face it. The engineering question becomes: what availability date can I IMPUTE such that I am almost never early? Reason from filing regulation and empirics: US quarterly filings are due 40-45 days after period end depending on company size, annuals up to 90; most companies announce earlier than the deadline, but you must cover the slow tail. So impose a conservative lag -- period end plus, say, 75 calendar days for quarterly data -- and treat that as the availability date in your merge_asof. Being conservative costs you a few weeks of signal freshness on fast filers (a mild, honest performance haircut); being aggressive risks lookahead (a dishonest performance boost). The asymmetry decides it: always err stale. And flag the residual risk: restatements are still invisible with this data, and no lag fixes that.`,
    answer: `Impute availability as period end plus a conservative lag calibrated to filing deadlines -- around 75 calendar days for US quarterly data covers the slow tail -- and use that imputed date in the as-of join. You sacrifice signal freshness on fast filers, which biases results DOWN slightly; the alternative biases them UP dishonestly. State the limitation openly: restatement lookahead remains, since a current-snapshot vendor has already overwritten history.`,
    python: `import pandas as pd

# fund: (ticker, period_end, book_value) -- NO announcement date.

# Impose a conservative availability date. 75 calendar days
# covers nearly all US quarterly filers (deadline 40-45 days,
# plus stragglers and amended filings).
fund = fund.copy()
fund['avail_date'] = fund['period_end'] + pd.Timedelta(days=75)

# Then the standard PIT join, keyed on the IMPUTED date.
fund = fund.sort_values('avail_date')
px = px.sort_values('date')
panel = pd.merge_asof(
    px, fund,
    left_on='date', right_on='avail_date',
    by='ticker', direction='backward',
    tolerance=pd.Timedelta('200D'),
)

# Sensitivity analysis -- the professional touch: rerun the
# backtest at lags of 45, 60, 75, 90 days. If performance
# degrades sharply as the lag grows, the strategy was living
# off the earliest (least certain) part of the window -- treat
# results near the deadline boundary with suspicion.
for lag in [45, 60, 75, 90]:
    pass  # rebuild avail_date with each lag and re-run`,
    trap: `Using a short "average" lag like 30 days because most companies report by then. PIT discipline is about the worst case, not the average: the 20% of companies still unreported at day 30 are disproportionately the troubled ones (late filings correlate with bad news), so an average lag leaks exactly the most damaging information.`,
    followUp: `Performance falls a lot between the 45- and 75-day lag runs. What are the two competing explanations, and how do you tell them apart? (Real earnings-drift alpha that decays fast, versus lookahead at the short lag. Check whether the extra P&L concentrates in late-filing names -- alpha from firms that had not filed yet is lookahead.)`,
  },
  {
    id: "qr-pit-11-mechanical-lookahead-detection",
    module: "pit",
    title: "Mechanical lookahead detection",
    difficulty: "hard",
    question: `Design an automated test that catches lookahead in a feature pipeline you did not write -- treat the pipeline as a black box.`,
    thinking: `Start from the definition and turn it into an invariant you can assert: if outputs at time t depend only on inputs at or before t, then CHANGING inputs after t must leave outputs at or before t bit-for-bit unchanged. That property is checkable without reading a line of the pipeline's code. Construct the test: run the pipeline on the full input; pick a cutoff date; perturb strictly-future rows -- scramble them, scale them by 10, or simply truncate them away entirely; rerun; compare outputs at or before the cutoff with exact equality (NaN positions included). Any difference is a proof, not a suspicion -- perturbation of the future reached the past, and the offending columns tell you where to dig. Sweep several cutoffs, because leaks with a finite radius (a centered window leaks only half a window back) can slip past a single unlucky cutoff. This is a property-based test: pin the invariant, not the implementation, and put it in CI so refits and refactors cannot silently reintroduce a leak.`,
    answer: `Assert the causality invariant directly: perturb or truncate all input rows after a cutoff, rerun the pipeline, and require outputs at or before the cutoff to be exactly identical to the full-sample run. Any difference proves future data reached the past, and the differing columns localize the leak. Sweep multiple cutoffs to catch finite-radius leaks like centered windows, and run it in CI on every pipeline change.`,
    python: `import pandas as pd
import numpy as np

def lookahead_audit(pipeline, raw, cutoffs, seed=0):
    # pipeline: function raw_df -> feature_df (both date-indexed)
    # Invariant: rows <= cutoff of the output must not depend
    # on rows > cutoff of the input.
    rng = np.random.default_rng(seed)
    base = pipeline(raw)
    failures = []
    for cut in cutoffs:
        fut = raw.index > cut
        # Perturbation 1: scramble the future violently.
        pert = raw.copy()
        noise = rng.standard_normal(pert.loc[fut].shape)
        pert.loc[fut] = pert.loc[fut] * 3 + noise * 10
        # Perturbation 2: remove the future entirely.
        trunc = raw.loc[~fut]
        for variant in (pipeline(pert), pipeline(trunc)):
            got = variant.loc[:cut]
            want = base.loc[:cut].reindex_like(got)
            # exact equality, NaNs matching NaNs -- no tolerance:
            # ANY drift means the future touched the past.
            same = got.eq(want) | (got.isna() & want.isna())
            if not same.all().all():
                bad_cols = same.all()
                failures.append((cut, list(
                    bad_cols[~bad_cols].index)))
    return failures   # empty list = audit passed

# Sweep cutoffs so half-window leaks cannot dodge the test.
# cuts = raw.index[::len(raw) // 8][1:-1]
# assert lookahead_audit(build_features, raw, cuts) == []`,
    trap: `Comparing with a loose numerical tolerance "to avoid float noise". A deterministic pipeline given identical past inputs produces identical past outputs -- there is no legitimate float noise across the runs. Tolerance is exactly the crack a small leak hides in.`,
    followUp: `The audit passes on the feature pipeline, yet the backtest is still leaky. Name two leak locations this test cannot see. (Downstream of features: the trade-execution alignment, and upstream of the raw table: a vendor file already contaminated -- e.g. survivorship-filtered or restated in place.)`,
  },
  {
    id: "qr-pit-12-sharpe-too-good",
    module: "pit",
    title: "Sharpe 3.1 -- what do you check first?",
    difficulty: "hard",
    question: `A new hire shows you a daily equity long-short backtest with a Sharpe of 3.1 on a simple price-based signal. What do you check, in what order, and why that order?`,
    thinking: `Start from the prior: simple signals on liquid equities do not produce a 3+ Sharpe -- competition has arbitraged that away, so the probability this is a bug vastly exceeds the probability it is alpha. Order your checks by yield per minute. First, the signal-to-return alignment: is the return being predicted strictly after the feature is knowable, with a trade lag? The off-by-one there is the single most common cause and takes minutes to check -- correlate the signal with the CONTEMPORANEOUS return; if that correlation is large, the smoking gun is found. Second, run the mechanical truncation audit over the whole pipeline -- catches bfill, centered windows, full-sample stats in one shot. Third, PIT-ness of the data itself: universe as-of-then, availability dating, restatements. Fourth, only after causality is clean: costs, shorting feasibility, and whether the P&L concentrates in illiquid names or a handful of days. The discipline being tested is that you sequence from cheapest-and-likeliest to slowest checks, and that your prior is skepticism.`,
    answer: `Prior first: 3+ Sharpe from a simple signal is almost certainly a bug, so hunt lookahead before admiring returns. Order: one, feature-return alignment and trade lag -- test by correlating the signal against same-day returns, which should be near zero; two, the mechanical truncation audit across the pipeline; three, data PIT-ness -- as-of-then universe, availability dates, restatements; four, realism -- costs, borrow, liquidity, and P&L concentration. Cheapest, highest-yield checks first.`,
    trap: `Jumping straight to "did you include transaction costs?" Costs might drag a Sharpe from 3.1 to 2.4 -- they cannot explain 3.1 existing. Reaching for the cost knob first signals you have not internalized how loudly a 3+ Sharpe screams lookahead.`,
    followUp: `Alignment is clean and the audit passes, yet Sharpe is still 2.8 -- and the P&L is concentrated in stocks under 50 million dollars of market cap. What is the story now? (Not lookahead but capacity fiction: microcap "alpha" that costs and market impact make untradable. The backtest is honest and worthless.)`,
  },
  {
    id: "qr-pit-13-timestamp-semantics",
    module: "pit",
    title: "What does the date on a row mean?",
    difficulty: "hard",
    question: `You are handed a new vendor dataset with a single date column and asked to add it to the research database. What questions do you ask before a single join is written, and how should the table be stored?`,
    thinking: `The deepest PIT habit is refusing to trust a bare date column. For every field, ask: when was this value KNOWABLE? A single date is ambiguous among at least four meanings -- the period the value describes (effective), the moment it was measured, the moment it was published (availability), and the moment your vendor's pipeline actually delivered the file to you. Only the last two bound what a live strategy could have used, and the vendor-delivery timestamp is the truly honest one: an "announcement date" is worthless if the vendor's feed materialized it three days later. So interrogate the vendor: is the history point-in-time or restated in place? Are rows revised, and are revisions new rows or overwrites? What is the collection lag distribution? Is the historical universe survivorship-filtered? Then store defensively: append-only, every row carrying both effective and availability timestamps plus your own ingestion timestamp, so any as-of question is answerable later. Data lacking a defensible availability date gets one imputed conservatively -- and documented.`,
    answer: `Establish what the date column MEANS: effective period, measurement time, publication time, or delivery time -- and insist on knowing when each field was knowable, since only publication and delivery bound live usability. Interrogate for in-place restatements, revision policy, collection lag, and survivorship filtering. Store append-only with three timestamps per row -- effective, availability, and your own ingestion time -- and impute a conservative documented availability date for anything that lacks one.`,
    trap: `Accepting "the date column is the date" and joining on it. Vendors overwhelmingly key rows by effective date because it looks cleaner -- and a backtest joined on effective dates is quietly reading filings weeks early. The absence of an availability column IS the finding; escalate it, do not paper over it.`,
    followUp: `Why record your own ingestion timestamp when the vendor already supplies a publication date? (Because the vendor's history can claim publication dates for rows their feed delivered late -- your ingestion log is the only availability record no one can rewrite.)`,
  },
  {
    id: "qr-pit-20260808-fiscal-quarter-misalignment",
    module: "pit",
    title: "Fiscal quarter misalignment in PIT joins",
    difficulty: "hard",
    question: `You join point-in-time fundamentals onto a daily price panel across a universe where companies use different fiscal year ends -- most report calendar quarters, but a chunk of retailers and some tech names run fiscal years ending in January or June. Your merge_asof by ticker, on report date, looks timing-correct. What can still go wrong, and how would you catch it?`,
    thinking: `The as-of merge is solving TIMING correctness -- it only uses what was knowable by each date -- but that is a different problem from CONTENT comparability. Two companies can each report their most recent quarter as of the same calendar date while describing entirely different economic periods: a calendar-aligned company's Q4 covers October through December, while a January-fiscal-year retailer's Q4 covers November through January, capturing the holiday season under a different label entirely. Any cross-sectional feature that compares "latest quarter" figures across names -- margin trends, quarter-over-quarter growth, sector z-scores -- is silently mixing periods with different seasonality and different economic content, even though every join individually respected point-in-time discipline. The standard fix is normalizing to trailing-twelve-months figures before any cross-sectional comparison, so every company's number covers the same rolling twelve months regardless of where its fiscal quarters fall.`,
    answer: `PIT-correct timing does not imply PIT-comparable content. Companies with offset fiscal years report quarters covering different calendar periods under the same label, so cross-sectional comparisons of "latest quarter" figures quietly mix seasons -- a January-fiscal retailer's Q4 includes the holiday season that a calendar-aligned peer's Q4 does not. Catch it by checking each company's fiscal year-end explicitly, and fix it by comparing trailing-twelve-month figures instead of labeled quarters, so every comparison spans the same rolling window regardless of fiscal calendar.`,
    trap: `Treating the vendor's "fiscal quarter number" (Q1, Q2, Q3, Q4) as a directly comparable label across companies. The label is an accounting convention, not a calendar guarantee -- two companies' Q4 can differ by up to three months of coverage, and nothing in the join itself will flag the mismatch.`,
    followUp: `How would you design the fundamentals table's schema so this comparison is correct by construction -- rather than relying on every downstream researcher remembering to convert to trailing-twelve-months themselves?`,
  },
  {
    id: "qr-pit-20260809-kfold-cv-leakage",
    module: "pit",
    title: "K-fold cross-validation leaks the future",
    difficulty: "hard",
    question: `A researcher trains a return-prediction model with scikit-learn's KFold(n_splits=5, shuffle=True) on five years of daily cross-sectional data, reports a strong out-of-fold R-squared, and wants to ship it. What is wrong with that validation, specifically, and what should replace it?`,
    thinking: `Work through what shuffle=True does to time-ordered data: it randomly scatters rows into five folds regardless of date, so when fold 3 is held out as "test", folds 1, 2, 4, and 5 -- which contain dates both before AND after fold 3's dates -- are used to fit the model. The model predicting fold 3 was trained partly on data from the future relative to fold 3's own timestamps. For financial features this is a serious leak: adjacent-in-time observations are autocorrelated, and features are often built from rolling windows that already smear information across nearby dates, so a model can partially recognize a test row because a near-identical row from three days later sat in its training fold. The reported R-squared is real, just measuring something closer to interpolation than genuine forecasting. The fix is a time-respecting split: walk-forward folds where training only uses data strictly before the test fold's start, plus a purge gap around the boundary sized to the longest feature lookback, so no rolling-window feature straddles the seam.`,
    answer: `shuffle=True scatters dates across folds, so each fold's training set contains future data relative to that fold's own test dates -- a random-shuffle split silently mixes in the exact lookahead the point-in-time discipline elsewhere in this module exists to prevent. Replace it with time-ordered walk-forward folds, training only on data strictly before each test period, plus a purge or embargo gap sized to the longest rolling-window feature so no feature straddles the train/test boundary. The reported R-squared under shuffled K-fold is measuring interpolation, not forecasting skill.`,
    python: `import numpy as np
import pandas as pd
from sklearn.model_selection import KFold

# df: long panel sorted by date, with a rolling-window feature already built
# (e.g. a 21-day rolling feature -- its longest lookback sets the purge width)

# WRONG: shuffled folds ignore time entirely
kf_bad = KFold(n_splits=5, shuffle=True, random_state=0)
# fold i's train set includes rows dated AFTER fold i's test rows --
# the model sees the future relative to what it is being scored on

# RIGHT: walk-forward, time-ordered, with a purge gap around each boundary
def walk_forward_splits(dates, n_folds=5, purge_days=21):
    unique_dates = np.sort(dates.unique())
    fold_edges = np.array_split(unique_dates, n_folds)
    for i in range(1, n_folds):
        test_start = fold_edges[i][0]
        train_end = test_start - pd.Timedelta(days=purge_days)  # purge/embargo
        train_mask = dates < train_end
        test_mask = (dates >= fold_edges[i][0]) & (dates <= fold_edges[i][-1])
        yield train_mask, test_mask

for train_mask, test_mask in walk_forward_splits(df["date"], purge_days=21):
    # fit on df[train_mask], score on df[test_mask] -- train is strictly
    # earlier than test, with a 21-day gap matching the feature's lookback
    pass`,
    trap: `Believing the leak is fixed just by sorting the DataFrame before calling KFold without shuffling. Sequential KFold without shuffle IS time-ordered fold-to-fold, but testing fold 2 still trains on folds 1, 3, 4, 5 -- folds 3 through 5 are still future data relative to fold 2. Only walk-forward, where train is always strictly before test, closes the leak completely.`,
    followUp: `You add the purge gap but the model's live performance still disappoints. What is the difference between purging on calendar days versus purging on the number of overlapping observations, and which one actually matches how your rolling features were built?`,
  },
  {
    id: "qr-pit-20260810-survivorship-membership",
    module: "pit",
    title: "Reconstructing point-in-time index membership",
    difficulty: "hard",
    question: `You are backtesting a strategy on "the Russell 2000" over 15 years, but the only membership list you have is today's constituent list. You use it for the whole backtest. What bias does that introduce, how large is it typically, and how do you fix it properly?`,
    thinking: `Name the mechanism precisely: today's constituent list only contains names that survived to today, by construction -- every company that was in the index at some point but has since been delisted, acquired, or dropped for poor performance is simply absent from your universe for the ENTIRE backtest, including the years when it genuinely was a member and genuinely tradeable. Since deletions from small-cap indices skew heavily toward distressed or failing companies, and additions skew toward companies that recently did well, using today's list systematically removes the worst historical outcomes and silently biases every metric optimistic -- inflating returns and understating volatility and drawdown, largest exactly where it is most tempting to backtest carelessly: small caps and long histories, where the literature finds the bias can be several percentage points of ANNUAL return. The fix is a point-in-time constituents file: for every historical date, the set of tickers actually members on that date, sourced from an index provider's historical file or reconstructed from addition and deletion announcements, with the daily backtest universe drawn from that file rather than one static list.`,
    answer: `Using today's constituent list for the whole history drops every name that was once in the index but has since delisted or been removed -- and removals skew toward failures, so you systematically excise the worst historical outcomes from every year of the backtest, not just recent ones. This survivorship bias inflates returns and understates volatility and drawdown, and in small-cap, long-history backtests the literature finds it can be several percentage points of ANNUAL return, not negligible. Fix it with a true point-in-time constituents file -- membership as of each historical date -- and drive the daily universe from that, never from one static list.`,
    python: `import pandas as pd

# WRONG: one static universe for the entire multi-year backtest
current_members = {"AAPL", "MSFT", "NVDA"}   # today's list only
# every name that delisted or was removed in year 3 of 15 is invisible
# for the WHOLE backtest, including the years it genuinely traded

# RIGHT: a point-in-time membership table, one row per (date, ticker)
# sourced from the index provider's historical additions/deletions file
pit_members = pd.DataFrame({
    "date":   pd.to_datetime(["2015-01-01", "2015-01-01", "2020-06-15"]),
    "ticker": ["ENRN", "AAPL", "AAPL"],   # a since-delisted name shows up
    "action": ["member", "member", "member"],
})

def universe_on(date, members):
    # true universe as of DATE -- pulls in names later removed, drops
    # names not yet added, exactly as a live trader would have seen it
    asof = members[members["date"] <= date]
    return set(asof.groupby("ticker").tail(1)
               .query("action == 'member'")["ticker"])

# each day's backtest universe comes from THIS, never from one fixed set
u_2015 = universe_on(pd.Timestamp("2015-06-01"), pit_members)`,
    trap: `Believing the bias is fixed just by including delisted-stock PRICE data (delisting returns) while still filtering the universe with today's membership list. Price coverage and membership coverage are separate problems -- a stock can have full historical prices in your database and still never enter the backtest at all if the universe filter itself is drawn from today's list.`,
    followUp: `Your point-in-time membership file has additions and deletions dated by ANNOUNCEMENT date, but index funds only trade the change on the EFFECTIVE date days later. Does that gap matter for your research backtest the way it matters for an index-tracking fund?`,
  },
  {
    id: "qr-pit-20260811-split-adjustment-lookahead",
    module: "pit",
    title: "The adjusted-price-level leak around a pending split",
    difficulty: "hard",
    question: `A stock announces a 4-for-1 split on June 1st, effective June 20th. Your vendor's price file is fully back-adjusted through all of history and refreshed nightly, so by the time you pull it for research, June 10th already shows a price divided by four. You are backtesting a decision made on June 10th, ten days before the split takes effect. What lookahead risk does that carry, given that the split ratio itself was already public knowledge on June 10th?`,
    thinking: `First rule out the wrong diagnosis: the split RATIO is not the leak here, since it was announced on June 1st and is genuinely public by June 10th -- correctly back-adjusting RETURNS computed across the ex-date is exactly the right thing to do, and it changes nothing about what was knowable. The actual leak is about price LEVEL, not ratio: on June 10th, the stock was still trading, quotable, and executable at its PRE-split price -- call it 200 dollars -- because the split had not taken effect yet. A fully-adjusted file shows that same June 10th row as 50 dollars, the POST-split level, because the file was built by scaling all of history down once the split occurred. Any feature or execution rule that depends on the actual dollar level a trader would have seen that day -- a minimum-price screen, a whole-share position sizer, a dollar-volume liquidity filter, joining against an options chain keyed by strike price -- computed from the adjusted file is silently evaluated against a price that did not exist in the market on June 10th. A "price under 100 dollars" screen that should have excluded this 200-dollar stock on June 10th wrongly includes it, because the adjusted file already shows 50. The fix is keeping two series and using each for its own purpose: the adjusted series strictly for computing returns across corporate actions, and an as-traded, unadjusted series for anything that depends on the actual quoted level or executable share count on a given historical date.`,
    answer: `The split ratio being announced in advance is not the problem -- back-adjusting returns across the ex-date using that ratio is correct. The leak is that the adjusted file also silently rewrites the PRICE LEVEL for dates before the split took effect, so June 10th shows the post-split 50 dollars even though the stock was actually quotable and tradable at 200 dollars that day. Any level-dependent logic -- minimum-price screens, whole-share position sizing, dollar-volume caps, options-strike joins -- computed from the adjusted file is evaluated against a price nobody could have traded at on that date. Keep two series: adjusted strictly for returns, as-traded for anything that depends on the real historical quoted level.`,
    trap: `Believing you are safe because "the ratio was already public, so nothing was leaked". That reasoning is correct for returns and wrong for level-dependent decisions -- the information that leaked is not the ratio, it is the FUTURE PRICE LEVEL substituted into a date when the market had not yet applied it, and no amount of the ratio being public fixes a rule that filters or sizes on dollar price.`,
    followUp: `A separate stock trades down to 4 dollars and gets delisted for falling below a minimum-price listing requirement, then the exchange later applies a reverse-split adjustment to its historical file. Does the same as-traded-versus-adjusted distinction matter for a minimum-price delisting screen applied to its history? (Yes -- a reverse-split-adjusted file can retroactively show a healthy price on dates when the stock was actually trading below the delisting threshold, hiding the real listing risk that existed at the time.)`,
  },
  {
    id: "qr-pit-20260812-earnings-timing-bmo-amc",
    module: "pit",
    title: "Earnings timing: BMO vs AMC and same-day misattribution",
    difficulty: "hard",
    question: `You're building an earnings-surprise feature: actual EPS minus consensus estimate, joined to that day's return to check if the market reacted as expected. Backtested IC looks great, but a colleague points out you may be misattributing the reaction. What's the issue, and how do you fix the join?`,
    thinking: `Ask when the news actually hit relative to the trading session. Some companies report before market open (BMO), others after market close (AMC), and a vendor's "report date" column usually doesn't say which. For a BMO report, that day's session is genuinely the first chance the market has to react, so joining surprise to that day's close-to-close return is correct. For an AMC report, the market was already closed when the news landed -- the real reaction happens on the NEXT trading day. Join every surprise to same-day return regardless of timing, and every AMC observation gets paired with a return that occurred before the news existed: not lookahead in the classic sense, but the same kind of damage -- it measures the wrong relationship, diluting or even inverting the true IC once AMC rows are a meaningful share of the sample.`,
    answer: `Vendor report dates usually don't distinguish before-market-open from after-market-close releases, but the correct reaction window depends on it: BMO news is priced into that same day's session, while AMC news isn't priced in until the NEXT trading day. Joining every surprise to same-day return silently misattributes all the AMC observations to a return that predates the news, diluting -- or, if AMC is the majority, inverting -- the measured IC. Fix: get or infer the BMO/AMC flag and shift AMC rows forward one trading day before joining to returns.`,
    python: `import numpy as np
import pandas as pd

earnings = pd.DataFrame({
    "ticker": tickers, "report_date": report_dates,
    "surprise": eps_actual - eps_estimate,
    "timing": timings,   # "BMO" or "AMC", from the vendor or inferred
})

trading_days = pd.DatetimeIndex(sorted(returns["date"].unique()))
report_dates_idx = pd.DatetimeIndex(earnings["report_date"])

# BMO: today's session reacts, so reaction_date == report_date
# AMC: market was closed, so the reaction is the NEXT trading day after it
next_idx = trading_days.searchsorted(report_dates_idx, side="right")
next_trading_day = trading_days[next_idx]

is_bmo = (earnings["timing"] == "BMO").to_numpy()
earnings["reaction_date"] = np.where(is_bmo, report_dates_idx, next_trading_day)

# join surprise to the return on the CORRECT reaction date, not report_date
merged = earnings.merge(
    returns.rename(columns={"date": "reaction_date"}),
    on=["ticker", "reaction_date"], how="left",
)

ic = merged.groupby("reaction_date").apply(
    lambda d: d["surprise"].corr(d["ret"], method="spearman")
)`,
    trap: `Assuming report_date already IS the reaction date because "that's the date the vendor gave me." For AMC reporters -- often the majority in some datasets -- that silently compares the surprise to a return window that closed before the earnings call even started, which is not lookahead in the classic sense but is just as damaging: it measures the wrong relationship entirely.`,
    followUp: `A report_date with no BMO/AMC flag at all -- how would you infer timing purely from price and volume data around the report date, without ever seeing the actual release time?`,
  },
  {
    id: "qr-pit-20260813-ipo-lockup-universe-entry",
    module: "pit",
    title: "IPO lockups and when a new listing enters the universe",
    difficulty: "hard",
    question: `A stock IPOs and you have clean daily prices from day one. Your universe-construction rule includes any stock with valid price and volume data. The stock enters your backtest immediately and your momentum signal trades it within the first month, well before the standard 180-day IPO lockup expires. What's wrong with including it that early, and how do you fix the universe rule?`,
    thinking: `Ask what "valid price and volume data" actually tells you versus what it does not. It confirms the stock trades and prints real prices -- it says nothing about the SUPPLY of shares actually available to trade. During the lockup period, insiders, founders, and early investors are contractually barred from selling, so the float, the shares genuinely available, is a small fraction of shares outstanding; volume and price action during this window can be thin, noisy, and driven by a narrow set of participants rather than broad price discovery. Then the lockup expires, typically 180 days after IPO, and a large supply of previously-locked shares can hit the market at once -- a well-documented pattern of abnormal negative returns around that specific date, driven by supply mechanics, not new information. Two distinct problems live in that window: signals computed on early post-IPO data are measuring a different, thinner microstructure regime than the one your strategy is calibrated for, and a backtest that includes the lockup-expiration date itself risks attributing a mechanical supply shock to whatever signal happened to be active that day. The practical universe fix is a minimum-listing-age filter, most simply excluding a stock until some number of trading days past its IPO date, calibrated to at least clear the thinnest early trading and ideally the lockup expiration.`,
    answer: `Passing a valid-price-and-volume filter says nothing about float -- during the lockup, most shares outstanding are contractually unsellable, so early trading reflects a thin, narrow-participation microstructure rather than the regime your signal is calibrated for. Worse, lockup expiration itself (commonly 180 days post-IPO) is associated with abnormal negative returns from the sheer supply of newly-sellable shares hitting the market, a mechanical event a backtest can misattribute to whatever signal was active that day. Fix: add a minimum-listing-age filter to universe construction -- exclude a stock for some number of trading days after its IPO date, long enough to clear both the thinnest early trading and the lockup expiration.`,
    python: `import pandas as pd

# ipo_dates: Series of IPO date per permno; px: long panel with date, permno
MIN_LISTING_AGE_DAYS = 200   # clears the standard ~180-day lockup with margin

listing_age = (
    px[["date", "permno"]]
    .merge(ipo_dates.rename("ipo_date"), on="permno", how="left")
    .assign(age=lambda d: (d["date"] - d["ipo_date"]).dt.days)
)

# universe membership now requires BOTH valid data AND enough listing history --
# a stock with perfect prices from day one is still excluded until it clears this
eligible = (listing_age["age"] >= MIN_LISTING_AGE_DAYS) | listing_age["ipo_date"].isna()

universe_by_date = (
    listing_age.loc[eligible]
    .groupby("date")["permno"]
    .apply(set)
)

# sanity check: no stock should appear in the universe before its own
# minimum-age threshold -- catches an off-by-one in the join above
violations = listing_age.loc[eligible & (listing_age["age"] < MIN_LISTING_AGE_DAYS)]
assert violations.empty`,
    trap: `Treating "the data looks clean" as sufficient evidence a stock is tradeable. Clean prices and nonzero volume are necessary but not sufficient -- they say nothing about float, borrow availability for shorting, or the mechanical supply event sitting on the calendar 180 days out, all of which a pure data-quality filter is blind to.`,
    followUp: `Your momentum signal's IC, measured across the whole universe, looks slightly better when you include recent IPOs than when you exclude them with the age filter. Should that observation make you reconsider the filter, or does it tell you something else about where that extra IC is coming from?`,
  },
  {
    id: "qr-pit-20260814-eod-close-intraday-join",
    module: "pit",
    title: "Joining EOD close against intraday alt-data timestamps",
    difficulty: "hard",
    question: `You're joining a daily close-price table against an alternative-data feed that arrives at various times during the trading session (news sentiment, say). Your close table stores one row per (ticker, date) with no time component. You backward-asof-join alt data to the nearest prior close. A sentiment score that arrived at 2pm on trading day T gets matched to T's own close price. Is that a leak, and why?`,
    thinking: `Yes -- and it's subtle because the join mechanics look right: direction="backward" is correct for "never look into the future." The bug is in what the close timestamp represents. A close price doesn't exist until the session ends, typically 4pm or later, but a date-only timestamp like "2024-06-03" gets treated by merge_asof as midnight at the start of that date. So a 2pm sentiment row compares as "after" a midnight stamp for the same date, and the join hands it a close that in reality is still hours from existing. Fix: store the actual print timestamp, not just the date, on every EOD field -- then backward-asof correctly falls back to the previous day's close instead.`,
    answer: `Yes, it's a lookahead leak. The join logic (direction="backward") is right, but the close's timestamp is stored as a bare date, which pandas treats as midnight -- so a 2pm alt-data row compares as arriving after that "timestamp" even though the actual closing print is still hours away. Fix by storing the real print time (e.g. 20:00 UTC) on the close row; backward-asof then correctly matches the 2pm row to the prior day's close instead.`,
    python: `import pandas as pd

# the close actually PRINTS at 20:00 UTC, but a naive pipeline stores it
# truncated to just the session date -- losing the print time entirely
close_full = pd.DataFrame({
    "asOf": pd.to_datetime(["2024-06-03 20:00", "2024-06-04 20:00"]),
    "ticker": ["AAPL", "AAPL"],
    "close": [190.0, 192.0],
}).sort_values("asOf")
close_dateonly = close_full.assign(asOf=close_full["asOf"].dt.normalize())  # truncated

alt = pd.DataFrame({
    "ts": pd.to_datetime(["2024-06-03 14:30"]),   # arrives mid-session, before the print
    "ticker": ["AAPL"],
    "sentiment": [0.4],
})

# WRONG: date-truncated close's midnight timestamp is <= 14:30 same day,
# so backward-asof hands the alt row a close that hasn't printed yet -- lookahead
leaky = pd.merge_asof(alt, close_dateonly, left_on="ts", right_on="asOf",
                       by="ticker", direction="backward")
print("leaky close seen at 14:30:", leaky["close"].iloc[0])   # 190.0 -- wrong, not printed yet

# RIGHT: keep the real print timestamp; backward-asof correctly finds nothing yet
clean = pd.merge_asof(alt, close_full, left_on="ts", right_on="asOf",
                       by="ticker", direction="backward")
print("clean close seen at 14:30:", clean["close"].iloc[0])   # NaN -- correct`,
    trap: `Assuming direction="backward" alone makes a merge_asof leak-proof. The direction only controls which side of a correctly-ordered timestamp you match; if the timestamp itself doesn't reflect when the data was actually knowable, backward-asof will happily hand you the future.`,
    followUp: `How would this same bug show up if you were joining quarterly fundamentals (reported with a fiscal period end date) against daily prices?`,
  },
  {
    id: "qr-pit-20260815-analyst-estimate-revisions",
    module: "pit",
    title: "Point-in-time discipline for analyst estimate revisions",
    difficulty: "hard",
    question: `You're building a consensus-EPS feature from a vendor table of (estimate_date, analyst_id, ticker, fiscal_period, eps_estimate) -- one row every time any analyst issues or revises an estimate. You need "the consensus (average) next-quarter EPS estimate as of date d" for every d in your backtest, with no lookahead. Walk me through building it, and name the classic mistake.`,
    thinking: `Consensus as of date d is not "the average of estimates dated d" -- most analysts don't revise on any given day, so that would silently drop everyone who last spoke up a week ago. What you actually want, per analyst, is their most recently issued estimate that is still valid as of d -- an as-of hold, exactly the same shape as a merge_asof but applied per analyst -- and then average those held values across all analysts who are still "live" as of d. The classic bug is computing consensus only from estimates that changed on day d: that makes the average move based on who happened to revise that day rather than reflecting the true blended view of every covering analyst, and it understates the number of contributing analysts. The second sharp edge is coverage decay: an analyst who quietly stopped covering the name two years ago still has an old row sitting in the table -- with a naive forward-fill you'd keep including their frozen, stale number forever, so you need an explicit staleness cutoff or a coverage-end signal.`,
    answer: `Per analyst, forward-fill their latest estimate forward through time (an as-of hold, not a rolling average of that day's revisions), then average across analysts still within a staleness window as of date d. The classic mistake is averaging only same-day revisions, which makes consensus swing based on who happened to update rather than reflecting all covering analysts' current views. Apply a cutoff (e.g. drop estimates older than about 90 days) so an analyst who stopped covering the name doesn't silently keep contributing a frozen number indefinitely.`,
    python: `import pandas as pd

raw = pd.DataFrame({
    "estimate_date": pd.to_datetime(["2026-01-05", "2026-02-10", "2026-01-20"]),
    "analyst_id":    ["A1", "A1", "A2"],
    "eps_estimate":  [2.10, 2.15, 2.05],
})

daily = pd.date_range(raw["estimate_date"].min(), "2026-03-01", freq="D")

# per analyst: hold the latest estimate forward -- an as-of fill, not a mean
wide = (raw.pivot(index="estimate_date", columns="analyst_id", values="eps_estimate")
           .reindex(daily)
           .ffill(limit=90))          # staleness cutoff: drop coverage after 90 stale days

# consensus = mean across analysts STILL live that day, ignoring dropped coverage
consensus = wide.mean(axis=1, skipna=True)
n_contributors = wide.notna().sum(axis=1)   # sanity-check: coverage shouldn't collapse to 1`,
    trap: `Grouping the raw table by estimate_date and averaging same-day rows to build the daily series. On days with zero revisions the consensus goes missing entirely, and even on active days it excludes every analyst who isn't revising that particular day -- both understate true coverage breadth.`,
    followUp: `A single analyst is a wild outlier on one estimate (a fat-finger 20.00 instead of 2.00). Should the consensus feature use a mean or a median across analysts, and how does that choice change the lookahead-safety of your as-of hold?`,
  },
  {
    id: "qr-pit-20260816-data-latency-production-mismatch",
    module: "pit",
    title: "Matching your backtest's data latency to production",
    difficulty: "warmup",
    question: `Your backtest uses end-of-day vendor files that land in your S3 bucket at 6pm ET, fully adjusted and cleaned, and assumes you can trade at that day's close. In production the same vendor's live feed for that day's close isn't available until 7:30pm, after most crossing networks have shut for the day. Is this a point-in-time bug, and how do you fix the backtest?`,
    thinking: `This is the same lookahead category as every other PIT bug in this module, wearing an operational-latency costume instead of a data-revision one: the backtest assumes a piece of information -- today's official close -- is actionable at a moment it, in fact, is not actionable in production. The fix follows the usual template: identify the TRUE availability timestamp, not the value's nominal as-of timestamp but when it was actually usable to place a trade, and shift your simulated decision point to match it. Concretely here, if the real close isn't tradeable-against until 7:30pm, the backtest should either execute at the next session's open instead of same-day close, or use whatever earlier, genuinely available price you'd realistically trade against. The tell that this bug exists at all is a mismatch between what a research file contains and what a trading system can act on -- always ask the operations question, not just the data question, before trusting any close-of-day price as a fill.`,
    answer: `Yes -- it's a lookahead bug: the backtest trades against a price it wouldn't actually have access to in time. Fix it by shifting the simulated execution point to match the real availability latency -- execute at the next session's open instead of same-day close, or use an earlier, genuinely tradeable price. The general rule: model the true "available and actionable" timestamp for every input, not its nominal as-of timestamp.`,
    trap: `Fixing this by re-timestamping the historical data to 7:30pm and leaving the rest of the backtest logic ("execute at the close price") unchanged. The backtest still trades AT the official close price, just with a later label -- the actual executable price at 7:30pm, after most venues have closed, may be materially different from or unavailable relative to that reported close.`,
    followUp: `How would you detect this class of bug systematically across a whole research codebase, rather than catching it one signal at a time? (Compare backtested Sharpe on a signal known to use only genuinely real-time inputs against the same signal built from the research-convenient EOD files; a persistent, unexplained gap between the two is often exactly this latency leak.)`,
  },
  {
    id: "qr-pit-20260817-macro-data-vintages",
    module: "pit",
    title: "Macro data vintages: using the originally-published GDP print, not the revised one",
    difficulty: "hard",
    question: `Your signal uses quarterly US GDP growth as a macro feature. The vendor feed you're pulling from gives you the LATEST revised GDP figure for every historical quarter. Why is that a lookahead problem even though GDP itself is dated correctly, and how do you fix it?`,
    thinking: `GDP, like most macro series, gets revised multiple times after its first release -- an advance estimate, then a second and third estimate, then annual and sometimes benchmark revisions years later, and the number can move meaningfully between vintages. A standard vendor feed typically overwrites history with the latest revision, so when you pull "Q2 2024 GDP" today you get the number as currently understood, not the number that was actually publicly known back when Q2 2024 GDP was first reported in mid-2024. Even though the row is correctly dated to Q2 2024, using that revised figure to build a signal you'd have traded on the day it was released is lookahead -- you're conditioning on information that didn't exist yet at that point in time. The fix is a real-time or "vintage" data source (ALFRED, the real-time archive alongside FRED, is the standard example) that lets you pull the value AS IT WAS PUBLISHED as of any given as-of date, and merge_asof that against your own historical dates using the release date, not the reference period end date, as the join key.`,
    answer: `The GDP row is dated correctly to its reference quarter, but a feed that overwrites history with the latest revision hands you information you couldn't have had on the day it was actually released -- classic lookahead even though the date label looks fine. Fix it with a real-time vintage source (like ALFRED alongside FRED) that returns the value as originally published, and join using the release date as the as-of key, not the reference-period date.`,
    python: `import pandas as pd

# vintage_data: each row is one (reference_quarter, release_date, value_as_published)
# combination -- a proper real-time archive keeps EVERY revision, not just the latest
vintages = pd.DataFrame({
    "reference_quarter": pd.to_datetime(["2024-04-01", "2024-04-01", "2024-04-01"]),
    "release_date": pd.to_datetime(["2024-07-25", "2024-08-29", "2024-09-26"]),
    "gdp_growth": [2.8, 3.0, 3.0],  # advance, second, third estimate -- moved on revision
})

trading_dates = pd.DataFrame({"date": pd.date_range("2024-07-01", "2024-10-01", freq="B")})

# as-of join keyed on RELEASE date -- each trading day gets whatever
# vintage was actually public knowledge on that day, never a future revision
merged = pd.merge_asof(
    trading_dates.sort_values("date"),
    vintages.sort_values("release_date"),
    left_on="date", right_on="release_date", direction="backward",
)`,
    trap: `Assuming a reporting LAG (like shifting by 30 days) fixes this the way it does for earnings. A fixed lag doesn't help because the problem isn't timing, it's which VALUE you're using -- you need the actual historical vintage value, not just a delayed copy of today's revised number.`,
    followUp: `What if you don't have access to a real-time vintage archive for a series you need? (Approximate by lagging conservatively past the typical revision-settling window and accept the feature is noisier and less precise than a true vintage feed, or drop the series if the revision magnitude is large relative to its signal.)`,
  },
  {
    id: "qr-pit-20260818-index-reconstitution",
    module: "pit",
    title: "Index reconstitution: announcement date vs effective date",
    difficulty: "hard",
    question: `S&P Dow Jones announces on a Thursday after the close that a stock will be added to the S&P 500, effective the following Monday. Your backtest includes the stock in the S&P 500 universe starting Thursday's close instead of Monday's. What bias does this introduce, and why is it worse than it sounds?`,
    thinking: `This is a lookahead bias that's easy to miss because both dates are "real" and both live in your reference data -- the mistake is picking the wrong one as the universe-membership cutoff, not inventing a fake date. Index additions are well known to run up in price BETWEEN the announcement and the effective date, because index funds and closet indexers have to buy in size and the whole market front-runs that mechanical flow. If your universe flags the stock as an S&P 500 member starting at the announcement, any index-relative feature you compute over that window (its beta to the index, its correlation to index members, a value or momentum rank against the S&P universe) picks up return behavior that's a direct consequence of information the model wasn't supposed to have yet -- the announcement itself. A live process couldn't have traded the stock as an S&P 500 constituent, or benchmarked it as one, until Monday's effective date, so any earlier inclusion manufactures performance out of a period where you're conditioning on future public information about future flows.`,
    answer: `Flagging membership from the announcement date instead of the effective date lets the backtest "see" the stock as an index member during exactly the window when it's getting a mechanical, well-documented run-up from anticipatory index-fund buying -- a real, known effect (the index-inclusion premium), not noise. The universe-membership timestamp needs to be the effective date, matching what a live process could actually trade against; treating the announcement date as the cutoff manufactures returns off public information the model shouldn't be conditioning on yet.`,
    python: `import pandas as pd

announce_date = pd.Timestamp("2026-08-20")   # Thursday, after close
effective_date = pd.Timestamp("2026-08-24")  # following Monday

dates = pd.date_range("2026-08-18", "2026-08-26", freq="B")

# correct: membership starts at the EFFECTIVE date, not the announcement
is_member = pd.Series(dates >= effective_date, index=dates, name="is_sp500_member")

# the wrong version a lookahead bug would produce, shown for contrast
is_member_wrong = pd.Series(dates >= announce_date, index=dates)

drift_days = int((is_member != is_member_wrong).sum())
print(f"{drift_days} days mislabeled as index members under the wrong cutoff")`,
    trap: `Assuming this only matters for index-tracking strategies. It also silently pollutes any cross-sectional feature that conditions on "is this an S&P 500 name" -- sector-neutral or index-relative z-scores computed over the announcement-to-effective window get contaminated by the same anticipatory flow.`,
    followUp: `What if your reference data vendor only gives you ONE membership date field and you can't tell whether it's announcement or effective? (Treat it as suspect and cross-check against a second source or the index provider's own press release archive -- silently trusting an unlabeled date field here is exactly how this bias sneaks into production.)`,
  },
  {
    id: "qr-pit-20260819-allow-exact-matches",
    module: "pit",
    title: "merge_asof's allow_exact_matches: same-timestamp data isn't always available yet",
    difficulty: "core",
    question: `You join intraday trade signals to the most recent news-sentiment score using pd.merge_asof(trades, sentiment, on="ts", direction="backward"). Both feeds are occasionally stamped with the identical timestamp because your ingestion layer rounds to the nearest second. Is a sentiment row with the same timestamp as a trade row safe to use for that trade?`,
    thinking: `merge_asof with direction="backward" and its default allow_exact_matches=True treats a right-row timestamped exactly equal to the left row as eligible -- "at or before" includes "at." That's correct when the equal timestamps genuinely represent the same instant of availability, e.g. two exchange-official timestamps. But here the equality is an artifact of ROUNDING to the nearest second, not evidence the sentiment score was actually published before the trade -- the news pipeline could easily have finished 400ms AFTER the trade's true sub-second timestamp, with rounding just happening to collide them onto the same second. Allowing that tie is a live PIT-violating leak dressed up as a coincidence of clock granularity. Fix: preserve finer-grained timestamps before the join so genuine ties become rare, or, if rounding is unavoidable, set allow_exact_matches=False so a tie never counts as available, forcing the join to fall back to the last row strictly before -- conservative, but never wrong in the leaking direction.`,
    answer: `Not necessarily. allow_exact_matches=True (the default) treats a tie as "available at or before," correct only if the identical timestamp reflects genuine simultaneous availability. Here the tie is a rounding artifact -- the sentiment score's true computation time is unknown and could easily be after the trade's true sub-second timestamp. Two fixes: preserve full-precision timestamps before the join so exact ties become rare and meaningful, or set allow_exact_matches=False so any tie falls back to the last row strictly before it -- conservative but never leaks.`,
    python: `import pandas as pd

trades = pd.DataFrame({
    "ts": pd.to_datetime(["2026-08-19 09:30:01", "2026-08-19 09:30:05"]),
    "trade_id": [1, 2],
})
sentiment = pd.DataFrame({
    "ts": pd.to_datetime(["2026-08-19 09:30:01", "2026-08-19 09:30:04"]),
    "score": [0.42, 0.55],
})
# both timestamps got rounded to the nearest second upstream -- the 09:30:01
# tie could really be sentiment-after-trade at sub-second resolution

# default: the tie at 09:30:01 counts as "available" -- may leak
leaky = pd.merge_asof(trades, sentiment, on="ts", direction="backward")

# conservative: a tie never counts as available; falls back to the prior row
safe = pd.merge_asof(
    trades, sentiment, on="ts", direction="backward", allow_exact_matches=False,
)
# trade_id 1 now gets NaN (nothing strictly before it) instead of a score
# that might not have existed yet -- an honest gap beats a maybe-leaked value`,
    trap: `Assuming allow_exact_matches only matters for genuinely simultaneous, well-defined events (two prints from the same exchange feed with identical official timestamps). Whenever either side's timestamp went through rounding, truncation, or batching upstream, an exact match stops being evidence of true ordering and becomes evidence of coincidental bucketing -- the default's permissiveness quietly inherits whatever precision was lost earlier in the pipeline.`,
    followUp: `You switch to allow_exact_matches=False and sentiment coverage drops noticeably, since genuine same-second events get excluded along with the coincidental ones. What's a better long-term fix than living with the conservative-but-lossy setting? (Fix it upstream -- preserve sub-second or monotonic sequence-number timestamps through ingestion instead of rounding, so ties become rare and, when they occur, are actually meaningful simultaneity rather than a granularity artifact.)`,
  },
  {
    id: "qr-pit-20260820-macro-data-revisions",
    module: "pit",
    title: "First-print vs revised macro data (non-farm payrolls)",
    difficulty: "hard",
    question: `You backtest a strategy that trades off the monthly US non-farm payrolls number, joined onto your daily panel by the release date. Your vendor's database stores only the CURRENT (most revised) value for each reference month, not what was originally reported. Why is this a point-in-time violation even though you correctly used the release date for the join, and how large is the problem typically?`,
    thinking: `Separate the two axes explicitly, because getting the date right while getting the VALUE wrong is exactly the trap here. You can nail the availability-vs-effective-date discipline from earlier in this module -- joining on release date, not reference month -- and still leak the future, because the number itself gets revised in subsequent releases (and sometimes for years, via annual benchmark revisions) as more complete survey data comes in. So a "January payrolls" figure sitting in a current-snapshot database is not the number the market actually saw on the January release date -- it is a later, more accurate estimate substituted into that date's row. This is exactly the earnings-restatement problem generalized to macro data, and it is often worse in relative magnitude for payrolls specifically: the initial print is famously noisy, routinely revised by 50,000 or more jobs across the following two releases -- large enough, relative to the number's typical market-moving surprise versus consensus, to flip the sign of what a live trader's signal would have read on the actual release date.`,
    answer: `The join is date-correct (release date, not reference month) but value-incorrect: current vendor databases typically store the latest-revised figure, not what was actually released that day, and payrolls revisions are large relative to typical market-moving surprises -- routine revisions of 50,000-plus jobs across the following two releases can flip the sign of "actual versus consensus" a live trader would have seen. This is the fundamentals-restatement problem generalized to macro data: you need a vintage (real-time) macro dataset such as ALFRED, which stores every historically-released vintage of each series, and join on release date using the vintage that existed as of that date -- never today's fully-revised value.`,
    python: `import pandas as pd

# vintages: append-only, one row per (reference_month, release_date, value).
# every time payrolls for a given month gets revised, a NEW row is added
# with a new release_date -- nothing is ever overwritten (same discipline
# as the earnings-restatement fundamentals table earlier in this module)
vintages = pd.DataFrame({
    "reference_month": pd.to_datetime(["2026-01-31"] * 3),
    "release_date": pd.to_datetime(["2026-02-06", "2026-03-06", "2026-04-03"]),
    "payrolls_change": [180_000, 210_000, 225_000],   # revised UP twice
})

def payrolls_asof(vintages, asof_date):
    known = vintages[vintages["release_date"] <= asof_date]
    return known.sort_values("release_date").groupby("reference_month").tail(1)

# a strategy trading on Feb 6 saw 180,000 -- NOT the 225,000 a current
# snapshot database would hand it if joined on release_date alone
feb6_view = payrolls_asof(vintages, pd.Timestamp("2026-02-06"))
today_view = payrolls_asof(vintages, pd.Timestamp("2026-08-20"))`,
    trap: `Assuming the release-date join alone is sufficient PIT discipline because "the timing is right". Timing correctness and value correctness are independent failure modes -- you can pass every check in the earlier "what does the date on a row mean" card and still be trading on a number that did not exist yet, because the row's DATE was right but its VALUE was silently overwritten by history.`,
    followUp: `Your vintage database only goes back 5 years, but you want to backtest 20 years of history. What is the defensible way to proceed for the older years where no vintage data exists, and what caveat must accompany any results from that period? (Use the current fully-revised value as a documented approximation for the pre-vintage years while flagging that period's results as carrying unknown-but-likely-positive lookahead bias, and cross-check whether the strategy's edge concentrates in the un-vintaged era versus the vintage-verified era -- concentration in the old data is a specific red flag, not proof of a larger real edge.)`,
  },
  {
    id: "qr-pit-20260821-cached-feature-lookahead",
    module: "pit",
    title: "The cached-feature lookahead: memoizing a rolling feature over full history",
    difficulty: "hard",
    question: `To speed up your walk-forward research loop, an engineer precomputes every rolling feature ONCE over the entire 15-year history and saves it to a parquet file that every fold then reads from. The features themselves use only trailing windows -- rolling(252).mean(), properly shift()-ed. Each individual fold's train/test split still looks correct. Is the cached file actually point-in-time safe, and if not, where exactly does the leak enter?`,
    thinking: `Separate two different questions that look like the same question. Is each row of the cached feature computed only from data at or before its own date? Yes, by construction, since the rolling window and shift are both correctly trailing. But that is not the same claim as: was the feature-building PROCESS itself blind to the future when it ran? It was not -- the engineer's precompute step touched the entire 15 years of raw data in one pass before any fold's training window even begins, which matters the moment any step in that pipeline uses information beyond a single row's own trailing window. The classic way this bites: if the rolling feature construction includes any full-panel step upstream -- dropping tickers whose full-history feature coverage was "too sparse to bother with", say, or fitting a scaler once on the whole file -- that decision was made using information about how each ticker behaves for its ENTIRE life, including years after some folds' test periods. A ticker's inclusion or exclusion in an early fold should be decidable using only information available through that fold's own cutoff, and a single upfront precompute pass has no fold boundaries to respect. The rolling math per row can be flawless while the file it's baked into is not reproducible by any point-in-time system, because a live system builds the cache incrementally and never gets to see which tickers turn out sparse before they've had the chance to be dense.`,
    answer: `Row-level correctness -- each value using only its own trailing window -- is necessary but not sufficient for point-in-time safety in a cached, precomputed file. The risk is in decisions made ACROSS the whole file during the one-time build, not within any single row's formula. The classic leak: any full-history filtering or fitting step upstream of the per-row rolling math -- dropping tickers with sparse full-history coverage, fitting a scaler once on the entire panel -- uses information from years after an early fold's cutoff to decide what that early fold even gets to see. The fix is either rebuilding the cache incrementally per fold, or auditing every step of the precompute pipeline for full-panel operations and replacing each with a fold-respecting equivalent, then re-running the mechanical truncation audit on the CACHE ITSELF, not just the per-row formula.`,
    python: `import pandas as pd

# leaky precompute: individually correct rolling math, wrapped in a
# full-panel filtering step that uses the ENTIRE 15-year history
def build_feature_cache_leaky(panel: pd.DataFrame) -> pd.DataFrame:
    # "drop tickers with too little history" -- decided using each ticker's
    # FULL LIFETIME coverage, years beyond any early fold's cutoff
    coverage = panel.groupby("ticker")["close"].count()
    keep = coverage[coverage > 500].index          # an early fold doesn't yet
    panel = panel[panel["ticker"].isin(keep)]       # know this ticker will thrive

    panel = panel.sort_values(["ticker", "date"])
    panel["mom"] = (panel.groupby("ticker")["close"]
                    .transform(lambda s: s.pct_change(252).shift(1)))  # row-level: fine
    return panel

# safe precompute: any filtering decision must itself be made per fold,
# using only data available as of that fold's own cutoff -- so the cache
# stores raw rolling features for EVERY ticker ever seen, and universe
# membership is applied downstream, per fold, not baked in
def build_feature_cache_safe(panel: pd.DataFrame) -> pd.DataFrame:
    panel = panel.sort_values(["ticker", "date"])
    panel["mom"] = (panel.groupby("ticker")["close"]
                    .transform(lambda s: s.pct_change(252).shift(1)))
    return panel   # no full-history filtering baked in anywhere

def universe_as_of(cache: pd.DataFrame, cutoff: pd.Timestamp) -> set:
    seen_so_far = cache[cache["date"] <= cutoff]
    coverage = seen_so_far.groupby("ticker")["mom"].count()
    return set(coverage[coverage > 200].index)   # decided using ONLY the past`,
    trap: `Treating the mechanical truncation audit from the earlier lookahead-detection card as sufficient because it was run once on the per-row feature function and passed. That audit proves the rolling math is trailing-only; it does not prove the cached file built around that math is fold-safe, because a one-time precompute-and-cache step is exactly the kind of full-panel operation that sits invisibly upstream or downstream of the function actually being tested.`,
    followUp: `The team decides the fix is simplest as "just rebuild the cache fresh for every fold, from only the data available as of that fold's cutoff." What does that do to the original performance motivation for caching, and is there a middle ground? (It mostly defeats the speed purpose, since each fold now re-reads and re-computes from scratch; a middle ground is caching the raw per-row rolling features -- which ARE safe, since each row's formula is trailing-only -- while forcing every full-panel decision, like universe filtering or scaler fitting, to run fresh per fold on top of the safe cache, isolating the expensive-but-safe part from the cheap-but-leaky part.)`,
  },
];
