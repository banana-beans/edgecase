import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-13
// Running median of resting order sizes (two heaps), smallest
// window containing at least K distinct tickers (hashmap sliding
// window), max profit with at most K round-trip trades (DP),
// gambler's-ruin probability for a market maker's inventory walk
// hitting a long limit before a flat/short limit (probability),
// and a position tracker with average cost basis and realized
// P&L on closes/flips (design).
// ============================================================

export const financeBatch20261113: LeetCodeProblem[] = [
  {
    id: "lc-20261113-running-median-order-sizes",
    title: "Running Median of Resting Order Sizes in a Live Book",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Design a class that ingests resting order sizes one at a time as orders arrive in a live book, and after each insertion reports the current median order size seen so far.",
    examples: [
      {
        input: "add(100); add(400); add(200); add(300); add(50)",
        output: "100.0, 250.0, 200.0, 250.0, 200.0",
        explanation:
          "After [100]: median 100.0. After [100,400]: median (100+400)/2 = 250.0. After [100,200,400]: median 200.0. After [100,200,300,400]: median (200+300)/2 = 250.0. After [50,100,200,300,400]: median 200.0.",
      },
    ],
    constraints: ["up to 10^5 add calls", "each size is a positive integer"],
    approach:
      "This is the classic two-heap running-median pattern: keep a max-heap for the lower half of values seen so far and a min-heap for the upper half, always rebalancing after each insert so the two halves differ in size by at most one. Python's heapq only gives a min-heap, so the lower half is stored with every value negated, making its smallest (most negative) entry correspond to the true largest value in that half -- the same negation trick used for any 'I need a max-heap' problem in Python. Routing a new value into the correct half first, then rebalancing by moving one element across if the sizes drift apart by more than one, keeps both heaps balanced in O(log n) per insertion, and the median is read directly off the top of one or both heaps in O(1) once balanced.",
    code: `import heapq


class RunningMedianOrderSizes:
    def __init__(self) -> None:
        self.lower: list[int] = []  # max-heap (negated) for the smaller half
        self.upper: list[int] = []  # min-heap for the larger half

    def add(self, size: int) -> float:
        # route into the half it belongs in, then rebalance so the two
        # halves' sizes never differ by more than one
        if self.lower and size > -self.lower[0]:
            heapq.heappush(self.upper, size)
        else:
            heapq.heappush(self.lower, -size)

        if len(self.lower) > len(self.upper) + 1:
            heapq.heappush(self.upper, -heapq.heappop(self.lower))
        elif len(self.upper) > len(self.lower):
            heapq.heappush(self.lower, -heapq.heappop(self.upper))

        return self._median()

    def _median(self) -> float:
        if len(self.lower) > len(self.upper):
            return float(-self.lower[0])
        return (-self.lower[0] + self.upper[0]) / 2.0


tracker = RunningMedianOrderSizes()
for size in [100, 400, 200, 300, 50]:
    print(tracker.add(size))
# 100.0, 250.0, 200.0, 250.0, 200.0`,
    language: "python",
    complexity: { time: "O(log n) per insertion, O(1) per median query", space: "O(n)" },
  },
  {
    id: "lc-20261113-smallest-window-k-distinct-tickers",
    title: "Smallest Window Containing At Least K Distinct Tickers",
    difficulty: "medium",
    topics: ["sliding-window", "hash-map"],
    problem:
      "Given a chronological list of ticker symbols from a consolidated trade tape and an integer k, return the length of the shortest contiguous window of trades that contains at least k distinct tickers. This models the minimum lookback a cross-sectional feature needs before it has enough breadth to compute reliably. Return 0 if no such window exists.",
    examples: [
      {
        input: 'trades = ["AAPL","MSFT","AAPL","GOOG","MSFT","AMZN"], k = 3',
        output: "3",
        explanation:
          "The window at indices 1..3 ([\"MSFT\",\"AAPL\",\"GOOG\"]) already contains 3 distinct tickers, and since 3 is the theoretical minimum possible length for 3 distinct tickers, no shorter window can beat it.",
      },
    ],
    constraints: ["1 <= trades.length <= 10^5", "1 <= k <= number of distinct tickers in trades"],
    approach:
      "Standard variable-size sliding window with a hashmap tracking counts in the current window: expand the right pointer, incrementing the count for each ticker seen and bumping a running distinct-ticker counter the first time a ticker's count goes from 0 to 1. Once the window holds at least k distinct tickers, shrink from the left as far as possible while that condition still holds, recording the window length at each valid step -- shrinking stops the moment removing the leftmost element would drop a ticker's count to 0 and take distinct below k. Because the left pointer only ever advances and never resets backward, every element is visited by right once and by left at most once, giving a single O(n) pass despite the nested-looking loop.",
    code: `from collections import defaultdict


def smallest_window_k_distinct_tickers(trades: list[str], k: int) -> int:
    counts: dict[str, int] = defaultdict(int)
    distinct = 0
    left = 0
    best = float("inf")

    for right, ticker in enumerate(trades):
        if counts[ticker] == 0:
            distinct += 1
        counts[ticker] += 1

        # once the window has enough breadth, shrink from the left as far as
        # possible while still keeping at least k distinct tickers in view
        while distinct >= k:
            best = min(best, right - left + 1)
            counts[trades[left]] -= 1
            if counts[trades[left]] == 0:
                distinct -= 1
            left += 1

    return 0 if best == float("inf") else best


print(smallest_window_k_distinct_tickers(
    ["AAPL", "MSFT", "AAPL", "GOOG", "MSFT", "AMZN"], k=3
))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(number of distinct tickers)" },
  },
  {
    id: "lc-20261113-max-profit-at-most-k-trades",
    title: "Max Profit With At Most K Round-Trip Trades",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for one instrument and an integer k, you may complete at most k buy-then-sell round trips, never holding more than one unit at a time and always selling before buying again. Return the maximum total profit achievable.",
    examples: [
      {
        input: "prices = [3,2,6,5,0,3], k = 2",
        output: "7",
        explanation:
          "Buy at 2, sell at 6 (profit 4); buy at 0, sell at 3 (profit 3). Two round trips, total profit 4 + 3 = 7, and no combination of at most 2 round trips beats it.",
      },
    ],
    constraints: ["1 <= k <= 100", "1 <= prices.length <= 1000"],
    approach:
      "This is the K-transaction generalization of the single buy/sell DP. Track, for each count of round trips j from 1 to k, hold[j] (max profit while currently holding a position, having started at most j round trips) and cash[j] (max profit while flat, having completed at most j round trips); each day, hold[j] = max(hold[j], cash[j-1] - price) (keep holding, or start round trip j funded by last round trip's proceeds) and cash[j] = max(cash[j], hold[j] + price) (stay flat, or close round trip j today). The one optimization worth flagging out loud in an interview: once k is at least half the number of trading days, the 'at most k' cap can never actually bind, since you can't physically fit more round trips than that into the series anyway -- so the problem collapses to the unlimited-transactions case, summing every positive day-over-day move, which avoids the O(n*k) cost entirely when k is large.",
    code: `def max_profit_at_most_k_trades(prices: list[int], k: int) -> int:
    n = len(prices)
    if n < 2 or k == 0:
        return 0

    # if k can never actually bind, collapse to the unlimited-trades case
    if k >= n // 2:
        return sum(max(prices[i + 1] - prices[i], 0) for i in range(n - 1))

    # hold[j]: max profit while holding, having started at most j+1 round trips
    # cash[j]: max profit while flat, having completed at most j+1 round trips
    hold = [-prices[0]] * k
    cash = [0] * k

    for price in prices[1:]:
        for j in range(k):
            prev_cash = cash[j - 1] if j > 0 else 0
            hold[j] = max(hold[j], prev_cash - price)
            cash[j] = max(cash[j], hold[j] + price)

    return cash[-1]


print(max_profit_at_most_k_trades([3, 2, 6, 5, 0, 3], k=2))
# 7`,
    language: "python",
    complexity: { time: "O(n * min(k, n))", space: "O(min(k, n))" },
  },
  {
    id: "lc-20261113-inventory-random-walk-ruin-probability",
    title: "Probability a Market Maker's Inventory Random Walk Hits the Long Limit Before the Flat/Short Limit",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "A market maker's inventory starts at s shares, with 0 < s < N, and each tick moves to s + 1 with probability p or s - 1 with probability 1 - p, until it is absorbed at either 0 (forced flat) or N (the hard long risk limit). Given p, N, and s, return the probability the inventory reaches N before it reaches 0.",
    examples: [
      {
        input: "p = 0.5, N = 10, s = 4",
        output: "0.4",
        explanation:
          "With an unbiased (p = 0.5) random walk, the ruin probability reduces to the simple ratio of the starting distance from the lower barrier to the total distance between barriers: s / N = 4 / 10 = 0.4.",
      },
      {
        input: "p = 0.5, N = 4, s = 1",
        output: "0.25",
        explanation: "Again s / N, since p = 0.5: 1 / 4 = 0.25.",
      },
    ],
    constraints: ["0 < s < N", "1 <= N <= 10^6", "0 < p < 1"],
    approach:
      "This is the classical gambler's ruin problem. A first-step argument gives P(s) = p * P(s+1) + (1-p) * P(s-1) for the probability of reaching N before 0 starting from s, with boundary conditions P(0) = 0 and P(N) = 1. Solving this linear recurrence has two regimes: when p = 0.5 the walk is unbiased and the solution collapses to the simple linear ratio P(s) = s / N; when p != 0.5, letting r = (1-p)/p, the closed form is P(s) = (1 - r^s) / (1 - r^N). The subtlety worth flagging out loud: evaluating r^N directly for a large N with p meaningfully different from 0.5 can overflow or underflow in floating point long before N reaches the problem's stated bound, so for a strongly biased walk the numerically safe form factors out the larger power instead of ever computing r^N on its own.",
    code: `def ruin_probability_hits_upper_first(p: float, n: int, s: int) -> float:
    # unbiased walk: ruin probability collapses to the simple linear ratio
    if abs(p - 0.5) < 1e-12:
        return s / n

    r = (1 - p) / p  # classical gambler's ruin ratio q/p

    if r <= 1:
        # p >= 0.5: r**s and r**n are both <= 1, safe to evaluate directly
        return (1 - r ** s) / (1 - r ** n)

    # p < 0.5 (unfavorable drift): r > 1, so r**n would overflow for large n.
    # rewrite using r**(s - n) and r**(-n), both <= 1, instead of r**n itself.
    return (r ** (s - n) - r ** -n) / (1 - r ** -n)


print(ruin_probability_hits_upper_first(0.5, 10, 4))
# 0.4
print(ruin_probability_hits_upper_first(0.5, 4, 1))
# 0.25
print(round(ruin_probability_hits_upper_first(0.6, 5, 2), 4))
# a favorable drift (p > 0.5) raises the chance of hitting the upper limit first`,
    language: "python",
    complexity: { time: "O(1) with the closed form (O(N) for a direct DP sweep)", space: "O(1)" },
  },
  {
    id: "lc-20261113-design-position-tracker-cost-basis",
    title: "Design: Position Tracker With Average Cost Basis and Realized P&L",
    difficulty: "medium",
    topics: ["design"],
    problem:
      "Design a PositionTracker for one instrument supporting trade(quantity, price), where quantity is positive for a buy and negative for a sell (short sales allowed). The tracker maintains a running position and its average cost basis, and each call returns the REALIZED P&L produced by that specific trade (0 if the trade only adds to an existing position without closing any of it). A trade that closes the existing position and still has size left over must flip to the opposite side in the same call, with the leftover opening fresh at the trade's own price.",
    examples: [
      {
        input: "trade(10, 100); trade(5, 110); trade(-20, 120)",
        output: "0.0, 0.0, 250.0",
        explanation:
          "First trade opens 10 long @ 100, no realization. Second trade adds 5 more @ 110, blending the average cost to (10*100 + 5*110)/15 = 103.33, still no realization. Third trade sells 20: the first 15 close the long at a realized profit of (120 - 103.33) * 15 = 250.0, and the remaining 5 open a new short position @ 120.",
      },
    ],
    constraints: ["quantity and price are nonzero, finite numbers across all calls"],
    approach:
      "Represent the position as (quantity, average_cost) and branch on just two cases. When the incoming trade is the SAME sign as the existing position (or there is no existing position), it only adds exposure: blend the cost basis as the size-weighted average of the old and new fills, and nothing realizes yet since nothing closed. When the incoming trade has the OPPOSITE sign, it closes min(abs(existing), abs(incoming)) units against the existing average cost, realizing (price - avg_cost) * closed_qty for a long being sold, or the mirror sign for a short being covered; if the incoming quantity's magnitude exceeds what was open, the leftover flips the position to the other side entirely at the trade's own price, which becomes that side's fresh average cost. This single case split -- same-sign add vs opposite-sign close-and-possibly-flip -- correctly covers a full close to flat as just the boundary where the leftover is zero.",
    code: `class PositionTracker:
    def __init__(self) -> None:
        self.quantity = 0.0  # positive = long, negative = short
        self.avg_cost = 0.0

    def trade(self, quantity: float, price: float) -> float:
        # case 1: no existing position, or adding to the same side --
        # blend the cost basis, nothing closes yet.
        if self.quantity == 0 or (self.quantity > 0) == (quantity > 0):
            new_quantity = self.quantity + quantity
            if new_quantity != 0:
                self.avg_cost = (
                    self.avg_cost * abs(self.quantity) + price * abs(quantity)
                ) / abs(new_quantity)
            self.quantity = new_quantity
            return 0.0

        # case 2: opposite sign -- this trade closes some or all of the
        # existing position, and may flip it to the other side.
        closing_qty = min(abs(self.quantity), abs(quantity))
        # a long being sold realizes (price - avg_cost); a short being
        # covered realizes (avg_cost - price) -- one signed expression covers both.
        direction = 1 if self.quantity > 0 else -1
        realized = direction * (price - self.avg_cost) * closing_qty

        remaining = self.quantity + quantity
        if remaining == 0 or (remaining > 0) == (self.quantity > 0):
            self.quantity = remaining
        else:
            # flipped through flat to the opposite side -- the leftover
            # opens fresh at this trade's own price.
            self.quantity = remaining
            self.avg_cost = price

        return realized


tracker = PositionTracker()
print(tracker.trade(10, 100))   # 0.0
print(tracker.trade(5, 110))    # 0.0, avg_cost now ~103.33
print(tracker.trade(-20, 120))  # 250.0 -- closes the long, flips to -5 short @ 120`,
    language: "python",
    complexity: { time: "O(1) per trade", space: "O(1)" },
  },
];
