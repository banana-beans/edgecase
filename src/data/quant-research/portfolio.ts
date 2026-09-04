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
  {
    id: "qr-portfolio-20260809-kelly-criterion",
    module: "portfolio",
    title: "Kelly criterion: why full Kelly is too aggressive",
    difficulty: "warmup",
    question: `For a repeated bet with edge (probability of winning p, even-money payoff), the Kelly criterion says bet a fraction f = 2p - 1 of your bankroll to maximize long-run growth rate. A junior researcher proposes sizing every position at its full Kelly fraction. What goes wrong in practice, and what do practitioners actually do?`,
    thinking: `Start from what Kelly optimizes: expected LOG growth rate of bankroll, which is the right objective only if you know p exactly and the bets are the sequential, reinvest-everything kind the derivation assumes. Neither holds in real trading. Estimated edge is noisy -- p is really p-hat, a sample estimate with its own standard error -- and Kelly sizing is punishing in the wrong direction: overestimating your edge even slightly pushes the Kelly fraction toward or past the true optimum, and betting more than the TRUE Kelly fraction does not just reduce growth a little, it can make growth NEGATIVE even though your true edge is positive, because the position becomes large enough that its own variance dominates. There is also a practical-drawdown problem separate from estimation error: full Kelly portfolios experience enormous drawdowns even with perfectly known parameters, which no real allocator tolerates. The standard response is fractional Kelly -- betting a quarter to a half of the computed size -- trading some growth rate for a large reduction in variance and estimation-error fragility.`,
    answer: `Full Kelly assumes you know your true edge exactly; in practice the edge is an estimate, and overbetting past the true optimal fraction can turn a genuinely positive edge into negative realized growth, while underbetting only costs growth rate linearly. Even with perfectly known parameters, full Kelly portfolios carry drawdowns far beyond what any real allocator tolerates. Practitioners use fractional Kelly -- typically a quarter to a half of the computed fraction -- trading some growth rate for a large reduction in variance and estimation-error fragility.`,
    python: `import numpy as np

def kelly_fraction(p, b=1.0):
    # b: payoff odds (b=1 for even money). Full Kelly fraction of bankroll.
    q = 1 - p
    return p - q / b

def simulate_growth(p_true, f, n_bets=2000, trials=500, seed=0):
    rng = np.random.default_rng(seed)
    wins = rng.random((trials, n_bets)) < p_true
    growth = np.where(wins, np.log(1 + f), np.log(1 - f))
    return growth.sum(axis=1).mean() / n_bets     # avg log growth per bet

p_true = 0.55                        # true edge, unknown in practice
f_full = kelly_fraction(p_true)      # 0.10 -- "true" full Kelly

# what happens if your ESTIMATE of p overshoots slightly, and you bet
# full Kelly on the estimate instead of the truth:
for p_hat in [0.53, 0.55, 0.58, 0.65]:
    f_bet = kelly_fraction(p_hat)                       # sized on the estimate
    g = simulate_growth(p_true, f_bet)                  # but TRUE edge is 0.55
    print(round(p_hat, 2), round(f_bet, 3), round(g, 5))
# overestimating p pushes f_bet past the true optimum -- growth degrades,
# and can go negative well before f_bet reaches 1.0

# fractional Kelly: deliberately undersize to buy robustness
f_half = 0.5 * f_full
print("half-Kelly growth:", round(simulate_growth(p_true, f_half), 5))`,
    trap: `Computing Kelly fractions per-position independently across a multi-asset book and summing them, ignoring correlation between positions. Kelly sizing is derived for a single repeated bet; a portfolio of correlated positions each sized at its own standalone Kelly fraction can carry far more joint risk than any single-asset Kelly calculation accounted for.`,
    followUp: `How would you extend Kelly sizing to a book of several correlated signals at once, and what quantity from the portfolio-construction toolkit does that generalization end up needing?`,
  },
  {
    id: "qr-portfolio-20260810-covariance-shrinkage",
    module: "portfolio",
    title: "Ledoit-Wolf shrinkage vs the sample covariance matrix",
    difficulty: "core",
    question: `You estimate a 500-stock covariance matrix from 3 years of daily returns, about 750 observations, and feed it straight into a mean-variance optimizer. The resulting weights are wild and concentrated in a handful of names with suspiciously tiny estimated variance. What is going wrong, and how does shrinkage estimation like Ledoit-Wolf fix it?`,
    thinking: `Count degrees of freedom before blaming the optimizer: a 500-by-500 covariance matrix has roughly 125,000 free parameters (N times N+1 over 2), estimated from only 750 observations -- badly underdetermined, and the sample covariance matrix is provably the worst-conditioned estimate consistent with the data in exactly this regime, with its smallest eigenvalues systematically biased toward zero and largest eigenvalues biased upward, pure estimation noise rather than real structure. A mean-variance optimizer actively hunts for combinations with the smallest estimated variance, so it disproportionately loads onto whichever noise-driven near-zero eigenvalue looks cheapest -- concentrated weights in a handful of names are the signature of an optimizer exploiting estimation error, not genuine diversification insight. Shrinkage estimation, Ledoit-Wolf being the standard data-driven version, pulls the sample covariance toward a simpler, lower-variance target (often constant correlation) with a shrinkage intensity chosen to minimize expected estimation error -- trading a little bias for a large reduction in variance, directly countering what the optimizer was exploiting.`,
    answer: `With 500 assets and 750 observations, the sample covariance matrix has far more free parameters than data can pin down, so its smallest eigenvalues are pushed toward zero purely by estimation noise -- and a mean-variance optimizer actively seeks out exactly those noise-driven "cheap" combinations, producing the wild, concentrated weights you are seeing. Ledoit-Wolf shrinkage pulls the sample covariance toward a simpler, lower-variance target such as constant correlation, with the shrinkage intensity chosen to minimize expected estimation error -- trading a small amount of bias for a large reduction in the noise the optimizer would otherwise chase.`,
    python: `import numpy as np
from sklearn.covariance import LedoitWolf

# rets: 750 x 500 array of daily returns (obs x assets) -- N close to T,
# the classic regime where the sample covariance is dangerously noisy
rng = np.random.default_rng(0)
rets = rng.standard_normal((750, 500)) * 0.01

sample_cov = np.cov(rets, rowvar=False)
eigs_sample = np.linalg.eigvalsh(sample_cov)
print("sample cov smallest/largest eig:", eigs_sample[0], eigs_sample[-1])
# smallest eigenvalues pinned near zero -- pure noise, not real near-zero risk

lw = LedoitWolf().fit(rets)
shrunk_cov = lw.covariance_
print("shrinkage intensity chosen:", round(lw.shrinkage_, 3))

eigs_shrunk = np.linalg.eigvalsh(shrunk_cov)
print("shrunk cov smallest/largest eig:", eigs_shrunk[0], eigs_shrunk[-1])
# spectrum is compressed toward the target -- the optimizer has far less
# spurious near-zero risk to exploit`,
    trap: `"Fixing" the ill-conditioned matrix by adding a small constant to the diagonal, chosen by trial and error until the optimizer's weights look reasonable. That is shrinkage without a principled target or a data-driven intensity -- it works by accident for one dataset and needs re-tuning by eye every time the universe or window changes, whereas Ledoit-Wolf's intensity is derived to minimize expected estimation error and requires no manual tuning.`,
    followUp: `Your universe has clear sector structure. Would you shrink toward a constant-correlation target, or toward a factor-model-implied covariance instead, and what does each target assume that the other does not?`,
  },
  {
    id: "qr-portfolio-20260811-hrp",
    module: "portfolio",
    title: "Hierarchical Risk Parity: allocating without inverting",
    difficulty: "hard",
    question: `Your covariance matrix is already Ledoit-Wolf shrunk, but mean-variance optimization on a 200-stock universe still produces concentrated, unstable weights. A colleague suggests Hierarchical Risk Parity instead of any matrix-inversion-based optimizer. What is the core idea, and why does avoiding inversion actually help?`,
    thinking: `Trace the disease back to its mechanism: mean-variance optimization, even fed a shrunk covariance matrix, still needs the matrix's INVERSE, and matrix inversion is precisely the operation that amplifies estimation error along near-collinear or low-variance directions -- the same error-maximization mechanism from the earlier two-highly-correlated-assets card, just at 200-asset scale instead of two. Shrinkage helps by improving the matrix being inverted, but it does not remove the inversion step or its error-amplifying structure. Hierarchical Risk Parity, from Lopez de Prado, sidesteps inversion entirely with three steps: first, cluster the assets into a hierarchy (a dendrogram) using a correlation-based distance, so similar, substitutable assets group together; second, reorder the covariance matrix according to that hierarchy via quasi-diagonalization, placing similar assets near each other; third, allocate risk top-down through the tree via recursive bisection -- at each split, divide the current risk budget between the two child clusters in inverse proportion to their own variances, recursing down to individual assets. The only matrix operations used anywhere are variances of small sub-groups of assets, never a full-matrix inverse -- so noisy near-zero eigenvalues in the full covariance matrix never get the chance to blow up into extreme weights the way they do under direct inversion. The clustering step also uses only the RANK structure of correlations to decide groupings, which is more robust to estimation noise than trusting the exact magnitudes an inverted matrix depends on.`,
    answer: `Mean-variance still needs the covariance matrix's inverse even after shrinkage, and inversion is exactly what amplifies estimation error along noisy, near-collinear directions. HRP never inverts the full matrix at all: it clusters assets into a hierarchy by correlation-based distance, reorders the matrix to place similar assets together, then allocates risk top-down through the tree by recursive bisection -- splitting the budget between two clusters inversely to their own variances, all the way down to single assets. The only matrix operations are variances of small sub-groups, so a noisy near-zero eigenvalue in the full matrix never gets the chance to explode into an extreme weight the way direct inversion allows.`,
    python: `import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import linkage

# rets: dates x assets returns; cov, corr computed as usual
rng = np.random.default_rng(3)
T, N = 500, 8
rets = pd.DataFrame(rng.normal(0, 0.01, size=(T, N)))
cov = rets.cov()
corr = rets.corr()

# step 1: correlation-based distance, then hierarchical clustering
dist = np.sqrt(0.5 * (1 - corr))                 # a valid distance from correlation
link = linkage(dist.values[np.triu_indices(N, 1)], method="single")

# steps 2-3: recursive bisection down the cluster tree -- simplified,
# illustrative version (no quasi-diagonal reordering shown)
def cluster_var(cov, items):
    sub = cov.loc[items, items]
    ivp = 1.0 / np.diag(sub)                     # inverse-variance WITHIN the cluster
    w = ivp / ivp.sum()
    return w @ sub.values @ w                     # cluster's own variance, no full inverse

def recursive_bisection(cov, items):
    w = pd.Series(1.0, index=items)
    clusters = [items]
    while not all(len(c) == 1 for c in clusters):
        clusters = [c[i:j] for c in clusters for i, j in
                    ((0, len(c) // 2), (len(c) // 2, len(c))) if len(c[i:j]) > 0]
        for i in range(0, len(clusters), 2):
            if i + 1 >= len(clusters):
                continue
            c0, c1 = clusters[i], clusters[i + 1]
            v0, v1 = cluster_var(cov, c0), cluster_var(cov, c1)
            alpha = 1.0 - v0 / (v0 + v1)          # more variance -> less budget
            w[c0] *= alpha
            w[c1] *= (1.0 - alpha)
    return w

weights = recursive_bisection(cov, list(cov.columns))
print(weights.round(3))`,
    trap: `Treating HRP as needing no covariance estimate at all, the same way naive risk parity is sometimes oversimplified to plain inverse-volatility weighting. HRP still uses the covariance matrix at every step -- for the correlation distances that build the clustering, and for the small sub-group variances used in the recursive bisection -- it is only the FULL-MATRIX inverse that is avoided, so garbage-in on the covariance estimate itself still degrades HRP, just less catastrophically than it degrades direct mean-variance.`,
    followUp: `How would you actually validate that HRP produces more stable out-of-sample weights than shrunk mean-variance, rather than taking the claim on faith? (Bootstrap resample the return history many times, build both sets of weights on each resample, and compare the variance of the resulting weight vectors across resamples -- Lopez de Prado's own methodology for demonstrating HRP's stability advantage.)`,
  },
  {
    id: "qr-portfolio-20260812-vol-targeting",
    module: "portfolio",
    title: "Volatility targeting with trailing realized vol",
    difficulty: "core",
    question: `Your strategy's raw signal produces a position, but its realized volatility swings between 8% and 25% annualized across different market regimes, making risk hard to budget for. You're asked to add volatility targeting so it runs at a steady 12% annualized vol. How do you implement it, and what's the main pitfall?`,
    thinking: `Vol targeting scales the position each period by target_vol divided by a trailing realized-vol estimate, so you lever up when recent vol has been low and delever when it's been high, aiming to hold forward-looking risk roughly constant. The estimate itself -- an EWMA or rolling std of past returns, annualized -- is necessarily backward-looking, and that is the core pitfall: on a sudden vol spike, you're still scaled up from yesterday's calm reading right as the spike hits, then you delever right as it subsides, a reactive rather than predictive pattern that can hurt most on the days that matter. A second, more mechanical pitfall: an unbounded scale factor. If trailing vol reads near zero during a quiet stretch, target_vol divided by it can produce an absurd leverage multiple, so the scale needs a hard cap.`,
    answer: `Scale the position each period by target_vol divided by a trailing realized-vol estimate (an EWMA or rolling std of past returns, annualized), so you lever up in calm regimes and delever in turbulent ones. Main pitfall: the estimate is backward-looking, so on a sudden vol spike you're still scaled up from yesterday's calm reading right as the spike hits, then you delever right as it subsides -- reactive, not predictive, and it can hurt most on the days that matter. Always cap the leverage multiplier too, or a quiet-period trailing vol near zero produces an absurd scale-up.`,
    python: `import pandas as pd
import numpy as np

rets = pd.Series(strategy_returns)   # raw strategy daily returns, unscaled

TARGET_VOL = 0.12
LOOKBACK = 20             # ~1 trading month; shorter = more reactive, noisier
MAX_LEVERAGE = 3.0         # hard cap -- prevents a near-zero vol reading from
                           # producing an absurd scale factor

# trailing realized vol, annualized; shift(1) so today's scale uses only
# information available BEFORE today's return is known
trailing_vol = (rets.rolling(LOOKBACK).std() * np.sqrt(252)).shift(1)

scale = (TARGET_VOL / trailing_vol).clip(upper=MAX_LEVERAGE)
scaled_rets = rets * scale

# check it actually worked: realized vol should now cluster near target,
# though never exactly -- the estimator always lags true regime changes
realized_after = scaled_rets.std() * np.sqrt(252)`,
    trap: `Forgetting the shift(1) on the vol estimate, so today's scale factor is computed using a rolling window that includes today's own return. That leaks today's realized outcome into today's sizing decision -- the backtest looks smoother and better than any live implementation could ever be.`,
    followUp: `During a sudden vol spike, your scaled strategy delevers a day late every time, and a colleague suggests switching from a rolling window to an EWMA with a short halflife to react faster. What does that trade away in calm periods?`,
  },
  {
    id: "qr-portfolio-20260813-long-only-corner-solution",
    module: "portfolio",
    title: "Long-only constraints and the corner solution problem",
    difficulty: "warmup",
    question: `Your unconstrained mean-variance optimizer wants to short several names to hedge the book, but the fund is long-only. You add the constraint weights >= 0 and re-optimize. The resulting portfolio holds a large position in just a handful of names and zero in most others, even though your alpha signal was smoothly graded across the whole universe. Why does that happen, and is it a bug?`,
    thinking: `Not a bug -- it is what a quadratic program with an inequality constraint does structurally. The unconstrained mean-variance solution is a smooth linear function of the expected-return vector, so a smoothly-graded alpha signal naturally produces smoothly-graded weights. Add weights >= 0 and the geometry changes: whenever the unconstrained optimum wants a negative weight on some name, most likely because it is a good short-side hedge for the rest of the book, the constrained optimum cannot honor that, so the solver pushes that weight to exactly its boundary, zero, rather than to some small positive compromise. With enough names hitting their zero boundary simultaneously, weight has to concentrate somewhere to satisfy the budget and risk targets, and it concentrates on whichever remaining names are most useful for risk reduction -- producing a small set of large positions even from smooth input alpha. This is the textbook "corner solution" of constrained quadratic optimization: the constraint doesn't gently dampen the extreme names, it clips them to a hard boundary, and the freed-up risk budget has to go somewhere.`,
    answer: `Not a bug -- it is the geometry of a quadratic program under an inequality constraint. The unconstrained optimum wanted negative weight on several names as hedges; long-only clips each of those to exactly zero rather than some smoothed-down small value, and the risk budget that would have gone to those hedges concentrates instead into whichever remaining names are most useful for reducing portfolio risk, even though the input alpha was smooth. This "corner solution" behavior is standard for constrained mean-variance and is a direct consequence of adding a hard boundary, not evidence something is broken.`,
    python: `import numpy as np
from scipy.optimize import minimize

rng = np.random.default_rng(0)
n = 8
alpha = np.linspace(-0.02, 0.03, n)          # smoothly graded, includes negatives
cov = 0.02 * np.eye(n) + 0.005 * np.ones((n, n))

def neg_utility(w, risk_aversion=5.0):
    return -(w @ alpha - 0.5 * risk_aversion * w @ cov @ w)

budget = {"type": "eq", "fun": lambda w: w.sum() - 1.0}

unconstrained = minimize(neg_utility, x0=np.full(n, 1 / n), constraints=[budget])
long_only = minimize(neg_utility, x0=np.full(n, 1 / n), constraints=[budget],
                      bounds=[(0, None)] * n)   # weights >= 0

print("unconstrained weights:", unconstrained.x.round(3))
print("long-only weights:    ", long_only.x.round(3))
# negative-alpha names go to exactly 0.0 under long-only, not a small
# damped value -- and the freed budget concentrates on the top few names`,
    trap: `Reading concentrated long-only weights as a sign the optimizer is broken or the covariance estimate is unstable, and reaching straight for shrinkage or position caps to "fix" it. The concentration here is a direct, correct consequence of the long-only constraint itself -- caps and shrinkage may still be worth adding for other reasons, but they are not fixing a bug.`,
    followUp: `Adding sector caps on top of the long-only constraint reduces the concentration somewhat but doesn't eliminate it. Why do sector caps only partially address a problem that is fundamentally about individual-name corner solutions, not sector-level ones?`,
  },
  {
    id: "qr-portfolio-20260814-gross-vs-net-exposure",
    module: "portfolio",
    title: "Gross exposure vs net exposure",
    difficulty: "core",
    question: `Your long-short book has weights summing to +0.08 net but the risk desk flags it as running 1.4x gross. Explain the difference between those two numbers to a risk manager who's only seen the net figure, and why both matter.`,
    thinking: `Net exposure is sum(weights) -- longs minus shorts, the book's directional tilt to the market. Gross is sum(abs(weights)) -- total capital deployed on both sides regardless of direction. A book can look nearly flat on net (+0.08 here) while running heavy gross (1.4x, meaning $1.40 of positions per $1.00 of capital via leverage), because a big long book and big short book cancel out in the net number but both still carry real single-name risk, financing cost, margin requirements, and squeeze/blowup exposure independent of market direction. Net tells you your directional market bet; gross tells you your total risk budget and leverage. A risk manager tracking only net can miss a book that's market-neutral but dangerously overlevered and concentrated.`,
    answer: `Net = sum(weights), the book's directional market tilt. Gross = sum(abs(weights)), total capital deployed long plus short regardless of direction. This book is nearly flat on net (+0.08) but running 1.4x gross -- $1.40 of positions per $1.00 of capital via leverage -- because large long and short books cancel in the net number while both still carry real single-name and financing risk. Net measures market-direction risk; gross measures total leverage and concentration risk.`,
    python: `import pandas as pd

weights = pd.Series({"AAPL": 0.15, "MSFT": 0.10, "TSLA": -0.20, "META": -0.05, "NVDA": 0.08})

gross = weights.abs().sum()   # total capital deployed, long + short, sign-blind
net = weights.sum()           # directional market exposure, longs minus shorts

print("gross:", round(gross, 3))   # 0.58
print("net:", round(net, 3))       # 0.08

# scaling to a gross target does NOT fix net -- it scales both sides together
target_gross = 1.0
scaled = weights * (target_gross / gross)
print("scaled gross:", round(scaled.abs().sum(), 3))   # 1.0, exactly on target
print("scaled net:", round(scaled.sum(), 3))            # 0.138, still proportionally biased`,
    trap: `Reporting only net exposure to a risk committee -- a book can be perfectly market-neutral on net while running dangerous leverage and single-name concentration that only shows up in gross.`,
  },
  {
    id: "qr-portfolio-20260815-tracking-error-constraint",
    module: "portfolio",
    title: "Tracking-error-constrained optimization vs a benchmark",
    difficulty: "hard",
    question: `You're building a long-only portfolio benchmarked against the S&P 500 under a mandate that caps annualized tracking error at 4%. How does adding that constraint change the optimization compared to a plain min-variance or max-Sharpe formulation, and what happens at the constraint boundary?`,
    thinking: `A plain min-variance or max-Sharpe optimization is about absolute risk and return. A tracking-error mandate is inherently relative: it cares about the variance of (your weights minus the benchmark's weights), using the same covariance matrix but applied to active weights instead of total weights. So the natural formulation maximizes expected active return -- active weights dotted with your alpha view -- subject to active-weight variance staying under TE^2. Now reason about the boundary, because that is where intuition pays off in an interview: when the constraint binds, the solution is the benchmark weights plus an alpha-driven tilt, scaled down uniformly until active variance exactly hits the cap. Tightening TE doesn't change which names you tilt toward or away from -- your alpha view sets the direction -- it just shrinks how far you can tilt, in the simplest case with no other binding constraints. It's the same mean-variance geometry as an unconstrained frontier, just re-centered on the benchmark instead of on cash.`,
    answer: `The objective and constraint both become benchmark-relative: maximize active-weight alpha (portfolio minus benchmark weights, dotted with your return forecast) subject to the variance of that active-weight vector staying under TE^2, using the same covariance matrix restricted to active weights. At a binding constraint, the optimal portfolio is the benchmark weights plus your alpha tilt, scaled down uniformly until active variance exactly hits the cap -- tightening TE shrinks the size of every bet proportionally rather than changing which names you're tilted toward.`,
    python: `import numpy as np

# active weights: how far the portfolio sits from the benchmark, per name
w, w_bench = np.array([0.05, 0.03, 0.02]), np.array([0.04, 0.04, 0.02])
active = w - w_bench
cov = np.array([[0.04, 0.01, 0.00],
                [0.01, 0.03, 0.01],
                [0.00, 0.01, 0.02]])

# tracking error: sqrt of active-weight variance, annualized by sqrt(252)
daily_te_var = active @ cov @ active
annualized_te = np.sqrt(daily_te_var * 252)

# the mandate's cap (e.g. 4%) bounds THIS quantity, not the portfolio's
# absolute (total) volatility
print(annualized_te)`,
    trap: `Capping tracking error and assuming that alone limits total portfolio risk. TE only measures co-movement with the benchmark, so the optimizer can satisfy a tight TE cap while still concentrating enormous idiosyncratic (stock-specific) risk in low-covariance names -- a TE constraint needs to be paired with absolute position or concentration limits, not used alone.`,
    followUp: `Once TE is fixed by mandate, what single ratio captures how efficiently you're using that risk budget, and how does it relate to the Sharpe ratio you'd compute on absolute returns?`,
  },
  {
    id: "qr-portfolio-20260816-pairs-hedge-ratio-cointegration",
    module: "portfolio",
    title: "Computing a hedge ratio for a pairs trade",
    difficulty: "core",
    question: `You want to trade a mean-reverting spread between two cointegrated stocks, A and B. How do you compute the hedge ratio, and why is regressing A on B different from regressing B on A -- does it matter which one you pick?`,
    thinking: `The hedge ratio beta answers "how many units of B do I short per unit of A I'm long, so the combination A minus beta times B is stationary -- mean-reverting -- rather than trending like each leg does on its own". The natural first move is OLS: regress A's price series on B's, and beta is the slope. But OLS regression is NOT symmetric -- regressing A on B minimizes vertical (A-direction) squared errors, while regressing B on A minimizes errors along the other axis, and the two give genuinely different slopes whenever the series aren't perfectly correlated, which they never are. For hedging purposes alone it usually doesn't matter enormously which leg is the dependent variable, but it matters a lot for TESTING whether the pair is actually cointegrated: the Engle-Granger result -- does the resulting spread pass an ADF stationarity test -- can differ by regression direction, so professional practice tests both directions, or better, uses the symmetric Johansen procedure, which doesn't force an arbitrary choice of dependent variable in the first place.`,
    answer: `The hedge ratio is the OLS slope from regressing one price series on the other; the resulting spread (A minus beta times B) should be stationary if the pair is cointegrated. Regression direction matters: A-on-B and B-on-A minimize errors along different axes and give different slopes, and can even disagree on whether the resulting spread passes an Engle-Granger/ADF stationarity test. In practice, test cointegration both directions, or use the symmetric Johansen procedure, which doesn't force an arbitrary choice of dependent variable.`,
    python: `import statsmodels.api as sm
from statsmodels.tsa.stattools import coint, adfuller

# price_a, price_b: aligned daily price series for the two names
X = sm.add_constant(price_b)
model_ab = sm.OLS(price_a, X).fit()
beta_ab = model_ab.params.iloc[1]         # long A, short beta_ab units of B
spread_ab = price_a - beta_ab * price_b

# the OTHER direction gives a different slope in general
X2 = sm.add_constant(price_a)
model_ba = sm.OLS(price_b, X2).fit()
beta_ba = model_ba.params.iloc[1]
spread_ba = price_b - beta_ba * price_a

# ADF null is "has a unit root" (non-stationary); a low p-value
# REJECTS that, supporting cointegration of the candidate spread
p_ab = adfuller(spread_ab)[1]
p_ba = adfuller(spread_ba)[1]

# statsmodels also ships a direct two-step Engle-Granger test:
eg_stat, eg_pvalue, _ = coint(price_a, price_b)`,
    trap: `Computing the hedge ratio once on the full history and using it statically forever. The true hedge ratio drifts as the two companies' businesses and capital structures evolve -- a production pairs strategy re-estimates beta on a rolling window and has to handle the common case where the pair quietly stops cointegrating altogether.`,
    followUp: `The spread passes the ADF test but its mean-reversion half-life (from an AR(1) fit) is 400 days. Is this pair tradeable? (Probably not economically -- reversion that slow ties up capital far too long relative to realistic holding-period costs and regime risk; tradeable pairs typically need half-lives of days to a few weeks.)`,
  },
  {
    id: "qr-portfolio-20260817-correlation-vs-covariance-inputs",
    module: "portfolio",
    title: "Correlation vs covariance in mean-variance inputs",
    difficulty: "warmup",
    question: `A junior on your team builds a portfolio optimizer that takes a correlation matrix as its risk input instead of a covariance matrix, reasoning that correlation is "cleaner" since it's bounded between -1 and 1. What breaks?`,
    thinking: `Correlation strips out each asset's own volatility -- it only tells you how two assets move together, not how MUCH either one moves. Mean-variance optimization needs to know both: portfolio variance is w' Sigma w where Sigma is the covariance matrix, and covariance between assets i and j is correlation(i,j) times stdev(i) times stdev(j). Feed the optimizer a correlation matrix instead and it implicitly treats every asset as having equal (unit) volatility, so a low-vol utility stock and a high-vol biotech with the same pairwise correlation to the rest of the book get sized as if they carried identical risk -- the optimizer will happily lever up the biotech position because nothing in its risk input says it's riskier. The fix is trivial once you see it: covariance equals D times correlation times D, where D is a diagonal matrix of each asset's stdev -- reconstruct covariance from correlation and a separate vector of volatilities before it ever reaches the optimizer.`,
    answer: `A correlation matrix has no information about each asset's own volatility, so an optimizer fed correlation directly implicitly assumes every asset is equally risky -- it'll oversize genuinely volatile names because nothing tells it they're riskier. Reconstruct the covariance matrix as D @ correlation @ D, where D is a diagonal matrix of each asset's standard deviation, before it goes into the optimizer.`,
    python: `import numpy as np

# corr: (n, n) correlation matrix; vols: (n,) per-asset stdev
corr = np.array([[1.0, 0.3], [0.3, 1.0]])
vols = np.array([0.10, 0.35])   # utility stock vs biotech -- very different vol

# WRONG: feeding correlation straight into a mean-variance optimizer
# implicitly assumes both assets have vol = 1.0

# RIGHT: rescale by each asset's actual volatility to recover covariance
D = np.diag(vols)
cov = D @ corr @ D
# cov[1,1] = 0.35**2 = 0.1225 vs cov[0,0] = 0.10**2 = 0.01 --
# the biotech now correctly looks ~12x riskier on its own, not equal`,
    trap: `Assuming this only matters for the optimizer's output weights. It also silently breaks any risk metric computed off the wrong matrix -- portfolio vol, VaR, risk contributions -- since they all flow from the same Sigma.`,
  },
  {
    id: "qr-portfolio-20260818-marginal-risk-contribution",
    module: "portfolio",
    title: "Marginal contribution to risk: which position is actually driving your vol?",
    difficulty: "core",
    question: `Your long-short book has 40 positions and an annualized portfolio vol of 18%. One position is only 3% of gross exposure but you suspect it's contributing far more than 3% of the risk. How do you actually compute each position's contribution to total portfolio volatility, and why doesn't weight alone tell you this?`,
    thinking: `Weight tells you exposure, not risk contribution, because risk contribution depends on how a position's returns move WITH the rest of the book, not just its size. A small, high-volatility position that's highly correlated with your other big positions can dominate total portfolio vol despite a tiny weight, while a similarly-sized position that's uncorrelated or hedges the book barely moves total vol at all. The clean decomposition: portfolio variance is w' Sigma w, and each position's MARGINAL contribution to portfolio vol is the i-th entry of (Sigma w) divided by total portfolio vol -- the sensitivity of portfolio vol to a small increase in that position's weight. Multiplying that marginal contribution by the position's own weight gives its contribution to TOTAL portfolio vol in the same units, and by construction these contributions sum exactly to total portfolio vol, so you get a full, additive risk breakdown across all 40 names rather than an ad hoc one-off calculation for the suspicious position.`,
    answer: `Weight only captures exposure, not how a position co-moves with the rest of the book -- risk contribution for position i is (Sigma w)_i * w_i / sigma_p, where Sigma is the covariance matrix, w the weight vector, and sigma_p total portfolio vol. This decomposition is exact: contributions sum to sigma_p across all positions, so a small-weight but highly-correlated position can show up with an outsized share of total risk even though its weight alone looks negligible.`,
    python: `import numpy as np
import pandas as pd

tickers = [f"T{i}" for i in range(5)]
weights = pd.Series([0.30, 0.25, 0.20, 0.03, 0.22], index=tickers)  # T3 is the small one

rng = np.random.default_rng(1)
returns = pd.DataFrame(rng.normal(0, 0.01, size=(500, 5)), columns=tickers)
# make T3 highly correlated with T0 (the biggest position) despite its tiny weight
returns["T3"] = 0.9 * returns["T0"] + 0.1 * returns["T3"]

cov = returns.cov() * 252   # annualize
w = weights.values
port_var = w @ cov.values @ w
port_vol = np.sqrt(port_var)

# marginal contribution: sensitivity of portfolio vol to each weight
marginal = (cov.values @ w) / port_vol
# total contribution: marginal * weight, sums exactly to port_vol
contribution_pct = (marginal * w) / port_vol

print(pd.Series(contribution_pct, index=tickers).round(3))
# T3 at 3% weight can easily show 8-10%+ of risk here due to the correlation`,
    trap: `Approximating risk contribution with weight times position volatility alone (ignoring correlation entirely). That number doesn't sum to total portfolio vol and can badly understate a correlated small position's true risk share -- the covariance term, not just the diagonal variance, is what makes the decomposition exact.`,
    followUp: `If you wanted to cut T3's risk contribution without just cutting its weight to zero, what's another lever? (Reduce its correlation-driving exposure directly -- e.g. hedge out the shared factor it has with T0, or size it against a risk budget rather than a notional target, so the position stays but its marginal risk contribution shrinks.)`,
  },
  {
    id: "qr-portfolio-20260819-eigenvalue-clipping",
    module: "portfolio",
    title: "Denoising a covariance matrix with Marchenko-Pastur eigenvalue clipping",
    difficulty: "hard",
    question: `You estimate a 500-asset sample covariance matrix from 750 days of returns for a mean-variance optimizer. Ledoit-Wolf shrinkage helps, but you want to understand mechanically WHY the sample covariance's eigenvalues are unreliable in the first place. Walk through the argument and an alternative fix.`,
    thinking: `With N=500 assets and T=750 observations, the ratio q = N/T is not tiny (about 0.67) -- and random matrix theory says that even if the TRUE covariance matrix were a plain scaled identity (all assets genuinely uncorrelated, equal variance), the SAMPLE covariance's eigenvalues would still spread out over a wide range purely from estimation noise, described by the Marchenko-Pastur distribution -- a known theoretical band that depends only on q and the true variance. Sample eigenvalues falling inside that band are statistically indistinguishable from pure noise; eigenvalues clearly outside it likely reflect genuine common factors (market-wide co-movement, sector clusters). The largest eigenvalues (dominated by real signal) are estimated relatively well; it's the BULK of smaller eigenvalues, individually mostly noise, that an optimizer mistakes for exploitable near-riskless combinations -- the familiar error-maximizer mechanism, now localized to which eigenvalues are the culprit. Fix: eigen-decompose the sample covariance, identify eigenvalues inside the Marchenko-Pastur band, and replace them with their average (preserving total variance) before reconstructing -- more surgical than Ledoit-Wolf's uniform shrinkage, since it treats the few genuinely informative eigenvalues differently from the many noise ones instead of shrinking everything toward the identity by the same amount.`,
    answer: `With N assets and T observations where N/T isn't small, Marchenko-Pastur random matrix theory predicts that even a purely noise covariance matrix produces sample eigenvalues spread across a known theoretical band -- so most of the SMALL eigenvalues of a 500x500 sample covariance are indistinguishable from pure estimation noise, not real risk structure, while only the few largest (market/sector factors) carry real signal. The optimizer treats those noisy small eigenvalues as real, exploitable low-risk directions. Fix: eigen-decompose, replace eigenvalues falling inside the Marchenko-Pastur band with their average, then reconstruct -- more surgical than Ledoit-Wolf's uniform shrinkage since it targets specifically the noisy directions.`,
    python: `import numpy as np

def marchenko_pastur_bounds(n_assets: int, n_obs: int, sigma2: float = 1.0):
    q = n_assets / n_obs
    lam_min = sigma2 * (1 - np.sqrt(q)) ** 2
    lam_max = sigma2 * (1 + np.sqrt(q)) ** 2
    return lam_min, lam_max

def denoise_covariance(cov: np.ndarray, n_obs: int) -> np.ndarray:
    n = cov.shape[0]
    # work in correlation space so the MP bound's sigma2=1 assumption applies
    std = np.sqrt(np.diag(cov))
    corr = cov / np.outer(std, std)

    eigvals, eigvecs = np.linalg.eigh(corr)
    lam_min, lam_max = marchenko_pastur_bounds(n, n_obs)

    # eigenvalues inside the noise band get replaced by their common average,
    # preserving total variance while removing their individually-noisy structure
    noise_mask = (eigvals >= lam_min) & (eigvals <= lam_max)
    if noise_mask.any():
        eigvals = eigvals.copy()
        eigvals[noise_mask] = eigvals[noise_mask].mean()

    corr_clean = eigvecs @ np.diag(eigvals) @ eigvecs.T
    return corr_clean * np.outer(std, std)     # back to covariance units

# usage: cov_clean = denoise_covariance(sample_cov, n_obs=750)`,
    trap: `Clipping eigenvalues to zero instead of to the band's average. Zeroing makes the reconstructed matrix singular or near-singular again -- exactly the invertibility problem denoising was supposed to fix -- while replacing noise eigenvalues with their average preserves the matrix's total variance (trace) and keeps it well-conditioned for the optimizer.`,
    followUp: `How does this interact with Ledoit-Wolf shrinkage -- are they competing techniques or can you use both? (Complementary in principle -- shrinkage pulls the whole matrix toward a structured target uniformly, denoising targets specifically the identified noise eigenvalues -- but stacking both is uncommon and mostly redundant in practice; pick one as your primary robustness layer and validate empirically on out-of-sample portfolio risk before adding the second.)`,
  },
  {
    id: "qr-portfolio-20260820-cvar-optimization",
    module: "portfolio",
    title: "CVaR optimization instead of mean-variance",
    difficulty: "hard",
    question: `Your desk runs a strategy with visibly negatively-skewed, fat-tailed returns (short-vol flavored), and mean-variance optimization -- which only cares about variance -- sizes it as if a 3% daily swing up and a 3% daily swing down were equally bad. A colleague proposes optimizing directly on CVaR (expected shortfall) instead of variance. What does that change about the optimization, and what makes it tractable despite CVaR looking like a much harder object to optimize than a quadratic variance term?`,
    thinking: `First articulate what mean-variance actually optimizes: a quadratic penalty on dispersion, symmetric by construction, so it is blind to skew exactly like the earlier Sharpe-vs-skew card described -- a position that boosts variance via big up-moves is penalized identically to one that boosts it via big down-moves, which is precisely wrong for a negatively-skewed book where the deep left tail is the thing you actually want to control. CVaR optimization instead directly penalizes the average of the worst alpha percent of outcomes -- asymmetric in exactly the way you want, since a symmetric-return asset's CVaR is no worse than its dispersion already implied, while a negatively-skewed asset's CVaR is much worse than its variance alone would suggest. The surprising tractability point: naively, CVaR looks like a hard, non-smooth order-statistic operation over a scenario set -- but Rockafellar and Uryasev showed CVaR minimization reformulates as a LINEAR PROGRAM by introducing one auxiliary threshold variable per scenario, so despite sounding exotic, the actual optimization is solved with the same off-the-shelf convex solvers as a quadratic program, once you have historical or simulated return scenarios to optimize over rather than a closed-form covariance matrix.`,
    answer: `Mean-variance penalizes dispersion symmetrically, so it under-penalizes negatively-skewed strategies relative to their true tail risk -- an up day and an equally-sized down day contribute identically to variance. CVaR optimization instead minimizes the average loss in the worst alpha percent of scenarios, asymmetric by construction and specifically targeting the deep left tail a short-vol book actually has. The surprising part: despite looking like a hard order-statistic optimization, Rockafellar-Uryasev showed CVaR minimization reduces to a LINEAR PROGRAM with one auxiliary variable per scenario -- solved with standard LP solvers over a historical or simulated scenario set, requiring no covariance matrix at all, which also sidesteps the covariance-estimation fragility that plagues mean-variance.`,
    python: `import numpy as np
import cvxpy as cp

# scenarios: T x N matrix of simulated/historical returns per asset
# (CVaR optimization works directly on scenarios, no covariance matrix needed)
T, N = 1000, 5
rng = np.random.default_rng(0)
scenarios = rng.standard_normal((T, N)) * 0.02
scenarios[:, 0] -= (rng.standard_normal(T) < -2.5) * 0.15   # asset 0: fat left tail

alpha = 0.05                      # worst 5% of scenarios define the tail
w = cp.Variable(N)
z = cp.Variable()                 # Rockafellar-Uryasev auxiliary variable (VaR proxy)
u = cp.Variable(T, nonneg=True)   # per-scenario shortfall beyond z

port_loss = -scenarios @ w         # losses (negative of returns) per scenario
constraints = [u >= port_loss - z, cp.sum(w) == 1, w >= 0]

# CVaR = z + (1/(alpha*T)) * sum(u) -- this IS the LP-equivalent objective
cvar = z + cp.sum(u) / (alpha * T)
prob = cp.Problem(cp.Minimize(cvar), constraints)
prob.solve()

print(w.value.round(3))    # underweights the fat-tailed asset far more than
                            # a variance-only optimizer would, at equal mean`,
    trap: `Building the scenario set from a short or non-representative history and treating the resulting CVaR-optimal weights as robust. CVaR optimization needs the tail scenarios to actually be IN your scenario set to protect against them -- if your historical window never contained the strategy's real crash mode, CVaR optimization on that data gives the same false confidence mean-variance would, just dressed in a fancier objective function.`,
    followUp: `Your CVaR-optimized portfolio and your variance-optimized portfolio have nearly identical weights. What does that tell you about the return scenarios you fed in, and what would you check before trusting either result? (It suggests the scenario set doesn't actually contain meaningfully skewed or fat-tailed outcomes for these assets -- check the scenario set's own skewness and kurtosis per asset; if it's close to Gaussian, CVaR and variance optimization are mathematically close to equivalent and you haven't actually tested the tail-robustness claim at all.)`,
  },
  {
    id: "qr-portfolio-20260821-max-diversification",
    module: "portfolio",
    title: "Maximum diversification portfolio vs risk parity",
    difficulty: "warmup",
    question: `You've built risk parity weights (equal risk contribution) for a multi-asset book. A colleague suggests trying the maximum diversification portfolio instead, saying it optimizes a genuinely different objective. What is the maximum diversification portfolio actually maximizing, and how is that different from what risk parity targets?`,
    thinking: `Define the diversification ratio first, since that's the actual objective: the weighted average of each asset's standalone volatility, divided by the portfolio's actual volatility once diversification benefits are netted out. If assets were perfectly correlated, diversification buys nothing and this ratio is 1; the more genuinely uncorrelated the book, the more the denominator shrinks relative to the numerator, and the ratio rises. The maximum diversification portfolio picks weights that maximize exactly this ratio -- it explicitly rewards low pairwise correlation, not just balanced risk contributions. Risk parity, by contrast, targets equal risk contribution from each asset regardless of how correlated they are with each other; two highly-correlated assets can both sit at their target risk-parity weight even though holding both barely diversifies you at all, because risk parity's equal-contribution constraint says nothing directly about the correlation structure being exploited. The two objectives coincide only when all pairwise correlations are equal; otherwise maximum diversification will underweight two assets that move together even if their individual volatilities suggest they deserve big weights, a distinction risk parity does not make.`,
    answer: `The diversification ratio is the volatility-weighted average of assets' standalone volatilities divided by the portfolio's actual netted volatility, and the maximum diversification portfolio picks weights to maximize that ratio directly -- explicitly rewarding low correlation between holdings. Risk parity instead targets equal risk CONTRIBUTION from each asset, which balances how much each position drives portfolio variance but says nothing directly about how correlated the assets are with each other. The two coincide only when all pairwise correlations are equal; otherwise maximum diversification will underweight two assets that move together even at equal standalone risk, because holding both isn't buying much real diversification benefit.`,
    python: `import numpy as np
from scipy.optimize import minimize

vol = np.array([0.15, 0.15, 0.30])                 # asset 3 much more volatile
corr = np.array([[1.0, 0.9, 0.1],                  # assets 1 and 2 highly correlated
                  [0.9, 1.0, 0.1],
                  [0.1, 0.1, 1.0]])
cov = np.outer(vol, vol) * corr

def port_vol(w):
    return np.sqrt(w @ cov @ w)

def diversification_ratio(w):
    return (w @ vol) / port_vol(w)   # standalone vols, weighted, over actual vol

cons = [{"type": "eq", "fun": lambda w: w.sum() - 1.0}]
bounds = [(0, 1)] * 3
w0 = np.array([1 / 3, 1 / 3, 1 / 3])

res = minimize(lambda w: -diversification_ratio(w), w0, bounds=bounds, constraints=cons)
w_maxdiv = res.x
print(w_maxdiv.round(3))
# expect it to lean AWAY from the two highly-correlated assets 1 and 2
# relative to a naive risk-parity weighting on their standalone vols alone`,
    trap: `Assuming maximum diversification is strictly better than risk parity because it directly targets diversification. Maximum diversification is far more sensitive to the estimated correlation matrix, exactly the noisy, hard-to-estimate quantity the portfolio-construction module keeps warning about -- an optimizer chasing low correlation is chasing an even noisier signal than one chasing low variance, so it typically needs shrinkage or a factor-model covariance even more urgently than risk parity does.`,
    followUp: `If two assets are perfectly correlated at 1.0, what happens to their combined weight in the max-diversification solution versus the equal-risk-contribution solution? (Maximum diversification pushes toward treating them as one redundant asset and puts nearly all the combined weight on whichever has lower standalone volatility, since holding both buys zero extra diversification; equal-risk-contribution still tries to give each its own target risk contribution and can end up holding both at meaningful weight, since it never directly penalizes their being redundant with each other.)`,
  },
  {
    id: "qr-portfolio-20260822-turnover-penalty",
    module: "portfolio",
    title: "Turnover penalty: trading off alpha capture against transaction costs in the optimizer",
    difficulty: "core",
    question: `Your mean-variance optimizer re-solves every day and, given noisy alpha estimates, wants to make large trades to chase small forecast changes -- realized transaction costs eat most of the paper alpha. How do you fix this inside the optimization itself, rather than by hand-tuning trade thresholds after the fact?`,
    thinking: `The un-penalized objective -- maximize expected return minus a risk-aversion term times variance -- treats reaching the theoretically optimal weight as free, but every unit of turnover has a real, quantifiable cost: spread, market impact, commissions. The mismatch is that the objective function is missing a term the real P&L actually pays. Fix it by adding that term back in: subtract a transaction-cost estimate, a cost rate times some norm of the trade vector, new weight minus current weight, directly from the objective, so the optimizer only trades when the expected alpha improvement exceeds the modeled cost of getting there. This naturally produces a no-trade region around the current portfolio for weak or noisy signals, with no separate hand-coded threshold needed, because the penalty term itself makes small trades unprofitable inside the same optimization. The harder part in practice is estimating that cost function honestly -- market impact is nonlinear and size-dependent, not the flat linear rate a first pass usually assumes -- and underestimating it hands back exactly the churn problem the penalty was meant to fix.`,
    answer: `Add a transaction-cost term directly to the objective: subtract a cost rate times the norm of the trade vector, new weight minus current weight, from expected return minus the risk penalty, so the optimizer only trades when expected alpha gain exceeds the cost of getting there. This creates an endogenous no-trade region around the current portfolio for weak or noisy signals, with no separate hand-tuned threshold needed. The catch: it only works if the cost function is realistic -- a flat linear cost estimate that's too low reproduces the same churn.`,
    python: `import numpy as np
from scipy.optimize import minimize

n = 5
alpha = np.array([0.02, -0.01, 0.03, 0.00, -0.02])   # noisy forecast returns
current_w = np.array([0.2, 0.2, 0.2, 0.2, 0.2])
cov = np.eye(n) * 0.04   # simplified diagonal risk for illustration
risk_aversion = 5.0
cost_rate = 0.003        # cost per unit of |trade|, e.g. spread + impact estimate

def objective(w, penalize_turnover: bool) -> float:
    ret = alpha @ w
    risk = risk_aversion * (w @ cov @ w)
    obj = ret - risk
    if penalize_turnover:
        turnover = np.abs(w - current_w).sum()   # L1 norm of the trade vector
        obj -= cost_rate * turnover
    return -obj   # minimize the negative

cons = {"type": "eq", "fun": lambda w: w.sum() - 1.0}
bounds = [(0.0, 1.0)] * n

no_penalty = minimize(objective, current_w, args=(False,), bounds=bounds, constraints=cons)
with_penalty = minimize(objective, current_w, args=(True,), bounds=bounds, constraints=cons)

print("turnover without penalty:", round(np.abs(no_penalty.x - current_w).sum(), 3))
print("turnover with penalty:   ", round(np.abs(with_penalty.x - current_w).sum(), 3))
# the penalized solve trades less, especially where alpha is small relative
# to the modeled cost of getting there`,
    trap: `Modeling transaction cost as a flat linear rate per unit traded when real market impact is concave and size-dependent, larger trades cost disproportionately more per share. A linear-cost optimizer still happily executes one giant trade instead of spreading it out, because linear cost carries no extra penalty for concentrating size the way real impact does.`,
  },
  {
    id: "qr-portfolio-20260823-risk-budgeting-across-strategies",
    module: "portfolio",
    title: "Risk budgeting across strategies: capital allocation by risk contribution, not dollar notional",
    difficulty: "core",
    question: `You run three sub-strategies with annualized volatilities of 5%, 12%, and 20%, and allocate them equal dollar notional (one-third each). Is each sub-strategy contributing roughly a third of the total portfolio's risk? If not, how would you size them so each one does?`,
    thinking: `Equal dollar notional is not equal risk the moment the sleeves have different volatilities -- the 20%-vol sleeve swings four times as much per dollar as the 5%-vol one, so at equal notional it dominates the realized variance of the combined book even before accounting for any correlation between sleeves. This is exactly the risk-parity idea applied one level up: instead of position weights within a single portfolio, the "assets" being risk-balanced are entire strategies, and the same marginal-contribution-to-risk math applies, weight times the covariance of that sleeve's returns with the total portfolio's returns, summed to reconstruct total variance. A clean first-pass approximation when sleeve correlations are modest and roughly similar to each other is inverse-vol weighting, size each sleeve inversely proportional to its own volatility, which by itself doesn't perfectly equalize risk contribution once correlations differ meaningfully across pairs, but gets close and is a reasonable starting point before iterating to exact equal-risk-contribution weights numerically.`,
    answer: `No -- equal notional gives risk contributions roughly proportional to each sleeve's own volatility (times its correlation with the total book), so the 20%-vol sleeve dominates realized risk even though all three got equal dollars. Fix with the same risk-parity math used within a single portfolio, but applied to strategy sleeves as the units: size initially by inverse volatility (a 20%-vol sleeve gets a quarter the notional of a 5%-vol sleeve) as a first approximation, then iterate to exact equal marginal risk contribution once sleeve correlations are known and matter.`,
    python: `import numpy as np

vols = np.array([0.05, 0.12, 0.20])          # annualized vol per sleeve
corr = np.array([[1.0, 0.1, 0.0],             # modest, uneven correlation across sleeves
                  [0.1, 1.0, 0.2],
                  [0.0, 0.2, 1.0]])
cov = np.outer(vols, vols) * corr

def risk_contributions(w: np.ndarray, cov: np.ndarray) -> np.ndarray:
    port_var = w @ cov @ w
    marginal = cov @ w                        # d(portfolio variance)/d(w_i), up to a factor of 2
    return w * marginal / port_var            # each sleeve's share of total variance

equal_notional = np.array([1 / 3, 1 / 3, 1 / 3])
print("equal-notional risk shares:", np.round(risk_contributions(equal_notional, cov), 3))
# the 20%-vol sleeve claims far more than a third of total risk

# first-pass fix: inverse-vol weighting, renormalized to sum to 1
inv_vol = (1 / vols) / (1 / vols).sum()
print("inverse-vol weights:       ", np.round(inv_vol, 3))
print("inverse-vol risk shares:   ", np.round(risk_contributions(inv_vol, cov), 3))
# much closer to equal, though not exact once correlations differ across pairs`,
    trap: `Assuming inverse-vol weighting is the finished answer rather than a first approximation. It only equalizes risk contribution exactly when every pairwise correlation between sleeves is identical; with realistic, uneven cross-strategy correlations (say two momentum-flavored sleeves correlated with each other but not with a mean-reversion sleeve), inverse-vol still leaves the more-correlated pair contributing a disproportionate share, and closing that gap needs an iterative equal-risk-contribution solve, not a one-shot formula.`,
  },
  {
    id: "qr-portfolio-20260824-epps-effect",
    module: "portfolio",
    title: "The Epps effect: why intraday correlation looks lower than daily",
    difficulty: "core",
    question: `You estimate the correlation between two similar large-cap tech stocks using 1-minute bars and get 0.35, but using daily bars over the identical period you get 0.75. Which number should you trust, and what's actually causing such a large gap?`,
    thinking: `Resist assuming one measurement is simply wrong -- this gap is a known, named phenomenon, the Epps effect: measured correlation between genuinely co-moving assets systematically shrinks as the sampling interval shrinks, for two compounding reasons. First, asynchronous trading: the two stocks don't print at exactly the same instant, so a 1-minute bar built from "whatever trade last printed at this clock tick" for each name embeds a small lead-lag mismatch -- one bar reflects information a few seconds staler than the other -- and that noise averages out over a full day but dominates over a single minute. Second, microstructure noise like bid-ask bounce is a much larger fraction of a 1-minute return's total variance than of a daily return's, and that noise is uncorrelated across the two names by construction, mechanically diluting any measured correlation between them. Neither effect implies the stocks are "less related" intraday -- it's an artifact of measuring co-movement on a clock too fine for how the two series actually get sampled and printed.`,
    answer: `This is the Epps effect, not a data error: measured correlation between two assets mechanically shrinks as the sampling interval shrinks, even between assets with genuinely stable co-movement. It's driven by asynchronous trading (bars built from whichever trade happened to print at each clock tick embed a lead-lag mismatch that averages away over a full day but dominates over a minute) and by microstructure noise like bid-ask bounce, which is a far larger share of a 1-minute return's variance than a daily return's, and is uncorrelated across names, diluting the measured correlation. The daily figure is closer to the true underlying co-movement; a real high-frequency number needs an asynchronous-aware estimator like Hayashi-Yoshida rather than naive same-clock returns.`,
    python: `import numpy as np
import pandas as pd

rng = np.random.default_rng(0)
n = 20_000

# a single shared factor drives both names -- TRUE underlying correlation
# is high and constant at every frequency, by construction of this simulation
factor = rng.normal(0, 1, n)
a = 0.9 * factor + rng.normal(0, 0.3, n)   # idiosyncratic noise added per name
b = 0.9 * factor + rng.normal(0, 0.3, n)

# stagger b's clock by a couple ticks to mimic asynchronous printing
b_async = np.roll(b, 2)

fine = pd.DataFrame({"a": a, "b": b_async})
coarse = fine.rolling(50).sum().dropna()   # coarser "bars" average the lag away

print(fine["a"].corr(fine["b"]))     # noticeably below the true 0.9-ish co-movement
print(coarse["a"].corr(coarse["b"])) # closer to the true correlation once staleness averages out`,
    trap: `Concluding from the low 1-minute correlation that the two names have "decoupled intraday" and building a hedge or a stat-arb entry rule on that number, when the gap is a mechanical artifact of sampling frequency and microstructure noise rather than a real change in how the two stocks move together.`,
    followUp: `You need a genuinely reliable high-frequency correlation estimate for a pairs strategy that trades intraday. What does the Hayashi-Yoshida estimator do differently from computing correlation on same-clock-time bars, and why does it avoid needing to choose a bar size at all?`,
  },
  {
    id: "qr-portfolio-20260825-multi-horizon-signal-blend",
    module: "portfolio",
    title: "Blending a fast mean-reversion signal with a slow momentum signal",
    difficulty: "core",
    question: `You have two working signals for the same universe: a 2-day mean-reversion signal that decays fast and a 6-month momentum signal that decays slowly. Naively averaging their z-scores into one combined alpha and feeding that straight into the optimizer produces way more turnover than either signal alone would need. Why does combining them this way blow up turnover, and how do you fix the construction?`,
    thinking: `Think about what each signal's own natural trading frequency is before combining anything. The 2-day signal's z-score genuinely changes a lot day to day -- that's not noise, it's the signal doing its job, and trading it fully every day is appropriate FOR IT ALONE, at whatever small size matches its own edge. The 6-month signal barely moves day to day and should barely trade day to day. Averaging the two z-scores into one number and feeding that single blended alpha through one turnover-unaware optimizer forces the SLOW signal's positions to get re-touched every time the FAST signal's z-score jiggles, because the optimizer sees one number and can't tell which part of it is supposed to be sticky and which part is supposed to move. The fix is to separate concerns instead of pre-blending: either size and trade each signal's sleeve through its own turnover-aware process before combining POSITIONS rather than raw z-scores, or keep one optimizer but give it a turnover penalty and let it discover on its own how much to let the fast component move the position versus how much to damp it -- combining at the position or the risk-allocation level, not at the raw-alpha level, is what actually preserves each signal's own trading cadence.`,
    answer: `Averaging the two signals' z-scores into one blended alpha erases the fact that they have different natural rebalancing cadences -- the fast signal's healthy day-to-day movement forces the optimizer to re-touch positions that the slow signal alone would have left untouched, because a single combined number can't tell the optimizer which part of the move is meant to be sticky. Fix by combining at the position level instead of the alpha level: size and trade each sleeve through its own cadence-appropriate process and sum the resulting target positions, or add an explicit turnover penalty to a single optimizer so it learns to damp the fast component rather than chasing every jiggle at full size.`,
    python: `import pandas as pd

fast_z = pd.Series([0.5, -0.3, 0.8, -0.6, 0.2])   # 2-day signal: noisy day to day, by design
slow_z = pd.Series([1.1, 1.15, 1.05, 1.2, 1.18])   # 6-month signal: barely moves, by design

# WRONG: naive average feeds one blended number through the optimizer,
# so every fast-signal jiggle drags the slow signal's position along with it
blended_wrong = (fast_z + slow_z) / 2
turnover_wrong = blended_wrong.diff().abs().sum()

# RIGHT: size each sleeve to ITS OWN target weight independently, matching
# each signal's own natural cadence, then sum POSITIONS not raw z-scores
fast_weight = 0.3 * fast_z    # small size, tolerate its natural churn
slow_weight = 0.7 * slow_z    # most of the risk budget, trades rarely
combined_position = fast_weight + slow_weight
turnover_right = combined_position.diff().abs().sum()

print("naive blend turnover:   ", round(turnover_wrong, 3))
print("position-level turnover:", round(turnover_right, 3))
# the fast sleeve still contributes its own churn, but the slow sleeve's
# large, stable weight no longer gets re-traded on every fast-signal wiggle`,
    trap: `Trying to fix the turnover problem by smoothing the combined blended alpha with a moving average after the fact. That damps the fast signal's genuine, valuable day-to-day information along with the unwanted churn -- you've fixed turnover by quietly deleting the fast signal's edge, not by respecting its cadence.`,
    followUp: `The slow signal's weight in the blend, 0.7, was picked by hand. How would you set the two sleeve weights systematically instead -- what does an IC-weighted or risk-parity-style combination of the two sleeves' positions look like here?`,
  },
  {
    id: "qr-portfolio-20260826-rebalance-frequency-tradeoff",
    module: "portfolio",
    title: "Choosing rebalance frequency: alpha decay vs transaction costs",
    difficulty: "core",
    question: `Your signal's information coefficient decays with roughly a 10-day half-life -- it's still somewhat predictive a week out but mostly stale after three weeks. Someone suggests rebalancing daily to capture the freshest signal at all times. What's the actual trade-off in choosing a rebalance frequency here, and would you actually rebalance daily?`,
    thinking: `Frame this as two things scaling with frequency in OPPOSITE directions: rebalancing more often keeps the portfolio closer to the freshest, least-decayed signal, but every rebalance that moves weights pays transaction costs, and more frequent rebalancing multiplies the NUMBER of costly trades, not just their size. With a 10-day half-life, daily rebalancing does capture freshness you'd lose by waiting -- but a lot of the day-to-day weight change at that frequency is re-trading around small, noisy wiggles in a signal whose true value barely moved, meaning you pay full transaction costs to chase noise, not alpha. The right approach is to model this trade-off explicitly (a turnover penalty or no-trade band in the optimizer) rather than picking a fixed calendar frequency by intuition, and confirm it empirically: compute realized NET-OF-COST Sharpe at a few candidate frequencies and let the data pick, since the answer depends on the actual cost-to-decay ratio for this universe.`,
    answer: `The trade-off is alpha capture versus transaction costs pulling in opposite directions as frequency increases: rebalancing more often keeps the portfolio closer to the freshest signal, but multiplies the count of costly trades, many of which just chase day-to-day noise in a signal that hasn't meaningfully changed. With a 10-day half-life, daily rebalancing isn't automatically right -- it depends on the actual cost-per-trade versus how much alpha decays per day. The better approach is explicit: use a turnover penalty or no-trade band so you only rebalance when the target weight move is worth its cost, and empirically compare net-of-cost Sharpe across a few candidate frequencies rather than assuming daily is best just because the signal updates daily.`,
    python: `import numpy as np
import pandas as pd

rng = np.random.default_rng(0)
n_days = 500
halflife = 10   # signal has ~10-day half-life via AR(1)-style persistence
true_signal = np.zeros(n_days)
for t in range(1, n_days):
    true_signal[t] = np.exp(-1 / halflife) * true_signal[t - 1] + rng.normal(0, 1)

target_weight = pd.Series(true_signal / np.abs(true_signal).max())
cost_per_unit_turnover = 0.001   # 10 bps round-trip proxy

def net_sharpe_at_frequency(freq_days: int) -> float:
    # only update the traded weight every freq_days; hold it flat between
    rebalance_mask = np.arange(n_days) % freq_days == 0
    held_weight = target_weight.where(rebalance_mask).ffill().fillna(0)
    turnover = held_weight.diff().abs().fillna(0)
    fwd_ret = pd.Series(rng.normal(0, 0.01, n_days))
    pnl = held_weight.shift(1) * fwd_ret - turnover * cost_per_unit_turnover
    return pnl.mean() / pnl.std() * np.sqrt(252)

for f in [1, 3, 5, 10]:
    print(f"rebalance every {f}d -> net Sharpe {net_sharpe_at_frequency(f):.2f}")`,
    trap: `Comparing rebalance frequencies on GROSS returns instead of net-of-cost returns -- gross P&L always looks best at the highest frequency, since more frequent trading strictly captures more of the signal before it decays; the entire trade-off only shows up once realistic transaction costs are subtracted.`,
    followUp: `Your no-trade band successfully cuts turnover by 60% with only a small drop in gross Sharpe. But now your realized portfolio weights depend on the PATH of past signal values, not just today's target -- how does that complicate backtesting and live monitoring?`,
  },
  {
    id: "qr-portfolio-20260827-condition-number-diagnostic",
    module: "portfolio",
    title: "Checking a covariance matrix's condition number before it hits the optimizer",
    difficulty: "core",
    question: `Before feeding a 300-asset sample covariance matrix into a mean-variance optimizer, a colleague suggests checking its condition number first. What does the condition number tell you here, and what's a reasonable threshold for deciding the matrix needs shrinkage or denoising before you trust the optimizer's output?`,
    thinking: `The condition number is the ratio of the largest to smallest eigenvalue -- think about what a very large ratio implies for the optimization that follows. Mean-variance optimization inverts the covariance matrix (or solves an equivalent linear system), and matrix inversion amplifies whatever error sits in the small-eigenvalue directions by a factor related to the condition number -- a condition number of a million means a tiny amount of estimation noise in the least-informative direction gets blown up roughly a million-fold in the inverse, which is exactly where the optimizer places absurd, unstable long-short bets that are really just chasing sampling noise rather than real risk structure. A well-conditioned matrix built from ample independent data might sit in the tens to low hundreds; anything in the thousands or beyond, especially with more assets than time-series observations (guaranteeing singularity, an effectively infinite condition number), is a clear signal the raw sample covariance isn't safe to invert directly. There's no universal numeric cutoff -- what matters is checking it at all, and treating a high condition number as the trigger for shrinkage or eigenvalue clipping rather than skipping straight to optimization and discovering the instability only in absurd output weights.`,
    answer: `The condition number is the ratio of the largest to smallest eigenvalue, and a very large value means the covariance matrix is nearly singular in some direction -- inverting it for mean-variance optimization then amplifies estimation noise in that direction by roughly the condition number itself, producing wild, unstable weights that are really just noise-chasing. There's no fixed universal cutoff, but a condition number in the thousands, or an asset count approaching the observation count (guaranteeing singularity), is the signal to apply shrinkage or eigenvalue-clipping denoising before optimizing rather than inverting the raw sample matrix directly.`,
    python: `import numpy as np

rng = np.random.default_rng(0)
n_assets, n_obs = 300, 260   # more assets than a year of daily observations

returns = rng.normal(size=(n_obs, n_assets)) * 0.01
sample_cov = np.cov(returns, rowvar=False)

eigenvalues = np.linalg.eigvalsh(sample_cov)   # ascending order for a symmetric matrix
condition_number = eigenvalues[-1] / eigenvalues[0]
print("condition number:", condition_number)
print("smallest eigenvalue:", eigenvalues[0])  # near zero -- n_obs < n_assets

# with more assets than observations the matrix is exactly singular in
# theory and numerically near-singular in practice -- np.cov still
# "succeeds" and returns a matrix, it just can't safely be inverted
try:
    np.linalg.inv(sample_cov)
except np.linalg.LinAlgError as e:
    print("inversion failed:", e)

# shrinkage pulls the smallest eigenvalues up toward the average,
# directly lowering the condition number before the optimizer sees it
shrinkage = 0.3
target = np.eye(n_assets) * sample_cov.trace() / n_assets
shrunk_cov = (1 - shrinkage) * sample_cov + shrinkage * target
shrunk_eigs = np.linalg.eigvalsh(shrunk_cov)
print("condition number after shrinkage:", shrunk_eigs[-1] / shrunk_eigs[0])`,
    trap: `Checking the condition number once at model-build time and never again. The condition number isn't a property of your code, it's a property of today's data -- it changes every time the estimation window rolls forward, and a regime shift that temporarily correlates a cluster of assets can spike it well above where it sat during backtesting, right when the optimizer is most likely to produce dangerous output.`,
  },
  {
    id: "qr-portfolio-20260828-leverage-gross-exposure-cap",
    module: "portfolio",
    title: "Bringing an optimizer back under a gross exposure cap: constrain, or just scale down?",
    difficulty: "warmup",
    question: `Your long-short book is capped at 200% gross exposure (longs plus the absolute value of shorts, at most 2x NAV) by fund policy. Your unconstrained mean-variance optimizer wants 340% gross to hit its target risk level. What's the correct way to bring it back under the cap, and why isn't uniformly scaling every position down by the same factor quite the same as re-optimizing?`,
    thinking: `The correct fix is adding gross exposure as an explicit constraint inside the optimization (sum of absolute weights <= 2.0), not solving unconstrained and rescaling afterward. Uniformly scaling every position by 200/340 is actually mathematically clean in one specific sense -- portfolio variance scales with the square of a uniform multiplier, so a uniform scale-down reduces expected return and risk by exactly the same ratio and preserves the unconstrained solution's Sharpe ratio exactly. But it is NOT what a properly re-run constrained optimizer would produce: a constrained solve reallocates capital away from your weakest-conviction names and toward whichever positions carry the most information ratio per unit of gross exposure, which generally achieves a BETTER risk-adjusted return at the same 200% gross than the naive uniform scale-down. So uniform scaling is a cheap, safe approximation that preserves the Sharpe ratio; re-optimizing captures the "which positions actually deserve to survive the cut" decision that a real mean-variance investor cares about.`,
    answer: `Add gross exposure as an explicit constraint in the optimizer (sum of absolute weights <= 2.0) rather than solving unconstrained and rescaling afterward. Uniformly scaling down to fit the cap does preserve the unconstrained solution's Sharpe ratio exactly, since portfolio variance scales with the square of a scalar multiplier -- but it isn't what a properly re-optimized 200%-gross portfolio looks like, because a constrained solve reallocates capital away from weakest-conviction names toward the highest information-ratio-per-unit-of-gross positions, which generally beats the naive scale-down at the same exposure level.`,
    python: `import numpy as np
from scipy.optimize import minimize

rng = np.random.default_rng(0)
n = 8
mu = rng.normal(0.05, 0.03, n)            # expected returns
cov = rng.normal(size=(n, n))
cov = cov @ cov.T / n + np.eye(n) * 0.01  # a valid covariance matrix

def neg_utility(w, risk_aversion=3.0):
    return -(w @ mu - risk_aversion * w @ cov @ w)

# unconstrained (no gross exposure limit) optimum
unconstrained = minimize(neg_utility, x0=np.zeros(n)).x
gross_unconstrained = np.abs(unconstrained).sum()

# (a) naive uniform scale-down to the 2.0 gross cap
scaled_down = unconstrained * (2.0 / gross_unconstrained)

# (b) properly re-optimized under an explicit gross exposure constraint
gross_cap = {"type": "ineq", "fun": lambda w: 2.0 - np.abs(w).sum()}
reoptimized = minimize(neg_utility, x0=scaled_down, constraints=[gross_cap]).x

print("gross:", np.abs(scaled_down).sum(), np.abs(reoptimized).sum())  # both ~2.0
print("utility, scaled vs reoptimized:", -neg_utility(scaled_down), -neg_utility(reoptimized))
# reoptimized utility is >= scaled_down's -- it reallocates, not just shrinks`,
    trap: `Assuming other constraints still hold after a uniform rescale. A uniform multiply keeps every position's SHARE of gross exposure identical, so if the unconstrained solve already sat exactly at a single-name position limit, scaling down moves it further from that limit while doing nothing to fix a different position that was already violating a sector cap in relative terms.`,
    followUp: `Now add a per-name position limit of 5% of NAV on top of the 200% gross cap. Can you still get away with a single uniform scale-down, or does the interaction between the two constraints force an actual re-optimization?`,
  },
  {
    id: "qr-portfolio-20260829-covariance-window",
    module: "portfolio",
    title: "Short vs long lookback window for estimating the covariance matrix",
    difficulty: "warmup",
    question: `You're choosing how many days of history to use for the covariance matrix that feeds a mean-variance optimizer -- 60 days, or 3 years. What's the actual tradeoff, and is there a reason to prefer neither extreme?`,
    thinking: `Estimation error in a covariance matrix shrinks as you add more observations -- a 3-year window gives you far more data per estimated entry than 60 days, which matters a lot given how many entries there are (roughly n-squared over 2 for n assets) relative to how many independent daily observations you actually get. But a long window also implicitly assumes covariance structure is stable over that whole period, which it isn't: correlations between, say, tech and financials genuinely shift across regimes, so a 3-year window is slow to reflect a real, recent change and keeps half-weighting stale relationships long after they've broken down. The tradeoff is precision (more data, less noise) against responsiveness (recent data, current regime) -- neither extreme dominates, which is exactly why exponentially-weighted covariance estimation with a moderate halflife, or a short window blended with a long-window shrinkage target, are common compromises rather than picking one fixed window and living with its failure mode.`,
    answer: `It's a precision-versus-responsiveness tradeoff, not a "which window is correct" question. A short window (60 days) is noisy -- too few observations relative to the number of covariance entries being estimated -- but reflects the current regime; a long window (3 years) is far more precise but assumes correlations are stable over that whole span, which they usually aren't, so it lags a real regime shift. Common compromises are exponential weighting with a moderate halflife, or shrinking a short-window estimate toward a longer-window target, rather than committing to either extreme.`,
    python: `import pandas as pd
import numpy as np

rng = np.random.default_rng(0)
n_assets, n_days = 20, 750  # 3 years of daily data
returns = pd.DataFrame(rng.normal(scale=0.01, size=(n_days, n_assets)))

short_cov = returns.tail(60).cov()     # responsive, but noisy: 60 obs for 20*21/2=210 entries
long_cov = returns.cov()               # precise, but assumes 3 years of stability

# a simple shrinkage compromise: blend the noisy-but-current short estimate
# toward the stable-but-stale long-window estimate
shrinkage = 0.3   # weight on the long-window target
blended_cov = shrinkage * long_cov + (1 - shrinkage) * short_cov

print("condition number, short:", np.linalg.cond(short_cov))
print("condition number, long:", np.linalg.cond(long_cov))
print("condition number, blended:", np.linalg.cond(blended_cov))
# blended sits between the two -- less noisy than short-only, more current than long-only`,
    trap: `Picking a window length once during development based on whichever gives the best in-sample backtest Sharpe. That's just tuning a hyperparameter to the historical noise in that specific covariance estimate, and there's no guarantee the same window length reduces genuine estimation error out of sample rather than having accidentally fit the backtest period's particular correlation history.`,
    followUp: `You switch from a fixed 60-day window to exponential weighting with a 60-day halflife. Does that fully solve the responsiveness problem, or does it just change WHERE the tradeoff sits?`,
  },
  {
    id: "qr-portfolio-20260830-random-matrix-theory",
    module: "portfolio",
    title: "Cleaning a covariance matrix with the Marchenko-Pastur eigenvalue bound",
    difficulty: "hard",
    question: `You've already applied Ledoit-Wolf shrinkage to a 400-stock covariance matrix estimated from 3 years of daily data, but you want a more principled way to decide which of the matrix's eigenvalues represent real, tradeable common factors versus which are indistinguishable from pure sampling noise. What does Random Matrix Theory give you here, and how do you use it?`,
    thinking: `Random Matrix Theory answers a specific question: if you fed a completely random, uncorrelated N-by-T return matrix into a sample covariance estimator, what would the DISTRIBUTION of its eigenvalues look like purely from sampling noise, with zero real structure anywhere? The Marchenko-Pastur distribution gives exactly that null, and critically it has a known closed-form upper bound depending only on the ratio q = N/T -- any eigenvalue of your REAL covariance matrix below that bound is statistically indistinguishable from what pure noise alone would produce, even under zero true correlation. That gives a principled, data-driven cutoff instead of an ad hoc "keep the top K factors" choice: eigenvalues above the bound are treated as real structure and kept as estimated; everything below it is treated as noise and replaced with a single flat noise-floor value that preserves the matrix's total variance (its trace). This is more surgical than blanket Ledoit-Wolf shrinkage, which pulls ALL eigenvalues toward a target regardless of whether they're signal or noise -- RMT tells you WHERE the signal-to-noise boundary sits given your specific N and T, and the two are typically combined rather than treated as substitutes.`,
    answer: `The Marchenko-Pastur distribution gives the eigenvalue spectrum expected from a covariance matrix estimated on PURE noise, as a function only of the ratio q = N/T, with a known closed-form upper bound. Any eigenvalue of your real sample covariance matrix falling below that bound is statistically indistinguishable from noise even under zero true correlation, so you keep eigenvalues above the bound as real structure and replace everything below it with a single flat noise-floor value that preserves the matrix's trace. It's a more surgical, N/T-calibrated cutoff than blanket shrinkage, and the two are typically combined rather than treated as substitutes.`,
    python: `import numpy as np

rng = np.random.default_rng(0)
N, T = 400, 750           # 400 stocks, 3 years of daily data
rets = rng.standard_normal((T, N)) * 0.01   # NO real correlation structure here

corr = np.corrcoef(rets, rowvar=False)
eigvals = np.linalg.eigvalsh(corr)[::-1]     # descending

# Marchenko-Pastur upper bound for a correlation matrix (unit variance per asset)
q = N / T
mp_upper = (1 + np.sqrt(q)) ** 2

n_above = int((eigvals > mp_upper).sum())
print("MP upper bound:", round(mp_upper, 3))
print("eigenvalues above the noise bound:", n_above, "of", N)
# on pure-noise input, only a handful survive the bound -- close to what
# pure sampling variation alone would produce, none of it real structure

# cleaning step: keep eigenvalues above the bound, flatten everything below
# it to a single noise-floor value that preserves total variance (trace)
kept = eigvals[eigvals > mp_upper]
remaining_trace = eigvals.sum() - kept.sum()
noise_floor_value = remaining_trace / (N - len(kept))
cleaned_eigvals = np.concatenate([kept, np.full(N - len(kept), noise_floor_value)])
print("cleaned spectrum preserves trace:", np.isclose(cleaned_eigvals.sum(), eigvals.sum()))`,
    trap: `Applying the Marchenko-Pastur bound to the sample COVARIANCE matrix's raw eigenvalues without first converting to (or accounting for) the correlation matrix's normalization -- the closed-form MP bound assumes unit variance per asset, so plugging in covariance eigenvalues directly, where assets have wildly different variances, gives a meaningless threshold.`,
    followUp: `Your universe has clear sector structure, so you'd expect more than one or two genuinely real eigenvalues (market plus several sector factors), not just the single largest one. How would seeing several eigenvalues above the bound change how you interpret the matrix's underlying factor structure? (Several eigenvalues above the bound suggests multiple real common factors beyond the market -- consistent with genuine sector or style structure -- while just one dominant eigenvalue above the bound is the classic signature of a single-factor, market-dominated structure with everything else genuinely noise.)`,
  },
  {
    id: "qr-portfolio-20260831-1n-naive-benchmark",
    module: "portfolio",
    title: "The 1/N equal-weight portfolio as a hard-to-beat benchmark",
    difficulty: "core",
    question: `You build a mean-variance optimized portfolio, estimate expected returns and a shrunk covariance matrix carefully, and backtest it against a naive equal-weight (1/N) portfolio of the same universe. The optimizer loses out-of-sample. Is that necessarily a sign of a coding bug?`,
    thinking: `Not necessarily -- this is a well-documented result (DeMiguel, Garlappi, Uppal 2009): naive 1/N is a genuinely hard benchmark to beat out-of-sample across many optimization strategies and datasets. The reason is that 1/N has zero estimation error, since it uses no estimated inputs at all, while mean-variance optimization is an error maximizer -- it concentrates weight precisely where estimation noise in expected returns and covariance is largest. With modest asset counts and limited history, estimation error in the mean vector typically dominates whatever genuine cross-sectional signal exists, so an unconstrained optimizer ends up betting heavily on noise rather than edge. This isn't proof optimization is useless; it's exactly why practitioners shrink inputs, add constraints, or blend optimized weights toward 1/N rather than trusting a raw unconstrained solve.`,
    answer: `Not necessarily a bug -- it's a well-documented result (DeMiguel, Garlappi, Uppal 2009) that naive 1/N is genuinely hard to beat out-of-sample precisely because it has zero estimation error, while mean-variance optimization amplifies whatever estimation error sits in your expected-return and covariance inputs. The fix isn't abandoning optimization, it's shrinking inputs, adding constraints, or blending the optimized weights toward 1/N so the optimizer can't over-commit to noisy estimates.`,
    python: `import numpy as np

rng = np.random.default_rng(1)
n_assets, n_obs = 20, 60   # short history -- realistic estimation error

true_mean = rng.normal(0.0004, 0.0003, n_assets)
true_cov = np.eye(n_assets) * 0.0004
sample_returns = rng.multivariate_normal(true_mean, true_cov, n_obs)

est_mean = sample_returns.mean(axis=0)          # noisy estimate of true_mean
est_cov = np.cov(sample_returns, rowvar=False)

# unconstrained mean-variance weights (no shrinkage, no constraints)
inv_cov = np.linalg.pinv(est_cov)
mv_weights = inv_cov @ est_mean
mv_weights /= np.abs(mv_weights).sum()          # scale to unit gross exposure

naive_weights = np.full(n_assets, 1 / n_assets)

# evaluate BOTH against the true (not estimated) inputs -- what actually
# happens out-of-sample if the true distribution really were this one
mv_true_sharpe = (mv_weights @ true_mean) / np.sqrt(mv_weights @ true_cov @ mv_weights)
naive_true_sharpe = (naive_weights @ true_mean) / np.sqrt(naive_weights @ true_cov @ naive_weights)

print("MV out-of-sample Sharpe:", round(mv_true_sharpe, 3))
print("1/N out-of-sample Sharpe:", round(naive_true_sharpe, 3))
# with only 60 observations for 20 assets, MV frequently loses to 1/N --
# its weights are chasing estimation noise in est_mean, not true signal`,
    trap: `Concluding "optimization doesn't work, just use equal weight." The actual lesson is that RAW unconstrained mean-variance with noisy inputs doesn't work -- shrinkage, constraints, or blending toward 1/N is the standard fix, not abandoning the optimizer entirely.`,
  },
  {
    id: "qr-portfolio-20260901-resampled-efficient-frontier",
    module: "portfolio",
    title: "Resampled efficient frontier (Michaud resampling): smoothing an unstable optimizer with bootstrap",
    difficulty: "hard",
    question: `Your mean-variance optimizer produces wildly different weights when you nudge the expected-return inputs by amounts well within their estimation error. A colleague suggests Michaud resampling. What does it actually do, and why would it help?`,
    thinking: `The instability isn't a bug in the optimizer -- it's doing exactly what it's told, treating point estimates of expected returns and covariance as if they were known exactly, then aggressively exploiting any perceived edge, including edge that's really just estimation noise. Michaud resampling addresses this by NOT trusting a single point estimate: bootstrap many alternative (mean, covariance) input pairs by resampling from the historical return series (or from a distribution around the estimated parameters), re-run the full optimization for EACH resampled input set to get many different "optimal" weight vectors, then average those weight vectors together into one final portfolio. The averaging is the whole trick -- an input draw that happens to make asset A look great gets offset by other draws where it doesn't, so idiosyncratic noise in any one estimate gets diversified away in the final averaged weights, producing something much closer to the equal-weight-ish, less concentrated portfolios that tend to be more robust out of sample. The honest caveat: it's a heuristic smoothing technique with real practitioner traction, not a provably optimal Bayesian solution the way, say, Black-Litterman is -- it trades some in-sample optimality for out-of-sample stability, and the choice of resampling scheme still has practitioner judgment baked into it.`,
    answer: `Michaud resampling bootstraps many alternative (expected return, covariance) input pairs from the historical data, re-optimizes for each one to get many different weight vectors, then averages all of those weight vectors into the final portfolio. The averaging is the key: an input draw that overstates one asset's edge gets offset by draws where it doesn't, so idiosyncratic estimation noise gets diversified away and the result is a less concentrated, more out-of-sample-robust portfolio than a single point-estimate optimization. It's a practical smoothing heuristic, not a provably optimal Bayesian method the way Black-Litterman is.`,
    python: `import numpy as np

rng = np.random.default_rng(0)
n_assets, n_days = 5, 500

# simulate a return history to resample from
true_mean = rng.uniform(0.0002, 0.0008, n_assets)
cov = np.diag(rng.uniform(0.0001, 0.0004, n_assets))
returns = rng.multivariate_normal(true_mean, cov, size=n_days)

def min_variance_weights(mu: np.ndarray, sigma: np.ndarray, target_return: float) -> np.ndarray:
    # tiny closed-form mean-variance solve for illustration, not production-grade
    inv_sigma = np.linalg.inv(sigma)
    ones = np.ones(len(mu))
    a = ones @ inv_sigma @ ones
    b = ones @ inv_sigma @ mu
    c = mu @ inv_sigma @ mu
    lam = (c - target_return * b) / (a * c - b ** 2)
    gam = (target_return * a - b) / (a * c - b ** 2)
    w = lam * (inv_sigma @ ones) + gam * (inv_sigma @ mu)
    return w / w.sum()

target = true_mean.mean()

# single point-estimate optimization -- unstable, exploits noise in mu/cov
point_mu, point_cov = returns.mean(axis=0), np.cov(returns, rowvar=False)
point_weights = min_variance_weights(point_mu, point_cov, target)

# Michaud resampling: bootstrap the return history, re-optimize, average
n_resamples = 200
resampled_weights = []
for _ in range(n_resamples):
    idx = rng.integers(0, n_days, n_days)          # i.i.d. bootstrap of the daily returns
    boot_returns = returns[idx]
    boot_mu, boot_cov = boot_returns.mean(axis=0), np.cov(boot_returns, rowvar=False)
    resampled_weights.append(min_variance_weights(boot_mu, boot_cov, target))

michaud_weights = np.mean(resampled_weights, axis=0)

print("point-estimate weights:", point_weights.round(3))
print("Michaud-averaged weights:", michaud_weights.round(3))   # typically less concentrated`,
    trap: `Presenting the resampled weights as "the" optimal portfolio rather than a robustness-smoothed alternative. Michaud resampling trades in-sample optimality for stability by construction -- it will systematically look worse than the point-estimate optimizer on the exact historical sample it was resampled from, which is expected, not a bug.`,
    followUp: `If the resampled weights end up very close to equal-weight for every asset, what does that tell you about how much real signal was in your original mean and covariance estimates? (It suggests the estimation error dominates the perceived edge -- the bootstrap draws disagree enough about which asset is best that averaging washes almost everything out toward the no-information prior, equal weight.)`,
  },
  {
    id: "qr-portfolio-20260902-factor-exposure-caps",
    module: "portfolio",
    title: "Capping net style-factor exposure inside the optimizer",
    difficulty: "core",
    question: `Your optimizer, handed an alpha signal and a covariance matrix and left unconstrained, finds a portfolio with heavy net exposure to the momentum factor -- basically making a directional bet on momentum itself rather than expressing your stock-specific alpha. How do you stop that without gutting the optimizer's freedom?`,
    thinking: `An unconstrained mean-variance optimizer will happily load up on whatever combination of names best exploits the covariance structure to maximize alpha per unit of risk -- if the alpha signal happens to correlate with a common style factor like momentum, the optimizer will quietly turn stock-specific alpha into a directional bet on that factor, which isn't the strategy you set out to run. The standard fix is a linear constraint in the same QP: the portfolio's net loading on that factor (a risk model's per-stock factor betas dotted with weights) must sit within a symmetric band, not necessarily exactly zero. A tight cap forces closer to full neutrality but throws away any real alpha that happens to be correlated with the factor; a loose cap preserves more of that alpha but lets more of the factor bet back in. The right band width is a judgment call informed by how much you trust the alpha's correlation with the factor to be real skill versus a spurious side effect.`,
    answer: `Add a linear constraint to the optimizer: the portfolio's net loading on the style factor (factor-loading vector dotted with weights) must sit within a symmetric band around zero, not necessarily forced to exactly zero. This is a looser cousin of full neutrality -- tight enough to stop an unintended directional factor bet, loose enough to keep alpha that's genuinely, if partially, correlated with that factor.`,
    python: `import numpy as np
import cvxpy as cp

n = 6
alpha = np.array([0.02, -0.01, 0.015, 0.03, -0.02, 0.01])
mom_loading = np.array([1.8, -1.5, 0.2, 1.9, -1.7, 0.1])   # each stock's momentum factor beta
gross_cap = 1.0
mom_exposure_cap = 0.3   # net momentum exposure allowed, same units as loadings . weights

w = cp.Variable(n)
objective = cp.Maximize(alpha @ w)
constraints = [
    cp.sum(cp.abs(w)) <= gross_cap,        # gross exposure cap
    cp.sum(w) == 0,                         # dollar-neutral
    mom_loading @ w <= mom_exposure_cap,    # style-factor band, not full neutrality
    mom_loading @ w >= -mom_exposure_cap,
]
problem = cp.Problem(objective, constraints)
problem.solve()

print("weights:", np.round(w.value, 3))
print("net momentum exposure:", round(float(mom_loading @ w.value), 3))`,
    trap: `Reaching straight for full neutrality (constraining the exposure to exactly zero) as the default. If any real portion of the alpha's edge is legitimately correlated with the factor -- not just a side effect of construction -- zeroing it out entirely throws away real, tradable signal rather than just removing an unintended bet.`,
  },
  {
    id: "qr-portfolio-20260903-adv-cap-optimizer",
    module: "portfolio",
    title: "Baking an ADV-based position size cap directly into the optimizer",
    difficulty: "core",
    question: `Your mean-variance optimizer keeps proposing a position in a small-cap name that's 3x the stock's own 20-day average daily volume (ADV). You could just clip the weight after the fact, but your interviewer asks why that's worse than building the constraint into the optimization itself.`,
    thinking: `Think about what happens to the rest of the portfolio when a single name's weight gets clipped after solving. The unconstrained optimizer already solved for the jointly-best allocation across every name given the full covariance structure -- if you then manually shrink one name's weight post hoc, the freed-up capital has to go somewhere, and a naive reallocation (leave it in cash, or renormalize everyone else up proportionally) ignores every other name's marginal risk contribution and correlation with the rest of the book, throwing away the joint optimality the solver worked out. Building the ADV cap in as a linear inequality constraint -- weight_i times NAV at most k times ADV_i, for every name -- instead lets the solver find the best allocation subject to that constraint from the start, so the capital that can't go into the capped name gets redistributed to wherever it does the most good risk-adjusted, honoring the same covariance structure that produced the original solution rather than patching around it afterward.`,
    answer: `Clipping after the fact breaks the joint optimality the solver found -- the capital freed up from the clipped name has to go somewhere, and a manual reallocation ignores every other name's marginal risk contribution and correlation structure that the original solve accounted for. Adding the ADV cap as a linear inequality constraint (weight_i times NAV at most k times ADV_i) inside the optimization lets the solver redistribute that capital to wherever it's actually best risk-adjusted, in one consistent solve.`,
    python: `import cvxpy as cp
import numpy as np

n = 4
rng = np.random.default_rng(0)
raw = rng.uniform(-0.01, 0.03, (n, n))
cov = raw @ raw.T + np.eye(n) * 0.02   # PSD covariance
mu = np.array([0.02, 0.05, 0.03, 0.01])   # expected returns / signal

adv_usd = np.array([2_000_000, 50_000, 4_000_000, 1_500_000])   # name 1 is illiquid
nav = 10_000_000
k = 0.10   # cap: at most 10% of a name's own ADV

w = cp.Variable(n)
risk = cp.quad_form(w, cov)

# ADV cap enters directly as a linear constraint on dollar position size,
# not a post-solve clip -- the solver redistributes capital around it
constraints = [
    cp.sum(w) == 1,
    w >= 0,
    cp.multiply(w, nav) <= k * adv_usd,
]
prob = cp.Problem(cp.Maximize(mu @ w - 5 * risk), constraints)
prob.solve()

print("weights:", np.round(w.value, 4))
print("illiquid name capped at:", round(k * adv_usd[1] / nav, 4), "of NAV")`,
    trap: `Assuming a post hoc clip-and-renormalize is "close enough" to the constrained solve because the total weight still sums to 1. It reallocates the freed capital blindly, often just pro-rata across everyone else, rather than to whichever names actually deserve it given their own risk and correlation profile, quietly degrading the realized Sharpe versus what the properly constrained optimization would have delivered.`,
  },
  {
    id: "qr-portfolio-20260904-black-litterman",
    module: "portfolio",
    title: "Black-Litterman: why the posterior returns don't just equal your views",
    difficulty: "hard",
    question: `You have a market-cap-weighted equilibrium and a view that stock A will outperform stock B by 3%. Naively, you might think Black-Litterman just plugs your 3% view directly into the optimizer as stock A's expected return. Why doesn't it, and what does BL actually do differently from that naive approach?`,
    thinking: `Plain mean-variance optimization is notoriously sensitive to the input expected-return vector -- tiny changes to one stock's assumed return can flip the optimal weights dramatically, which is why naively plugging in a single confident view for stock A, leaving everything else at some placeholder, tends to produce wild, concentrated, unstable portfolios. Black-Litterman instead starts from the market-cap-weighted equilibrium returns -- what expected returns would need to be, given today's actual market weights, for the market portfolio to be the optimizer's answer under reverse-optimization -- as a stable, well-behaved prior. Your view then gets blended into that prior via a Bayesian update, weighted by how confident you are in the view versus how much you trust the equilibrium prior. The output is a posterior return vector that shifts partially toward your view, not all the way to it, and it also revises correlated assets' implied returns even though you expressed no view on them directly.`,
    answer: `BL doesn't replace market-implied equilibrium returns with your view -- it treats the reverse-optimized equilibrium returns as a Bayesian prior and blends in your view weighted by your confidence in it, producing a posterior that shifts partially toward the view, not fully, and that also nudges correlated assets you never expressed a view on, all while staying anchored to a stable, diversified starting point instead of the wild swings a naive plug-in produces.`,
    python: `import numpy as np

# 3-asset toy universe: market-cap weights and an implied covariance
w_mkt = np.array([0.5, 0.3, 0.2])
cov = np.array([[0.04, 0.01, 0.00],
                 [0.01, 0.03, 0.01],
                 [0.00, 0.01, 0.05]])
delta = 2.5   # market risk-aversion coefficient

# equilibrium returns: reverse-optimize what returns WOULD produce w_mkt
# as the optimal portfolio -- this is the Bayesian prior, not a guess
pi = delta * cov @ w_mkt
print("equilibrium prior:", np.round(pi, 4))

# view: asset 0 outperforms asset 1 by 3%, expressed with confidence tau*omega
P = np.array([[1, -1, 0]])          # "asset0 minus asset1"
Q = np.array([0.03])                # the 3% view
tau = 0.05
omega = P @ (tau * cov) @ P.T       # view uncertainty scaled off the prior's own covariance

# Bayesian blend of prior and view -- NOT a direct overwrite of pi
M_inv = np.linalg.inv(np.linalg.inv(tau * cov) + P.T @ np.linalg.inv(omega) @ P)
posterior = M_inv @ (np.linalg.inv(tau * cov) @ pi + P.T @ np.linalg.inv(omega) @ Q)
print("posterior returns:", np.round(posterior, 4))   # shifts toward view, not equal to it`,
    trap: `Setting the view confidence (omega) arbitrarily small to "make sure the view matters" -- an overconfident omega collapses the posterior almost entirely onto the view, reproducing the same instability BL was meant to avoid, just now anchored to your view instead of an unconstrained guess.`,
  },
];
