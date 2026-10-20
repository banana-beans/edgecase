import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-20
// Running median of a streaming price feed (two heaps), longest
// trading window with at most K losing days (sliding window),
// max profit with at most K round-trip trades (DP stock
// variant), gambler's ruin absorption probability
// (probability/Markov), and a position tracker with
// realized/unrealized P&L (design).
// ============================================================

export const financeBatch20261020: LeetCodeProblem[] = [
  {
    id: "lc-20261020-running-median-streaming-prices",
    title: "Running Median of a Streaming Price Feed",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Design a class that ingests a stream of trade prices one at a time via add_price(price) and can return the median of all prices seen so far via get_median() in O(log n) per insertion and O(1) per query.",
    examples: [
      {
        input: "add_price(5); add_price(2); get_median(); add_price(8); get_median()",
        output: "3.5, then 5",
        explanation:
          "After [5,2], sorted is [2,5], median is their average 3.5. After [5,2,8], sorted is [2,5,8], median is 5.",
      },
    ],
    constraints: ["up to 10^5 calls to add_price", "price values fit in a standard float"],
    approach:
      "Maintain two heaps: a max-heap for the lower half of values (negate for Python's min-heap) and a min-heap for the upper half, kept balanced so their sizes differ by at most 1. Every insertion goes to one heap based on comparison with its top, then a rebalancing step moves at most one element across if sizes drift apart by more than 1, keeping both heaps within one element of each other in O(log n). The median is then either the top of the larger heap (odd total count) or the average of both tops (even total count) -- O(1) once the heaps are balanced.",
    code: `import heapq

class RunningMedian:
    def __init__(self):
        self.lower: list[float] = []   # max-heap via negation
        self.upper: list[float] = []   # min-heap, true values

    def add_price(self, price: float) -> None:
        # route into whichever half it belongs to, then rebalance sizes
        if not self.lower or price <= -self.lower[0]:
            heapq.heappush(self.lower, -price)
        else:
            heapq.heappush(self.upper, price)

        if len(self.lower) > len(self.upper) + 1:
            heapq.heappush(self.upper, -heapq.heappop(self.lower))
        elif len(self.upper) > len(self.lower) + 1:
            heapq.heappush(self.lower, -heapq.heappop(self.upper))

    def get_median(self) -> float:
        if len(self.lower) == len(self.upper):
            return (-self.lower[0] + self.upper[0]) / 2
        return -self.lower[0] if len(self.lower) > len(self.upper) else self.upper[0]

rm = RunningMedian()
rm.add_price(5)
rm.add_price(2)
print(rm.get_median())   # 3.5
rm.add_price(8)
print(rm.get_median())   # 5`,
    language: "python",
    complexity: { time: "O(log n) per add_price, O(1) per get_median", space: "O(n)" },
  },
  {
    id: "lc-20261020-longest-window-at-most-k-losing-days",
    title: "Longest Trading Window With At Most K Losing Days",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given an array of daily P&L values and an integer k, return the length of the longest contiguous window of days containing at most k days with negative P&L (losing days).",
    examples: [
      {
        input: "pnl = [2, -1, -1, 3, 4, -1, 5], k = 1",
        output: "4",
        explanation:
          "The window [3, 4, -1, 5] contains exactly one losing day. No longer window in the array stays at or under that limit.",
      },
    ],
    constraints: ["1 <= pnl.length <= 10^5", "0 <= k <= pnl.length"],
    approach:
      "This is the classic 'longest subarray with at most k zeros' pattern wrapped in finance language, solved with a standard two-pointer window: expand right, and whenever a losing day is added, increment a losing-day counter; whenever that counter exceeds k, advance left (decrementing the counter when a losing day falls out of the window) until the window is valid again. Because the validity constraint only increases as the window grows and only decreases as it shrinks, the minimal valid left for each right is non-decreasing, which is exactly the monotonicity the two-pointer technique needs to be both correct and O(n) -- each index enters and leaves the window exactly once.",
    code: `def longest_window_at_most_k_losing_days(pnl: list[int], k: int) -> int:
    left = 0
    losing_days = 0
    best = 0

    for right, value in enumerate(pnl):
        if value < 0:
            losing_days += 1

        # shrink from the left while there are too many losing days in the window
        while losing_days > k:
            if pnl[left] < 0:
                losing_days -= 1
            left += 1

        best = max(best, right - left + 1)

    return best

print(longest_window_at_most_k_losing_days([2, -1, -1, 3, 4, -1, 5], k=1))
# 4`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261020-max-profit-at-most-k-trades",
    title: "Maximum Profit With At Most K Round-Trip Trades",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for one instrument and an integer k, return the maximum profit achievable using at most k non-overlapping buy-then-sell round trips (you must sell before buying again).",
    examples: [
      {
        input: "prices = [3, 2, 6, 5, 0, 3], k = 2",
        output: "7",
        explanation:
          "Buy at 2, sell at 6 (profit 4); buy at 0, sell at 3 (profit 3). Total 7, using exactly 2 of the allowed round trips.",
      },
    ],
    constraints: ["1 <= prices.length <= 1000", "0 <= k <= 100", "0 <= prices[i] < 10^4"],
    approach:
      "Classic two-state-per-transaction DP: for each of the k allowed round trips j, track hold[j] (max profit so far if currently holding a share, having started at most j round trips) and cash[j] (max profit so far if flat, having completed at most j round trips). The transitions on each new price: hold[j] = max(hold[j], cash[j-1] - price) (buy, starting round trip j), cash[j] = max(cash[j], hold[j] + price) (sell, completing round trip j). Processing j from 1 up to k on each day keeps the recurrence using only that same day's already-updated cash[j-1] and the previous day's hold[j], filling an O(n*k) table in a single pass with O(k) space.",
    code: `def max_profit_at_most_k_trades(prices: list[int], k: int) -> int:
    if not prices or k == 0:
        return 0

    # cash[j]: max profit flat, having completed at most j round trips
    # hold[j]: max profit holding a share, having started at most j round trips
    cash = [0] * (k + 1)
    hold = [float("-inf")] * (k + 1)

    for price in prices:
        for j in range(1, k + 1):
            # buy today for round trip j, using cash left over from round trip j-1
            hold[j] = max(hold[j], cash[j - 1] - price)
            # sell today to complete round trip j
            cash[j] = max(cash[j], hold[j] + price)

    return cash[k]

print(max_profit_at_most_k_trades([3, 2, 6, 5, 0, 3], k=2))
# 7`,
    language: "python",
    complexity: { time: "O(n*k)", space: "O(k)" },
  },
  {
    id: "lc-20261020-probability-of-ruin-biased-walk",
    title: "Probability of Ruin in a Biased Random Walk",
    difficulty: "medium",
    topics: ["probability"],
    problem:
      "A trader's account P&L moves up by 1 unit with probability p or down by 1 unit with probability (1-p) each step, starting at 0. Given a stop-loss at -S units (ruin) and a take-profit at +T units, return the probability the account hits the stop-loss before the take-profit.",
    examples: [
      {
        input: "p = 0.5, stop_loss = 4, take_profit = 6",
        output: "0.6",
        explanation:
          "For a fair walk, the ruin probability from a symmetric random walk with barriers at -S and +T is simply T / (S + T) = 6/10 = 0.6.",
      },
    ],
    constraints: ["0 < p < 1", "1 <= stop_loss, take_profit <= 10^5"],
    approach:
      "This is the gambler's ruin problem. For a fair walk (p=0.5), the probability of hitting the lower barrier first has the clean closed form take_profit / (stop_loss + take_profit) -- the walk is equally likely to drift either way, so the barrier CLOSER in distance is reached first in inverse proportion to its distance. For a biased walk, the closed form uses r = (1-p)/p: the ruin probability is (r^stop_loss - r^(stop_loss+take_profit)) / (1 - r^(stop_loss+take_profit)), derived by solving the linear difference equation for absorption probability as a function of starting position with boundary conditions at the two barriers. Both are O(1) once you have the formula; the alternative is an O(S+T) DP solving the same recurrence position by position, useful as a sanity check against the closed form.",
    code: `def probability_of_ruin(p: float, stop_loss: int, take_profit: int) -> float:
    # fair walk: ruin probability is simply the OTHER barrier's distance,
    # normalized by the total distance -- closer barriers are hit more often
    if p == 0.5:
        return take_profit / (stop_loss + take_profit)

    r = (1 - p) / p
    numerator = r ** stop_loss - r ** (stop_loss + take_profit)
    denominator = 1 - r ** (stop_loss + take_profit)
    return numerator / denominator

print(probability_of_ruin(p=0.5, stop_loss=4, take_profit=6))
# 0.6

print(round(probability_of_ruin(p=0.52, stop_loss=4, take_profit=6), 4))
# a small positive edge per step meaningfully lowers the probability of
# hitting the stop-loss first, compared to the fair-walk 0.6 baseline`,
    language: "python",
    complexity: { time: "O(1)", space: "O(1)" },
  },
  {
    id: "lc-20261020-design-position-tracker-pnl",
    title: "Design a Position Tracker With Realized/Unrealized P&L",
    difficulty: "medium",
    topics: ["design"],
    problem:
      "Design a class PositionTracker that supports trade(ticker, quantity, price) (quantity positive for buy, negative for sell, using average-cost-basis accounting) and mark(ticker, price) (update the current mark price), and exposes realized_pnl(ticker) and unrealized_pnl(ticker) at any time. Selling more than the current position's size should still be supported (it can go short).",
    examples: [
      {
        input: "pt.trade('AAA', 10, 100); pt.trade('AAA', -4, 110); pt.mark('AAA', 105)",
        output: "realized_pnl('AAA') -> 40; unrealized_pnl('AAA') -> 30",
        explanation:
          "Buying 10 @ 100 sets avg cost 100. Selling 4 @ 110 realizes (110-100)*4=40 and leaves 6 shares at avg cost 100. Marking at 105 gives unrealized (105-100)*6=30 on the remaining position.",
      },
    ],
    constraints: [
      "up to 10^5 calls across trade/mark/query methods",
      "quantity and price are floats; quantity is never zero",
    ],
    approach:
      "Track, per ticker, a running position size, an average cost basis, realized P&L so far, and the last mark price. A trade that INCREASES the position's magnitude in the same direction only updates the weighted-average cost basis -- no P&L is realized, since nothing closed. A trade that REDUCES the position's magnitude (partially or fully closing it, or flipping through zero) realizes P&L on the portion that closes, computed against the existing average cost, before any leftover quantity (in the flip-through-zero case) opens a brand new position at the new trade's price as its cost basis. unrealized_pnl is just (mark price - avg cost) times current position size, which stays sign-correct for shorts because a negative position size naturally flips the sign of the product.",
    code: `class PositionTracker:
    def __init__(self):
        self.position: dict[str, float] = {}
        self.avg_cost: dict[str, float] = {}
        self.realized: dict[str, float] = {}
        self.mark_price: dict[str, float] = {}

    def trade(self, ticker: str, quantity: float, price: float) -> None:
        pos = self.position.get(ticker, 0.0)
        cost = self.avg_cost.get(ticker, 0.0)
        self.realized.setdefault(ticker, 0.0)

        same_direction = pos == 0 or (pos > 0) == (quantity > 0)

        if same_direction:
            # adding to the position (or opening fresh) -- blend cost basis,
            # nothing realized because nothing closed
            new_pos = pos + quantity
            self.avg_cost[ticker] = (
                price if pos == 0 else (pos * cost + quantity * price) / new_pos
            )
            self.position[ticker] = new_pos
        else:
            closing_qty = min(abs(quantity), abs(pos))
            # realize P&L on the portion that closes -- the sign flips
            # naturally for a short because pos itself is negative there
            self.realized[ticker] += closing_qty * (price - cost) * (1 if pos > 0 else -1)
            new_pos = pos + quantity
            if (pos > 0) != (new_pos > 0) and new_pos != 0:
                # flipped through zero -- the leftover opens a fresh position
                self.avg_cost[ticker] = price
            self.position[ticker] = new_pos

    def mark(self, ticker: str, price: float) -> None:
        self.mark_price[ticker] = price

    def realized_pnl(self, ticker: str) -> float:
        return self.realized.get(ticker, 0.0)

    def unrealized_pnl(self, ticker: str) -> float:
        pos = self.position.get(ticker, 0.0)
        cost = self.avg_cost.get(ticker, 0.0)
        mark = self.mark_price.get(ticker, cost)
        return pos * (mark - cost)

pt = PositionTracker()
pt.trade("AAA", 10, 100)
pt.trade("AAA", -4, 110)
pt.mark("AAA", 105)
print(pt.realized_pnl("AAA"), pt.unrealized_pnl("AAA"))
# 40.0 30.0`,
    language: "python",
    complexity: { time: "O(1) per call", space: "O(number of tickers)" },
  },
];
