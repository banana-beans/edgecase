import type { QRQuestion } from "./index";

// ============================================================
// M6 -- Statistics for alpha research: IC and rank-IC,
// overlapping returns and Newey-West, autocorrelation,
// stationarity, multiple testing, bootstrap, in/out-of-sample,
// regimes, and the standard error of the Sharpe ratio.
// 13 questions: 3 warmup / 7 core / 3 hard.
// ============================================================

export const statsQuestions: QRQuestion[] = [
  {
    id: "qr-stats-01-information-coefficient",
    module: "stats",
    title: "The information coefficient",
    difficulty: "warmup",
    question: `What is the information coefficient (IC) of a signal, how do you compute it on a daily panel, and what is a realistic magnitude for a good equity signal?`,
    thinking: `Anchor the definition: the IC is the cross-sectional correlation, computed each date, between your signal's values and the forward returns those values were supposed to predict -- one number per date, "how well did today's ranking foresee tomorrow's winners". Then internalize the scale, because it is the most counterintuitive fact in the field: a GOOD daily equity signal has a mean IC around 0.02 to 0.05. A correlation of 0.03 sounds like nothing -- and per bet, it is. The reason it makes money is breadth: you place that slightly-better-than-coin-flip bet across thousands of stocks, thousands of times, and the law of large numbers grinds the tiny edge into a steady P&L. This is why quant research is a statistics discipline: your entire job is distinguishing a real 0.03 from a fake one, and at that magnitude the difference is invisible to eyeballs -- only careful inference can tell them apart.`,
    answer: `The IC is the per-date cross-sectional correlation between signal values and subsequent forward returns -- a daily score of ranking skill. You compute it per date and study the time series of ICs: its mean is the edge, its volatility the consistency. Realistic magnitudes are humbling: 0.02 to 0.05 mean IC is genuinely good for daily equity signals. Tiny per-bet edges become profits through breadth -- many stocks, many days.`,
    python: `import pandas as pd
import numpy as np

# df: long panel -- date, ticker, sig, fwd_ret (forward return
# already aligned PIT-correctly: strictly after signal time).

# Fully vectorized per-date correlation, no apply needed:
# corr(x, y) within a date = mean of zx * zy within that date.
def cs_zscore(col):
    g = df.groupby('date')[col]
    return (df[col] - g.transform('mean')) / g.transform('std')

zs = cs_zscore('sig')
zr = cs_zscore('fwd_ret')

# One IC per date: average cross-product of the two z-scores.
# (ddof mismatch is negligible for wide universes.)
ic = (zs * zr).groupby(df['date']).mean()

# The three numbers you quote in the interview:
ic_mean = ic.mean()                       # the edge, e.g. 0.03
ic_std = ic.std()                         # its day-to-day noise
icir = ic_mean / ic_std * np.sqrt(252)    # annualized IC ratio
# icir is a Sharpe-like ratio FOR THE SIGNAL: consistency of
# ranking skill before costs and construction choices.

# Also always plot ic.rolling(63).mean() -- a decaying IC is
# the classic signature of a crowded or dying signal.`,
    trap: `Computing one pooled correlation over all rows at once instead of per date. Pooling lets strong dates dominate weak ones and mixes cross-sectional skill with time-series effects -- the per-date IC series is the object of study, because its mean AND stability both matter.`,
    followUp: `Two signals both have mean IC 0.03, but one has IC volatility of 0.05 and the other 0.15. Which do you prefer and what ratio captures that? (The first -- the ICIR, mean over std of IC; consistency compounds.)`,
  },
  {
    id: "qr-stats-02-stationarity",
    module: "stats",
    title: "Stationarity: prices vs returns",
    difficulty: "warmup",
    question: `Why do we model returns rather than prices? Explain stationarity in plain terms and what goes wrong statistically when you correlate two price series.`,
    thinking: `Plain-language definition first: a series is stationary when its statistical character -- typical level, spread, correlation structure -- does not drift over time, so any window of history is a fair sample of the same underlying process. Prices flunk immediately: a stock at 40 dollars in 2015 and 400 in 2025 has no stable mean to revert to; a price series is roughly a random walk, an accumulation of shocks where each level is last level plus news. Returns -- percentage changes -- difference that accumulation away, leaving something with a stable-ish center near zero and comparable scale across time (only roughly: volatility itself clusters). Why care? Every statistic you compute assumes the sample represents one process. Correlate two independent random walks and you routinely get correlations near plus or minus 0.9 -- both drift somewhere over the sample, and any two drifts look "related". That is spurious correlation: t-stats and p-values computed on prices are unhinged from reality.`,
    answer: `Stationary means the process's statistical properties are stable over time, so averaging history is meaningful. Prices are non-stationary -- near random walks with no fixed mean -- so sample statistics on them do not converge to anything interpretable, and two unrelated trending series show huge spurious correlation. Returns are approximately stationary (mean near zero, though volatility clusters), which is why modeling, correlation, and regression happen in return space, not price space.`,
    python: `import pandas as pd
import numpy as np

rng = np.random.default_rng(7)
n = 2520   # ten years of daily data

# Two INDEPENDENT random walks -- fake 'prices' with zero
# true relationship by construction.
ra = rng.standard_normal(n)
rb = rng.standard_normal(n)
pa = pd.Series(100 + ra.cumsum())
pb = pd.Series(100 + rb.cumsum())

# Correlating PRICES: routinely enormous despite independence,
# because both series wander somewhere over the decade and any
# two wanderings co-trend or anti-trend by luck.
corr_prices = pa.corr(pb)        # often |corr| > 0.5

# Correlating RETURNS: near zero, as it should be.
corr_rets = pa.pct_change().corr(pb.pct_change())

# Do it 500 times to see it is systematic, not one unlucky draw:
walks = rng.standard_normal((500, 2, n)).cumsum(axis=2)
flat = pd.DataFrame({'a': walks[:, 0, :].ravel()})
# (In practice: loop the corr; the histogram of price-price
# correlations is spread across [-1, 1], while return-return
# correlations pile up tightly around 0.)`,
    trap: `Concluding "returns are stationary, so ordinary statistics are safe". Returns are only approximately stationary: volatility clusters and regimes shift, which is precisely why later cards need Newey-West corrections, block bootstraps, and regime analysis. Stationarity is a spectrum you manage, not a box you tick.`,
    followUp: `Your signal itself is built from prices (like a moving-average gap). Does the stationarity concern apply to signals too? (Yes -- a non-stationary signal makes thresholds and z-scores drift in meaning; check the signal's own distribution over time.)`,
  },
  {
    id: "qr-stats-03-sharpe-standard-error",
    module: "stats",
    title: "How many years to trust a Sharpe?",
    difficulty: "warmup",
    question: `A strategy shows a Sharpe ratio of 0.5 over three years of daily data. Roughly how uncertain is that estimate, and how many years would you need before it is statistically distinguishable from zero?`,
    thinking: `Build the intuition from the simplest case: the Sharpe ratio is a mean divided by a standard deviation, and the shaky part is the MEAN return -- means of noisy data converge painfully slowly, at a rate of one over the square root of the sample size. The workhorse approximation: the standard error (the typical estimation wobble) of an annualized Sharpe is roughly one over the square root of the number of YEARS. Three years: SE about 0.58 -- larger than the 0.5 estimate itself! The true Sharpe is plausibly anywhere from about -0.6 to 1.6. For a t-stat of 2 (the conventional bar for "probably not zero") you need SE about 0.25, i.e. roughly 16 years -- for a strategy most funds would kill after two bad quarters. Burn this in: at realistic Sharpe levels, performance track records carry shockingly little statistical information, which is why researchers lean on ICs across thousands of stocks (breadth manufactures sample size) rather than on a single portfolio's P&L history.`,
    answer: `Rule of thumb: the standard error of an annualized Sharpe is about one over the square root of the number of years. Three years gives SE around 0.58 -- bigger than the 0.5 estimate, so it is statistically indistinguishable from zero. To reach a t-stat of 2 you would need roughly 16 years. That is the punchline about track records: at realistic Sharpes they are mostly noise, which is why cross-sectional evidence with real breadth beats P&L eyeballing.`,
    python: `import numpy as np

# Approximate SE of the ANNUALIZED Sharpe over T years:
#   se ~= sqrt((1 + sr*sr/2) / T)
# The sr*sr/2 term adds the uncertainty of estimating the
# volatility in the denominator; for small sr it is minor and
# se ~= 1/sqrt(T) is the number to carry in your head.

def sharpe_se(sr, years):
    return np.sqrt((1.0 + 0.5 * sr * sr) / years)

sr = 0.5
se3 = sharpe_se(sr, 3)         # ~0.61 -- swamps the estimate
t3 = sr / se3                  # ~0.8 -- nowhere near 2

# Years needed for a t-stat of 2, solving t = sr / se(T) = 2:
years_needed = (1.0 + 0.5 * sr * sr) * (2.0 / sr) ** 2   # ~18

# The same logic as a table you can recite:
for s in [0.5, 1.0, 2.0]:
    yrs = (1.0 + 0.5 * s * s) * (2.0 / s) ** 2
    # sr=0.5 -> ~18y; sr=1.0 -> ~6y; sr=2.0 -> ~3y
    # High-Sharpe strategies prove themselves fast; low-Sharpe
    # ones essentially never do within a career.`,
    trap: `Thinking daily data rescues you: "three years is 756 observations!" Annualizing scales the mean and the noise together -- the information content depends on the Sharpe-per-observation, and 756 noisy days collapse back to the same three units of annual evidence. Sampling more finely does not add signal.`,
    followUp: `Your fund fires strategies after a one-year Sharpe below zero. For a TRUE Sharpe-0.5 strategy, roughly what fraction of years will trip that wire? (SE of a one-year Sharpe is about 1, so P(observed less than 0) is about 31% -- you fire a genuinely good strategy one year in three.)`,
  },
  {
    id: "qr-stats-04-rank-ic",
    module: "stats",
    title: "Rank-IC vs Pearson IC",
    difficulty: "core",
    question: `Most desks quote rank-IC (Spearman) rather than plain Pearson IC. What is the difference and why is rank-IC the default?`,
    thinking: `Pearson correlation measures LINEAR co-movement of the raw values; Spearman replaces both variables by their within-date ranks first, so it measures monotonic agreement -- did higher signal go with higher return, regardless of by how much. Ask what the data looks like on a bad day: daily stock returns have brutal outliers -- one biotech moving 60% on trial results. Pearson's products of deviations let that single stock dominate the entire date's correlation, so your IC series inherits the tails of the return distribution rather than measuring your ranking skill. Ranks cap every observation's influence at its ordinal position: the 60% mover counts as "first place", not as sixty times a normal day. There is also a fit-for-purpose argument: a long-short portfolio is BUILT from ranks -- you buy the top decile and sell the bottom -- so ordinal agreement is literally the thing that converts to P&L. The cost, as always with ranks: genuine magnitude information is discarded.`,
    answer: `Pearson correlates raw values and is dominated by return outliers -- one huge mover can own the whole date's IC. Spearman rank-IC correlates within-date ranks, capping each stock's influence and measuring monotonic agreement, which is also what a rank-built long-short portfolio actually monetizes. Hence rank-IC is the robust default; Pearson adds value only when you believe magnitudes carry real, tradeable information beyond order.`,
    python: `import pandas as pd
import numpy as np

# df: long panel -- date, ticker, sig, fwd_ret.

# Spearman = Pearson on ranks. Rank within each date first;
# pct=True normalizes for varying universe size.
df['sig_rk'] = df.groupby('date')['sig'].rank(pct=True)
df['ret_rk'] = df.groupby('date')['fwd_ret'].rank(pct=True)

def cs_z(col):
    g = df.groupby('date')[col]
    return (df[col] - g.transform('mean')) / g.transform('std')

# Per-date correlation of the RANKS -- vectorized as before.
rank_ic = (cs_z('sig_rk') * cs_z('ret_rk')).groupby(
    df['date']).mean()

# Pearson on raw values for comparison:
pear_ic = (cs_z('sig') * cs_z('fwd_ret')).groupby(
    df['date']).mean()

# Diagnostic worth quoting: dates where the two disagree most
# are dates with extreme return outliers -- inspect them.
gap = (rank_ic - pear_ic).abs().sort_values()
# If mean(rank_ic) >> mean(pear_ic), your Pearson edge was
# being destroyed by tails; if the reverse, your signal's
# alpha lives in the extremes -- worth knowing either way.`,
    trap: `Ranking the signal but not the returns "because returns are the ground truth". Spearman requires ranking BOTH sides; correlating ranked signal against raw returns is a hybrid that is still outlier-dominated on the return side.`,
    followUp: `Rank-IC is 0.04 but the long-short decile spread P&L is flat. Ordinal skill exists -- where is the money going? (The monotonicity may be concentrated mid-ranking with flat extremes, or costs and constraints eat the spread; check the decile-by-decile return profile.)`,
  },
  {
    id: "qr-stats-05-overlapping-newey-west",
    module: "stats",
    title: "Overlapping returns and Newey-West",
    difficulty: "core",
    question: `You evaluate a signal against 21-day forward returns, sampled DAILY, and get a t-stat of 6. Why is that t-stat inflated, and what is the Newey-West correction doing about it?`,
    thinking: `Look at two adjacent observations: Monday's 21-day forward return and Tuesday's share 20 of their 21 days. They are almost the same number -- you did not collect two pieces of evidence, you collected about one-twentieth of a new one. Ordinary t-stats assume independent observations: standard error scales as one over the square root of n, so pretending you have 2520 independent monthly-horizon returns when you effectively have about 120 shrinks the reported error bar by roughly the square root of 21 -- your t-stat of 6 deflates toward 1.3. Under the hood, overlap induces strong positive autocorrelation (correlation between a series and its own recent past) in the regression residuals. Newey-West repairs the standard error by adding covariance terms between residuals up to a chosen lag -- widening the error bar to account for how much neighboring observations echo each other. Set the lag at least equal to the overlap length. The coefficient estimate itself is untouched; only your CONFIDENCE in it was fake.`,
    answer: `Daily-sampled 21-day returns overlap: consecutive observations share 20 of 21 days, so the effective number of independent data points is about n over 21, and the naive standard error is understated by roughly the square root of 21. Newey-West computes a standard error that accounts for autocorrelated residuals up to a chosen lag -- set at least to the overlap -- restoring an honest error bar. Point estimates are unchanged; only the fake precision is removed.`,
    python: `import numpy as np
import pandas as pd
import statsmodels.api as sm

# y: daily series of a signal-sorted portfolio's 21-day
# FORWARD return (one row per day -> heavy overlap).
# Question: is the mean of y significantly positive?

X = np.ones(len(y))     # regression on a constant = the mean

# Naive OLS: assumes every day is independent evidence.
naive = sm.OLS(y, X).fit()
t_naive = naive.tvalues[0]          # e.g. ~6 -- too good

# Newey-West (HAC = heteroskedasticity- and autocorrelation-
# consistent): widen the SE using residual autocovariances up
# to maxlags. Rule: maxlags >= overlap (21 here; padding up
# to ~30 adds robustness to residual autocorr beyond overlap).
nw = sm.OLS(y, X).fit(cov_type='HAC',
                      cov_kwds={'maxlags': 21})
t_nw = nw.tvalues[0]                # e.g. ~1.3 -- the truth

# Back-of-envelope check the interviewer loves: with overlap k,
# t_naive / sqrt(k) approximates the honest t.
approx = t_naive / np.sqrt(21.0)

# Overlap-free alternative: evaluate on NON-overlapping windows
# (every 21st day). Honest, simple, but throws away 20/21 of
# the rows -- Newey-West keeps them and fixes the inference.
y_nonoverlap = y.iloc[::21]`,
    trap: `"Fixing" it by shrinking maxlags until significance returns -- lag shopping is p-hacking with extra steps. The lag is set by the structure of the data (the overlap length), not by the answer you want.`,
    followUp: `Beyond overlapping windows, what else in a daily alpha's P&L series creates autocorrelated errors even at a 1-day horizon? (Volatility clustering, slow signals held for days, and asynchronous closes across markets -- HAC errors are rarely optional.)`,
  },
  {
    id: "qr-stats-06-autocorrelation",
    module: "stats",
    title: "Autocorrelation and effective sample size",
    difficulty: "core",
    question: `Your daily IC series has autocorrelation of 0.5 at lag 1. What does that mean concretely, and how does it change the significance of the mean IC?`,
    thinking: `Translate the number: today's IC being above its average makes tomorrow's IC likely above average too -- the series echoes itself, with each day roughly half-inheriting the previous day's deviation. Why would ranking skill echo? Because slow signals hold similar positions for days and regimes persist: a week where value works is followed by another. Now the statistical consequence: n autocorrelated observations contain less information than n independent ones. The classic adjustment for lag-1 autocorrelation rho: effective sample size is n times (1 - rho) over (1 + rho). At rho 0.5 that factor is one-third -- your 2520 days carry the evidentiary weight of about 840 independent days, so the naive standard error of the mean IC is understated by about the square root of 3, and t-stats shrink by ~42%. Same disease as overlapping returns, different vector -- which is why the cure is shared: Newey-West errors, or aggregate to a coarser frequency where the echo fades.`,
    answer: `Lag-1 autocorrelation of 0.5 means each day's IC deviation roughly half-persists into the next day -- observations echo rather than being fresh evidence. Effective sample size shrinks by the factor (1 - rho) over (1 + rho): one-third at rho 0.5, so the true standard error of the mean IC is about square root of 3 larger than naive, cutting the t-stat by roughly 42%. Use Newey-West errors or coarser aggregation before claiming significance.`,
    python: `import pandas as pd
import numpy as np

# ic: daily IC series (one value per date).

n = len(ic)
rho = ic.autocorr(lag=1)            # lag-1 autocorrelation

# Effective number of independent observations under an AR(1)
# (each value = rho * previous + fresh noise) approximation:
n_eff = n * (1 - rho) / (1 + rho)
# rho=0.5 -> n_eff = n/3. Every 3 days ~ 1 unit of evidence.

# Naive vs adjusted t-stat on the mean IC:
t_naive = ic.mean() / (ic.std() / np.sqrt(n))
t_adj = ic.mean() / (ic.std() / np.sqrt(n_eff))
# t_adj = t_naive * sqrt(n_eff / n) -- here ~0.58 * t_naive.

# Always LOOK at the autocorrelation structure, not just lag 1:
acf = pd.Series({k: ic.autocorr(lag=k) for k in range(1, 21)})
# Slow geometric decay -> AR(1)-ish, formula above is fine.
# Spikes at lag 5 or 21 -> weekly/monthly structure: think
# calendar effects or rebalance cycles, and use Newey-West
# with enough lags instead of the simple formula.`,
    trap: `Treating autocorrelation as merely a nuisance to correct. In the IC of a signal it is also information: high persistence means the signal is slow, implying lower turnover and costs -- but also fewer independent bets per year, so the same mean IC compounds into less Sharpe. The statistical echo and the economic speed are the same fact.`,
    followUp: `Where else does the signal's own autocorrelation (its day-to-day position stability) show up in strategy economics? (Turnover: autocorrelation near 1 means positions barely change -- cheap to trade; near 0 means full daily churn -- costs explode.)`,
  },
  {
    id: "qr-stats-07-multiple-testing",
    module: "stats",
    title: "Why 5 of 100 signals look great",
    difficulty: "core",
    question: `A summer intern tests 100 candidate signals and excitedly reports that 5 are significant at the 5% level. What do you tell them -- and what result WOULD have been interesting?`,
    thinking: `Walk through what "significant at 5%" promises: IF a signal has no real edge, there is still a 5% chance its t-stat clears the bar by luck -- that is the definition of the threshold, a false-alarm rate per test. Now run 100 tests of (suppose) pure-noise signals: the EXPECTED number of false alarms is 100 times 0.05 = 5. The intern's headline is a textbook realization of the null hypothesis -- the outcome you would predict if every one of the 100 signals were worthless. This is the multiple-testing problem, and it is the central occupational disease of quant research, because the industry's daily activity IS testing hundreds of ideas. What would impress? Far more hits than the false-alarm budget (say 20 of 100), effect sizes well beyond the threshold, hits clustered in a family with a shared economic story, or -- the gold standard -- the 5 survivors continuing to work on data untouched during the search.`,
    answer: `Five percent significance means a 5% false-alarm rate per test, so 100 tests of pure noise EXPECT five "discoveries" -- the intern has reproduced the null hypothesis, not found alpha. Interesting would be materially more hits than the false-alarm budget, much larger t-stats than the bar, an economically coherent cluster of hits, or survival on held-out data. Every selection step must be counted: the relevant question is always "how many things were tried".`,
    python: `import numpy as np

rng = np.random.default_rng(0)

# 100 PURE NOISE 'signals': daily P&L with zero true mean,
# 5 years of daily data each. No skill anywhere by design.
n_sig, n_days = 100, 1260
pnl = rng.standard_normal((n_sig, n_days))

# t-stat of each signal's mean daily P&L:
t = pnl.mean(axis=1) / (pnl.std(axis=1) / np.sqrt(n_days))

n_hits = int((np.abs(t) > 1.96).sum())   # ~5, run after run
best = float(np.abs(t).max())            # ~2.8 typically

# The 'best backtest' is an order statistic, not an estimate:
# the expected MAXIMUM of N independent t-stats grows like
# sqrt(2 * ln(N)) even with zero skill anywhere.
exp_max = np.sqrt(2 * np.log(n_sig))     # ~3.0 for N=100

# Repeat the whole experiment many times to feel it:
reps = rng.standard_normal((200, n_sig, n_days))
tt = reps.mean(axis=2) / (reps.std(axis=2) / np.sqrt(n_days))
hits_per_rep = (np.abs(tt) > 1.96).sum(axis=1)
# hits_per_rep averages ~5 -- the intern's result, on repeat,
# from noise. Print the distribution and pin it to the wall.`,
    trap: `Only counting the tests that were RUN. The intern also eyeballed plots, tweaked definitions, and quietly dropped variants that looked bad -- informal selection is testing too. The true trial count is everything tried by everyone on the dataset, which is why fresh out-of-sample data is the only fully honest referee.`,
    followUp: `The 5 survivors are all variants of the same earnings-revision idea. Better or worse news than 5 unrelated hits? (Somewhat better -- correlated tests are closer to ONE test of one idea, and a shared economic story raises the prior; but they also share one failure mode.)`,
  },
  {
    id: "qr-stats-08-bonferroni-deflated-sharpe",
    module: "stats",
    title: "Correcting for the search",
    difficulty: "core",
    question: `Concretely, how do you adjust significance when you have tested N signals? Walk me through Bonferroni and the idea behind the deflated Sharpe ratio.`,
    thinking: `Start from what you want to control. Bonferroni controls the chance of even ONE false alarm across the whole family of N tests: divide the significance level by N. For 100 tests at a family-wide 5%, each test must clear 0.0005 -- a t-stat near 3.5 instead of 2. It is simple and safe but blunt: with many correlated tests it over-corrects, since 100 variants of one idea are not 100 independent chances to be fooled. The deflated Sharpe ratio attacks the same problem in the metric quants actually use: if you ran N independent noise backtests, the BEST Sharpe you would find grows in a predictable way -- on the order of the square root of 2 ln N over the sample length. So the honest benchmark for your champion strategy is not zero: it is the expected maximum of the noise you sifted through. The deflated Sharpe asks whether the champion beats THAT bar, additionally penalizing short samples and the fat-tailed, skewed returns that make Sharpe estimates noisier. Between the two sits Benjamini-Hochberg, which tolerates a controlled fraction of false discoveries -- often the right dial for research pipelines.`,
    answer: `Bonferroni: divide your significance level by the number of tests -- 100 tests at family-wide 5% means each needs p below 0.0005, t-stat near 3.5. Conservative, especially for correlated tests. The deflated Sharpe ratio reframes it for backtests: the best of N noise strategies has a predictably positive expected Sharpe, growing like the square root of 2 ln N over sample size, so your champion is judged against the expected best-of-noise, with further penalties for short history, skew, and fat tails. Benjamini-Hochberg is the middle path controlling the false-discovery rate.`,
    python: `import numpy as np
from scipy import stats

n_tests = 100
alpha_family = 0.05

# --- Bonferroni: per-test bar for a 5% family-wide error ---
alpha_each = alpha_family / n_tests          # 0.0005
t_bar = stats.norm.ppf(1 - alpha_each / 2)   # ~3.48 (two-sided)
# vs the naive single-test bar of 1.96. Roughly: each extra
# 10x of trials adds ~0.7-0.8 to the required t-stat.

# --- Deflated-Sharpe intuition: expected best-of-N noise ---
years = 5.0
# Expected max of N standard normal draws ~ sqrt(2 ln N);
# a noise strategy's Sharpe estimate over T years has SE
# ~ 1/sqrt(T), so the best of N noise backtests shows about:
exp_best_noise_sr = np.sqrt(2 * np.log(n_tests)) / np.sqrt(years)
# N=100, 5y -> ~1.36. A 'discovered' Sharpe of 1.2 after 100
# trials on 5 years is BELOW the bar luck alone sets.

# Same bar at other search intensities -- recite these:
for n in [10, 100, 1000]:
    bar = np.sqrt(2 * np.log(n)) / np.sqrt(years)
    # 10 -> ~0.96, 100 -> ~1.36, 1000 -> ~1.66 on 5y of data.
    # Industrial-scale search NEEDS long samples or live paper
    # trading to clear its own luck floor.`,
    trap: `Applying Bonferroni with N = the tests in the final notebook. N is the full search width: every parameter grid point, every discarded variant, every colleague's attempt on the same data. Understating N is how "3-sigma" discoveries die out-of-sample.`,
    followUp: `Your 100 signals have pairwise correlation around 0.8. Bonferroni demands t above 3.5 -- too harsh? What is the principled fix? (Yes; the effective number of independent tests is far below 100 -- estimate it from the correlation structure's eigenvalues, or control FDR with Benjamini-Hochberg instead.)`,
  },
  {
    id: "qr-stats-09-bootstrap",
    module: "stats",
    title: "Bootstrap confidence intervals",
    difficulty: "core",
    question: `Your strategy's Sharpe is 1.1 over eight years. Build a confidence interval for it without assuming returns are normal -- how does the bootstrap work and where does the naive version break for financial data?`,
    thinking: `The problem the bootstrap solves: the sampling distribution of the Sharpe -- how much the estimate would wobble across alternate histories -- has no trustworthy closed form when returns are skewed and fat-tailed, which they are. The bootstrap manufactures alternate histories from the one you have: resample n days WITH replacement from your return series, compute the Sharpe of that pseudo-history, repeat thousands of times, and read the confidence interval straight off the percentiles of the resulting distribution. The assumption you must interrogate: resampling days independently SHUFFLES time away, destroying autocorrelation and volatility clustering. If returns echo (and their squares always do), independent resampling understates how much a real alternate history could wander -- intervals come out too narrow, in the overconfident direction. The repair is the block bootstrap: resample contiguous blocks of 20-60 days, preserving short-range time structure inside blocks while still remixing the history.`,
    answer: `Resample the daily returns with replacement to build thousands of pseudo-histories, compute each one's Sharpe, and take percentiles -- e.g. 2.5th and 97.5th -- as the interval; no normality assumed anywhere. The catch: independent resampling destroys autocorrelation and volatility clustering, making intervals too NARROW for financial series. Use a block bootstrap -- resample contiguous chunks of roughly a month -- to keep local time structure. Expect an honest interval on 8 years of Sharpe 1.1 to be humblingly wide, roughly 0.4 to 1.8.`,
    python: `import numpy as np

# ret: 1-D numpy array of daily strategy returns, ~8 years.
rng = np.random.default_rng(0)
n = len(ret)
n_boot = 5000
ann = np.sqrt(252.0)

def sharpe(mat):
    # rows = bootstrap samples, columns = days
    return mat.mean(axis=1) / mat.std(axis=1) * ann

# --- Naive iid bootstrap: fully vectorized, no loop ---
# Each row of idx picks n random days WITH replacement.
idx = rng.integers(0, n, size=(n_boot, n))
sr_iid = sharpe(ret[idx])

# --- Block bootstrap: preserve short-range time structure ---
block = 21                      # ~1 month per block
n_blocks = int(np.ceil(n / block))
starts = rng.integers(0, n - block, size=(n_boot, n_blocks))
# Expand each start into a run of consecutive day indices:
offs = np.arange(block)
bidx = (starts[:, :, None] + offs[None, None, :])
bidx = bidx.reshape(n_boot, -1)[:, :n]
sr_blk = sharpe(ret[bidx])

ci_iid = np.percentile(sr_iid, [2.5, 97.5])
ci_blk = np.percentile(sr_blk, [2.5, 97.5])
# ci_blk is systematically WIDER -- the iid version was
# overconfident because it shuffled away vol clustering.
# If 0 sits inside ci_blk, eight years still has not proven
# this strategy -- consistent with the Sharpe-SE card.`,
    trap: `Bootstrapping the EQUITY CURVE or cumulative returns instead of the per-period returns -- cumulative series are dominated by their trend and resampling them is meaningless. Resample the increments, recompute the statistic from scratch each time.`,
    followUp: `Bootstrap the mean IC of a signal instead: what is the natural resampling unit, and why not resample individual (stock, day) cells? (Resample whole DATES -- cross-sectional dependence within a date is preserved; resampling cells pretends 3000 stocks on one day are independent draws.)`,
  },
  {
    id: "qr-stats-10-in-sample-out-of-sample",
    module: "stats",
    title: "In-sample vs out-of-sample",
    difficulty: "core",
    question: `Define in-sample and out-of-sample, explain why out-of-sample performance almost always disappoints, and describe how a disciplined research process protects its out-of-sample data.`,
    thinking: `Definitions first: in-sample (IS) is the data you touched while developing -- fitting, tuning, selecting, even just looking; out-of-sample (OOS) is data that had no influence on any choice you made. Why does OOS almost always come in worse? Selection bias, mechanically: whatever you shipped was chosen partly BECAUSE it scored well in-sample, and that score mixes true skill with luck that happened to fit that particular sample. Condition on "was selected as the best" and the luck component's expected value is positive -- in fresh data the luck resets to zero and only the skill persists. This is regression to the mean, the same reason a chart-topping fund disappoints next year. So expect a haircut -- practitioners plan for a third to a half of IS Sharpe evaporating. Discipline is about preserving OOS purity: decide the split before research starts, budget LOOKS at the holdout (each peek quietly converts OOS into IS), pre-register what will be evaluated, and keep a final untouched period for the go-live decision alone.`,
    answer: `In-sample is any data that influenced development -- fitting, tuning, or selection; out-of-sample is data with zero influence on any choice. OOS disappoints because selection inflates: the chosen strategy won partly by luck specific to the development sample, and luck does not travel. Plan for a 30-50% Sharpe haircut. Protect the holdout like production credentials: fix the split up front, strictly ration evaluations against it, pre-specify the metrics, and keep a never-touched final period for the launch decision.`,
    trap: `Believing a chronological train-test split is automatically out-of-sample. The moment you evaluate on the test period, adjust anything, and evaluate again, the test set has leaked into your decisions -- it is now in-sample with extra steps. OOS-ness is a property of the PROCESS, not of the date range.`,
    followUp: `Walk-forward evaluation refits the model each year on trailing data and trades the next year. Which problem does it solve, and which does it NOT solve? (It keeps each year's parameters honest; it does not fix SELECTION across ideas -- if you walk-forward 50 ideas and ship the best, the best-of-50 luck bias is fully intact.)`,
  },
  {
    id: "qr-stats-11-regime-dependence",
    module: "stats",
    title: "Regime dependence",
    difficulty: "hard",
    question: `A signal backtests with a Sharpe of 1.0 over 12 years, but a breakdown shows nearly all the P&L came from 2020-2022. How do you think about whether this signal is real, and would you allocate to it?`,
    thinking: `First reframe what the 12-year Sharpe is hiding: if the P&L is concentrated in 3 of 12 years, your evidence is closer to a 3-year sample than a 12-year one -- and you know from the Sharpe-SE card what 3 years proves (nearly nothing). Then ask WHY those years: was 2020-2022 a distinctive environment -- extreme volatility, retail flow, meme dynamics, near-zero rates? If the signal's economics only bind in that environment, you do not own a 1.0-Sharpe strategy; you own a conditional bet that pays when a specific regime recurs, and the honest questions become: what is the base rate of that regime, can you IDENTIFY it in real time (a regime you can only name in hindsight is not tradeable information), and what does the signal bleed in the other nine years? Also demand the mechanism: a story for why volatility or flow conditions activate this edge, stated BEFORE looking harder -- otherwise the regime analysis itself becomes another round of multiple testing, slicing until something explains.`,
    answer: `Concentration collapses the effective evidence from 12 years toward 3 -- statistically that proves very little. Diagnose the regime: what made 2020-2022 special, is there a mechanism linking that environment to the signal's economics, what is the bleed outside it, and can the regime be identified in real time rather than hindsight? I might allocate a small weight as an explicit conditional exposure with a regime monitor attached -- but never at a naive 1.0-Sharpe sizing, and only with a pre-stated mechanism, not a post-hoc story.`,
    python: `import pandas as pd
import numpy as np

# pnl: daily strategy P&L series over 12 years.
ann = np.sqrt(252.0)

# 1) Concentration diagnostics -- always run these first.
yearly = pnl.groupby(pnl.index.year).sum()
share = yearly / yearly.sum()
top3_share = share.sort_values().tail(3).sum()   # e.g. 0.95

# Sharpe with the golden years REMOVED -- the sceptic's number:
mask = ~pnl.index.year.isin([2020, 2021, 2022])
sr_ex = pnl[mask].mean() / pnl[mask].std() * ann  # e.g. 0.1

# 2) Regime conditioning -- test a MECHANISM, stated up front.
# Example hypothesis: the edge needs high market volatility.
# vix: daily VIX series aligned to pnl's dates.
hi_vol = vix > vix.rolling(756, min_periods=252).median()
sr_hi = pnl[hi_vol].mean() / pnl[hi_vol].std() * ann
sr_lo = pnl[~hi_vol].mean() / pnl[~hi_vol].std() * ann
# If sr_hi >> sr_lo AND the regime flag is computable in real
# time (rolling median above -- no full-sample stats!), you
# have a conditional strategy: trade it scaled by the flag.

# 3) Honesty check: how many regime definitions did you try
# before this one 'worked'? Each attempt is a test -- the
# multiple-testing meter keeps running here too.`,
    trap: `Dropping the good years and declaring the signal fake -- that is conditioning in the other direction. Some real strategies ARE crisis alpha, and deleting exactly the periods they are designed for is as biased as counting only them. The question is never "is it good without its best years" but "do I understand, and can I detect, when it pays".`,
    followUp: `Design the live monitor: what would make you cut this strategy after allocation? (Pre-commit: the regime flag being on while the strategy bleeds beyond its historical in-regime drawdown -- regime present but edge absent is the falsification, and it must be defined before the first dollar.)`,
  },
  {
    id: "qr-stats-12-is-ic-002-good",
    module: "stats",
    title: "Is an IC of 0.02 any good?",
    difficulty: "hard",
    question: `A signal shows a mean daily rank-IC of 0.02 over five years on a 2000-stock universe. Talk me through whether that is statistically real and whether it is economically worth trading.`,
    thinking: `Split the question in two, always. Statistical reality: you have roughly 1260 daily ICs; the t-stat is mean over standard error of the IC series -- with a typical IC volatility around 0.10, that is 0.02 divided by 0.10 over root 1260, about 7. Comfortably real, IF the IC series is not too autocorrelated (halve your enthusiasm and recheck with Newey-West if it is) and IF this signal was not the best of dozens tried (the multiple-testing meter again). Economic worth is a different bar: the fundamental law of active management approximates the information ratio as IC times the square root of breadth -- the number of INDEPENDENT bets per year. Naively 2000 stocks times 252 days is a huge breadth, but bets are correlated across stocks (sector factors) and across days (slow signals), so effective breadth is far smaller. Then costs: gross alpha per unit of turnover is thin at IC 0.02, so tradeability hinges on turnover, capacity, and what execution eats. Statistically real and economically marginal is a common -- and respectable -- verdict.`,
    answer: `Statistically: t-stat of the IC series is around 0.02 over (0.10 divided by root 1260), roughly 7 -- real, subject to autocorrelation and selection discounts. Economically: the fundamental law says IR is about IC times root of effective breadth, and effective breadth is far below stocks-times-days because bets correlate across names and time. After costs, an IC of 0.02 is typically worth trading only in a low-cost, high-breadth, multi-signal book -- valuable as one ingredient, rarely as a standalone strategy.`,
    python: `import pandas as pd
import numpy as np

# ic: daily rank-IC series, ~5 years (about 1260 values).
n = len(ic)

# --- Statistical reality ---
t_naive = ic.mean() / (ic.std() / np.sqrt(n))
rho = ic.autocorr(lag=1)
n_eff = n * (1 - rho) / (1 + rho)      # echo-adjusted evidence
t_adj = ic.mean() / (ic.std() / np.sqrt(n_eff))
# Quote t_adj, not t_naive -- and mentally subtract more if
# this signal was selected from a wider search.

# --- Economic worth: fundamental law, done honestly ---
icir_daily = ic.mean() / ic.std()
ir_annual = icir_daily * np.sqrt(252)  # pre-cost, pre-decay
# Equivalent statement: IR ~= IC * sqrt(breadth), where
# breadth = INDEPENDENT bets/year. 2000 stocks x 252 days is
# the fantasy ceiling; correlated names and sticky positions
# shrink it brutally. The ic series already embeds the
# cross-name correlation -- that is why icir uses ic.std().

# --- The cost gate, order-of-magnitude ---
# Gross spread P&L scales with IC; costs scale with turnover.
# Sketch: annual gross bps ~ k * IC ; annual cost bps ~
# turnover * cost_per_trade. At IC 0.02, doubling turnover
# for a slightly fresher signal usually LOSES money -- slow
# implementations of weak signals dominate fast ones.
daily_turnover = 0.15                  # fraction of book traded
cost_bps = 3.0                         # per unit traded
ann_cost_bps = daily_turnover * cost_bps * 252   # ~113 bps`,
    trap: `Quoting IR = IC times the square root of 2000 times 252 and announcing a double-digit information ratio. That formula needs INDEPENDENT bets; with sector structure across names and multi-day holding across time, effective breadth can be two orders of magnitude smaller than the row count.`,
    followUp: `Your book already runs six signals and this new one has 0.6 correlation to the composite. Does its standalone IC of 0.02 still matter? (Barely -- what matters is the INCREMENTAL IC of its component orthogonal to the existing book; regress it on the composite and evaluate the residual.)`,
  },
  {
    id: "qr-stats-13-signal-decay-or-bad-luck",
    module: "stats",
    title: "Dead signal or bad year?",
    difficulty: "hard",
    question: `A production signal that earned a Sharpe of 1.0 for six years has now returned roughly zero for 18 months. The PM asks: is it dead or just unlucky? How do you reason about this, and what do you recommend?`,
    thinking: `First accept the uncomfortable math: an 18-month Sharpe of a TRUE Sharpe-1.0 strategy has a standard error around 0.8 (one over root 1.5), so observing roughly zero is well within one-and-a-bit sigmas -- pure luck explains it easily, and no purely statistical test on 18 months of P&L will settle the question. That is the trap of the question: the P&L series alone cannot answer it on any useful timescale, so a good researcher reaches for FASTER, higher-breadth evidence. The IC series has thousands of cross-sectional observations per month -- test whether mean IC has dropped, not whether portfolio P&L has. Then interrogate mechanism and crowding: has the anomaly been published, have implementation costs risen, do crowding proxies (factor valuation spreads, short interest on the factor's legs, correlation of your book to known factor returns) show the trade is crowded? Decay in those diagnostics plus flat IC is evidence of death; flat P&L with intact IC points to costs, sizing, or construction. Recommend proportional action under uncertainty: scale down along a pre-agreed schedule rather than binary kill -- and note the meta-lesson: this decision rule should have been written BEFORE the drawdown, because deciding during one invites narrative-driven flip-flopping.`,
    answer: `Eighteen months of P&L cannot statistically separate dead from unlucky -- the standard error of an 18-month Sharpe is about 0.8, so zero is consistent with a true 1.0. Escalate to higher-breadth evidence: has the cross-sectional IC deteriorated, have costs or crowding proxies moved, is the economic rationale impaired -- published, arbitraged, structurally changed? If those diagnostics are intact, hold or trim modestly; if IC and mechanism have decayed together, wind down. Either way, act via a pre-committed de-risking schedule, not a discretionary kill in the middle of a drawdown.`,
    trap: `Running a significance test on the 18-month P&L and reporting "cannot reject that the strategy still works". Absence of evidence at this sample size is guaranteed regardless of the truth -- the test has essentially no power. The skilled move is switching to evidence with more observations per unit time, not torturing the P&L series.`,
    followUp: `Design the pre-commitment for the NEXT signal you launch: what goes in the decay protocol document? (Expected Sharpe and its SE by horizon, the IC threshold and lookback that triggers de-risking, crowding metrics to monitor, and a maximum drawdown that forces review -- all signed off before go-live.)`,
  },
  {
    id: "qr-stats-20260808-probabilistic-sharpe-ratio",
    module: "stats",
    title: "The probabilistic Sharpe ratio",
    difficulty: "hard",
    question: `A colleague reports an observed Sharpe of 1.4 over three years, and in the same breath a Probabilistic Sharpe Ratio (PSR) of 0.55 against a benchmark Sharpe of 1.0. Explain what PSR is doing that a plain t-test on the Sharpe does not, and why the 0.55 should worry you more than the headline 1.4 reassures you.`,
    thinking: `The plain-vanilla standard error of a Sharpe estimate, one over root n, assumes returns are normal -- zero skew, kurtosis of three. Real strategy returns usually are not: negative skew from short-vol or mean-reversion books, fat tails from crash risk, positive skew from trend-following. Those higher moments change the VARIANCE OF THE SHARPE ESTIMATOR ITSELF, not just the return distribution, and the naive formula ignores that entirely. PSR replaces it with an adjusted standard error that incorporates sample skewness and excess kurtosis, then asks a sharper question than "is the Sharpe positive": what is the probability the TRUE Sharpe exceeds some benchmark, given this adjusted uncertainty. A PSR of 0.55 against a modest benchmark of 1.0 means the corrected evidence barely clears a coin flip -- despite the flattering point estimate of 1.4, the return distribution's skew and kurtosis are wide enough that the confidence interval mostly overlaps mediocrity. The gap between the two numbers IS the finding: it says the point estimate is riding on unstable higher moments, not that the estimate itself is wrong.`,
    answer: `The naive Sharpe standard error assumes normal returns; PSR corrects it using the sample's skewness and kurtosis, since non-normal returns change the variance of the Sharpe ESTIMATOR itself. PSR then reports the probability the true Sharpe exceeds a chosen benchmark under that corrected uncertainty. A PSR of 0.55 versus benchmark 1.0 means the corrected evidence barely beats a coin flip, despite the headline 1.4 -- a strong signal that the return distribution's skew or fat tails (often negative skew from short-optionality strategies) make the point estimate far less trustworthy than it looks.`,
    trap: `Trusting the naive 1-over-root-n Sharpe standard error when the return distribution is visibly skewed. It understates uncertainty most exactly when it matters most -- for negatively skewed strategies like options-selling or merger arbitrage, where a few good years can mask a much wider true confidence interval.`,
    followUp: `This strategy is short-vol flavored -- negative skew, fat left tail. Does the PSR correction widen or narrow the confidence interval relative to what the naive normal assumption would suggest, and why does that matter for position sizing?`,
  },
  {
    id: "qr-stats-20260809-comparing-two-sharpes",
    module: "stats",
    title: "Is Strategy A's Sharpe really better than Strategy B's?",
    difficulty: "core",
    question: `Strategy A shows a 3-year annualized Sharpe of 1.4; Strategy B shows 0.9 over the same 3 years, and the two return streams have a 0.6 correlation with each other. A PM wants to allocate only to A. Is the gap statistically meaningful, and how do you test it properly?`,
    thinking: `Resist testing each Sharpe against zero separately and eyeballing "1.4 clearly beats 0.9" -- that ignores that the two estimates are correlated (built from overlapping market exposure) and ignores their individual sampling noise, both of which are large at 3 years. The right tool is a paired test for the DIFFERENCE of two Sharpes that accounts for their correlation -- the Jobson-Korkie test, with Memmel's correction to the standard-error formula, builds a standard error for (SR_A minus SR_B) that shrinks as the two strategies' correlation grows, because if they are highly correlated their common noise partially cancels in the difference. With correlation 0.6 and only 3 years of daily data, the standard error on a 0.5 Sharpe gap is often close to the gap itself, so the test frequently fails to reject "no real skill difference" even though 1.4 sounds obviously better than 0.9.`,
    answer: `Do not compare Sharpes against zero separately -- test the DIFFERENCE directly with a paired test like Jobson-Korkie (Memmel's corrected version), which builds a standard error for SR_A minus SR_B that accounts for the correlation between the two return streams. At 0.6 correlation and only 3 years of data, the standard error on a 0.5 Sharpe gap is often comparable to the gap itself, so "1.4 beats 0.9" frequently is not statistically distinguishable from noise. Report the test statistic, not the raw difference.`,
    python: `import numpy as np

def jobson_korkie_memmel(ret_a, ret_b):
    # ret_a, ret_b: aligned daily return series for the two strategies
    n = len(ret_a)
    mu_a, mu_b = ret_a.mean(), ret_b.mean()
    sig_a, sig_b = ret_a.std(), ret_b.std()
    rho = np.corrcoef(ret_a, ret_b)[0, 1]      # correlation between the two streams

    sr_a, sr_b = mu_a / sig_a, mu_b / sig_b     # DAILY sharpes (annualize after the test)

    # Memmel (2003) corrected variance of (sr_a - sr_b) under the null sr_a == sr_b
    var_diff = (1.0 / n) * (
        2 - 2 * rho
        + 0.5 * sr_a**2 + 0.5 * sr_b**2
        - rho**2 * (sr_a**2 + sr_b**2) / 2
        - rho * sr_a * sr_b
    )
    z = (sr_a - sr_b) / np.sqrt(var_diff)
    return z, sr_a * np.sqrt(252), sr_b * np.sqrt(252)

# ret_a, ret_b: 3 years of daily returns for the two strategies (~756 obs each)
# z, ann_a, ann_b = jobson_korkie_memmel(ret_a, ret_b)
# |z| < ~2 despite ann_a=1.4 vs ann_b=0.9 is common at this sample size --
# the headline gap looks large; the test says it is not distinguishable from luck`,
    trap: `Concluding the comparison is settled because each Sharpe individually clears its own significance-against-zero test. Two strategies can both be individually "significant" while their DIFFERENCE is not -- significance of A and significance of B do not imply significance of A minus B, especially when they share correlated market exposure.`,
    followUp: `The PM says correlation between A and B is irrelevant because the fund will run them both anyway, not choose one. Does the correlation still matter for the ALLOCATION decision even if not for the "which is better" question -- and in which direction?`,
  },
  {
    id: "qr-stats-20260810-multiple-testing-correction",
    module: "stats",
    title: "Bonferroni vs Benjamini-Hochberg for a signal search",
    difficulty: "hard",
    question: `You backtested 200 candidate signals overnight and 11 of them show a t-stat above 2 (the usual "significant" bar). Before telling anyone you found 11 real signals, how do you correct for the fact that you ran 200 tests, and how do Bonferroni and Benjamini-Hochberg differ in what they protect against?`,
    thinking: `Start from the base rate under pure noise: at a t-stat-2, roughly-5%-false-positive-rate threshold, testing 200 pure-noise signals should produce about 10 false hits by chance alone -- so 11 hits out of 200 is close to exactly what you would expect if NONE of them were real, which is the whole point of running this correction before getting excited. Bonferroni controls the family-wise error rate, the probability of ANY false positive across all 200 tests, by dividing the significance threshold by the number of tests -- simple and conservative, but punishing as the test count grows, and it treats one false positive among 200 real signals as catastrophic, an odd thing to want when you plan to further validate survivors anyway. Benjamini-Hochberg instead controls the false discovery rate, the expected PROPORTION of your surviving hits that are false, via a rank-dependent step-up threshold -- far less conservative, and the more common professional choice for an initial screen precisely because you expect additional validation, out-of-sample testing or a mechanism check, on whatever survives.`,
    answer: `At a t-stat-2 threshold and 200 pure-noise tests, roughly 10 false positives are expected by chance alone -- 11 hits is nearly indistinguishable from zero real signals, which is why the correction has to run before anyone gets excited. Bonferroni divides the significance threshold by the test count to control the probability of ANY false positive across the family -- simple but very conservative at 200 tests. Benjamini-Hochberg instead controls the expected FRACTION of survivors that are false, via a rank-dependent step-up threshold, which is less punishing and the standard choice for an initial screen you intend to further validate rather than trust outright.`,
    python: `import numpy as np
from scipy import stats

# t_stats: array of 200 t-statistics, one per candidate signal
rng = np.random.default_rng(0)
t_stats = rng.standard_normal(200)          # simulate: ALL 200 are pure noise
p_values = 2 * (1 - stats.norm.cdf(np.abs(t_stats)))   # two-sided p-values

naive_hits = (p_values < 0.05).sum()
print("naive hits at p<0.05:", naive_hits)   # ~10, purely by chance

# Bonferroni: divide the threshold by the number of tests -- controls
# P(any false positive) across the whole family, very conservative
bonf_thresh = 0.05 / len(p_values)
bonf_hits = (p_values < bonf_thresh).sum()
print("Bonferroni hits:", bonf_hits)         # typically 0 on pure noise

# Benjamini-Hochberg: sort p-values, find the largest rank k where
# p(k) <= (k / n) * alpha, reject all hypotheses up to that rank
sorted_p = np.sort(p_values)
n = len(sorted_p)
bh_line = (np.arange(1, n + 1) / n) * 0.05
below = sorted_p <= bh_line
bh_cutoff = sorted_p[below].max() if below.any() else 0.0
bh_hits = (p_values <= bh_cutoff).sum()
print("BH hits:", bh_hits)                   # controls the FALSE DISCOVERY rate`,
    trap: `Reporting the 11 raw hits as "11 signals found" without ever stating how many candidates were screened. The count of hits is meaningless without the denominator -- the same 11 hits out of 20 tests would be a strong result, and out of 2000 tests would be pure noise, and omitting the denominator, accidentally or not, is how p-hacked results get published.`,
    followUp: `BH flags 3 signals as surviving at a 5% false discovery rate. Does that mean you should trust those 3 as real, or is there a further validation step multiple-testing correction cannot substitute for?`,
  },
  {
    id: "qr-stats-20260811-cointegration",
    module: "stats",
    title: "Cointegration: why correlated is not enough for pairs trading",
    difficulty: "hard",
    question: `Two stocks in the same industry show 0.85 correlation of daily returns. A junior researcher wants to build a mean-reverting pairs trade on their price spread using that correlation as justification. Why is high return correlation not sufficient, what does cointegration actually require, and how do you test for it?`,
    thinking: `Separate what each statistic is about. Return correlation measures whether the two series MOVE together on the same day -- both react to shared industry and market news, so their daily changes rise and fall in sync. A pairs trade instead bets that the SPREAD between price LEVELS reverts to a stable mean over time, which is a completely different property: two stocks can share almost every daily shock (high return correlation) while their price levels drift apart forever with no restoring force, because a shared daily shock says nothing about whether there is a long-run equilibrium tying the two levels together. Recall from the data-stationarity card that individual price series are typically non-stationary random walks; cointegration is the special property that some linear combination of two non-stationary series -- the spread, with the right hedge ratio -- IS stationary, meaning it has a stable mean it keeps reverting to. The standard test, Engle-Granger, works in two steps: regress one price on the other by OLS to estimate the hedge ratio, then run an Augmented Dickey-Fuller test on the regression's residual (the implied spread) for a unit root; rejecting the unit root is evidence the spread is stationary and therefore the pair is cointegrated. A subtlety worth flagging: Engle-Granger's OLS step is not symmetric -- regressing A on B versus B on A can give a different hedge ratio and a different test outcome -- which is exactly why Johansen's test is preferred for anything beyond a simple two-asset case.`,
    answer: `Correlation says the two series move together day to day; cointegration says their price LEVELS are tied by a long-run equilibrium, so some linear combination of them -- the spread, with the right hedge ratio -- is itself stationary and mean-reverting, which is the actual property a pairs trade needs. Two stocks can share high return correlation from common daily shocks while drifting apart in level forever, with no cointegration at all. Test with Engle-Granger: regress one price on the other for the hedge ratio, then run an Augmented Dickey-Fuller test on the residual spread for a unit root -- rejecting it is evidence of cointegration. The OLS step is not symmetric between the two assets, which is why Johansen's test is the more robust choice beyond a simple pair.`,
    python: `import numpy as np
import pandas as pd
from statsmodels.tsa.stattools import coint, adfuller

# px_a, px_b: two price Series, same dates, same industry
rng = np.random.default_rng(0)
n = 1000
common_shock = rng.normal(0, 1, n).cumsum()          # shared daily shocks
drift_a = np.linspace(0, 5, n)                        # A drifts away from B
px_a = pd.Series(100 + common_shock + drift_a + rng.normal(0, 0.5, n))
px_b = pd.Series(100 + common_shock + rng.normal(0, 0.5, n))

ret_corr = px_a.pct_change().corr(px_b.pct_change())  # high: shared daily shocks
print("return correlation:", round(ret_corr, 2))       # looks promising on its own

# Engle-Granger: OLS hedge ratio, then ADF on the residual spread
hedge_ratio = np.polyfit(px_b, px_a, 1)[0]
spread = px_a - hedge_ratio * px_b
adf_stat, adf_p, *_ = adfuller(spread)
print("ADF p-value on spread:", round(adf_p, 3))       # NOT rejected here:
# the drift term means the spread itself is a random walk -- correlated
# shocks, but no equilibrium tying the two LEVELS together -- not cointegrated

# statsmodels' packaged version of the same two-step test:
eg_stat, eg_p, _ = coint(px_a, px_b)
print("coint() p-value:", round(eg_p, 3))`,
    trap: `Running the ADF test on the raw price difference A minus B instead of the OLS-implied residual A minus hedge_ratio times B. That silently assumes a hedge ratio of exactly one, which is rarely the right economic relationship between two stocks trading at different price levels or with different share counts outstanding -- it can miss a real cointegrating relationship or manufacture a fake one.`,
    followUp: `The cointegration test passes cleanly on 10 years of data, but the pairs trade has been losing money for the past 18 months. What do you check first? (Whether the cointegrating relationship itself has broken down recently -- test on a trailing rolling window rather than the full sample, since a structural change, like one company diverging fundamentally from its peer, can end a real historical cointegration relationship going forward even though the full-sample test still passes on stale evidence.)`,
  },
  {
    id: "qr-stats-20260812-block-bootstrap",
    module: "stats",
    title: "Block bootstrap for autocorrelated strategy returns",
    difficulty: "hard",
    question: `You want a bootstrap confidence interval for your strategy's annualized Sharpe ratio. Your daily returns have first-order autocorrelation of about 0.15 from overlapping signal decay. A teammate resamples individual days with replacement, the standard iid bootstrap. What's wrong with that, and what should you do instead?`,
    thinking: `The iid bootstrap resamples single observations independently, which implicitly assumes the observations ARE independent -- exactly what a 0.15 autocorrelation contradicts. Shuffling single days with replacement destroys the real day-to-day dependence in the series, so the resulting bootstrap distribution of Sharpe is narrower than the truth: the CI understates real uncertainty and gives false confidence. The fix is a block bootstrap: resample contiguous BLOCKS of consecutive days with replacement instead of single days, which preserves the within-block dependence and only breaks the weaker dependence across block boundaries. Block length is a genuine tuning choice -- too short and you're back to iid behavior; too long and you have too few effective blocks, which inflates variance the other way.`,
    answer: `iid resampling of individual days assumes independence, exactly what a 0.15 autocorrelation contradicts -- it shuffles away the real day-to-day dependence, so the bootstrap Sharpe distribution comes out too narrow and the CI understates the true uncertainty. Use a block bootstrap instead: resample contiguous blocks of consecutive days with replacement, which preserves the within-block dependence structure and only breaks the weaker dependence across block boundaries. Block length is a real choice -- too short collapses back toward iid, too long leaves too few effective blocks -- a common starting point is a handful of trading days per block for daily equity strategies.`,
    python: `import numpy as np

def sharpe(rets: np.ndarray) -> float:
    return rets.mean() / rets.std(ddof=1) * np.sqrt(252)

def block_bootstrap_sharpe_ci(rets: np.ndarray, block_len: int = 10,
                               n_boot: int = 2000, seed: int = 0) -> tuple[float, float]:
    rng = np.random.default_rng(seed)
    n = len(rets)
    n_blocks = int(np.ceil(n / block_len))
    boot_sharpes = np.empty(n_boot)

    for b in range(n_boot):
        # pick random block START indices, with replacement -- each block is
        # a CONTIGUOUS slice, so within-block autocorrelation survives intact
        starts = rng.integers(0, n - block_len + 1, size=n_blocks)
        sample = np.concatenate([rets[s:s + block_len] for s in starts])[:n]
        boot_sharpes[b] = sharpe(sample)

    return float(np.percentile(boot_sharpes, 2.5)), float(np.percentile(boot_sharpes, 97.5))

# compare against the iid version -- rng.choice(rets, size=n, replace=True) --
# and watch the confidence interval widen once blocks preserve dependence`,
    trap: `Reporting the iid bootstrap CI anyway because "the point estimate is the same either way." The point estimate often IS similar -- it's the WIDTH of the interval that's wrong, and a falsely narrow CI is exactly what makes a mediocre strategy look statistically significant when it isn't.`,
    followUp: `How would you pick the block length in a more principled way than guessing "10 days," using the return series' own autocorrelation function?`,
  },
  {
    id: "qr-stats-20260813-kendall-vs-spearman-ties",
    module: "stats",
    title: "Kendall's tau vs Spearman for signals with ties",
    difficulty: "core",
    question: `You're computing a rank correlation between a discrete credit-rating-style signal (only 7 distinct values across 500 names, so heavy ties) and forward returns. You default to Spearman's rank-IC, the usual choice. A teammate suggests Kendall's tau instead for this specific signal. What's the difference, and why does tie-heaviness matter for the choice?`,
    thinking: `Spearman's rank correlation is just Pearson correlation computed on RANKS instead of raw values -- and computing a rank requires a rule for ties, almost always average rank, where every tied observation gets the mean of the rank positions it collectively occupies. With only 7 distinct values across 500 names, huge blocks of names share identical average ranks, and Spearman is quietly evaluating a linear correlation between two variables that are mostly flat, tied plateaus rather than genuinely continuous rankings. Kendall's tau works completely differently: it counts, over every PAIR of observations, whether the two variables agree or disagree in relative order -- concordant versus discordant -- and by construction it has an explicit adjustment for tied pairs (tau-b) that neither inflates nor deflates the statistic from ties the way Spearman's average-rank trick implicitly can. The practical difference in a quant context: Kendall's tau is more directly interpretable as "probability of correctly ordering a random pair," which is closer to what a bucketed signal is actually promising you, and it tends to be more robust, though also noisier to estimate and much more expensive computationally at O(n^2) pairs versus Spearman's O(n log n) sort-based cost -- a real consideration once n is tens of thousands of names.`,
    answer: `Spearman correlates average ranks, and average-rank ties compress a heavily-discretized signal like a 7-bucket rating into a handful of tied plateaus, which can distort the correlation in ways that are hard to reason about. Kendall's tau instead counts concordant versus discordant PAIRS directly, with an explicit tie correction (tau-b), so it degrades more gracefully and predictably with heavy ties and maps more directly onto "probability of ranking a random pair correctly" -- a more natural read for a bucketed signal. Tradeoff: Kendall's tau is O(n^2) pairwise versus Spearman's O(n log n), which matters once your universe is large.`,
    python: `import numpy as np
import pandas as pd
from scipy import stats

rng = np.random.default_rng(0)
n = 500
rating = rng.integers(1, 8, n)              # only 7 distinct values -- heavy ties
noise = rng.normal(0, 1, n)
fwd_ret = 0.01 * rating + noise             # genuine but modest relationship

spearman_rho, _ = stats.spearmanr(rating, fwd_ret)
kendall_tau, _ = stats.kendalltau(rating, fwd_ret)   # tau-b: tie-corrected by default

print("spearman:", round(spearman_rho, 3))
print("kendall tau-b:", round(kendall_tau, 3))
# with 7-bucket ties this heavy, the two statistics are NOT directly
# comparable in magnitude to each other -- don't mix them across a report

# cost check: Kendall is O(n^2) pairwise comparisons vs Spearman's O(n log n)
# %timeit stats.kendalltau(rating, fwd_ret)    # noticeably slower at scale
# %timeit stats.spearmanr(rating, fwd_ret)`,
    trap: `Comparing a Spearman rho from one signal against a Kendall tau from another and treating them as the same scale of "how strong is the IC." They are different statistics built on different mechanics -- a 0.10 Kendall tau and a 0.10 Spearman rho do not represent the same strength of relationship, so mixing them across a signal-comparison report silently misranks the signals.`,
    followUp: `Your universe grows from 500 names to 8,000, and Kendall's tau now takes noticeably longer to compute in your daily IC pipeline. Is there a faster tau estimator that trades a small amount of accuracy for better than O(n^2) scaling?`,
  },
  {
    id: "qr-stats-20260814-heteroskedastic-robust-se",
    module: "stats",
    title: "Robust standard errors for cross-sectional regressions",
    difficulty: "hard",
    question: `You regress next-month return on a valuation signal, cross-sectionally, one regression per month. Large-cap names have much tighter residual variance than small-caps in every cross-section. Does that bias your coefficient estimate? Does it bias your standard errors, and what do you do about it?`,
    thinking: `Heteroskedasticity -- residual variance that differs systematically across observations, here by cap bucket -- doesn't bias the OLS coefficient itself; OLS stays unbiased as long as the mean relationship is right, it's just no longer the most efficient estimator (it doesn't downweight noisier small-cap observations). The real damage is to the STANDARD ERROR: the classical OLS formula assumes constant residual variance to derive itself, and once that's violated it gives you the wrong se -- direction depends on how variance correlates with your regressor -- which corrupts every t-stat and significance call built on top of it. Fix: heteroskedasticity-robust (White/Huber, commonly HC1) standard errors, which estimate the coefficient's variance directly from squared residuals instead of assuming they're all equal, with no need to know the exact functional form of the heteroskedasticity.`,
    answer: `No bias to the coefficient itself -- OLS stays unbiased under heteroskedasticity, just less efficient. The standard errors ARE biased though, since the classical formula assumes constant residual variance; once large-caps and small-caps have different residual variance, that formula is wrong and can overstate or understate significance. Fix by using heteroskedasticity-robust standard errors (White/HC1), which estimate variance from the squared residuals directly rather than assuming homoskedasticity.`,
    python: `import numpy as np
import statsmodels.api as sm

rng = np.random.default_rng(7)
n = 500
decile = rng.integers(1, 11, n)           # cross-sectional bucket, e.g. size decile
x = rng.normal(size=n)
noise_scale = (decile ** 2) / 8.0          # residual variance grows with decile: heteroskedastic
y = 0.5 * x + rng.normal(scale=noise_scale)

X = sm.add_constant(x)
classical = sm.OLS(y, X).fit()
robust = sm.OLS(y, X).fit(cov_type="HC1")  # White/HC1 heteroskedasticity-robust SEs

print("classical SE on x:", round(classical.bse[1], 4))
print("HC1 robust SE on x:", round(robust.bse[1], 4))
# same coefficient, different SE -- only the robust one is valid for a t-test here`,
    trap: `Concluding the factor "isn't significant" (or is) off classical OLS t-stats in a cross-section you already know is heteroskedastic, which is nearly always true across market caps. Always refit with cov_type="HC1" (or cluster-robust SEs for panel data) before trusting the p-value.`,
    followUp: `Newey-West handles time-series autocorrelation and HC1 handles cross-sectional heteroskedasticity -- what do you use if you have both at once, e.g. a monthly panel regression across many stocks over many periods?`,
  },
  {
    id: "qr-stats-20260815-ljung-box",
    module: "stats",
    title: "Ljung-Box test: leftover autocorrelation in strategy returns",
    difficulty: "core",
    question: `Your daily strategy return series looks roughly i.i.d. by eye, but before you compute a plain (non-Newey-West) standard error on its mean anywhere, you want a formal check for autocorrelation. How does the Ljung-Box test work, and what does a small p-value actually tell you?`,
    thinking: `Ljung-Box is a portmanteau test: it combines the sample autocorrelations at lags 1 through h into a single weighted sum of squares, which is approximately chi-squared distributed under the null hypothesis of "no autocorrelation at any of these lags." A small p-value rejects that null -- it says at least one of those lags shows autocorrelation too large to be sample noise, not that every lag does. Connect this back to why it matters: autocorrelated returns mean each new observation carries less new information than an i.i.d. one would, so the effective sample size is smaller than the raw count, and a plain standard error computed as if observations were independent understates the true uncertainty -- exactly the motivation for Newey-West elsewhere in this module. Practically, run it on raw returns (some autocorrelation is often mechanical -- stale or asynchronous end-of-day pricing, bid-ask bounce) and separately on any regression's residuals, since a significant result on residuals specifically invalidates that regression's ordinary standard errors.`,
    answer: `Ljung-Box sums the squared sample autocorrelations across the first h lags into one statistic that's approximately chi-squared under the null of no autocorrelation through lag h. A small p-value rejects that null, meaning real autocorrelation exists somewhere in those lags. For a return series, that's the trigger to use Newey-West standard errors instead of plain ones -- autocorrelated returns carry fewer effective independent observations than the raw sample size implies.`,
    python: `import pandas as pd
from statsmodels.stats.diagnostic import acorr_ljungbox

rets = pd.Series(...)  # daily strategy returns

# test the first 10 lags at once; each row is one cumulative-lag test
result = acorr_ljungbox(rets, lags=[10], return_df=True)
p_value = result["lb_pvalue"].iloc[0]

if p_value < 0.05:
    # reject "no autocorrelation through lag 10" -- use Newey-West SEs downstream
    print("significant autocorrelation detected, use HAC standard errors")
else:
    # failing to reject is NOT proof of independence -- see the trap below
    print("no significant autocorrelation detected at this lag count")`,
    trap: `Running the test on a short window (say, 60 days) and treating a non-significant result as proof the returns are independent. The test has low power with few observations, so "fail to reject" there is weak evidence at best -- absence of a significant result is not evidence of absence.`,
    followUp: `Ljung-Box says lag 10 is significant. How do you find which lag is actually driving it, and how would you tell mechanical autocorrelation (stale end-of-day pricing) apart from genuine, tradeable signal decay?`,
  },
  {
    id: "qr-stats-20260816-fama-macbeth",
    module: "stats",
    title: "Fama-MacBeth: cross-sectional regressions done right",
    difficulty: "hard",
    question: `You want to estimate the risk premium -- the average return per unit of exposure -- for three characteristics (value, momentum, size) using a panel of stock returns and characteristics. Walk through the Fama-MacBeth two-pass procedure, and explain why its standard errors differ from just pooling everything into one big panel regression.`,
    thinking: `The naive move -- stack every (stock, date) row into one giant panel and run a single pooled OLS of returns on characteristics -- treats every row as an independent observation, which is false in a specific way: on any given date, residuals across STOCKS are correlated (a common shock, like a market-wide move, hits every name's residual that day), so pooled OLS standard errors are badly understated -- the same disease as overlapping returns or autocorrelation, but along the cross-sectional axis instead of time. Fama-MacBeth handles this with two passes. First, run a SEPARATE cross-sectional regression of returns on characteristics for every single date, producing one coefficient -- the estimated risk premium that date -- per characteristic per date: a whole time series of estimates, exactly the same idea as the daily-IC-series card. Second, the final risk premium for each characteristic is just the TIME-SERIES MEAN of that coefficient series, with a standard error computed as its time-series std over root T -- which correctly reflects only genuine time-series variation, because the cross-sectional correlation problem was already absorbed inside each individual date's regression and never spreads across dates.`,
    answer: `Run one cross-sectional regression of returns on characteristics PER DATE, producing a time series of coefficient (risk premium) estimates -- then take the time-series mean of that series as the final estimate, with a standard error computed as its std over root T. This sidesteps the cross-sectional correlation of residuals within a date, which a single pooled panel regression ignores and which badly overstates precision if left uncorrected -- the same disease as ignoring autocorrelation in a time series, just along the other axis.`,
    python: `import numpy as np
import statsmodels.api as sm

# panel: date, ticker, fwd_ret, value, momentum, size

def cross_sectional_regression(g):
    X = sm.add_constant(g[["value", "momentum", "size"]])
    model = sm.OLS(g["fwd_ret"], X).fit()
    return model.params  # one row of coefficients for this date

# pass 1: a SEPARATE regression per date -- the coefficient time series
gammas = panel.groupby("date", group_keys=False).apply(cross_sectional_regression)

# pass 2: risk premium = time-series mean of each characteristic's
# coefficient; SE = time-series std / sqrt(T), NOT a pooled-panel SE
T = len(gammas)
premia = gammas.mean()
se = gammas.std() / np.sqrt(T)
t_stats = premia / se

# same Newey-West concern as the IC series applies to this final step:
# if gammas is autocorrelated over time, wrap it in HAC too --
# nw_fit = sm.OLS(gammas["value"], np.ones(T)).fit(
#     cov_type="HAC", cov_kwds={"maxlags": 5})`,
    trap: `Treating Fama-MacBeth standard errors as automatically fixing everything. They correctly handle cross-sectional correlation within a date, but the second-pass time-series mean is still vulnerable to autocorrelation ACROSS dates -- a persistent characteristic -- exactly like the IC series. If the coefficient series is autocorrelated over time, wrap the final step in Newey-West too; FM is not a bullet that needs no further correction.`,
    followUp: `Momentum's Fama-MacBeth t-stat is 3.5 on monthly data over 20 years. A colleague reruns it on weekly data and gets a t-stat of 7. Which do you trust more, and why doesn't sampling more frequently just give you more evidence for free? (Trust the monthly number more, skeptically -- weekly characteristic exposures are highly persistent within a month, so the extra frequency mostly manufactures pseudo-observations rather than fresh information, the same overlap-inflation logic as the earlier Newey-West card.)`,
  },
  {
    id: "qr-stats-20260817-white-reality-check",
    module: "stats",
    title: "White's Reality Check: testing many strategies without overfitting the winner",
    difficulty: "hard",
    question: `You backtested 200 variants of a strategy (different lookback windows, thresholds, universes) and the best one has a Sharpe of 2.1 with a p-value of 0.01 against the null of zero mean return. Your manager asks: is that p-value even meaningful given you tried 200 things? What's the right way to test the BEST strategy's significance accounting for the whole search?`,
    thinking: `A single strategy's p-value of 0.01 assumes it was the only thing you tested -- but you tested 200, and the maximum of 200 noisy Sharpe ratios is going to look impressive even under the null that all 200 have zero true edge, purely from selection. Bonferroni correction (multiply the p-value by 200) is one blunt fix but it's conservative and, more importantly, ignores that the 200 variants are correlated with each other (they're all minor tweaks of the same base strategy on overlapping data), so their effective number of independent tests is much smaller than 200. White's Reality Check (and its refinement, the Superior Predictive Ability test) instead bootstraps the JOINT distribution of all 200 strategies' returns together, preserving their correlation structure, to build a null distribution for the MAXIMUM Sharpe across the whole set -- then checks where your actual best Sharpe falls in that bootstrapped distribution of maxima. That answers the real question: how often would blind luck alone, searching over 200 correlated variants on this same data, produce a max Sharpe this good?`,
    answer: `The naive p-value ignores that you picked the winner out of 200 tries, so it overstates significance. White's Reality Check bootstraps the joint returns of all 200 variants together (preserving their correlation, unlike Bonferroni) to build a null distribution for the BEST Sharpe across the whole search, then checks where your actual winner falls in that distribution -- giving a p-value that's honest about the size and structure of the search.`,
    python: `import numpy as np

def reality_check_pvalue(returns_matrix: np.ndarray, n_boot: int = 1000,
                          rng: np.random.Generator | None = None) -> float:
    # returns_matrix: (n_days, n_strategies) -- daily returns of every
    # variant tried, so the bootstrap preserves cross-strategy correlation
    rng = rng or np.random.default_rng(0)
    n_days, n_strats = returns_matrix.shape

    observed_mean = returns_matrix.mean(axis=0)
    best_observed = observed_mean.max()

    # demean each strategy so the bootstrap simulates the NULL of zero
    # true edge everywhere, while keeping cross-strategy correlation intact
    demeaned = returns_matrix - observed_mean

    boot_max = np.empty(n_boot)
    for b in range(n_boot):
        idx = rng.integers(0, n_days, size=n_days)   # iid resample of days
        boot_max[b] = demeaned[idx].mean(axis=0).max()

    # how often does pure luck (search over n_strats correlated variants,
    # all truly zero-edge) produce a max this good or better?
    return float((boot_max >= best_observed).mean())`,
    trap: `Using Bonferroni (p times n_strategies) as if it were equivalent. Bonferroni assumes independence across the 200 tests, which wildly overcorrects when variants are highly correlated -- it can make a genuinely good strategy look insignificant, the opposite failure from not correcting at all.`,
    followUp: `Given the iid daily resampling in the code above, what's missing if strategy returns are autocorrelated? (Use a block bootstrap -- resampling contiguous blocks of days instead of single days -- to preserve within-strategy serial correlation, the same fix as for a single-strategy Newey-West-style bootstrap.)`,
  },
  {
    id: "qr-stats-20260818-power-min-sample",
    module: "stats",
    title: "How much history do you need to detect an IC of 0.03?",
    difficulty: "hard",
    question: `A colleague claims their new signal has a true IC of about 0.03 against 1-day forward returns. Assuming that's really the population value, roughly how many independent daily observations would you need to reject the null of zero IC at the 5% level with reasonable power? Walk through the calculation.`,
    thinking: `This is a power calculation, and the key move is mapping IC onto a familiar test statistic instead of treating it as some bespoke quantity. Under the usual approximation, the t-statistic for a correlation r over n independent observations is roughly t = r * sqrt(n), for small r. To reject at the 5% level two-sided you need the t-stat above about 1.96, and for reasonable power (say 80%) rather than just barely-significant, standard power tables push the required t up to roughly 2.8 (the significance threshold plus about 0.84 more for 80% power under a normal approximation). Solving n = (t / r)^2 with r = 0.03 and t about 2.8 gives n about 8,700 -- almost 35 years of daily independent observations, which single-name daily cross-sections almost never truly deliver because returns are strongly cross-sectionally AND serially correlated, shrinking the effective independent sample far below the raw day count. This is exactly why IC alone is a weak signal-selection criterion at these small magnitudes without a long enough or wide enough (many independent names) sample.`,
    answer: `Using t about equal to IC * sqrt(n), solving for n at a 5%-significance, 80%-power target (t about 2.8) with IC = 0.03 gives n about 8,700 independent observations -- roughly 35 years of daily data if each day were truly independent, which single-asset daily returns are not, since serial and cross-sectional correlation shrink the effective sample well below the raw day count. This is why a small, "real" IC needs either a very long track record, a very wide cross-section each day, or both, before you can trust it's not noise.`,
    python: `import numpy as np
from scipy import stats as sps

def required_n(ic: float, alpha: float = 0.05, power: float = 0.80) -> float:
    z_alpha = sps.norm.ppf(1 - alpha / 2)   # two-sided significance threshold
    z_power = sps.norm.ppf(power)           # extra margin for the power target
    t_required = z_alpha + z_power
    return (t_required / ic) ** 2

n_needed = required_n(ic=0.03)
years_needed = n_needed / 252   # assuming ONE independent obs per trading day

print(f"observations needed: {n_needed:.0f}")
print(f"years needed at 1 indep obs/day: {years_needed:.1f}")

# how the required n scales with a slightly higher true IC
for ic in [0.01, 0.02, 0.03, 0.05, 0.08]:
    print(f"IC={ic}: n needed ~ {required_n(ic):.0f}")`,
    trap: `Treating each trading day as one independent observation. With overlapping return windows or serially correlated signals, the EFFECTIVE sample size is much smaller than the day count -- the same problem as overlapping returns and Newey-West corrections elsewhere in this deck -- so a naive day-count power calculation is systematically too optimistic.`,
    followUp: `How does using a cross-section of 500 names per day instead of one asset change this? (If cross-sectional observations were independent you'd get 500x the daily sample size and need far less history -- but they're not independent either, since names share sector and market factor exposure, so the true effective sample lies somewhere between "one obs per day" and "one obs per name per day," and estimating that shrinkage factor honestly is its own hard problem.)`,
  },
  {
    id: "qr-stats-20260819-arch-lm-test",
    module: "stats",
    title: "Testing for ARCH effects before trusting a constant-volatility model",
    difficulty: "hard",
    question: `Your risk model assumes daily portfolio return volatility is constant and estimates it as a simple trailing sample standard deviation. Before defending that assumption to a risk committee, how would you actually TEST whether volatility clustering (ARCH effects) is present, rather than just eyeballing a chart?`,
    thinking: `Eyeballing a volatility chart for "clumpy-looking" turbulence is exactly the kind of judgment call a risk committee pushes back on -- you want a formal test. The classic one is Engle's ARCH-LM test: regress the SQUARED (demeaned) returns on their own lagged values, r_t^2 on r_{t-1}^2, ..., r_{t-q}^2, and test whether the regression's R-squared is significantly different from zero -- under the null of no ARCH effects (constant conditional variance), n times R-squared is asymptotically chi-squared with q degrees of freedom. The intuition: if today's squared return has no predictive power for tomorrow's squared return, variance really is roughly constant; if it does -- almost universally true for real asset returns -- a constant-volatility model is measurably wrong, not just aesthetically unconvincing. Practically, this also tells you not just yes/no but which lag count q matters, informing how far back a GARCH or EWMA volatility model should actually look, and it gives a citable, reproducible number instead of a chart.`,
    answer: `Use Engle's ARCH-LM test: regress squared, demeaned returns on their own lagged values out to some number of lags q, and test the regression's explanatory power -- under no ARCH effects, n times R-squared is asymptotically chi-squared with q degrees of freedom, so a significant statistic rejects the constant-variance null. This gives a reproducible, citable answer instead of a chart-based judgment call, and the significant lag count also indicates how far back a GARCH or EWMA volatility model should look.`,
    python: `import numpy as np
import pandas as pd
from scipy import stats

def arch_lm_test(returns: pd.Series, lags: int = 5):
    r = returns - returns.mean()          # demean first -- test is on the VARIANCE
    r2 = r ** 2

    # build lagged squared-return regressors
    cols = {"lag_" + str(i): r2.shift(i) for i in range(1, lags + 1)}
    X = pd.DataFrame(cols).dropna()
    y = r2.loc[X.index]

    # OLS via the normal equations -- add an intercept column
    Xm = np.column_stack([np.ones(len(X)), X.values])
    beta, *_ = np.linalg.lstsq(Xm, y.values, rcond=None)
    fitted = Xm @ beta
    ss_res = ((y.values - fitted) ** 2).sum()
    ss_tot = ((y.values - y.values.mean()) ** 2).sum()
    r_squared = 1 - ss_res / ss_tot

    n = len(y)
    lm_stat = n * r_squared                       # asymptotically chi2(lags) under H0
    p_value = 1 - stats.chi2.cdf(lm_stat, df=lags)
    return lm_stat, p_value

# a p-value near 0 rejects "constant volatility" -- ARCH effects are present`,
    trap: `Running the test on raw returns without demeaning first, or on returns with strong autocorrelation in the MEAN, then attributing everything flagged to volatility clustering. A nonzero, autocorrelated mean can itself distort the squared-return regression; demean (or use residuals from a mean model) before testing so the LM statistic isolates variance dynamics specifically.`,
    followUp: `The test comes back overwhelmingly significant at every lag you try, out to 60 days. Does that mean you need a volatility model with 60 lags of memory? (No -- ARCH-LM significance just tells you clustering exists somewhere in that lag range, not the right functional form or memory length; a parsimonious GARCH(1,1) captures long, decaying memory with just two parameters precisely because volatility shocks decay smoothly rather than needing an explicit lag for every day that shows up significant in the LM test.)`,
  },
  {
    id: "qr-stats-20260820-power-analysis-ic",
    module: "stats",
    title: "How much data do you need to detect an IC of 0.02?",
    difficulty: "core",
    question: `Before running a multi-year backtest to test a new signal, your PM asks: if this signal's TRUE mean IC is 0.02 (a realistic, modest edge) and daily IC volatility is around 0.10 as usual, how many days of data do you need for an 80% chance of detecting it as statistically significant at all -- rather than complaining afterward the backtest wasn't long enough?`,
    thinking: `This is a power calculation, the flip side of the standard-error questions elsewhere in this module -- instead of asking how uncertain your estimate is, ask how likely you are to observe a significant result at all, given the true effect size, before you have spent months collecting data. The standard formula for detecting a mean of known noise level at significance level alpha (two-sided 5%) and power 1 minus beta (80%, the conventional target): required sample size scales with (z_alpha plus z_beta) squared, times (IC volatility over true mean IC) squared -- so required n is proportional to the SQUARE of the noise-to-signal ratio. Since IC volatility here is roughly 5 times the mean IC (0.10 over 0.02), that ratio gets squared to 25 inside the formula, meaning a decision most people make on gut feel is actually dominated entirely by that one ratio. Plug in numbers and the answer lands in the many-hundreds-to-low-thousands of days even for a genuinely real signal at typical IC magnitudes -- the uncomfortable practical lesson that testing a modest-edge signal properly is structurally a multi-year commitment, not a quick pilot, consistent with the earlier "is IC 0.02 any good" arithmetic but run prospectively instead of after the fact.`,
    answer: `Use the standard power formula for detecting a mean of known noise level: required n is roughly (z_alpha plus z_beta) squared, times (sigma over mu) squared, where sigma is daily IC volatility and mu is the true mean IC you want to detect. At two-sided 5% significance and 80% power, z_alpha plus z_beta is about 2.8, so n is about 2.8 squared times (0.10 over 0.02) squared -- on the order of 2000 days, roughly 8 years of daily data -- just for an 80% chance a genuinely real IC-0.02 signal clears significance at all. This is why testing modest-edge signals properly is a multi-year commitment, and why an underpowered short backtest returning "not significant" is nearly uninformative about whether the signal is real.`,
    python: `import numpy as np
from scipy import stats

def required_days(true_ic, ic_vol, alpha=0.05, power=0.80):
    z_alpha = stats.norm.ppf(1 - alpha / 2)   # two-sided critical value
    z_beta = stats.norm.ppf(power)            # power target
    n = ((z_alpha + z_beta) * ic_vol / true_ic) ** 2
    return n

for true_ic in [0.01, 0.02, 0.03, 0.05]:
    n = required_days(true_ic, ic_vol=0.10)
    print(true_ic, round(n), "days ~", round(n / 252, 1), "years")
# smaller true IC needs dramatically MORE data -- required n scales with
# the square of (noise / signal), so halving the true edge roughly
# QUADRUPLES the years needed to reliably detect it

# sanity-check against a direct simulation: does an 80%-powered sample
# size actually hit ~80% detection empirically?
rng = np.random.default_rng(0)
n_needed = round(required_days(0.02, 0.10))
hits = 0
trials = 2000
for _ in range(trials):
    ic_sample = rng.normal(0.02, 0.10, size=n_needed)
    t = ic_sample.mean() / (ic_sample.std() / np.sqrt(n_needed))
    hits += abs(t) > stats.norm.ppf(0.975)
print(hits / trials)   # should land close to 0.80`,
    trap: `Designing the backtest length around "however much history the vendor happens to provide" rather than around the power calculation, then treating a null result on that arbitrary window as evidence the signal is fake. An underpowered test that fails to reject has barely updated your belief either way -- power analysis run BEFORE the trial tells you whether a null result would even be informative.`,
    followUp: `Your PM says 8 years is too long to wait and wants to run the test across 5 correlated but distinct sub-universes (US, Europe, Japan, and so on) simultaneously to get more data faster. Does that actually solve the power problem, or just move it? (Partially -- if the sub-universes' ICs were genuinely independent it would multiply effective sample size and shorten the needed calendar time, but if the signal's edge and its noise are correlated across regions, as most global factors are, the EFFECTIVE independent sample size is far less than 5x, and you are still needing calendar time, not just more tickers, per the breadth discussion in the fundamental-law-of-active-management card.)`,
  },
  {
    id: "qr-stats-20260821-two-way-clustering",
    module: "stats",
    title: "Two-way clustered standard errors for panel regressions",
    difficulty: "hard",
    question: `You regress daily stock returns on a signal in a pooled panel -- every stock, every date, stacked into one big regression -- and get a t-stat of 8 using ordinary OLS standard errors. A colleague says you need to cluster by BOTH date and firm, not just one or the other. Why would clustering on only one dimension still leave the t-stat inflated, and what does two-way clustering actually do differently?`,
    thinking: `Think about the two distinct ways observations in a stacked panel are NOT independent, because OLS assumes every row is an independent draw and a stock-date panel violates that in two directions at once. Within a single date, returns across stocks are correlated -- market-wide moves hit every name that day, so thousands of rows sharing one date are far fewer than that many independent pieces of evidence, the same disease the per-date IC card addresses by aggregating to one number per date first. Within a single stock over time, returns are autocorrelated across nearby dates -- the same slow-signal echo effect from the autocorrelation card. Clustering by date alone fixes the cross-sectional problem but still assumes each stock's own time series is independent draws, which it is not. Clustering by firm alone does the reverse -- fixes the time-series problem, leaves the cross-sectional correlation on the table. Two-way clustering combines variance estimates clustered by date, by firm, and by their intersection, added back to avoid double-counting, producing a standard error robust to both forms of non-independence simultaneously -- and because a pooled panel regression usually has both problems at once, one-way clustering on the more obvious dimension routinely still overstates significance by a large factor.`,
    answer: `Ordinary OLS standard errors, and even one-way-clustered ones, understate the true standard error of a pooled panel regression because stock-date rows are correlated in two separate directions at once -- across stocks within a date (market-wide co-movement) and across dates within a stock (autocorrelation) -- and clustering on only one dimension corrects only one of the two. Two-way clustering (Cameron-Gelbach-Miller) computes variance estimates clustered by date, by firm, and by their intersection, combining them so the standard error is robust to both forms of dependence simultaneously. On a large panel, moving from OLS to properly two-way-clustered errors routinely cuts a t-stat of 8 down to something much closer to 2-3, the same kind of fake-precision story as the overlapping-returns Newey-West card, just in two dimensions instead of one.`,
    python: `import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

rng = np.random.default_rng(0)
n_dates, n_tickers = 500, 200
dates = np.repeat(np.arange(n_dates), n_tickers)
tickers = np.tile(np.arange(n_tickers), n_dates)

# construct returns with BOTH a shared date-level shock and a firm-level
# persistent shock, so both clustering dimensions genuinely matter
date_shock = rng.normal(0, 0.01, n_dates)[dates]
firm_shock = rng.normal(0, 0.005, n_tickers)[tickers]
sig = rng.normal(0, 1, n_dates * n_tickers)
fwd_ret = 0.001 * sig + date_shock + firm_shock + rng.normal(0, 0.005, n_dates * n_tickers)

panel = pd.DataFrame({"date": dates, "ticker": tickers, "sig": sig, "fwd_ret": fwd_ret})

model = smf.ols("fwd_ret ~ sig", data=panel).fit()
print("naive OLS t-stat:", round(model.tvalues["sig"], 2))             # inflated

by_date = model.get_robustcov_results(cov_type="cluster", groups=panel["date"])
print("clustered by date only t-stat:", round(by_date.tvalues[1], 2))  # better, still one-sided

two_way = smf.ols("fwd_ret ~ sig", data=panel).fit(
    cov_type="cluster", cov_kwds={"groups": [panel["date"], panel["ticker"]]}
)
print("two-way clustered t-stat:", round(two_way.tvalues["sig"], 2))   # the honest number`,
    trap: `Clustering by firm only because "that's what corporate finance panels always use", without checking whether the specific regression also has strong date-level co-movement. Firm-only clustering is the right default for many corporate-finance panels where the treatment varies mainly across firms and time; a return-prediction panel where every stock reacts to the same daily market shock has the OTHER dimension's correlation dominate instead, and firm-only clustering leaves that fully uncorrected.`,
    followUp: `Your panel spans 3000 stocks but only within 11 sectors, and firm-level shocks are actually mostly SECTOR-level shocks in disguise. Does clustering by ticker still capture that correctly, or should the clustering dimension itself change? (Clustering by ticker treats each firm's shock as independent of every other firm's, so it will still understate the true correlation if the real dependence is at the coarser sector level -- the fix is to cluster by sector instead of by individual ticker, since clustered standard errors are only valid when the assumed cluster boundaries actually contain the true correlated blocks, not finer or coarser than that.)`,
  },
  {
    id: "qr-stats-20260822-autocorr-adjusted-sharpe",
    module: "stats",
    title: "Serial correlation inflates the naive Sharpe ratio",
    difficulty: "hard",
    question: `Two strategies both show a daily Sharpe of 0.12, about 1.9 annualized via the standard sqrt(252) scaling. Strategy A's daily returns are close to independent day to day; Strategy B's returns have first-order autocorrelation of about 0.3, typical of a slow-turnover strategy holding positions for several days at a time. Should you trust the same annualized Sharpe for both?`,
    thinking: `The sqrt(252) annualization rule assumes daily returns are i.i.d., and that assumption is baked directly into the variance-scaling step: annualized variance equals 252 times daily variance only when the covariance between different days is zero. With positive autocorrelation at lag 1 and beyond, those cross-day covariance terms are real and positive, so the true annualized variance is larger than the naive 252x scaling gives -- and since Sharpe divides by the square root of variance, a naive Sharpe built on a too-small variance is systematically too high. The standard correction (from Lo, 2002) scales the naive annualized Sharpe down by a factor built from the autocorrelations at each lag; for rho around 0.2-0.4 at typical holding-period frequencies the haircut can be 15-25% or more. Practically, positive serial correlation this large is disproportionately common in exactly the strategies people are tempted to brag about, since it often comes from slow-turnover or illiquid positions that don't fully reprice every day, smoothing the return series and flattering the naive number.`,
    answer: `No. sqrt(252) annualization assumes i.i.d. daily returns, which makes cross-day covariance vanish from the variance formula; Strategy B's positive autocorrelation means those covariance terms are real, so its true annualized variance is understated and its naive Sharpe is overstated. With rho around 0.3, an autocorrelation-adjusted Sharpe can come in 15-25% lower -- Strategy B's headline 1.9 is not comparable to Strategy A's until both go through the same adjustment.`,
    python: `import pandas as pd
import numpy as np

rng = np.random.default_rng(0)
n = 2000

# strategy A: close to i.i.d. daily returns
ret_a = pd.Series(rng.normal(0.0006, 0.01, n))

# strategy B: same mean/vol but with AR(1) serial correlation ~0.3,
# e.g. from a slow-turnover strategy whose marks don't fully update daily
ret_b = pd.Series(index=range(n), dtype=float)
ret_b.iloc[0] = ret_a.iloc[0]
rho = 0.3
for i in range(1, n):
    ret_b.iloc[i] = rho * ret_b.iloc[i - 1] + np.sqrt(1 - rho**2) * ret_a.iloc[i]

def naive_annualized_sharpe(r: pd.Series) -> float:
    return r.mean() / r.std() * np.sqrt(252)

def lo_adjusted_sharpe(r: pd.Series, max_lag: int = 5) -> float:
    naive = naive_annualized_sharpe(r)
    # Lo's correction: shrink by a factor built from lag autocorrelations,
    # each weighted by how much of the year that lag still represents
    acf = [r.autocorr(lag=k) for k in range(1, max_lag + 1)]
    correction = 1 + 2 * sum((1 - k / 252) * rho_k for k, rho_k in enumerate(acf, start=1))
    return naive / np.sqrt(correction)

print("A naive:", round(naive_annualized_sharpe(ret_a), 2),
      "A adjusted:", round(lo_adjusted_sharpe(ret_a), 2))
print("B naive:", round(naive_annualized_sharpe(ret_b), 2),
      "B adjusted:", round(lo_adjusted_sharpe(ret_b), 2))
# B's adjustment shrinks its Sharpe far more than A's -- same naive number,
# different true risk-adjusted performance`,
    trap: `Treating a smooth, low-volatility-looking daily return series as evidence of a genuinely good strategy without checking its autocorrelation. Serial correlation is often a symptom of stale or lagged marking -- illiquid positions not fully repricing every day -- rather than real low risk, and it inflates the exact Sharpe number used to rank and compare strategies.`,
  },
  {
    id: "qr-stats-20260823-vif-multicollinearity",
    module: "stats",
    title: "Multicollinearity in a multi-factor regression: VIF and unstable coefficients",
    difficulty: "core",
    question: `You run a weekly cross-sectional regression of stock returns on five factors, including value and quality, which have a correlation of about 0.85 with each other. The value and quality coefficients flip sign from week to week and carry huge standard errors, even though the regression's overall R-squared is stable. What's happening, and how would you diagnose and address it?`,
    thinking: `Two highly correlated regressors give the optimizer many nearly-equally-good ways to split credit between them -- a bit more weight on value and a bit less on quality fits the data almost as well as the reverse split, so the individual coefficient estimates become highly sensitive to sample noise even though the COMBINED fit barely changes, which is exactly why R-squared stays stable while the individual coefficients don't. This is multicollinearity, and it inflates the VARIANCE of individual coefficient estimates without necessarily hurting the overall or joint predictive fit. Diagnose it with the variance inflation factor: regress each factor on all the OTHER factors, take that regression's R-squared, and VIF equals 1 over (1 minus that R-squared) -- a VIF above roughly 5 to 10 flags a factor whose own coefficient estimate is unreliable in isolation. Fixes: combine the correlated factors into one composite instead of keeping both, orthogonalize one against the other before regressing, or accept the instability and read the regression's JOINT contribution of the correlated block rather than trusting either individual coefficient -- but don't drop an economically meaningful factor purely because it's collinear if the combined prediction is what actually matters for the strategy.`,
    answer: `Multicollinearity: value and quality being correlated at 0.85 means many different splits of coefficient weight between them fit almost equally well, so each individual coefficient estimate is highly sensitive to sample noise even though the combined fit (R-squared) barely moves. Diagnose with variance inflation factor -- regress each factor on the others and take 1 over (1 minus that R-squared); above roughly 5-10 flags instability. Fix by combining the correlated factors into one composite, orthogonalizing one against the other, or trusting only their joint contribution rather than either individual coefficient -- don't drop a meaningful factor just for being collinear if joint prediction is what matters.`,
    python: `import pandas as pd
import numpy as np

rng = np.random.default_rng(0)
n = 500
value = rng.normal(0, 1, n)
quality = 0.85 * value + np.sqrt(1 - 0.85**2) * rng.normal(0, 1, n)   # corr ~0.85 with value
momentum = rng.normal(0, 1, n)   # uncorrelated control factor
X = pd.DataFrame({"value": value, "quality": quality, "momentum": momentum})
true_beta = np.array([0.02, 0.02, 0.01])
y = X.values @ true_beta + rng.normal(0, 0.05, n)

def vif(X: pd.DataFrame) -> pd.Series:
    out = {}
    for col in X.columns:
        y_col = X[col].values
        others = np.column_stack([np.ones(len(X)), X.drop(columns=col).values])
        coef, *_ = np.linalg.lstsq(others, y_col, rcond=None)   # regress col on the rest
        ss_res = ((y_col - others @ coef) ** 2).sum()
        ss_tot = ((y_col - y_col.mean()) ** 2).sum()
        r2 = 1 - ss_res / ss_tot
        out[col] = 1 / (1 - r2)
    return pd.Series(out)

print(vif(X).round(1))   # value and quality both sit well above momentum's ~1.0

# fit two bootstrap resamples to see the coefficient instability directly
from numpy.linalg import lstsq
for seed in (1, 2):
    idx = np.random.default_rng(seed).choice(n, n, replace=True)
    beta_hat, *_ = lstsq(X.values[idx], y[idx], rcond=None)
    print("resample", seed, "value/quality coefs:", np.round(beta_hat[:2], 3))`,
    trap: `Concluding a factor "doesn't matter" because its individual coefficient is small, unstable, or wrong-signed in a collinear regression, and dropping it from the model. The instability is a property of the shared, overlapping information between two correlated factors, not evidence either one lacks real predictive content on its own -- the fix is addressing the collinearity, not deleting a factor that the joint fit still relies on.`,
  },
  {
    id: "qr-stats-20260824-deflated-sharpe-ratio",
    module: "stats",
    title: "Deflated Sharpe Ratio: correcting for both trials and non-normal returns",
    difficulty: "hard",
    question: `You've backtested 200 variants of a signal, and the best one shows an in-sample Sharpe of 1.8. The Probabilistic Sharpe Ratio test for that one signal, done in isolation, doesn't know you tried 199 others first. What does the Deflated Sharpe Ratio add on top of PSR, and how would you actually compute it?`,
    thinking: `Start with what PSR already gives you: it tests an observed Sharpe against a benchmark (usually zero) while correcting for sample length and for the return distribution's skew and kurtosis, since Sharpe's own sampling distribution isn't normal once returns aren't. That's real, but it treats your one signal as if it were the only thing you ever tried. DSR keeps the PSR machinery but replaces the benchmark with an estimate of the Sharpe you'd expect to see BY CHANCE ALONE as the maximum of N noise trials, using extreme value theory -- the expected maximum of N draws grows roughly like the square root of 2 times the log of N, in Sharpe units, further adjusted by the variance of the Sharpe estimator itself. Then you ask whether your observed best clears that elevated, N-dependent bar instead of clearing zero. The part that actually requires judgment: N should be the EFFECTIVE number of independent trials, not the raw count, because 200 small tweaks of one core idea are far more correlated with each other than 200 genuinely different signals, and you estimate that effective count from the trials' pairwise return correlations, not by just counting how many backtests you ran.`,
    answer: `DSR keeps PSR's correction for sample length and for skew and kurtosis widening or narrowing Sharpe's sampling distribution, but replaces the null benchmark of zero with the expected maximum Sharpe you'd see purely by chance across N independent trials, estimated via extreme value theory (it scales roughly with the square root of the log of N). You then test your observed best Sharpe against that elevated bar. The detail that matters in practice: N must be the EFFECTIVE number of independent trials, estimated from the trials' pairwise correlations, not the raw count of backtests run -- 200 near-duplicate tweaks of one idea have a much smaller effective N than 200 genuinely distinct signals.`,
    python: `import numpy as np
from scipy.stats import norm

def expected_max_sharpe_under_null(n_effective: float, n_obs: int) -> float:
    # extreme-value approximation: expected max of N standard-normal draws,
    # converted into Sharpe units by the per-observation Sharpe std error (~1/sqrt(n_obs))
    euler_mascheroni = 0.5772
    expected_max_z = (
        (1 - euler_mascheroni) * norm.ppf(1 - 1 / n_effective)
        + euler_mascheroni * norm.ppf(1 - 1 / (n_effective * np.e))
    )
    return expected_max_z / np.sqrt(n_obs)

def effective_n_trials(trial_returns: np.ndarray) -> float:
    # trial_returns: (n_trials, n_obs) matrix of each variant's daily returns.
    # highly correlated trials count as far less than n_trials independent shots.
    corr = np.corrcoef(trial_returns)
    avg_corr = (corr.sum() - len(corr)) / (len(corr) ** 2 - len(corr))
    return len(corr) / (1 + (len(corr) - 1) * avg_corr)   # effective independent count`,
    trap: `Setting N to only the final handful of candidates that made it into the report, forgetting every exploratory variant that was tried and discarded along the way. That silently understates N, understates the elevated benchmark, and makes the Deflated Sharpe Ratio look far more convincing than the actual search process justifies -- the real trap is under-counting trials, not over-counting them.`,
    followUp: `A colleague argues that since your 200 variants are correlated, you should just report the single best Sharpe and note "results are similar across variants" instead of running DSR at all. Why does that framing not actually solve the multiple-testing problem?`,
  },
  {
    id: "qr-stats-20260825-chow-test-ic-break",
    module: "stats",
    title: "Testing for a structural break in a signal's IC over time",
    difficulty: "hard",
    question: `A signal's rolling IC looks strong for the first three years of your sample and noticeably weaker for the last two. Eyeballing a rolling-IC chart is suggestive but not a test. How would you formally test whether the signal's relationship to forward returns actually changed at some point, versus this just being noise around one stable relationship?`,
    thinking: `Frame this as a regression-stability question rather than a pure time-series one: fit forward return on the signal and ask whether the FIT is different before and after a candidate break date, not just whether the two windows' realized ICs happen to differ. A Chow test does exactly that -- fit the regression once on the full sample, once separately on each of the two sub-samples split at the candidate date, and compare the sum of squared residuals: if splitting the regression barely improves the fit versus fitting one relationship across everything, an F-statistic built from the residual sums stays small and you can't reject "one stable relationship the whole time." If splitting improves the fit a lot, the F-statistic gets large and rejects the null of stability. The Chow test needs the break date specified in advance, which is a real weakness -- if you instead scanned many candidate dates and picked the one that looks most broken, you're back in multiple-testing territory and need to correct the test's critical value, or use a proper structural-break search like CUSUM or Bai-Perron that's built to search over candidate breakpoints honestly.`,
    answer: `Use a Chow test: fit one regression of forward return on signal across the full sample, fit two separate regressions on each side of a candidate break date, and compare residual sum of squares via an F-statistic -- a large F rejects the null that one stable relationship explains both periods. The key caveat is that the break date must be chosen in advance of looking at the data, ideally from an economic or structural reason (a regime change, a data-vendor switch, a known market event); scanning many candidate dates and picking the worst-looking one reintroduces a multiple-testing problem and needs either a corrected critical value or a dedicated breakpoint-search method like CUSUM or Bai-Perron instead of a single ad hoc Chow test.`,
    python: `import numpy as np
from scipy import stats

def chow_test(signal: np.ndarray, fwd_ret: np.ndarray, break_idx: int) -> float:
    def ssr(x, y):
        # residual sum of squares from OLS of y on x (with intercept)
        X = np.column_stack([np.ones(len(x)), x])
        beta, _, _, _ = np.linalg.lstsq(X, y, rcond=None)
        resid = y - X @ beta
        return float(resid @ resid)

    ssr_pooled = ssr(signal, fwd_ret)
    ssr_1 = ssr(signal[:break_idx], fwd_ret[:break_idx])
    ssr_2 = ssr(signal[break_idx:], fwd_ret[break_idx:])
    k = 2   # params per regression: intercept + slope
    n = len(signal)

    numerator = (ssr_pooled - (ssr_1 + ssr_2)) / k
    denominator = (ssr_1 + ssr_2) / (n - 2 * k)
    f_stat = numerator / denominator
    p_value = 1 - stats.f.cdf(f_stat, k, n - 2 * k)
    return f_stat, p_value

rng = np.random.default_rng(0)
n = 1000
sig = rng.normal(0, 1, n)
# true relationship weakens after the midpoint -- a genuine structural break
true_beta = np.where(np.arange(n) < 500, 0.05, 0.01)
fwd = true_beta * sig + rng.normal(0, 1, n)

f_stat, p_value = chow_test(sig, fwd, break_idx=500)
print(round(f_stat, 2), round(p_value, 4))   # large F, small p -- break confirmed`,
    trap: `Running the Chow test at the date that "looks" like the break from eyeballing the rolling-IC chart, then treating the resulting p-value as if the break date were specified independently of the data. Choosing the break point from the same data you're testing on invalidates the test's stated significance level exactly the way picking the best of many backtested variants does.`,
  },
  {
    id: "qr-stats-20260826-fisher-z-ic-vs-benchmark",
    module: "stats",
    title: "Fisher z-transformation: testing whether an IC is significantly different from a benchmark, not just from zero",
    difficulty: "core",
    question: `Your new signal has an average IC of 0.04 over 500 days. Your existing production signal has an IC of 0.03 over the same period. You want to know if the new signal's IC is statistically distinguishable from the OLD signal's IC -- not just whether either is different from zero. How do you test that?`,
    thinking: `A correlation coefficient's sampling distribution is skewed and bounded in [-1, 1], so you can't just difference two ICs and run a normal test on the raw numbers. The Fisher z-transformation z = arctanh(IC) maps a bounded correlation onto something approximately normal with known variance ~1/(n-3), which turns "are these two correlations different" into an ordinary two-sample normal-difference problem in z-space. The detail worth catching here: both IC series are measured over the identical 500 days, so they're paired, not independent, samples -- the textbook independent-sample variance formula ignores the covariance between the two z-transformed series, and since two signals driven by the same market days are usually positively correlated, ignoring that covariance OVERSTATES the standard error of the difference, making the test too conservative rather than too lenient.`,
    answer: `Fisher z-transform each IC (z = arctanh(IC)) so both land on an approximately normal scale with variance ~1/(n-3), then test the difference of the two z's against zero using a normal test. Because both signals' daily ICs are measured over the identical 500 days, they're a paired, not independent, sample -- the correct variance of the difference subtracts a covariance term, and since same-period signals are usually positively correlated, using the naive independent-sample formula (which drops that term) overstates the standard error and makes the test too conservative, not too lenient.`,
    python: `import numpy as np
from scipy import stats

def fisher_z_diff_test(ic_1: float, n_1: int, ic_2: float, n_2: int) -> tuple[float, float]:
    # arctanh maps a bounded, skewed correlation onto an approx-normal scale
    z1, z2 = np.arctanh(ic_1), np.arctanh(ic_2)
    # textbook two-INDEPENDENT-sample variance -- valid when the two IC
    # series come from unrelated periods/universes, not the same dates
    se = np.sqrt(1 / (n_1 - 3) + 1 / (n_2 - 3))
    z_stat = (z1 - z2) / se
    p_value = 2 * (1 - stats.norm.cdf(abs(z_stat)))
    return z_stat, p_value

z_stat, p_value = fisher_z_diff_test(ic_1=0.04, n_1=500, ic_2=0.03, n_2=500)
print(round(z_stat, 3), round(p_value, 4))
# with n=500 this difference (0.04 vs 0.03) is nowhere near significant --
# and that's BEFORE even applying the paired correction, which would only
# shrink the standard error further if the two signals are correlated`,
    trap: `Plugging the two ICs straight into the textbook independent-sample Fisher z-test when they were measured over the exact same 500 trading days -- that's a paired comparison, not an independent one, since both signals share the same market-wide noise. The independent-sample formula ignores the covariance between the two z-transformed series, which for positively correlated same-period signals overstates the true standard error and makes a real difference look less significant than it is.`,
    followUp: `Suppose the two signals are actually strongly negatively correlated day-to-day (one is a contrarian version of the other). Does that push the paired correction's standard error up or down relative to the naive independent formula, and why?`,
  },
  {
    id: "qr-stats-20260827-granger-causality-skepticism",
    module: "stats",
    title: "Granger causality for a lead-lag signal claim -- why quants are wary",
    difficulty: "hard",
    question: `A researcher claims stock A's returns "Granger-cause" stock B's returns based on a Granger causality test with a significant p-value, and wants to build a signal trading B off A's lagged returns. Should that p-value convince you the lead-lag relationship is real and tradeable? What would you check first?`,
    thinking: `Recall what the test actually establishes versus what its name suggests. Granger causality tests only whether past values of A improve a linear forecast of B beyond what B's own past values already provide -- a statement about predictive contribution within a specific linear model, not a statement about causation in any physical or economic sense, despite the name. A significant result is also exactly what you'd expect under several boring, non-tradeable explanations: A and B could both be driven by a shared common factor (sector beta, a macro variable) with A's data simply updating or reporting first for a purely mechanical reason (different close times, different vendor lag) rather than A's price genuinely containing information about B's future price. Multiple testing is the other trap -- if this was one of many lead-lag pairs screened overnight, some fraction of the "significant" results are pure noise by construction, same as any signal search. Before trusting it as tradeable, check whether the relationship survives out-of-sample, whether it holds after controlling for a shared factor both names load on, whether the reported timestamps genuinely reflect information timing rather than a vendor artifact, and whether the effect size clears realistic transaction costs -- statistical significance alone answers none of those.`,
    answer: `A significant Granger test only shows that A's lagged values improve a linear forecast of B beyond B's own history within that specific model -- it says nothing about true causation and is equally consistent with a shared common factor, a data-timing artifact (A's feed simply updates first), or one false positive among many pairs screened overnight. Before trusting it as tradeable, check out-of-sample stability, whether the effect survives controlling for shared factor exposure, whether the lead-lag timing reflects genuine information asymmetry rather than vendor reporting lag, and whether the effect size clears realistic transaction costs.`,
    trap: `Treating "Granger-causes" as evidence of an exploitable informational edge just because the word "causes" is in the test's name. The test is a narrow statement about incremental linear forecast power in-sample; it doesn't rule out a shared driver, doesn't test economic significance, and doesn't survive scrutiny for multiple-pair screening the way a single reported p-value implies.`,
    followUp: `You control for a plausible shared factor (both A and B load heavily on the same sector index) and the Granger relationship weakens substantially but doesn't fully disappear. Does that residual relationship make you more or less confident it's real and tradeable, and why?`,
  },
  {
    id: "qr-stats-20260828-permutation-test-ic",
    module: "stats",
    title: "Permutation test for a signal's IC significance, as an alternative to Newey-West",
    difficulty: "hard",
    question: `You've computed a signal's average IC (information coefficient -- the rank correlation between the signal's cross-section and next-period returns) over 5 years of monthly rebalances, and it's 0.03, positive. Instead of relying on a Newey-West-adjusted t-stat, your interviewer asks you to test significance with a permutation test. Walk through it.`,
    thinking: `Under the null hypothesis that the signal has no real relationship to forward returns, the specific pairing between a given month's signal cross-section and that same month's forward-return cross-section is arbitrary -- so you can build the null distribution directly by randomly shuffling which month's RETURN vector gets paired with which month's SIGNAL cross-section, recomputing the average IC each time, and repeating thousands of times to get an empirical null distribution. Your p-value is the fraction of shuffled ICs at least as large as the real 0.03. The critical detail is shuffling at the MONTH level, not the individual asset-date level -- shuffling individual rows would destroy the within-month cross-sectional structure the IC actually measures and manufacture an artificially tight, wrong null that makes almost anything look significant. The payoff over Newey-West is not needing any parametric assumption about the return distribution or trusting that the autocorrelation-correction formula is well-specified for your data; the cost is needing enough independent months for the null to be stable, and needing block permutations instead of fully independent ones if the months themselves are serially correlated.`,
    answer: `Under the null of no relationship, the pairing between a given month's signal cross-section and that month's forward returns is arbitrary, so shuffle which month's return vector goes with which month's signal cross-section -- never individual asset-date pairs, which would destroy the within-month cross-sectional structure the IC measures -- recompute the average IC each time to build an empirical null distribution, and take the p-value as the fraction of shuffled ICs at least as large as the observed 0.03. It sidesteps any parametric assumption Newey-West needs, at the cost of needing enough independent months for a stable null, and block permutations instead of independent ones if the months themselves are serially correlated.`,
    python: `import numpy as np
import pandas as pd

rng = np.random.default_rng(0)
n_months, n_names = 60, 200

# signal cross-section and forward returns, indexed by (month, name)
signal = pd.DataFrame(rng.normal(size=(n_months, n_names)))
returns = 0.02 * signal + pd.DataFrame(rng.normal(size=(n_months, n_names)))  # real but noisy edge

def mean_ic(sig: pd.DataFrame, ret: pd.DataFrame) -> float:
    # rank correlation per month, averaged across months
    return sig.corrwith(ret, axis=1, method="spearman").mean()

observed_ic = mean_ic(signal, returns)

n_perms = 2000
null_ics = np.empty(n_perms)
for i in range(n_perms):
    # shuffle WHOLE MONTHS of returns relative to signal -- preserves each
    # month's own cross-sectional structure, breaks only the true pairing
    shuffled_returns = returns.sample(frac=1.0, random_state=i).reset_index(drop=True)
    null_ics[i] = mean_ic(signal, shuffled_returns)

p_value = (null_ics >= observed_ic).mean()
print(f"observed IC: {observed_ic:.4f}, permutation p-value: {p_value:.4f}")`,
    trap: `Shuffling at the individual (asset, date) row level instead of by whole date-blocks. That destroys the genuine cross-sectional structure -- the relative ranking of names within a single month -- and manufactures an artificially tight, wrong null distribution that makes almost any observed IC look significant.`,
    followUp: `Your monthly ICs show visible positive autocorrelation -- this month's IC predicts some of next month's. Does a simple independent-month permutation test still give you a valid p-value, and if not, what do you change about the shuffling procedure?`,
  },
];
