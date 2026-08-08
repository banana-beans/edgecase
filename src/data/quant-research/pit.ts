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
];
