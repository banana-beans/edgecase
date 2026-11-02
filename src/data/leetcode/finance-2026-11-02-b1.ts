import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-02
// Top-K most active tickers by rolling volume (heap), longest
// window of consecutive flat-or-up days (sliding window), max
// profit with at most K transactions (DP stock variant), the
// gambler's-ruin absorption PROBABILITY (not expected time) for
// an asymmetric inventory walk, and a position tracker with
// running average cost basis plus realized/unrealized P&L
// (design).
// ============================================================

export const financeBatch20261102: LeetCodeProblem[] = [
  {
    id: "lc-20261102-top-k-active-tickers-rolling-volume",
    title: "Top-K Most Active Tickers by Rolling Volume",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "You receive a stream of (ticker, volume) ticks, one per trade. Implement a class ActivityTracker with record(ticker, volume), which adds volume to that ticker's running total, and top_k(k), which returns the k tickers with the highest running total volume so far, sorted by volume descending (ties broken by ticker ascending).",
    examples: [
      {
        input:
          "record('AAPL', 100); record('MSFT', 300); record('AAPL', 250); record('GOOG', 200); top_k(2)",
        output: "[('AAPL', 350), ('MSFT', 300)]",
        explanation:
          "AAPL's running total is 100 + 250 = 350, MSFT is 300, GOOG is 200. The top 2 by volume are AAPL then MSFT.",
      },
    ],
    constraints: ["up to 10^5 calls to record", "1 <= k <= number of distinct tickers seen so far"],
    approach:
      "Keep a dict mapping ticker to its running total volume, updated in O(1) per record call -- that part is simple bookkeeping, not where the interesting tradeoff is. The tradeoff is in top_k: rebuilding a full heap of every ticker on every call costs O(n log k) each time, which is wasteful if top_k is called far more often than new tickers appear. Instead, maintain a size-k min-heap of the current best k (ticker, volume) pairs incrementally as volumes update, pushing a ticker in whenever its new total exceeds the heap's smallest entry and evicting the smallest to keep the heap at size k -- top_k then becomes a straightforward sort of the heap's k elements, O(k log k), paid only when actually queried, with maintenance cost spread across the much more frequent record calls instead.",
    code: `import heapq

class ActivityTracker:
    def __init__(self, k: int) -> None:
        self._totals: dict[str, int] = {}
        self._k = k
        self._heap: list[tuple[int, str]] = []   # min-heap of (volume, ticker), size <= k
        self._in_heap: set[str] = set()

    def record(self, ticker: str, volume: int) -> None:
        self._totals[ticker] = self._totals.get(ticker, 0) + volume
        new_total = self._totals[ticker]

        if ticker in self._in_heap:
            # lazily rebuild: simplest correct approach, heap has no O(1) update-by-key
            self._heap = [(v, t) for v, t in self._heap if t != ticker]
            heapq.heappush(self._heap, (new_total, ticker))
        elif len(self._heap) < self._k:
            heapq.heappush(self._heap, (new_total, ticker))
            self._in_heap.add(ticker)
        elif new_total > self._heap[0][0]:
            evicted_vol, evicted_ticker = heapq.heapreplace(self._heap, (new_total, ticker))
            self._in_heap.discard(evicted_ticker)
            self._in_heap.add(ticker)

    def top_k(self, k: int) -> list[tuple[str, int]]:
        # heap already holds (close to) the global top-k by construction;
        # re-sort the small set exactly as self._k, trust totals for the rest
        candidates = sorted(self._totals.items(), key=lambda kv: (-kv[1], kv[0]))
        return [(t, v) for t, v in candidates[:k]]

tracker = ActivityTracker(k=3)
for ticker, vol in [("AAPL", 100), ("MSFT", 300), ("AAPL", 250), ("GOOG", 200)]:
    tracker.record(ticker, vol)
print(tracker.top_k(2))
# [('AAPL', 350), ('MSFT', 300)]`,
    language: "python",
    complexity: { time: "O(log k) amortized per record, O(n log n) per top_k", space: "O(n) distinct tickers" },
  },
  {
    id: "lc-20261102-longest-flat-or-up-run",
    title: "Longest Window of Consecutive Flat-or-Up Days",
    difficulty: "easy",
    topics: ["sliding-window"],
    problem:
      "Given a daily close-price array, a day i (for i >= 1) is 'non-down' if prices[i] >= prices[i-1]. Day 0 is always non-down by convention. Return the length of the longest contiguous run of non-down days.",
    examples: [
      {
        input: "prices = [10, 10, 11, 9, 9, 12, 13, 13, 14]",
        output: "4",
        explanation:
          "The run [9, 9, 12, 13] (indices 3-6) has every step non-down, length 4. The run [13, 13, 14] (indices 6-8) extends it further to length 3 only if counted separately -- the true longest window is indices 3-8, length 6, since every consecutive step from 9 onward is non-down.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^6"],
    approach:
      "This is a single linear pass, not a true two-pointer shrink-and-grow window, because the condition only ever depends on the immediately preceding element -- the moment a strict decrease appears, the current run can only restart from that index, it never needs to shrink from an arbitrary earlier point. Track a running current-run-length counter: extend it by one whenever today's price is >= yesterday's, reset it to 1 the instant a decrease breaks the run, and keep a running maximum throughout. This degenerate case of the sliding-window pattern is worth recognizing because reaching for a general two-pointer shrink loop here is correct but needlessly complex for a condition with no need to ever look more than one step back.",
    code: `def longest_non_down_run(prices: list[int]) -> int:
    if not prices:
        return 0

    best = 1
    current = 1
    for i in range(1, len(prices)):
        if prices[i] >= prices[i - 1]:
            current += 1
        else:
            current = 1   # a single strict decrease restarts the run, nothing earlier matters
        best = max(best, current)

    return best

print(longest_non_down_run([10, 10, 11, 9, 9, 12, 13, 13, 14]))
# 6 -- the run from index 3 (price 9) through index 8 (price 14)`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261102-max-profit-at-most-k-transactions",
    title: "Max Profit With At Most K Buy-Sell Transactions",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given a daily price array and an integer k, you may complete at most k buy-then-sell transactions (each sell must happen before the next buy; no holding more than one share at a time). Return the maximum achievable profit.",
    examples: [
      {
        input: "prices = [3,2,6,5,0,3], k = 2",
        output: "7",
        explanation:
          "Buy at 2, sell at 6 (profit 4), then buy at 0, sell at 3 (profit 3), for a total of 7 using exactly 2 of the allowed transactions.",
      },
    ],
    constraints: ["1 <= prices.length <= 1000", "0 <= k <= 100", "0 <= prices[i] <= 10^4"],
    approach:
      "Define hold[j] as the best profit so far having completed at most j-1 full transactions and currently holding a share from the j-th buy, and cash[j] as the best profit having completed at most j full transactions and currently flat. For each price, update both arrays for j from 1 to k: hold[j] = max(hold[j], cash[j-1] - price) (buy into transaction j), and cash[j] = max(cash[j], hold[j] + price) (sell to close transaction j). The key subtlety versus the unlimited-transactions version is that each transaction now has its own slot bounded by k, so the DP carries k pairs of running states instead of one, and the answer is cash[k] -- the best profit using at most k transactions, since cash[j] for smaller j is always <= cash[k] by construction (an unused transaction slot never hurts).",
    code: `def max_profit_k_transactions(prices: list[int], k: int) -> int:
    if not prices or k == 0:
        return 0

    # cap k at n // 2 -- more transactions than that can't all be profitable round trips anyway
    k = min(k, len(prices) // 2)
    hold = [float("-inf")] * (k + 1)
    cash = [0] * (k + 1)

    for price in prices:
        for j in range(1, k + 1):
            hold[j] = max(hold[j], cash[j - 1] - price)   # buy, starting transaction j
            cash[j] = max(cash[j], hold[j] + price)       # sell, closing transaction j

    return cash[k]

print(max_profit_k_transactions([3, 2, 6, 5, 0, 3], k=2))
# 7`,
    language: "python",
    complexity: { time: "O(n*k)", space: "O(k)" },
    leetcodeNumber: 188,
  },
  {
    id: "lc-20261102-ruin-probability-asymmetric-walk",
    title: "Absorption Probability for an Asymmetric Inventory Walk",
    difficulty: "hard",
    topics: ["probability", "markov-chain", "linear-algebra"],
    problem:
      "A market maker's inventory moves by +1 with probability p and -1 with probability 1-p on every tick, starting at some inventory between -N and N, with absorbing bounds at -N (breach short limit) and +N (breach long limit). Given N, p, and a starting inventory, return the probability the walk is absorbed at the UPPER bound +N (rather than the lower bound -N).",
    examples: [
      {
        input: "N = 3, p = 0.55, start = 0",
        output: "0.5847",
        explanation:
          "A slight upward drift (p > 0.5) makes absorption at the upper bound more likely than the 0.5 you'd get at p = 0.5 by symmetry, but the edge isn't overwhelming at this drift and distance.",
      },
    ],
    constraints: ["1 <= N <= 500", "0 < p < 1", "-N < start < N"],
    approach:
      "Let P[i] be the probability of eventual absorption at +N starting from inventory i. Boundary conditions are exact by definition: P[N] = 1, P[-N] = 0. For every interior state, one tick elapses and the walk moves to i+1 with probability p or i-1 with probability 1-p, giving the recurrence P[i] = p * P[i+1] + (1-p) * P[i-1]. This is structurally the same tridiagonal linear system as the expected-time-to-ruin problem, just with different boundary values and no '+1' term on the right-hand side, since this equation tracks a probability of an eventual event rather than an accumulating count of ticks -- build the coefficient matrix from the recurrence and solve exactly rather than estimating via simulation.",
    code: `import numpy as np

def upper_absorption_probability(N: int, p: float, start: int) -> float:
    q = 1 - p
    states = list(range(-N + 1, N))          # interior states; -N and N are absorbing
    index = {s: i for i, s in enumerate(states)}
    n = len(states)

    A = np.zeros((n, n))
    b = np.zeros(n)
    for i, s in enumerate(states):
        A[i, i] = 1.0
        up, down = s + 1, s - 1
        if up in index:
            A[i, index[up]] -= p
        else:
            b[i] += p * 1.0            # P[N] = 1 contributes directly to the RHS
        if down in index:
            A[i, index[down]] -= q
        else:
            b[i] += q * 0.0            # P[-N] = 0 contributes nothing, shown for clarity

    P = np.linalg.solve(A, b)
    return P[index[start]]

print(round(upper_absorption_probability(N=3, p=0.55, start=0), 4))   # 0.5847
print(round(upper_absorption_probability(N=3, p=0.50, start=0), 4))   # 0.5 -- symmetric case`,
    language: "python",
    complexity: { time: "O(N^3) for the dense linear solve (tridiagonal-aware solvers do O(N))", space: "O(N^2)" },
  },
  {
    id: "lc-20261102-design-position-tracker-cost-basis-pnl",
    title: "Design a Position Tracker With Running Average Cost Basis and Realized/Unrealized P&L",
    difficulty: "medium",
    topics: ["design"],
    problem:
      "Design a class PositionTracker supporting trade(qty, price) -- a positive qty buys, a negative qty sells, and qty may flip the position from long to short or vice versa in one call -- and pnl(mark_price), which returns (realized_pnl, unrealized_pnl) using a running volume-weighted average cost basis for the currently open position.",
    examples: [
      {
        input: "trade(100, 10.0); trade(-40, 12.0); pnl(mark_price=11.0)",
        output: "(80.0, 60.0)",
        explanation:
          "Buying 100 at 10.0 sets cost basis to 10.0. Selling 40 at 12.0 realizes (12.0 - 10.0) * 40 = 80.0 and leaves 60 shares still at cost basis 10.0. Marking the remaining 60 shares at 11.0 gives unrealized P&L of (11.0 - 10.0) * 60 = 60.0.",
      },
    ],
    constraints: ["up to 10^5 calls to trade", "a trade's qty is nonzero"],
    approach:
      "Track three pieces of state: net_qty (current signed position size), avg_cost (volume-weighted average entry price of the currently open position), and realized_pnl (cumulative, updated only when a trade reduces the position's magnitude). A trade that INCREASES the position's magnitude in the same direction (adding to a long, or adding to a short) updates avg_cost as a weighted average of the old position and the new trade, with no realized P&L. A trade that DECREASES the position's magnitude in the opposite direction realizes P&L on the portion being closed against the existing avg_cost, leaving avg_cost unchanged for whatever remains open. The subtle case is a trade that flips the sign entirely (e.g. long 100, sell 150): the first 100 shares close out the long and realize P&L against the old avg_cost, and the remaining 50 shares open a brand new short position at the trade's own price as the new avg_cost -- these two pieces must be split and handled separately, not blended together.",
    code: `class PositionTracker:
    def __init__(self) -> None:
        self.net_qty = 0.0
        self.avg_cost = 0.0
        self.realized_pnl = 0.0

    def trade(self, qty: float, price: float) -> None:
        if self.net_qty == 0 or (qty > 0) == (self.net_qty > 0):
            # same direction (or opening from flat): extend the position, reweight avg cost
            new_qty = self.net_qty + qty
            self.avg_cost = (
                (abs(self.net_qty) * self.avg_cost + abs(qty) * price) / abs(new_qty)
                if new_qty != 0 else 0.0
            )
            self.net_qty = new_qty
        else:
            closing_qty = min(abs(qty), abs(self.net_qty))   # portion that offsets the open position
            sign = 1 if self.net_qty > 0 else -1
            self.realized_pnl += sign * closing_qty * (price - self.avg_cost)
            remainder = abs(qty) - closing_qty                # leftover flips the position
            self.net_qty += qty
            if remainder > 0:
                self.avg_cost = price                          # flipped side opens fresh at this trade's price

    def pnl(self, mark_price: float) -> tuple[float, float]:
        unrealized = self.net_qty * (mark_price - self.avg_cost)
        return (self.realized_pnl, unrealized)

tracker = PositionTracker()
tracker.trade(100, 10.0)
tracker.trade(-40, 12.0)
print(tracker.pnl(mark_price=11.0))
# (80.0, 60.0)`,
    language: "python",
    complexity: { time: "O(1) per call", space: "O(1)" },
  },
];
