import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-26
// Top-k active tickers by rolling volume (heap), longest trade
// window within a risk limit (sliding window), max profit with
// unlimited trades and a cooldown (DP), probability a market
// maker's inventory hits a risk limit before flattening (gambler's
// ruin / Markov), and a position tracker with average-cost
// accounting and realized/unrealized PnL (design).
// ============================================================

export const financeBatch20261026: LeetCodeProblem[] = [
  {
    id: "lc-20261026-top-k-active-tickers-rolling-volume",
    title: "Top K Most Active Tickers by Cumulative Volume",
    difficulty: "medium",
    topics: ["heap", "hash-map"],
    problem:
      "Given a stream of (ticker, volume) ticks arriving in time order and an integer k, return, after each tick, the current top k tickers ranked by TOTAL volume traded so far.",
    examples: [
      {
        input: "ticks = [('AAPL',100),('MSFT',50),('AAPL',80),('GOOG',200)], k = 2",
        output: "['GOOG', 'AAPL']",
        explanation:
          "Cumulative volumes end at AAPL=180, MSFT=50, GOOG=200, so after the last tick the top 2 by total volume are GOOG then AAPL.",
      },
    ],
    constraints: ["1 <= ticks.length <= 10^5", "1 <= k <= 50"],
    approach:
      "Maintain a running total-volume dict keyed by ticker, updated in O(1) per tick. For the top-k snapshot after each tick, use heapq.nlargest, which internally keeps only a size-k heap instead of sorting every unique ticker seen so far -- cheaper than a full sort when k is small relative to the number of distinct tickers. This trades a small amount of per-tick work for never needing to maintain a hand-rolled heap-with-lazy-deletion structure, which is easy to get subtly wrong when volumes keep changing for tickers already in the heap.",
    code: `import heapq
from collections import defaultdict
from operator import itemgetter

def top_k_active_tickers(ticks: list[tuple[str, int]], k: int) -> list[list[str]]:
    totals: dict[str, int] = defaultdict(int)
    snapshots: list[list[str]] = []

    for ticker, vol in ticks:
        totals[ticker] += vol
        # heapq.nlargest keeps a size-k heap internally -- cheaper than sorting
        # every unique ticker seen so far when k is small
        top_k = heapq.nlargest(k, totals.items(), key=itemgetter(1))
        snapshots.append([t for t, _ in top_k])

    return snapshots

ticks = [("AAPL", 100), ("MSFT", 50), ("AAPL", 80), ("GOOG", 200)]
print(top_k_active_tickers(ticks, k=2)[-1])
# ['GOOG', 'AAPL']`,
    language: "python",
    complexity: {
      time: "O(n * u) where u is the number of distinct tickers seen so far",
      space: "O(u)",
    },
    leetcodeNumber: 347,
  },
  {
    id: "lc-20261026-longest-window-notional-within-risk-limit",
    title: "Longest Window of Consecutive Trades Whose Total Notional Stays Within a Risk Limit",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given an array of trade notional values (all positive) in execution order and a risk limit, return the length of the longest contiguous run of trades whose total notional never exceeds the limit.",
    examples: [
      {
        input: "notionals = [20,30,10,40,15], limit = 60",
        output: "3",
        explanation:
          "The window [20,30,10] sums to exactly 60 -- the longest run of consecutive trades that stays within the limit.",
      },
    ],
    constraints: ["1 <= notionals.length <= 10^5", "1 <= limit <= 10^9"],
    approach:
      "Classic two-pointer sliding window. Because every notional is positive, the running window sum is monotonically increasing as the right pointer advances and monotonically decreasing as the left pointer advances -- that monotonicity is exactly what makes two-pointer valid here instead of needing a prefix-sum/binary-search approach. Expand right, and whenever the running sum exceeds the limit, shrink from the left until it's back in bounds, tracking the best window length seen.",
    code: `def longest_window_within_risk_limit(notionals: list[int], limit: int) -> int:
    left = 0
    window_sum = 0
    best = 0

    for right, notional in enumerate(notionals):
        window_sum += notional
        # all notionals are positive, so shrinking from the left strictly decreases
        # the sum -- the precondition that makes two-pointer valid here
        while window_sum > limit:
            window_sum -= notionals[left]
            left += 1
        best = max(best, right - left + 1)

    return best

print(longest_window_within_risk_limit([20, 30, 10, 40, 15], limit=60))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261026-max-profit-cooldown",
    title: "Max Profit With Unlimited Trades and a One-Day Cooldown After Selling",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given a daily price array, you may buy and sell an unlimited number of times, but after selling you must wait one full day (a cooldown) before buying again. Return the maximum achievable profit.",
    examples: [
      {
        input: "prices = [1,2,3,0,2]",
        output: "3",
        explanation:
          "Buy at 1, sell at 2 (profit 1), cooldown, buy at 0, sell at 2 (profit 2). Total profit 3 -- buying at 3 then immediately re-buying at 0 isn't allowed because of the cooldown day.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000"],
    approach:
      "Track three running states across a single left-to-right pass: hold (currently holding a position), sold (just sold today, so tomorrow must be a cooldown day), and rest (not holding and free to buy). Each day's new state depends only on yesterday's three values, so the whole thing runs in one O(n) pass with O(1) extra memory -- no need to materialize a full DP table.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    hold = -prices[0]     # currently holding a position
    sold = 0               # just sold today -- must cool down tomorrow
    rest = 0               # not holding, free to buy tomorrow

    for p in prices[1:]:
        prev_hold, prev_sold, prev_rest = hold, sold, rest
        hold = max(prev_hold, prev_rest - p)   # keep holding, or buy today from a rested state
        sold = prev_hold + p                    # sell today's position
        rest = max(prev_rest, prev_sold)        # cooldown day rolls into a rested state

    return max(sold, rest)

print(max_profit_with_cooldown([1, 2, 3, 0, 2]))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 309,
  },
  {
    id: "lc-20261026-gamblers-ruin-inventory-limit",
    title: "Probability a Market Maker's Inventory Hits a Risk Limit Before Flattening",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "A market maker's inventory moves up by one unit with probability p on each fill and down by one unit with probability 1-p, independently each time. Starting at inventory i units away from flat, compute the probability inventory reaches an upper risk limit of N units before it returns to flat (0).",
    examples: [
      {
        input: "p = 0.5, i = 2, N = 5",
        output: "0.4",
        explanation:
          "For a fair random walk, the classic gambler's ruin result collapses to a simple ratio: probability equals i / N by symmetry, here 2/5 = 0.4.",
      },
    ],
    constraints: ["0 < p < 1", "0 < i < N", "N <= 1000"],
    approach:
      "This is the classic gambler's ruin problem with absorbing barriers at 0 and N, starting at i. For a biased walk (p != 0.5), the closed-form probability of hitting N before 0 is (1 - r^i) / (1 - r^N) where r = (1-p)/p; for the fair case (p = 0.5) that formula is degenerate and the limit simplifies to the clean i/N. A Monte Carlo simulation is worth running alongside the formula, since the asymmetry of this result (how fast it decays as r moves away from 1) is easy to misjudge by intuition alone.",
    code: `def prob_hit_limit_before_flat(p: float, i: int, N: int) -> float:
    if p == 0.5:
        return i / N   # fair coin: classic symmetric gambler's ruin result
    q = 1 - p
    ratio = q / p
    # closed-form gambler's ruin probability of reaching N before 0, starting at i
    return (1 - ratio ** i) / (1 - ratio ** N)

print(round(prob_hit_limit_before_flat(p=0.5, i=2, N=5), 4))
# 0.4 -- matches the i/N symmetry check

print(round(prob_hit_limit_before_flat(p=0.47, i=2, N=5), 4))
# slightly below 0.4 -- a mild sell-side bias in fills makes hitting the upper
# risk limit before flattening somewhat less likely

import random

def simulate(p: float, i: int, N: int, trials: int = 20000) -> float:
    hits = 0
    for _ in range(trials):
        inv = i
        while 0 < inv < N:
            inv += 1 if random.random() < p else -1
        hits += inv == N
    return hits / trials

print(round(simulate(0.5, 2, 5), 3))   # converges toward 0.4`,
    language: "python",
    complexity: {
      time: "O(1) for the closed form; O(expected steps) per trial for the simulation",
      space: "O(1)",
    },
  },
  {
    id: "lc-20261026-design-position-tracker",
    title: "Design a Position Tracker With Average Cost Basis and Realized/Unrealized PnL",
    difficulty: "medium",
    topics: ["design", "hash-map"],
    problem:
      "Design a class PositionTracker supporting trade(ticker, side, qty, price), which updates a running position using average-cost accounting, and unrealized_pnl(ticker, mark_price) / realized_pnl(ticker) queries. A trade against the current position realizes PnL on the overlapping quantity at the existing average cost; if the trade exceeds the current position, the excess opens a new position on the flipped side at the trade's own price.",
    examples: [
      {
        input:
          "trade('AAPL','buy',100,150.0); trade('AAPL','buy',100,160.0); trade('AAPL','sell',150,170.0)",
        output: "realized_pnl('AAPL') = 2250.0, unrealized_pnl('AAPL', 170.0) = 750.0",
        explanation:
          "The two buys average to a cost basis of 155.0 over 200 shares. Selling 150 of them realizes 150 * (170 - 155) = 2250 and leaves 50 shares still long at the same 155.0 cost basis, worth 50 * (170 - 155) = 750 unrealized.",
      },
    ],
    constraints: ["up to 10^5 calls to trade", "qty and price are positive"],
    approach:
      "Track, per ticker, a signed quantity (positive = long, negative = short) and an average cost. A trade on the SAME side as the current position (or opening a flat position) weighted-averages the cost basis. A trade AGAINST the current position realizes PnL on the overlapping quantity at the EXISTING average cost, never at the new trade's own price -- that distinction is the part most often gotten wrong. If the opposing trade's size exceeds the current position, the excess flips the position to the other side and opens a brand-new cost basis at the current trade's price.",
    code: `class PositionTracker:
    def __init__(self) -> None:
        self._qty: dict[str, int] = {}        # signed: positive = long, negative = short
        self._avg_cost: dict[str, float] = {}
        self._realized: dict[str, float] = {}

    def trade(self, ticker: str, side: str, qty: int, price: float) -> None:
        signed_qty = qty if side == "buy" else -qty
        pos = self._qty.get(ticker, 0)
        cost = self._avg_cost.get(ticker, 0.0)
        self._realized.setdefault(ticker, 0.0)

        same_direction = pos == 0 or (pos > 0) == (signed_qty > 0)

        if same_direction:
            # adding to (or opening) a position on the same side: weighted-average the cost basis
            new_qty = pos + signed_qty
            self._avg_cost[ticker] = (abs(pos) * cost + qty * price) / abs(new_qty)
            self._qty[ticker] = new_qty
            return

        # trading against the current position: the overlapping quantity realizes
        # PnL at the EXISTING average cost, never at the new trade's price
        closing_qty = min(abs(pos), qty)
        direction = 1 if pos > 0 else -1
        self._realized[ticker] += direction * closing_qty * (price - cost)

        excess = qty - closing_qty
        self._qty[ticker] = pos + signed_qty
        if excess > 0:
            # the trade was bigger than the existing position -- it flips sides,
            # and the excess opens a brand-new position at THIS trade's price
            self._avg_cost[ticker] = price

    def unrealized_pnl(self, ticker: str, mark_price: float) -> float:
        pos = self._qty.get(ticker, 0)
        cost = self._avg_cost.get(ticker, 0.0)
        return pos * (mark_price - cost)

    def realized_pnl(self, ticker: str) -> float:
        return self._realized.get(ticker, 0.0)

tracker = PositionTracker()
tracker.trade("AAPL", "buy", 100, 150.0)
tracker.trade("AAPL", "buy", 100, 160.0)
tracker.trade("AAPL", "sell", 150, 170.0)
print(tracker.realized_pnl("AAPL"))             # 2250.0
print(tracker.unrealized_pnl("AAPL", 170.0))    # 750.0`,
    language: "python",
    complexity: { time: "O(1) per call", space: "O(number of distinct tickers)" },
  },
];
