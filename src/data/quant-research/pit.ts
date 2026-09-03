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
  {
    id: "qr-pit-20260822-differential-reporting-lag",
    module: "pit",
    title: "Differential reporting lag across market cap: one fixed lag is itself a look-ahead problem",
    difficulty: "hard",
    question: `Your point-in-time pipeline applies a fixed 90-day lag to fundamentals before they enter the universe, a common conservative buffer for the SEC's 10-K filing deadline. A large-cap tech company actually reports 30 days after quarter-end; a small-cap reports 89 days after quarter-end, right at its deadline. What's wrong with using the fixed 90-day lag for both, and what does that do to a fundamentals-based strategy's backtest?`,
    thinking: `A single fixed lag is calibrated to the slowest legal filer in the universe -- small and micro caps get up to 90 days under SEC rules, large accelerated filers must report within 60, and many large caps report well before their own deadline. Applying that lag uniformly does not create look-ahead for the fast reporters, look-ahead would need a lag too SHORT, not too long. It does the opposite: large-cap fundamentals that were genuinely public on day 30 don't enter your point-in-time dataset until day 90, so the model is needlessly starved of real, legitimately available information for 60 extra days. That biases the backtest toward whatever fundamentals were true two months later than they needed to be, understating how fast a fundamentals strategy could actually react and understating its achievable Sharpe. The fix is joining on each filing's actual report date, which point-in-time datasets like Compustat/WRDS carry directly, rather than an assumed calendar offset from quarter-end -- with only a small residual buffer left for vendor ingestion lag, not the whole spread between filer types.`,
    answer: `A fixed 90-day lag is calibrated to the slowest legal filer, so for a large cap that actually reports in 30 days it doesn't create look-ahead -- look-ahead would need too SHORT a lag. It does the opposite: it withholds real, already-public information for 60 extra days, understating how quickly a fundamentals strategy could have reacted and biasing backtest timing and Sharpe downward for exactly the names that report fastest. The fix is to join fundamentals on each filing's actual report date rather than quarter-end plus an assumed offset, keeping only a small residual buffer for vendor-ingestion lag.`,
    python: `import pandas as pd

# fundamentals: one row per company per quarter, with the field a
# point-in-time vendor actually provides: the real filing date
fundamentals = pd.DataFrame({
    "ticker": ["BIGTECH", "SMALLCAP"],
    "quarter_end": pd.to_datetime(["2026-06-30", "2026-06-30"]),
    "filed_date": pd.to_datetime(["2026-07-30", "2026-09-27"]),  # 30 vs 89 days
    "eps": [2.10, 0.15],
})

# WRONG: one fixed lag applied to everyone, calibrated to the slowest filer
fixed_lag = fundamentals.assign(
    available_date=fundamentals["quarter_end"] + pd.Timedelta(days=90)
)
# BIGTECH's eps is treated as unavailable until day 90, even though it
# was public on day 30 -- needless information starvation, not safety

# RIGHT: join on the actual filing date, plus a small ingestion buffer
ingestion_buffer = pd.Timedelta(days=1)   # vendor processing/latency only
pit_correct = fundamentals.assign(
    available_date=fundamentals["filed_date"] + ingestion_buffer
)

print(fixed_lag[["ticker", "available_date"]])
print(pit_correct[["ticker", "available_date"]])
# BIGTECH becomes available 59 days earlier under the correct join --
# real information the fixed-lag version was needlessly discarding`,
    trap: `Assuming a conservative, long fixed lag can only ever be "safe" because it can't leak the future. It genuinely can't leak, but it silently degrades backtest realism in the opposite direction, and a review that only ever checks for look-ahead (a lag too short) misses this failure mode of an undifferentiated lag that's too long entirely.`,
  },
  {
    id: "qr-pit-20260823-ttm-restatement-propagation",
    module: "pit",
    title: "A single restated quarter propagates through a trailing-twelve-month feature",
    difficulty: "hard",
    question: `You compute trailing-twelve-month (TTM) revenue as the sum of the last four reported quarters. Three quarters later, the company restates one of those four quarters' revenue. Should your point-in-time TTM series for all the historical dates that included the original quarter now be revised to reflect the restated value?`,
    thinking: `Separate two different questions that get conflated: "what is the best current estimate of TTM revenue as of today" versus "what did the model actually know on some historical date in the past." For point-in-time backtest correctness, only the second question matters, and the answer is no -- a historical TTM value computed on a date before the restatement happened must keep using the ORIGINAL, never-revised quarterly figure that was genuinely available at that time, even though it's since been proven wrong. Retroactively swapping in the restated number injects information into the past that did not exist yet, which is look-ahead bias exactly as much as revising a single quarter's raw figure would be -- a derived multi-quarter feature is not somehow exempt just because it's a sum rather than a single reported line. The correct architecture carries a vintage axis (when a figure was released or revised) fully separate from the period axis (which quarter it describes), and reconstructs each historical TTM value using only vintages that existed as of that date -- while a SEPARATE "current-vintage" TTM series, freely using every restatement, is legitimate for today's live valuation work, just not for anything measuring what a historical strategy could have known.`,
    answer: `No -- historical TTM values from before the restatement must keep the original quarterly figure that was actually available then, even though it was later proven wrong. Revising a past TTM sum to use a not-yet-existent restated number is look-ahead bias, just applied to a derived multi-quarter feature instead of a single reported line; a sum of point-in-time inputs is not exempt from point-in-time discipline. The fix is a vintage-axis architecture (when a number was released or revised, kept separate from which period it describes) that reconstructs each historical date's TTM using only vintages that existed as of that date, while a separate current-vintage TTM series can freely use every restatement for today's live analysis.`,
    python: `import pandas as pd

# vintage table: each row is one PRINT of a quarter's revenue, tagged
# with the date it became known -- the same quarter can appear twice
vintages = pd.DataFrame({
    "quarter_end": pd.to_datetime(["2025-03-31", "2025-06-30", "2025-06-30",
                                     "2025-09-30", "2025-12-31"]),
    "release_date": pd.to_datetime(["2025-04-29", "2025-07-30", "2026-03-01",  # Q2 original, then restated
                                      "2025-10-29", "2026-01-28"]),
    "revenue": [90.0, 100.0, 92.0, 105.0, 110.0],   # Q2'25 restated 100 -> 92, on 2026-03-01
})

def ttm_as_of(as_of: pd.Timestamp, quarters_needed: list) -> float:
    # for each quarter, take the LATEST vintage released on or before as_of --
    # never a vintage released after the as_of date being reconstructed
    total = 0.0
    for q in quarters_needed:
        known = vintages[(vintages["quarter_end"] == q) & (vintages["release_date"] <= as_of)]
        total += known.sort_values("release_date")["revenue"].iloc[-1]
    return total

fy2025_quarters = pd.to_datetime(["2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31"])

# reconstructing TTM as of a date BEFORE the Q2'25 restatement: must use 100.0
print(ttm_as_of(pd.Timestamp("2026-02-01"), fy2025_quarters))   # 405.0 -- original 100.0
# reconstructing TTM as of TODAY: correctly uses the restated 92.0
print(ttm_as_of(pd.Timestamp("2026-08-23"), fy2025_quarters))   # 397.0 -- restated 92.0`,
    trap: `Storing fundamentals as a single mutable "current value per quarter" table that gets overwritten in place whenever a restatement arrives. That destroys the original print entirely, so any historical TTM value recomputed later has no choice but to use the restated number -- the look-ahead isn't a logic bug at that point, it's baked into the data model itself, and no query-time fix can recover information the ETL step already discarded.`,
  },
  {
    id: "qr-pit-20260824-purged-walk-forward-label-leakage",
    module: "pit",
    title: "Purging a walk-forward split when the label horizon crosses the cutoff",
    difficulty: "hard",
    question: `You're training a model to predict 20-day forward returns, walk-forward style: fit on everything up to date T, test on everything after T. A row dated T minus 5 needs prices through T plus 15 to compute its label, which is after the fit cutoff -- but you included it in training anyway since its FEATURE date is safely before T. What went wrong, and how do you fix the split boundary?`,
    thinking: `The feature date being before the cutoff feels safe, but that's checking the wrong timestamp. The LABEL for that row was computed using prices through T+15 -- information that doesn't exist yet as of T -- so a chunk of your "training" set near the boundary secretly encodes what happens just after the cutoff you're claiming to test out-of-sample on. This is a purging problem, not a plain-cutoff problem, the core idea behind purged walk-forward / purged k-fold splits: every row has an EVENT SPAN, not just a point in time -- here, row_date through row_date plus 20 -- and the correct rule is to drop from training any row whose event span overlaps the test period at all, not just rows whose row_date is literally after the cutoff. Concretely with a 20-day label and test starting at T+1, you must purge roughly the last 20 days of training data before T. An additional embargo just after the boundary is standard practice too, guarding against features that themselves look backward across it.`,
    answer: `The bug is that the label's horizon extends past the row's own date, so rows near the cutoff have labels computed using information from after that cutoff -- a look-ahead hidden entirely inside label construction, invisible if you only check feature dates. The fix is purging: drop every training row whose full label window (row_date to row_date+20 here) overlaps the test period, not merely rows whose date comes after the cutoff -- concretely, drop roughly the last 20 days of training before the boundary. Many practitioners also add a short embargo just after the boundary, in case features themselves look backward across it too.`,
    python: `import pandas as pd

def purged_train_mask(dates: pd.DatetimeIndex, cutoff: pd.Timestamp, label_horizon_days: int) -> pd.Series:
    # a row is safe for training only if its ENTIRE label window
    # (row_date -> row_date + horizon) resolves before the test period starts
    label_end = dates + pd.Timedelta(days=label_horizon_days)
    return label_end < cutoff   # strictly before, not just row_date < cutoff

dates = pd.date_range("2026-01-01", periods=60, freq="D")
cutoff = pd.Timestamp("2026-02-15")   # test starts the day after this

naive_train = dates < cutoff                              # WRONG: checks only feature date
purged_train = purged_train_mask(dates, cutoff, 20)        # RIGHT: checks the label's span

# the rows dropped by purging but kept by the naive mask are exactly the
# ones whose 20-day-forward label secretly reaches into the test period
leaking_rows = dates[naive_train & ~purged_train]`,
    trap: `Purging only by feature date and treating a plain date cutoff as automatically safe, whenever any label has a forward-looking horizon longer than zero. The leak is invisible in a feature-only audit because the feature values themselves are perfectly legitimate as-of their date -- it's the label, computed later in the pipeline, that quietly reaches past the cutoff.`,
    followUp: `Your features also include a 10-day trailing rolling average. Does the training set need an embargo on the OTHER side of the cutoff too, and why would a rolling feature computed near the boundary matter for a model tested strictly after it?`,
  },
  {
    id: "qr-pit-20260825-partial-bar-lookahead",
    module: "pit",
    title: "Computing a feature off a bar that hasn't closed yet",
    difficulty: "hard",
    question: `Your research backtest computes a 5-minute momentum feature using each 5-minute bar's close, then trades at the START of the next bar. In production, the live system computes the "current 5-minute bar's close" using whatever the last print is AT THE MOMENT the trading decision fires -- which is partway through that bar, not after it closes. What's the mismatch, and why does the backtest look better than production as a result?`,
    thinking: `Notice that the backtest and the live system are silently answering two different questions with the same variable name. In the backtest, "this bar's close" means the price after the full five minutes of information has arrived -- genuinely final, genuinely knowable only once the bar is over. In production, if the decision fires two minutes into the bar, "current bar's close" is being read off a bar that is still accumulating trades -- it's really "the last print so far," a moving target that will keep changing for three more minutes, not the settled value the backtest trained and tested against. That's a subtle look-ahead in the opposite direction from the usual kind: the backtest isn't cheating by seeing a future timestamp, it's implicitly assuming a full bar's worth of information is available exactly when it isn't yet in real time, so backtested performance embeds an unrealistic latency advantage relative to what production can ever actually deliver. The fix is to make the backtest use the SAME rule as production: the feature at decision time T should only ever be built from a bar that fully closed strictly before T, with an explicit propagation lag for when that closed bar's data actually becomes available to the strategy.`,
    answer: `The backtest computes each bar's close after that bar has fully finished, but the live system reads "current bar's close" mid-bar, off an incomplete, still-changing print -- so live decisions are made with strictly less information than the backtest assumed was available at that same relative moment. That's a look-ahead baked into the backtest's timing model, not its data: it implicitly assumes full-bar information arrives instantly at bar-close, which production can never match. Fix by defining the feature at decision time T as using only the most recently fully closed bar strictly before T, with an explicit data-availability lag matching how quickly a closed bar's data actually reaches the live strategy.`,
    python: `import pandas as pd

bars = pd.DataFrame({
    "bar_start": pd.date_range("2026-08-25 09:30", periods=6, freq="5min"),
    "close": [100.0, 100.4, 100.9, 100.6, 101.1, 101.3],
})
bars["bar_end"] = bars["bar_start"] + pd.Timedelta(minutes=5)

def feature_at(decision_time: pd.Timestamp) -> float:
    # RIGHT: only bars that fully closed strictly before decision_time
    # are eligible -- matches what production can actually see
    closed = bars[bars["bar_end"] <= decision_time]
    if closed.empty:
        return float("nan")
    return closed["close"].iloc[-1]

# WRONG (what a naive backtest does implicitly): decision fires 2 minutes
# into a bar, but the backtest just grabs that bar's FINAL close anyway --
# information that in production wouldn't exist for 3 more minutes
decision_time = pd.Timestamp("2026-08-25 09:47")   # 2 min into the 09:45 bar
wrong_feature = bars.loc[bars["bar_start"] <= decision_time, "close"].iloc[-1]
right_feature = feature_at(decision_time)

print("backtest-style (leaks the still-forming bar):", wrong_feature)
print("production-honest (last fully closed bar):   ", right_feature)`,
    trap: `Believing this can't be lookahead because you never touched a future timestamp -- the bar's own label is still in the past relative to the decision time. The leak isn't in the timestamp, it's in the VALUE: the "close" field for the current, still-forming bar keeps changing until the bar actually ends, so reading it mid-bar means reading information that, at that clock moment, doesn't exist yet.`,
    followUp: `Your data vendor also has its own propagation lag -- a bar that closes at 9:45:00 doesn't actually land in your database until 9:45:03. How do you fold that into feature_at, and what happens to a strategy's backtested Sharpe once you do?`,
  },
  {
    id: "qr-pit-20260826-split-announced-not-effective",
    module: "pit",
    title: "A split is announced but not yet effective: when do prices actually need adjusting?",
    difficulty: "hard",
    question: `A company announces a 2-for-1 stock split on March 1st, with the split becoming effective (shares actually double, price actually halves) on March 15th. Your PIT pipeline is building a feature as of March 10th. Does the March 10th row need any split adjustment yet, and what breaks if you get the timing wrong in either direction?`,
    thinking: `Separate two different things: the split ADJUSTMENT FACTOR that makes a historical series continuous, versus what an as-of-March-10th observer actually knew. As of March 10th the split hasn't happened yet -- the stock is still trading at its pre-split price and share count, so the raw, unadjusted price on March 10th IS the correct point-in-time value; there's nothing to adjust yet because the economic event hasn't occurred. The subtlety runs the other direction: once March 15th arrives and you back-adjust all prior history for return continuity, that backward adjustment must not leak into what a March 10th snapshot would have shown a real observer -- your point-in-time store needs to reproduce the as-originally-reported price for that date even after you've adjusted everything for the continuous-series view. Getting this backwards either way breaks something: adjusting early fabricates a price cut that hasn't happened; never reconstructing the as-reported view corrupts any backtest claiming to simulate a live strategy.`,
    answer: `As of March 10th, nothing needs adjusting yet -- the split hasn't occurred, so the raw pre-split price IS the correct point-in-time value a live observer would have seen. The adjustment factor only needs to be applied retroactively to history once the split becomes effective on March 15th, to keep the return series continuous. The subtlety: your point-in-time database needs to reproduce the as-originally-reported price for a March 10th snapshot even after March 15th has passed and everything has been back-adjusted for the continuous-series view -- conflating "the adjustment that makes a chart look continuous today" with "what was actually knowable on a past date" corrupts a live-simulation backtest in either direction.`,
    python: `import pandas as pd

raw = pd.DataFrame({
    "date": pd.date_range("2024-03-08", periods=10),
    "price": [100.0] * 7 + [50.0] * 3,   # halves starting the effective date
})
raw["is_post_split"] = raw["date"] >= pd.Timestamp("2024-03-15")

# adjustment factor is 0.5 for every date BEFORE the effective date, so the
# backward-adjusted series is continuous across the split
raw["adj_factor"] = raw["is_post_split"].map({False: 0.5, True: 1.0})
raw["price_adjusted_for_charting"] = raw["price"] * raw["adj_factor"]

# but a live-as-of-March-10 snapshot must show the UNADJUSTED price --
# that's what a strategy running that day actually observed
as_of_mar10 = raw.loc[raw["date"] == "2024-03-10", "price"].iloc[0]
print("adjusted-for-charting view:", raw["price_adjusted_for_charting"].tolist())
print("what was truly known live on 2024-03-10:", as_of_mar10)  # 100.0, not 50.0`,
    trap: `Applying the split adjustment factor to the announcement date instead of the effective date, which fabricates a price change on a day the price didn't actually move -- or the opposite error, storing only the backward-adjusted series and losing the ability to reconstruct what was truly knowable point-in-time, which silently corrupts any backtest claiming to simulate a live strategy rather than produce a clean chart.`,
    followUp: `Your data vendor's "adjusted close" field is already back-adjusted for all known splits as of today, with no way to recover the as-originally-reported value. What does that limit you from doing correctly, and how would you work around it?`,
  },
  {
    id: "qr-pit-20260827-edgar-acceptance-timestamp",
    module: "pit",
    title: "SEC EDGAR's acceptance timestamp vs the filing's cover-page date",
    difficulty: "hard",
    question: `You're building a point-in-time feature off 10-Q filings and your vendor gives you a "filing_date" column. A company's 10-Q for the quarter ended June 30 has a filing_date of August 5 in your data. Is August 5 actually when that data first became available to someone trading live, and what specifically would you check?`,
    thinking: `Separate the several distinct timestamps that can all reasonably be called "the filing date" and realize your vendor's field might be any of them. The 10-Q's cover page carries the period-end date (June 30), which tells you nothing about disclosure timing. Companies sometimes also state an intended filing date in their own metadata that can differ from when the filing actually posted. What actually matters for point-in-time correctness is the moment the document became publicly retrievable -- and SEC EDGAR distinguishes this precisely: every filing has an acceptance datetime, timestamped to the second, recorded in EDGAR's own header when the filing was accepted into the public system, versus a plain filing date that's just a calendar day with no intraday resolution. A filing accepted at 4:45pm ET is functionally same-day-close information for anyone trading that day, but one accepted at 6:15am the next calendar day should NOT be treated as available on the prior close even if a vendor field rounds it to a nearby date. If your vendor's "filing_date" is a rounded calendar day with no intraday timestamp, you can't tell which side of a trading-day boundary an evening filing actually falls on -- exactly the kind of one-day-early leak a PIT audit needs to catch.`,
    answer: `A vendor's single "filing_date" column often collapses several distinct timestamps -- the filing's period-end cover date, a company-stated intended date, and EDGAR's own second-resolution acceptance datetime -- and only the acceptance datetime tells you when the document actually became publicly retrievable. Pull EDGAR's acceptance timestamp directly rather than trusting a rounded calendar-day field; a filing accepted at 6:15am the next day must not be marked available on the prior close, which a date-only field can't distinguish from a 4:45pm same-day filing.`,
    trap: `Trusting a vendor's "filing_date" field as sufficiently precise just because it's a real date that roughly matches when the filing was made. Rounding an evening or after-hours acceptance timestamp to its calendar date silently manufactures a same-day information advantage the market didn't actually have, and this class of leak is invisible unless you specifically go pull EDGAR's own second-level acceptance timestamp to check.`,
    followUp: `Two 10-Qs for different companies are both accepted by EDGAR at 4:02pm ET, two minutes after the 4:00pm market close. Is that data available to a strategy trading the SAME day's close, the NEXT day's open, or somewhere in between -- and what does your PIT join need to encode to get this right systematically across thousands of filings rather than case by case?`,
  },
  {
    id: "qr-pit-20260828-10ka-amendment-restatement",
    module: "pit",
    title: "A silent 10-K/A amendment restating prior fundamentals eighteen months later",
    difficulty: "hard",
    question: `A company files a 10-K, then eighteen months later quietly files a 10-K/A (an amendment) restating two lines of the prior-year balance sheet -- no press release, and most vendor feeds don't flag it. Your point-in-time fundamentals pipeline keys off (ticker, fiscal_period, filing_date) and keeps the latest filing per period. What breaks, and how do you catch it?`,
    thinking: `"Keep the latest filing per period" is actually the right rule in principle -- once a restated figure exists, that IS the authoritative number, and you should eventually use it. The danger is entirely about WHEN it becomes available: if a vendor feed overwrites the field in place instead of preserving the 10-K/A's own filing_date as a new dated row, your as-of join reads the restated number as if it were known back at the original 10-K's filing date, eighteen months earlier than reality -- a silent lookahead that's invisible unless you specifically go looking for it, because nothing about the pipeline errors out. The fix is structural: store every filing as its own row with its own filing_date rather than overwriting a field, gate strictly on filing_date in the as-of join, and periodically diff two vendor snapshots pulled months apart for the same (ticker, period) to catch amendments the feed itself doesn't flag.`,
    answer: `The danger isn't using the restated number -- you should, once it genuinely exists -- it's a vendor feed that overwrites the field in place without preserving the 10-K/A's own filing_date, so your as-of join thinks the corrected figure was known eighteen months earlier than it actually was: a silent restatement leak. Store every filing as its own dated row rather than overwriting, gate strictly on filing_date in the join, and periodically diff two vendor snapshots pulled months apart for the same (ticker, fiscal_period) to catch amendments the feed doesn't explicitly flag.`,
    trap: `Trusting that "no amendment flag in the feed" means no amendment happened. Many vendors only flag a subset of restatement types -- for instance a material restatement requiring an 8-K Item 4.02 disclosure -- while a routine 10-K/A cleanup of two balance-sheet lines updates the underlying field with no flag at all.`,
    followUp: `Your backtest's Sharpe improves noticeably when you switch a feature built off this balance-sheet line from "value known at original filing date" to "latest known value, however dated." What does that improvement most likely tell you, and would you trust it?`,
  },
  {
    id: "qr-pit-20260829-short-interest-lag",
    module: "pit",
    title: "Short interest data's settlement-date vs publish-date reporting lag",
    difficulty: "core",
    question: `FINRA short interest data is reported for settlement dates roughly twice a month, but the actual numbers aren't published until about a week and a half after each settlement date. Your pipeline joins short interest to price data by settlement date. What's wrong with that, and how do you fix it for a backtest?`,
    thinking: `The settlement date describes WHEN the position existed, not when anyone outside FINRA could have known about it -- so joining strictly on settlement date silently assumes you had same-day knowledge of a number that in reality trickles out roughly a week and a half later. This is the same availability-date-vs-effective-date pattern that shows up with fundamentals and macro data: the fix is never to change WHICH number you use (the settlement-date figure is still the right one, eventually), it's to gate WHEN it becomes usable, by joining on the actual publish date via merge_asof rather than the settlement date the figure describes.`,
    answer: `Settlement date tells you what the position was, not when the outside world learned about it -- the actual publish date lags roughly a week and a half behind. A strict join on settlement date silently backdates that knowledge into the pipeline about 10 days earlier than reality. Fix it by joining on publish date with merge_asof(direction="backward"), keeping the settlement-date value attached to the row but gating availability on when it was actually released.`,
    python: `import pandas as pd

short_interest = pd.DataFrame({
    "ticker": ["GME", "GME"],
    "settlement_date": pd.to_datetime(["2026-08-14", "2026-08-31"]),
    "publish_date": pd.to_datetime(["2026-08-25", "2026-09-11"]),  # ~10-11 days later
    "short_interest_shares": [45_000_000, 41_000_000],
})
prices = pd.DataFrame({
    "ticker": ["GME"] * 3,
    "date": pd.to_datetime(["2026-08-20", "2026-08-27", "2026-09-05"]),
    "close": [22.10, 21.80, 23.05],
})

# gate on PUBLISH date, not settlement date -- that's the date the number
# actually became knowable to anyone outside FINRA
joined = pd.merge_asof(
    prices.sort_values("date"),
    short_interest.sort_values("publish_date").rename(columns={"publish_date": "date"}),
    on="date",
    by="ticker",
    direction="backward",
)
print(joined[["date", "close", "short_interest_shares"]])
# 2026-08-20's row shows NaN -- correctly, since NO short interest figure
# had been published yet as of that date`,
    trap: `Renaming settlement_date to date and joining on that directly. It reads as correct because the resulting frame has a plausible-looking short interest number attached to every price row, but every value is available roughly 10 days earlier in the backtest than it was in reality -- a lookahead that's invisible unless you specifically check publish_date against your join key.`,
    followUp: `A signal built off short-interest-to-float ratio backtests with a strong Sharpe using the settlement-date join. Does switching to the publish-date join change the ECONOMIC content of the signal, or only its timing -- and would you expect the Sharpe to survive the fix?`,
  },
  {
    id: "qr-pit-20260830-bar-labeling-convention",
    module: "pit",
    title: "Bar timestamp convention: does a 9:31 bar start or end at 9:31?",
    difficulty: "hard",
    question: `You're building a minute-bar momentum feature and your vendor's 1-minute OHLCV file has a row timestamped 09:31:00. Before writing a single line of feature code, what do you need to establish about that timestamp, and what breaks if you assume wrong?`,
    thinking: `A minute bar aggregates trades over an interval, so its single timestamp is necessarily a LABEL for that interval, and vendors are inconsistent about which end they use -- some stamp a bar with the time it OPENED (so 09:31:00 covers trades from 09:31:00 to 09:31:59, and is available only once that minute has fully elapsed), others stamp it with the time it CLOSED (so 09:31:00 covers 09:30:00 to 09:30:59, and was actually available a full minute earlier than the label suggests). Get this backwards and you get a PIT violation with a very specific shape: if you assume open-labeled but the vendor uses close-labeled, every feature "as of" a bar's timestamp is actually using data one full bar late relative to what you assumed -- which sounds conservative, so it rarely trips a lookahead audit, and instead just quietly costs you freshness. Get it backwards the OTHER way (assuming close-labeled when it's actually open-labeled) and you have real lookahead: you believe a bar's information was available at its timestamp when actually it wasn't available until 59 seconds later, exactly enough to leak the bar's own close price into a same-timestamp decision. The only way to know for certain is to check vendor documentation and verify empirically against a known scheduled event.`,
    answer: `The single timestamp on an aggregated bar is a label for an interval, and vendors differ on whether it marks the interval's start or end -- get it backwards in the lookahead direction (assuming a close-labeled bar is open-labeled) and you leak up to 59 seconds of that bar's own future into decisions timestamped at its start; get it backwards the other way and you're simply a bar late without realizing it, which won't trip an audit but costs real freshness. Confirm the convention from vendor documentation and verify it empirically against a known scheduled event before writing any feature code against the timestamp.`,
    python: `import pandas as pd

# a 1-minute bar file -- is 08:30:00 the bar's START or its END?
bars = pd.DataFrame({
    "ts": pd.to_datetime(["2026-08-14 08:29:00", "2026-08-14 08:30:00", "2026-08-14 08:31:00"]),
    "close": [190.10, 190.35, 191.80],
})

# empirical check: an 8:30 AM scheduled economic release should show up
# in whichever bar's price move first reflects it.
#
# if OPEN-labeled: the 08:30:00 bar covers 08:30:00-08:30:59 and shows
# the reaction; a feature "as of 08:30:00" is NOT yet safe to use until
# the NEXT bar (08:31:00) arrives.
#
# if CLOSE-labeled: the 08:30:00 bar covers 08:29:00-08:29:59, so it
# PRE-DATES the release; a feature "as of 08:30:00" using this bar is
# safely pre-release, and the release only shows up in the 08:31:00 bar.

# whichever convention is confirmed, encode it explicitly rather than
# relying on downstream code to remember:
BAR_LABEL_IS_OPEN = True   # set from vendor docs + empirical check

def bar_available_at(ts: pd.Timestamp) -> pd.Timestamp:
    # the timestamp at which this bar's data is actually knowable
    return ts + pd.Timedelta(minutes=1) if BAR_LABEL_IS_OPEN else ts

bars["available_at"] = bars["ts"].apply(bar_available_at)
print(bars)`,
    trap: `Assuming the convention is the same across every data source you use. It's common to have daily EOD data that's close-labeled and intraday data from a different vendor that's open-labeled, feeding the same research pipeline -- a PIT join treating both the same way is safe for one and leaky for the other, silently.`,
    followUp: `You confirm bars are open-labeled, so a 09:31:00 bar isn't fully known until 09:32:00. Does that mean your feature should be timestamped as available at 09:32:00, or is there an even more conservative choice given vendor delivery latency on top of the bar's own close? (09:32:00 is the bar's true close, but real feeds also have delivery latency after that -- the vendor's own SLA or observed delivery lag should be added on top, the same availability-vs-effective-date discipline as fundamentals, just at a much shorter timescale.)`,
  },
  {
    id: "qr-pit-20260831-stale-sector-classification",
    module: "pit",
    title: "Using a stock's current sector instead of its sector at the time, in a backtest",
    difficulty: "core",
    question: `Your feature engineering demeans each stock's factor score by its GICS sector average before ranking. You join sector from a static reference table keyed only by ticker -- today's sector, not the sector as of each historical date. A company reclassified from Industrials to Information Technology last year is now demeaned against Tech in 2019 too. Is this a lookahead bug, and does it matter?`,
    thinking: `Yes, and it's easy to miss because sector feels like static reference data rather than a "signal." Sector membership changes over time through GICS reclassifications, so demeaning a 2019 row against today's sector uses information that wasn't true back then and puts the stock in the wrong peer group for that whole earlier period. The size of the damage depends on how different the two sector averages were during the affected years -- it could be a rounding error or a real, direction-changing bias in the neutralized feature. The fix is the same discipline used everywhere else in point-in-time work: a sector-history table keyed by (ticker, effective_date), joined with merge_asof or an interval join, not a plain ticker-keyed lookup. Sector isn't special just because it changes rarely.`,
    answer: `Yes, it's a lookahead bug even though it feels like static reference data rather than a "signal." Sector membership changes over time (GICS reclassifications), so demeaning historical dates against today's sector uses information that wasn't true back then and puts the stock in the wrong peer group for those years. Fix by joining a point-in-time sector-history table on (ticker, effective_date) with merge_asof, not a static ticker-to-sector lookup -- sector needs the same as-of discipline as fundamentals or index membership.`,
    python: `import pandas as pd

# point-in-time sector history: one row per (ticker, effective_date)
sector_history = pd.DataFrame({
    "ticker": ["ACME", "ACME"],
    "effective_date": pd.to_datetime(["2010-01-01", "2023-06-15"]),
    "sector": ["Industrials", "Information Technology"],
}).sort_values("effective_date")

features = pd.DataFrame({
    "ticker": ["ACME", "ACME"],
    "date": pd.to_datetime(["2019-03-01", "2024-01-01"]),
    "score": [0.5, 0.5],
}).sort_values("date")

# as-of join: for each feature date, take the sector EFFECTIVE on or
# before that date -- not whatever sector is true today
correct = pd.merge_asof(
    features, sector_history, left_on="date", right_on="effective_date", by="ticker"
)
print(correct[["date", "sector"]])
# 2019 row -> Industrials (correct for the period); 2024 row -> Info Tech

# the bug: a static ticker -> sector lookup silently applies TODAY's
# sector to every historical date
static_lookup = sector_history.groupby("ticker").last()
wrong = features.merge(static_lookup["sector"], on="ticker")
print(wrong[["date", "sector"]])
# both rows -> Information Technology, including the 2019 row`,
    trap: `Assuming sector is "basically static" and therefore safe to join with a plain merge on ticker. Reclassifications are rarer than earnings restatements but not rare enough to ignore, and the bug is invisible in code review since the join itself looks completely normal.`,
  },
  {
    id: "qr-pit-20260901-model-versioning-pit",
    module: "pit",
    title: "Point-in-time model versioning: making sure a periodically retrained model only ever used data available at that time",
    difficulty: "hard",
    question: `Your team retrains a signal-generating ML model every month on a trailing window of data. When you backtest the resulting strategy, do you need to worry about lookahead beyond just lagging the input features correctly?`,
    thinking: `Lagging the input features handles one leak, but there's a second, easier-to-miss one: which MODEL was actually in use on any given day. If the backtest re-trains the model once at the start using the full historical dataset and then applies that single model retroactively across the whole backtest period, every early prediction is being made by a model that, in reality, had not been trained yet -- it has implicitly seen years of future data through its own parameters, even if every individual feature going into a prediction was properly lagged. The correct point-in-time discipline is to reconstruct the exact sequence of models that would have existed historically: train model_1 on data through month 1, use ONLY that model to generate predictions for month 2, then retrain to get model_2 using data through month 2, use it for month 3, and so on -- a walk-forward retraining loop, not a single fit-once-apply-everywhere backtest. This matters more the more the underlying relationship between features and returns drifts over time, since a model trained on the full future-inclusive sample can look artificially stable and effective purely because it "knew" about regime shifts before they happened.`,
    answer: `Yes -- feature lagging alone isn't enough. If the model itself is fit once on the full historical sample and then applied retroactively across the whole backtest, every early prediction comes from a model that implicitly saw years of future data through its trained parameters, even with perfectly lagged features. The backtest needs to walk forward: train on data through month t, predict with that frozen model for month t+1 only, then retrain before month t+2, replaying the exact sequence of models that would have actually existed historically.`,
    python: `import pandas as pd
import numpy as np

rng = np.random.default_rng(0)
months = pd.date_range("2018-01-31", periods=48, freq="ME")
panel = pd.DataFrame({
    "date": months,
    "feature": rng.normal(size=len(months)),
})
panel["fwd_ret"] = 0.02 * panel["feature"] + rng.normal(0, 0.05, len(months))

def fit_model(train: pd.DataFrame) -> float:
    # placeholder "model": OLS slope of fwd_ret on feature over the trailing window
    x, y = train["feature"].to_numpy(), train["fwd_ret"].to_numpy()
    return float(np.dot(x, y) / np.dot(x, x))

MIN_TRAIN_MONTHS = 12
preds = []
for i in range(MIN_TRAIN_MONTHS, len(panel)):
    train_window = panel.iloc[max(0, i - 24):i]          # trailing window, data through month i-1
    model_slope = fit_model(train_window)                 # frozen model, trained on the past only
    next_row = panel.iloc[i]
    pred = model_slope * next_row["feature"]
    preds.append({"date": next_row["date"], "pred": pred, "actual": next_row["fwd_ret"]})

walk_forward = pd.DataFrame(preds)
print(walk_forward.head())

# WRONG comparison for intuition only -- fitting once on everything and
# applying it retroactively leaks every future month into every early prediction
leaky_slope = fit_model(panel)
print("single leaky model slope vs walk-forward slopes vary:", leaky_slope)`,
    trap: `Caching one "current" model object and reusing it across the entire backtest for speed, rather than storing a timestamped model per retraining date. It quietly turns a walk-forward validation into a single train/test split dressed up as a rolling backtest, and the Sharpe ratio it reports is not achievable in live trading.`,
    followUp: `Your walk-forward retraining loop takes hours to run because it refits a heavy model every single month. Is there a shortcut that doesn't reintroduce the leak? (Retrain less frequently than you predict -- e.g. refit quarterly but still only ever apply each frozen model to genuinely future months relative to its training cutoff -- rather than retraining on every prediction date; the point-in-time discipline is about the model's training cutoff staying in the past, not about the retraining cadence matching the prediction cadence.)`,
  },
  {
    id: "qr-pit-20260902-groupby-apply-sort-order",
    module: "pit",
    title: "groupby().apply() reordering rows: a silent PIT-corruption bug",
    difficulty: "hard",
    question: `Your feature pipeline does df.groupby('ticker').apply(compute_rolling_feature) and the output looks fine per-ticker, but when you re-merge it back onto the master panel by position, some rows end up with the wrong date's feature value. What happened?`,
    thinking: `groupby().apply() concatenates each group's result back together in the order pandas visits the groups -- by default that's sorted group-key order, not the row order the data arrived in. If a downstream step reattaches the result to the original frame positionally (df['feat'] = result.values), assuming row i of the result still corresponds to row i of df, it silently pairs one ticker's computed feature with a completely different ticker's row whenever the sort reordered things. This isn't a crash and isn't even a shape mismatch, so it can survive code review and unit tests that only check the output's shape or dtype. The fix is to never trust positional alignment across a groupby-apply boundary: keep (or restore) an explicit key -- ticker and date -- on the output, and merge back on that key rather than assigning by position.`,
    answer: `groupby-apply concatenates group results in group-key order, which can differ from the DataFrame's original row order, so assigning the result's .values back onto the original frame by position silently pairs the wrong ticker's feature with the wrong row. Always merge the result back on an explicit key (ticker, date) rather than relying on positional alignment surviving the groupby boundary.`,
    python: `import pandas as pd

df = pd.DataFrame({
    "ticker": ["B", "B", "A", "A"],
    "date": pd.to_datetime(["2026-09-01", "2026-09-02", "2026-09-01", "2026-09-02"]),
    "price": [50.0, 51.0, 100.0, 101.0],
})

def rolling_feature(g: pd.DataFrame) -> pd.DataFrame:
    g = g.copy()
    g["mom_feat"] = g["price"].pct_change()
    return g[["date", "mom_feat"]]

# groupby().apply() concatenates each group's result in GROUP-KEY order (A
# before B), not the original row order (B, B, A, A) -- reattaching by raw
# position instead of by key silently swaps which ticker gets which value
feat = df.groupby("ticker", group_keys=True).apply(rolling_feature)
print(feat)   # index is (ticker, original row position) -- A comes first

feat = feat.reset_index(level=0).reset_index(drop=True)   # ticker + date + mom_feat as plain columns

# WRONG: df["mom_feat"] = feat["mom_feat"].values  <- assumes row i of feat
# matches row i of df; here it silently gives B's row A's momentum value
# RIGHT: merge back on the explicit key columns, never on position
df = df.merge(feat, on=["ticker", "date"], how="left")
print(df)`,
    trap: `Assigning .values from a groupby-apply result straight onto the original frame's column. It "works" (no error, no shape mismatch) while silently misaligning feature values across tickers -- exactly the kind of PIT bug that doesn't show up until live or paper trading diverges from backtest.`,
    followUp: `If the bug doesn't crash and doesn't even show up as a shape mismatch, how would you actually catch it in a test? (Construct a case where group-key order and original row order are guaranteed to differ, then assert that merging back on the key produces the exact same result as the naive positional assignment. If they match, positional alignment happened to be safe by coincidence; if they diverge, the test catches exactly this bug before it ever reaches a backtest.)`,
  },
  {
    id: "qr-pit-20260903-identifier-remapping",
    module: "pit",
    title: "Point-in-time identifier mapping: tickers and CIKs that change over time",
    difficulty: "core",
    question: `You're joining a fundamentals table keyed by CIK (the SEC's permanent filer ID) to a price table keyed by ticker, over a 15-year history. A single company can have multiple tickers over that window -- a ticker change, a delisting and relisting, or a ticker getting recycled years later to a completely different company. A naive join on ticker alone produces some clearly wrong matches. What's going on, and what's the right way to key this join?`,
    thinking: `Ticker is not a stable, unique identifier over a long window -- it's a mutable, recyclable label, so joining fundamentals to prices on ticker alone implicitly assumes today's ticker-to-company mapping held for the entire history. That silently splices two unrelated companies together whenever a ticker gets recycled, and silently drops or misattributes history whenever a company changed its own ticker. The fix is keying the join on a stable, time-invariant identifier -- CIK, or a vendor's permanent ID -- and maintaining a separate, dated ticker-to-permanent-ID mapping table with effective date ranges, so each price row's ticker resolves to the correct permanent ID as of that specific date before joining to fundamentals, rather than assuming one fixed ticker mapping applies across the whole history. This is the identifier-side version of point-in-time discipline: just as a feature needs the data that was actually available on a given date, a join key needs to reflect the mapping that was actually true on that date, not the mapping that happens to be true today.`,
    answer: `Ticker is a mutable, recyclable label, not a stable identifier -- joining on it over a long history implicitly assumes today's ticker-to-company mapping held throughout, which silently merges two unrelated companies when a ticker is recycled and misattributes history when a company changes its own ticker. Key the join on a permanent identifier like CIK instead, using a dated ticker-to-CIK mapping table with effective date ranges, so each price row's ticker resolves to the company that actually held it on that date, not as of today.`,
    python: `import pandas as pd

# dated mapping: which CIK a ticker actually pointed to, over which window --
# ticker "ABC" is recycled here: two different CIKs, non-overlapping date ranges
ticker_map = pd.DataFrame({
    "ticker": ["ABC", "ABC"],
    "cik": ["0000111", "0000222"],
    "start": pd.to_datetime(["2010-01-01", "2019-06-01"]),
    "end": pd.to_datetime(["2019-05-31", "2030-01-01"]),
})

prices = pd.DataFrame({
    "ticker": ["ABC", "ABC"],
    "date": pd.to_datetime(["2015-03-10", "2021-07-20"]),
    "close": [50.0, 12.0],
})

# resolve each price row's ticker to the CIK actually valid on its own date --
# a plain merge on ticker alone would collapse both rows onto whichever CIK
# happens to be listed, silently splicing two unrelated companies' histories
resolved = prices.merge(ticker_map, on="ticker", how="left")
resolved = resolved[(resolved["date"] >= resolved["start"]) & (resolved["date"] <= resolved["end"])]

print(resolved[["ticker", "date", "close", "cik"]])
# 2015 row resolves to CIK 0000111, 2021 row resolves to CIK 0000222 --
# now safe to join onward to fundamentals keyed by cik`,
    trap: `Assuming a ticker-to-company mapping pulled from a current reference table (like today's exchange listing file) is safe to apply retroactively across the whole history. It's correct only for the present day, and using it to join historical prices to fundamentals silently corrupts every row from a period where the mapping was different.`,
    followUp: `What breaks if the mapping table is kept but the date-range filter is dropped, just taking the most recent CIK for each ticker? (Every historical price row for a recycled ticker gets attributed to whichever company currently owns that ticker, silently merging two unrelated companies' full histories together -- exactly the bug this fix exists to prevent, reintroduced one step later.)`,
  },
];
