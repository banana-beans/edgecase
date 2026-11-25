import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-25
// Top-K active tickers (heap), longest calm-volatility window
// (sliding window / monotonic deque), max profit with two round
// trips (DP), expected trades to absorption for a market maker's
// capital (probability / Markov), and a position tracker with
// weighted-average cost and realized P&L (design).
// ============================================================

export const financeBatch20261125: LeetCodeProblem[] = [
  {
    id: "lc-20261125-top-k-active-tickers-rolling-volume",
    title: "Top K Most Active Tickers by Trade Count So Far",
    difficulty: "medium",
    topics: ["heap", "hash-map"],
    problem:
      "You receive a stream of trade events, each just a ticker symbol. At any point you need to report the K tickers with the highest trade count so far, sorted by count descending with ties broken alphabetically. Design record_trade(ticker) and get_top_k(k) so that recording a trade never rescans the full trade history.",
    examples: [
      {
        input: "trades = ['AAPL','MSFT','AAPL','GOOG','MSFT','AAPL'], k = 2",
        output: "['AAPL', 'MSFT']",
        explanation: "Counts after the stream: AAPL=3, MSFT=2, GOOG=1. The top 2 by count, descending, are AAPL then MSFT.",
      },
    ],
    constraints: ["1 <= trades.length <= 10^5", "1 <= k <= number of distinct tickers seen so far"],
    approach:
      "Maintain a running count dict (Counter), updated in O(1) per incoming trade event -- the full history is never rescanned per event. When get_top_k(k) is called, use heapq.nsmallest(k, counts.items(), key=lambda item: (-count, ticker)): sorting ascending by (-count, ticker) is exactly descending by count with alphabetical tie-breaking, and nsmallest costs O(m log k) in m, the number of DISTINCT tickers currently tracked, not the length of the whole trade stream. That's the realistic design point -- you can't avoid some cost per query, but the total event volume, which can be enormous, never touches the per-query path.",
    code: `import heapq
from collections import Counter


class ActiveTickerTracker:
    def __init__(self) -> None:
        self.counts: Counter = Counter()

    def record_trade(self, ticker: str) -> None:
        # O(1) per event -- never rescans trade history
        self.counts[ticker] += 1

    def get_top_k(self, k: int) -> list[str]:
        # O(m log k) in the number of DISTINCT tickers, not total trade volume
        top = heapq.nsmallest(k, self.counts.items(), key=lambda item: (-item[1], item[0]))
        return [ticker for ticker, _ in top]


tracker = ActiveTickerTracker()
for t in ["AAPL", "MSFT", "AAPL", "GOOG", "MSFT", "AAPL"]:
    tracker.record_trade(t)
print(tracker.get_top_k(2))
# ['AAPL', 'MSFT']`,
    language: "python",
    complexity: { time: "O(1) per record_trade, O(m log k) per get_top_k", space: "O(m)" },
  },
  {
    id: "lc-20261125-longest-window-bounded-range",
    title: "Longest Window of Minute-Bar Prices Where the Range Stays Within a Volatility Threshold",
    difficulty: "hard",
    topics: ["sliding-window", "deque", "monotonic-queue"],
    problem:
      "Given a sequence of minute-bar prices for one session, find the length of the longest contiguous window where max(price) - min(price) within that window is at most a given threshold T. This finds the longest stretch of 'calm' trading you could safely apply a tighter risk limit against.",
    examples: [
      {
        input: "prices = [8, 2, 4, 7], threshold = 4",
        output: "2",
        explanation:
          "Window [8,2] has range 6, too wide. [2,4] has range 2, valid, length 2. [4,7] has range 3, valid, length 2. [2,4,7] has range 5, too wide. No valid window reaches length 3, so the answer is 2.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= threshold <= 10^9"],
    approach:
      "Maintain two monotonic deques alongside a sliding window: a decreasing deque whose front holds the window's current max, and an increasing deque whose front holds the window's current min, both in O(1) to read. Expand the right pointer, pushing the new price onto both deques after popping from the back any now-dominated values. While the window's max minus min exceeds the threshold, shrink from the left, discarding indices that fall off the front of either deque once they leave the window. Track the best window length seen. Each index enters and leaves each deque at most once, giving O(n) total instead of recomputing the window's max and min from scratch at every position, which is O(n^2) in the worst case.",
    code: `from collections import deque


def longest_window_within_threshold(prices: list[int], threshold: int) -> int:
    increasing = deque()  # indices, prices increasing -- front is the window's min
    decreasing = deque()  # indices, prices decreasing -- front is the window's max
    left = 0
    best = 0

    for right, price in enumerate(prices):
        while increasing and prices[increasing[-1]] >= price:
            increasing.pop()
        increasing.append(right)
        while decreasing and prices[decreasing[-1]] <= price:
            decreasing.pop()
        decreasing.append(right)

        # shrink from the left while the window's range exceeds the threshold
        while prices[decreasing[0]] - prices[increasing[0]] > threshold:
            left += 1
            if increasing[0] < left:
                increasing.popleft()
            if decreasing[0] < left:
                decreasing.popleft()

        best = max(best, right - left + 1)

    return best


print(longest_window_within_threshold([8, 2, 4, 7], threshold=4))
# 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
    leetcodeNumber: 1438,
  },
  {
    id: "lc-20261125-max-profit-at-most-two-transactions",
    title: "Maximum Profit With At Most Two Round-Trip Trades",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for a stock, you may complete at most two non-overlapping round trips (you must sell before buying again, and you hold at most one unit at a time). Return the maximum total profit achievable.",
    examples: [
      {
        input: "prices = [3, 3, 5, 0, 0, 3, 1, 4]",
        output: "6",
        explanation:
          "Buy on day 4 (price 0), sell on day 6 (price 3) for a profit of 3, then buy on day 7 (price 1), sell on day 8 (price 4) for a profit of 3. Total profit is 3 + 3 = 6, and no pair of non-overlapping round trips does better.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^5"],
    approach:
      "Track four running states in one pass: buy1 (best, i.e. least negative, cost basis for the first entry so far), sell1 (best profit after closing the first round trip), buy2 (best net position after funding a second entry from sell1's proceeds), sell2 (best profit after closing the second round trip). Update them in that order each day using values already updated earlier THE SAME day where the dependency chain allows it (buy1 -> sell1 -> buy2 -> sell2), which keeps the whole thing O(1) extra state per day. The answer is sell2 at the end, since ending while still holding a position is never optimal. This generalizes directly to 'at most K transactions' with 2K running states instead of 4.",
    code: `def max_profit_two_transactions(prices: list[int]) -> int:
    if not prices:
        return 0

    buy1 = buy2 = float("-inf")
    sell1 = sell2 = 0

    for price in prices:
        buy1 = max(buy1, -price)            # cheapest entry seen so far for trade 1
        sell1 = max(sell1, buy1 + price)     # best profit after closing trade 1
        buy2 = max(buy2, sell1 - price)      # fund trade 2's entry with trade 1's proceeds
        sell2 = max(sell2, buy2 + price)     # best profit after closing trade 2

    return sell2


print(max_profit_two_transactions([3, 3, 5, 0, 0, 3, 1, 4]))
# 6`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 123,
  },
  {
    id: "lc-20261125-expected-trades-to-absorption",
    title: "Expected Number of Trades Until a Market Maker's Capital Hits Either Ruin or a Target",
    difficulty: "hard",
    topics: ["probability", "markov-chain", "math"],
    problem:
      "A market maker's capital moves by +1 unit with probability p or -1 unit with probability (1-p) on each trade, starting at capital i, with two absorbing barriers: capital 0 (ruin) and capital N (target reached, they stop trading). Return the expected number of trades until capital is absorbed at either barrier.",
    examples: [
      {
        input: "i = 1, n = 3, p = 0.5",
        output: "2.0",
        explanation:
          "This is the gambler's ruin expected-duration problem. For the symmetric case p = 0.5, the clean closed form is E_i = i * (n - i) = 1 * 2 = 2.0, which you can verify directly by solving the three-state linear system for capitals 1 and 2.",
      },
    ],
    constraints: ["0 <= i <= n", "0 < p < 1, p given as a float", "1 <= n <= 10^6", "return the answer as a float"],
    approach:
      "Expected duration E_i (starting from capital i) satisfies E_i = 1 + p*E_(i+1) + (1-p)*E_(i-1), with boundary conditions E_0 = E_n = 0, since the walk is already absorbed there. This is a linear difference equation with a constant forcing term (the '+1' per step), so the solution is a particular solution plus the same homogeneous geometric solution r^i, r = (1-p)/p, used for the companion ruin-PROBABILITY recursion. For the symmetric case p = 0.5 the forcing term's particular solution becomes the clean quadratic E_i = i*(n-i), found by guessing a quadratic ansatz and matching coefficients -- the same technique, a guessed-form ansatz, that solves any linear recurrence with a polynomial forcing term.",
    code: `def expected_trades_to_absorption(i: int, n: int, p: float) -> float:
    if p == 0.5:
        # symmetric case: clean closed form from a quadratic ansatz
        return float(i * (n - i))

    r = (1 - p) / p
    denom = 1 - 2 * p
    return i / denom - (n / denom) * (1 - r**i) / (1 - r**n)


print(expected_trades_to_absorption(i=1, n=3, p=0.5))
# 2.0
print(round(expected_trades_to_absorption(i=5, n=10, p=0.52), 2))
# a slight structural edge shortens the expected time spent before absorption`,
    language: "python",
    complexity: { time: "O(1) with the closed form", space: "O(1)" },
  },
  {
    id: "lc-20261125-design-position-tracker-avg-cost",
    title: "Design a Position Tracker With Weighted-Average Cost and Realized P&L",
    difficulty: "medium",
    topics: ["design", "hash-map"],
    problem:
      "Design a PositionTracker that supports add_fill(ticker, qty, price), where qty is positive for a buy and negative for a sell, updating that ticker's net position and weighted-average cost basis, and realizing P&L on any quantity that reduces or flips the position. Support get_position(ticker) -> (net_qty, avg_cost) and get_realized_pnl(ticker) -> float.",
    examples: [
      {
        input: "add_fill('AAPL', 100, 50); add_fill('AAPL', -40, 60); get_position('AAPL'); get_realized_pnl('AAPL')",
        output: "(60.0, 50.0), 400.0",
        explanation:
          "Buying 100 shares at 50 sets avg_cost to 50. Selling 40 shares at 60 realizes (60 - 50) * 40 = 400 of profit and leaves 60 shares still at the same avg_cost of 50, since a partial sell doesn't change the average cost of what remains.",
      },
    ],
    constraints: [
      "fills arrive one at a time, in order",
      "a fill can be large enough to flip a position from long to short, or vice versa",
      "avg_cost is treated as 0 whenever net position is exactly zero",
    ],
    approach:
      "Track, per ticker, net_qty and avg_cost. A fill that INCREASES the position's size in the same direction, adding to a long or adding to a short, updates avg_cost as a size-weighted average of the old position and the new fill. A fill in the OPPOSITE direction instead realizes P&L on whatever quantity it closes out -- (fill price - avg_cost) times the closed quantity, signed by the position's direction -- and leaves avg_cost unchanged for any remaining quantity of the ORIGINAL position. If the fill is large enough to flip the position's sign entirely, the leftover quantity beyond what closed the old position opens a brand-new position priced at this fill's own price, mirroring how a real books-and-records system keeps realized P&L separate from the still-open position's cost basis.",
    code: `class PositionTracker:
    def __init__(self) -> None:
        self.net_qty: dict[str, float] = {}
        self.avg_cost: dict[str, float] = {}
        self.realized_pnl: dict[str, float] = {}

    def add_fill(self, ticker: str, qty: float, price: float) -> None:
        pos = self.net_qty.get(ticker, 0.0)
        cost = self.avg_cost.get(ticker, 0.0)
        pnl = self.realized_pnl.get(ticker, 0.0)

        same_direction = pos == 0 or (qty > 0) == (pos > 0)
        if same_direction:
            # adding to (or opening) a position: weighted-average the cost basis
            new_pos = pos + qty
            cost = (pos * cost + qty * price) / new_pos if new_pos != 0 else 0.0
            pos = new_pos
        else:
            direction = 1 if pos > 0 else -1
            closing_qty = min(abs(qty), abs(pos))
            pnl += direction * (price - cost) * closing_qty
            pos += qty
            if pos == 0:
                cost = 0.0
            elif (pos > 0) != (direction > 0):
                # the fill overshot the old position and flipped its sign --
                # the leftover opens a brand new position at this fill's price
                cost = price

        self.net_qty[ticker] = pos
        self.avg_cost[ticker] = cost
        self.realized_pnl[ticker] = pnl

    def get_position(self, ticker: str) -> tuple[float, float]:
        return self.net_qty.get(ticker, 0.0), self.avg_cost.get(ticker, 0.0)

    def get_realized_pnl(self, ticker: str) -> float:
        return self.realized_pnl.get(ticker, 0.0)


tracker = PositionTracker()
tracker.add_fill("AAPL", 100, 50)
tracker.add_fill("AAPL", -40, 60)
print(tracker.get_position("AAPL"))       # (60.0, 50.0)
print(tracker.get_realized_pnl("AAPL"))   # 400.0`,
    language: "python",
    complexity: { time: "O(1) per call", space: "O(number of distinct tickers)" },
  },
];
