import type { QRQuestion } from "./index";

// ============================================================
// Module 3 -- Cleaning & Corporate Actions
// split/dividend adjustment, total-return series, outlier
// detection (MAD vs stdev, winsorize vs clip vs drop), stale
// prices, survivorship bias, missing-data policy, bad ticks.
// 13 questions: 3 warmup, 7 core, 3 hard.
// ============================================================

export const cleaningQuestions: QRQuestion[] = [
  {
    id: "qr-cleaning-01-split-minus-fifty",
    module: "cleaning",
    title: "The -50% that never happened",
    difficulty: "warmup",
    question: `Your raw price file shows a stock closing at 500 on Tuesday and 250 on Wednesday, and your return series prints -50% -- but the news shows nothing happened to the company. What is going on, and what is the fix?`,
    thinking: `Before assuming a data error, ask what corporate event halves a price overnight while leaving shareholders indifferent: a 2-for-1 stock split. Every holder now owns twice the shares at half the price -- economic value unchanged, so the true return is roughly zero, but raw prices mechanically drop 50%. First lesson of price data: raw prices measure the price of one share, and what one share represents changes over time. If you compute returns from raw prices, every split in your universe injects a huge fake negative return (and reverse splits inject fake positive ones) -- large enough to dominate any statistic they touch. The fix is adjustment: scale prices before the split's ex-date so the series is continuous, using the split ratio as an adjustment factor. Then generalize your suspicion: dividends cause the same problem in miniature -- the price drops by roughly the dividend on the ex-date, which is not a loss to the holder either.`,
    answer: `That is almost certainly a 2-for-1 stock split: shareholders got twice the shares at half the price, so economic return was about zero, but raw prices halved. Returns must be computed from split-adjusted prices -- multiply all prices before the ex-date by the split factor (0.5 here) so the series is continuous. The same logic extends to dividends, where the ex-date price drop is not a holder loss either; ignoring adjustments injects fake returns exactly as large as the corporate action.`,
    python: `import pandas as pd

# raw closes around a 2-for-1 split on 2024-06-12
px = pd.Series(
    [498.0, 500.0, 250.0, 252.0],
    index=pd.to_datetime(["2024-06-10", "2024-06-11",
                          "2024-06-12", "2024-06-13"]),
)

raw_ret = px.pct_change()
# 2024-06-12 shows -0.50 -- a phantom crash; the holder lost nothing

# adjustment factor: 0.5 applies to all dates BEFORE the ex-date,
# so history is scaled onto the post-split share basis
factor = pd.Series(1.0, index=px.index)
factor.loc[: "2024-06-11"] = 0.5          # everything strictly pre-ex-date

adj = px * factor                          # 249.0, 250.0, 250.0, 252.0
adj_ret = adj.pct_change()
# 2024-06-12 now shows 0.0% -- the economics, not the share-count artifact`,
    trap: `"Cleaning" the -50% as an outlier and deleting the row. The move is real data about a real event -- the error is in the units, not the observation. Dropping it desynchronizes the series and leaves every earlier price on the wrong share basis anyway.`,
    followUp: `Why scale the prices before the ex-date rather than after -- what property of today's price do you want to preserve, and what does that choice do to historical price levels?`,
  },
  {
    id: "qr-cleaning-02-survivorship-bias",
    module: "cleaning",
    title: "Survivorship bias",
    difficulty: "warmup",
    question: `A backtest buys the cheapest decile of today's S&P 500 constituents, rebalanced monthly since 2005, and shows a spectacular Sharpe. Before reading a line of code, why are you skeptical?`,
    thinking: `Interrogate the universe definition first, because it quietly conditions on the future: "today's constituents" are the firms that survived and thrived through the whole sample. Every company that went bankrupt, was delisted, or decayed out of the index is excluded from history -- and a cheap-stock strategy is precisely the one that loads up on distressed names, the population where the casualties lived. So the backtest buys 2008's cheap financials but only the ones we now know made it; Lehman never enters the sample. The bias is not a small correction: for value-type strategies on equities it can fabricate several percent a year. Frame it probabilistically: you are estimating expected returns conditional on survival, then deploying capital unconditionally. The fix is a point-in-time universe -- the index membership as it stood on each historical rebalance date -- plus delisted securities kept in the dataset with their delisting returns, so failures cost the backtest what they cost real investors.`,
    answer: `The universe is defined by hindsight: today's members are, by construction, the survivors. Firms that went bankrupt or were delisted -- the very names a cheapest-decile strategy would have bought -- are missing from history, so losses that real capital would have taken never hit the backtest. This survivorship bias alone can add several percent a year to value strategies. I would require a point-in-time membership file and delisting returns included; until then the Sharpe is an artifact, not an anomaly.`,
    trap: `Believing that a "large, liquid" universe is immune. Even blue chips die -- Lehman, Enron, Worldcom were all index members -- and screening on today's tradability (current listing, current market cap) sneaks the same conditioning-on-survival in through the side door.`,
    followUp: `You obtain point-in-time membership but your price vendor has no data after each delisting announcement. What return do you assign to a position that gets delisted, and what does research say about assuming zero?`,
  },
  {
    id: "qr-cleaning-03-winsorize-clip-drop",
    module: "cleaning",
    title: "Winsorize, clip, or drop",
    difficulty: "warmup",
    question: `Your cross-sectional signal -- say earnings yield across 2,000 stocks -- has a handful of extreme values each day that dominate any regression you run. Compare winsorizing, clipping, and dropping. Which default do you pick and why?`,
    thinking: `First be precise, because people blur these. Winsorizing sets values beyond a chosen percentile equal to that percentile -- the 1st/99th, say -- so extremes are pulled to the boundary but the observations survive. Clipping caps values at fixed absolute thresholds; mechanically identical, but the fence is a constant you chose rather than a data-driven quantile. Dropping deletes the rows entirely. Now reason about what each does to information. Extreme earnings yields are often real (distressed firms with collapsed prices) -- the direction is informative even when the magnitude is unstable, so you want to keep the observation while limiting its leverage on your fit. Winsorizing does exactly that. Dropping discards the direction too and shrinks your cross-section, and worse, it changes which stocks are in the portfolio -- a selection effect. Fixed clips ignore that dispersion varies through time: a fence that binds nothing in 2017 truncates half the book in March 2020. Default: winsorize cross-sectionally per date at symmetric percentiles.`,
    answer: `Winsorizing pulls values beyond a percentile in to that percentile; clipping caps at fixed absolute levels; dropping removes the observations. Default: winsorize per date at something like the 1st and 99th percentiles -- extremes usually carry real directional information with unreliable magnitude, so you keep the stock but bound its leverage on the fit. Dropping loses information and induces selection effects; fixed clips ignore time-varying dispersion. Whatever you choose: same rule every day, decided before you see results.`,
    python: `import pandas as pd

# sig: wide DataFrame, rows = dates, columns = stocks (earnings yield)

# winsorize CROSS-SECTIONALLY: fences computed per DATE, not per stock,
# so each day's extreme names get pulled to that day's percentile
lo = sig.quantile(0.01, axis=1)          # per-date 1st percentile
hi = sig.quantile(0.99, axis=1)          # per-date 99th percentile
wins = sig.clip(lower=lo, upper=hi, axis=0)   # broadcast fences across rows

# fixed clipping for comparison: one fence for all of history
clipped = sig.clip(lower=-0.5, upper=0.5)
# binds never in quiet years, savagely in crises -- rarely what you want

# dropping, shown to make its cost visible
dropped = sig.where((sig.ge(lo, axis=0)) & (sig.le(hi, axis=0)))
n_lost = dropped.isna().sum(axis=1) - sig.isna().sum(axis=1)
# ~40 names deleted per day on a 2,000-stock universe -- and the
# deleted names are systematically the distressed ones (selection bias)`,
    trap: `Winsorizing over the whole panel at once -- pooled percentiles across all dates -- instead of within each date. Pooled fences bind almost exclusively in high-dispersion periods, so your "symmetric 1%" treatment actually rewrites entire crisis cross-sections while leaving calm years untouched.`,
    followUp: `Your signal goes into a rank-based portfolio construction anyway. Does winsorizing still change anything, and what does that tell you about where outlier treatment actually matters?`,
  },
  {
    id: "qr-cleaning-04-back-adjustment",
    module: "cleaning",
    title: "Back-adjusting a price series",
    difficulty: "core",
    question: `You have raw daily closes and a table of corporate-action adjustment factors, one per ex-date (0.5 for a 2:1 split, 0.98 for a 2% dividend, etc). Build the back-adjusted price series and explain the mechanics.`,
    thinking: `Fix the convention first: back-adjustment keeps today's price equal to the actual market quote and rescales history, so the series is continuous and current levels are real. That means each historical price must be multiplied by the product of all adjustment factors for ex-dates strictly after that price's date -- events between then and now. Two implementation subtleties decide correctness. Strictly after: the ex-date's own price is already on the new basis (the market gapped that morning), so the ex-date's factor applies only to earlier dates -- an off-by-one here shifts every return around every event. And the multiplicativity: factors compound, so a stock with a split and three dividends needs the running product, computed efficiently as a reversed cumulative product rather than a per-date loop. Sanity checks after building: adjusted return on each ex-date should equal the raw price move net of the action, and the latest adjusted price must equal the latest raw close exactly.`,
    answer: `Back-adjustment leaves the newest price untouched and multiplies each earlier price by the cumulative product of all factors with ex-dates after it. Implementation: align factors onto the price index with 1.0 as default, take a reversed cumulative product, shift by one so each date only absorbs strictly-later events, and multiply. Verify that the last adjusted price equals the last raw price and that ex-date returns become economically sensible. The off-by-one on the ex-date is where implementations usually break.`,
    python: `import pandas as pd

# px: raw close Series, dt index. events: factor per ex-date (e.g. 0.5, 0.98)
f = pd.Series(1.0, index=px.index)     # default: no event, factor 1
f.update(events)                       # place real factors on their ex-dates

# cumulative product of all factors from each date to the END of history
rev_cum = f.iloc[::-1].cumprod().iloc[::-1]
# rev_cum[t] = product of factors on all dates >= t

# each price should absorb only events strictly AFTER its date:
# the ex-date bar already trades on the new basis (market gapped at the open)
adj_mult = rev_cum.shift(-1).fillna(1.0)   # product over dates > t

adj = px * adj_mult

# --- invariants that catch the classic bugs ---
# 1) the present is untouched: latest adjusted == latest raw
assert adj.iloc[-1] == px.iloc[-1]
# 2) no phantom move on ex-dates: adjusted return there should be ordinary
ex_dates = events.index
check = adj.pct_change().loc[ex_dates]     # eyeball: no -50% style spikes`,
    trap: `Applying the ex-date's factor to the ex-date itself (shift omitted). Every price from the ex-date onward gets double-scaled relative to the day before, so each corporate action leaves a residual phantom return -- small for dividends, glaring for splits, and it corrupts exactly the event days people later study.`,
    followUp: `Yesterday's adjusted history changes every time a new dividend goes ex -- the whole past gets rescaled. What does that imply for cached features, stored backtest results, and anything keyed on adjusted price levels?`,
  },
  {
    id: "qr-cleaning-05-total-return",
    module: "cleaning",
    title: "Total-return series",
    difficulty: "core",
    question: `Your split-adjusted prices still ignore dividends, and a colleague's "performance" of a utilities portfolio looks weirdly poor over 20 years. Build a total-return series and explain what it fixes.`,
    thinking: `Separate the two things a shareholder earns: price appreciation and cash distributions. A split-adjusted price series captures only the first. On every ex-dividend date the price drops by roughly the dividend -- money that landed in the holder's pocket but looks like a loss in price-only returns. For high-yield sectors like utilities, that error compounds brutally: 4% a year of "missing" return over 20 years is more than a doubling of terminal wealth. The construction: the day's total return is price change plus dividend per share, both relative to the prior close -- then compound those daily total returns into an index that represents wealth with dividends reinvested. Ask the follow-on questions a practitioner must: reinvested at what price (convention: that day's close), are dividends timestamped by ex-date (the date the price drops -- the only date that makes returns line up), and is withholding tax relevant for the use case?`,
    answer: `Price returns miss dividends: every ex-date the price drops by the dividend, which is a transfer to the holder, not a loss. Total return for a day is (price change plus dividend per share) divided by the prior close; compounding those gives a total-return index -- wealth with dividends reinvested. For a utilities book yielding around 4%, price-only performance understates truth by roughly that much per year, compounded. Key detail: dividends must be aligned on ex-dates, since that is when the price adjusts.`,
    python: `import pandas as pd

# px: split-adjusted close. div: dividend per share, indexed by EX-DATE
# (ex-date alignment is what makes the drop and the cash cancel correctly)
d = div.reindex(px.index).fillna(0.0)      # zero on non-dividend days

# daily total return: capital move plus the cash that left the price
tr = (px + d) / px.shift(1) - 1

# compare with price-only return to see what was being lost
pr = px.pct_change()
gap = tr.sub(pr)          # nonzero exactly on ex-dates, roughly div yield

# total-return index: growth of 1 unit with dividends reinvested at close
tri = (1 + tr.fillna(0.0)).cumprod()

# 20-year illustration of why this matters for utilities:
# 4%/yr yield missed -> (1.04 ** 20) ~ 2.19x understatement of wealth
ann_gap = (1 + tr).prod() ** (252 / len(tr)) - (1 + pr).prod() ** (252 / len(pr))`,
    trap: `Aligning dividends on the payment date instead of the ex-date. The price drops on the ex-date; the cash arrives weeks later. Pay-date alignment leaves a fake loss on the ex-date and a fake windfall on the pay date -- daily statistics get two artifacts instead of none.`,
    followUp: `Vendors often ship an "adjusted close" that folds dividends into the price via ratio adjustment. When is using that equivalent to a true total-return index, and what does it silently assume about reinvestment?`,
  },
  {
    id: "qr-cleaning-06-mad-vs-stdev",
    module: "cleaning",
    title: "MAD vs standard deviation",
    difficulty: "core",
    question: `You flag outliers as observations more than 4 standard deviations from the mean. On the worst data days -- fat-finger prints, flash events -- the filter catches almost nothing. Why does it fail exactly when needed, and what is the robust alternative?`,
    thinking: `Spot the circularity: the standard deviation is computed from the same sample that contains the outliers, and the outliers dominate it -- variance is a mean of squared deviations, so one print 100x too large inflates the estimate quadratically. The filter's own yardstick stretches whenever a big outlier appears, which is why it fails precisely on the bad days: a monstrous error widens the fence enough to walk through it, and can even make legitimate points look extreme (masking and swamping). The cure is estimators whose value is insensitive to a fraction of arbitrarily bad data -- high breakdown point. The median tolerates up to half the data being garbage; the median absolute deviation (MAD) -- the median of absolute distances from the median -- is its scale counterpart. Multiply MAD by 1.4826 to make it comparable to a standard deviation under normality, then flag on robust z-scores. Same threshold, but the yardstick no longer bends.`,
    answer: `The stdev is estimated from the contaminated sample itself, and squaring makes it explode with the very outliers you want to catch -- the fence widens exactly when the bad prints arrive, so they pass. Robust alternative: center on the median and scale by MAD, the median absolute deviation from the median, times 1.4826 to match stdev under normality. Both have 50% breakdown points -- outliers barely move them -- so a robust z-score threshold keeps its meaning on the worst days.`,
    python: `import pandas as pd
import numpy as np

r = px.pct_change().dropna()

# --- classical z-score: the yardstick is contaminated ---
z = (r - r.mean()) / r.std()
# one 1000% fat-finger return inflates r.std() so much that the
# offending point can sit at "only" 3-4 z -- under a 4z fence

# --- robust z-score: median center, MAD scale ---
med = r.median()
mad = (r - med).abs().median()          # median distance from the median
scale = 1.4826 * mad                    # 1.4826: MAD -> stdev units if normal
rz = (r - med) / scale

flag = rz.abs() > 5                     # threshold keeps meaning under stress

# side-by-side on a poisoned sample shows the failure concretely
demo = pd.Series(np.r_[np.random.default_rng(0).normal(0, 0.01, 500), 10.0])
z_max = ((demo - demo.mean()) / demo.std()).iloc[-1]      # ~ 22, but fence moved
m = demo.median()
rz_max = ((demo - m) / (1.4826 * (demo - m).abs().median())).iloc[-1]
# robust z is in the hundreds -- unmissable`,
    trap: `Iterating the classical filter -- remove 4-sigma points, recompute, repeat -- as a fix. It can work but converges unpredictably and order-dependently on multi-outlier days (masking), while MAD gets it right in one pass. If you find yourself looping a z-score filter, you wanted a robust estimator.`,
    followUp: `Your asset's returns are genuinely fat-tailed -- a t-distribution with few degrees of freedom. Now a 5-robust-z day may be real. How do you separate distributional tail events from data errors, mechanically?`,
  },
  {
    id: "qr-cleaning-07-stale-price-detection",
    module: "cleaning",
    title: "Detecting stale prices",
    difficulty: "core",
    question: `Some series in your vendor's small-cap file show the identical close for days or weeks. How do you detect staleness systematically, and why is it more dangerous than missing data?`,
    thinking: `Define the enemy: a stale price is a value that stopped updating while pretending to be fresh -- a frozen feed, an untraded illiquid name carrying yesterday's close forward, or an upstream ffill someone applied before you. It is worse than a NaN because a NaN announces itself, while a stale price fabricates plausible data: zero returns that deflate volatility, damp correlations, and make an illiquid name look like the safest asset in the book. Detection is run-length analysis: find maximal runs of exactly repeated closes and flag runs exceeding a threshold. Choose the threshold with base rates in mind -- for a liquid stock, even two identical consecutive closes to the penny is uncommon; five in a row is essentially impossible organically, while thinly traded small caps repeat legitimately. So condition the threshold on liquidity, and cross-check with volume: repeated price with nonzero volume can be genuine; repeated price with zero volume is a non-observation wearing makeup. Policy: mask stale runs to NaN, then apply your missing-data rules.`,
    answer: `Compute run lengths of exactly repeated closes and flag runs beyond a liquidity-dependent threshold -- a liquid name repeating five closes to the penny is effectively impossible organically, while small caps repeat legitimately, so cross-check volume: repeats on zero volume are non-observations in disguise. Staleness is worse than missingness because it fabricates zero returns that shrink volatility and correlations instead of honestly reporting absence. Policy: convert detected stale runs to NaN and handle them under the missing-data rules.`,
    python: `import pandas as pd

# run-length encoding of repeated closes, fully vectorized:
# a new run starts wherever the close CHANGES vs the prior day
new_run = px.ne(px.shift())
run_id = new_run.cumsum()                    # same id = same repeated value
run_len = px.groupby(run_id).transform("size")

# liquidity-aware threshold: tight for liquid names, loose for small caps
liquid = volume.rolling(60).median() > 100_000
limit = liquid.map({True: 3, False: 10})

stale = run_len > limit

# volume cross-check: repeated price + zero volume = no real observation
stale_hard = stale & volume.eq(0)

# policy: stale prints become explicit missing data, not silent zeros
px_clean = px.mask(stale_hard)
r = px_clean.pct_change()      # no fabricated 0% returns from frozen prints

# monitoring: staleness share per name -- a rising share flags a dying feed
stale_share = stale_hard.groupby(px.index.year).mean()`,
    trap: `Screening for staleness with returns == 0 after the pipeline has already forward-filled -- at that point genuine holidays, legitimate flat days, and fills are indistinguishable. Staleness detection must run on the rawest prices available, before any fill touches them.`,
    followUp: `A stale-priced small cap shows annualized volatility of 8% while its peers show 45%. Your risk model loves it and sizes it up 5x. Walk me through the chain from the frozen feed to the oversized position.`,
  },
  {
    id: "qr-cleaning-08-ffill-right-vs-deadly",
    module: "cleaning",
    title: "When forward-fill is right vs deadly",
    difficulty: "core",
    question: `Give me the cases where forward-filling financial data is correct, the cases where it is catastrophic, and the underlying principle that separates them.`,
    thinking: `Look for the principle rather than a list: forward-fill is legitimate exactly when the quantity is a state -- something that persists until an event changes it -- and deadly when the quantity is a flow or an innovation, something that exists only in its own period. A stock's last traded price is a state: between trades, the best estimate of the price is the last print, so short-horizon ffill of prices is honest (with a limit, and not across delistings). Shares outstanding, index membership, latest reported book value: states -- ffill is not merely acceptable, it is the point-in-time-correct representation of what was known. Returns are the canonical flow: yesterday's +2% happened yesterday; filling it forward asserts the stock repeated the gain on a day nothing was observed -- fabricated P&L. Volume is a flow (fill with 0 if anything, meaning "no trades", and only if that is true). Signals built on differences inherit flow-ness. Corollary: fill inputs upstream (prices), then recompute flows -- never fill the flows.`,
    answer: `Correct: state variables that persist until an event changes them -- last price over short gaps with a limit, shares outstanding, index membership, latest reported fundamentals. Forward-filling states is exactly what point-in-time correctness means. Catastrophic: flows and innovations -- returns, volume, P&L -- where filling forward fabricates events that never occurred; a filled return is invented profit. Principle: ffill states, never flows; when a flow has gaps, fill the underlying state and recompute the flow from it.`,
    python: `import pandas as pd

# --- RIGHT: prices are states; bridge short gaps, cap the claim ---
px_f = px.reindex(master).ffill(limit=3)      # holidays, brief halts

# --- RIGHT: fundamentals are states between reports ---
# quarterly book value known from its release date onward:
bv_daily = book_value.reindex(master).ffill() # this IS point-in-time truth

# --- DEADLY: returns are flows ---
r = px.pct_change()
r_bad = r.reindex(master).ffill()
# every gap now repeats the last day's return as if it recurred:
# a +3% day before a 4-day halt becomes five +3% days -- invented P&L

# the correct route for gapped returns: fill the STATE, recompute the flow
r_ok = px.reindex(master).ffill(limit=3).pct_change()
# filled price days now yield 0% (price unchanged) -- economically honest
# for a held position, and NaN beyond the limit

# --- DEADLY in disguise: volume ---
vol_bad = volume.reindex(master).ffill()      # copies real trading volume
vol_ok = volume.reindex(master)               # leave NaN, or fillna(0) only
                                              # where "no session" is the truth`,
    trap: `Forward-filling a returns matrix directly because "that is what we do with prices". Prices and returns sit on opposite sides of the state/flow line: a filled price implies a zero return (defensible); a filled return implies the move happened twice (fabrication). Many real pipelines have shipped this bug.`,
    followUp: `Your fundamentals table is keyed by fiscal quarter-end, but the numbers only became public 45 days later. What does the ffill-from-quarter-end version leak, and what should the fill actually start from?`,
  },
  {
    id: "qr-cleaning-09-bad-tick-filter",
    module: "cleaning",
    title: "Filtering bad ticks",
    difficulty: "core",
    question: `In intraday trade data you occasionally see a print far off the market -- say 50% away for one observation -- after which prices continue as before. Design a bad-tick filter and tell me how you avoid deleting real jumps.`,
    thinking: `Characterize the signature before designing the filter: a bad tick is off-market and unconfirmed -- the price departs and immediately comes back, because the next trades ignore it. A real jump (news, halt reopen) departs and stays. That suggests the jump-and-revert test: flag prints whose return is extreme relative to local volatility and whose subsequent return roughly cancels it. Use robust local scale (a rolling median absolute deviation, not rolling stdev, or the outlier corrupts its own threshold), and make the fence adaptive -- 50 basis points is an outrage in a mega-cap and noise in a micro-cap. Validate against confirming evidence where available: size of the print, whether the trade carried an off-exchange or late condition code, and whether quotes moved with it. Then be honest about the irreducible tradeoff: any filter aggressive enough to catch every error will occasionally eat a genuine flash move -- so log everything removed, keep raw data immutable, and treat the filter as a view, not a correction of the source.`,
    answer: `Exploit the signature: bad ticks revert, real jumps persist. Flag a print when its return exceeds k times a rolling robust scale (MAD-based, so the tick cannot inflate its own threshold) and the next return cancels most of the move; corroborate with trade condition codes and whether quotes followed. Real news moves depart and stay, so they pass. Accept the residual tradeoff explicitly: keep raw data immutable, log every removal, and tune k on known error cases rather than to make charts pretty.`,
    python: `import pandas as pd

p = trades["price"]
r = p.pct_change()

# robust local scale: rolling MAD, so an error can't stretch its own fence
med = r.rolling(200).median()
mad = (r - med).abs().rolling(200).median()
scale = 1.4826 * mad

big = (r - med).abs() > 10 * scale        # candidate: way outside local noise

# reversion test: the NEXT return unwinds most of the move
# (r + r.shift(-1)) ~ 0 for an isolated bad print; stays large for real jumps
unwound = (r + r.shift(-1)).abs() < 0.25 * r.abs()

bad = big & unwound

# corroboration where the feed provides it: condition codes, size
# bad &= trades["cond"].isin(BAD_CONDITIONS) | (trades["size"] < 10)

# treat as a VIEW: raw stays raw, removals are logged, filter is versioned
clean = p.mask(bad)
removed = trades.loc[bad]                  # audit trail of what we suppressed
# a real flash move fails "unwound" and survives -- by design`,
    trap: `Fencing with rolling standard deviation instead of a robust scale. The bad tick lands, inflates the rolling stdev for the next N bars, and the filter goes blind right after each error -- letting the second bad print through and occasionally flagging the innocent recovery bar instead.`,
  },
  {
    id: "qr-cleaning-10-missing-return-policy",
    module: "cleaning",
    title: "NaN vs zero in a returns panel",
    difficulty: "core",
    question: `In your daily returns matrix, some cells are NaN -- names not yet listed, halted, or with feed gaps. A teammate proposes fillna(0) so "the math stops breaking". What does that decision actually do, and what is your policy?`,
    thinking: `Pin down the semantics: NaN says "no observation exists"; 0 says "we observed a flat day". fillna(0) converts ignorance into a specific factual claim, thousands of times. Trace the consequences through each consumer. Volatility: fake zeros shrink it, most severely for the gappiest (least liquid, most dangerous) names. Correlations: dragged toward zero, so diversification is overstated. Cross-sectional ranks: a zero return outranks half the universe on a down day -- unlisted stocks start winning momentum contests. Rolling means: silently averaged over fictional flat days. The alternative default -- leave NaN and let pandas' NaN-aware machinery skip them -- has its own subtlety: statistics get computed over different day counts per name (use min_periods to keep estimates honest), and corr goes pairwise-complete. But those are visible, manageable costs. Zeros are invisible ones. Policy: NaN in, NaN through, with explicit masks; convert to 0 only at the final P&L-aggregation step, where "no position, no return" is genuinely true.`,
    answer: `fillna(0) asserts a flat trading day where nothing was observed. That deflates volatility (worst for illiquid names), pulls correlations toward zero, and lets non-existent observations win cross-sectional ranks on down days. My policy: keep NaN through the research pipeline -- pandas statistics skip them, with min_periods guarding against thin windows -- and materialize zeros only where they are literally true, such as portfolio P&L when the position is zero. The distinction between "not observed" and "observed flat" must survive to the last step.`,
    python: `import pandas as pd

# r: dates x stocks daily returns with honest NaNs

# --- what fillna(0) does, made visible ---
r0 = r.fillna(0.0)
vol_true = r.std() * (252 ** 0.5)      # NaN-aware: real observations only
vol_fake = r0.std() * (252 ** 0.5)     # diluted by fictional flat days
# names with sparse history show the biggest (fake) vol reduction

# ranks: on a -1% market day, a fake 0 beats half the real universe
ranks_bad = r0.rank(axis=1, pct=True)
ranks_ok = r.rank(axis=1, pct=True)    # NaNs excluded from ranking entirely

# --- honest-NaN discipline for rolling stats ---
mom = r.rolling(21, min_periods=15).mean()
# min_periods: refuse an estimate from too few real observations,
# instead of quietly averaging whatever exists

# --- the one place zeros are TRUE: realized portfolio P&L ---
w = weights.shift(1)                   # yesterday's weights earn today
pnl = (w * r).sum(axis=1)              # sum skips NaN: no position, no P&L
# equivalently: unheld or unobserved names contribute exactly 0 here,
# because the CLAIM "this contributed nothing to the book" is true`,
    trap: `Doing r.corr() on the zero-filled panel and admiring how stable the correlation matrix became. The stability is the artifact: fake zeros are uncorrelated with everything, so every pairwise estimate shrinks toward zero in proportion to the fill rate -- the gappiest names look like the best diversifiers.`,
    followUp: `Two names, one with 10 years of history and one with 10 months, both show a rolling 1-year Sharpe. What does min_periods decide here, and what bias appears if you rank the two on that statistic anyway?`,
  },
  {
    id: "qr-cleaning-11-adjustment-method-choice",
    module: "cleaning",
    title: "Ratio vs subtraction adjustment",
    difficulty: "hard",
    question: `Dividends can be folded into history multiplicatively (scale prices before the ex-date by 1 minus dividend over price) or by subtraction (subtract future dividends from earlier prices). Contrast the two -- what does each preserve, and where does each break?`,
    thinking: `Ask what invariant each method preserves, because that decides its use case. Ratio (multiplicative) adjustment preserves percentage returns: after scaling, the ex-date's adjusted return equals the true holder return, and compounding adjusted prices reproduces total-return growth -- which is why research and backtesting live on ratio-adjusted or total-return series. Its cost: historical price levels lose meaning (a stock that paid dividends for 40 years shows absurdly low adjusted prices decades back), and per-share dollar arithmetic on history goes wrong. Subtraction adjustment preserves dollar differences -- point moves match actual per-share P&L, which is why futures back-adjustment traditionally subtracts roll gaps -- but it distorts percentage returns (same dollar drop on a lower adjusted base inflates the percentage) and, on long histories with heavy payers, adjusted prices can go negative, at which point returns become meaningless. So: ratio for anything statistical in return space; subtraction only where per-unit dollar P&L is the object, and even then watch the zero crossing.`,
    answer: `Ratio adjustment multiplies pre-ex-date history by (1 minus dividend/price), preserving percentage returns -- adjusted-price returns equal true holder returns, so it is the right basis for statistics and backtests; the cost is that deep-history price levels become fictitious. Subtraction preserves dollar-per-share differences -- natural for futures-style P&L -- but distorts percentage returns and can drive old prices negative on long dividend-heavy histories, destroying return math entirely. Choose by invariant: returns work means ratio; dollar-point work means subtraction, with the negativity hazard checked.`,
    python: `import pandas as pd

# px: raw closes. div: dividend per share on ex-dates (0 elsewhere)
d = div.reindex(px.index).fillna(0.0)

# --- ratio method: preserves RETURNS ---
# factor on each ex-date: fraction of prior close that survives the payout
fct = 1.0 - d / px.shift(1)
fct = fct.fillna(1.0)
rev = fct.iloc[::-1].cumprod().iloc[::-1]     # product of factors >= t
ratio_adj = px * rev.shift(-1).fillna(1.0)    # strictly-later events only

# invariant check: adjusted return on ex-date == holder's total return
lhs = ratio_adj.pct_change()
rhs = (px + d) / px.shift(1) - 1
# lhs and rhs agree on ex-dates (up to float noise)

# --- subtraction method: preserves DOLLAR moves ---
fut_div = d.iloc[::-1].cumsum().iloc[::-1]    # all dividends >= t
sub_adj = px - fut_div.shift(-1).fillna(0.0)  # subtract strictly-later cash

# invariant check: dollar difference preserved day to day
# (sub_adj.diff() == px.diff() away from ex-dates; on ex-dates the
#  dividend drop is removed from the diff -- pure price P&L remains)

# the hazard: heavy payers over decades
went_negative = (sub_adj <= 0).any()          # if True, return math is dead`,
    trap: `Computing percentage returns off a subtraction-adjusted series. Near the zero crossing the denominators shrink toward nothing, so ordinary dividend drops become triple-digit "returns" -- and every risk and performance number downstream is garbage while looking superficially plausible far from the crossing.`,
    followUp: `Continuous futures series face the same choice at every roll: back-adjust by ratio or by difference. Why does the convention differ from equities, and which is right for a vol-targeted strategy backtest?`,
  },
  {
    id: "qr-cleaning-12-outlier-or-real",
    module: "cleaning",
    title: "Outlier or real event?",
    difficulty: "hard",
    question: `Your robust filter flags a -40% daily return in a mid-cap. It might be a data error; it might be a real collapse -- a fraud revelation, a failed drug trial. You cannot eyeball 3,000 stocks. Design the decision process.`,
    thinking: `Frame it as classification with asymmetric costs, and use evidence beyond the price itself. A real -40% is corroborated by its context: massive volume, sustained follow-through (the price stays down), the same move in every other vendor's feed, and usually news. A data error is uncorroborated: normal volume, immediate reversion, absent from the second source. That yields an automated evidence checklist -- cross-vendor agreement, volume ratio versus trailing median, next-day reversion, corporate-action file check (the most common false alarm is an unadjusted split, which reverts never but shows a clean ratio like exactly -50%) -- and a scoring rule that auto-clears the two easy corners: confirmed-real (keep untouched) and confirmed-error (mask, report to vendor). Only the ambiguous middle goes to a human, which is now dozens of cases, not thousands. Then state the cost asymmetry that governs the thresholds: deleting real crashes truncates the loss tail exactly where risk models need it most -- so when in doubt, keep the observation and flag it, never silently delete.`,
    answer: `Automate an evidence score per flagged move: does a second vendor show it, is volume a large multiple of its trailing median, does the price follow through rather than revert next day, and does the corporate-action file explain it -- unadjusted splits are the classic false alarm, betrayed by clean ratios like exactly minus a half. Auto-keep confirmed-real, auto-mask confirmed-error, queue only the ambiguous residual for human review. Bias the thresholds toward keeping: deleting genuine crashes trims exactly the tail your risk estimates exist to capture.`,
    trap: `A cleaning pass that "successfully removes all extreme returns" -- if the pipeline output has no -40% days over decades of equities, the filter has been deleting history's real disasters, and every downstream tail-risk number (VaR, stress loss, drawdown) is fiction. The absence of outliers is itself a red flag.`,
    followUp: `Which direction of misclassification hurts a risk model more, and which hurts an alpha signal more? Would you run the same filter thresholds for both consumers of the data?`,
  },
  {
    id: "qr-cleaning-13-delisting-returns",
    module: "cleaning",
    title: "Delisting returns",
    difficulty: "hard",
    question: `Your point-in-time universe includes stocks that later delist, but the price feed just stops on the last trading day. Your backtest currently drops the position at its final price as if you sold there. What is wrong with that, and what should you do?`,
    thinking: `Ask what really happened to a holder after the final print, because your backtest's assumption -- clean exit at the last quote -- is often the one outcome that was impossible. Delistings split by cause. Mergers and acquisitions: the holder received cash or acquirer shares, typically near or above the last price -- benign, terms knowable. Involuntary delistings -- bankruptcy, exchange non-compliance -- are the dangerous branch: the last exchange print happens before the end, and the shares then trade off-exchange far lower or expire worthless; classic research on this (Shumway) showed databases systematically omitted these terminal returns, and that assuming zero overstates small-cap and distressed-strategy performance materially. So the policy: join a delisting file with codes and delisting returns; where the true terminal return is missing for an involuntary delisting, impute a conservative default (empirical literature suggests around -30%, worse for certain exchanges); apply it as one final return, then remove the name. The backtest must eat the ending real money ate.`,
    answer: `Stopping at the last price assumes you sold at it -- for involuntary delistings that exit rarely existed; shares often went to near-zero off-exchange. Mergers, by contrast, usually paid out near the final price. Policy: merge a delisting-events file, apply each cause's actual terminal return as one final observation, and where it is unknown for involuntary cases impute a conservative default -- the empirical literature centers near -30% -- before removing the name. Otherwise the backtest systematically overstates returns exactly in distressed, small-cap territory.`,
    python: `import pandas as pd
import numpy as np

# r: dates x stocks returns.  delist: one row per delisted name with
# columns [ticker, dl_date, dl_code, dl_ret] (dl_ret often NaN when
# the terminal value was never captured by the vendor)

ev = delist.set_index("ticker")

# conservative imputation ONLY where the truth is missing:
# mergers (code M) missing -> assume exit at last price (0.0 extra return)
# involuntary (code X) missing -> literature-based -30% terminal return
imputed = ev["dl_ret"].copy()
is_merger = ev["dl_code"].eq("M")
imputed = imputed.fillna(pd.Series(np.where(is_merger, 0.0, -0.30),
                                   index=ev.index))

# stamp the terminal return into the panel on each delisting date
for tkr, row in ev.iterrows():          # small table (events), loop is fine
    d = row["dl_date"]
    if d in r.index and tkr in r.columns:
        r.loc[d, tkr] = imputed.loc[tkr]
        r.loc[r.index > d, tkr] = np.nan     # the name is gone after that

# sanity: aggregate impact -- how much performance was being overstated?
# rerun the backtest with and without terminal returns; the delta is the
# survivorship-at-exit bias you were previously booking as alpha`,
    trap: `Treating "the feed went quiet" as a graceful exit at the last quote. That books the one trade nobody could make -- selling a collapsing name at its final exchange print -- and the bias concentrates in exactly the strategies (small-cap value, distressed momentum) where delistings cluster.`,
    followUp: `Your delisting file has the code but no return for 20% of involuntary cases. How would you estimate a defensible imputation from your own data rather than citing the literature's -30%?`,
  },
  {
    id: "qr-cleaning-20260808-ex-date-vs-pay-date",
    module: "cleaning",
    title: "Ex-date vs pay-date for dividends",
    difficulty: "core",
    question: `Your total-return series applies each dividend on its PAY date, which lands two to four weeks after the ex-dividend date. A daily backtest shows a small return trough after every ex-date, followed by a jump on pay date, that no live trader would actually experience. What is wrong, and which date should the dividend be booked on?`,
    thinking: `Separate the mechanics from the accounting. Ex-date is when the price mechanically drops by roughly the dividend amount -- the market prices in the payment the moment you are no longer entitled to it, whether or not cash has moved. Pay date is purely administrative, when cash physically settles into an account, and is irrelevant to the price series. Your raw price series already embodies the ex-date drop. If the total-return series only credits the offsetting cash weeks later on pay date, there is a window where the drop has been recorded but the compensation has not -- an artificial trough -- followed by a fake jump when the credit finally posts. The fix: book the dividend on ex-date so the total-return series stays whole exactly when the mechanical loss is realized. This is the standard total-return-index convention.`,
    answer: `Book on ex-date. The price already dropped by the dividend amount on ex-date -- that is the mechanical event -- so the total-return series must credit the cash the same day to stay flat through that drop. Booking on pay-date, weeks later, creates an artificial trough between the two dates and a fake jump when the credit finally posts.`,
    python: `import pandas as pd

# raw: daily close prices (already reflects the ex-date drop mechanically)
# divs: dividend cash amounts indexed by DATE PAID (vendor's default key)
# corp_actions: mapping from pay_date -> ex_date, from the same vendor

# WRONG: crediting cash on the vendor's default pay-date index
# tr_wrong = raw.pct_change().add(
#     divs.reindex(raw.index, fill_value=0) / raw.shift(1), fill_value=0
# )  # trough between ex-date and pay-date, jump on pay-date

# RIGHT: remap dividend cash onto ex-date before building total return
divs_by_ex = divs.rename(index=corp_actions["ex_date"].to_dict())
divs_by_ex = divs_by_ex.reindex(raw.index, fill_value=0.0)

simple_ret = raw.pct_change()
div_yield = divs_by_ex / raw.shift(1)          # cash relative to prior close
total_ret = simple_ret + div_yield             # whole through the ex-date drop
tr_index = (1.0 + total_ret.fillna(0.0)).cumprod()`,
    trap: `Trusting the vendor's default dividend-date column without checking which date it actually is. Corporate-actions files are usually keyed by pay-date because that is what accounting cares about; if the file also carries an ex-date column, joining on the wrong one is an easy, silent mistake that only shows up as a faint, recurring artifact in the return series.`,
    followUp: `A company announces a dividend, sets an ex-date, then cuts or cancels the payment before pay-date due to financial distress -- after your total-return series already booked it on ex-date. How does a point-in-time-correct series handle that retraction without introducing lookahead?`,
  },
  {
    id: "qr-cleaning-20260809-spinoffs",
    module: "cleaning",
    title: "Spin-offs: a corporate action that isn't a split or dividend",
    difficulty: "hard",
    question: `Company A spins off its cloud division as a new public company B: every holder of A receives 0.25 shares of B for each share of A, and A's price drops by roughly the value of what was distributed. Your adjustment pipeline only knows how to handle splits (a ratio factor) and cash dividends (add back the cash). What breaks, and how do you adjust for a spin-off correctly?`,
    thinking: `Recognize a spin-off as a hybrid your two existing handlers were not built for. Like a split, the price mechanically drops on the ex-date with no economic loss to the holder -- so a split-style ratio adjustment is needed to keep A's own return series clean of that drop. Unlike a split, what the holder receives is not more shares of A; it is shares of a DIFFERENT security B with its own independent price series, so a cash-dividend-style "add back one distributed amount" does not work either, since B keeps moving on its own after the spin. Getting total return right means holding both legs: scale A's pre-spin history down by the ratio implied by B's ex-date value, AND separately track B's post-spin returns weighted by the distribution ratio as part of the same holder position. Adjusting A alone and never adding B quietly deletes real, sometimes substantial, continuing performance -- spin-offs frequently outperform in the period right after separation.`,
    answer: `A spin-off drops A's price mechanically, like a split, but distributes value into a genuinely separate security B, unlike a dividend's cash. Adjusting A alone with a split-style ratio factor cleans up A's own return series but silently discards B's subsequent performance from total return. Correct handling: apply the ratio adjustment to A's pre-spin history, and separately track B's post-spin returns weighted by the distribution ratio as part of the same holder position, combining both legs into one total-return series.`,
    python: `import pandas as pd

# A: price of the parent. B: price of the spun-off entity, starts trading on ex-date.
# ratio: shares of B received per share of A (e.g. 0.25)
ratio = 0.25
a_pre_ex_close = 180.0          # A's close ON the ex-date (already reflects the drop)
b_ex_date_open = 40.0           # B's first print
a_price_before_adj = 190.0      # A's close the day BEFORE the ex-date

distributed_value = ratio * b_ex_date_open      # value handed to each A share

# split-style adjustment factor for A's OWN history -- same mechanics as a
# plain split, scaling pre-ex-date A prices so A's return series alone is clean
adj_factor = a_pre_ex_close / (a_price_before_adj - distributed_value + a_pre_ex_close)
# (illustrative -- production pipelines get this ratio from the vendor's
# corporate-action file rather than back-solving it)

# the total return a HOLDER actually experienced needs BOTH legs: one share
# of A held through the spin becomes 1 share of A_adjusted + ratio shares of B
a_adj = a_series * adj_factor                    # adjusted parent leg
combined_value = a_adj + ratio * b_series.reindex(a_series.index, fill_value=0.0)
holder_return = combined_value.pct_change()
# adjusting A alone and never adding the B leg understates total return by
# whatever B does after the spin -- sometimes the larger half of the story`,
    trap: `Treating a spin-off's ex-date price drop purely as noise to adjust away, exactly like a split, and never adding B into the portfolio at all. The return series looks clean and continuous -- no obvious gap, no red flag in review -- while quietly deleting a real, often substantial, second leg of performance.`,
    followUp: `Your point-in-time universe file only tracks membership of A, and B does not exist in your security master until weeks after it starts trading. How does that gap between B's first trade and its appearance in your data compound the spin-off adjustment problem?`,
  },
  {
    id: "qr-cleaning-20260810-winsorize-methods",
    module: "cleaning",
    title: "Winsorizing outliers: percentile clip vs MAD vs z-score",
    difficulty: "hard",
    question: `A daily feature has occasional extreme values that you want to cap rather than delete, so a handful of fat-fingered prints don't dominate a cross-sectional regression. A teammate proposes clipping at the 1st and 99th percentile every day. Walk through that choice against z-score capping and MAD-based capping, and where each breaks.`,
    thinking: `All three are the same idea, cap extreme values rather than drop the row, but they differ in which statistic decides "extreme", and that choice matters exactly because the thing you are protecting against, outliers, is also the thing that can corrupt the statistic used to detect them. Z-score capping (mean plus or minus k standard deviations) is the most fragile: the mean and especially the standard deviation are themselves dragged by the outlier you are trying to cap, so one huge fat-finger can inflate the std enough that even genuinely extreme days no longer look extreme. Percentile clipping is order-based rather than magnitude-based, so a single huge outlier cannot distort the threshold -- far more robust, but it always caps exactly the same fraction of names every day even when nothing was actually unusual, needlessly compressing a legitimately wide, calm distribution. MAD-based capping (median plus or minus k times the median absolute deviation) keeps that robustness while staying magnitude-aware, capping fewer names on calm days and more on genuinely wild ones -- the more common professional default.`,
    answer: `Z-score capping uses mean and std, which the outlier itself distorts, so it can under-cap exactly the days it needs to catch -- avoid it for heavy-tailed data. Percentile clipping (1st/99th) is robust to any single outlier but always trims a fixed fraction of names regardless of whether the day was actually wild or calm. MAD-based capping (median plus k times median absolute deviation) combines robustness with being magnitude-aware, adapting to how extreme the day actually is -- the standard professional default for cross-sectional winsorization.`,
    python: `import pandas as pd
import numpy as np

# cs: one day's cross-section of a feature, one value per ticker
cs = pd.Series([1.2, 1.5, 1.1, 1.3, 1.4, 55.0, 1.0, 1.6])   # 55.0 is a fat-finger

# z-score capping -- FRAGILE: the outlier itself inflates std,
# so the cap threshold can end up too loose to catch it
mu, sd = cs.mean(), cs.std()
z_capped = cs.clip(mu - 3 * sd, mu + 3 * sd)

# percentile capping -- robust to the outlier, but always trims a FIXED
# fraction of names, even on a day where nothing was actually unusual
pct_capped = cs.clip(cs.quantile(0.01), cs.quantile(0.99))

# MAD-based capping -- robust AND magnitude-aware: 1.4826x scales MAD to
# be comparable to std under normality, so k plays the same role as in z-score
med = cs.median()
mad = (cs - med).abs().median() * 1.4826
mad_capped = cs.clip(med - 3 * mad, med + 3 * mad)

print(z_capped.max(), pct_capped.max(), mad_capped.max())
# z_capped.max() is pulled toward 55 by its own inflated std;
# mad_capped.max() stays tight around the genuine data`,
    trap: `Fitting the z-score capping threshold (mean and std) on the same, uncapped data it is about to cap. The single extreme value can inflate std enough that the cap barely touches it -- a fat-finger that should have been squashed to the 99th-percentile range survives mostly intact because the very statistic meant to catch it was computed on data that includes it.`,
    followUp: `Your MAD-based cap works well on liquid large caps but caps almost every micro-cap's return every single day. What does that tell you about using a single k across the whole universe, and what would you change?`,
  },
  {
    id: "qr-cleaning-20260811-ticker-recycling",
    module: "cleaning",
    title: "Ticker recycling: when a symbol changes companies",
    difficulty: "hard",
    question: `Ticker "XYZ" belonged to a company that went bankrupt and delisted in 2011. In 2019, an unrelated company IPO'd and was assigned the same now-available ticker "XYZ". Your price database is keyed by ticker alone, sorted by date. What breaks, and how should the data actually be keyed?`,
    thinking: `A ticker is a mutable label an exchange assigns and can reassign once it is vacated -- it is not a permanent identifier for the company, even though every naive join in a research pipeline treats it like one. Sort a ticker-keyed table by date and it looks perfectly continuous: 2011's last row for XYZ sits right above 2019's first row for XYZ, with no marker that the underlying company changed entirely. A pct_change() computed straight through that seam produces a return connecting a 2011 bankruptcy's last quoted price to an unrelated 2019 IPO's first quoted price -- a number with no economic meaning that nonetheless looks like ordinary data, easily absorbed into a rolling window as unremarkable noise after an eight-year gap. It gets worse than a bad return: any side table joined by ticker -- sector, fundamentals, index membership -- can attach the WRONG company's attributes to the wrong era's prices, and a point-in-time universe reconstruction keyed on ticker can flicker a dead company back into the live universe under its successor's data. The fix is architectural: key everything on a permanent security identifier (an internal surrogate id, or an external one like FIGI or CUSIP/SEDOL) that is never reassigned, and store ticker as a time-varying ATTRIBUTE of that id -- a ticker-history table of (permanent_id, ticker, start_date, end_date) -- so any ticker-keyed vendor feed must first resolve through a point-in-time ticker-to-id mapping before it touches the master price table.`,
    answer: `Ticker-keyed history silently splices two unrelated companies into one continuous-looking series -- a naive pct_change across the reuse boundary produces a meaningless return connecting a 2011 delisting's last price to a 2019 IPO's first price, and any side table joined by ticker can attach one company's attributes to the other's era. The fix is to key everything on a permanent, never-reassigned security identifier and store ticker as a time-bounded attribute of that id -- a (permanent_id, ticker, start_date, end_date) mapping table -- so any ticker-based vendor feed resolves through that point-in-time mapping before touching the master price table.`,
    python: `import pandas as pd

# WRONG: ticker as the primary key -- two unrelated companies, one series
px = pd.DataFrame({
    "date":   pd.to_datetime(["2011-03-01", "2011-03-02", "2019-06-10", "2019-06-11"]),
    "ticker": ["XYZ", "XYZ", "XYZ", "XYZ"],
    "close":  [2.10, 0.05, 40.00, 41.20],   # first two: a bankrupt co; last two: an unrelated IPO
})
bad_ret = px.set_index("date")["close"].pct_change()
# the 2019-06-10 row shows a huge "return" from splicing two companies
# together across the eight-year gap -- a data artifact, not a market move

# RIGHT: a permanent id, with ticker as a time-bounded ATTRIBUTE of that id
ticker_history = pd.DataFrame({
    "permid":     ["PID_001", "PID_047"],
    "ticker":     ["XYZ", "XYZ"],
    "start_date": pd.to_datetime(["2005-01-01", "2019-06-10"]),
    "end_date":   pd.to_datetime(["2011-03-02", pd.NaT]),
})

def resolve_permid(ticker, date, history):
    # point-in-time resolution: which company owned this ticker on this date
    hit = history[(history["ticker"] == ticker) &
                  (history["start_date"] <= date) &
                  (history["end_date"].isna() | (date <= history["end_date"]))]
    return hit["permid"].iloc[0] if len(hit) else None

# every vendor feed keyed by ticker gets resolved through this BEFORE
# joining onto the master price table -- returns are then computed
# per permid, so the 2011-to-2019 seam simply cannot connect`,
    trap: `Treating ticker recycling as if it were a corporate rename (same company, new symbol) and handling it with the adjustment machinery built for that case. Recycling is the opposite structure -- two DIFFERENT companies sharing one label at different times -- so any logic built for continuity (splice the history, carry the old identifier's metadata forward) actively makes the corruption worse instead of fixing it.`,
    followUp: `The merge_asof by="ticker" pattern from the point-in-time module joins vendor fundamentals onto prices within each ticker group. What does ticker recycling do to that join specifically, and does adding a tolerance window fix it? (No -- by="ticker" groups both eras of XYZ together as one series, so a merge_asof can hand 2011's bankrupt-company fundamentals to a 2019 price row within tolerance; only resolving to a permanent id before the join fixes it.)`,
  },
  {
    id: "qr-cleaning-20260812-fx-cross-listed",
    module: "cleaning",
    title: "FX mismatches for cross-listed shares",
    difficulty: "core",
    question: `You're comparing a stock's ADR (American Depositary Receipt, trades in USD on a US exchange) to its home-market listing (trades in EUR on the Frankfurt exchange), expecting the two to move together after adjusting for the ADR ratio. Some days show a large, unexplained gap. What's the likely cause, and how do you fix the comparison?`,
    thinking: `Write down what actually determines the ADR's USD price: roughly the local EUR price, converted at the prevailing FX rate, divided by the ADR ratio (local shares per ADR). If you compare the raw EUR price to the raw USD price without ever converting through EUR/USD, you are comparing two numbers denominated in different currencies -- any FX move alone will look like a parity break that has nothing to do with either listing being mispriced. Even after converting currency correctly, a second, subtler gap remains: Frankfurt and the US exchange do not trade at the same time, so a "same calendar day" close-to-close comparison bakes in whatever happened in the hours between the two closes. On a volatile day that timing gap alone can look like a data error.`,
    answer: `The likely cause is comparing prices in different currencies without converting, plus non-overlapping trading sessions. Convert the local EUR price to USD using the FX rate at a consistent snapshot time before dividing by the ADR ratio, then compare to the ADR's USD price. Even after that, same-calendar-day closes aren't simultaneous -- Frankfurt closes hours before the US session ends -- so residual gaps on volatile days are partly a timing artifact, not just a data-quality issue.`,
    python: `import pandas as pd

# local listing: EUR price, home-market close
local = pd.DataFrame({"date": dates, "close_eur": local_close})
fx = pd.DataFrame({"date": dates, "eurusd": fx_rate})        # EUR->USD rate
adr = pd.DataFrame({"date": dates, "close_usd": adr_close})  # ADR, USD

ADR_RATIO = 2   # 1 ADR represents 2 local shares -- check the prospectus, not guess

parity = local.merge(fx, on="date").merge(adr, on="date")

# convert EUR close to USD, THEN apply the ADR ratio -- both steps must
# happen before any comparison between the two listings is meaningful
parity["implied_adr_usd"] = parity["close_eur"] * parity["eurusd"] / ADR_RATIO

parity["gap_bps"] = (parity["close_usd"] / parity["implied_adr_usd"] - 1) * 1e4

# residual gaps can still be real: Frankfurt closes ~5-6 hours before the
# US session, so on a day with a big US-session move the ADR "sees" news
# the local close never priced in -- not a data bug, a synchrony limit
big_gaps = parity.loc[parity["gap_bps"].abs() > 50]`,
    trap: `Dividing the raw EUR close by the raw USD close (or vice versa) without ever pulling in the FX rate, then treating any day the ratio drifts as a data-quality issue. Most of that "issue" is just the EUR/USD exchange rate moving, which has nothing to do with the stock.`,
    followUp: `Your FX rate series is a daily snapshot taken at 4pm London time, but the local market closes at 5:30pm CET and the ADR at 4pm ET. Which FX timing convention would minimize the residual timing gap, and is it even achievable with the data you have?`,
  },
  {
    id: "qr-cleaning-20260813-negative-prices-log-returns",
    module: "cleaning",
    title: "Negative prices and why log returns break",
    difficulty: "hard",
    question: `In April 2020, front-month WTI crude oil futures traded to about -37 dollars a barrel -- a genuine, real print, not a data error. Your pipeline computes daily log returns as np.log(price_t / price_t_minus_1) for every instrument uniformly. What happens on that day, and how do you handle an asset class where price can legitimately go negative?`,
    thinking: `Log returns rest on an assumption most people never state out loud: price is a positive quantity, so the ratio price_t over price_t_minus_1 is always positive and its log is always defined. Equities and most cash instruments satisfy that by construction -- a share price cannot go negative. Futures on physical commodities do not carry that guarantee, because the contract is a claim on a delivery obligation, and when storage capacity runs out, someone will pay YOU to take the delivery burden off their hands -- price crosses zero. The moment price_t or price_t_minus_1 is negative or zero, the ratio is negative or undefined, and log of a negative number is not a real number: you get NaN, silently, with no exception raised by default in numpy. A NaN log return doesn't just corrupt that one day -- it poisons every downstream cumulative product and rolling statistic that touches it. Log returns are a convenience for compounding, not a law of nature; simple returns, price_t over price_t_minus_1 minus one, stay perfectly well-defined and interpretable even when price is negative, so the honest fix is asset-class-aware: use log returns where positivity is guaranteed, fall back to simple returns for asset classes where it structurally is not.`,
    answer: `On the day price goes negative, np.log of a negative ratio returns NaN silently, no exception raised -- and that single NaN poisons every downstream cumulative product or rolling window that includes it. Log returns implicitly assume strictly positive prices, which holds for equities but not for physical-delivery futures, where price can legitimately cross zero when storage runs out. Fix: use log returns only for asset classes with guaranteed positivity; for anything that can go negative or hit zero (some commodity futures, some rate/spread instruments), use simple returns, price_t minus price_t_minus_1 divided by price_t_minus_1, which stays well-defined and interpretable at any sign.`,
    python: `import numpy as np
import pandas as pd

wti = pd.Series([25.0, 20.0, -37.6, 10.0])   # the real April 2020 shape

log_ret = np.log(wti / wti.shift(1))
# log_ret on the -37.6 day: log of a NEGATIVE ratio -> NaN, no error raised
print(log_ret.isna().sum())   # at least 2 NaNs: the negative day AND the day after

simple_ret = wti.pct_change()
# well-defined at every step, including the crossing: interpretable as
# "dollars gained or lost per dollar of prior price" even when that prior
# price itself was negative
print(simple_ret.round(3).tolist())

# a NaN log return silently kills a cumulative product downstream --
# ONE bad day breaks the entire compounded series from that point on
cum_log = np.exp(log_ret.cumsum())     # NaN forever after the break
cum_simple = (1 + simple_ret.fillna(0)).cumprod()   # stays computable`,
    trap: `Applying the same log-return pipeline to every instrument in a multi-asset research stack because "that's the standard" and only noticing the NaN contamination weeks later in a cumulative P&L chart that goes flat and then NaN. The fix people reach for under pressure -- clip prices to a small positive floor before logging -- silently invents a return magnitude for a day the real market printed impossible economics, which is worse than surfacing the NaN.`,
    followUp: `A rates desk's spread instrument, computed as the difference of two yields, is legitimately zero or negative on many ordinary days, not just as a rare tail event. Does that change your default recommendation for which return convention to use for spread-based instruments generally?`,
  },
  {
    id: "qr-cleaning-20260814-bid-ask-bounce",
    module: "cleaning",
    title: "Bid-ask bounce: last-trade price vs midpoint",
    difficulty: "core",
    question: `You're building a returns series from tick data and have both the last-trade price and the bid/ask quotes at each timestamp. Using last-trade price, your high-frequency return series looks noisier than the underlying quotes suggest it should be. What's going on, and what do you use instead?`,
    thinking: `Trades don't happen at one "fair" price -- they happen at the bid when a seller crosses, or the ask when a buyer crosses, and the print bounces back and forth between those two levels even when the underlying quote (the market's actual view of value) hasn't moved at all. That bouncing shows up as return variance in a last-trade series that isn't real volatility, it's pure microstructure noise from which side of the spread the last print happened to hit. The midpoint, (bid+ask)/2, isn't affected by which side traded, so it isolates the quote's genuine movement. This matters a lot at high frequency: realized-vol estimates inflate, return autocorrelation turns artificially negative (each bounce tends to reverse the previous one), and anything computed on last-trade returns picks up noise variance that has nothing to do with real risk or signal.`,
    answer: `Bid-ask bounce: trades alternate hitting the bid and lifting the ask, so last-trade prices bounce between two levels even with zero real price movement, adding noise variance and spurious negative autocorrelation to high-frequency returns. Use the midpoint (bid+ask)/2 instead -- it isn't affected by which side of the spread the last trade happened to cross, so it isolates genuine quote movement from execution-side noise.`,
    python: `import pandas as pd

bid = pd.Series([100.00, 100.00, 100.01, 100.01, 100.00, 100.02])
ask = pd.Series([100.02, 100.02, 100.03, 100.03, 100.02, 100.04])
# a trade alternates hitting the bid and lifting the ask -- pure bounce, no real move
last = pd.Series([100.02, 100.00, 100.03, 100.01, 100.02, 100.04])

mid = (bid + ask) / 2
ret_last = last.pct_change()
ret_mid = mid.pct_change()

print("std(last-trade returns):", ret_last.std())   # inflated by bounce
print("std(midpoint returns):  ", ret_mid.std())     # isolates the real quote move`,
    trap: `Computing realized volatility directly from last-trade returns at high frequency -- the bounce inflates the estimate, and the effect gets worse as your sampling frequency increases, not better.`,
  },
  {
    id: "qr-cleaning-20260815-special-dividends",
    module: "cleaning",
    title: "Special dividends in a total-return adjustment",
    difficulty: "core",
    question: `A stock trading at $50 pays a one-time special dividend of $5 (10% of price) alongside its regular $0.30 quarterly dividend. Your total-return adjustment pipeline applies the same ex-date adjustment factor formula to both. Is that correct, and does anything downstream still need to treat the special dividend differently?`,
    thinking: `Separate the price-series math from the feature-engineering question, because the answer differs for each. For the adjustment factor itself, size doesn't matter -- (1 - dividend / close) applied at the ex-date keeps the total-return series continuous whether the payout is $0.30 or $5, so the mechanical adjustment is correct as-is. The real issue is what a special dividend MEANS: it's usually a one-off capital return (post-sale cash, a lever against a buyback, deleveraging), not part of the stock's recurring payout policy. Any feature built from trailing dividends -- a trailing-twelve-month yield, say -- will sum the special dividend right in with the regular ones and produce a yield spike that looks like a genuine re-rating, when it's actually a one-time event that tells you nothing about ongoing yield. So the fix isn't in the price adjustment, it's in flagging the special dividend so yield-based features can exclude or isolate it.`,
    answer: `The price/return adjustment is correct as-is -- dividing out (1 - div/close) at the ex-date works the same regardless of dividend size, so the total-return series stays continuous. What needs different treatment is any feature built on top of dividends: a trailing-yield feature that sums all ex-div cash without excluding flagged specials will show a false yield spike from a one-time payout. Vendors typically flag special vs regular dividends -- carry that flag through and exclude specials from any "sustainable yield" feature.`,
    python: `import pandas as pd

divs = pd.DataFrame({
    "ex_date": pd.to_datetime(["2026-03-15", "2026-06-15", "2026-06-15"]),
    "amount":  [0.30, 0.30, 5.00],
    "is_special": [False, False, True],
})
close_before_ex = 50.0

# adjustment factor: identical formula regardless of dividend size --
# this part of the pipeline needs NO special-case logic
adj_factor = 1 - divs["amount"] / close_before_ex

# trailing-12m yield feature: exclude specials, or it spikes on a one-off
ttm_regular = divs.loc[~divs["is_special"], "amount"].sum()
ttm_all = divs["amount"].sum()
# ttm_all / close_before_ex reads as an 11% yield -- not a real, repeatable rate
# ttm_regular / close_before_ex is the number a yield-based signal should use`,
    trap: `Building a trailing-dividend-yield feature by summing raw ex-div cash amounts without checking a special-dividend flag. The feature silently spikes on the payout quarter and looks exactly like a legitimate high-yield signal to any downstream ranking or z-score step, with no error to catch it.`,
    followUp: `A company does a large special dividend instead of an equivalent buyback. Should a total-shareholder-yield feature treat the two the same, and why does payout form matter for who's holding the stock?`,
  },
  {
    id: "qr-cleaning-20260816-gics-sector-reclassification",
    module: "cleaning",
    title: "GICS sector reclassification mid-history",
    difficulty: "hard",
    question: `GICS periodically restructures its sector definitions -- the 2018 split of Telecom into a broadened Communication Services sector pulled in names like Google and Netflix from Technology and Consumer Discretionary. If your sector-neutralization step joins every stock to TODAY'S static GICS sector for its entire history, what breaks, and how do you fix it?`,
    thinking: `Sector-relative signals -- rank within sector, demean by sector -- implicitly assume "sector" is a stable, meaningful grouping across your whole backtest window. Join a static, current mapping backward across history and every reclassified stock gets analyzed against a peer group it didn't actually belong to on those historical dates: Google's pre-2018 returns end up compared against telecom names it never traded alongside, corrupting both the neutralization math and the point-in-time discipline this whole module cares about -- you're using classification information (the 2018 restructuring) before it existed. The fix is structurally identical to every other PIT problem: sector membership needs its own dated table, ticker paired with sector and an effective date, joined with an as-of merge exactly like a corporate action or an analyst estimate. Practically: pull a vendor's historical GICS vintage file if one exists; failing that, at minimum flag and exclude the handful of names affected by a known restructuring date rather than pretend the mapping was always static.`,
    answer: `A static current-day sector join leaks future classification information backward and corrupts every historical sector-relative computation for reclassified names -- the same point-in-time problem this track keeps returning to. Fix it with a dated sector-membership table (ticker, sector, effective date) and an as-of merge, so each date's neutralization uses the sector that actually applied on that date, not today's.`,
    python: `import pandas as pd

# sector_history: one row per (ticker, sector) SPAN, with an effective start date
sector_history = pd.DataFrame({
    "ticker": ["GOOGL", "GOOGL", "NFLX", "NFLX"],
    "sector": ["Technology", "Communication Services",
               "Consumer Discretionary", "Communication Services"],
    "effective_date": pd.to_datetime(
        ["2004-01-01", "2018-09-24", "2002-01-01", "2018-09-24"]
    ),
}).sort_values("effective_date")

panel = pd.DataFrame({
    "date": pd.to_datetime(
        ["2017-06-01", "2019-06-01", "2017-06-01", "2019-06-01"]
    ),
    "ticker": ["GOOGL", "GOOGL", "NFLX", "NFLX"],
}).sort_values("date")

# as-of join: each row gets the sector effective ON OR BEFORE its date,
# grouped by ticker so different names' timelines don't bleed together
panel = pd.merge_asof(
    panel, sector_history, on="date", by="ticker", direction="backward"
)
# 2017 rows land in the pre-restructuring sector; 2019 rows get the new one`,
    trap: `Backfilling missing sector history by forward-filling from the earliest available vintage snapshot. If your vendor snapshot only starts in 2020, forward-filling it backward reintroduces the exact static-mapping bug for any earlier date -- you need the true historical mapping or an honest gap, not an extrapolation dressed up as one.`,
    followUp: `A stock was reclassified but you only have today's mapping and a news date for when it happened. Is a single-cutover approximation -- old sector before the date, new sector after -- good enough, and what does it still miss?`,
  },
  {
    id: "qr-cleaning-20260817-share-count-adjustments",
    module: "cleaning",
    title: "Share-count adjustments: buybacks and secondary offerings distorting market-cap history",
    difficulty: "core",
    question: `You're building a historical market-cap panel (price times shares outstanding) to use as a size factor. A company you're tracking bought back 15% of its shares over the past two years through steady open-market repurchases. What breaks if you just multiply today's price by today's shares-outstanding and apply it across the whole history, and how do you fix it?`,
    thinking: `Shares outstanding isn't a constant -- it drifts continuously from buybacks, secondary offerings, and employee equity issuance, on top of the discrete jumps from splits. If you take one shares-outstanding snapshot (today's) and multiply it by every historical price, you silently rewrite history: a company that repurchased 15% of its float now looks like it had 15% fewer shares two years ago than it actually did, so its historical market cap -- and any size-based feature or universe filter built off it -- is wrong for the entire lookback, not just wrong going forward. The fix is the same point-in-time discipline as prices and fundamentals: carry a shares-outstanding TIME SERIES (most vendors report it quarterly, from filings), not a single point value, and join it as-of each date so market cap on any given day reflects the share count that actually existed then.`,
    answer: `Multiplying today's shares-outstanding across all of history silently backdates the effect of every buyback and issuance, distorting historical market cap and any size factor built on it. Instead carry a shares-outstanding time series (reported quarterly in filings) and as-of join it to price so each day's market cap uses the share count that actually existed that day, not today's.`,
    python: `import pandas as pd

# shares_hist: quarterly shares-outstanding snapshots from filings
# prices: daily price series
shares_hist = pd.DataFrame({
    "report_date": pd.to_datetime(["2024-01-15", "2024-04-15", "2024-07-15", "2024-10-15"]),
    "shares_out": [100_000_000, 97_000_000, 95_500_000, 94_000_000],  # buybacks shrinking float
}).sort_values("report_date")

prices = pd.DataFrame({
    "date": pd.date_range("2024-01-01", "2024-12-31", freq="B"),
})
prices["price"] = 50.0  # placeholder daily closes

# as-of join: each price date gets the MOST RECENTLY REPORTED share count
# as of that date, not today's -- backward direction is the PIT-safe one
merged = pd.merge_asof(
    prices.sort_values("date"), shares_hist,
    left_on="date", right_on="report_date", direction="backward",
)
merged["market_cap"] = merged["price"] * merged["shares_out"]`,
    trap: `Applying the shares-outstanding correction only for splits (a clean, well-flagged corporate action) and assuming buybacks/issuance don't matter because they're gradual. Gradual drift compounds -- 15% over two years is a large, systematic size-factor error, not noise.`,
  },
  {
    id: "qr-cleaning-20260818-halted-zero-volume",
    module: "cleaning",
    title: "Halted trading masquerading as a zero return",
    difficulty: "core",
    question: `A stock gets halted for a pending news announcement at 11am and doesn't resume until the next session. In your daily returns panel, that day shows close equal to previous close, return exactly 0.0, and volume near zero. If you don't special-case this, what goes wrong downstream, and how do you detect it?`,
    thinking: `A halted day's zero return looks identical to a genuinely flat, uneventful trading day -- but it's not the same event. A real flat day means the market saw the stock and priced it unchanged; a halt means the market never got to price it at all that session, and the "zero" is really a missing observation wearing a zero's clothes. This matters most for anything that treats return equal to zero as information: a mean-reversion signal reading "no move" as a real data point, a volatility estimator that includes a fake zero-variance observation and understates vol, or a position that should have been cut pre-halt but the backtest's flat P&L that day hides the risk that was actually sitting there uncovered. The tell is volume, not the return itself -- a genuine flat day still trades close to its normal volume, while a halt shows volume collapsing toward zero. Flagging days where volume is a small fraction of, say, its 20-day trailing median lets you mask them as NaN instead of a false zero.`,
    answer: `A halt's zero return and a genuinely flat day look identical in the price series alone, but a halt is a missing observation, not a real zero -- treating it as real understates volatility and corrupts any signal that reads "no move" as information. Detect it by volume, not price: flag days where volume drops far below its trailing median (e.g. under 5-10% of a 20-day rolling median) and mask those returns as NaN rather than letting them pass as flat, uneventful trading.`,
    python: `import pandas as pd
import numpy as np

dates = pd.date_range("2026-08-01", periods=10, freq="B")
close = pd.Series([50.0, 50.2, 49.8, 49.8, 49.8, 50.1, 50.3, 50.0, 50.4, 50.6], index=dates)
volume = pd.Series([1.2e6, 1.1e6, 1.3e6, 0.02e6, 0.01e6, 1.4e6, 1.2e6, 1.3e6, 1.1e6, 1.2e6], index=dates)

ret = close.pct_change()

# flag halts by volume collapse relative to a trailing median, not by return==0
median_vol = volume.rolling(20, min_periods=5).median()
is_halted = volume < 0.05 * median_vol

# mask the fake flat return instead of letting it pass as a real zero
ret_clean = ret.mask(is_halted, np.nan)`,
    trap: `Using return == 0 itself as the halt filter. Plenty of genuinely flat days exist (illiquid small caps, options near expiry with no flow) and plenty of near-halts still print a tiny nonzero last-tick move -- volume is the signal that generalizes, price alone doesn't.`,
    followUp: `What do you do with the NaN once it's flagged -- drop the day from the panel entirely, or forward-fill through it? (Depends on use: for a return series feeding a Sharpe calc, drop or adjust the annualization factor for the missing day; for a price level feeding a lookback window, forward-fill the price but keep the return masked so it doesn't get double-counted as a real move.)`,
  },
  {
    id: "qr-cleaning-20260819-interpolate-lookahead",
    module: "cleaning",
    title: "Why interpolate() is a lookahead crime for prices",
    difficulty: "warmup",
    question: `A price series has a 3-day gap from a feed outage, and a teammate proposes df["close"].interpolate() to smoothly fill it instead of ffill(), arguing a straight line between the two known prices is more realistic than a flat line. Do you agree?`,
    thinking: `Picture what interpolate() needs to fill a point in the middle of a gap: both the last known value BEFORE the gap and the next known value AFTER it, drawing a line (or curve) between them. That "value after" is the crime -- for a point-in-time system, the price once the gap ends is information that did not exist yet while the gap was live. A backtest replaying day 2 of a 3-day outage would compute a return using a price that smoothly glides toward a level not printed for another day -- straightforward look-ahead bias, and a persuasive one, because the interpolated series looks MORE realistic than a flat-filled one, which is exactly why it is dangerous: it fools visual inspection precisely when you'd want a red flag. ffill's flat line is economically defensible (best available estimate given only what's known so far) and, crucially, uses zero information from the future. Interpolation is safe only for a value computed entirely after the fact, for a purpose that never claims to be point-in-time -- a smoothed historical chart for a report, never anything feeding a backtest or live signal.`,
    answer: `No. interpolate() fills a gap using both the value before AND the value after -- for a live or backtested system, the "after" value did not exist yet while the gap was open, so interpolation silently leaks future information into every filled day. It also looks more convincing than ffill's flat line, which makes the bug harder to catch on inspection. ffill uses only past information and is the point-in-time-safe choice; interpolation belongs only in a purely retrospective, non-tradable presentation like a historical chart.`,
    python: `import pandas as pd
import numpy as np

px = pd.Series(
    [100.0, np.nan, np.nan, np.nan, 112.0],
    index=pd.date_range("2026-08-01", periods=5, freq="D"),
)

# WRONG for backtesting: interpolate uses the value AFTER the gap (112.0)
# to smoothly fill the days INSIDE the gap -- those days didn't know that yet
leaked = px.interpolate()
# day 2 becomes 103.0, day 3 becomes 106.0, day 4 becomes 109.0 --
# a smooth glide path toward a price the market hadn't printed yet

# RIGHT for backtesting: ffill only ever uses information already observed
safe = px.ffill(limit=3)
# every filled day repeats 100.0 -- the honest "last known price" estimate

# the tell: a fill value that depends on ANY future observation is unsafe
uses_future = leaked.loc["2026-08-02"] != safe.loc["2026-08-02"]
assert uses_future`,
    trap: `Justifying interpolate() because the filled series "looks smoother and more realistic" than ffill's flat line. Realism is not the criterion here -- point-in-time availability is. A smoother-looking series that leaks the future is strictly worse for research than an honest, ugly, flat-filled one.`,
    followUp: `You only ever use interpolate() to fill gaps in a report generated after the full dataset is finalized, never inside a backtest loop. Is that safe, and what discipline keeps it from creeping into research code later? (Safe for a pure end-of-history presentation -- the danger is entirely about WHEN in the pipeline it runs; wall it off in a reporting/visualization module that research code never imports, so the boundary is structural, not just a rule people remember.)`,
  },
  {
    id: "qr-cleaning-20260820-rights-issue-adjustment",
    module: "cleaning",
    title: "Adjusting for a rights issue",
    difficulty: "hard",
    question: `A company announces a rights issue: existing holders may buy 1 new share for every 4 held, at a subscription price of 60 when the stock trades at 100 -- a discount meant to guarantee uptake. On the ex-rights date the stock mechanically drops even though nobody who exercises loses value. Your adjustment pipeline handles splits (ratio) and dividends (cash) but has never seen a rights issue. What is the correct adjustment, and how does it differ from a plain split?`,
    thinking: `Unpack what a rights issue actually is economically before adjusting anything. It is neither a pure share-count change (a split gives the SAME shareholders more shares of the SAME company for free) nor a cash payout (a dividend) -- it is existing holders being offered NEW shares below market price, which dilutes per-share value across more shares outstanding over the same enterprise value, while simultaneously giving holders the option to buy in cheap and keep their proportional stake whole. The key number is the theoretical ex-rights price (TERP): the share-count-weighted average of the pre-rights price and the subscription price, because that is literally what happens to the firm's per-share value once new shares get added at the subscription price alongside the old shares at the old price. The adjustment factor -- TERP divided by the pre-rights price -- applies to history before the ex-date exactly like a split factor. But unlike a pure split, "the return was really zero" only holds for a holder who exercises their rights; someone who does neither exercises nor sells them is genuinely diluted, so a backtest assuming universal exercise is a modeling choice, not a certainty, worth flagging explicitly.`,
    answer: `Compute the theoretical ex-rights price (TERP): (old_price times old_shares plus subscription_price times new_shares), divided by (old_shares plus new_shares) -- a share-count-weighted average of the pre-rights price and the subscription price. The adjustment factor is TERP divided by the pre-rights close, applied to history before the ex-date exactly like a split factor. Unlike a plain split, this assumes full exercise by every holder -- a reasonable modeling choice for a passive total-return construction, but a real non-exercising holder is genuinely diluted, and renounceable rights sold to others represent a cash inflow a price-only series still misses entirely.`,
    python: `import pandas as pd

old_price = 100.0
subscription_price = 60.0
ratio_old_to_new = 4        # 1 new share per 4 held

old_shares = ratio_old_to_new
new_shares = 1
terp = (old_price * old_shares + subscription_price * new_shares) / (
    old_shares + new_shares
)
# terp = (100*4 + 60*1) / 5 = 92.0 -- the mechanically fair post-rights price

adj_factor = terp / old_price   # 0.92, same mechanical role as a split factor

# apply exactly like any other corporate action: scale history strictly
# BEFORE the ex-date by adj_factor, same convention as the split-adjustment card
px_adjusted_before_ex = old_price * adj_factor   # == terp by construction

# sanity check: a fully-exercising holder's position value is unchanged
# across the ex-date, net of the cash they paid in for the new shares
value_before = old_shares * old_price
value_after = (
    old_shares * terp + new_shares * terp - new_shares * subscription_price
)
assert abs(value_before - value_after) < 1e-9`,
    trap: `Treating the ex-rights price drop as noise and back-adjusting with the raw observed price ratio instead of the TERP formula -- or worse, ignoring the subscription price entirely and assuming the drop is unexplained. Both the magnitude of the adjustment and the "everyone comes out whole" story depend on the actual subscription price and take-up ratio, not on the size of the observed move alone.`,
    followUp: `A shareholder chooses not to exercise and does not sell the rights either -- they simply lapse. What actually happens to their economic position, and why does that make "rights issues are return-neutral like splits" strictly true only for a hypothetical fully-exercising holder? (They are diluted for real: their shares are now worth TERP instead of the old price, with no offsetting new shares or cash -- a genuine loss versus the pre-announcement value, which is why a total-return index construction's full-exercise assumption is a modeling convenience, not a universal truth.)`,
  },
  {
    id: "qr-cleaning-20260821-bid-ask-bounce",
    module: "cleaning",
    title: "Bid-ask bounce: spurious negative autocorrelation in trade prices",
    difficulty: "core",
    question: `You compute the lag-1 autocorrelation of trade-by-trade price changes for a liquid stock and find it's reliably negative, around -0.3, even over calm periods with no news. A junior researcher gets excited that this looks like a tradeable short-term reversal signal. Should they be?`,
    thinking: `Before crediting the market with a signal, ask what mechanical process could manufacture negative autocorrelation with zero economic content. Every trade prints at either the bid or the ask, and market orders alternate somewhat randomly between hitting the bid (a sell-initiated trade) and lifting the ask (a buy-initiated trade) even when the true underlying value hasn't moved at all -- so consecutive trade prices bounce back and forth across the spread purely from this order-flow alternation, not from any real price change. A trade at the ask followed by a trade at the bid looks like a decline in price, and the next trade back at the ask looks like a reversal -- pure microstructure noise generating exactly the negative-lag-1-autocorrelation signature a genuine reversal strategy would also produce. The width of the spread sets the scale: bid-ask bounce induces autocorrelation approximately equal to minus one quarter under a simple two-state bounce model, and it exists at essentially every liquid, actively quoted name regardless of any information content, which is why real return series are built from MIDPOINT prices rather than raw trade prints whenever the point of the analysis is genuine price discovery.`,
    answer: `No -- that's the bid-ask bounce, not a reversal signal. Trades alternately print near the bid and the ask as buy- and sell-initiated orders arrive, so consecutive trade prices mechanically bounce back and forth across the spread even when the true value hasn't moved, generating negative lag-1 autocorrelation (roughly -0.25 under a simple bounce model) purely as a microstructure artifact present at essentially every liquid name. It vanishes once you compute autocorrelation on the bid-ask MIDPOINT instead of raw trade prices. Any reversal signal built from tick-level trade prices needs this ruled out before it's trusted.`,
    python: `import numpy as np
import pandas as pd

rng = np.random.default_rng(0)
n = 5000
mid = 100.0 + np.cumsum(rng.normal(0, 0.001, n))   # true midpoint: a slow random walk
half_spread = 0.02

# each trade randomly hits the bid or lifts the ask -- NO real price information
side = rng.choice([-1, 1], size=n)                  # -1 = sell at bid, +1 = buy at ask
trade_price = mid + side * half_spread

ret_trade = pd.Series(trade_price).pct_change()
ret_mid = pd.Series(mid).pct_change()

print(round(ret_trade.autocorr(lag=1), 3))   # strongly negative -- pure bounce artifact
print(round(ret_mid.autocorr(lag=1), 3))     # near zero -- the true process has no reversal

# a "reversal signal" built on trade_price would just be re-discovering the
# spread-crossing mechanics, not predicting anything about future value`,
    trap: `Backtesting a tick-level reversal strategy on trade prices, seeing a beautiful Sharpe, and not noticing the strategy's entire edge is being paid the half-spread every time it correctly predicts the bounce -- which nets to roughly zero or negative once you actually cross the spread yourself to trade it, since the "predictable" move IS the spread you'd have to pay to capture it.`,
    followUp: `You switch to midpoint-based returns and the strong negative autocorrelation mostly disappears, but a small negative autocorrelation of about -0.05 remains. What are two genuine, non-bounce explanations worth investigating before assuming that residual is noise? (Order-flow-driven price impact that partially reverts -- a large trade temporarily pushes the midpoint away from fair value and it drifts back -- and stale-quote effects where the midpoint itself lags the true price during fast moves, both real, economically meaningful microstructure phenomena distinct from pure bounce.)`,
  },
  {
    id: "qr-cleaning-20260822-negative-prices-real",
    module: "cleaning",
    title: "When a negative price is real: WTI crude, April 2020",
    difficulty: "core",
    question: `Your bad-tick filter has a rule: any price at or below zero is a data error, mask it. In April 2020 the front-month WTI crude oil futures contract traded as low as -37.63 dollars per barrel. Was your filter right to mask that, and what does the episode teach about hardcoding sign-based sanity checks?`,
    thinking: `Ask what a price actually represents before hardcoding a constraint on it. Equity and most cash prices really cannot go negative -- limited liability floors a share at zero -- so price <= 0 is a safe, near-universal check there. A futures contract's price is different: it is the cost of entering a forward obligation, and a physically-settled contract can, rarely, go negative when the marginal holder would rather pay someone to take delivery than accept it themselves. That is exactly what happened when collapsing COVID demand met nearly-full storage at the Cushing delivery point right before contract expiry -- holders paid buyers to take the obligation off their hands. The lesson is not "never filter negative prices"; equities still deserve that check. It is that a bad-tick filter's assumptions must be justified per asset class and per contract mechanics, not copy-pasted as one universal rule -- and a value corroborated across every vendor, sustained for hours, tied to a known physical story, is evidence of a real event, not noise.`,
    answer: `The filter was wrong for that instrument. Physically-settled commodity futures near expiry can legitimately trade negative when storage is full and someone must pay to avoid taking delivery, which is exactly what happened to WTI in April 2020. A blanket price <= 0 rule is correct for equities, where limited liability floors the price at zero, but that assumption is asset-class-specific, not universal. Corroboration across every vendor and sustained duration, not the sign alone, is what should decide real event versus data error.`,
    python: `import pandas as pd

# per-asset-class sanity rules -- NOT one blanket rule shared everywhere
ASSET_PRICE_FLOORS = {
    "equity": 0.0,          # limited liability: price cannot legitimately hit zero or below
    "futures_physical": None,  # physically-settled contracts can go negative near expiry
    "futures_cash": 0.0,       # cash-settled contracts still shouldn't go negative
}

def flag_bad_price(asset_class: str, price: float) -> bool:
    floor = ASSET_PRICE_FLOORS[asset_class]
    if floor is None:
        return False   # no sign-based check for this class -- corroborate differently
    return price <= floor

# 2020-04-20: WTI front-month settled at -37.63 -- a real, corroborated event
wti_settle = -37.63
print(flag_bad_price("futures_physical", wti_settle))   # False -- not auto-masked

# an equity at -0.01 would still be a near-certain data error
print(flag_bad_price("equity", -0.01))                  # True -- correctly flagged

# corroboration check for the ambiguous cases: does every vendor agree,
# and does it persist rather than instantly revert?
def corroborated(price_by_vendor: dict, min_agree: int = 3) -> bool:
    negatives = sum(1 for p in price_by_vendor.values() if p < 0)
    return negatives >= min_agree`,
    trap: `Hardcoding a single "price must be positive" assertion shared across every instrument type in an ETL pipeline, so the loader for equities and the loader for physically-settled futures inherit the same invalid assumption -- silently deleting the single most information-rich print of the year for anyone whose options or CTA strategy needed to see it.`,
  },
  {
    id: "qr-cleaning-20260823-consolidated-tape-duplicates",
    module: "cleaning",
    title: "Consolidated tape duplicate trades across reporting exchanges",
    difficulty: "warmup",
    question: `You pull US equity trade prints from a consolidated feed (the SIP), and your daily volume totals for a stock come in noticeably higher than the exchange's own reported volume. A teammate suspects duplicate trades. Why would the same trade appear more than once, and why can't you fix it by just calling drop_duplicates() on price, size, and timestamp?`,
    thinking: `A single execution in the US equity market is disseminated to the consolidated tape by the exchange or trade-reporting facility where it happened, and different venues can report trades that print at the same price and size within the same second purely because that price level is genuinely active market-wide -- two real, distinct trades, not one trade counted twice. That's exactly why price plus size plus timestamp-rounded-to-the-second is not a safe dedup key: it cannot tell "the same trade reported twice" apart from "two different trades that happen to look identical," and blindly dropping matches on that key silently deletes real volume, understating turnover and corrupting anything built on trade counts. A trustworthy key needs something that actually identifies the individual execution -- an exchange sequence number or trade ID if the feed carries one, or at minimum the specific reporting facility field plus a much tighter timestamp tolerance (microseconds, not seconds) combined with corroborating that true duplicate reports of one execution are rare and specific to certain reporting scenarios, not a blanket assumption to dedup away.`,
    answer: `Different venues and trade-reporting facilities can each report a real, distinct trade at the same price and size within the same second simply because that price level is actively trading market-wide -- so price, size, and second-level timestamp cannot distinguish a true duplicate report from two genuinely separate executions. Dropping on that key silently deletes real volume. The safer key is an actual execution identifier (exchange sequence number or trade ID) when the feed provides one, or at minimum microsecond-level timestamps plus the reporting-facility field, treating true duplicate reports as a narrow, specific case rather than a blanket rule.`,
    python: `import pandas as pd

trades = pd.DataFrame({
    "ticker": ["XYZ"] * 4,
    "ts": pd.to_datetime([
        "2026-08-23 14:30:01.123456", "2026-08-23 14:30:01.123456",  # true duplicate report
        "2026-08-23 14:30:01.500000", "2026-08-23 14:30:01.500000",  # two REAL distinct trades
    ]),
    "price": [100.05, 100.05, 100.05, 100.05],
    "size": [200, 200, 200, 200],
    "exchange_seq_id": ["A-88213", "A-88213", "B-40021", "C-91177"],  # only the first pair matches
})

# WRONG: dedup on price + size + timestamp -- deletes real volume from
# the two distinct trades that happen to share a price, size, and second
wrong = trades.drop_duplicates(subset=["ticker", "ts", "price", "size"])
print(wrong["size"].sum())   # 400 -- two of the four real 200-share trades vanished

# RIGHT: dedup on the actual execution identifier
right = trades.drop_duplicates(subset=["exchange_seq_id"])
print(right["size"].sum())   # 600 -- only the genuine duplicate report is removed`,
    trap: `Treating "our volume total is higher than the exchange's own number" as proof of duplication and reaching straight for drop_duplicates() on the visible fields, without checking whether the exchange's own reported number even includes the same off-exchange and dark-pool prints the consolidated tape carries -- a volume mismatch can be a scope difference, not a duplication bug, and deduping on the wrong key manufactures a second bug on top of a false diagnosis of the first.`,
  },
  {
    id: "qr-cleaning-20260824-unflagged-split-detection",
    module: "cleaning",
    title: "Detecting an unflagged stock split from raw price and volume",
    difficulty: "hard",
    question: `Your corporate-actions vendor missed a 2-for-1 split for one ticker. The raw price series shows an overnight drop of almost exactly 50%, and volume roughly doubles that same day, with no earnings release or news event around it. How would you programmatically flag this as a probable unflagged split rather than a real crash, and how would you backfill the adjustment?`,
    thinking: `A genuine crash and a split can produce an identical overnight percentage return, so the return alone can't distinguish them -- you need a signal that behaves differently under the two hypotheses. The key economic fact: a split conserves market value (shares outstanding multiplies by the inverse of the price ratio, so price times shares is unchanged) while a real crash destroys value with no change in share count. So check whether shares outstanding or reported volume jumps by roughly the inverse of the price ratio on the same day -- a coincidental doubling of volume alongside a halving of price is a strong split signature a crash rarely produces. Second, split ratios cluster on a small set of canonical values (0.5, 0.667, 0.333, 0.2), so scoring the observed ratio against that set with a tight tolerance filters out coincidences. Combine both signals into a confidence flag rather than an automatic correction, because misclassifying a real crash as a split and dividing it away is a far worse failure than leaving one split unflagged for a day.`,
    answer: `Distinguish them by whether the drop is consistent with conserved market value: a real split leaves price times shares-outstanding roughly unchanged and shares-outstanding (or reported volume, as a proxy) jumps by close to the inverse of the price ratio that same day, while a genuine crash destroys value with no share-count change. Score the observed ratio against canonical split ratios (0.5, 0.667, 0.333, 0.2, with a tight tolerance) and require the volume/shares co-movement before flagging. Treat a match as a low-confidence flag for human confirmation, not an automatic adjustment -- silently dividing away a real crash as a phantom split is worse than one temporarily unflagged split.`,
    python: `import pandas as pd
import numpy as np

CANONICAL_RATIOS = np.array([0.5, 2 / 3, 1 / 3, 0.2, 0.25, 4])  # common split/reverse-split ratios

def flag_unflagged_split(prices: pd.Series, volume: pd.Series, tol: float = 0.03) -> pd.Series:
    ret = prices.pct_change() + 1.0                 # overnight price ratio (new / old)
    vol_ratio = volume / volume.shift(1)             # same-day volume jump

    # a split's price ratio and volume ratio should be near-perfect inverses
    # of each other (halve the price, double the shares trading)
    implied_ratio_match = (ret * vol_ratio - 1.0).abs() < tol

    # AND the price ratio itself should sit near a canonical split fraction,
    # not just any coincidental halving
    nearest_canonical_gap = ret.apply(lambda r: np.min(np.abs(CANONICAL_RATIOS - r)))
    canonical_match = nearest_canonical_gap < tol

    return implied_ratio_match & canonical_match     # both must hold -- low false-positive flag

# a flagged row is a candidate for human review, never an auto-adjustment:
# flip a real crash into a "split" and you divide away a genuine loss`,
    trap: `Auto-applying the inferred split ratio to production data without human review. A real -50% crash that happens to coincide with elevated volume would match the same heuristic and get silently divided away, erasing an actual loss from the adjusted price history -- a much more damaging bug than one temporarily unflagged split.`,
    followUp: `The vendor eventually posts the correct split three days later, with the correct ratio and ex-date. Your heuristic already backfilled an adjustment with a slightly different inferred ratio. What reconciliation step prevents the two adjustments from double-applying to history?`,
  },
  {
    id: "qr-cleaning-20260825-premarket-afterhours-close",
    module: "cleaning",
    title: "Pre-market and after-hours prints polluting the 'daily close'",
    difficulty: "core",
    question: `Your vendor's daily bar file defines "close" as the last trade price of the day. For a handful of illiquid small-caps, that close is sometimes wildly different from the 4:00pm regular-session print -- because the last trade of the day was a single after-hours execution at a stale, thinly-traded price. How do you detect and fix this before it corrupts your returns series?`,
    thinking: `Separate two different definitions of "close" that vendors conflate: the official closing auction / last regular-session print at 4:00pm, versus literally the last trade timestamped anywhere in the 24-hour window, which for a name that barely trades can be an after-hours execution hours later at a price nobody else agreed to. For liquid large-caps these coincide almost always, so the bug hides in exactly the names you're least likely to spot-check. The detection signal is timestamp, not price: if you have trade-level or tick data, filter to the official regular-session window (typically 9:30am-4:00pm local exchange time) before taking the last price, rather than trusting a pre-aggregated "close" field blindly. If you only have the vendor's daily bar with no timestamp, a proxy check is comparing that close against the day's VWAP or the next day's open -- a lone after-hours print tends to be a large, isolated deviation with little volume around it. Whichever fix you pick, the point is the same: define "close" by session boundary, not by "whatever traded last."`,
    answer: `The vendor's "close" is contaminated because it means "last trade of the calendar day," not "last trade of the regular session" -- for illiquid names those differ, and a stale after-hours print gets recorded as the official close. Fix it by filtering trade-level data to the regular session window (e.g. 9:30am-4:00pm exchange local time) before taking the last price, rather than trusting a pre-aggregated close field. Without tick data, flag suspicious closes by comparing against same-day VWAP or surrounding volume -- an isolated, low-volume print far from the day's traded range is the signature to catch.`,
    python: `import pandas as pd

trades = pd.DataFrame({
    "ts": pd.to_datetime([
        "2026-08-25 15:58:00", "2026-08-25 16:00:00", "2026-08-25 19:47:00",
    ]),
    "price": [12.40, 12.38, 9.10],   # the 19:47 print is a lone after-hours execution
    "volume": [500, 1200, 25],
})

session_start = trades["ts"].dt.normalize() + pd.Timedelta(hours=9, minutes=30)
session_end = trades["ts"].dt.normalize() + pd.Timedelta(hours=16)
in_session = trades["ts"].between(session_start, session_end)

# WRONG: last trade of the calendar day, after-hours included
close_wrong = trades.sort_values("ts")["price"].iloc[-1]   # 9.10 -- a phantom close

# RIGHT: last trade within the regular session only
close_right = trades.loc[in_session].sort_values("ts")["price"].iloc[-1]   # 12.38

# no tick data available: flag by comparing the vendor close against
# a volume-weighted price and the surrounding day's range
vwap = (trades["price"] * trades["volume"]).sum() / trades["volume"].sum()
suspect = abs(close_wrong / vwap - 1) > 0.15   # a large, isolated deviation`,
    trap: `Trusting a vendor's daily bar file's "close" field as always meaning the 4:00pm print, purely because that's true for the liquid names you happen to check first. The bug concentrates in exactly the illiquid, low-volume names least likely to get a manual spot check, and it corrupts every return computed off that day's close.`,
  },
  {
    id: "qr-cleaning-20260826-currency-redenomination",
    module: "cleaning",
    title: "Currency redenomination: adjusting a price series when old units become new units",
    difficulty: "hard",
    question: `A frontier-market stock in your history was quoted in an old currency that then redenominated -- the government dropped some zeros and issued a new currency unit (say, 1000 old units become 1 new unit) on a specific date. Your raw price feed just switches units on that date with no flag. What does this do to a naive returns calculation, and how do you detect and fix it?`,
    thinking: `Recognize this is structurally identical to a stock split -- the underlying economic value of one share is continuous across the redenomination date, only the counting unit changes -- so a naive pct_change() computed straight through that date registers something like a 99.9% single-day crash, exactly the way an unflagged stock split would. The detection signature is the same too: an implausible single-day return magnitude with no matching news or corporate-action flag, and often a suspiciously round conversion ratio (1000:1, 10000:1) if you compute the ratio of price levels immediately before and after the jump. The fix is also structurally a split adjustment: back-adjust every price before the change date by dividing by the redenomination ratio, so the return series is continuous across the boundary. The genuine difference from a corporate split: because this is a government monetary action rather than a corporate one, there's no shares-outstanding series to cross-check against -- the price discontinuity itself is often your only detection signal.`,
    answer: `It behaves exactly like an unflagged stock split -- treat the currency's old-to-new ratio as a split factor. Detect it the same way you'd detect an unflagged split: an implausible single-day return (often -99%+) with a suspiciously round before/after price ratio (1000:1, 10000:1) and no volume anomaly you'd expect from a real crash. Fix it by back-adjusting every price before the redenomination date by dividing by that ratio, so the series is continuous in economic value across the boundary. The key difference from a corporate split: there's no shares-outstanding series to cross-check against, since the redenomination is a government monetary action, not a corporate one -- the price discontinuity itself is often your only detection signal.`,
    python: `import pandas as pd
import numpy as np

prices = pd.Series(
    [1250.0, 1275.0, 1260.0, 1.28, 1.31, 1.29],  # 1000x drop at index 3
    index=pd.date_range("2020-01-01", periods=6),
)

naive_returns = prices.pct_change()
print(naive_returns.round(4))   # -0.999 on the redenomination day -- looks like a crash

# detect: a price ratio suspiciously close to a round power of ten
ratio = prices / prices.shift(1)
candidates = [1e-1, 1e-2, 1e-3, 1e-4]
break_pos = next(
    (i for i, r in enumerate(ratio) if not np.isnan(r) and any(abs(r - c) / c < 0.02 for c in candidates)),
    None,
)

# fix: divide every price before the break by the redenomination factor --
# identical mechanics to a stock-split adjustment
if break_pos is not None:
    factor = round(1 / ratio.iloc[break_pos], -int(np.floor(np.log10(1 / ratio.iloc[break_pos]))))
    adjusted = prices.copy()
    adjusted.iloc[:break_pos] = adjusted.iloc[:break_pos] / factor
    print(adjusted.pct_change().round(4))  # continuous returns across the boundary`,
    trap: `Treating this as a data error to drop or forward-fill through, rather than a legitimate value-preserving unit change that needs a split-style adjustment -- dropping the observation loses real trading days, and forward-filling the pre-change price into post-change units silently corrupts everything after it by three orders of magnitude.`,
    followUp: `The same frontier market later redenominates AGAIN with a smaller, less round ratio (say, 3.5:1, as part of a currency peg adjustment). Does your round-ratio detection heuristic still work, and what would you use instead?`,
  },
  {
    id: "qr-cleaning-20260827-ipo-seasoning",
    module: "cleaning",
    title: "IPO seasoning: excluding the first weeks of noisy post-listing price discovery",
    difficulty: "core",
    question: `A stock IPO'd three weeks ago and already shows up in your universe with wild daily swings -- +18%, -12%, +9% in its first five sessions -- before settling into normal volatility. Your vol-scaling feature is getting badly distorted by these names. What's happening, and how do you handle newly listed stocks in your pipeline?`,
    thinking: `Price discovery is genuinely noisier right after listing rather than this being bad data. A newly IPO'd stock has no trading history to anchor expectations, an unstable float in the first days before insider lockups fully bind, disproportionate participation from momentum flow chasing the listing, and market makers who haven't yet calibrated their own risk models to the name -- all of which mechanically inflate realized volatility for a period that has nothing to do with the stock's steady-state risk. This isn't a data error to clean, it's a real but transient regime, so the fix is a seasoning rule: exclude a name from any feature that assumes a stable vol or return regime (rolling vol, cross-sectional z-scores, momentum lookbacks) for a fixed window post-IPO -- commonly 20 to 60 trading days depending on the desk -- rather than trying to statistically detect and downweight the noise name by name, which is fragile and adds a tunable parameter with no principled way to set it per name.`,
    answer: `Post-IPO price discovery is genuinely more volatile -- no trading history to anchor around, an unsettled float before lockups bind, momentum flow chasing the listing -- so it's a real transient regime, not a data error. Apply a seasoning rule: exclude newly listed names from any feature that assumes a stable vol or return regime (rolling vol, momentum, cross-sectional z-scores) for a fixed window, typically 20-60 trading days post-listing, rather than trying to detect and downweight the noise per name.`,
    python: `import pandas as pd

# panel indexed by (date, ticker); this name IPO'd on 2026-08-01
prices = pd.DataFrame({
    "date": pd.to_datetime(["2026-08-01", "2026-08-15", "2026-08-27"]),
    "ticker": ["NEWCO", "NEWCO", "NEWCO"],
    "close": [42.0, 51.0, 47.5],
})

SEASONING_DAYS = 20  # trading days -- use a calendar-aware trading-day count in practice

# trading-day age since listing, per name (1-indexed rank of each row within its ticker)
prices["days_since_ipo"] = (
    prices.groupby("ticker")["date"].rank(method="first").astype(int) - 1
)

# mask features that assume a stable regime; keep raw prices intact so
# the name still appears in the panel once it's seasoned
prices["is_seasoned"] = prices["days_since_ipo"] >= SEASONING_DAYS
print(prices[["date", "days_since_ipo", "is_seasoned"]])`,
    trap: `Applying the seasoning window using CALENDAR days since listing instead of trading days, which under- or over-excludes depending on how many market holidays fall in the window -- and forgetting that a name delisted or acquired shortly after IPO may never accumulate enough seasoned history to ever enter the universe, quietly shrinking your effective universe if the exclusion isn't monitored.`,
    followUp: `A momentum feature needs 252 trading days of history to compute 12-1 momentum. A stock IPO'd 100 days ago. Do you backfill its pre-IPO history somehow, drop it from the momentum feature entirely, or something else -- and what does each choice imply for survivorship in the universe you're scoring?`,
  },
];
