import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-27
// A top-k-by-volume heap problem, a longest-window-with-at-most-k
// illiquid-minutes sliding window, the at-most-two-transactions
// stock DP variant, a gambler's-ruin absorption-probability
// problem, and a FIFO average-cost-basis position tracker design
// problem.
// ============================================================

export const financeBatch20260927: LeetCodeProblem[] = [
  {
    id: "lc-20260927-top-k-traded-symbols",
    title: "Top-K Symbols by Cumulative Traded Volume",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Design a class VolumeTracker supporting add_trade(symbol, volume), which accumulates traded volume per symbol over time, and top_k(k), which returns the k symbols with the highest cumulative volume so far, without re-sorting the entire universe of symbols on every query.",
    examples: [
      {
        input:
          "add_trade('AAPL', 100); add_trade('MSFT', 250); add_trade('AAPL', 50); add_trade('TSLA', 400); top_k(2)",
        output: "['TSLA', 'MSFT']",
        explanation:
          "Cumulative volumes are AAPL=150, MSFT=250, TSLA=400. The two highest are TSLA (400) and MSFT (250).",
      },
    ],
    constraints: ["1 <= number of add_trade calls <= 10^5", "1 <= k <= number of distinct symbols seen so far", "volume >= 0"],
    approach:
      "Keep a running dictionary of cumulative volume per symbol, updated in O(1) per add_trade. For top_k(k), avoid sorting every symbol seen so far (O(m log m) for m distinct symbols) by using heapq.nlargest, which internally maintains a heap of size k and processes the m items in O(m log k) -- meaningfully cheaper than a full sort whenever k is small relative to the number of symbols in the universe, which is the common case when scanning for a handful of the day's most active names out of thousands.",
    code: `import heapq

class VolumeTracker:
    def __init__(self):
        self.totals: dict[str, int] = {}

    def add_trade(self, symbol: str, volume: int) -> None:
        self.totals[symbol] = self.totals.get(symbol, 0) + volume

    def top_k(self, k: int) -> list[str]:
        # heapq.nlargest keeps a heap of size k internally --
        # O(m log k) instead of sorting all m symbols.
        top = heapq.nlargest(k, self.totals.items(), key=lambda item: item[1])
        return [symbol for symbol, _ in top]

tracker = VolumeTracker()
tracker.add_trade('AAPL', 100)
tracker.add_trade('MSFT', 250)
tracker.add_trade('AAPL', 50)
tracker.add_trade('TSLA', 400)
print(tracker.top_k(2))
# ['TSLA', 'MSFT']`,
    language: "python",
    complexity: { time: "O(1) per add_trade, O(m log k) per top_k(k) for m distinct symbols", space: "O(m)" },
  },
  {
    id: "lc-20260927-longest-window-k-illiquid-minutes",
    title: "Longest Trading Window With At Most K Illiquid Minutes",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given an array of per-minute traded volumes (a minute with zero volume is 'illiquid') and an integer k, return the length of the longest contiguous window containing at most k illiquid minutes.",
    examples: [
      {
        input: "volume=[5, 0, 3, 0, 0, 8, 2], k=1",
        output: "3",
        explanation:
          "Windows [5, 0, 3] and [0, 8, 2] each contain exactly one illiquid minute and have length 3. Every length-4 window (e.g. [5,0,3,0] or [0,0,8,2]) contains at least two illiquid minutes, so 3 is the longest valid window.",
      },
    ],
    constraints: ["1 <= volume.length <= 10^5", "volume[i] >= 0", "0 <= k <= volume.length"],
    approach:
      "Classic variable-size two-pointer, the same pattern as 'longest subarray with at most k zeros': expand the right edge by one minute every step, and track how many illiquid (zero-volume) minutes are currently inside the window. Whenever that count exceeds k, shrink the window from the left -- advancing the left pointer one minute at a time and decrementing the illiquid count whenever the minute leaving the window was itself illiquid -- until the window is valid again. Because both pointers only ever move forward and each minute enters and leaves the window at most once, the whole scan is O(n) despite window size varying at every step.",
    code: `def longest_window_k_illiquid(volume: list[int], k: int) -> int:
    left = 0
    illiquid_count = 0
    best = 0

    for right, v in enumerate(volume):
        if v == 0:
            illiquid_count += 1

        # shrink from the left while the window has too many
        # illiquid minutes -- each minute enters/leaves at most once
        while illiquid_count > k:
            if volume[left] == 0:
                illiquid_count -= 1
            left += 1

        best = max(best, right - left + 1)

    return best

print(longest_window_k_illiquid([5, 0, 3, 0, 0, 8, 2], k=1))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260927-buy-sell-two-transactions-with-fee",
    title: "Best Time to Buy and Sell Stock With At Most Two Transactions and a Flat Fee",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices and a flat fee charged once per completed round trip, you may complete at most two non-overlapping buy-then-sell transactions (sell before buying again, hold at most one share at a time). Return the maximum achievable profit after fees.",
    examples: [
      {
        input: "prices=[3, 3, 5, 0, 0, 3, 1, 4], fee=1",
        output: "4",
        explanation:
          "Buy at 0 (index 3), sell at 3 (index 5): profit 3 minus fee 1 = 2. Buy at 1 (index 6), sell at 4 (index 7): profit 3 minus fee 1 = 2. Total 2+2=4 -- one fee shy of the no-fee version's profit of 6, since each of the two round trips pays the fee once.",
      },
    ],
    constraints: ["0 <= prices.length <= 10^5", "0 <= prices[i] <= 10^5", "0 <= fee <= 10^5"],
    approach:
      "Extend the two-transaction running-scalar DP with a fee charged exactly once per completed round trip, deducted at the sell transition just like the single-transaction fee variant: buy1 (best profit after one purchase), sell1 (best profit after one completed round trip, net of its fee), buy2 (best profit after a second purchase, funded out of sell1's already-fee-adjusted proceeds), and sell2 (best profit after a second completed round trip, net of its own fee). Updating in the order buy1, sell1, buy2, sell2 each day means buy2 only ever builds on a sell1 that has already paid its fee, so the two fees never double-count and never get skipped.",
    code: `def max_profit_two_tx_with_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    buy1 = -prices[0]     # best profit after 1st purchase (a cost, so negative)
    sell1 = 0              # best profit after 1st completed round trip, net of its fee
    buy2 = -prices[0]     # best profit after 2nd purchase, funded by sell1
    sell2 = 0              # best profit after 2nd completed round trip, net of its fee

    for price in prices[1:]:
        buy1 = max(buy1, -price)
        sell1 = max(sell1, buy1 + price - fee)   # fee charged once, at this sell
        buy2 = max(buy2, sell1 - price)
        sell2 = max(sell2, buy2 + price - fee)   # fee charged again for the 2nd round trip

    return sell2

print(max_profit_two_tx_with_fee([3, 3, 5, 0, 0, 3, 1, 4], fee=1))
# 4`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260927-gamblers-ruin-probability",
    title: "Probability of Hitting a Profit Target Before a Loss Limit",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "A trader's PnL moves in discrete $1 steps: up with probability p, down with probability 1-p, independently each step. Starting from a current PnL of i (with 0 < i < N), the trader stops the first time PnL hits either the loss limit 0 or the profit target N. Return the probability of hitting the profit target N before the loss limit 0.",
    examples: [
      {
        input: "p=0.5, i=3, N=10",
        output: "0.3",
        explanation:
          "For a fair (p=0.5) random walk, the ruin-probability closed form degenerates to the simple linear case: probability of reaching N first is i/N = 3/10 = 0.3.",
      },
    ],
    constraints: ["0 < p < 1", "0 < i < N", "N is a positive integer"],
    approach:
      "This is the classical gambler's-ruin absorbing Markov chain: let f(i) be the probability of reaching N before 0, starting from state i. Conditioning on the first step gives the recurrence f(i) = p*f(i+1) + (1-p)*f(i-1), with boundary conditions f(0)=0 and f(N)=1. Solving that linear recurrence yields a closed form: when p is not exactly 0.5, f(i) = (1 - r^i) / (1 - r^N) where r = (1-p)/p; when p equals exactly 0.5, the recurrence degenerates and the solution is simply the linear f(i) = i/N. Evaluating the closed form is O(1) (or O(log N) if computing r^i and r^N via fast exponentiation for very large N), versus O(N) to solve the full linear system directly.",
    code: `def ruin_probability(p: float, i: int, n: int) -> float:
    # closed-form solution to f(i) = p*f(i+1) + (1-p)*f(i-1),
    # f(0) = 0, f(n) = 1 -- the gambler's ruin recurrence.
    if abs(p - 0.5) < 1e-12:
        return i / n   # fair-walk case: the recurrence is linear in i

    r = (1.0 - p) / p
    return (1.0 - r ** i) / (1.0 - r ** n)

print(ruin_probability(p=0.5, i=3, n=10))
# 0.3

print(round(ruin_probability(p=0.55, i=3, n=10), 4))
# a favorable edge (p > 0.5) raises the probability of hitting
# the target first, well above the fair-walk baseline of i/n`,
    language: "python",
    complexity: { time: "O(1) (or O(log n) with fast exponentiation for very large n)", space: "O(1)" },
  },
  {
    id: "lc-20260927-fifo-cost-basis-tracker",
    title: "Design a FIFO Average-Cost-Basis Position Tracker",
    difficulty: "medium",
    topics: ["design", "queue"],
    problem:
      "Design a class PositionTracker, scoped to a single long-only instrument, supporting buy(qty, price), which adds a new purchase lot, and sell(qty, price), which reduces the position by matching against the OLDEST open lots first (FIFO) and returns the realized profit or loss from that sale. Assume sell quantities never exceed the current open position.",
    examples: [
      {
        input: "buy(qty=10, price=100); buy(qty=10, price=120); sell(qty=15, price=130)",
        output: "350",
        explanation:
          "FIFO matches the sale against the oldest lot first: 10 shares from the price=100 lot (profit 10*(130-100)=300) fully consumes it, then the remaining 5 shares match the price=120 lot (profit 5*(130-120)=50). Total realized profit is 300+50=350, leaving 5 shares open at a cost basis of 120.",
      },
    ],
    constraints: ["qty and price are positive", "a sell's qty never exceeds the currently open position (no shorting)"],
    approach:
      "Keep a FIFO queue (deque) of open lots, each a (qty, price) pair, appended on every buy. On a sell, walk the queue from the front: for each lot, match min(lot_qty, remaining_sell_qty) shares against it, accumulate that portion's realized P&L as matched_qty times (sell_price minus lot_price), reduce the lot's remaining quantity (or pop it entirely if fully consumed), and continue until the whole sell quantity has been matched. Because each lot is only ever popped once and each unit of quantity is matched exactly once, a sequence of n buys and sells runs in O(n) amortized total, even though a single large sell can walk through many lots at once.",
    code: `from collections import deque

class PositionTracker:
    def __init__(self):
        # FIFO queue of open lots: each entry is [qty, price]
        self.lots: deque[list[float]] = deque()

    def buy(self, qty: int, price: float) -> None:
        self.lots.append([qty, price])

    def sell(self, qty: int, price: float) -> float:
        remaining = qty
        realized_pnl = 0.0

        while remaining > 0:
            lot = self.lots[0]                 # oldest lot first (FIFO)
            matched = min(lot[0], remaining)
            realized_pnl += matched * (price - lot[1])
            lot[0] -= matched
            remaining -= matched

            if lot[0] == 0:
                self.lots.popleft()             # lot fully consumed

        return realized_pnl

    def open_position(self) -> int:
        return sum(lot[0] for lot in self.lots)

    def average_cost(self) -> float:
        total_qty = self.open_position()
        if total_qty == 0:
            return 0.0
        total_cost = sum(lot[0] * lot[1] for lot in self.lots)
        return total_cost / total_qty

tracker = PositionTracker()
tracker.buy(qty=10, price=100)
tracker.buy(qty=10, price=120)
print(tracker.sell(qty=15, price=130))
# 350.0 -- 10 shares at cost 100 (profit 300) + 5 shares at cost 120 (profit 50)
print(tracker.open_position(), tracker.average_cost())
# 5 120.0 -- only 5 shares left from the second lot, at its own cost basis`,
    language: "python",
    complexity: { time: "O(n) amortized total across n buy/sell calls", space: "O(number of open lots)" },
  },
];
