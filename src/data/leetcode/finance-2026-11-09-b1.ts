import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-09
// Merging k sorted venue price ladders (heap), smallest window
// with at least k distinct tickers traded (sliding window),
// max profit from a single position with a mandatory one-day
// cooldown (DP), probability a symmetric inventory walk is
// back to flat after n ticks (combinatorics), and a FIFO-style
// average-cost position tracker with realized/unrealized P&L
// (design).
// ============================================================

export const financeBatch20261109: LeetCodeProblem[] = [
  {
    id: "lc-20261109-merge-k-venue-price-ladders",
    title: "Merge K Sorted Venue Price Ladders Into One Combined Ladder",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "You receive ask-side price ladders from k different venues, each already sorted ascending by price (duplicates across venues are kept -- each entry represents separate liquidity). Merge all k ladders into one fully sorted combined ladder.",
    examples: [
      {
        input: "ladders = [[100.0,101.5,103.0],[100.5,102.0],[99.5,100.0,104.0]]",
        output: "[99.5,100.0,100.0,100.5,101.5,102.0,103.0,104.0]",
        explanation:
          "All 8 price levels across the 3 venues, merged into one ascending sequence. The two 100.0 entries come from different venues and both survive.",
      },
    ],
    constraints: ["1 <= ladders.length <= 500", "0 <= ladders[i].length <= 10^4", "each ladders[i] is sorted ascending"],
    approach:
      "Classic k-way merge with a heap. Seed a min-heap with the first element of every non-empty ladder, tagged with (value, ladder index, element index) so ties don't try to compare list indices meaninglessly. Repeatedly pop the smallest, append it to the result, and if that ladder has a next element push it onto the heap. The heap never holds more than k elements at once, and every element is pushed and popped exactly once.",
    code: `import heapq

def merge_k_price_ladders(ladders: list[list[float]]) -> list[float]:
    heap: list[tuple[float, int, int]] = []
    for i, ladder in enumerate(ladders):
        if ladder:
            heapq.heappush(heap, (ladder[0], i, 0))

    result: list[float] = []
    while heap:
        price, i, j = heapq.heappop(heap)
        result.append(price)
        if j + 1 < len(ladders[i]):
            heapq.heappush(heap, (ladders[i][j + 1], i, j + 1))
    return result

print(merge_k_price_ladders([[100.0, 101.5, 103.0], [100.5, 102.0], [99.5, 100.0, 104.0]]))
# [99.5, 100.0, 100.0, 100.5, 101.5, 102.0, 103.0, 104.0]`,
    language: "python",
    complexity: { time: "O(N log k)", space: "O(k)" },
  },
  {
    id: "lc-20261109-smallest-window-k-distinct-tickers",
    title: "Smallest Window of a Trade Tape Containing At Least K Distinct Tickers",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a sequence of ticker symbols representing a trade tape (one ticker per trade, in order) and an integer k, return the length of the shortest contiguous window of the tape that contains at least k distinct tickers. Return -1 if no such window exists.",
    examples: [
      {
        input: 'tape = ["AAPL","MSFT","AAPL","GOOG","MSFT"], k = 3',
        output: "3",
        explanation:
          'The window ["AAPL","GOOG","MSFT"] (indices 2-4) has 3 distinct tickers and length 3; no shorter window anywhere in the tape reaches 3 distinct tickers.',
      },
    ],
    constraints: ["1 <= tape.length <= 10^5", "1 <= k <= 26"],
    approach:
      "Variable-size sliding window with a running frequency map. Expand the right edge, incrementing each ticker's count and bumping a distinct-count whenever a ticker's count goes from 0 to 1. Whenever distinct count reaches k, repeatedly try to shrink from the left: record the current window length as a candidate best, then decrement the leaving ticker's count (dropping distinct count if it hits 0) and advance left. This greedily finds, for every right edge, the smallest valid window ending there, and each index enters and leaves the window exactly once.",
    code: `from collections import defaultdict

def smallest_window_k_distinct(tape: list[str], k: int) -> int:
    freq: dict[str, int] = defaultdict(int)
    distinct = 0
    left = 0
    best = float("inf")

    for right, ticker in enumerate(tape):
        freq[ticker] += 1
        if freq[ticker] == 1:
            distinct += 1

        while distinct >= k:
            best = min(best, right - left + 1)
            freq[tape[left]] -= 1
            if freq[tape[left]] == 0:
                distinct -= 1
            left += 1

    return best if best != float("inf") else -1

print(smallest_window_k_distinct(["AAPL", "MSFT", "AAPL", "GOOG", "MSFT"], k=3))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-20261109-stock-cooldown-single-position",
    title: "Max Profit Holding At Most One Position at a Time, With a One-Day Cooldown After Closing",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given a sequence of daily prices for one instrument, you may open and close a long position as many times as you like, but you may hold at most one position at a time, and after closing a position you must wait one full day (a cooldown) before opening a new one. Return the maximum total profit achievable.",
    examples: [
      {
        input: "prices = [1,2,3,0,2]",
        output: "3",
        explanation:
          "Buy at index 0 (price 1), sell at index 1 (price 2) for profit 1. Index 2 is the forced cooldown day. Buy at index 3 (price 0), sell at index 4 (price 2) for profit 2. Total profit 1 + 2 = 3, which the DP confirms is optimal.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000", "0 <= prices[i] <= 10^4"],
    approach:
      "Three rolling states per day: hold (currently holding a position, max profit so far), sold (closed a position TODAY, so tomorrow is a forced cooldown), and rest (not holding, free to buy today). Transitions: hold either keeps yesterday's hold or buys today from yesterday's rest (rest - price); sold is always yesterday's hold plus today's price (closing today); rest either stays yesterday's rest or becomes free again because yesterday was a sold/cooldown day. The answer is the max of sold and rest on the final day (ending while holding is never optimal since you can't realize that profit).",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    hold = -prices[0]  # bought on day 0
    sold = 0            # just sold today (cooldown starts tomorrow)
    rest = 0            # not holding, free to buy

    for price in prices[1:]:
        prev_sold = sold
        sold = hold + price                     # close today's position
        hold = max(hold, rest - price)           # keep holding, or buy today
        rest = max(rest, prev_sold)              # stay free, or cooldown just ended

    return max(sold, rest)

print(max_profit_with_cooldown([1, 2, 3, 0, 2]))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261109-prob-walk-returns-to-flat",
    title: "Probability a Market-Making Desk's Inventory Is Back to Exactly Flat After N Ticks",
    difficulty: "hard",
    topics: ["probability", "math"],
    problem:
      "A market maker's inventory starts at 0. Each tick it moves +1 with probability p, or -1 with probability (1-p), with no barriers. Given p and a number of ticks n, return the probability that inventory is exactly 0 after n ticks.",
    examples: [
      {
        input: "p = 0.6, ticks = 4",
        output: "0.3456",
        explanation:
          "Being back at 0 after 4 ticks requires exactly 2 up-moves and 2 down-moves in some order: C(4,2) = 6 such orderings, each with probability 0.6^2 * 0.4^2 = 0.0576, for a total of 6 * 0.0576 = 0.3456.",
      },
    ],
    constraints: ["0 < p < 1", "0 <= ticks <= 10000"],
    approach:
      "Returning to exactly 0 after n ticks requires an equal number of up-moves and down-moves, which is only possible when n is even (n odd means an odd total displacement, which can never be zero). Writing n = 2m, the number of ways to arrange m up-moves and m down-moves among n ticks is the binomial coefficient C(n, m), and each specific ordering with m ups and m downs has probability p^m * (1-p)^m. Multiplying the count of orderings by the probability of any one ordering gives the closed-form answer directly, with no simulation or DP needed.",
    code: `import math

def prob_inventory_flat(p: float, ticks: int) -> float:
    if ticks % 2 != 0:
        return 0.0  # odd number of ticks can never return to an even displacement of 0

    m = ticks // 2
    ways = math.comb(ticks, m)          # orderings of m ups and m downs
    prob_each = (p ** m) * ((1 - p) ** m)
    return round(ways * prob_each, 6)

print(prob_inventory_flat(0.6, ticks=4))
# 0.3456`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261109-design-position-tracker-avg-cost",
    title: "Design: Average-Cost Position Tracker With Realized and Unrealized P&L",
    difficulty: "medium",
    topics: ["design"],
    problem:
      "Design a PositionTracker that processes fills one at a time via fill(side, qty, price), where side is 'BUY' or 'SELL'. It should track the current net position (positive for long, negative for short), the average cost basis of that open position, the cumulative realized P&L from any closing trades (using the average-cost method), and support unrealized_pnl(mark_price) for the open position against a given mark.",
    examples: [
      {
        input: 'fill("BUY", 100, 50.0); fill("SELL", 40, 60.0)',
        output: "position=60, avg_cost=50.0, realized_pnl=400.0",
        explanation:
          "Buying 100 @ 50 opens a 100-long position with avg cost 50. Selling 40 @ 60 closes 40 units of that position, realizing 40 * (60 - 50) = 400 profit, leaving 60 units still open at the unchanged avg cost of 50.",
      },
    ],
    constraints: ["qty > 0 for every fill", "at most 10^5 fills"],
    approach:
      "Track signed position (positive long, negative short) and avg_cost for the currently open side. A fill on the SAME side as the current position (or opening from flat) just updates avg_cost as a size-weighted average and grows the position. A fill on the OPPOSITE side closes up to abs(position) units at the existing avg_cost, realizing (price - avg_cost) per unit if closing a long or (avg_cost - price) per unit if closing a short; any leftover fill quantity beyond what closes the existing position flips the position to the other side and starts a brand-new avg_cost at the fill's own price.",
    code: `class PositionTracker:
    def __init__(self) -> None:
        self.position = 0.0
        self.avg_cost = 0.0
        self.realized_pnl = 0.0

    def fill(self, side: str, qty: float, price: float) -> None:
        signed_qty = qty if side == "BUY" else -qty

        if self.position == 0 or (self.position > 0) == (signed_qty > 0):
            # adding to (or opening) a position on the same side
            new_total = abs(self.position) + qty
            self.avg_cost = (self.avg_cost * abs(self.position) + price * qty) / new_total
            self.position += signed_qty
        else:
            # closing some or all of the opposite-side position
            closing_qty = min(abs(self.position), qty)
            per_unit = (price - self.avg_cost) if self.position > 0 else (self.avg_cost - price)
            self.realized_pnl += closing_qty * per_unit

            remaining = qty - closing_qty
            self.position += signed_qty
            if remaining > 0:
                self.avg_cost = price  # position flipped side; new leg starts here

    def unrealized_pnl(self, mark_price: float) -> float:
        if self.position > 0:
            return (mark_price - self.avg_cost) * self.position
        if self.position < 0:
            return (self.avg_cost - mark_price) * abs(self.position)
        return 0.0

tracker = PositionTracker()
tracker.fill("BUY", 100, 50.0)
tracker.fill("SELL", 40, 60.0)
print(tracker.position, tracker.avg_cost, tracker.realized_pnl)
# 60.0 50.0 400.0`,
    language: "python",
    complexity: { time: "O(1) per fill", space: "O(1)" },
  },
];
