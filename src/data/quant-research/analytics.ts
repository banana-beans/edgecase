import type { QRQuestion } from "./index";

// M9 -- Performance Analytics: drawdowns, risk-adjusted ratios and their
// failure modes, attribution, exposures, and reading a tearsheet.
export const analyticsQuestions: QRQuestion[] = [
  {
    id: "qr-analytics-01-sharpe-annualization",
    module: "analytics",
    title: "Sharpe and the sqrt(252)",
    difficulty: "warmup",
    question: `Define the Sharpe ratio precisely, compute it from daily returns, and explain where the square root of 252 comes from - what assumption is it smuggling in?`,
    thinking: `Get the definition exact before the formula: Sharpe is the mean EXCESS return - above the risk-free rate, or above zero for a self-funding long-short book - divided by the standard deviation of returns. It answers one question: how much reward per unit of total volatility. Annualization is where the assumption hides. Over 252 trading days, the mean return scales linearly with time - 252 times the daily mean. The variance of a SUM of independent returns also scales linearly, so the standard deviation scales with the square root of 252. Ratio of the two: daily Sharpe times root 252. The smuggled assumption is independence - zero autocorrelation between days. If returns are positively autocorrelated (trend-following P&L, smoothed marks on illiquid books), the true annual volatility is larger than root-252 scaling claims, and the annualized Sharpe is overstated. Always say "assuming i.i.d. daily returns" out loud.`,
    answer: `Sharpe is mean excess return over the standard deviation of returns - reward per unit of volatility. From daily data: daily mean over daily standard deviation, times the square root of 252, because the mean of a sum of independent daily returns grows like T while its standard deviation grows like root T. The hidden assumption is zero autocorrelation; positively autocorrelated returns make root-252 annualization overstate the true Sharpe.`,
    python: `import numpy as np
import pandas as pd
# net: daily net returns of the strategy (excess of funding for L/S)

sr_daily = net.mean() / net.std(ddof=1)     # ddof=1: sample std, the default
sr_ann = sr_daily * np.sqrt(252)            # valid ONLY under iid daily returns

# why sqrt: over T days, mean scales ~ T, std of the SUM scales ~ sqrt(T)
# so their ratio picks up T / sqrt(T) = sqrt(T)

# for a cash-funded long-only book, subtract the risk-free rate first:
# excess = net - rf_daily; otherwise you reward holding T-bills
print(round(sr_ann, 2))

# always report the sample size next to the number -- a Sharpe without
# its track length is not information (see the standard-error card).`,
    trap: `Annualizing by multiplying by 252 instead of root 252 - or annualizing mean and standard deviation separately with the same factor so it cancels wrong. Also quoting Sharpe on raw returns for a levered cash portfolio: without subtracting funding, leverage manufactures Sharpe from the risk-free rate.`,
    followUp: `Your strategy only trades 60 days a year and is flat otherwise. Do you annualize with 252 or 60, and what does each choice implicitly claim about the flat days?`,
  },
  {
    id: "qr-analytics-02-max-drawdown",
    module: "analytics",
    title: "Vectorized max drawdown",
    difficulty: "warmup",
    question: `Compute maximum drawdown from a daily return series without a loop, and tell me what a drawdown actually measures that volatility does not.`,
    thinking: `Define it from the investor's seat: drawdown at time t is how far the equity curve sits below its highest point so far - the loss experienced by the unluckiest investor, who bought at the peak. Max drawdown is the worst such loss over the sample. The vectorization insight is that "highest point so far" is a running maximum, and pandas gives you that in one call: cummax. Divide equity by its cummax, subtract one, take the minimum - three lines, no loop. What it captures that volatility cannot: the ORDER of returns. Shuffle a return series and its volatility and Sharpe are unchanged, but the drawdown changes completely, because drawdown punishes consecutive losses and slow bleeds. That is why it pairs with Sharpe on every tearsheet: one measures noise per period, the other measures the worst realized sequence - which is what triggers redemptions and risk cuts.`,
    answer: `Build the equity curve by compounding, take the running peak with cummax, and drawdown is equity over peak minus one; max drawdown is its minimum. It measures path: the deepest peak-to-trough loss anyone could have experienced. Unlike volatility it is order-sensitive - shuffling returns preserves Sharpe but destroys the drawdown profile - so it captures loss clustering, which is what actually ends strategies and client relationships.`,
    python: `import pandas as pd
# net: daily net returns
equity = (1.0 + net.fillna(0.0)).cumprod()   # compounded equity curve

peak = equity.cummax()                       # running all-time high: vectorized
dd = equity / peak - 1.0                     # depth below the prior peak, <= 0
max_dd = dd.min()                            # the single worst trough

trough = dd.idxmin()                         # when the worst trough happened
peak_date = equity.loc[:trough].idxmax()     # the peak it fell from
print(round(max_dd, 4), peak_date, trough)

# recovery time is the other half of the story: days from peak back to
# a new high. two strategies with -20% max DD are NOT equivalent if one
# recovered in 3 months and the other took 3 years.`,
    trap: `Computing drawdown on cumulative SUMS of returns rather than the compounded curve - for long samples with big moves it materially misstates the depth. And reporting depth without duration: the time underwater is often the more decision-relevant number.`,
    followUp: `Your live drawdown just hit the backtest's historical max. Argue both sides in one minute: why this is expected behavior, and why it might be evidence the edge is gone.`,
  },
  {
    id: "qr-analytics-03-hit-rate-payoff",
    module: "analytics",
    title: "Hit rate vs payoff ratio",
    difficulty: "warmup",
    question: `A PM says a 48 percent hit rate makes a strategy a coin flip that loses to costs. The strategy is profitable. Reconcile that - what two numbers together determine expectancy?`,
    thinking: `Separate frequency from magnitude, because P&L is their product. Hit rate is the fraction of periods (or trades) that make money. The payoff ratio is the average size of a win divided by the average size of a loss. Expectancy per period is hit rate times average win, minus loss rate times average loss - so a strategy winning 48 percent of the time with wins 1.3 times the size of losses is solidly positive, while a 60 percent hit rate paired with small wins and occasional huge losses can bleed to death. Whole strategy families live at each pole: trend-following wins maybe 35 to 40 percent of periods with big asymmetric wins; short-volatility and carry win most periods and occasionally give years back in a week. The interview point is that neither number alone means anything, and which pole you sit on determines your drawdown shape and how psychologically hard the strategy is to hold.`,
    answer: `Hit rate without payoff is meaningless. Expectancy is hit rate times average win minus loss rate times average loss - at 48 percent hit rate you are profitable whenever the payoff ratio beats roughly 52 over 48, about 1.08, before costs. Trend followers profit at 35 to 40 percent hit rates via large asymmetric wins; short-vol strategies win 90 percent of periods and can still carry negative expectancy. Always quote the pair, plus costs.`,
    python: `import pandas as pd
# net: daily net returns (works the same on per-trade P&L)
wins = net[net > 0]
losses = net[net < 0]

hit = (net > 0).mean()                       # fraction of winning days
avg_win = wins.mean()
avg_loss = -losses.mean()                    # report as a positive size
payoff = avg_win / avg_loss                  # the other half of the story

# expectancy per period -- the only number that decides profitability
expectancy = hit * avg_win - (1.0 - hit) * avg_loss
print(round(hit, 3), round(payoff, 2), round(expectancy * 1e4, 2))  # bps/day

# breakeven frontier: profitable iff payoff > (1 - hit) / hit
# hit 48% -> need payoff > 1.083; hit 40% -> need > 1.5
print((1.0 - hit) / hit)`,
    trap: `Optimizing hit rate because it feels like accuracy. Any strategy can buy hit rate by taking profits early and letting losers run - improving the win percentage while destroying the payoff ratio and the expectancy. Hit rate is a shape parameter, not an objective.`,
    followUp: `Two strategies have identical Sharpe: one wins 65 percent of days with occasional large losses, the other wins 40 percent with occasional large gains. Which is harder to risk-manage and why - think about position sizing after losses.`,
  },
  {
    id: "qr-analytics-04-sharpe-standard-error",
    module: "analytics",
    title: "Six months of Sharpe 2",
    difficulty: "core",
    question: `A pod shows you six months of live returns with an annualized Sharpe of 2 and wants an allocation. Statistically, what do you actually know about their skill?`,
    thinking: `Treat the measured Sharpe as an estimate with a sampling distribution, because that is all it is. For approximately normal returns, the standard error of the Sharpe estimated from T periods is roughly the square root of (1 plus half the squared Sharpe) over T. Work in daily units: six months is about 126 days, daily Sharpe is 2 over root 252, about 0.126, and its squared term is negligible. The standard error of the ANNUALIZED Sharpe is then roughly root of 252 over 126 - about 1.42. So the 95 percent confidence interval is 2 plus or minus 2.8: from roughly minus 0.8 to plus 4.8. The data cannot distinguish a genuinely great strategy from zero-skill luck. Invert it for the punchline: to get the standard error itself down to 0.5 you need about four years; to reject zero skill at conventional levels for a true Sharpe 1 manager, several years. Six months is marketing, not measurement.`,
    answer: `Almost nothing. The standard error of an annualized Sharpe is roughly root of 252 over the number of daily observations - with 126 days that is about 1.4, so Sharpe 2 has a 95 percent interval of roughly minus 0.8 to plus 4.8. Zero skill is comfortably inside it. You need about four years of daily data just to pin Sharpe down to plus or minus one at 95 percent. Allocate on process and risk if you must, but not on this number.`,
    python: `import numpy as np
T_days = 126                          # six months of daily observations
sr_ann = 2.0

sr_d = sr_ann / np.sqrt(252)          # work in per-period (daily) units
# Lo (2002) iid approximation: SE(sr_d) = sqrt((1 + sr_d**2 / 2) / T)
se_d = np.sqrt((1.0 + 0.5 * sr_d**2) / T_days)
se_ann = se_d * np.sqrt(252)          # scale the SE like the estimate
print(round(se_ann, 2))               # ~1.42

lo = sr_ann - 1.96 * se_ann           # 95% confidence interval
hi = sr_ann + 1.96 * se_ann
print(round(lo, 2), round(hi, 2))     # ~(-0.8, +4.8): zero is inside

# years of daily data needed to get SE down to a target:
for target in [1.0, 0.5, 0.25]:
    need_days = 252.0 / target**2     # from SE_ann ~ sqrt(252 / T)
    print(target, round(need_days / 252, 1), "years")`,
    trap: `Doubling down with "but the t-stat is significant" using the wrong scaling, or ignoring that this pod is one of many you are shown - selection across pods makes the effective significance far weaker than even the wide interval suggests. Survivors get meetings; the standard error math is the FLOOR of your skepticism.`,
    followUp: `Their returns also have monthly autocorrelation of 0.3 - smooth, steady gains. Does that make the six-month Sharpe more credible or less, and what does it do to the standard error you just computed?`,
  },
  {
    id: "qr-analytics-05-sortino",
    module: "analytics",
    title: "Sortino and asymmetric returns",
    difficulty: "core",
    question: `When does Sharpe actively mislead, what does Sortino change, and give me a strategy type where BOTH numbers look great right up until the blowup.`,
    thinking: `Locate Sharpe's blind spot: standard deviation charges symmetrically for upside and downside dispersion. A strategy with frequent large gains and controlled losses gets penalized for its best feature. Sortino replaces the denominator with downside deviation - the root mean square of only the below-target returns, computed over ALL periods (zeros for good ones) - so upside dispersion is free. That is the right lens for positively skewed strategies like trend-following. Now invert to find where both fail: negatively skewed strategies - short volatility, carry, selling tail insurance - deliver years of small steady gains with the loss sitting OUT OF SAMPLE. In-sample there are few or no bad returns, so Sharpe looks great and Sortino, seeing an even emptier downside tail, looks even better. Neither ratio can price a risk that has not happened yet in the data. The tell is the return SHAPE: high win rate, tiny dispersion, known crash mechanism - assume the skew is lurking.`,
    answer: `Sharpe penalizes upside volatility, so it undersells positively skewed strategies - Sortino fixes that by dividing by downside deviation, the RMS of below-target returns across all periods. But for negatively skewed strategies - short vol, carry - the crash is absent from the sample, so both ratios flatter: Sortino even more than Sharpe, since the observed downside is nearly empty. Sample statistics cannot price unrealized tails; check skew, kurtosis, and the crash mechanism directly.`,
    python: `import numpy as np
import pandas as pd
# net: daily net returns; target: minimum acceptable return per day
target = 0.0

# downside deviation: RMS of shortfalls over ALL days -- good days
# contribute zeros, they are NOT dropped from the denominator count
shortfall = np.minimum(net - target, 0.0)
dd_dev = np.sqrt((shortfall**2).mean()) * np.sqrt(252)

sortino = (net.mean() - target) * 252 / dd_dev
sharpe = net.mean() / net.std(ddof=1) * np.sqrt(252)
print(round(sharpe, 2), round(sortino, 2))

# the shape diagnostics that catch what both ratios miss:
print(round(net.skew(), 2), round(net.kurt(), 2))
# steady gains + negative skew + fat tails = insurance-selling profile:
# the denominator is quiet only because the claim has not arrived yet.`,
    trap: `Computing downside deviation as the standard deviation of only the losing days - dropping the winning days from the count. That both shrinks the denominator wrongly and measures dispersion around the losers' own mean. The definition is root mean square of shortfalls with all periods in the denominator.`,
    followUp: `A fund markets itself on Sortino above 3 with a 94 percent monthly win rate. Write down the three questions you ask before believing the number - and what position would explain all three answers at once?`,
  },
  {
    id: "qr-analytics-06-calmar",
    module: "analytics",
    title: "Calmar and its length problem",
    difficulty: "core",
    question: `Define the Calmar ratio, and explain why comparing the Calmar of a 3-year track record against a 15-year one is unfair - in whose favor?`,
    thinking: `Definition first: annualized return divided by the absolute maximum drawdown, usually on the trailing three years. It speaks the language of allocators - return per unit of worst historical pain. Now examine the denominator's statistics, because that is where the unfairness lives. Annualized return is roughly length-independent in expectation, but maximum drawdown is an extreme statistic of the PATH: the longer you observe, the more chances the equity curve has to print a new worst sequence, so expected max drawdown GROWS with track length even when the return distribution never changes. A 15-year record has had three times... five times the opportunities to realize a deep trough than a 3-year one. So Calmar mechanically flatters short records - the young fund's shallow drawdown is substantially a small-sample artifact. Fair comparison requires equal windows (hence the trailing-3-year convention) or simulating the drawdown distribution at matched horizons.`,
    answer: `Calmar is annualized return over absolute max drawdown, conventionally on trailing three years. It is unfair to the long record: expected maximum drawdown grows with observation length - more path, more chances for a worst sequence - while annualized return does not, so short records get systematically inflated Calmars from a small-sample denominator. Compare only on matched windows, or simulate the max-drawdown distribution at a common horizon.`,
    python: `import numpy as np
# demonstrate: same iid daily distribution, expected max DD grows with T
rng = np.random.default_rng(0)
mu, sig, n_sims = 0.0005, 0.01, 20000       # ~Sharpe 0.8 process, unchanged

for T in [756, 3780]:                       # 3 years vs 15 years of days
    r = rng.normal(mu, sig, size=(n_sims, T))
    eq = np.cumprod(1.0 + r, axis=1)
    peak = np.maximum.accumulate(eq, axis=1)    # running max along time
    max_dd = (eq / peak - 1.0).min(axis=1)      # worst trough per path
    ann_ret = eq[:, -1] ** (252.0 / T) - 1.0
    calmar = ann_ret / np.abs(max_dd)
    print(T // 252, "yrs | med maxDD",
          round(np.median(max_dd), 3),
          "| med Calmar", round(np.median(calmar), 2))
# same process, but 15 years shows a much deeper median max drawdown
# and therefore a much lower Calmar. the ratio measures track LENGTH
# as much as quality unless windows are matched.`,
    trap: `Ranking managers on lifetime Calmar. It systematically promotes short, lucky records over long, honest ones - the opposite of what an allocator wants the screen to do. The same length-dependence infects any drawdown-based statistic, including "worst month" and time-under-water.`,
    followUp: `An allocator caps acceptable max drawdown at 15 percent. Using the simulation above, how would you translate that into the maximum vol and minimum Sharpe a strategy needs at a 10-year horizon?`,
  },
  {
    id: "qr-analytics-07-rolling-performance",
    module: "analytics",
    title: "Rolling Sharpe honestly",
    difficulty: "core",
    question: `You plot a 63-day rolling Sharpe and it swings between minus 1 and plus 4. What is that plot actually good for, how do you pick the window, and what statistical mistake do people make with it?`,
    thinking: `Ask what a 63-day Sharpe estimate even is before interpreting swings: from the standard-error card, a Sharpe from 63 days has an annualized standard error near 2 - so oscillation between minus 1 and plus 4 is roughly what a CONSTANT true Sharpe of 1.5 must produce. The plot's legitimate uses are structural, not statistical: seeing whether performance is spread across the sample or concentrated in one burst, spotting regime breaks, and catching decay after deployment. Window choice is the usual bias-variance dial: short windows respond to change but are dominated by noise; long windows are stable but lag exactly the regime shifts you wanted to see. Use two windows - a fast one to notice, a slow one to believe. The statistical mistake: treating consecutive rolling values as independent evidence. Adjacent 63-day windows share 62 days; the series is mechanically, massively autocorrelated, so "ten straight rising months of rolling Sharpe" is mostly one overlapping fact repeated.`,
    answer: `It is a structure detector, not an estimator: it shows whether P&L is spread or concentrated, and flags decay and regime breaks. The swings you describe are consistent with a constant true Sharpe near 1.5, since a 63-day estimate carries a standard error around 2. Pick two windows - fast to detect, slow to confirm. The classic error is reading overlapping windows as independent observations: adjacent windows share 62 of 63 days, so trends in the plot vastly overstate evidence.`,
    python: `import numpy as np
import pandas as pd
# net: daily net returns
for w in [63, 252]:                          # fast window + slow window
    roll = (net.rolling(w).mean() / net.rolling(w).std()) * np.sqrt(252)
    # error band: SE of an annualized sharpe from w days ~ sqrt(252 / w)
    se = np.sqrt(252.0 / w)
    print(w, "last:", round(roll.iloc[-1], 2), "SE ~", round(se, 2))
# 63d: SE ~ 2.0 -- swings of +/- 2 around truth are EXPECTED noise
# 252d: SE ~ 1.0 -- still wide; only sustained shifts mean anything

# overlap warning: consecutive 63d windows share 62 days, so the
# rolling series is ~perfectly autocorrelated by construction --
# never t-test a trend in it, and never count its points as evidence.
# for honest change detection, compare NON-overlapping blocks:
blocks = net.groupby(np.arange(len(net)) // 63).mean()  # independent-ish`,
    trap: `Reacting to the fast window: cutting a strategy after one bad rolling quarter is, statistically, firing a fair coin for two tails. Given the standard error, most rolling-Sharpe "signals" at short windows are noise, and the reaction itself adds a timing cost the tearsheet never shows.`,
    followUp: `Design the actual decision rule: after how many months below what rolling-Sharpe threshold would you cut allocation, and how would you backtest the RULE itself to make sure it beats doing nothing?`,
  },
  {
    id: "qr-analytics-08-sector-attribution",
    module: "analytics",
    title: "P&L attribution by sector",
    difficulty: "core",
    question: `The PM asks: of last quarter's 4 percent return, how much came from each sector? Show me the computation and one thing that must be true for the pieces to be trusted.`,
    thinking: `Attribution is bookkeeping before it is statistics, so get the identity right: daily portfolio return is the sum over names of lagged weight times return, and that sum can be regrouped along any partition - sector, country, long side versus short side - because addition is associative. Per-name contribution is lagged weight times return; sector contribution is the sum of its members' contributions; and everything reconciles to the total by construction. The thing that must be true: it must actually reconcile. Sum every sector's attributed P&L and compare to the reported total - if they differ, you have unassigned names, a stale sector map, or costs sitting outside the partition, and every number on the page is suspect. Two subtleties: attribute NET of allocated costs or state clearly you are attributing gross; and use point-in-time sector membership, because classifications change and reclassified winners silently migrate history between sectors.`,
    answer: `Per-name daily contribution is lagged weight times return; group those by sector and sum over the quarter - the pieces reconcile to total return by construction, which is also the mandatory check: attributed pieces plus costs must equal the reported number to the basis point. Use point-in-time sector maps, and decide explicitly whether costs are allocated or shown as their own line. If it does not reconcile, nothing on the page is trustworthy.`,
    python: `import pandas as pd
# weights, rets: dates x stocks; sector: Series stock -> sector label
pos = weights.shift(1)                       # the position that EARNED the day
contrib = pos * rets                         # per-name daily contribution

# pandas 2.x idiom: transpose, group columns by sector, transpose back
by_sector = contrib.T.groupby(sector).sum().T     # dates x sectors

q = by_sector.loc["2026-01-01":"2026-03-31"]      # the quarter in question
sector_pnl = q.sum().sort_values()                # additive over days
print(sector_pnl)

# THE reconciliation check -- non-negotiable before showing anyone:
total_from_sectors = sector_pnl.sum()
total_reported = contrib.loc[q.index].sum().sum()
assert abs(total_from_sectors - total_reported) < 1e-10
# note: additive daily contributions ignore compounding across days;
# fine for a quarter at daily granularity, disclose for multi-year.`,
    trap: `Using today's sector classification for the whole history. Reclassifications are not random - fast-growing winners get moved into glamour sectors - so a current-map attribution quietly rewrites which sector "earned" the past. Same discipline as any point-in-time join.`,
    followUp: `Sector attribution says tech longs made all the money. The PM asks the sharper question: was that stock PICKING within tech, or just being OVERWEIGHT tech in a tech rally? What decomposition separates allocation from selection?`,
  },
  {
    id: "qr-analytics-09-factor-decomposition",
    module: "analytics",
    title: "Factor exposure decomposition",
    difficulty: "core",
    question: `Your market-neutral fund returned 12 percent. How do you determine how much was true alpha versus riding factors like momentum or value - and what are the two ways to do it?`,
    thinking: `The question is whether the P&L was compensation for exposures anyone can buy cheaply. Two roads. Returns-based: regress your daily returns on factor return series - market, size, value, momentum; the betas are your average exposures, beta times factor return is the P&L explained by each factor, and the intercept is alpha, the part no listed factor explains. It needs only your return series, but it assumes exposures were constant and struggles to catch factor TIMING. Holdings-based: each day, multiply your actual positions by each stock's factor loadings to get daily portfolio exposures, then exposure times factor return, summed, is factor P&L day by day - precise and time-varying, but it requires a risk model and full position history. Run both when you can: returns-based as the cheap outside view, holdings-based as the engineering truth. A 12 percent year that is 9 percent momentum beta deserves a very different fee than 12 percent of intercept.`,
    answer: `Returns-based: regress daily strategy returns on factor returns; betas are average exposures, beta times factor return is factor-explained P&L, the intercept is alpha - cheap, but assumes static exposures. Holdings-based: positions times per-stock factor loadings give exact daily exposures, and exposure times factor return gives factor P&L including timing effects - precise, needs a risk model. If most of the 12 percent is factor-explained, it was cheap beta wearing an alpha fee.`,
    python: `import numpy as np
import pandas as pd
# strat: daily strategy returns; factors: dates x K daily factor returns
y = strat.to_numpy()
X = factors.to_numpy()
X1 = np.column_stack([np.ones(len(X)), X])   # prepend intercept column

beta, _, _, _ = np.linalg.lstsq(X1, y, rcond=None)
alpha_daily, loadings = beta[0], beta[1:]

explained = X * loadings                      # daily P&L credited to each factor
factor_pnl = pd.DataFrame(explained, index=factors.index,
                          columns=factors.columns).sum()
resid = y - X1 @ beta                         # residual: noise around alpha
r2 = 1.0 - resid.var() / y.var()              # share of variance factors explain

print(round(alpha_daily * 252, 4))            # annualized alpha (intercept)
print(factor_pnl.round(4))                    # per-factor P&L over the sample
print(round(r2, 2))
# t-stat the alpha before celebrating: alpha SE shrinks with sqrt(T),
# and a market-neutral fund with high R2 to momentum is a momentum fund.`,
    trap: `Reporting the regression alpha without its standard error. With one year of data the intercept's confidence interval is usually wide enough to contain zero even for genuinely good funds - and always ask how many factor sets were tried before this one made alpha look biggest.`,
    followUp: `Returns-based shows zero momentum beta, holdings-based shows large momentum exposure that flips sign mid-year. Reconcile the two - what is the fund actually doing, and which report caught it?`,
  },
  {
    id: "qr-analytics-10-tearsheet",
    module: "analytics",
    title: "Tearsheet essentials",
    difficulty: "core",
    question: `You get one page to convince a skeptical risk committee about a strategy. What goes on the tearsheet, and what is each panel there to catch?`,
    thinking: `Design it as a checklist of ways strategies lie, one panel per lie. Log-scale equity curve with drawdown shading: is growth steady or one lucky epoch - linear scale hides early performance and flatters recent compounding. Headline stats with track length and standard errors: Sharpe, vol, max drawdown WITH duration, hit rate and payoff, skew and kurtosis - the shape numbers that catch insurance-selling profiles. Rolling Sharpe on two windows: decay and regime dependence. Monthly return table: seasonality and which specific months made the year. Exposure panel - net, gross, factor betas over time: is "market neutral" actually true through stress periods. Turnover and cost share of gross P&L: operational realism and capacity hints. P&L concentration: top-5-day share, performance by name bucket. Benchmark-relative behavior in the worst market months: the correlation that only appears in crises. Every panel answers a specific committee objection before it is raised.`,
    answer: `Log-scale equity with drawdown shading; headline stats with sample length and standard errors - Sharpe, max drawdown and its duration, skew and kurtosis; rolling Sharpe at two windows for decay; monthly return table; net, gross, and factor exposures through time, especially during stress months; turnover with costs as a share of gross P&L; and P&L concentration such as the top-five-day share. Each panel pre-empts a specific way strategies flatter themselves - and the drawdown, exposure, and concentration panels are the ones committees actually decide on.`,
    trap: `Building the tearsheet as an advertisement - cumulative return on a linear scale, no standard errors, no cost line, stats since a favorable start date. Experienced committees read the OMISSIONS as the content: a missing crisis-period panel means the answer is bad.`,
    followUp: `The committee asks for one single number to track this strategy quarterly. Refuse gracefully: which two-number pair do you offer instead, and why is any single number gameable?`,
  },
  {
    id: "qr-analytics-11-drawdown-expectation",
    module: "analytics",
    title: "Expected drawdown grows with time",
    difficulty: "hard",
    question: `A 12-year-old strategy shows a 28 percent max drawdown; a 2-year-old one shows 9 percent. The allocator prefers the second on risk grounds. Make the statistical case that this comparison is broken.`,
    thinking: `Model max drawdown as what it is: the extreme of a path statistic, not a parameter of the return distribution. For a fixed, unchanging strategy, the observed maximum drawdown is a draw from a distribution that shifts deeper as the window lengthens - more days means more chances for an unlucky sequence, and for a random walk with drift the expected worst trough keeps growing roughly with the logarithm-to-square-root of horizon depending on the drift-to-vol ratio. So the 12-year record's 28 percent and the 2-year record's 9 percent could easily come from IDENTICAL return distributions - simulate any Sharpe-1 process and watch median max drawdown double or triple as the window extends. The comparison penalizes the veteran precisely for having survived longer. The fair procedures: compare matched trailing windows; or fit each strategy's return distribution, simulate both at a COMMON horizon, and compare drawdown distributions - or just compare vol and Sharpe, which are length-stable.`,
    answer: `Max drawdown is an extreme statistic whose expectation deepens with observation length - the same strategy simply prints worse troughs given more time. A Sharpe-1 process might show a median max drawdown near 10 percent over 2 years and near 25 over 12, so these two funds may be statistically identical, with the veteran punished for surviving. Compare matched windows, or simulate both at a common horizon - never raw lifetime drawdowns across different track lengths.`,
    python: `import numpy as np
# same return process, different observation windows -- one experiment
rng = np.random.default_rng(7)
mu, sig, sims = 0.0006, 0.0095, 20000     # ~Sharpe 1.0, held constant

def max_dd_dist(T):
    r = rng.normal(mu, sig, size=(sims, T))
    eq = np.cumprod(1.0 + r, axis=1)
    peak = np.maximum.accumulate(eq, axis=1)   # running high per path
    return (eq / peak - 1.0).min(axis=1)       # worst trough per path

for years in [2, 12]:
    dd = max_dd_dist(years * 252)
    print(years, "yrs | median",
          round(np.median(dd), 3),
          "| 5th pct", round(np.quantile(dd, 0.05), 3))
# typical output: median ~ -0.10 at 2y vs ~ -0.25 at 12y -- SAME process.
# the allocator is reading track length and calling it risk.
# also: the 2y fund's 9% says almost nothing about its 12-year future.`,
    trap: `Half-fixing it by annualizing drawdown or dividing by years - drawdown does not scale linearly in time, so ad hoc normalizations create their own bias. The legitimate fixes are matched windows or simulation at a common horizon; there is no valid single-number rescaling.`,
    followUp: `Now the harder version: the 12-year strategy's worst drawdown happened in its first two years. Should recency matter, and how would you weight old evidence about a possibly non-stationary strategy?`,
  },
  {
    id: "qr-analytics-12-pnl-concentration",
    module: "analytics",
    title: "P&L concentration risk",
    difficulty: "hard",
    question: `A strategy shows Sharpe 1.5 over five years, but you suspect a handful of days drive everything. How do you test that, and how do you avoid the trap of concluding every strategy is fragile?`,
    thinking: `The concern is real: a Sharpe built on three lucky days is a different asset than the same Sharpe accrued steadily, because the lucky version's edge may be one regime or one event that will not repeat. The naive test - delete the best N days and watch Sharpe collapse - is rigged: removing the top observations from ANY return series craters its mean, so the test convicts everyone. You need a null. Benchmark the concentration against what the strategy's own return distribution would produce by chance: compare the top-5-day share of total P&L against the same statistic under resampled or simulated returns with matched vol and Sharpe; or run the symmetric test - delete the WORST five days too and see whether the improvement is as dramatic as the degradation was. Also distinguish design from luck: an event-driven strategy is SUPPOSED to earn on few days - concentration is its mechanism, and the right question becomes whether the event type recurs, not whether daily P&L is smooth.`,
    answer: `Sort daily P&L and compute the top-5-day share of the total, then compare against a null - resampled returns with the same vol and Sharpe - because deleting best days hurts every strategy by construction; only EXCESS concentration relative to chance is a finding. Run the symmetric worst-day deletion as a control. And separate luck from design: event-driven strategies concentrate on purpose, where the real question is whether the event class recurs out of sample.`,
    python: `import numpy as np
import pandas as pd
# net: daily net returns, ~5 years
top5_share = net.nlargest(5).sum() / net.sum()   # headline concentration

def sharpe(x):
    return x.mean() / x.std() * np.sqrt(252)

sr_full = sharpe(net)
sr_ex_best = sharpe(net.drop(net.nlargest(5).index))   # the naive test
sr_ex_worst = sharpe(net.drop(net.nsmallest(5).index)) # the control

# the null: same marginal distribution, no special days -- bootstrap
rng = np.random.default_rng(0)
sims = 2000
null_shares = np.empty(sims)
vals = net.to_numpy()
for i in range(sims):                        # loop over sims is fine here
    s = rng.choice(vals, size=len(vals), replace=True)
    null_shares[i] = np.sort(s)[-5:].sum() / s.sum()
pval = (null_shares >= top5_share).mean()    # is OUR concentration unusual?
print(round(top5_share, 3), round(sr_full, 2),
      round(sr_ex_best, 2), round(sr_ex_worst, 2), round(pval, 3))`,
    trap: `Presenting "Sharpe drops from 1.5 to 0.6 without its best five days" as a finding on its own. Every strategy fails that test - including the market. Without the bootstrap null and the symmetric worst-day control, best-day deletion is an applause line, not analysis.`,
    followUp: `Concentration is unusual AND the big days were all one event type - say, short-vol expiries. What monitoring would you attach as a condition of allocation, and what would make you pull it?`,
  },
  {
    id: "qr-analytics-13-autocorr-sharpe",
    module: "analytics",
    title: "Smooth returns, inflated Sharpe",
    difficulty: "hard",
    question: `A credit fund reports monthly returns with lag-one autocorrelation of 0.4 and a Sharpe of 2.1. Why is that Sharpe inflated, roughly how much, and what does the autocorrelation itself tell you?`,
    thinking: `Chase the annualization assumption. Scaling a per-period Sharpe by root 12 assumes independent periods, because only then does variance add linearly across time. With positive autocorrelation, consecutive returns reinforce: the variance of an annual sum exceeds twelve times the monthly variance by a factor of roughly one plus twice the sum of the autocorrelations - with rho 0.4, about 1.8, so true annual vol is some 35 percent higher than the naive scaling and the honest Sharpe is nearer 1.5 than 2.1. Then ask WHY monthly market returns would autocorrelate at 0.4 - real risk premia rarely do. The usual answer is smoothed marks: illiquid or appraisal-priced assets whose stale valuations spread each true shock across several reporting periods. That means reported vol understates economic vol even before annualization, correlations to public markets are understated too, and the fund is riskier and more beta-laden than every number on its tearsheet suggests.`,
    answer: `Root-12 annualization assumes independent months; at lag-one autocorrelation 0.4 the annual variance is inflated by roughly one plus two times rho - about 1.8x - so true annual vol is about 35 percent higher and the honest Sharpe is roughly 2.1 over 1.34, near 1.55, before deeper corrections. Worse, 0.4 monthly autocorrelation in a market strategy usually means smoothed marks on illiquid assets: reported vol, drawdowns, AND market correlation are all understated. Apply Lo's adjustment and de-smooth before comparing.`,
    python: `import numpy as np
import pandas as pd
# monthly: monthly net returns as reported
rho1 = monthly.autocorr(1)                  # lag-1 autocorrelation
sr_naive = monthly.mean() / monthly.std() * np.sqrt(12)

# AR(1)-style correction: variance of a 12-month sum under autocorr
# inflates by ~ (1 + 2 * sum_k rho^k) relative to iid scaling
k = np.arange(1, 12)
infl = 1.0 + 2.0 * np.sum((1.0 - k / 12.0) * rho1**k)  # Lo (2002) weights
sr_adj = sr_naive / np.sqrt(infl)
print(round(rho1, 2), round(sr_naive, 2), round(sr_adj, 2))

# de-smoothing (Geltner): recover economic returns from stale marks
# true_t ~ (reported_t - rho * reported_{t-1}) / (1 - rho)
true_r = (monthly - rho1 * monthly.shift(1)) / (1.0 - rho1)
print(round(monthly.std() * np.sqrt(12), 3),
      round(true_r.std() * np.sqrt(12), 3))   # economic vol is LARGER
# rerun beta/correlation on true_r: hidden market exposure appears.`,
    trap: `Treating positive autocorrelation as evidence of skill - "consistency". In reported returns it is far more often an artifact of stale pricing, and it inflates every downstream statistic in the fund's favor: vol down, Sharpe up, correlation down, drawdown down. Consistency you cannot trade is an accounting property, not an edge.`,
    followUp: `Negative autocorrelation also exists - a fast mean-reversion book might show rho of minus 0.2 in daily returns. What does root-252 scaling do to ITS Sharpe, and who benefits from ignoring that correction?`,
  },
  {
    id: "qr-analytics-20260808-var-vs-cvar",
    module: "analytics",
    title: "VaR vs CVaR (Expected Shortfall) for tail risk",
    difficulty: "core",
    question: `Risk asks you to report both 1-day 99% VaR and 1-day 99% CVaR for the book. VaR comes back at -2.1%, CVaR at -3.8%. Explain what each number means, why CVaR is larger, and which one you would want to control if you specifically cared about tail-risk management rather than a single headline number.`,
    thinking: `VaR is a QUANTILE: the loss threshold such that only 1% of days should be worse. It says nothing about how bad that worst 1% actually gets -- famously, it is blind to tail severity beyond the cutoff. CVaR, or Expected Shortfall, is the AVERAGE loss conditional on being past that threshold -- the mean of the worst-1%-of-days tail -- so it is always at least as extreme as VaR and directly sensitive to fat left tails and skew in exactly the way VaR ignores. Two books can share identical VaR while having very different CVaR if one has a fatter, nastier tail beyond the 99th percentile -- a short-optionality or crash-risk strategy being the classic case. CVaR is also a coherent risk measure -- subadditive, so diversification can only help or stay neutral under it, which is not guaranteed for VaR -- and that property matters when aggregating risk across desks. For genuine tail-risk management, control CVaR: it captures severity of a breach, not just its frequency.`,
    answer: `VaR is the loss threshold exceeded on only 1% of days -- a frequency statement with no information about severity beyond that point. CVaR is the average loss conditional on being in that worst 1%, so it is always more extreme than VaR and directly captures fat-tail severity. Two books can share VaR but differ sharply in CVaR if one has a nastier tail. CVaR is also coherent (subadditive), which matters for aggregating risk across desks. Control CVaR, not VaR, if the goal is genuinely managing tail severity.`,
    python: `import numpy as np
import pandas as pd

# pnl: daily book P&L as a fraction of capital (negative = loss)
alpha = 0.01                                  # 99% confidence -> worst 1% tail

var_99 = pnl.quantile(alpha)                  # the threshold itself
tail = pnl[pnl <= var_99]                     # the worst 1% of observed days
cvar_99 = tail.mean()                         # average loss WITHIN that tail

print(f"VaR: {var_99:.3%}   CVaR: {cvar_99:.3%}")
# CVaR is always <= VaR in loss terms (more negative), never the reverse --
# it is an average taken further out in the same tail VaR only points at.

# quick coherence sanity check: CVaR of a 50/50 blend of two books should
# never exceed the weighted average of their individual CVaRs (subadditivity)`,
    trap: `Using the parametric (normal-distribution) formulas for VaR and CVaR on a returns series with visible fat tails or negative skew -- options books, credit, anything with crash risk. The normal formula systematically understates CVaR specifically, right where its coherence property is supposed to matter most.`,
    followUp: `Your CVaR is 3.8% against a VaR of only 2.1% -- an unusually wide gap. What does that gap, by itself, tell you about the shape of the book's tail, and what strategy types tend to produce it?`,
  },
  {
    id: "qr-analytics-20260809-information-ratio",
    module: "analytics",
    title: "Information ratio vs Sharpe ratio",
    difficulty: "hard",
    question: `Your long-only equity strategy reports a Sharpe ratio of 0.9 and, in the same tearsheet, an information ratio of 1.6 relative to its benchmark. Both measure "return per unit of risk" -- what is actually different about what each one is dividing, and why can they diverge this much?`,
    thinking: `Pin down the two different numerators and denominators. Sharpe's numerator is total excess return over the risk-free rate; its denominator is total return volatility -- it asks how much reward you got for bearing the full risk of holding this, unhedged, in isolation. Information ratio's numerator is ACTIVE return -- the strategy's return minus its benchmark's return, the alpha generated versus a passive alternative -- and its denominator is tracking error, the volatility of THAT DIFFERENCE, not of the strategy's own total return. A long-only equity strategy is dominated by market beta: most of its volatility is just "the market moved", which drags Sharpe's denominator up without saying anything about manager skill. Once you subtract the benchmark, most of that shared market volatility cancels in both numerator and denominator, so a strategy with genuine stock-picking skill can show a much higher IR than Sharpe, because tracking error is a far smaller number than total volatility.`,
    answer: `Sharpe divides total excess return by total volatility -- it asks whether the whole position is worth holding, including the market exposure that comes for free with any long-only equity book. Information ratio divides active return (strategy minus benchmark) by tracking error (volatility of that difference), asking only whether the manager beat a passive alternative -- most of the shared market volatility cancels out in both numerator and denominator. A long-only manager with real stock-picking skill can show a much higher IR than Sharpe precisely because tracking error strips out the beta noise that dominates total volatility.`,
    python: `import numpy as np
import pandas as pd

# strat, bench: daily returns, strategy and its benchmark, same dates
active = strat - bench                       # what the manager actually contributed

ann = np.sqrt(252)
sharpe = (strat.mean() / strat.std()) * ann              # excess vs total risk
# (subtract risk-free rate from strat.mean() first for a strict Sharpe;
# this illustration omits it)

ir = (active.mean() / active.std()) * ann                # active return vs tracking error

print("Sharpe:", round(sharpe, 2), "  IR:", round(ir, 2))

# decompose WHY they diverge: how much of strat's total vol is shared
# market movement that cancels out once you look at (strat - bench)
beta = np.cov(strat, bench)[0, 1] / np.var(bench)
market_component_vol = beta * bench.std()
print("strategy vol:", round(strat.std() * ann, 3),
      "  tracking error:", round(active.std() * ann, 3))
# tracking error is typically a small fraction of total vol for a
# closet-indexer-adjacent long-only book -- that gap is exactly IR vs Sharpe`,
    trap: `Comparing a market-neutral fund's Sharpe directly against a long-only fund's information ratio as if they were the same statistic. A market-neutral book's Sharpe is already close to an IR, since there is little beta left to strip out, while a long-only fund's Sharpe and IR measure meaningfully different things -- putting them on one leaderboard without noting which ratio each used compares apples to a benchmark-relative orange.`,
    followUp: `The benchmark itself is not perfectly representative of the strategy's actual investable universe -- say, a small-cap fund benchmarked against a large-cap index. What does that mismatch do to the information ratio, and in which direction is it likely biased?`,
  },
  {
    id: "qr-analytics-20260810-factor-attribution",
    module: "analytics",
    title: "Attributing P&L to factor exposures",
    difficulty: "core",
    question: `Your book returned 2.3% last month. The PM wants to know how much of that came from your stock-picking versus how much came from unintentional exposure to well-known factors like momentum and value that happened to do well. How do you decompose the P&L, and what does the leftover residual actually mean?`,
    thinking: `Set up the decomposition as a linear model of returns onto known factor returns: the book's estimated net exposure to each factor in a standard set -- market, size, value, momentum, whatever the shop's risk model carries -- multiplied by that factor's realized return over the month gives the P&L attributable to simply holding that exposure through a month it happened to pay off, whether or not you meant to bet on it. Summing those factor contributions and subtracting from total P&L leaves the residual, which is, by construction, the return unexplained by the factor set -- the closest available proxy for genuine stock-specific alpha, provided the factor set is reasonably complete, because any real driver of returns the risk model omits will misleadingly show up inside "your skill" instead of being correctly attributed to an omitted factor. The practical value of doing this every month is not just bragging rights -- persistent, large, unintended factor tilts are a risk-management finding even when they made money this month, because the same tilt loses money the next month a favored factor reverses.`,
    answer: `Multiply the book's net exposure to each factor by that factor's realized return over the period, sum across factors for the factor-attributed P&L, and subtract from total P&L to get the residual. The residual is the return unexplained by the named factors -- your best proxy for genuine stock selection, but only as good as the factor set is complete, since any real return driver missing from the model gets misattributed into "skill" it did not earn. Report both: even a profitable month can reveal an unintended factor tilt worth hedging before it reverses against you.`,
    python: `import pandas as pd
import numpy as np

# exposures: net portfolio exposure to each factor (from the risk model)
# factor_rets: that factor's realized return this month
factors = ["market", "size", "value", "momentum"]
exposures = pd.Series([0.15, -0.05, 0.02, 0.30], index=factors)
factor_rets = pd.Series([0.018, -0.010, 0.004, 0.025], index=factors)

# each factor's dollar-weighted contribution to this month's P&L
factor_contrib = exposures * factor_rets
attributed = factor_contrib.sum()

total_pnl = 0.023                        # the book's actual monthly return
residual = total_pnl - attributed        # unexplained -- proxy for stock selection

print(factor_contrib.round(4))
print("factor-attributed:", round(attributed, 4),
      "residual (selection):", round(residual, 4))
# a large, persistent momentum contribution here is a risk flag even
# though it helped this month -- it reverses the next time momentum does`,
    trap: `Treating the residual as pure, trustworthy alpha without checking whether the factor set is actually complete for this book. A book with unhedged sector or country tilts, evaluated against a factor model that only carries style factors, will dump real sector and country P&L into the residual and everyone will congratulate the PM for stock-picking skill that was actually a sector bet.`,
    followUp: `Your momentum exposure of 0.30 is unusually high and has been rising for six months even though nobody set out to make a momentum bet. What in the portfolio construction process typically causes unintended factor tilts to drift upward like that over time?`,
  },
  {
    id: "qr-analytics-20260811-omega-ratio",
    module: "analytics",
    title: "The Omega ratio: using the whole distribution",
    difficulty: "core",
    question: `A PM asks why you would ever compute the Omega ratio when Sharpe and Sortino already exist on the tearsheet. Define Omega, explain what it captures that both of the others miss, and name a place it can still mislead you.`,
    thinking: `Locate what each ratio actually uses from the return distribution. Sharpe uses only the first two moments -- mean and variance -- collapsing the entire shape of the distribution into a single dispersion number that charges upside and downside symmetrically. Sortino improves the denominator to downside deviation, but it is still a single summary number of the below-threshold tail, blind to exactly how that tail is shaped beyond its root-mean-square magnitude. Omega uses the ENTIRE distribution with no distributional assumption at all: for a chosen threshold return, it is the ratio of the probability-weighted sum of gains above the threshold to the probability-weighted sum of losses below it -- equivalently, the ratio of the areas above and below the threshold under the return distribution's cumulative distribution function. Because it is built from the full CDF rather than any fixed number of moments, two strategies can share identical Sharpe AND identical Sortino while showing very different Omega, if one has a longer, thinner left tail that a single downside-deviation number compresses away but the full distribution still shows. Where it can still mislead: Omega remains an IN-SAMPLE statistic computed from whatever tail has actually shown up in your history -- for a strategy whose real tail event has simply not occurred yet (the negatively-skewed short-vol profile from earlier in this module), Omega has nothing more to grade it on than Sharpe or Sortino do; using the full distribution helps only with the risk that has already been observed, not the risk that has not.`,
    answer: `Omega is the ratio, at a chosen threshold, of the probability-weighted gains above it to the probability-weighted losses below it -- built from the full return distribution's CDF rather than any fixed number of moments. Sharpe collapses everything to mean and variance; Sortino improves the denominator to downside deviation but is still one summary number of the tail. Two strategies can match on both Sharpe and Sortino while differing sharply in Omega if one has a longer, thinner left tail the single downside-deviation number compresses away. It still cannot solve the unrealized-tail problem: it only makes fuller use of whatever tail has already shown up in the sample, which is no help for a crash that has not happened yet.`,
    python: `import numpy as np
import pandas as pd

def omega_ratio(returns, threshold=0.0):
    excess = returns - threshold
    gains = excess[excess > 0].sum()
    losses = -excess[excess < 0].sum()
    return gains / losses if losses > 0 else np.inf

def sharpe(returns):
    return returns.mean() / returns.std() * np.sqrt(252)

def sortino(returns, threshold=0.0):
    shortfall = np.minimum(returns - threshold, 0.0)
    dd = np.sqrt((shortfall ** 2).mean())
    return (returns.mean() - threshold) / dd * np.sqrt(252)

rng = np.random.default_rng(5)
# two series, same mean and variance by construction, different tail shape
symmetric = pd.Series(rng.normal(0.0006, 0.008, 1500))
neg_skew_tail = pd.Series(rng.normal(0.0009, 0.006, 1500))
neg_skew_tail.iloc[::150] -= 0.06   # rare, sharp drawdowns -- long thin left tail

for name, r in [("symmetric", symmetric), ("neg-skew tail", neg_skew_tail)]:
    print(name, round(sharpe(r), 2), round(sortino(r), 2), round(omega_ratio(r), 2))
# sharpe and sortino can land close for both; omega diverges more sharply,
# because it is the only one of the three reading the full tail shape`,
    trap: `Computing Omega at threshold 0 as a default without asking whether 0 is the economically meaningful cutoff for this book -- a funding cost, a risk-free rate, or a client hurdle rate is often the right threshold, and comparing two strategies' Omega ratios computed at different implicit thresholds is not a fair comparison at all, the same way comparing Sharpes computed under different annualization conventions is not.`,
    followUp: `Omega, Sharpe, and Sortino all agree in ranking two strategies A over B. Does that agreement make you trust the ranking more than any single number would justify on its own? (Somewhat -- agreement across statistics that use progressively more of the distribution's shape is weaker evidence of a shared blind spot than three symmetric-tail-only checks would be, but none of the three has seen a tail event neither history has produced yet, so the agreement still says nothing about unobserved risk.)`,
  },
  {
    id: "qr-analytics-20260812-skew-kurtosis",
    module: "analytics",
    title: "Skewness and kurtosis: what Sharpe hides",
    difficulty: "core",
    question: `Two strategies both have an annualized Sharpe of 1.5 and similar drawdown stats. Strategy A sells short-dated options (collects small premiums most days, occasionally takes a large loss). Strategy B is a diversified trend-following book. An allocator asks you to distinguish them using the return distribution itself, beyond Sharpe. What do you compute, and what do you expect to see?`,
    thinking: `Sharpe is mean divided by standard deviation -- it only uses the first two moments and implicitly treats the distribution as fully described by them, which is only exactly true for a Gaussian. Short-dated option selling is the textbook case Sharpe cannot see: many small positive days punctuated by rare large losses, because the payoff is bounded gains against effectively unbounded losses -- negative skew, fat tails (high excess kurtosis). Trend-following often shows the mirror image: many small losing whipsaw days, occasional large wins when a trend runs -- positive skew. Same Sharpe, opposite tail risk, and it is precisely the negative-skew strategy whose rare losses tend to cluster with poor liquidity, exactly when you can least afford them.`,
    answer: `Compute sample skewness and excess kurtosis on daily returns -- Sharpe only uses the first two moments and is blind to distribution shape. Expect Strategy A (short options) to show strongly negative skew and high excess kurtosis: many small gains, rare large losses, a classic short-gamma signature. Expect Strategy B (trend-following) to show positive skew: many small losing whipsaw days, occasional large winning days when a trend runs. Same Sharpe, opposite tail risk -- the option seller's losses cluster exactly when liquidity is worst, which Sharpe alone will never flag.`,
    python: `import pandas as pd
from scipy import stats

def tail_profile(rets: pd.Series) -> dict:
    return {
        "sharpe": rets.mean() / rets.std(ddof=1) * (252 ** 0.5),
        # skew < 0: rare large LOSSES (short-gamma signature)
        # skew > 0: rare large GAINS (long-gamma / trend signature)
        "skew": stats.skew(rets, bias=False),
        # excess kurtosis = kurtosis - 3; 0 is the normal-distribution
        # baseline, positive means fatter tails than a same-variance normal
        "excess_kurtosis": stats.kurtosis(rets, bias=False),
    }

profile_a = tail_profile(short_opts_returns)   # expect: skew << 0, kurtosis >> 0
profile_b = tail_profile(trend_returns)        # expect: skew > 0, more modest kurtosis

# same Sharpe can hide very different loss-clustering behavior -- check
# CVaR at a tail quantile too, since skew/kurtosis alone don't size the loss
cvar_5pct = {
    name: rets[rets <= rets.quantile(0.05)].mean()
    for name, rets in [("A", short_opts_returns), ("B", trend_returns)]
}`,
    trap: `Treating Sharpe as a complete risk summary because both strategies show the same number. Two return streams with identical mean and variance can have wildly different skew and kurtosis, and it is precisely the negative-skew, fat-tailed strategy whose rare losses tend to arrive during a liquidity crunch -- the worst possible time, which a two-moment statistic cannot see coming.`,
  },
];
