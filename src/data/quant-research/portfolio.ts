import type { QRQuestion } from "./index";

// M7 -- Portfolio Construction: turning signals into weights, why naive
// optimization fails, covariance estimation, constraints, turnover.
export const portfolioQuestions: QRQuestion[] = [
  {
    id: "qr-portfolio-01-signal-to-weights",
    module: "portfolio",
    title: "From signal to weights",
    difficulty: "warmup",
    question: `You have a cross-sectional alpha signal for 500 stocks - one number per stock per day, higher means more attractive. Walk me through the simplest defensible way to turn that into portfolio weights.`,
    thinking: `Before writing code, ask what properties the weights must have. You want them monotone in the signal (better score, bigger position), insensitive to the signal's scale (a score of 3.2 versus 32 should not change the book), robust to outliers (one insane score must not become half the portfolio), and market-neutral if this is a long-short book. Ranking the signal cross-sectionally - across stocks, within each day - solves scale and outliers in one move: ranks keep only the ordering. That throws away magnitude information, which costs a little edge but buys a lot of robustness. Demeaning the ranks makes weights sum to zero, so longs fund shorts with no net market bet. Then normalize by gross exposure - the sum of absolute weights - so the book size is fixed at 1.`,
    answer: `Rank the signal cross-sectionally each day, subtract the cross-sectional mean so longs and shorts balance, then divide by the sum of absolute weights so gross exposure is exactly one. The result is a dollar-neutral book that depends only on the ordering of the signal, not its scale. That is the standard baseline before any optimizer.`,
    python: `import pandas as pd
# signal: DataFrame, index = dates, columns = stocks
ranks = signal.rank(axis=1)                # rank ACROSS stocks within each day
centered = ranks.sub(ranks.mean(axis=1), axis=0)  # demean -> weights sum to 0
gross = centered.abs().sum(axis=1)         # gross exposure before scaling
weights = centered.div(gross, axis=0)      # sum of |w| = 1: fully sized L/S book

# sanity checks you should ALWAYS run before backtesting:
# net exposure ~ 0 per day, gross exposure ~ 1 per day
assert weights.sum(axis=1).abs().max() < 1e-9
assert (weights.abs().sum(axis=1) - 1).abs().max() < 1e-9`,
    trap: `Calling rank(axis=0). That ranks each stock against its own history (a time-series bet) instead of against its peers today (a cross-sectional bet) - the backtest still runs, produces numbers, and tests a completely different strategy. Axis bugs are the classic silent killer here.`,
    followUp: `Dollar-neutral is not market-neutral. If your longs are all high-beta tech and your shorts are utilities, what residual bet are you carrying, and how would you remove it?`,
  },
  {
    id: "qr-portfolio-02-weighting-schemes",
    module: "portfolio",
    title: "Equal weight vs the optimizer",
    difficulty: "warmup",
    question: `Equal-weight, rank-weight, and mean-variance optimization all exist. When would you pick each - and why does the dumb equal-weight portfolio so often beat the optimizer out of sample?`,
    thinking: `Frame this as a bias-variance tradeoff in the weights themselves. Mean-variance weights are optimal only if you feed the optimizer the TRUE expected returns and covariances. You never have those - you have noisy estimates, and the optimizer treats the noise as information. Equal weight uses no estimates at all, so it has zero estimation error; its only sin is ignoring real differences between assets (bias). Rank weighting sits in between: it trusts the ordering of your signal but not its magnitudes. The out-of-sample winner depends on how good your estimates are relative to how different the assets truly are. With hundreds of similar stocks and short histories, estimation error dominates, so simple schemes win embarrassingly often.`,
    answer: `Equal weight when you have no reliable return or risk estimates - it is unbeatable on estimation error. Rank weight when you trust your signal's ordering but not its magnitudes - the workhorse for cross-sectional equity signals. Mean-variance only when you have a well-conditioned covariance estimate and calibrated expected returns, plus constraints to contain the damage. Equal weight wins out of sample because the optimizer's edge is smaller than the estimation noise it amplifies.`,
    trap: `Assuming more sophisticated must be better and defaulting to the optimizer. Interviewers use this question to detect candidates who have only met mean-variance in a textbook, where inputs are given, and never in production, where inputs are the whole problem.`,
    followUp: `DeMiguel, Garlappi and Uppal (2009) found 1/N beat fourteen optimized strategies out of sample. What would have to be true about your inputs for the optimizer to reliably win?`,
  },
  {
    id: "qr-portfolio-03-turnover",
    module: "portfolio",
    title: "Measuring turnover",
    difficulty: "warmup",
    question: `Given a DataFrame of daily portfolio weights, how do you compute turnover, and roughly what level should make you nervous for an equity strategy paying 5 bps a trade?`,
    thinking: `Turnover is the fraction of the book you trade per period, and it is the quantity costs are charged on - so before quoting a number, fix the convention. The sum of absolute weight changes counts every dollar bought plus every dollar sold (two-sided). Half of that is one-sided turnover. Both are used; being sloppy about which one doubles or halves your cost estimate. Then think in cost units: annual cost drag is roughly turnover per day times cost per dollar traded times 252. That single multiplication tells you whether the strategy can afford its own trading. A signal with 100 percent daily two-sided turnover at 5 bps burns about 12.6 percent a year - very few equity alphas are that strong.`,
    answer: `Two-sided turnover is the sum of absolute weight changes per day; one-sided is half that. Compute it as the row sum of the absolute first difference of the weight matrix. Rule of thumb: annual cost drag is daily turnover times cost times 252 - at 5 bps, 40 percent two-sided daily turnover costs about 5 percent a year, which already kills most equity signals. Anything near 100 percent daily needs exceptional alpha or cheaper execution.`,
    python: `import pandas as pd
# weights: dates x stocks, each row sums to ~0 (L/S) with gross 1
dw = weights.diff()                      # weight change per name per day
turn_2s = dw.abs().sum(axis=1)           # two-sided: buys + sells, in book units
turn_1s = 0.5 * turn_2s                  # one-sided convention

cost_bps = 5.0
# daily drag = dollars traded per $1 of book * cost per dollar traded
daily_drag = turn_2s * cost_bps / 10000.0
ann_drag = daily_drag.mean() * 252       # annualized cost drag on the book
# at turn_2s ~ 0.40 -> drag ~ 0.40 * 5bps * 252 ~ 5.0% per year`,
    trap: `Mixing conventions: computing two-sided turnover but applying a cost quote meant per one-sided trade (or vice versa) is a silent 2x error in the cost line - large enough to flip a go / no-go decision on a strategy.`,
  },
  {
    id: "qr-portfolio-04-error-maximization",
    module: "portfolio",
    title: "Why MV is an error maximizer",
    difficulty: "core",
    question: `People call mean-variance optimization an "error maximizer". Show me the intuition with two highly correlated assets whose expected returns differ by ten basis points.`,
    thinking: `Ask where the optimizer finds "free lunches". Unconstrained mean-variance weights are proportional to the inverse covariance matrix times expected returns. The inverse covariance amplifies whatever mu looks like along LOW-variance directions. With two assets at 0.99 correlation, the low-variance direction is the spread: long one, short the other. So the optimizer stares at a 10 bp difference in estimated returns - far inside estimation noise, since the standard error on an annual mean from a few years of data is measured in whole percentage points - and concludes the spread trade is nearly riskless free money. It loads up enormously. Flip which asset has the extra 10 bps and the entire book reverses. The optimizer is doing exactly its job on inputs that do not deserve that trust: it maximizes over errors.`,
    answer: `Unconstrained MV weights are inverse-covariance times mu, and the inverse covariance magnifies return differences along low-variance directions - which for highly correlated assets is the long-short spread. A 10 bp mu difference, pure estimation noise, becomes a huge spread bet, and flipping the noise flips the whole book. The optimizer allocates most aggressively exactly where its inputs are least distinguishable from noise - hence "error maximizer".`,
    python: `import numpy as np
sigma = 0.20
rho = 0.99                          # two nearly identical stocks
cov = np.array([[1.0, rho], [rho, 1.0]]) * sigma**2

mu_a = np.array([0.050, 0.051])     # B looks 10bp better
mu_b = np.array([0.051, 0.050])     # A looks 10bp better - pure noise flip

w_a = np.linalg.solve(cov, mu_a)    # unconstrained MV direction: inv(cov) @ mu
w_b = np.linalg.solve(cov, mu_b)
w_a = w_a / np.abs(w_a).sum()       # normalize gross to compare books
w_b = w_b / np.abs(w_b).sum()
# w_a ~ [-0.25, +0.75], w_b ~ [+0.75, -0.25]: a 10bp change in mu,
# well inside estimation error, REVERSED the long-short book.
# inv(cov) blew up the mu difference along the low-variance spread.`,
    trap: `Blaming the optimizer's math. The math is fine - the quadratic program is solved exactly. The failure is statistical: garbage-sensitive inputs. Candidates who say "mean-variance is broken" instead of "mean-variance is input-fragile" reveal they cannot locate the actual problem.`,
    followUp: `Given this, name three practical fixes and what each one implicitly shrinks: better inputs (shrunk covariance), constraints (implicit shrinkage), or resampling. Which would you reach for first and why?`,
  },
  {
    id: "qr-portfolio-05-singular-covariance",
    module: "portfolio",
    title: "500 assets, 252 days: singular",
    difficulty: "core",
    question: `You estimate a sample covariance matrix for 500 stocks from one year of daily returns and hand it to an optimizer. It explodes. Why is that matrix guaranteed to be unusable?`,
    thinking: `Count degrees of freedom before trusting any estimate. The sample covariance is built from T observations of an N-vector; after subtracting the sample mean, it is an average of T minus 1 rank-one matrices, so its rank is at most T minus 1. With N = 500 and T = 252, rank is at most 251, but the matrix is 500 by 500 - so at least 249 eigenvalues are exactly zero. A zero eigenvalue means the estimate claims some portfolio has ZERO risk. The optimizer, which divides by risk, sees infinite Sharpe in those directions and piles in without bound. Even before hard singularity, when T is merely comparable to N, the smallest eigenvalues are badly biased toward zero, so the "nearly riskless" directions are illusions of sampling error. You are also fitting 125,250 free parameters from 126,000 data points - about one observation per parameter.`,
    answer: `The sample covariance has rank at most T minus 1 = 251, but it is 500 by 500, so it is singular: at least 249 zero eigenvalues, meaning directions the estimate claims are riskless. The optimizer needs the inverse, which does not exist, and any pseudo-inverse loads infinitely on those fake riskless directions. More broadly you are estimating about 125,000 parameters from 126,000 numbers - the small eigenvalues are pure noise. You must impose structure: shrinkage or a factor model.`,
    python: `import numpy as np
rng = np.random.default_rng(0)
T, N = 252, 500
rets = rng.normal(0.0, 0.01, size=(T, N))   # one year of daily returns

S = np.cov(rets, rowvar=False)              # 500 x 500 sample covariance
print(np.linalg.matrix_rank(S))             # 251 = T - 1, never more

eig = np.linalg.eigvalsh(S)
print((eig < 1e-12).sum())                  # 249 exactly-zero eigenvalues
# each zero eigenvalue is a portfolio the estimate says has NO risk.
# an optimizer dividing by risk sees infinite Sharpe there.
# parameter count: N*(N+1)/2 = 125,250 params from T*N = 126,000 obs.`,
    trap: `Saying "just use the pseudo-inverse" or "add a tiny ridge and move on". That makes the code run but keeps the statistical disease: the smallest eigenvalues are still noise, and the optimizer still concentrates in them. The fix is a better estimator, not a numerical patch.`,
    followUp: `Suppose you had 40 years of daily data so T is much larger than N. Would you use the raw sample covariance then? What non-stationarity problem does the long window introduce?`,
  },
  {
    id: "qr-portfolio-06-ledoit-wolf",
    module: "portfolio",
    title: "Shrinkage: Ledoit-Wolf intuition",
    difficulty: "core",
    question: `Explain Ledoit-Wolf shrinkage to me like I am a PM: what is being averaged with what, and why does a deliberately biased covariance estimate produce better portfolios?`,
    thinking: `Start from the bias-variance tradeoff, because that is all shrinkage is. The sample covariance is unbiased but has huge variance when N is comparable to T - its extreme eigenvalues are too extreme. A structured target, like "every stock has the average variance and the same correlation", is heavily biased but nearly noiseless because it has only a couple of parameters. A weighted average of the two trades a little bias for a big variance reduction. Ledoit-Wolf's contribution is choosing the weight from the data itself: the noisier the sample estimate (short history, many assets), the harder you pull toward the target. Then think about what the optimizer sees: shrinkage pulls the too-big eigenvalues down and the too-small ones up, exactly deleting the fake near-riskless directions the optimizer would have exploited.`,
    answer: `It is a weighted average of the noisy sample covariance and a simple structured target - typically constant variance or constant correlation - with the weight chosen analytically to minimize expected error: more assets or fewer observations means more shrinkage. It works because portfolio quality is destroyed by the estimator's VARIANCE, especially the understated small eigenvalues the optimizer exploits. Accepting a small known bias to kill that variance yields a better-conditioned matrix and much better out-of-sample portfolios.`,
    python: `import numpy as np
rng = np.random.default_rng(1)
T, N = 252, 100
rets = rng.normal(0.0, 0.01, size=(T, N))

S = np.cov(rets, rowvar=False)              # noisy sample covariance
avg_var = np.trace(S) / N
target = avg_var * np.eye(N)                # target: equal variance, zero corr

a = 0.5                                     # shrinkage intensity, in [0, 1]
S_shrunk = (1 - a) * S + a * target         # convex combo: bias for variance
# effect on the spectrum: big eigenvalues pulled down, small ones pulled UP
# away from zero -- the fake "riskless" directions disappear.
print(np.linalg.eigvalsh(S).min(), np.linalg.eigvalsh(S_shrunk).min())

# in practice let the intensity be estimated from the data:
# from sklearn.covariance import LedoitWolf; LedoitWolf().fit(rets)`,
    trap: `Treating the shrinkage intensity as a free hyperparameter to tune on the backtest. The whole point of Ledoit-Wolf is that the intensity comes from an analytic formula driven by N, T and the data's noise level - tuning it on backtest Sharpe just reintroduces the overfitting you were trying to remove.`,
    followUp: `Shrinking toward the identity says "all stocks alike". When is a one-factor (market) target a smarter choice, and what does that start to look like as you add factors?`,
  },
  {
    id: "qr-portfolio-07-constraints",
    module: "portfolio",
    title: "Position limits and sector caps",
    difficulty: "core",
    question: `Your optimizer hands you a book with 15 percent in one small cap and 60 percent of gross in tech. What constraints do you impose, and how do you actually enforce a per-name cap on a weight vector?`,
    thinking: `First ask why the optimizer did that: concentrated weights are usually the error-maximization signature - it found a name or sector where noisy inputs looked like free money. Constraints are your admission that inputs are noisy. The standard set: per-name position limits (cap single-name event risk - one earnings blowup should not be able to end your year), sector or industry caps (your alpha is supposed to be stock selection, not an accidental tech bet), gross and net exposure bounds, and long-only if mandated. Also liquidity limits: position size as a multiple of the name's daily volume, because you must be able to exit. Implementation matters: naively clipping a weight vector and renormalizing can push other names over their caps, so real systems put constraints inside the optimizer; clipping is only a quick projection.`,
    answer: `Per-name limits, say 1 to 2 percent for a diversified book; sector caps relative to benchmark or zero for a neutral book; gross and net exposure bounds; and liquidity limits tied to average daily volume. Enforce them inside the optimization as inequality constraints - a quadratic program handles them natively. Post-hoc clipping works as a rough projection but must be iterated, because renormalizing after one clip can breach other caps.`,
    python: `import numpy as np
# w: raw optimizer weights (sums to 0, gross ~ 1), cap: per-name limit
cap = 0.02
w = raw_weights.copy()

# iterate: clip, then rescale the UNclipped names to restore gross.
# one pass is not enough -- rescaling can push new names over the cap.
for _ in range(20):
    clipped = np.clip(w, -cap, cap)          # enforce per-name bound
    free = np.abs(clipped) < cap             # names still below the cap
    excess = np.abs(w).sum() - np.abs(clipped).sum()  # gross lost to clipping
    if excess < 1e-12:
        w = clipped
        break
    # hand the lost gross back to uncapped names, pro rata
    scale = 1.0 + excess / np.abs(clipped[free]).sum()
    w = clipped
    w[free] = w[free] * scale
# production answer: express caps as constraints in the QP itself
# (e.g. cvxpy) so the optimizer trades off alpha against them directly.`,
    trap: `Clipping once and renormalizing the whole vector - the renormalization scales the capped names back above the cap. It looks fine in a quick check on small books and quietly violates limits on real ones. Compliance breaches from lazy projections are a real way people get hurt.`,
    followUp: `Constraints cost you in-sample expected return by construction. Argue why the constrained portfolio can still have HIGHER realized out-of-sample return - what is being implicitly regularized?`,
  },
  {
    id: "qr-portfolio-08-turnover-control",
    module: "portfolio",
    title: "Cutting turnover without killing alpha",
    difficulty: "core",
    question: `Your target weights jump around day to day and trading costs are eating most of the alpha. How do you cut turnover, and how do you decide how much smoothing is too much?`,
    thinking: `Recognize the real tradeoff: costs are certain and paid now; alpha is noisy and decays over time. Chasing every wiggle of the target pays certain costs for uncertain, fleeting edge. The standard fixes: smooth the target weights over time (an exponentially weighted average of recent targets), trade only partway toward the target each day, or ignore small deviations entirely with a no-trade band. All three are the same idea - do not pay to correct noise. The dial is set by alpha decay versus cost: if your signal predicts returns over the next month, reacting within a day buys almost nothing, so smooth hard; if alpha decays in two days, smoothing over ten destroys the strategy. The honest way to choose: backtest net-of-cost Sharpe across smoothing half-lives and look for the plateau - then pick the slower end of it.`,
    answer: `Smooth the target weights - for example an exponentially weighted average with a half-life of a few days - or equivalently trade only a fraction of the way to target each day, and add a no-trade band for small drifts. The right amount of smoothing comes from the alpha's decay horizon: smooth as hard as you can before pre-cost alpha starts dropping faster than costs. Choose the half-life on net-of-cost performance and take the conservative end of the plateau.`,
    python: `import pandas as pd
# target: dates x stocks raw target weights from the signal
hl = 5  # half-life in days -- the smoothing dial

# ewm along TIME smooths each name's weight path; fully vectorized,
# equivalent to trading a fixed fraction toward target each day
smooth = target.ewm(halflife=hl).mean()

# re-normalize gross so smoothing does not shrink the book
smooth = smooth.div(smooth.abs().sum(axis=1), axis=0)

turn_raw = target.diff().abs().sum(axis=1).mean()
turn_smooth = smooth.diff().abs().sum(axis=1).mean()
# typical outcome: turnover drops 60-80% while the signal's
# information is mostly retained IF alpha decays slower than hl.
# decision rule: sweep hl in {1,2,5,10,20}, plot NET sharpe, take
# the slow end of the plateau (favor fewer trades at equal sharpe).`,
    trap: `Optimizing gross Sharpe and then subtracting costs at the end. Turnover control changes the optimal portfolio itself - the cost-aware answer holds positions the cost-blind answer would flip. If costs only enter as a final subtraction, you never actually searched the cost-efficient strategy space.`,
    followUp: `Your signal is a fast 2-day reversal worth 8 percent a year gross, at 100 percent daily turnover and 5 bps costs. Is any smoothing half-life going to save it, or is this alpha simply not yours to harvest?`,
  },
  {
    id: "qr-portfolio-09-risk-parity",
    module: "portfolio",
    title: "Risk parity intuition",
    difficulty: "core",
    question: `A classic 60/40 stock-bond portfolio is often called a disguised equity bet. What does risk parity do differently, and what is the actual quantity it equalizes?`,
    thinking: `Separate dollars from risk. In a 60/40, stocks have roughly 60 percent of the dollars but - because equity volatility is three to four times bond volatility - contribute on the order of 90 percent of the portfolio's variance. The dollar allocation is diversified; the risk allocation is not. Risk parity's move: allocate so each asset contributes EQUALLY to total portfolio risk, where an asset's risk contribution is its weight times its marginal contribution to portfolio volatility (these contributions conveniently sum to total risk). Low-vol assets get more dollars, high-vol assets fewer; with equal pairwise correlations this reduces to inverse-volatility weighting. Notice what is NOT needed: expected returns. That is the appeal - it is a pure risk allocation, immune to return estimation error. The catch: to make low-vol assets matter, real implementations lever the portfolio, so you are implicitly betting that leverage stays cheap and available.`,
    answer: `Risk parity equalizes risk contributions, not dollars: each asset's weight times its marginal contribution to portfolio volatility is the same across assets. Since equities are 3-4x more volatile than bonds, they get far fewer dollars than in 60/40, fixing the fact that 60/40's variance is about 90 percent equity-driven. It needs no expected returns - its main appeal - but typically requires leverage to hit return targets, which is its main hidden risk.`,
    python: `import numpy as np
import pandas as pd
# rets: daily returns, columns = assets
cov = rets.cov().to_numpy() * 252            # annualized covariance

vol = np.sqrt(np.diag(cov))
w_iv = (1.0 / vol) / (1.0 / vol).sum()       # inverse-vol: the simple proxy

def risk_contrib(w, cov):
    port_var = w @ cov @ w
    # RC_i = w_i * (cov @ w)_i / port_var -- shares of total variance,
    # they sum to 1 by construction (Euler decomposition)
    return w * (cov @ w) / port_var

print(risk_contrib(w_iv, cov))               # equal ONLY if correlations equal
# true risk parity solves for exactly equal RC with the full matrix --
# a small fixed-point iteration or convex solve. inverse-vol is the
# right first answer and the right benchmark for whether the extra
# machinery changes anything.`,
    trap: `Equating risk parity with inverse-volatility weighting. Inverse-vol ignores correlations: two highly correlated assets each get full weight and jointly dominate risk. Inverse-vol is the diagonal approximation; risk parity proper equalizes contributions under the full covariance.`,
    followUp: `Risk parity levers bonds. Walk me through what happened to that trade in a fast rate-hiking cycle like 2022, when stocks and bonds fell together and the correlation assumption broke.`,
  },
  {
    id: "qr-portfolio-10-dollar-vs-beta-neutral",
    module: "portfolio",
    title: "Dollar-neutral vs beta-neutral",
    difficulty: "core",
    question: `Your long-short book has equal dollars long and short, yet it loses money almost every time the market sells off. What is going on, and how do you fix the weights?`,
    thinking: `Dollar-neutral constrains the SUM of weights to zero; market exposure is the sum of weights TIMES betas. If your signal likes speculative names, your longs might average beta 1.3 while your shorts average 0.8 - net beta about plus 0.5 on gross of 1, so half of a market position is hiding inside your "neutral" book. Every market drawdown shows up in your P&L and your measured alpha is contaminated with market return. The fix is to constrain the beta-weighted sum to zero instead: either size the short side up until dollars-times-beta balances, or project the beta component out of the weight vector - subtract from w its projection onto the beta vector. The deeper habit being tested: neutrality is always with respect to some factor. Dollar, beta, sector, and style neutrality are different constraints, and you should know which ones your book actually satisfies.`,
    answer: `Equal dollars is not zero market exposure. Net beta is the position-weighted sum of betas; a low-beta-short, high-beta-long book can be dollar-neutral and still carry substantial positive beta, which is exactly what bleeds in selloffs. Fix it by constraining beta-weighted exposure to zero - project the beta direction out of the weights or rebalance the sides in beta terms. Then check the same logic for sectors and styles: neutrality is factor-specific.`,
    python: `import numpy as np
# w: dollar-neutral weights (sums to 0), beta: per-stock market betas
net_beta = w @ beta                    # the exposure that is hurting you
print(net_beta)                        # e.g. +0.5 despite sum(w) == 0

# remove it: subtract the projection of w onto the beta vector,
# i.e. the smallest weight change that zeroes the beta exposure
w_bn = w - beta * (w @ beta) / (beta @ beta)
print(w_bn @ beta)                     # ~ 0: beta-neutral now

# caution: the projection changes net dollars slightly --
# re-impose dollar neutrality and iterate a couple of times if you
# want both, or solve both constraints jointly with least squares.
print(w_bn.sum())`,
    trap: `Using betas estimated over a long calm window. Beta is time-varying and rises in crises for exactly the speculative names long-short signals love - so a book neutralized to stale betas becomes long the market at the worst possible moment. Use rolling or shrunk betas and stress the estimate.`,
    followUp: `You have beta-neutralized and the book still bleeds on big down days. What convexity or crowding stories could explain residual drawdown correlation, and how would you test for them?`,
  },
  {
    id: "qr-portfolio-11-constraints-as-shrinkage",
    module: "portfolio",
    title: "The constrained optimizer wins",
    difficulty: "hard",
    question: `In-sample, your unconstrained mean-variance backtest clearly beats the long-only, position-capped version. Which one goes to production, and what is the statistical argument - not just the risk-management one?`,
    thinking: `Resist the framing that constraints only exist for compliance. Ask what a binding constraint does to the SOLUTION. Jagannathan and Ma showed that imposing no-short-sale and position-limit constraints on a minimum-variance problem yields the same portfolio you would get UNCONSTRAINED under a modified covariance matrix - one where the constraints have effectively shrunk the offending entries. A binding upper bound on a stock is mathematically equivalent to reducing its estimated covariances; a binding long-only constraint on a stock is equivalent to raising them. So constraints are shrinkage applied exactly where the estimates were extreme enough to produce extreme weights - which, per the error-maximization logic, is where estimates are most likely to be wrong. The in-sample gap is not evidence against the constrained version; it is a measurement of how much estimation noise the unconstrained version is fitting.`,
    answer: `The constrained one. Constraints are implicit shrinkage: Jagannathan-Ma showed a constrained minimum-variance solution equals the unconstrained solution under a shrunk covariance matrix, with shrinkage applied precisely to the entries whose extreme estimates produced extreme weights. The unconstrained portfolio's in-sample edge is largely a fit to estimation error, and out of sample that edge reverses. In-sample superiority of the unconstrained book is expected and is not evidence.`,
    trap: `Answering only "constraints control risk" or "compliance requires it". True but shallow - it concedes that constraints cost performance. The point being tested is that constraints frequently IMPROVE out-of-sample performance because they regularize noisy inputs. Missing that marks you as someone who would quietly loosen the caps to chase the backtest.`,
    followUp: `If constraints are just crude shrinkage, why not drop them and do the shrinkage properly in the covariance estimator? What do explicit constraints still buy you that a better estimator cannot?`,
  },
  {
    id: "qr-portfolio-12-factor-covariance",
    module: "portfolio",
    title: "Factor-model covariance",
    difficulty: "hard",
    question: `You need a covariance matrix for a 3,000-stock universe and the sample estimate is hopeless. Walk me through the factor-model construction and why it is both estimable and invertible.`,
    thinking: `Start with parameter counting, because that is the disease being cured. A 3,000-stock covariance has about 4.5 million free parameters; you have perhaps 250 recent, relevant daily observations per stock. No estimator survives that ratio without structure. The factor model asserts returns are driven by K common factors (market, size, value, momentum, industries - K around 10 to 70) plus independent stock-specific noise. Then covariance = B F B-transpose + D: loadings matrix times a small K-by-K factor covariance plus a diagonal of specific variances. Parameter count collapses to roughly N times K plus K squared plus N - tens of thousands, not millions. Invertibility comes free: D's strictly positive diagonal makes the whole matrix positive definite, and the Woodbury identity inverts it cheaply. The price is model risk: any correlation your factors miss - a crowded trade, a thematic link - is invisible to the optimizer.`,
    answer: `Assume K common factors drive returns: covariance = B F Bt + D, where B is N-by-K loadings, F is the small factor covariance, and D is diagonal specific variance. Parameters drop from about 4.5 million to tens of thousands, so 250 observations suffice; and D's positive diagonal guarantees positive definiteness, so the inverse always exists and is cheap via Woodbury. The cost is model risk: correlations outside the factor structure are invisible.`,
    python: `import numpy as np
rng = np.random.default_rng(2)
N, K, T = 500, 10, 252

# in practice B comes from time-series regressions on factor returns
# or from a vendor model (Barra-style fundamental loadings)
B = rng.normal(size=(N, K))                  # factor loadings
f = rng.normal(0.0, 0.01, size=(T, K))       # factor return history
F = np.cov(f, rowvar=False) * 252            # KxK: only K*(K+1)/2 = 55 params
spec = rng.uniform(0.02, 0.10, N)            # specific variances, N params

Sigma = B @ (F @ B.T)                        # systematic part, rank K
Sigma[np.arange(N), np.arange(N)] += spec    # + diagonal D -> full rank

print(np.linalg.eigvalsh(Sigma).min() > 0)   # True: positive definite
# param count: N*K + K*(K+1)/2 + N = 5555 vs N*(N+1)/2 = 125,250
# for N=3000: ~33k vs ~4.5M -- the difference between estimable and not.`,
    trap: `Forgetting that everything off-structure is assumed away: D is diagonal, so any residual correlation between two stocks not captured by the factors is modeled as zero. Crowded trades and thematic baskets live exactly there - the factor model says the position is diversified while the crowd heads for the same exit.`,
    followUp: `Your optimizer systematically loads up on whatever the factor model cannot see - alpha orthogonal to the risk model looks free. How do you detect and manage this "alpha eats the residual" failure mode?`,
  },
  {
    id: "qr-portfolio-13-no-trade-band",
    module: "portfolio",
    title: "No-trade bands",
    difficulty: "hard",
    question: `Every day your book drifts slightly from target and your execution desk asks whether to trade it back. Costs are real. Describe a no-trade band policy and how you would size the band.`,
    thinking: `Set up the asymmetry first: the cost of trading is certain and paid immediately; the benefit of correcting a small deviation is a tiny expected-alpha and risk improvement that is itself noisy. For small deviations the certain cost exceeds the uncertain benefit, so the optimal policy has a region of inaction - a band around the target inside which you do nothing. Classic transaction-cost theory (Constantinides, Davis-Norman) formalizes this: with proportional costs the solution is exactly a no-trade region, and you trade only to the nearest EDGE of the band, not back to its center - trading to center overshoots into freshly paid costs. Band width scales up with cost rate and down with the penalty for being off-target (risk aversion times variance of the drift, and alpha decay speed). Practically: simulate net Sharpe across band widths, expect a broad plateau, and pick the wide end.`,
    answer: `Define a band around each target weight - say plus or minus 50 bps or a risk-scaled equivalent - and do nothing while positions sit inside it. When a position exits the band, trade only back to the band edge, not to target: to the edge captures most of the benefit at minimum cost, and trading to center is provably wasteful under proportional costs. Size the band on cost rate versus the risk and alpha penalty of drifting, and validate by sweeping band width on net-of-cost performance.`,
    python: `import numpy as np
# current, target: weight vectors for one rebalance decision
band = 0.005                       # half-width: 50 bps of book per name

drift = current - target
outside = np.abs(drift) > band     # only these names justify paying costs

# trade to the band EDGE, not to target: classic proportional-cost result
# (trading to center = paying extra cost to buy back optionality you
#  will burn again tomorrow)
edge = target + np.sign(drift) * band
new_w = np.where(outside, edge, current)

traded = np.abs(new_w - current).sum()      # two-sided turnover this decision
# sizing the band: wider when costs are high, narrower when the alpha
# decays fast or the name is volatile (drifts hurt more). in practice:
# sweep band in {10, 25, 50, 100} bps and pick the wide end of the
# net-sharpe plateau.`,
    trap: `Trading back to the target instead of the band edge. It feels tidier and it is measurably wrong: you pay extra cost now to buy distance from the band that tomorrow's drift consumes anyway. Under proportional costs the optimal action never enters the interior of the band.`,
    followUp: `Your costs are not proportional - there is a fixed ticket cost per order too. How does the optimal policy change, and why does it now trade past the edge into the band?`,
  },
  {
    id: "qr-portfolio-20260808-black-litterman",
    module: "portfolio",
    title: "Black-Litterman: blending views with the prior",
    difficulty: "core",
    question: `Your team has a signal-implied expected return vector, but you know raw mean-variance on top of it produces the usual corner-heavy, unstable weights. Someone suggests Black-Litterman. Explain the core idea in a minute, without the matrix algebra.`,
    thinking: `Black-Litterman is not a different optimizer -- it is a smarter way to construct the expected-return INPUT that mean-variance is so sensitive to. Start from a neutral, stable prior: reverse-optimize the market-cap-weighted portfolio to find the expected returns that WOULD justify it under a chosen risk aversion. That prior is, by construction, close to well-diversified weights, because it is derived from a well-diversified portfolio. Then treat your signal's views as a Bayesian update on top of that prior, where your confidence in each view controls how far the posterior gets pulled away from the market anchor. Because the optimizer starts from an already-stable, diversified estimate rather than a noisy raw sample mean, even a fully confident view only pulls the result toward what your signal says -- it does not reintroduce the instability of feeding raw historical means straight into mean-variance. That is the whole intuition for why Black-Litterman weights look far saner than naive optimization.`,
    answer: `Black-Litterman does not replace the optimizer -- it replaces the noisy expected-return input. It starts from a stable prior (the returns implied by reverse-optimizing the market-cap portfolio), then Bayesian-updates that prior with your views, weighted by your confidence in each. Because the starting point is already diversified and stable, the posterior stays tame even with confident views, unlike feeding raw signal means or raw historical means directly into mean-variance.`,
    python: `import numpy as np

# --- step 1: reverse-optimize the market-implied prior ---
# w_mkt: market-cap weights, Sigma: covariance, delta: risk aversion
delta = 2.5
pi = delta * Sigma @ w_mkt              # implied equilibrium returns (the prior)

# --- step 2: express views as a linear pick matrix P, view returns Q ---
# example: one relative view -- asset 0 outperforms asset 1 by 2% annualized
P = np.array([[1.0, -1.0, 0.0]])
Q = np.array([0.02])
tau = 0.05                              # scales prior uncertainty (small = confident prior)
omega = np.diag(np.diag(P @ (tau * Sigma) @ P.T))   # view uncertainty from view variance

# --- step 3: Bayesian blend of prior and views ---
inv_term = np.linalg.inv(np.linalg.inv(tau * Sigma) + P.T @ np.linalg.inv(omega) @ P)
mu_bl = inv_term @ (np.linalg.inv(tau * Sigma) @ pi + P.T @ np.linalg.inv(omega) @ Q)
# mu_bl feeds the SAME mean-variance optimizer -- only the input changed`,
    trap: `Treating Black-Litterman as "just another optimizer" and skipping the market-prior step -- feeding it raw signal-implied expected returns as if they were the view on EVERY asset with full confidence. That collapses back to plain mean-variance on noisy inputs, with the same instability, just more machinery.`,
    followUp: `How would you set the confidence, omega, on your own signal's view within Black-Litterman, and what happens to the posterior as that confidence goes to zero versus infinity?`,
  },
];
