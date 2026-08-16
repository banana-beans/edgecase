import type { QRQuestion } from "./index";

// ============================================================
// M4 -- Feature Construction: rolling vs EWM, cross-sectional
// rank and z-score, neutralization, lags, momentum/reversal,
// interactions, winsorizing. 13 questions: 3 warmup / 7 core /
// 3 hard.
// ============================================================

export const featuresQuestions: QRQuestion[] = [
  {
    id: "qr-features-01-rolling-vs-ewm",
    module: "features",
    title: "Rolling vs EWM",
    difficulty: "warmup",
    question: `What is the difference between a 20-day rolling mean and an exponentially weighted mean (EWM) with a 20-day halflife? When would you prefer each for a trading feature?`,
    thinking: `First ask yourself what weight each past observation gets. A rolling window gives every one of the last 20 days equal weight, and day 21 gets exactly zero -- so a big outlier 20 days ago is fully in your feature today and completely gone tomorrow. That sudden drop-off creates artificial jumps in the feature that have nothing to do with new information. An EWM (exponentially weighted mean) instead decays weights smoothly: with halflife 20, an observation from 20 days ago gets half the weight of today's. Nothing ever falls off a cliff, so the feature evolves smoothly and turnover of any strategy built on it is lower. The cost: EWM never fully forgets, so a crisis from two years ago still has a tiny residual influence.`,
    answer: `Rolling uses equal weights inside a hard window; EWM decays weights geometrically so recent data matters more and old data fades smoothly instead of dropping off a cliff. Prefer EWM when you want responsiveness to fresh information plus smooth feature paths and lower turnover -- e.g. volatility estimates. Prefer a hard rolling window when the definition itself demands it, like 12-month momentum, or when you must guarantee old data has exactly zero influence.`,
    python: `import pandas as pd
import numpy as np

# px: wide DataFrame of adjusted closes, index = trading dates,
# columns = tickers.
ret = px.pct_change()

# Rolling: every one of the last 20 obs weighted 1/20.
# min_periods below the window keeps the early sample usable
# without letting 1-obs estimates through (see next card).
roll_vol = ret.rolling(window=20, min_periods=15).std()

# EWM: halflife=20 means an obs 20 days old has half the
# weight of today's. Weights never hit zero -- smooth decay.
ewm_vol = ret.ewm(halflife=20, min_periods=15).std()

# Key behavioral difference: when a huge return exits the
# rolling window, roll_vol jumps DOWN in one day even though
# nothing happened that day. ewm_vol decays gently instead.
# That phantom jump becomes phantom turnover in your strategy.
jump = (roll_vol.diff().abs() - ewm_vol.diff().abs()).mean()`,
    trap: `Saying "they are basically the same smoother". The interviewer wants the echo effect: with a rolling window, an old outlier LEAVING the window moves the feature today, which is a change driven by stale data, not new data. EWM has no such echo.`,
    followUp: `The span, halflife, and alpha parameters of ewm are three ways to say the same thing -- can you relate halflife to alpha? (alpha = 1 - 0.5 ** (1/halflife).)`,
  },
  {
    id: "qr-features-02-min-periods",
    module: "features",
    title: "Why min_periods matters",
    difficulty: "warmup",
    question: `You compute a 60-day rolling z-score and the first 59 rows are NaN, so a teammate changes it to rolling(60, min_periods=1) to "fix the NaNs". What do you tell them?`,
    thinking: `Ask what the estimate is actually made of on day 2. With min_periods=1, the rolling mean on day 1 IS the single observation, and the rolling std on day 2 is computed from two points -- a wildly noisy estimate. A z-score divides by that std, so early z-scores explode: you get values like plus or minus 8 that reflect estimation noise, not information. Any backtest that starts trading on those rows is trading noise, and worse, every ticker that enters your universe later replays this burn-in garbage at its own start. The NaNs were not a bug -- they were the honest statement "I do not have enough data yet". The right compromise is a min_periods large enough for a stable estimate, often half to two-thirds of the window, applied consistently.`,
    answer: `min_periods=1 replaces honest NaNs with estimates built from 1-2 observations, and dividing by a 2-point standard deviation produces explosive junk z-scores at the start of every ticker's history. Keep min_periods high enough for statistical stability -- e.g. 40 of 60 -- and let the burn-in period stay NaN. NaN means "not enough information yet", which is exactly true.`,
    python: `import pandas as pd
import numpy as np

# ret: wide DataFrame of daily returns.
win = 60

# WRONG: min_periods=1 -- early stds come from 1-2 points.
m_bad = ret.rolling(win, min_periods=1).mean()
s_bad = ret.rolling(win, min_periods=1).std()
z_bad = (ret - m_bad) / s_bad   # first rows: huge junk values

# RIGHT: demand a meaningful sample before emitting a number.
mp = 40                          # ~2/3 of the window
m = ret.rolling(win, min_periods=mp).mean()
s = ret.rolling(win, min_periods=mp).std()
z = (ret - m) / s                # early rows stay NaN -- honest

# Sanity check the tails: junk shows up as absurd extremes.
# z_bad.abs().max() is often 5-10x larger than z.abs().max().
worst_bad = z_bad.abs().max().max()
worst_ok = z.abs().max().max()`,
    trap: `Also watch the denominator: with min_periods=1 the std on the very first row is NaN anyway (undefined for one point), and on row two it can be near zero, sending the z-score to the moon. Candidates who only discuss the mean miss that division is what makes it lethal.`,
    followUp: `Your universe adds 30 IPOs a year. Where in the panel does the min_periods=1 junk concentrate, and what bias could that create? (At every new listing -- and IPOs already have unusual return behavior, so the junk is correlated with a real effect.)`,
  },
  {
    id: "qr-features-03-cross-sectional-zscore",
    module: "features",
    title: "Cross-sectional z-score",
    difficulty: "warmup",
    question: `What does it mean to z-score a signal cross-sectionally, and why is it usually the first thing you do to a raw factor?`,
    thinking: `Ask what decision the number feeds. In cross-sectional equity strategies you are ranking stocks against each other on the SAME date to decide relative weights -- you do not care whether earnings yield is 5% in absolute terms, you care whether it is high relative to the rest of today's universe. A cross-sectional z-score (subtract today's universe mean, divide by today's universe standard deviation, all within one date) puts every date on a common scale: mean 0, std 1. That gives you three things: comparability across dates (a z of 2 means the same "two sigmas rich" in 2010 and 2024), automatic removal of market-wide level shifts (if every stock's yield rises, z-scores are unchanged), and signals in units you can combine -- you can average a value z and a momentum z because both are dimensionless.`,
    answer: `For each date independently, subtract the mean across all stocks and divide by the standard deviation across all stocks. It converts a raw quantity into "how unusual is this stock versus its peers today", in units of standard deviations. You do it first because cross-sectional strategies trade relative attractiveness, it makes signals comparable across dates and combinable across factors, and it strips out market-wide level moves for free.`,
    python: `import pandas as pd
import numpy as np

# df: long format -- one row per (date, ticker), column 'ey'
# holds raw earnings yield.

g = df.groupby('date')['ey']

# transform returns a result aligned to the original rows,
# which is exactly what you want for per-date operations.
mu = g.transform('mean')
sd = g.transform('std')

df['ey_z'] = (df['ey'] - mu) / sd

# Every date now has mean ~0 and std ~1 by construction:
check = df.groupby('date')['ey_z'].agg(['mean', 'std'])

# Note what this is NOT: a time-series z-score down each
# ticker's own history. That answers a different question
# ("is this stock rich vs its own past") and, done on the
# full sample, leaks future data. Cross-sectional z uses
# only today's row set -- no lookahead possible.`,
    trap: `Dividing by a standard deviation that includes extreme outliers. One data-error row with earnings yield of 900% inflates today's std and crushes every other stock's z toward zero. That is why winsorizing (a later card) comes BEFORE z-scoring.`,
  },
  {
    id: "qr-features-04-rank-vs-zscore",
    module: "features",
    title: "Rank vs z-score",
    difficulty: "core",
    question: `You are building a value factor from earnings yield. Why might you use the cross-sectional percentile rank instead of the z-score of the raw ratio?`,
    thinking: `Think about the distribution of the raw input. Fundamental ratios are ugly: earnings can be near zero (yield explodes), negative, or restated, so the cross-section has fat tails and genuine data errors. A z-score is built from the mean and standard deviation, and both are dominated by outliers -- one absurd value drags the mean and inflates the std, distorting the score of every other stock. Rank transforms ask only "is A bigger than B", so the worst any outlier can be is first or last -- its influence is capped by construction. Ranks are also invariant to any monotonic transform: rank of earnings yield equals rank of log earnings yield, so you stop arguing about functional form. The price you pay: ranks throw away magnitude. A stock 10 sigmas cheap and one 2 sigmas cheap can be adjacent ranks. If magnitude carries real signal, rank discards it.`,
    answer: `Rank is robust: a single outlier or data error can wreck the mean and std that a z-score depends on, but in a rank it can only occupy the top or bottom slot -- bounded influence. Ranks are also invariant to monotonic transforms and give a uniform, bounded output. The tradeoff is lost magnitude information: rank says cheaper-than, not how-much-cheaper. A common compromise is rank first, then map ranks to a normal shape, or winsorize and z-score.`,
    python: `import pandas as pd
import numpy as np

# df: long format, columns = date, ticker, ey (earnings yield,
# includes a few broken values like 9.5 = 950% yield).

g = df.groupby('date')['ey']

# Percentile rank in (0, 1] per date. pct=True divides by the
# count, so universes of different sizes are comparable.
df['ey_rank'] = g.rank(pct=True)

# Center it so it is long/short-ready: range ~(-0.5, 0.5].
df['ey_rank_c'] = df['ey_rank'] - 0.5

# Compare with the naive z-score on a date with one outlier:
mu = g.transform('mean')
sd = g.transform('std')
df['ey_z'] = (df['ey'] - mu) / sd
# On outlier dates, ey_z compresses all normal stocks toward 0
# (the outlier owns the std); ey_rank is unaffected.

# If you want normal-shaped scores WITH rank robustness:
# feed the rank through the inverse normal CDF.
from scipy.stats import norm
n = g.transform('count')
# shift ranks off the endpoints so norm.ppf stays finite
df['ey_gauss'] = norm.ppf(df['ey_rank'] * n / (n + 1))`,
    trap: `Claiming rank is strictly better. If the interviewer pushes "so why does anyone use z-scores?", the answer is magnitude: rank treats the gap between #1 and #2 the same as between #500 and #501. For signals where extremity itself predicts returns, ranking flattens your best information.`,
    followUp: `Your universe is 50 stocks on some dates and 3000 on others. Which of rank(pct=True) and z-score behaves more consistently across those dates, and why? (Rank -- percentiles are size-invariant; z-scores from 50 names are much noisier.)`,
  },
  {
    id: "qr-features-05-standardize-per-date",
    module: "features",
    title: "Standardize per date, not per asset",
    difficulty: "core",
    question: `A junior researcher z-scores each stock's signal against that stock's own full history instead of against the cross-section each date. Give two distinct reasons this is wrong for a cross-sectional strategy.`,
    thinking: `Separate the two failure modes, because interviewers want both. First: wrong comparison set. A cross-sectional strategy decides, each date, which stocks to hold versus which -- so the relevant question is "how does stock A compare to stocks B through Z today". Z-scoring A against its own past answers "is A unusual versus its own history", which is a time-series (timing) question. Mixing them means a stock that is always cheap relative to its own past but middling versus peers gets a big score it does not deserve in a relative-value book. Second, and independently fatal: using the FULL history means the mean and std on a 2015 date include data from 2020 -- lookahead bias, a form of using information not yet available. Even per-asset standardization done honestly must use expanding or rolling windows. The two errors are separable: wrong axis, and wrong information set.`,
    answer: `Reason one: it answers the wrong question. Cross-sectional strategies trade relative attractiveness within a date, so the normalization peer group must be that date's universe, not the stock's own past. Reason two: full-history stats use future data -- the mean and std applied to 2015 include 2020 observations, which is lookahead bias and inflates the backtest. Per-date standardization is immune to lookahead by construction, since it only touches rows that exist on that date.`,
    python: `import pandas as pd
import numpy as np

# df: long format -- date, ticker, sig.

# WRONG on two axes at once: per-ticker AND full-sample.
# The 2015 rows are standardized with stats that include 2020.
gt = df.groupby('ticker')['sig']
df['z_wrong'] = (df['sig'] - gt.transform('mean')) / gt.transform('std')

# RIGHT for a cross-sectional strategy: per-date.
# Uses only rows visible on that date -- no lookahead possible.
gd = df.groupby('date')['sig']
df['z_cs'] = (df['sig'] - gd.transform('mean')) / gd.transform('std')

# If you truly WANT a per-asset (timing) score, it must be
# expanding or rolling so each row sees only its own past:
def ts_score(s):
    m = s.expanding(min_periods=252).mean()
    v = s.expanding(min_periods=252).std()
    return (s - m) / v
# sort by date within ticker first so 'expanding' means 'past'
df = df.sort_values(['ticker', 'date'])
df['z_ts'] = df.groupby('ticker')['sig'].transform(ts_score)`,
    trap: `Giving only the lookahead reason. Even with an honest expanding window, per-asset standardization is still the wrong axis for a cross-sectional book -- that half of the answer shows you understand what the portfolio construction actually consumes.`,
    followUp: `When WOULD a per-asset expanding z-score be the right choice? (Timing strategies -- e.g. scaling exposure to one asset by how stretched its own signal is versus its own past.)`,
  },
  {
    id: "qr-features-06-sector-demean",
    module: "features",
    title: "Sector neutralization by demeaning",
    difficulty: "core",
    question: `Your value factor is persistently long banks and short tech. How do you sector-neutralize it, and what is the simplest implementation?`,
    thinking: `First diagnose why this happens: value ratios are not comparable across industries. Banks structurally trade at low price-to-book, tech at high -- so a raw cross-sectional ranking of book-to-price is largely a sector bet in disguise, and your "value" P&L is really one big rotation trade that lives or dies on sectors. Ask what you actually want to reward: being cheap RELATIVE TO YOUR PEERS. The simplest fix is to demean within each (date, sector) group -- subtract the sector's average score from each member. After that, every sector's scores sum to zero, so equal-sized long and short books have zero net sector exposure by construction. Demeaning is exactly a regression of the signal on sector dummy variables, keeping the residual -- so this is the one-hot special case of the general regression-neutralization machinery.`,
    answer: `Subtract the sector mean of the signal within each date -- group by date and sector, demean. The residual measures cheapness versus sector peers, and each sector's scores now sum to zero, killing the structural bank-vs-tech bet. This is equivalent to regressing the signal on sector dummies each date and keeping residuals. Often you also re-standardize within sector so each sector contributes comparable risk.`,
    python: `import pandas as pd
import numpy as np

# df: long format -- date, ticker, sector, sig (value z-score).

# Demean within (date, sector): each stock is now scored
# against its own sector's average, not the whole market.
grp = df.groupby(['date', 'sector'])['sig']
df['sig_sn'] = df['sig'] - grp.transform('mean')

# Optional but common: also rescale within sector so a
# tight-dispersion sector (utilities) and a wide one (tech)
# contribute comparable score magnitudes.
df['sig_snz'] = df['sig_sn'] / grp.transform('std')

# Verify neutrality: sector sums should be ~0 on every date.
check = df.groupby(['date', 'sector'])['sig_sn'].sum()
assert check.abs().max() < 1e-9

# Caveat to volunteer: tiny sectors are dangerous. Demeaning a
# 2-stock sector forces the pair to be exact opposites, which
# is noise, not signal. Consider merging small sectors or
# requiring a minimum group size before neutralizing.
sizes = df.groupby(['date', 'sector'])['ticker'].count()`,
    trap: `Demeaning over the whole sample instead of per date -- sector means drift over time, so a static demean leaves time-varying sector bets in place. The groupby must include the date.`,
    followUp: `Demeaning forces zero exposure. When might you instead SHRINK sector bets rather than zero them -- and what would you need to believe about value's sector-selection ability? (If part of the factor's alpha genuinely comes from picking cheap sectors, full neutralization deletes that P&L.)`,
  },
  {
    id: "qr-features-07-lag-structure",
    module: "features",
    title: "Lagging features vs returns",
    difficulty: "core",
    question: `Features and returns live in the same daily panel. Walk me through how you align a feature with the return it is supposed to predict. Where exactly does shift() go, and what is the off-by-one that kills backtests?`,
    thinking: `Fix the timeline in your head before touching code. A feature computed from data through Monday's close is knowable Monday night. The earliest you can trade on it is Tuesday (realistically Tuesday's close for a close-to-close backtest), so the return it can claim credit for is Tuesday close to Wednesday close -- roughly two days after the feature date under conservative accounting. The classic off-by-one: pairing Monday's feature with Monday's return. Monday's return ends at Monday's close -- the very price that went INTO the feature. For a momentum feature this manufactures instant, fake predictive power because the feature and the "future" return share a price. Convention matters too: decide whether you shift the feature forward or shift returns back to create a fwd_ret column, then do exactly one of them. Teams that do both, or neither, in different files, ship lookahead. In long format, every shift must be inside a groupby('ticker') or you leak across tickers.`,
    answer: `Timestamp the feature at the moment it is knowable, then pair it with a return that starts strictly after that moment plus your execution delay -- for close-based daily data, feature from Monday's close predicts at best the Tuesday-to-Wednesday return. Implement it once, in one place: either build fwd_ret = ret shifted back, or lag features forward -- never both. In long format, shift inside groupby('ticker') so one ticker's history never bleeds into another's.`,
    python: `import pandas as pd
import numpy as np

# df: long format, sorted by (ticker, date) -- sorting first is
# mandatory or shift() scrambles time order.
df = df.sort_values(['ticker', 'date'])

g = df.groupby('ticker')

# Daily close-to-close return, per ticker.
df['ret'] = g['close'].pct_change()

# Forward return the feature is allowed to predict:
# shift(-1) alone pairs Monday's feature with Tue's return,
# which assumes you traded AT Monday's close instantly.
# shift(-2) prices in a 1-day execution delay -- conservative.
df['fwd_ret'] = g['ret'].shift(-2)

# WRONG (the classic): corr(feature_t, ret_t). Monday's return
# ends at the close that the feature was computed FROM --
# shared price, fake alpha.
wrong_ic = df['sig'].corr(df['ret'])

# RIGHT: feature vs strictly-later return.
right_ic = df['sig'].corr(df['fwd_ret'])
# For real momentum signals, wrong_ic >> right_ic. A big gap
# between the two is itself a lookahead alarm bell.`,
    trap: `Shifting without groupby in long format: df['sig'].shift(1) hands ticker AAPL's last row to ticker AAPL's successor in the sort order -- silent cross-ticker contamination that no error message will ever surface.`,
    followUp: `Your data vendor stamps fundamentals with the fiscal period end date, not the release date. How does that change the lag you need? (You must lag to the availability date -- see the point-in-time module -- often 45-90 days, not 1-2.)`,
  },
  {
    id: "qr-features-08-momentum-reversal",
    module: "features",
    title: "Momentum 12-1 and short-term reversal",
    difficulty: "core",
    question: `The classic momentum factor is the 12-month return EXCLUDING the most recent month. Why skip the last month, and how do you build both momentum and short-term reversal features?`,
    thinking: `The skip encodes an empirical fact: at horizons of roughly one month and shorter, equity returns tend to REVERSE (last month's winners underperform), while at 3-12 month horizons they CONTINUE (winners keep winning). If you build 12-month momentum without skipping, the most recent month's reversal effect sits inside your momentum feature and partially cancels it -- you have two opposing signals mashed into one number. Separating them gives you two cleaner features: 12-1 momentum (return from t-12 months to t-1 month) and short-term reversal (negative of the last month's return), which you can weight independently. Mechanically, think in prices: the return from 252 days ago to 21 days ago is price(t-21) divided by price(t-252), minus 1. Always build these from split- and dividend-adjusted prices, or a 2-for-1 split becomes a fake -50% "reversal" event.`,
    answer: `Returns mean-revert at horizons under about a month but trend at 3-12 months, so the most recent month inside a plain 12-month return fights the momentum signal. Skipping it separates two opposite-signed effects into two clean features: momentum, price at t minus 21 days over price at t minus 252 days, minus one; and reversal, the negative of the trailing 21-day return. Both must be computed on adjusted prices.`,
    python: `import pandas as pd
import numpy as np

# px: wide DataFrame of ADJUSTED closes (splits/dividends
# folded in -- otherwise corporate actions masquerade as
# gigantic reversal events).

# 12-1 momentum: return from t-252 to t-21 trading days.
# Read it as: where the price was 1 month ago, relative to
# where it was 12 months ago.
mom_12_1 = px.shift(21) / px.shift(252) - 1

# Short-term reversal: bet AGAINST the last month's move.
# Note the leading minus sign -- recent winners get low scores.
strev = -px.pct_change(21)

# Sanity check the decomposition: the pieces multiply back to
# the plain 12-month return (in gross terms):
# (1 + mom_12_1) * (1 + last month) = 1 + full 12m return.
full_12m = px.pct_change(252)
recon = (1 + mom_12_1) * (1 + px.pct_change(21)) - 1
gap = (recon - full_12m).abs().max().max()   # ~0 up to float error

# Then cross-sectionally rank/z-score each per date before use
# (see earlier cards) -- raw returns are not comparable across
# vol regimes.`,
    trap: `Building momentum from unadjusted prices. A stock that split 2-for-1 six months ago shows a raw price drop of 50%, so it lands at the bottom of your momentum ranks -- you end up systematically shorting companies whose stock did well enough to split.`,
    followUp: `Momentum computed this way only updates meaningfully as the window rolls. What is its natural rebalance frequency and what happens to transaction costs if you trade it daily? (It is a slow signal -- daily trading churns costs for near-zero new information.)`,
  },
  {
    id: "qr-features-09-winsorize",
    module: "features",
    title: "Winsorizing features",
    difficulty: "core",
    question: `Before z-scoring a fundamental feature, you winsorize it at the 1st and 99th percentiles per date. What is winsorizing, why per date, and why before the z-score rather than after?`,
    thinking: `Winsorizing means clipping: values above the 99th percentile are set equal to the 99th percentile, values below the 1st are set to the 1st -- you cap outliers instead of deleting them. Ask why the order of operations matters: the z-score's mean and std are computed FROM the data, so if one broken row (earnings restated as 100x too large) is still present, it inflates the std and drags the mean before you ever standardize -- every other stock's z-score is distorted by one bad row. Clip first, and the stats are computed on sane data. Clipping after z-scoring only trims the visible symptom while leaving the distortion baked into everyone else's scores. Per date, because the cross-sectional distribution shifts over time -- a fixed global threshold that is the 99th percentile in 2010 might be the 80th in a 2020 bubble, silently clipping real signal.`,
    answer: `Winsorizing clips values beyond chosen percentiles to those percentile values, capping outlier influence without dropping rows. Do it per date because the cross-sectional distribution drifts, so thresholds must be relative to that day's universe. Do it BEFORE z-scoring because the z-score's own mean and std are contaminated by outliers -- clipping afterward trims the one bad score but leaves everyone else's scores distorted by the inflated std.`,
    python: `import pandas as pd
import numpy as np

# df: long format -- date, ticker, feat (raw fundamental ratio
# with occasional data errors 100x off).

def winsorize(s):
    # Percentiles computed WITHIN this date's cross-section.
    lo = s.quantile(0.01)
    hi = s.quantile(0.99)
    return s.clip(lower=lo, upper=hi)

# transform applies per group and realigns to original rows.
df['feat_w'] = df.groupby('date')['feat'].transform(winsorize)

# NOW standardize -- mean/std computed on clipped, sane data.
g = df.groupby('date')['feat_w']
df['feat_z'] = (df['feat_w'] - g.transform('mean')) / g.transform('std')

# Contrast with clip-after-z (the weaker fix): the outlier's
# huge z gets capped, but the std it inflated already shrank
# every other stock's z toward zero. The damage is upstream.

# Report how much clipping actually happened -- if 10% of rows
# are being clipped, your thresholds or your data need a look.
clipped = (df['feat'] != df['feat_w']).groupby(df['date']).mean()`,
    trap: `Winsorizing at fixed absolute thresholds ("cap PE at 100") over the whole sample -- that is a global, distribution-blind rule that clips different fractions of the universe in different regimes and can even embed lookahead if the thresholds were tuned on the full sample.`,
    followUp: `You saw rank transforms earlier. When does winsorize-then-zscore beat rank, and vice versa? (Winsorize keeps interior magnitude information; rank is more robust when tails are pure noise or errors.)`,
  },
  {
    id: "qr-features-10-interaction-terms",
    module: "features",
    title: "Interaction features",
    difficulty: "core",
    question: `A PM suspects value works better among high-quality companies. How do you build an interaction feature to capture that, and what discipline keeps interaction-mining from becoming overfitting?`,
    thinking: `An interaction term captures a CONDITIONAL effect: not "value works" or "quality works", but "value works more when quality is high". The natural construction is the product of the two standardized signals -- standardize first, because the product of raw, differently-scaled variables is dominated by whichever has bigger units, and multiply z-scores so the interaction is symmetric and centered. A positive product means the signals agree (both high or both low). But immediately ask the overfitting question: with 20 base signals you have 190 pairwise products, and testing 190 new features guarantees several look great by chance -- this is the multiple-testing problem from the stats module wearing a different hat. Discipline means: only build interactions you can articulate an economic reason for BEFORE testing, count every interaction you tried when judging significance, and confirm out-of-sample.`,
    answer: `Standardize both signals cross-sectionally per date, then take their product, then re-standardize the product per date -- that scores stocks where the signals agree. The danger is combinatorics: pairwise interactions grow quadratically, and mining them is multiple testing in disguise. Restrict to hypotheses with a stated economic rationale, track the total number tried, apply a multiple-testing haircut to significance, and demand out-of-sample confirmation.`,
    python: `import pandas as pd
import numpy as np

# df: long format -- date, ticker, value_z, quality_z (already
# winsorized and z-scored per date -- prerequisites matter:
# the product of raw unscaled features is meaningless).

# The interaction: high when signals AGREE (both cheap+good,
# or both expensive+bad -- the short side of the story).
df['vxq'] = df['value_z'] * df['quality_z']

# Products of two ~N(0,1) variables are not std-1 and have fat
# tails, so re-standardize per date before combining with
# other z-scored signals.
g = df.groupby('date')['vxq']
df['vxq_z'] = (df['vxq'] - g.transform('mean')) / g.transform('std')

# Equivalent framing an interviewer may probe: a conditional
# sort. Compute value's predictive power separately inside
# quality buckets -- if value's IC is higher in the top quality
# tercile than the bottom, the interaction story has legs.
df['q_bucket'] = df.groupby('date')['quality_z'].transform(
    lambda s: pd.qcut(s, 3, labels=False)
)
ic_by_bucket = df.groupby('q_bucket').apply(
    lambda d: d['value_z'].corr(d['fwd_ret'], method='spearman')
)`,
    trap: `Multiplying raw features without standardizing first. The product inherits the units and skew of both inputs, so it mostly re-ranks by whichever feature has the wilder scale -- the "interaction" is an artifact of units, not a conditional effect.`,
    followUp: `Your interaction has correlation 0.6 with plain value. Does it add anything? How would you test its INCREMENTAL value? (Regress the interaction on the base signals per date and test whether the residual still predicts returns.)`,
  },
  {
    id: "qr-features-11-beta-neutralize",
    module: "features",
    title: "Beta neutralization via regression",
    difficulty: "hard",
    question: `Your signal is correlated with market beta, so the "alpha" is partly a disguised market bet. Neutralize the signal to beta with a cross-sectional regression, fully vectorized -- no loop over dates. Walk me through it.`,
    thinking: `First be precise about what neutralization means here: each date, regress the signal on beta across stocks and keep the residual -- the part of the signal orthogonal to (uncorrelated with) beta on that date. The residual has, by construction, zero cross-sectional correlation with beta, so a portfolio built from it carries no systematic beta tilt. Sector demeaning was the special case where the regressor was a set of dummy variables; here the regressor is continuous. Then think implementation: a Python loop over 5000 dates calling a regression library is slow and un-idiomatic. For a single regressor, ordinary least squares has a closed form -- slope equals the covariance of x and y over the variance of x -- and both are just sums of demeaned products, which groupby transforms compute for all dates at once. Finally, add the practical guards: betas are themselves estimates (noisy inputs), and a handful of extreme beta values can dominate the per-date slope, so winsorize beta first.`,
    answer: `Each date, regress signal on beta cross-sectionally and keep residuals -- the component orthogonal to beta. Vectorize with the closed-form OLS slope: demean signal and beta within each date, slope equals the per-date sum of their product over the per-date sum of squared demeaned beta, residual equals demeaned signal minus slope times demeaned beta. All of it is groupby-transform arithmetic, no date loop. Winsorize beta first since estimated betas have noisy tails.`,
    python: `import pandas as pd
import numpy as np

# df: long format -- date, ticker, sig (z-scored signal),
# beta (estimated market beta -- itself noisy, ideally
# winsorized upstream).

gd = df.groupby('date')

# Step 1: demean both within each date. OLS with an intercept
# on demeaned data has a pure slope -- intercept handled free.
df['x'] = df['beta'] - gd['beta'].transform('mean')
df['y'] = df['sig'] - gd['sig'].transform('mean')

# Step 2: closed-form single-regressor OLS, per date at once.
# slope_d = sum(x*y within d) / sum(x*x within d)
df['xy'] = df['x'] * df['y']
df['xx'] = df['x'] * df['x']
num = df.groupby('date')['xy'].transform('sum')
den = df.groupby('date')['xx'].transform('sum')
slope = num / den

# Step 3: residual = the beta-orthogonal part of the signal.
df['sig_bn'] = df['y'] - slope * df['x']

# Verify: per-date correlation with beta is ~0 by construction.
df['chk'] = df['sig_bn'] * df['x']
resid_dot_beta = df.groupby('date')['chk'].sum()   # ~0 each date

# Extension: multiple regressors (beta + size + sectors) needs
# per-date matrix OLS -- np.linalg.lstsq per date, or stack
# dummies and use a risk-model library. Same idea: keep resid.`,
    trap: `Neutralizing by regressing over the POOLED panel (one regression across all dates and stocks). That removes the average relationship, but the signal-beta relationship varies by date -- pooled residuals still carry large date-specific beta bets, which is exactly what you were hired to remove.`,
    followUp: `Betas are estimated with error. What does errors-in-variables do to your neutralization -- do you remove too much beta exposure or too little? (Attenuation: the slope is biased toward zero, so you under-neutralize and residual beta risk remains.)`,
  },
  {
    id: "qr-features-12-window-choice",
    module: "features",
    title: "Choosing lookback windows",
    difficulty: "hard",
    question: `How do you choose the lookback window or halflife for a feature -- say a volatility estimate or a momentum signal? "Grid search the backtest" is not an acceptable answer.`,
    thinking: `Recognize this as a bias-variance tradeoff wearing trading clothes. A short window reacts fast (low bias when the world changes) but is built from few observations (high variance -- noisy estimates, jumpy features, high turnover, high costs). A long window is stable but stale: it averages over regimes that no longer apply. So ask three questions before any backtest. One: what is the timescale of the thing being measured? Volatility clusters over weeks-to-months, so halflives of 10-60 days are defensible a priori; valuation mispricings correct over quarters-to-years. Two: what turnover can the strategy afford? Window length is a turnover dial -- costs put a floor on it. Three: how much data does the estimate need to be stable -- a 5-day std is mostly noise. THEN check robustness: performance should degrade gently across neighboring windows. If 60 days is great and 50 and 70 are mediocre, you found noise, and grid-searching harder only finds more of it -- that is the multiple-testing trap.`,
    answer: `Pick the window from first principles, not from the backtest: match it to the physical timescale of the effect, to the turnover and cost budget the strategy can carry, and to the minimum sample the statistic needs for stability. Then verify robustness -- a real effect performs similarly across a broad neighborhood of windows. A sharp peak at one window is the signature of an overfit parameter, and optimizing it in-sample is multiple testing that will not survive out-of-sample.`,
    trap: `Grid-searching 20 windows and reporting the best one without a multiple-testing haircut. The best of 20 noisy backtests looks good by order statistics alone -- the interviewer is checking whether you know that IS the crime, not a detail of it.`,
    followUp: `If two adjacent halflives both look fine, is there a way to avoid choosing at all? (Blend them -- averaging features across a few windows reduces parameter risk, at slight cost in interpretability.)`,
  },
  {
    id: "qr-features-13-neutralize-or-not",
    module: "features",
    title: "The cost of neutralization",
    difficulty: "hard",
    question: `Neutralization always throws away part of your signal. How do you decide whether a factor should be sector- and beta-neutralized, rather than doing it by default?`,
    thinking: `Frame it as a decomposition question. Any cross-sectional signal splits into a within-group part (stock picks relative to sector peers) and an across-group part (implicit sector and beta bets). Neutralizing deletes the second part -- which is only correct if that part carries no alpha, or carries alpha you are not allowed or not paid to take. So measure before deleting: compute the signal's predictive power (IC) separately for the within-sector component and the sector-average component. If nearly all predictive power is within-sector, neutralization discards mostly risk and keeps mostly alpha -- easy call. If the sector component genuinely predicts, full neutralization is burning P&L, and shrinking the bets (partial neutralization) beats zeroing them. Then overlay the non-statistical constraints: the mandate (a market-neutral fund cannot carry beta regardless of alpha), the risk model (unrewarded exposures eat the risk budget), and capacity. The decision is a measurement plus a constraint, never a reflex.`,
    answer: `Decompose the signal into within-sector and across-sector components and measure the predictive power of each separately. Neutralize fully when the across-group component is unrewarded risk -- which is the common empirical finding -- but if it demonstrably predicts, shrink rather than zero the exposure. Then apply constraints that trump statistics: mandate limits on beta, the risk budget, and whether investors are paying you for stock selection or for sector rotation they could buy cheaper elsewhere.`,
    trap: `Answering "always neutralize, it reduces risk" -- true but incomplete, and it signals reflex over reasoning. The examiner wants you to acknowledge neutralization has a price measured in deleted alpha, and that the price is measurable before you pay it.`,
    followUp: `Sketch the measurement: how exactly would you estimate the IC of the sector-bet component alone? (Replace each stock's signal with its date-sector mean, correlate that against forward returns -- the sector-average signal's IC.)`,
  },
  {
    id: "qr-features-20260808-signal-combination",
    module: "features",
    title: "Combining signals: rank-average vs z-score-average",
    difficulty: "core",
    question: `You have three raw signals, differently scaled and with different tail behavior, and you want one composite score per name per day. Walk me through rank-averaging versus z-score-averaging, and when you would pick one over the other.`,
    thinking: `Both start with the same cross-sectional standardization problem, then diverge on what they keep. Z-score-averaging preserves MAGNITUDE information -- a name two standard deviations out contributes more than one at 0.2 -- but exactly because it preserves magnitude, it is sensitive to fat tails: one signal with a single wild outlier can dominate the composite even after standardizing, since z can be arbitrarily large while every other signal sits near zero. Rank-averaging throws magnitude away and keeps only ORDER, which makes it robust to outliers and to differing distribution shapes across signals -- but it treats a huge true edge and a marginal one as equally spaced, which can understate genuinely differentiated conviction. There is a second issue orthogonal to this choice: naive averaging of correlated signals double-counts whatever they share. Default to rank-averaging for production robustness unless you have controlled for outliers -- winsorized z-scores -- and specifically want to preserve magnitude.`,
    answer: `Z-score-averaging keeps magnitude information but lets fat-tailed outliers in any one signal dominate the composite. Rank-averaging keeps only relative order, which is robust to outliers and mismatched distributions but discards conviction strength. Default to rank-averaging in production; use winsorized z-score-averaging when you specifically need magnitude and have controlled for outliers first. Either way, check pairwise correlation before averaging -- equal weights on correlated signals double-count the shared component.`,
    python: `import pandas as pd
import numpy as np

# signals: DataFrame indexed by date, MultiIndex columns (ticker, signal_name)
# cross-sectional operations, so group by date (axis=0 groupby on the index)

def rank_avg(df: pd.DataFrame) -> pd.Series:
    # rank within each date, 0-1 scaled so signals with different
    # counts of names still combine on the same footing
    ranks = df.groupby(level=0).rank(pct=True)
    return ranks.mean(axis=1)          # equal-weight the ranks, not the raw values

def zscore_avg(df: pd.DataFrame) -> pd.Series:
    def z(day: pd.DataFrame) -> pd.DataFrame:
        clipped = day.clip(day.quantile(0.01), day.quantile(0.99), axis=1)
        return (clipped - clipped.mean()) / clipped.std()
    z_scores = df.groupby(level=0).apply(z)   # winsorize BEFORE standardizing
    return z_scores.mean(axis=1)

composite_rank = rank_avg(signals)
composite_z = zscore_avg(signals)`,
    trap: `Averaging the raw, unstandardized signals directly -- "signal1 + signal2 + signal3, divide by 3" -- and letting whichever one happens to have the largest native scale silently dominate the composite. Standardization has to happen before combination, every time, not after.`,
    followUp: `Two of your three signals have 0.8 correlation with each other and only 0.1 with the third. Equal-weighting still weights the correlated pair 2:1 against the third. How would you fix the weighting?`,
  },
  {
    id: "qr-features-20260809-vol-scaling",
    module: "features",
    title: "Vol-scaling a signal before it goes into the book",
    difficulty: "core",
    question: `Two momentum signals have identical rank-IC, but one is computed on high-volatility small caps and the other on low-volatility large caps. A teammate suggests dividing each stock's raw return-based feature by that stock's own trailing realized volatility before ranking, calling it "vol-scaling". What problem does that fix, and what does it NOT fix?`,
    thinking: `Separate two different vol-related problems that get conflated. A raw return-based feature -- say a trailing 21-day return -- has bigger absolute magnitude for a 60%-vol stock than a 15%-vol stock purely from noise, not stronger signal. Dividing by trailing realized vol converts the feature into units of "how many sigmas did this move", putting every stock on comparable footing before cross-sectional ranking, so the ranking is not mechanically dominated by whichever names happen to be the most volatile -- a real, useful fix. What vol-scaling the FEATURE does nothing about: the resulting PORTFOLIO's dollar risk. If you rank the scaled feature and weight naively by rank, high-vol names can still end up with large dollar weights, because equalizing each name's realized risk contribution in the book is a separate design choice made at weight construction, not something that falls out of feature scaling for free.`,
    answer: `Vol-scaling the raw feature (dividing by each stock's trailing realized vol) puts stocks with different volatility regimes on comparable footing before ranking, so the cross-sectional signal is not just detecting which stocks happen to be more volatile. It does NOT by itself control the portfolio's dollar risk: a separate, later step -- typically inverse-vol position sizing at weight construction -- is needed to equalize each name's realized risk contribution in the actual book. Feature-level and portfolio-level vol scaling solve different problems, and both are usually needed.`,
    python: `import pandas as pd
import numpy as np

# ret: wide DataFrame of daily returns, dates x tickers
# raw momentum feature: trailing 21-day compound return
raw_mom = (1 + ret).rolling(21).apply(lambda x: x.prod() - 1, raw=True)

# trailing realized vol, annualized, used as the scaling denominator
rv = ret.rolling(63, min_periods=40).std() * np.sqrt(252)

# vol-scaled feature: roughly "how many sigmas did this stock move",
# putting a calm large cap and a wild small cap on comparable footing
mom_scaled = raw_mom / rv

# cross-sectional rank AFTER scaling -- now dominated by genuine relative
# strength, not by which names happen to carry the most volatility
rank_scaled = mom_scaled.rank(axis=1, pct=True)

# what scaling the FEATURE does NOT do: control dollar risk in the book.
# ranking on mom_scaled and weighting naively by rank can still hand a
# 70%-vol small cap the same dollar weight as a 15%-vol large cap --
# that needs its OWN inverse-vol step at portfolio construction:
weight_from_rank = rank_scaled.sub(rank_scaled.mean(axis=1), axis=0)
risk_scaled_weight = weight_from_rank / rv          # separate, deliberate step
risk_scaled_weight = risk_scaled_weight.div(risk_scaled_weight.abs().sum(axis=1), axis=0)`,
    trap: `Assuming that because the feature was vol-scaled, the portfolio built from it is automatically risk-balanced across names. Feature scaling and position scaling are separate decisions, often computed from different vol estimates over different windows -- conflating them is how a book ends up silently overweighting the volatile names its feature step was supposed to have neutralized.`,
    followUp: `Your vol estimate for scaling and your vol estimate used later for position sizing use different lookback windows. In a volatility regime shift, what specific mismatch does that create between the signal's intended balance and the book's realized risk?`,
  },
  {
    id: "qr-features-20260810-ewma-vs-sma",
    module: "features",
    title: "EWMA vs SMA: halflife choice and warm-up bias",
    difficulty: "core",
    question: `You are building a volatility feature and deciding between a simple rolling window (equal weight over the last N days) and an exponentially weighted moving average with a halflife. Why would you pick one over the other, and what is the warm-up problem each has at the start of a series?`,
    thinking: `Frame the choice as what weight profile you want on the past. A rolling window gives every one of the last N days identical weight and then a hard, discontinuous drop to zero for day N+1 -- so the estimate can jump sharply the day an old extreme observation rolls OUT of the window, even though nothing new happened. An EWMA instead decays weight smoothly and geometrically forever, controlled by a halflife (the number of periods for a weight to fall to half), so old information fades gradually rather than vanishing at a cliff -- generally more realistic, and it reacts faster to genuine regime shifts since the most recent observation always carries meaningful weight. The tradeoff is interpretability: a window's length has a literal count-of-days meaning; an EWMA's effective memory needs translating (via the halflife) to compare against a window choice. Both have a warm-up problem: a rolling window correctly returns NaN for the first N-1 rows, honestly signaling "not enough data yet", while an EWMA's default weighting normalizes by the weights seen so far and produces a number from day one -- disproportionately influenced by the few observations available, and not trustworthy at face value.`,
    answer: `A rolling window weights the last N days equally, then drops to zero abruptly when a day exits the window -- so an old extreme value's exit can move the feature with no new information, and it is easy to reason about since N is literally a day count. An EWMA decays weight smoothly forever via a halflife, avoiding the cliff and reacting faster to genuine shifts, but its window has no hard edge and needs the halflife-to-window conversion to compare against a rolling choice. Warm-up: the rolling window correctly returns NaN for the first N-1 rows; the EWMA's default weighting silently produces a number from day one that is unreliable until enough observations have accumulated.`,
    python: `import pandas as pd
import numpy as np

rets = pd.Series(np.random.default_rng(0).normal(0, 0.01, 300))

# rolling window: hard cutoff, equal weight -- correctly NaN for warm-up
vol_roll = rets.rolling(20).std()
print(vol_roll.isna().sum())   # 19: honest "not enough data yet"

# EWMA: smooth geometric decay, no hard edge, controlled by halflife
vol_ewma = rets.ewm(halflife=10, min_periods=10).std()
print(vol_ewma.isna().sum())   # 9, via min_periods -- still enforce a floor

# translate halflife to an "effective window" for intuition when
# comparing against a rolling-window choice
hl = 10
decay = 0.5 ** (1.0 / hl)
n_eff = 1.0 / (1.0 - decay)
print(round(n_eff, 1))   # roughly how many days carry most of the weight`,
    trap: `Calling ewm(...).std() with the default min_periods of zero on a fresh series and trusting day-two's output as much as day-two-hundred's. The weighting renormalizes by whatever has been observed so far, so it never returns NaN -- always set min_periods to a sensible floor rather than relying on the absence of NaN as a sign the estimate is trustworthy.`,
    followUp: `You switch a live volatility feature from a 20-day rolling window to a halflife-10 EWMA and P&L on a vol-targeting strategy improves modestly but turnover rises noticeably. What does that trade-off tell you about the responsiveness the EWMA bought you?`,
  },
  {
    id: "qr-features-20260811-signal-halflife",
    module: "features",
    title: "Estimating a signal's natural half-life",
    difficulty: "core",
    question: `Your cross-sectional ranks for a signal change somewhat every day. Before picking a rebalance frequency, how do you estimate the signal's own natural holding period from its autocorrelation, and how does that number discipline your turnover budget?`,
    thinking: `Define the right autocorrelation first: what you actually want is how quickly the CROSS-SECTIONAL RANKING churns, not how smooth any one stock's raw signal value looks over time -- a signal can look perfectly smooth per-stock while every stock moves together, which leaves relative ranks (the thing you actually trade) unstable. So compute, for each lag k, the average cross-sectional correlation (or rank correlation) between today's signal and the signal k days ago, across stocks and dates, and watch it decay from 1 at lag 0 toward 0. The lag where that decay crosses roughly 0.5 is a natural half-life: a rough answer to how many days pass before today's ranking has genuinely become a different ranking, independent of any backtest. That number should set your rebalance cadence directly -- rebalancing much faster than the half-life pays trading costs to chase noise-level reshuffling of ranks that have not really moved yet, while rebalancing much slower than it means holding positions built on rankings that have already substantially decayed away, giving up edge you could have captured. It also gives you a principled anchor for the smoothing half-life used in turnover control, rather than picking that parameter independently by backtest search.`,
    answer: `Compute the average cross-sectional (rank) correlation between the signal today and the signal k days ago, for a range of lags, and find the lag where it crosses about 0.5 -- that is the signal's natural half-life. Rebalancing much faster than that half-life trades on noise-level rank churn that has not really happened yet; rebalancing much slower gives up edge to ranks that have already decayed. The measured half-life should also set the smoothing parameter used for turnover control, rather than treating that as an independent free parameter to search over.`,
    python: `import pandas as pd
import numpy as np

# sig: wide DataFrame, dates x tickers, cross-sectional signal (already
# z-scored or ranked per date -- see earlier cross-sectional cards)

def cross_sectional_autocorr(sig, max_lag=20):
    # average, across dates, of the cross-sectional correlation between
    # today's signal row and the signal row k days earlier -- NOT a
    # per-stock time-series autocorrelation, which answers a different
    # question (level smoothness, not ranking churn)
    out = {}
    for k in range(0, max_lag + 1):
        shifted = sig.shift(k)
        # corrwith computes one correlation per DATE across the columns
        # (tickers), then we average those daily correlations over time
        per_date_corr = sig.corrwith(shifted, axis=1)
        out[k] = per_date_corr.mean()
    return pd.Series(out)

acf = cross_sectional_autocorr(sig, max_lag=30)

# half-life: first lag where the decay crosses 0.5
half_life = (acf < 0.5).idxmax()
print(half_life, acf.loc[[0, half_life, min(half_life * 2, 30)]])

# use it directly as the smoothing dial from the turnover-control card:
# target.ewm(halflife=half_life).mean()`,
    trap: `Measuring the autocorrelation of each stock's raw signal VALUE over its own time series instead of the cross-sectional ranking. A slow-moving market-wide trend can make every stock's raw value look smooth and highly autocorrelated while the RELATIVE ORDER between stocks -- the only thing a cross-sectional long-short book actually trades -- churns rapidly underneath it; the level-based measurement then recommends a rebalance frequency far too slow for what the ranks are actually doing.`,
    followUp: `Your measured half-life is 5 days in one regime and 15 days in another. What does that instability itself tell you, and would you rather set the rebalance cadence from the average or from the fast regime? (It suggests the signal's mechanism itself is regime-dependent; sizing for the fast regime's half-life is the conservative choice, since rebalancing too slowly during a fast regime bleeds edge, while rebalancing too fast during a slow regime only costs a little extra turnover.)`,
  },
  {
    id: "qr-features-20260812-orthogonalize-signals",
    module: "features",
    title: "Orthogonalizing a new signal against an existing one",
    difficulty: "hard",
    question: `You already trade a value signal. A researcher proposes a new quality signal, and its cross-sectional correlation with value is 0.6. Before you consider quality as an independent addition to the book, what do you do, and why not just combine them with a rank-average like usual?`,
    thinking: `A 0.6 cross-sectional correlation means the two signals share a lot of common variation, so a naive rank-average mostly re-weights toward whatever they already agree on -- it looks like diversification but understates how redundant they are. What you actually want to know is whether quality carries information BEYOND value. The tool is cross-sectional regression: each date, regress quality on value and keep the RESIDUAL, the part value cannot explain -- by construction that residual is uncorrelated with value on that date. Then re-test the residual's own IC against forward returns. Near-zero IC means quality was mostly a noisier restatement of value; a residual IC that survives means you found genuinely incremental information. Note this is a different use of regression than beta-neutralization -- the thing being regressed out is another alpha signal, not a risk factor, and the goal is establishing incremental content, not risk neutrality.`,
    answer: `Cross-sectionally regress the new signal on the existing one each day and keep the residual -- the part of quality that value doesn't explain, orthogonal to value by construction. Then re-test that residual's own IC against forward returns. A naive rank-average with a signal correlated at 0.6 mostly just re-weights toward their shared component, understating how redundant they are; the residual test tells you honestly whether quality adds incremental information or is largely a noisier restatement of value.`,
    python: `import pandas as pd
import numpy as np

# panel: one row per (date, ticker); value/quality already cross-sectionally
# z-scored per date
panel = pd.DataFrame({"date": dates, "ticker": tickers,
                       "value": value_z, "quality": quality_z, "fwd_ret": fwd_ret})

def orthogonalize(day: pd.DataFrame) -> pd.Series:
    # regress quality on value WITHIN this date's cross-section only
    x = day["value"].to_numpy()
    y = day["quality"].to_numpy()
    beta = np.cov(x, y, ddof=0)[0, 1] / np.var(x)      # single-predictor OLS slope
    resid = y - beta * (x - x.mean()) - y.mean()
    return pd.Series(resid, index=day.index)

panel["quality_orth"] = (
    panel.groupby("date", group_keys=False)[["value", "quality"]].apply(orthogonalize)
)

# sanity check: residual should be ~uncorrelated with value, PER DATE
one_day = panel[panel["date"] == panel["date"].iloc[0]]
assert abs(one_day["value"].corr(one_day["quality_orth"])) < 1e-6

# test the RESIDUAL's IC against forward returns, not raw quality's
ic_orth = panel.groupby("date").apply(
    lambda d: d["quality_orth"].corr(d["fwd_ret"], method="spearman")
)`,
    trap: `Skipping straight to a rank-average of value and quality because "more signals is better." With 0.6 correlation, the combination is dominated by their shared component; you may be adding turnover and cost without adding any real incremental predictive power, and you won't find out until the residual test.`,
    followUp: `The residual's IC is positive but noticeably smaller than quality's raw, un-orthogonalized IC. Is that a red flag, or exactly what you should expect -- and what did the raw IC number actually measure once you know the two signals are correlated?`,
  },
  {
    id: "qr-features-20260813-qcut-vs-zscore",
    module: "features",
    title: "Quantile bucketing vs continuous z-scoring",
    difficulty: "core",
    question: `You have a raw value signal, book-to-price, that you want to turn into a tradeable cross-sectional feature. One teammate cross-sectionally z-scores it every day; another buckets it into deciles with qcut and assigns each decile a fixed score. When would you prefer bucketing over the continuous z-score, and what does bucketing cost you?`,
    thinking: `Z-scoring preserves the MAGNITUDE of how extreme a stock's value is relative to its cross-section -- a stock that is 4 standard deviations cheap gets a much bigger score than one that is 1.2 standard deviations cheap, and that ordering-plus-magnitude is exactly what you want if you believe the raw signal's shape is informative and you trust the tails. But raw fundamental ratios are famously noisy in the tails -- book-to-price can blow up toward infinity for a stock with near-zero book equity, and a z-score inherits that instability directly, letting one data artifact dominate the whole day's cross-section. Bucketing throws away within-bucket magnitude information on purpose: every stock in the cheapest decile gets the identical score, so a genuinely extreme outlier and a merely-cheap stock in the same bucket are treated identically -- you have converted a fragile continuous statistic into a robust discrete rank. The cost is real: two adjacent stocks straddling a bucket boundary by a hair get very different scores, a step-function discontinuity the continuous version never has, and that discreteness alone adds unnecessary turnover as scores jump when a stock crosses a boundary on a small, noisy move.`,
    answer: `Prefer bucketing (qcut into deciles, fixed score per bucket) when the raw signal is noisy or unstable in the tails, since it caps the influence any single extreme, possibly-artifact value can have -- every stock in a bucket gets an identical, robust score. Prefer continuous z-scoring when you trust the raw signal's shape and want magnitude, not just rank, to matter. The cost of bucketing is a step-function discontinuity at bucket boundaries: two nearly-identical stocks straddling a decile cutoff get very different scores, and that discreteness adds turnover as scores jump on small, noisy crossings that a continuous score would barely register.`,
    python: `import pandas as pd
import numpy as np

rng = np.random.default_rng(0)
bp = pd.Series(rng.lognormal(0, 0.5, 500))
bp.iloc[0] = 800.0   # one near-zero-book-equity artifact -- extreme outlier

# continuous z-score: the outlier dominates the whole day's cross-section
z = (bp - bp.mean()) / bp.std()
print("z-score of the artifact row:", round(z.iloc[0], 1))   # enormous

# decile bucketing: the SAME artifact just lands in the top bucket,
# indistinguishable from every other stock already in that bucket
deciles = pd.qcut(bp, 10, labels=False, duplicates="drop")
bucket_score = deciles - deciles.mean()   # centered decile score
print("bucket score of the artifact row:", bucket_score.iloc[0])
print("bucket score of the next-highest normal stock:",
      bucket_score.iloc[bp.drop(index=0).idxmax()])
# both land in the same top bucket -- the artifact's magnitude is CAPPED,
# at the cost of losing the (real, useful) magnitude info within each bucket`,
    trap: `Assuming bucketing is strictly "safer" and defaulting to it everywhere. For a well-behaved signal with informative tails -- momentum computed from liquid, clean prices, say -- bucketing throws away real information for no robustness benefit, and the added boundary-crossing turnover is a pure cost with nothing bought in return.`,
    followUp: `You winsorize the raw signal at the 1st and 99th percentile before z-scoring instead of bucketing. Does that capture the same robustness benefit as bucketing while keeping more of the magnitude information, or does it introduce its own boundary artifact?`,
  },
  {
    id: "qr-features-20260814-rank-tie-method",
    module: "features",
    title: "Rank ties: average, first, or dense?",
    difficulty: "core",
    question: `Two stocks tie on today's signal value. You call .rank() cross-sectionally to build a factor. What are the three common ways pandas can break that tie, and which one should you pick for a factor that feeds a quantile-bucketed long-short book?`,
    thinking: `rank() needs a rule for ties, since "give them the same rank" isn't automatically well-defined for a fractional or bucketed output. method="average" splits tied ranks evenly (two names tied for 2nd/3rd both get 2.5) -- symmetric, and the right default for a factor since it doesn't favor either name and keeps quantile bucketing well-behaved: tied names land in the same bucket as each other. method="first" breaks ties by original row order, which quietly injects an arbitrary ordering into your factor whenever two stocks are genuinely tied -- fine for a stable sort, wrong for a signal. method="dense" avoids gaps after a tie (2,2,3 instead of 2,2,4), useful for indexing buckets by rank number but shifts the overall rank range, which distorts anything built as a linear rescaling of rank.`,
    answer: `average splits tied ranks evenly and symmetrically (e.g. 2.5 for a 2nd/3rd tie) -- the right default for a factor since it doesn't favor either name and keeps quantile bucketing sensible. first breaks ties by row order, injecting an arbitrary ranking that isn't in your signal. dense avoids rank gaps after ties but shifts the total range. For a quantile-bucketed long-short book, use average so genuinely tied names end up in the same bucket.`,
    python: `import pandas as pd

signal = pd.Series(
    [0.05, 0.02, 0.02, 0.09, -0.01],
    index=["AAPL", "MSFT", "GOOG", "AMZN", "META"],
)

# three tie-breaking conventions for cross-sectional rank
avg_rank = signal.rank(method="average")   # tied names split the rank mass evenly
first_rank = signal.rank(method="first")   # tied names ranked by original row order
dense_rank = signal.rank(method="dense")   # tied names share a rank, no gap left after

print(pd.DataFrame(
    {"signal": signal, "avg": avg_rank, "first": first_rank, "dense": dense_rank}
))
# MSFT and GOOG tie at 0.02: avg gives both 2.5, first arbitrarily splits them
# into 2 and 3, dense gives both 2 with AAPL at 3 instead of 4`,
    trap: `Assuming .rank(method="first") is "the normal one" because it resembles a spreadsheet's RANK function. For a factor that feeds quantile buckets, first silently splits genuinely-tied names into different buckets based on nothing but row order.`,
  },
  {
    id: "qr-features-20260815-sector-median-impute",
    module: "features",
    title: "Cross-sectional imputation: sector median vs zero-fill",
    difficulty: "core",
    question: `Your 12-month momentum feature is NaN for about 3% of names on any given day -- recent IPOs without enough history, halted stocks, data gaps. A teammate proposes df["mom_12m"].fillna(0) right before the cross-sectional z-score. Why is that a bad default, and what should you do instead?`,
    thinking: `Think about what fillna(0) actually claims: it asserts "this stock's 12-month momentum is exactly zero," a specific, confident, almost certainly false statement standing in for "I don't know." After z-scoring, that fabricated zero lands wherever zero happens to sit relative to that day's cross-sectional mean and std -- not neutral by construction, and definitely not "no opinion." Worse, the model downstream can't distinguish a real, computed zero-momentum stock from an imputed one, so it will happily rank an IPO with three days of history into a decile bet based on a number you invented. The standard fix has two parts: impute with the sector (or peer-group) cross-sectional median so the stock lands at the neutral middle of names you'd actually compare it to, and separately carry a boolean is_imputed flag so any decile-based or extreme-bet logic downstream can exclude or shrink those names rather than trade them at face value.`,
    answer: `fillna(0) inserts a specific, fabricated data point that then gets traded like real information -- there's no way downstream to tell "no data" from "genuinely zero momentum." Instead, impute with the cross-sectional median within the stock's sector (or peer group) that day, so it lands at the neutral middle of names it's actually being compared against, and carry a separate is_imputed boolean column so extreme-decile or high-conviction logic can exclude or downweight those names rather than trade a number you made up.`,
    python: `import pandas as pd
import numpy as np

df = pd.DataFrame({
    "date":    ["2026-08-14"] * 5,
    "sector":  ["tech", "tech", "tech", "fin", "fin"],
    "mom_12m": [0.18, np.nan, 0.05, np.nan, -0.02],
})

df["is_imputed"] = df["mom_12m"].isna()

# sector median computed WITHIN that day's cross-section -- no lookahead,
# no borrowing from other dates
sector_median = df.groupby(["date", "sector"])["mom_12m"].transform("median")
df["mom_12m_filled"] = df["mom_12m"].fillna(sector_median)

# is_imputed lets a decile-selection step exclude fabricated values
# from extreme (top/bottom decile) bets while still scoring them neutrally
eligible_for_extremes = df.loc[~df["is_imputed"]]`,
    trap: `Computing the fill value from the full historical mean of the feature instead of that day's cross-sectional median. A historical average uses information from other dates in the panel (lookahead) and ignores the current cross-section's actual dispersion, silently reintroducing the point-in-time bugs this track spends a whole module warning about.`,
    followUp: `An entire small sector has zero non-missing names on a given day, so the sector median itself is NaN. What's the fallback -- broaden to the full universe median, or something else?`,
  },
  {
    id: "qr-features-20260816-size-neutralization-wls",
    module: "features",
    title: "Neutralizing a signal against market cap with WLS",
    difficulty: "core",
    question: `Your value signal (book-to-market) is strongly correlated with market cap -- it's really a disguised small-cap bet. How do you neutralize a signal against a continuous characteristic like log market cap, and why use weighted least squares instead of plain OLS for the regression?`,
    thinking: `Neutralizing against a continuous characteristic is a regression problem, not a demeaning problem: within each date's cross-section, regress the raw signal on log market cap (log scale because cap spans orders of magnitude, and raw dollars would let mega-caps dominate the fit) plus a constant, then keep the RESIDUAL as your neutralized signal -- by construction it has zero correlation with size that date, while any distinct information in the original signal survives. WLS versus OLS matters because these cross-sectional regressions are heteroskedastic in a specific, economically meaningful way: small, illiquid names have noisier signal values -- thinner analyst coverage, wider bid-ask, more estimation error -- than mega-caps, so OLS, which weights every observation equally, lets that small-cap noise disproportionately whipsaw the fitted line. Weighting by market cap (or its square root) downweights the noisiest, smallest names in the fit, mirroring how a cap-weighted book actually cares more about getting large-cap names right, while still producing a defined residual for every name.`,
    answer: `Regress the raw signal cross-sectionally, date by date, on log market cap plus a constant, and keep the residual as the neutralized signal -- it's uncorrelated with size by construction while preserving orthogonal information. Use WLS weighted by market cap (or its square root) rather than OLS, because small-cap signal values are noisier and equal-weighted OLS lets that noise distort the fit that every name, including large caps, gets neutralized against.`,
    python: `import pandas as pd
import numpy as np
import statsmodels.api as sm

# df: long panel -- date, ticker, raw_signal, mktcap

def neutralize_one_date(g):
    log_cap = np.log(g["mktcap"])
    X = sm.add_constant(log_cap)
    w = g["mktcap"]  # WLS weights: downweight noisy small-cap fits
    model = sm.WLS(g["raw_signal"], X, weights=w).fit()
    return g["raw_signal"] - model.predict(X)  # residual = neutralized signal

# fit per date -- the size-signal relationship drifts over time, so
# never pool dates into one regression
df["signal_neutral"] = df.groupby("date", group_keys=False).apply(
    neutralize_one_date
)

# sanity check: residual should show ~zero correlation with cap, every date
check = df.groupby("date").apply(
    lambda g: g["signal_neutral"].corr(np.log(g["mktcap"]))
)
# check.abs().max() should sit near zero -- a large value flags a bad fit`,
    trap: `Neutralizing against raw market cap instead of log market cap. Cap is heavily right-skewed -- a handful of mega-caps dwarf everything else -- so a fit on raw dollars is dominated by a few giants and produces a near-nonsensical slope for the bulk of the universe; log scale compresses the range into something a linear regression can actually fit sensibly.`,
    followUp: `After neutralizing against size, your signal's IC drops from 0.04 to 0.025. Is that a bad sign? (Not necessarily -- it can mean part of the raw signal's edge was just a repackaged size factor the desk may already own elsewhere; the neutralized 0.025 is the genuinely incremental piece.)`,
  },
];
