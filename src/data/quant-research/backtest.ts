import type { QRQuestion } from "./index";

// M8 -- Backtest Mechanics: lagging discipline, cost models, rebalance
// calendars, vectorized P&L, capacity, and the classic bug catalog.
export const backtestQuestions: QRQuestion[] = [
  {
    id: "qr-backtest-01-shift-discipline",
    module: "backtest",
    title: "The shift(1) discipline",
    difficulty: "warmup",
    question: `Your signal is computed from day t closing prices. Show me the exact pandas line that turns weights into P&L without lookahead, and tell me what goes wrong if you skip the shift.`,
    thinking: `Fix the timeline in your head before writing anything: information date, decision date, and the return the position earns must be strictly ordered. If your signal needs the day-t close, the earliest you can plausibly hold the resulting position is from the close of day t onward, so it earns the return from close t to close t+1 - which pandas labels as day t+1. In code, the position vector must be the weight matrix shifted forward one day before multiplying by returns. Skip the shift and day-t weights multiply day-t returns: the return from close t-1 to close t, which ENDS at the price your signal was computed from. You are trading on information from the future of the trade. The tell is a reversal-flavored signal that suddenly backtests at Sharpe 5 - mean reversion plus lookahead equals buying yesterday's losers with tomorrow's newspaper.`,
    answer: `pnl equals weights shifted by one day, multiplied elementwise by returns, summed across names: the day-t position must come from information available strictly before the return it earns. Without the shift, day-t weights earn the close-t-1-to-close-t return that ends at the very price the signal used - textbook lookahead. It inflates fast signals most: a reversal strategy jumps to absurd Sharpe because it is buying losers before the loss finishes printing.`,
    python: `import pandas as pd
# weights: dates x stocks, decided using info through the close of each date
# rets:    dates x stocks, close-to-close simple returns labeled at the END date

pos = weights.shift(1)                    # day t position = weights decided at t-1
pnl = (pos * rets).sum(axis=1)            # day t pnl: position held INTO day t

# the bug, for contrast -- never ship this:
pnl_lookahead = (weights * rets).sum(axis=1)   # WRONG: t weights earn t return

# quick self-audit: if the "wrong" version is much better, your signal
# is correlated with same-day returns -- i.e. it contains the future.
print(pnl.mean() / pnl.std(), pnl_lookahead.mean() / pnl_lookahead.std())`,
    trap: `Shifting the returns instead: weights times rets.shift(-1) gives numerically identical P&L but stamps it on the signal date. Now your P&L series is dated one day early, costs and risk are misaligned by a day, and every downstream join quietly inherits the offset. Shift positions, not returns.`,
    followUp: `shift(1) assumes you executed AT the close that produced your signal - zero computation and execution time. What does shift(2) represent, and what does it tell you if your Sharpe halves under it?`,
  },
  {
    id: "qr-backtest-02-vectorized-pnl",
    module: "backtest",
    title: "Loop-free daily P&L",
    difficulty: "warmup",
    question: `Write the complete daily P&L for a long-short equity backtest - weights DataFrame, returns DataFrame, 5 bps per dollar traded - with no loops. Where do people usually get the cost line wrong?`,
    thinking: `A daily backtest is four vectorized lines: lag the weights, earn gross P&L, charge costs on turnover, compound the net. Think about each alignment. Gross: lagged position times returns, summed across names. Costs: charged on dollars TRADED, which is the absolute day-over-day weight change summed across names - not on dollars held. Date-stamp costs on the day the trade happens, the same day the new position starts earning. Then resist the loop instinct. A row-by-row loop over dates is not just a thousand times slower; it is where lookahead bugs breed, because inside a loop you hand-mix "today" and "yesterday" variables and nothing stops you grabbing the wrong one. The vectorized shift makes the time discipline structural: the lag is in the code shape, not in your discipline.`,
    answer: `Position is weights shifted one day; gross P&L is position times returns summed across names; turnover is the summed absolute weight change; costs are turnover times 5 bps; net is gross minus costs; equity compounds net. Costs must be charged on turnover - dollars traded - not on gross exposure, and stamped on the trade date. Loops are wrong twice: orders of magnitude slower, and they invite the exact date-mixing errors shift makes impossible.`,
    python: `import pandas as pd
COST = 5.0 / 10000.0                       # 5 bps per dollar traded

pos = weights.shift(1)                     # lag: t position from t-1 decision
gross = (pos * rets).sum(axis=1)           # daily gross return of the book

turnover = weights.diff().abs().sum(axis=1)  # dollars traded per $1 of book
costs = turnover * COST                    # cost hits on the trade date
net = gross - costs

equity = (1.0 + net.fillna(0.0)).cumprod() # compounded equity curve

# the classic anti-pattern, shown only to name it:
# for date, row in weights.iterrows(): ...   # 1000x slower AND the loop
# body is where lookahead bugs live -- today/yesterday get hand-mixed.
print(net.mean() / net.std() * (252 ** 0.5))  # annualized net Sharpe`,
    trap: `Charging costs on gross exposure instead of turnover - 5 bps times the whole book every day taxes HOLDING, not trading, and murders low-turnover strategies by roughly 12 percent a year at gross 1. The symmetric bug, forgetting day-one entry costs and final liquidation, flatters short backtests.`,
    followUp: `This P&L is in weight-space returns, which silently assumes you re-lever to constant gross daily. What changes if you track dollar positions on fixed capital instead, and when does the difference matter?`,
  },
  {
    id: "qr-backtest-03-compounding",
    module: "backtest",
    title: "Compounding vs additive returns",
    difficulty: "warmup",
    question: `One analyst sums daily returns to get a 10-year cumulative number; another compounds them. The answers differ badly. Who is right, when does the gap matter, and which should a backtest report?`,
    thinking: `Ask what question each number answers. Summing daily returns approximates a strategy that bets the SAME fixed dollar amount every day - profits are withdrawn, losses topped up. Compounding answers what happens to reinvested capital, which is what an investor actually experiences. Over short windows with small returns the two nearly agree, because log(1+r) is approximately r. Over ten years the gap is enormous and systematically ordered: compounding is dragged below the sum by variance - the average of the compounded path loses roughly half the variance per period relative to the arithmetic sum. Lose 50 percent then gain 50 percent: additive says flat, compounding says down 25, and compounding is what your account statement says. Practical workflow: use log returns when you want addition to be legitimate, report compounded (geometric) performance, and keep arithmetic daily returns for Sharpe, whose numerator is an arithmetic mean.`,
    answer: `Compounding reflects reinvested capital and is what to report; summing models constant-dollar betting and only approximates reality when returns are small and the window short. The gap is variance drag: geometric growth is approximately arithmetic mean minus half the variance, so volatile strategies look systematically better under addition. Down 50 then up 50 is flat additively but minus 25 compounded. Use log returns if you need additivity; keep arithmetic returns for Sharpe.`,
    python: `import numpy as np
import pandas as pd
rng = np.random.default_rng(0)
# 10 years of daily returns: modest edge, realistic vol
r = pd.Series(rng.normal(0.0004, 0.012, 2520))

additive = r.sum()                          # constant-dollar fiction
compounded = (1.0 + r).prod() - 1.0         # what capital actually does
log_total = np.log1p(r).sum()               # log returns: addition is legal
print(additive, compounded, np.expm1(log_total))  # last two agree exactly

# variance drag, visible directly:
# geometric mean/day ~ arithmetic mean/day - 0.5 * daily variance
drag = 0.5 * r.var()
print(r.mean() - drag, np.log1p(r).mean())  # ~ equal: the drag is real`,
    trap: `Computing Sharpe from log returns "for consistency". Sharpe's numerator is the arithmetic expected return - that is what compensates risk per period. Log returns understate it by the variance drag, so high-vol strategies get unfairly penalized twice. Compound for the equity curve, stay arithmetic for Sharpe.`,
  },
  {
    id: "qr-backtest-04-cost-survival",
    module: "backtest",
    title: "Does it survive costs?",
    difficulty: "core",
    question: `Your strategy turns over 40 percent a day two-sided and costs are 5 bps per dollar traded. Gross Sharpe is 1.2 on 10 percent annualized vol. Walk me through whether it survives.`,
    thinking: `Do the arithmetic before any opinion. Cost drag per day is turnover times cost rate: 0.40 times 5 bps is 2 bps a day, times 252 is about 5 percent a year. Gross annual return is Sharpe times vol: 1.2 times 10 percent is 12 percent. Net is roughly 7 percent, and since costs are nearly constant they barely change vol, so net Sharpe is about 0.7. It survives - but you just watched costs eat over 40 percent of the Sharpe, so interrogate the cost number itself. Is 5 bps all-in: spread, impact, fees, borrow on the short side? Impact grows with size, so at target AUM 5 might really be 10 - rerun at 10 bps and the drag doubles to 10 percent a year, Sharpe about 0.2, strategy dead. The deliverable is not yes or no; it is net Sharpe as a function of the cost assumption, plus the breakeven cost.`,
    answer: `Drag is 0.40 times 5 bps times 252, about 5 percent a year. Gross return is 1.2 times 10 percent, so 12; net about 7, and net Sharpe about 0.7 since costs add little vol. So it survives at 5 bps - but costs consumed 40 percent of the Sharpe, and at 10 bps all-in it is roughly dead. Breakeven is about 12 bps. I would present net Sharpe versus cost assumption, not a point estimate.`,
    python: `import numpy as np
turn = 0.40            # two-sided daily turnover (fraction of book traded)
vol = 0.10             # annualized vol of the strategy
sr_gross = 1.2

gross_ann = sr_gross * vol                 # 12% a year gross
for cost_bps in [3, 5, 10, 15]:
    drag = turn * cost_bps / 10000.0 * 252 # certain, linear-in-turnover drag
    net = gross_ann - drag
    sr_net = net / vol                     # costs ~ constant: vol unchanged
    print(cost_bps, round(net, 4), round(sr_net, 2))
# 5bps -> net ~7%, SR ~0.70 : alive
# 10bps -> net ~2%, SR ~0.19 : dead in practice
# breakeven cost: gross_ann / (turn * 252) ~ 11.9 bps
print(gross_ann / (turn * 252) * 10000)`,
    trap: `Treating 5 bps as a constant of nature. Quoted costs are for someone else's size and market regime; impact scales with your AUM and spikes in stress. A strategy whose viability flips between 5 and 10 bps has no margin of safety - the honest answer names that fragility explicitly.`,
    followUp: `Same numbers, but now you can smooth the signal and cut turnover to 15 percent at the cost of 20 percent of the gross alpha. Do the arithmetic - is the trade worth it?`,
  },
  {
    id: "qr-backtest-05-impact-models",
    module: "backtest",
    title: "Linear vs square-root impact",
    difficulty: "core",
    question: `When is a flat per-dollar cost model good enough, and when do you need square-root market impact? What actually changes in the backtest's conclusions?`,
    thinking: `Separate the two physical costs. Crossing the spread costs roughly half the bid-ask per share regardless of your size - per dollar traded that is flat, so a linear model (cost proportional to turnover) captures it. Moving the price is different: to trade a meaningful fraction of a stock's daily volume you climb the book and signal your intent, and the empirical regularity across decades of execution data is that this impact scales with daily volatility times the SQUARE ROOT of your trade as a fraction of average daily volume. Square root means concave: doubling size less-than-doubles per-share impact but total cost still grows superlinearly in size. The consequence for backtests: a linear model makes net Sharpe independent of AUM, which is fiction. Square-root impact makes Sharpe decay as capital grows - the backtest stops answering "is this profitable" and starts answering "at what size does it stop being profitable".`,
    answer: `Flat-per-dollar is fine while your trades are a tiny fraction of daily volume - spread dominates and it is size-independent. Once you trade meaningful participation, use square-root impact: cost per dollar scales with volatility times the square root of trade size over average daily volume. The strategic difference: linear costs leave net Sharpe flat in AUM; square-root impact makes Sharpe a decreasing function of capital, turning the backtest into a capacity estimate rather than a yes/no.`,
    python: `import numpy as np
# per-dollar cost of one trade in one name, as trade size grows
adv = 20e6                    # average daily volume traded, dollars
sigma = 0.02                  # daily volatility of the stock
spread_bps = 3.0              # half-spread cost, size-independent
k = 0.6                       # impact coefficient, empirically ~0.3-1.0

q = np.array([0.1e6, 0.5e6, 1e6, 2e6, 5e6])   # trade sizes in dollars
lin = np.full(q.shape, spread_bps)             # flat: spread only
impact = k * sigma * np.sqrt(q / adv) * 10000  # sqrt law, in bps

for qi, li, ii in zip(q, lin, impact):
    print(int(qi), round(li, 1), round(ii, 1), round(li + ii, 1))
# at 0.5% of ADV impact ~ 8bps already rivals spread; at 25% of ADV
# it is ~60bps and dominates. same STRATEGY, cost per dollar tripled
# purely because size grew -- linear models cannot express this.`,
    trap: `Backtesting at 5 bps flat, raising capital, and being confused when live costs triple. The model was not wrong at small size - it was extrapolated. The related trap is calibrating k from your own small live trades and assuming it holds at 10x participation.`,
    followUp: `Square-root impact partly REVERTS after you finish trading - temporary versus permanent impact. Why does that distinction matter enormously for a fast signal but barely at all for a slow one?`,
  },
  {
    id: "qr-backtest-06-rebalance-calendar",
    module: "backtest",
    title: "Monthly signal, daily prices",
    difficulty: "core",
    question: `Your signal updates monthly but you have daily returns. How do you build the daily weight matrix for the backtest, and what subtle error does the obvious forward-fill introduce?`,
    thinking: `The obvious construction: place target weights on each rebalance date, reindex to the daily calendar, forward-fill. Now ask what forward-fill physically asserts: that your WEIGHTS are constant between rebalances. But real holdings drift - winners grow as a fraction of the book, losers shrink. Constant weights would require trading back to target every single day: tiny hidden daily turnover your cost line never charges, and a small mean-reversion bet (trimming winners daily) you never decided to make. The honest alternative lets weights drift with returns between rebalances and only snaps to target on rebalance dates - then turnover concentrates on those dates where costs are actually charged. For a diversified monthly equity book the P&L difference is small; for concentrated books, volatile names, or leverage it compounds. Also pin down WHICH close you rebalance at and whether the signal was available by then - calendar bugs and lookahead love rebalance dates.`,
    answer: `Reindex month-end targets to the daily calendar and forward-fill - but know that ffill freezes weights, which implicitly assumes free daily micro-rebalancing back to target and a small unintended winner-trimming bet. The cleaner version lets weights drift with returns between rebalances and snaps to target only on rebalance dates, so turnover and costs land where trading actually happens. Verify signal availability at each rebalance close - stale or future signals concentrate exactly there.`,
    python: `import pandas as pd
# targets: index = month-end rebalance dates, columns = stocks
# rets:    daily returns, the master daily calendar

w_ffill = targets.reindex(rets.index).ffill()   # naive: frozen weights

# drift-aware: between rebalances, weights evolve with relative returns
# w_next = w * (1 + r) / (1 + portfolio return) -- winners grow in weight
grown = w_ffill.shift(1) * (1.0 + rets)          # numerator: each name grows
port = 1.0 + (w_ffill.shift(1) * rets).sum(axis=1)
w_drift = grown.div(port, axis=0)                # renormalize by book growth

is_rebal = w_ffill.index.isin(targets.index)     # snap back on rebal dates
w_real = w_drift.where(~pd.Series(is_rebal, index=w_ffill.index), w_ffill)

# turnover now concentrates on rebalance dates -- charge costs there,
# not smeared daily. compare: w_ffill charges (almost) nothing between
# rebalances yet silently assumes daily trading to hold weights fixed.`,
    trap: `Rebalancing ON the signal date at that day's close when the signal needs that close to compute - month-end lookahead, repeated twelve times a year. Shift the trade to the next session. It looks like a one-day detail; for turn-of-month effects it is the whole result.`,
    followUp: `Your monthly strategy's Sharpe changes noticeably when you rebalance on the 3rd business day instead of the 1st. What does that sensitivity tell you, and what would you do about it?`,
  },
  {
    id: "qr-backtest-07-cost-on-notional",
    module: "backtest",
    title: "Spot the bug: costs on notional",
    difficulty: "core",
    question: `A junior's backtest charges 5 bps times gross exposure as the daily cost. The strategy rebalances weekly. What is wrong, how big is the distortion, and which strategies does this bug favor?`,
    thinking: `Locate what costs are physically for: you pay when dollars change hands, so the cost base is dollars TRADED (turnover), never dollars HELD (notional). Then size the damage. Gross exposure 1, 5 bps daily: that is 5 bps times 252, about 12.6 percent a year in phantom costs regardless of trading. The weekly-rebalance strategy might really trade 30 percent of the book once a week - true cost around 0.30 times 5 bps times 52, roughly 0.8 percent a year. The bug overstates costs sixteenfold and would kill a perfectly good strategy in review. Now flip it: for a strategy churning 200 percent daily, notional-based costing charges 5 bps when the truth is 10 - it UNDERSTATES, flattering exactly the strategies costs should kill. One bug, two failure modes, both selecting the wrong strategies. The unit test: zero trading days must incur zero cost.`,
    answer: `Costs belong on turnover - dollars traded - not on notional held. At gross 1, the bug charges about 12.6 percent a year no matter what, versus a true cost near 0.8 percent for a weekly strategy trading 30 percent per rebalance: a 16x overstatement that kills good slow strategies. For a 200-percent-daily churner it understates instead, flattering the strategies that least deserve it. Test: a day with no trades must cost zero.`,
    python: `import pandas as pd
COST = 5.0 / 10000.0

# THE BUG: taxes holding -- nonzero cost even on days with zero trades
gross_exp = weights.abs().sum(axis=1)          # ~1.0 every day
costs_bug = gross_exp * COST                   # ~12.6%/yr of pure fiction

# CORRECT: taxes trading
turnover = weights.diff().abs().sum(axis=1)    # zero between rebalances
costs_ok = turnover * COST

ann_bug = costs_bug.mean() * 252
ann_ok = costs_ok.mean() * 252
print(round(ann_bug, 4), round(ann_ok, 4))     # ~0.126 vs ~0.008

# regression test worth keeping forever:
no_trade_days = turnover < 1e-12
assert (costs_ok[no_trade_days] == 0).all()    # no trade -> no cost`,
    trap: `Believing this bug is conservative because it usually overstates costs. It is not conservative - it is WRONG in a direction that depends on turnover, so it reorders strategies: slow good ones die, fast bad ones survive. A biased filter is worse than a noisy one.`,
    followUp: `Some real costs DO scale with notional held - short borrow fees, financing on leverage. How would you add a borrow-cost line correctly alongside the turnover-based trading cost line?`,
  },
  {
    id: "qr-backtest-08-delisting",
    module: "backtest",
    title: "Delisted names and vanishing losses",
    difficulty: "core",
    question: `Your vendor file only contains currently listed stocks, and separately, returns go NaN after a name delists mid-backtest. What do these two problems do to your results, and how do you handle a delisting day properly?`,
    thinking: `These are two distinct diseases. First, universe construction: building the historical universe from TODAY'S listings is survivorship bias - every bankruptcy and failed acquisition target is deleted from history, and since your shorts would have feasted on exactly those names (and your longs bled on them), a long-short backtest gets a phantom tailwind measured in percent per year. The fix is a point-in-time universe: membership as it stood on each historical date, with dead names included. Second, the mechanical NaN trap: after delisting, returns go NaN, and pandas sum skips NaN - so a position in a name that went to zero contributes NOTHING on its worst day. The backtest silently assumes you exited at the last quoted price, free. Proper handling: on the delist date apply the delisting return (the actual terminal payout if the vendor has it, a punitive default like minus 30 percent for bankruptcies if not), then force the weight to zero afterward.`,
    answer: `Currently-listed-only data is survivorship bias: the disasters are deleted, inflating longs and starving shorts - you need point-in-time universe membership including dead names. Separately, NaN returns after delisting get skipped by sum, so the backtest exits collapsing positions at the last price for free. On the delist date, apply the true delisting return, or a punitive default such as minus 30 percent for involuntary delistings, then zero the position permanently.`,
    python: `import pandas as pd
import numpy as np
# rets: daily returns, NaN forever after each name's delist date
# delist: Series indexed by stock -> delist date (NaT if still alive)
# dl_ret: Series indexed by stock -> terminal return (NaN if unknown)

DEFAULT_DL = -0.30                 # punitive default for involuntary delists
final = dl_ret.fillna(DEFAULT_DL)  # never let "unknown" mean "free exit"

rets_fixed = rets.copy()
alive = delist.notna()
for stk in delist.index[alive]:            # few delist events: loop is fine
    d = delist[stk]
    if d in rets_fixed.index:
        rets_fixed.loc[d, stk] = final[stk]        # terminal hit lands
        rets_fixed.loc[rets_fixed.index > d, stk] = 0.0  # then flat, not NaN

# force positions to zero after delisting so no weight lingers
# (upstream, the weight builder must also stop selecting dead names)
pnl = (weights.shift(1) * rets_fixed).sum(axis=1)
# without the fix, (w * NaN) is skipped by sum(): the -30% day vanishes.`,
    trap: `Testing whether survivorship matters by comparing against the same biased database with a different filter - both runs share the missing graveyard, so they agree, and the agreement gets misread as evidence the bias is small. You can only measure survivorship against a database that contains the dead.`,
    followUp: `Short positions make delisting handling harder: a bankruptcy is a big WIN for a short, but can you realize it? What do borrow recalls and buy-ins do to that paper profit?`,
  },
  {
    id: "qr-backtest-09-stale-signals",
    module: "backtest",
    title: "Rebalancing on stale signals",
    difficulty: "core",
    question: `Your earnings-based signal is forward-filled so every stock has a value every day. One stock stopped reporting eighteen months ago but stays listed. What is your backtest doing, and how do you cap staleness?`,
    thinking: `Forward-fill is an assumption wearing a convenience costume: it asserts the last observation is still the best estimate today. For a quarterly fundamental that is reasonable for about one quarter. Beyond that, the unbounded ffill keeps trading a ghost - and not a random ghost: firms that STOP reporting are disproportionately distressed, mid-acquisition, or delisting-bound, so stale values concentrate in exactly the names where acting on dead information is most expensive. The defense is a staleness budget: forward-fill with an explicit limit tied to the data's natural refresh cycle - around 65 business days for quarterly data - after which the signal becomes NaN and the position sizer must treat the name as no-information (zero active weight), not carry it. Then audit: compute the age of the last observation per name per day and plot its distribution. Every ffill in a pipeline should have a limit argument and a reason for its value.`,
    answer: `Unbounded ffill means the backtest confidently trades an eighteen-month-old number, and non-reporting names skew distressed, so the stale bets cluster where they hurt most. Fix: forward-fill with a limit matched to the data's cadence - roughly 65 business days for quarterly earnings - after which the value is NaN and the portfolio construction must map no-signal to no-active-position. Then monitor signal age as a first-class diagnostic.`,
    python: `import pandas as pd
import numpy as np
# raw: signal values only on announcement days, NaN elsewhere

LIMIT = 65                                  # ~ one quarter of business days
sig = raw.ffill(limit=LIMIT)                # carry at most one refresh cycle
# after LIMIT days without news the signal expires to NaN --
# downstream weighting must treat NaN as "no view", i.e. zero weight,
# NOT skip the stock silently or crash.

# staleness audit: business days since last real observation
obs = raw.notna()
day_no = np.arange(len(raw))[:, None]       # 0,1,2,... as a column
day_frame = pd.DataFrame(np.broadcast_to(day_no, raw.shape),
                         index=raw.index, columns=raw.columns)
last_obs = day_frame.where(obs).ffill()     # day number of last real print
staleness = day_frame - last_obs            # age in business days, per cell
print(staleness.stack().describe())         # tail of this distribution = risk
# rule of thumb: if the 95th percentile of staleness exceeds the data's
# refresh cycle, some ffill upstream is missing its limit argument.`,
    trap: `Mapping expired signals to zero SCORE instead of zero POSITION. A zero z-score is a real, mid-pack view and the portfolio will happily hold the name on it. No information and neutral information are different states; only the first should force the weight itself to zero.`,
  },
  {
    id: "qr-backtest-10-paper-live-gap",
    module: "backtest",
    title: "The paper-vs-live gap",
    difficulty: "core",
    question: `Your fund's strategies consistently realize about 60 percent of backtested Sharpe once live. Break the gap into its causes and tell me which you can fix in the backtest itself.`,
    thinking: `Sort the causes into three buckets before proposing fixes. Bucket one, backtest optimism you can fix: execution assumed at the exact close with full fills; understated impact at real size; ignored borrow fees, locate availability, and financing; a universe quietly including untradeable names. Bucket two, selection effects you can only discount for: the strategy that went live was the best of many tried, so its backtest embeds multiple-testing bias - winner's curse guarantees live underperformance on average even with flawless mechanics; and markets adapt, so the alpha itself decays after discovery and crowding. Bucket three, live frictions with no backtest analog: risk overlays cutting positions in drawdowns, discrete share constraints, compliance restrictions, outages. A consistent 60 percent realization across many strategies actually argues the mechanics are roughly honest and the residual is mostly bucket two - which you handle by haircutting expectations, not by patching code.`,
    answer: `Fixable in the backtest: execution and fill assumptions, size-dependent impact, borrow and financing costs, tradeability screens. Only discountable: selection bias - the live strategy won an in-sample tournament, so its backtest is optimistic by construction - plus post-discovery alpha decay and crowding. Live-only: risk overlays, discrete shares, restrictions. A stable 60 percent haircut across strategies suggests honest mechanics and dominant selection effects: the response is to haircut projections systematically, not to hunt one bug.`,
    trap: `Modeling the gap as a single fudge factor and moving on - or its opposite, endlessly re-auditing backtest code for a bug that is actually multiple-testing bias. The tell that it is selection, not mechanics: the haircut is uniform across strategies with very different turnover and cost profiles.`,
    followUp: `Design the measurement: what would you log in production, and what paired analysis would you run after six months to attribute the gap between fills, costs, and alpha decay?`,
  },
  {
    id: "qr-backtest-11-capacity",
    module: "backtest",
    title: "Estimating capacity",
    difficulty: "hard",
    question: `Your backtest assumes 100 million of capital. The PM asks: how much money can this strategy actually run? Give me a defensible first-pass capacity estimate from the backtest's own trade data.`,
    thinking: `Capacity is where costs eat the alpha, and costs bind through participation: what fraction of each name's daily volume your rebalancing consumes. Start from the trades the backtest already implies. At AUM A, the dollars traded in name i on day t are A times the absolute weight change. Impose a participation ceiling - say 5 percent of that name's average daily volume, above which square-root impact and adverse selection get ugly - and each name-day yields an implied maximum AUM: the ceiling times ADV divided by the weight change. Your book-level capacity is set by the binding name-days, but taking the absolute minimum lets one illiquid outlier define the answer; a low percentile of the distribution is the robust envelope, with the caveat that you would restructure the tail names rather than obey them. Then sanity-check with the smarter framing: capacity is not a wall but a Sharpe-versus-AUM curve from the impact model - report the AUM where net Sharpe hits your floor.`,
    answer: `From the backtest's weight changes: dollars traded per name-day equal AUM times the absolute weight change; capping participation at around 5 percent of each name's ADV turns every name-day into an implied max AUM, and a low percentile of that distribution is the first-pass capacity. Then refine: with square-root impact, capacity is really the AUM where net Sharpe decays to your minimum acceptable level - a curve, not a cliff - and turnover is the biggest lever on it.`,
    python: `import pandas as pd
# adv: dates x stocks, average daily dollar volume (e.g. 21-day mean)
# weights: the backtest's daily weights

P_MAX = 0.05                              # max participation: 5% of ADV
dw = weights.diff().abs()                 # fraction of book traded, per name-day

# implied max AUM from each name-day: A * dw <= P_MAX * adv
implied = (P_MAX * adv) / dw.where(dw > 1e-6)   # ignore negligible trades

flat = implied.stack()
cap_min = flat.min()                      # one illiquid outlier sets this
cap_p05 = flat.quantile(0.05)             # robust binding envelope
print(round(cap_min / 1e6), round(cap_p05 / 1e6))

# report the 5th percentile, but LIST the names below it -- in practice
# you would cap or drop those positions rather than let the tail set
# strategy capacity. full answer: sweep AUM through a sqrt-impact cost
# model and report net Sharpe vs AUM; capacity = AUM at your SR floor.`,
    trap: `Quoting capacity from average liquidity. Capacity is set by the binding tail - the illiquid names and the heavy-trade days - not the typical ones. An average-based estimate can be an order of magnitude too high, and the error is discovered with real money already deployed.`,
    followUp: `Turnover enters capacity roughly inversely - halve the turnover, double the capacity. Given your smoothing tools from portfolio construction, how would you trade Sharpe against capacity, and who in the firm should make that call?`,
  },
  {
    id: "qr-backtest-12-timing-sensitivity",
    module: "backtest",
    title: "Execution timing sensitivity",
    difficulty: "hard",
    question: `Delaying your backtest's execution by one extra day drops Sharpe from 1.8 to 0.4. What exactly does that experiment measure, and does it kill the strategy?`,
    thinking: `Be precise about what each lag asserts. The shift(1) run assumes you compute the signal and execute at effectively the same close - zero latency between information and position. The shift(2) run gives you a full day. The Sharpe collapse from 1.8 to 0.4 measures the alpha's decay rate at daily resolution: most of the predictive content is spent within one day of formation. That is a fact about the signal, not yet a verdict. The verdict depends on whether your real execution sits closer to lag one or lag two: if you can genuinely compute and trade near that same close, 1.8 might be attainable - but now the strategy is an execution-infrastructure bet as much as an alpha bet, and slippage in HOURS matters. If your ops realistically land mid-way, neither backtest is your strategy. The general habit: treat the lag-sensitivity curve as a standard diagnostic; steepness equals operational fragility.`,
    answer: `It measures alpha decay at daily resolution: the signal spends most of its content within a day, so the strategy's economics live in the execution gap between signal time and fill time. It is only fatal if you cannot execute near the assumed timestamp - the honest next steps are to locate your true operational lag, backtest at that lag including intraday slippage, and treat the steep decay as an infrastructure requirement and a fragility flag, not a reason to trust the 1.8.`,
    python: `import numpy as np
import pandas as pd

def ann_sharpe(pnl):
    return pnl.mean() / pnl.std() * np.sqrt(252)

# lag-sensitivity curve: THE standard robustness diagnostic.
# lag=1 assumes execution at the signal close (zero latency);
# each +1 gives execution one more day of delay.
for lag in [1, 2, 3, 5]:
    pnl = (weights.shift(lag) * rets).sum(axis=1)
    print(lag, round(ann_sharpe(pnl), 2))
# read the CURVE, not one point:
#  flat curve  -> slow alpha, execution timing is a detail
#  cliff at 2  -> fast alpha; the business case now depends on proving
#                 you can trade inside the day-one window, and on
#                 intraday slippage the daily backtest cannot see.
# a cliff plus optimistic close-fill assumptions is how strategies
# ship at paper Sharpe 1.8 and realize 0.6.`,
    trap: `Reporting the shift(1) Sharpe because "we will build fast execution later". Zero-latency close fills are the single most common optimistic assumption in daily backtests, and for fast signals they are the entire result. Underwrite the strategy at the lag you can prove today.`,
    followUp: `The curve is flat from lag 1 to 5 but the alpha is small. Flip side: what does a FLAT lag curve buy you operationally in execution cost terms, and how would you monetize that flexibility?`,
  },
  {
    id: "qr-backtest-13-sharpe-three-checklist",
    module: "backtest",
    title: "Backtest says Sharpe 3",
    difficulty: "hard",
    question: `A fresh backtest of your new idea prints Sharpe 3. Before showing anyone, what is your ordered checklist - and in your experience of these bugs, what is the base rate that the 3 is real?`,
    thinking: `Start from the prior: genuine Sharpe 3 at daily frequency in liquid markets is rare enough that "bug" should be your default hypothesis - most of what you will ever see at that level is leakage. So order the checklist by yield. First, timing: is every input shifted, including inside feature construction, joins, and the rebalance calendar - and does Sharpe survive one extra day of lag? Second, point-in-time integrity: as-of joins for fundamentals, no restated data, universe membership as of each date, delistings present. Third, costs and frictions at honest levels, charged on turnover, with borrow for shorts. Fourth, concentration: P&L by name, day, and period - is it three meme-stock days? Fifth, stale or misprinted prices manufacturing reversal alpha in illiquid names. Sixth, multiple testing: how many variants preceded this one? Each check that passes moves the posterior a little; a Sharpe that DROPS under scrutiny and stabilizes around 1 is the realistic good outcome.`,
    answer: `Ordered by hit rate: lookahead - audit every shift, join, and the rebalance calendar, then demand survival at one extra day of lag; point-in-time violations - as-of joins, universe membership, delistings; costs charged on turnover at honest levels including borrow; P&L concentration by name and day; stale-price reversal in illiquid names; and multiple-testing - count the variants that died before this one. Base rate honest answer: at daily frequency, well under one in ten survive as Sharpe 3; the good outcome is stabilizing near 1.`,
    trap: `Running the checks in whatever order is convenient and stopping at the first pass - or worse, "fixing" the backtest by iterating until Sharpe recovers, which converts a bug hunt into another round of overfitting. Decide the checklist before looking, and let the number fall where it falls.`,
    followUp: `Now invert it: the backtest prints Sharpe 0.3 on an idea with a strong prior - solid economics, worked at another shop. What is the checklist for bugs that DESTROY real alpha, and why do those get so much less attention?`,
  },
  {
    id: "qr-backtest-20260808-walk-forward",
    module: "backtest",
    title: "Walk-forward validation vs a single train/test split",
    difficulty: "hard",
    question: `You tune a lookback window and a threshold for a signal using an 8-year sample split 70/30 into train and test. It looks great out of sample. Your PM asks you to redo it with walk-forward validation before it goes live. Why isn't the single split good enough, and what does walk-forward buy you?`,
    thinking: `A single 70/30 split gives exactly ONE out-of-sample verdict, so you cannot tell whether it generalizes across regimes or whether you simply drew a lucky -- or unlucky -- test window. It is also quietly leakier than it looks: if you iterate parameter choices and re-check the same fixed test set even a few times during research, that "out of sample" set has functioned as extra training data through researcher degrees of freedom, whether or not you meant it to. Walk-forward validation refits or reselects parameters on a rolling or expanding window and scores only the NEXT chunk, chaining many small train/test folds through time. That produces a distribution of out-of-sample outcomes across different regimes instead of one number, and it mirrors how the strategy will actually be run in production -- periodically retuned on what was knowable so far. It is not immune to overfitting the walk-forward PROCESS itself, but it turns one lucky window into a visible distribution you can actually interrogate.`,
    answer: `A single split gives one out-of-sample data point, which cannot distinguish genuine generalization from a lucky test window, and repeated peeking at that fixed test set during tuning quietly leaks information back into it. Walk-forward validation chains many rolling or expanding train/test folds through time, producing a distribution of out-of-sample outcomes across different regimes and mirroring how the strategy will actually be periodically retuned in production -- turning one lucky verdict into a visible, checkable spread.`,
    trap: `Running walk-forward once, looking only at the aggregate Sharpe across all folds, and declaring victory without checking the DISPERSION between folds. A walk-forward that is excellent in some two-year windows and terrible in others is not more trustworthy than the single split -- it is the same instability, just now visible if you bother to look fold by fold.`,
    followUp: `Two designs: an expanding window, where the training set grows every fold, versus a rolling window, a fixed-size training set that slides forward. Which would you prefer for a signal you suspect is regime-dependent, and why?`,
  },
  {
    id: "qr-backtest-20260809-short-borrow-constraints",
    module: "backtest",
    title: "Modeling short-sale constraints: borrow and locate",
    difficulty: "core",
    question: `Your long-short backtest assumes every short position can be entered at any size, any time, for free. In production, shorting requires borrowing shares from a lender, paying a borrow fee, and the borrow can be recalled or simply unavailable for hard-to-borrow names. What does ignoring this do to a backtest, and how do you model it?`,
    thinking: `Separate the two costs the free-shorting assumption hides. First, borrow fee: a continuous cost, quoted in annualized basis points on the position's notional, paid for as long as the short is held -- a few basis points a year for easy-to-borrow large caps, but tens of percent annually for hard-to-borrow small caps, recent IPOs, or heavily-shorted names, easily exceeding the alpha the position was entered for. Second, availability: some names simply have no borrow supply at any price on a given day, so the short cannot be entered at all -- a backtest that ignores this silently assumes access to a short book that does not exist, and this concentrates exactly where short alpha tends to be strongest, since distressed and controversial names are disproportionately hard to borrow because everyone else wants to short them too. A defensible backtest needs a borrow-cost line charged on notional held, and a hard availability filter that removes unborrowable names from the tradable short universe rather than silently trading them for free.`,
    answer: `Free-shorting backtests both overstate short P&L (missing the borrow fee, which can be tens of percent annually on hard-to-borrow names) and overstate short CAPACITY (some names have zero borrow supply and cannot be shorted at any cost, yet the backtest happily sizes into them). Both errors concentrate exactly where short alpha is strongest, since crowded or distressed names are the ones everyone wants to borrow. Model it with a borrow-fee cost line charged on notional held, and a hard availability filter that drops unborrowable names from the tradable short universe rather than trading them for free.`,
    python: `import pandas as pd
import numpy as np

# weights: dates x stocks target weights (negative = short)
# borrow_bps: dates x stocks, annualized borrow fee in bps (from a borrow feed,
#             or a conservative tiered proxy: cap-bucket x short-interest-bucket)
# available: dates x stocks boolean, True if borrow supply exists that day

shorts = weights.clip(upper=0.0)

# 1) hard-to-borrow / unavailable names simply cannot be shorted --
#    zero them out rather than silently pricing an impossible position for free
shorts_feasible = shorts.where(available, other=0.0)

# 2) borrow fee: a HOLDING cost (like financing), charged on notional held,
#    not on turnover -- this is separate from the trading-cost line
daily_borrow_rate = borrow_bps / 10000.0 / 252
borrow_cost = (shorts_feasible.abs() * daily_borrow_rate).sum(axis=1)

longs = weights.clip(lower=0.0)
gross_ret = ((longs + shorts_feasible).shift(1) * rets).sum(axis=1)
net_ret = gross_ret - borrow_cost               # plus trading costs separately

# sanity check: how much short alpha lived in NOW-unborrowable names?
lost_short_exposure = (shorts - shorts_feasible).abs().sum(axis=1)
print(lost_short_exposure.describe())`,
    trap: `Using a single flat borrow rate (say, 30 bps) for every short in the book "to keep it simple". That materially understates cost on the hard-to-borrow tail where fees can be 20-50% annualized, and just as importantly hides the AVAILABILITY problem entirely -- a flat rate implies every name is always shortable at that price, which is false for exactly the names a short-alpha strategy wants most.`,
    followUp: `A stock you are short becomes very hard to borrow mid-quarter and your lender issues a recall notice. Your signal still says short. What does a realistic backtest do on the day of a forced buy-in versus what a naive backtest assumes?`,
  },
  {
    id: "qr-backtest-20260810-cost-model-choice",
    module: "backtest",
    title: "Linear cost vs square-root market impact",
    difficulty: "warmup",
    question: `Your backtest currently charges a flat 5 basis points per unit traded, regardless of trade size. A teammate says that is fine for a 50-million-dollar book but will badly understate costs if the strategy scales to 2 billion. What is missing from a flat linear cost, and what is the standard fix?`,
    thinking: `A flat bps-per-dollar-traded cost really models only the bid-ask spread -- a cost that genuinely is roughly proportional to notional traded, since crossing the spread costs the same rate whether you trade one share or a thousand, up to the size quoted at the touch. What it misses entirely is market impact: pushing a large order through the book moves the price against you, and that effect grows faster than linearly in size, because you consume progressively worse levels of liquidity the more you trade -- empirically and theoretically, impact scales roughly with the SQUARE ROOT of order size relative to average daily volume, not linearly. At 50 million dollars in a liquid book, impact is a rounding error next to the spread cost, so a flat rate looks fine -- the two cost models only diverge once trade size becomes a meaningful fraction of daily volume, exactly what happens when a strategy scales. The fix is a two-term cost model: a linear spread-crossing component plus a square-root impact component scaled by trade size over ADV.`,
    answer: `A flat bps rate only captures the spread-crossing cost, which genuinely is linear in size -- it is silent on market impact, the price move YOU cause by trading, which grows roughly with the SQUARE ROOT of trade size relative to average daily volume, not linearly. At small size relative to ADV the two models barely differ, which is why the flat rate looked fine at 50 million; at 2 billion, impact dominates and a linear-only model badly understates true cost. Standard fix: a two-term cost model, a linear spread component plus a square-root impact component scaled by (trade size / ADV).`,
    python: `import numpy as np

# trade_notional: dollars traded in one name on one day
# adv_notional: that name's average daily dollar volume
trade_notional = np.array([1e6, 1e6])
adv_notional = np.array([50e6, 500e6])   # same trade size, very different liquidity

spread_bps = 3.0          # linear: crossing the spread, roughly size-independent rate
impact_coef = 15.0        # bps at 100% of ADV traded -- calibrated per universe

participation = trade_notional / adv_notional          # fraction of ADV traded

linear_cost_bps = np.full_like(participation, spread_bps)
impact_cost_bps = impact_coef * np.sqrt(participation)  # square-root law

total_cost_bps = linear_cost_bps + impact_cost_bps
print(np.round(total_cost_bps, 2))
# same $1mm trade: cheap in the 500mm-ADV name, meaningfully pricier
# in the 50mm-ADV name -- a flat rate would have charged both identically`,
    trap: `Calibrating a single flat bps rate once, on a period when the strategy traded small relative to ADV, and reusing it unchanged as AUM grows. The rate that looked conservative at launch silently understates real costs precisely as the strategy scales into the size range where impact starts to dominate -- the backtest's cost line gets LESS accurate exactly when the stakes get larger.`,
    followUp: `You calibrate the impact coefficient from your own historical fills. What is the risk of estimating impact only from trades your OWN strategy already made, versus what a strategy trading 10x the size would actually experience?`,
  },
  {
    id: "qr-backtest-20260811-overnight-intraday-decomposition",
    module: "backtest",
    title: "Overnight vs intraday return decomposition",
    difficulty: "core",
    question: `You have a mean-reversion signal that looks solid on close-to-close returns, but you suspect its edge is concentrated in just the first few minutes after the open rather than spread across the trading day. How do you decompose a daily close-to-close return into its overnight and intraday components, and why does knowing the split change how you would actually trade the signal?`,
    thinking: `Start from the identity: the close-to-close return compounds two pieces that happen in completely different market states. Overnight return is open_t divided by close_{t-1} minus one -- the gap that accumulates while the market is CLOSED and nobody can trade through it continuously, only cross it in one jump at the open. Intraday return is close_t divided by open_t minus one -- the part that unfolds while the market is open and continuously tradable. Multiply (1 + overnight) by (1 + intraday) and you recover the close-to-close return exactly. Once you can measure both pieces separately, you can measure the signal's information coefficient against EACH component instead of only the blended total, and well-documented equity anomalies concentrate almost entirely in one -- short-term reversal, famously, mostly lives in the overnight gap in US equities. That matters enormously for execution realism: an edge that lives overnight can only be captured by holding a position INTO the close and through the gap, typically via a market-on-close order, with real overnight gap risk (earnings, news) the whole time you cannot trade out of it; an edge that lives intraday is captured with continuous execution and no overnight exposure at all. Backtesting only the blended close-to-close return implicitly assumes both windows are equally and freely tradable, which understates the execution difficulty and risk of whichever piece is actually driving the number.`,
    answer: `Split the close-to-close return into overnight (open over prior close, minus one -- the untradeable gap) and intraday (close over open, minus one -- the continuously tradable part); the two compound multiplicatively back to the total. Measuring the signal's IC against each component separately often reveals the edge is concentrated in one -- short-term reversal, for instance, mostly lives overnight in US equities. That determines the right execution: an overnight edge needs a market-on-close order and carries real gap risk through a window you cannot trade out of, while an intraday edge is captured with continuous execution and no overnight exposure. Backtesting the blended close-to-close number alone hides which of those two very different risk profiles you are actually underwriting.`,
    python: `import pandas as pd
import numpy as np

# open_px, close_px: wide DataFrames, dates x tickers

overnight_ret = open_px / close_px.shift(1) - 1.0     # gap: prior close -> today's open
intraday_ret = close_px / open_px - 1.0                # continuous session: open -> close

# reconciliation: the two compound back to close-to-close, exactly
close_to_close = close_px.pct_change()
recon_gap = ((1 + overnight_ret) * (1 + intraday_ret) - 1 - close_to_close).abs().max().max()
assert recon_gap < 1e-9

# decompose the signal's forward IC by component instead of only the blend
# sig: wide DataFrame, signal known as of yesterday's close
def cs_ic(a, b):
    za = a.sub(a.mean(axis=1), axis=0).div(a.std(axis=1), axis=0)
    zb = b.sub(b.mean(axis=1), axis=0).div(b.std(axis=1), axis=0)
    return (za * zb).mean(axis=1)

ic_overnight = cs_ic(sig, overnight_ret).mean()
ic_intraday = cs_ic(sig, intraday_ret).mean()
print(round(ic_overnight, 4), round(ic_intraday, 4))
# a large gap between the two tells you WHERE the edge lives, and therefore
# what execution assumption the backtest needs to make honest`,
    trap: `Assuming the overnight component is the "free" or lower-cost half just because it is often the larger share of the raw return. Overnight positions carry real gap risk -- earnings surprises and overnight news the position cannot be exited from -- that a same-day intraday round-trip never bears, so the two components differ in RISK, not only in return; a Sharpe computed by blending a low-vol intraday edge with the overnight return driving most of the raw number understates true risk unless each component's own volatility is measured separately.`,
    followUp: `Your signal's IC is strong overnight and near zero intraday. What does that suggest about the underlying economic mechanism -- is this more likely a liquidity-provision effect or an information-driven effect, and how would that change how aggressively you size the position going into the close? (Overnight-concentrated reversal is usually attributed to liquidity provision -- absorbing order-flow imbalance that built up during the day and reverts at the next open -- rather than genuine new information, which argues for disciplined, capacity-aware sizing rather than scaling up as if it were a fundamental signal.)`,
  },
  {
    id: "qr-backtest-20260812-nav-lookahead-sizing",
    module: "backtest",
    title: "Sizing today's trade off today's own NAV",
    difficulty: "hard",
    question: `Your vectorized backtest computes each day's target dollar position as target_weight * nav, where nav is the portfolio's net asset value built with nav = nav0 * (1 + strategy_returns).cumprod(). A teammate sizes today's trade using that SAME row's nav. The backtest's returns look suspiciously smooth. What's the bug?`,
    thinking: `Trace the dependency: nav on row i, built via cumprod, already folds in day i's own return before that row exists. Using nav[i] -- this same row -- to size day i's trade means the position size depends on a portfolio value that already reflects day i's own outcome, equivalent to knowing today's P&L before deciding how big a position to take today. It's a subtler cousin of the classic shift(1) signal-lagging discipline, except the leak runs through the SIZING variable, NAV, rather than the signal itself. The fix is the same idea applied one level down: size day i's position off nav as of the START of day i, i.e. nav shifted by one row, and only let nav absorb day i's return after that position is already fixed.`,
    answer: `nav[i] as constructed already includes day i's own return, so sizing day i's position off that same-row nav means you know day i's P&L before deciding day i's position size -- a lookahead leak through the sizing variable, not the signal. The position for day i must be sized off nav as of the START of day i, i.e. nav.shift(1) (yesterday's ending value), with nav[i] only reflecting the return that position actually earned. Same discipline as lagging the signal, just applied to NAV instead.`,
    python: `import pandas as pd

df = pd.DataFrame({"target_weight": weights, "asset_ret": asset_returns})
nav0 = 1_000_000.0

# WRONG: reads like an innocent one-liner, but nav on row i ALREADY
# reflects day i's own return (cumprod folds it in) -- sizing off this
# same-row nav leaks day i's own outcome into day i's own sizing
strat_ret_wrong = df["target_weight"] * df["asset_ret"]
nav_wrong = nav0 * (1 + strat_ret_wrong).cumprod()
position_wrong = df["target_weight"] * nav_wrong          # <- leak: same-row nav

# RIGHT: size off nav as of the START of the day -- shift(1) so day i's
# position uses day i-1's ending value, fixed BEFORE day i's return is known
strat_ret = df["target_weight"] * df["asset_ret"]
nav = nav0 * (1 + strat_ret).cumprod()
start_of_day_nav = nav.shift(1).fillna(nav0)
position_dollars = df["target_weight"] * start_of_day_nav   # sized off YESTERDAY's nav`,
    trap: `Vectorizing this as target_weight * nav in a single column expression without ever asking which nav row that is. It reads as perfectly ordinary code, but nav on the same row already reflects that day's own return by construction -- the leak hides inside an operation that looks completely innocent.`,
  },
  {
    id: "qr-backtest-20260813-limit-order-fills-touch-vs-cross",
    module: "backtest",
    title: "Limit order fills in a vectorized backtest: touch vs cross",
    difficulty: "hard",
    question: `Your vectorized backtest fills a resting buy limit order whenever that bar's low is less than or equal to the limit price -- price <= limit means filled. Live trading, the same strategy fills noticeably less often at that price than the backtest predicts. What's the gap, and how do you model it without dropping to bar-by-bar simulation?`,
    thinking: `The backtest rule confuses two different events: the market TOUCHING your limit price and the market actually TRADING THROUGH enough size at that price to fill YOUR order. Touch just means the bar's low reached your price at some instant -- it says nothing about how much volume traded there, how far back in the queue your order sits behind other resting orders at the same price (queue priority), or whether the touch was a single print that reversed instantly with no real liquidity behind it. "Low <= limit" during the bar is necessary for a fill but nowhere close to sufficient, and treating it as sufficient systematically overstates your fill rate, especially right at support/resistance levels where lots of other orders cluster at exactly the same round-number price and are fighting for the same queue position you are. The fix without going to full bar-by-bar event simulation: require the price to trade THROUGH your limit by some cushion, not just touch it, and cross-check against the bar's volume, only marking a fill when it's plausible your order size could have been filled given how much total volume traded at or through that level.`,
    answer: `"Low <= limit" only confirms the market touched your price, not that it traded through with enough volume to actually fill your order given queue priority -- treating touch as fill systematically overstates fill rate, worst at popular round-number levels where many resting orders compete for the same price. Fix without full event simulation: require price to trade through the limit by a small cushion rather than merely touch it, and gate the fill on the bar's volume being large enough, relative to typical volume at that price level, that your order size plausibly got through the queue -- a probabilistic fill model, not a deterministic touch rule.`,
    python: `import pandas as pd
import numpy as np

bars = pd.DataFrame({
    "low": [99.8, 100.0, 99.95], "high": [101.0, 100.5, 100.2],
    "volume": [500_000, 20_000, 800_000],   # middle bar: a thin, low-conviction touch
})
limit_price = 100.0
order_size = 50_000

# WRONG: touch-only fill rule -- fires on EVERY bar where low reaches the limit,
# including the thin bar that barely touched with almost no volume behind it
naive_fill = bars["low"] <= limit_price

# BETTER: require trading THROUGH the limit by a cushion, not just touching it,
# and require enough volume that the order plausibly cleared the queue
CUSHION = 0.02
MIN_VOLUME_MULTIPLE = 5   # order must be a small fraction of the bar's volume
realistic_fill = (
    (bars["low"] <= limit_price - CUSHION) &
    (bars["volume"] >= order_size * MIN_VOLUME_MULTIPLE)
)

print("naive fills:    ", naive_fill.tolist())      # [True, True, True]
print("realistic fills:", realistic_fill.tolist())  # thin middle bar drops out`,
    trap: `"Fixing" the overstated fill rate with a flat fill-probability haircut, like assuming only 70% of touch-triggered orders fill, applied uniformly regardless of the bar's actual volume or how far through the limit price traded. That's an improvement over the naive rule but still ignores that fill likelihood genuinely varies bar to bar with real liquidity conditions, so it can still misrank strategies that differ in how aggressively they place limits relative to typical volume.`,
    followUp: `Your realistic-fill model now shows the strategy's live fill rate is well matched by the backtest, but live slippage on FILLED orders is still worse than backtested. What's a second, separate mechanism -- distinct from the fill-rate question -- that a touch-based fill model still doesn't capture?`,
  },
  {
    id: "qr-backtest-20260814-adv-participation-cap",
    module: "backtest",
    title: "Capping trade size to a fraction of ADV",
    difficulty: "hard",
    question: `Your vectorized backtest computes target position sizes from a signal and assumes every trade fills completely, same day, at no market impact beyond your cost model. For a strategy that would need to trade 50,000 shares against a name with only 100,000 shares of average daily volume, is that realistic, and how do you cap it in a vectorized way?`,
    thinking: `No -- trying to trade 50% of a name's ADV in one day isn't realistic; real desks cap participation at roughly 5-15% of ADV per day specifically to avoid the impact a linear or square-root cost model doesn't fully capture at that size. The naive fix, dropping low-ADV names from the backtest, throws away real capacity information. Better: model the cap explicitly. Clip each day's target trade to +/- (participation_rate * ADV) and either carry the unfilled remainder forward to the next day or, as a simpler first pass, just accept the position undershoots target that day. Since ADV and participation rate are both just per-date vectors, this is a single Series.clip() against a per-day cap -- no loop needed, the same vectorization discipline the rest of the backtest already relies on.`,
    answer: `Not realistic -- 50% of ADV in a day would incur far more impact than a simple cost model captures; real desks cap participation around 5-15% of ADV per day. Model it explicitly rather than dropping the name: clip the day's signed target trade to +/- (participation_rate * ADV), vectorized with Series.clip() against a per-day cap series, and either carry the unfilled remainder forward or accept the position undershoots target that day.`,
    python: `import pandas as pd

dates = pd.date_range("2024-06-03", periods=5, freq="B")
target_shares = pd.Series([50_000, 20_000, -80_000, 10_000, 5_000], index=dates)
adv = pd.Series([100_000, 100_000, 100_000, 100_000, 100_000], index=dates)
participation_cap = 0.10   # never trade more than 10% of ADV in a single day

max_tradable = adv * participation_cap
# clip the SIGNED target to +/- the cap; simplifying assumption here is that
# anything unfilled just doesn't trade rather than carrying forward to tomorrow
filled = target_shares.clip(lower=-max_tradable, upper=max_tradable)
unfilled = target_shares - filled

print(pd.DataFrame({"target": target_shares, "filled": filled, "unfilled": unfilled}))
# day 1: wanted 50k, capped to 10k -- 40k never trades under this simplification`,
    trap: `Sizing trades purely off the signal and a fixed cost-per-share model without ever checking traded size against ADV -- the backtest will happily report filling a $50M order in an illiquid name in one day at a cost that bears no resemblance to what would actually happen.`,
  },
  {
    id: "qr-backtest-20260815-cash-drag",
    module: "backtest",
    title: "Cash drag in a long-short backtest",
    difficulty: "warmup",
    question: `Your dollar-neutral long-short backtest (100% long notional, 100% short notional, net zero) computes daily strategy return as (long P&L + short P&L) divided by gross exposure (the sum of both legs). A teammate says this understates the strategy's true return because it ignores cash. Are they right?`,
    thinking: `Separate two different things hiding under "ignores cash." First, the denominator choice: dividing by gross exposure (long + short, roughly 2x your capital in a fully-invested dollar-neutral book) versus dividing by capital (roughly 1x) changes the reported return by about 2x with zero change in actual trades -- that's a leverage-convention question, not a cash question, and it needs to be stated explicitly and applied consistently whenever you compare Sharpe ratios across backtests. Second, the genuine cash point: shorting generates cash proceeds held as collateral, and in a real fully-funded fund that collateral typically earns something close to the risk-free rate -- financing income that a pure P&L-over-exposure calculation leaves out entirely. So the teammate is right that something is being left out, but the fix isn't automatically "add cash into the P&L" -- it's making the leverage convention explicit and, only if you're benchmarking against a real funded strategy, adding back the risk-free carry on collateral.`,
    answer: `Partly right, but the two issues are different. The denominator (gross exposure vs capital) is a leverage-convention choice that scales the reported return by a fixed factor with no bearing on cash -- state it explicitly and keep it consistent across backtests you compare. The genuine cash omission is financing income: short sales generate collateral that a real fund earns roughly the risk-free rate on, which a pure P&L/exposure calculation doesn't include. Add that back only if you're comparing against a fully-funded, real-world strategy.`,
    python: `import numpy as np

long_pnl, short_pnl = 12_000, 8_000
capital = 1_000_000
gross_exposure = 2 * capital   # 100% long + 100% short

ret_on_gross = (long_pnl + short_pnl) / gross_exposure
ret_on_capital = (long_pnl + short_pnl) / capital
# same trades, same P&L -- the two "returns" differ by exactly 2x.
# neither is wrong; they answer different questions, so pick one and label it

daily_rf = 0.04 / 252   # annual risk-free rate, daily
financing_income = capital * daily_rf   # collateral earned on the short leg
fully_funded_ret = (long_pnl + short_pnl + financing_income) / capital`,
    trap: `Comparing Sharpe ratios across two backtests that silently use different denominator conventions (one on gross, one on capital). The Sharpe ratios differ by roughly the leverage ratio between them, and it looks like a genuine performance difference until someone checks the denominator each one used.`,
    followUp: `The short leg's borrow cost (what you pay to borrow hard-to-borrow shares) is separate from financing income on collateral. Where does that cost belong in the P&L, and can it ever exceed the collateral interest you're earning?`,
  },
  {
    id: "qr-backtest-20260816-execution-latency-slippage",
    module: "backtest",
    title: "Modeling execution latency in a vectorized backtest",
    difficulty: "core",
    question: `Your signal fires at the 3:55pm close-approaching snapshot, and your vectorized backtest assumes the fill happens instantly at that exact price. In reality, order routing, exchange matching, and your own risk checks add roughly 200-500ms of latency before the order reaches the book. Does this matter for a daily-rebalance equity strategy, and how would you stress-test it without abandoning vectorization?`,
    thinking: `First separate two regimes by how much latency actually costs you. For a daily-rebalance, multi-day-holding-period equity strategy, a few hundred milliseconds is economically negligible -- the price barely moves in that time relative to the strategy's whole edge, so treating the fill as instantaneous at the decision price is a reasonable approximation, and simulating microsecond-level order queues would buy essentially nothing. Latency matters far more for high-turnover or short-holding-period strategies, where a few hundred milliseconds is a meaningful fraction of the trade's expected life and adverse selection -- the market moving against you specifically because your latency let faster participants react first -- becomes a real cost. Stress-testing it without abandoning vectorization means not simulating microstructure directly: inject a randomized price-impact penalty calibrated to a latency assumption -- say, always fill some basis points worse than the decision price, scaled by that name's typical volatility over the assumed latency window -- and check whether the strategy's edge survives a range of penalty sizes. If Sharpe collapses under a penalty far smaller than realistic latency-driven slippage, the strategy's edge was an artifact of unrealistically clean fills, not the frequency you were simulating.`,
    answer: `For a daily-rebalance equity strategy, a few hundred milliseconds of order latency is economically negligible relative to the holding period and can safely be approximated as instant. It matters much more for high-turnover, short-holding strategies, where adverse selection during that window is a real cost. Stress-test it without simulating microstructure directly: inject a randomized slippage penalty scaled to short-horizon volatility at each fill and check whether the edge survives across a plausible range of penalty sizes -- if it collapses under a small penalty, the backtest's edge depended on unrealistically clean fills.`,
    python: `import numpy as np

rng = np.random.default_rng(0)

# decision_price: price at signal time; vol: that name's daily vol, used
# to scale a plausible latency-driven price move over a short window
def simulate_with_slippage(decision_price, vol, side, latency_bps_scale=0.15):
    # side: +1 buy, -1 sell. Adverse selection means the price tends to
    # move AGAINST you during latency -- model a penalty with mean > 0,
    # not zero-mean noise (zero-mean would net out across many trades).
    penalty_bps = np.abs(
        rng.normal(latency_bps_scale * vol * 1e4, vol * 1e4 * 0.05)
    )
    return decision_price * (1 + side * penalty_bps / 1e4)

# re-run the whole backtest at several penalty scales and compare Sharpe:
for scale in [0.0, 0.15, 0.30, 0.60]:
    # fills = simulate_with_slippage(decision_prices, vols, sides, scale)
    # pnl = compute_pnl(fills, ...)
    # sharpe = pnl.mean() / pnl.std() * np.sqrt(252)
    pass  # wire into the actual vectorized P&L computation
# if Sharpe at scale=0.6 is still comfortably positive, the edge is
# robust to latency; if it's gone by scale=0.15, it was too optimistic`,
    trap: `Modeling latency slippage as zero-mean noise -- a random price bump in either direction. Real latency-driven adverse selection is NOT zero-mean: faster participants systematically react to information before your order arrives, biasing fills against you on average. A zero-mean penalty washes out in aggregate P&L and understates the true cost.`,
    followUp: `How would you distinguish latency-driven slippage from ordinary bid-ask spread cost in a post-trade analysis, since both show up as "my fill was worse than the decision price"? (Compare arrival price to the first-tradeable price on the far side of the spread versus the actual fill; spread-crossing cost exists even with zero latency, while extra degradation correlated with short-horizon momentum right after your decision timestamp points to latency specifically.)`,
  },
  {
    id: "qr-backtest-20260817-warmup-period-leakage",
    module: "backtest",
    title: "Warm-up period leakage: starting P&L before the lookback window is full",
    difficulty: "core",
    question: `Your signal needs a 60-day rolling window to compute (e.g. a 60-day momentum feature). You load 5 years of price history, compute the rolling feature over the whole series, and start your backtest's P&L accounting on day 1 of the loaded data. What's wrong with that, and what actually needs to happen?`,
    thinking: `The first 59 rows of any 60-day rolling computation are built on a PARTIAL window -- pandas' rolling defaults to producing NaN for those unless you've set a smaller min_periods, in which case it silently computes an average over however many days happen to be available, which is a materially different and noisier quantity than the intended 60-day feature. If your backtest's P&L timer starts on day 1 of the loaded data instead of the first day the full 60-day window is actually available, you're either trading on NaN signals (which a careless implementation might coerce to zero or forward-fill from nothing, both wrong) or trading on partial-window signals that don't match what production would ever compute, distorting early performance in a way that's not representative. The fix is to load extra history purely as a warm-up buffer -- at least one window-length extra before your true backtest start date -- compute the rolling feature over the whole thing, then slice OFF the warm-up period before P&L accounting begins, so every single P&L day used the fully-formed feature.`,
    answer: `The first 59 days of a 60-day rolling window are partial or NaN, so if P&L accounting starts on day 1 of loaded data you're trading on incomplete signals that production never actually computes. Load extra history as a pure warm-up buffer -- at least one window-length before your intended start date -- compute the rolling feature across all of it, then slice the warm-up period OFF before P&L accounting begins, so every backtested day uses a fully-formed signal.`,
    python: `import pandas as pd
import numpy as np

WINDOW = 60
backtest_start = pd.Timestamp("2024-01-01")

# load extra history: window trading days before the real start, as buffer
warmup_start = backtest_start - pd.tseries.offsets.BDay(WINDOW + 10)  # padding
dates = pd.bdate_range(warmup_start, "2024-12-31")
rng = np.random.default_rng(0)
prices = pd.Series(100 * (1 + rng.normal(0, 0.01, len(dates))).cumprod(), index=dates)

returns = prices.pct_change()
momentum = returns.rolling(WINDOW).mean()

# slice OFF the warm-up buffer -- P&L accounting only ever sees a
# fully-formed 60-day window, never a NaN or partial one
momentum_live = momentum.loc[momentum.index >= backtest_start]
assert momentum_live.isna().sum() == 0`,
    trap: `Silencing the NaNs with min_periods=1 to "make the backtest start earlier." That doesn't fix anything -- it just replaces an honest NaN with a dishonest partial-window average that production would never trade on, hiding the problem instead of solving it.`,
  },
];
