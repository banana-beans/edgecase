import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-07
// K-way merge of sorted venue feeds (heap), longest window with
// at most K distinct symbols (sliding window), max profit with
// at most two transactions under a flat per-trade fee (DP stock
// variant), expected trades until N consecutive wins (probability
// / Markov hitting time), and a position tracker with average
// cost basis and realized P&L (design).
// ============================================================

export const financeBatch20261107: LeetCodeProblem[] = [
  {
    id: "lc-20261107-merge-k-order-feeds",
    title: "Merge K Sorted Trade Feeds Into One Time-Ordered Stream",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "You're given k separate arrays of trade timestamps (each individually sorted ascending, representing k venues' feeds for the same symbol). Merge them into a single sorted array of all timestamps across all venues.",
    examples: [
      {
        input: "feeds = [[1,4,7],[2,3,9],[5,6]]",
        output: "[1,2,3,4,5,6,7,9]",
        explanation:
          "Each of the 3 feeds is individually sorted; merging all of them by timestamp interleaves venues as needed, pulling the smallest available timestamp across all feeds at each step until every feed is exhausted.",
      },
    ],
    constraints: ["1 <= k <= 10^4", "0 <= feeds[i].length <= 10^4", "total number of timestamps across all feeds <= 10^5"],
    approach:
      "Push the first element of each feed onto a min-heap keyed by (timestamp, feed_index, position_in_feed). Repeatedly pop the smallest, append it to the result, and if that feed has a next element, push it. This never compares more than k elements at a time, giving O(n log k) instead of O(n log n) from concatenating everything and sorting from scratch, and exploits the fact that each feed arrives pre-sorted.",
    code: `import heapq

def merge_k_feeds(feeds: list[list[int]]) -> list[int]:
    heap = []  # (timestamp, feed_idx, position_in_feed)
    for i, feed in enumerate(feeds):
        if feed:
            heapq.heappush(heap, (feed[0], i, 0))

    result = []
    while heap:
        ts, feed_idx, pos = heapq.heappop(heap)
        result.append(ts)
        next_pos = pos + 1
        if next_pos < len(feeds[feed_idx]):
            heapq.heappush(heap, (feeds[feed_idx][next_pos], feed_idx, next_pos))

    return result

print(merge_k_feeds([[1, 4, 7], [2, 3, 9], [5, 6]]))
# [1, 2, 3, 4, 5, 6, 7, 9]`,
    language: "python",
    complexity: { time: "O(n log k) where n is total timestamps across all feeds", space: "O(k)" },
  },
  {
    id: "lc-20261107-longest-window-k-distinct-symbols",
    title: "Longest Contiguous Trading Window With At Most K Distinct Symbols",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given an array of symbol tickers representing a chronological stream of trades (one ticker per trade) and an integer k, return the length of the longest contiguous subarray containing at most k distinct tickers.",
    examples: [
      {
        input: 'trades = ["AAPL","MSFT","AAPL","GOOG","MSFT"], k = 2',
        output: "3",
        explanation:
          'The window ["AAPL","MSFT","AAPL"] (indices 0-2) contains only 2 distinct tickers and has length 3. Extending to index 3 introduces "GOOG", a third distinct ticker, which violates k = 2, so no longer window qualifies.',
      },
    ],
    constraints: ["1 <= trades.length <= 10^5", "1 <= k <= trades.length"],
    approach:
      "Classic variable-size sliding window with a hash map counting occurrences of each ticker currently inside the window. Expand the right edge, incrementing that ticker's count; whenever the map's distinct-key count exceeds k, shrink from the left, decrementing and removing a ticker's entry once its count hits zero. Track the best window length seen after each expansion. Each trade enters and leaves the window at most once, giving linear time.",
    code: `from collections import defaultdict

def longest_window_k_distinct(trades: list[str], k: int) -> int:
    left = 0
    counts: dict[str, int] = defaultdict(int)
    best = 0

    for right, ticker in enumerate(trades):
        counts[ticker] += 1
        while len(counts) > k:
            left_ticker = trades[left]
            counts[left_ticker] -= 1
            if counts[left_ticker] == 0:
                del counts[left_ticker]
            left += 1
        best = max(best, right - left + 1)

    return best

print(longest_window_k_distinct(["AAPL", "MSFT", "AAPL", "GOOG", "MSFT"], k=2))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(k)" },
  },
  {
    id: "lc-20261107-max-profit-two-transactions-fee",
    title: "Max Profit With At Most Two Transactions and a Flat Per-Trade Fee",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices and a flat fee charged once per completed buy-sell transaction, you may complete at most two transactions (a transaction is one buy followed by one sell; you cannot hold more than one share at a time). Return the maximum achievable profit after fees.",
    examples: [
      {
        input: "prices = [3, 2, 6, 5, 0, 3], fee = 1",
        output: "5",
        explanation:
          "First transaction buys at index 1 (price 2) and sells at index 2 (price 6) for a gross profit of 4. Second transaction buys at index 4 (price 0) and sells at index 5 (price 3) for a gross profit of 3. Combined gross profit is 7; subtracting the fee once per transaction (2 x 1) leaves a net profit of 5, better than any other non-overlapping pair of transactions.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^5", "0 <= fee <= 10^4"],
    approach:
      "Track four running states per day: hold1 (holding a share from the first buy), sold1 (cash after completing transaction #1, net of its fee), hold2 (holding a share from a second buy, funded out of sold1's cash), and sold2 (cash after completing transaction #2, net of its fee). Each state only ever improves: hold1 = max(hold1, -price), sold1 = max(sold1, hold1 + price - fee), hold2 = max(hold2, sold1 - price), sold2 = max(sold2, hold2 + price - fee). The answer is the best of using zero, one, or two transactions, which is max(0, sold1, sold2).",
    code: `def max_profit_two_transactions_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    hold1 = -prices[0]      # holding a share from the first buy
    sold1 = 0                # cash after completing transaction #1, net of its fee
    hold2 = float("-inf")    # holding a share from a second buy, funded by sold1's cash
    sold2 = float("-inf")    # cash after completing transaction #2, net of its fee

    for price in prices[1:]:
        hold1 = max(hold1, -price)
        sold1 = max(sold1, hold1 + price - fee)
        hold2 = max(hold2, sold1 - price)
        sold2 = max(sold2, hold2 + price - fee)

    return max(0, sold1, sold2)

print(max_profit_two_transactions_fee([3, 2, 6, 5, 0, 3], fee=1))   # 5`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261107-expected-trades-until-n-consecutive-wins",
    title: "Expected Number of Trades Until N Consecutive Winning Trades",
    difficulty: "medium",
    topics: ["probability", "dynamic-programming"],
    problem:
      "A trader wins each independent trade with probability p. Given p and an integer n, return the expected number of trades until the first time n consecutive wins occur in a row. Return the answer rounded to 4 decimal places.",
    examples: [
      {
        input: "p = 0.5, n = 2",
        output: "6.0000",
        explanation:
          "This is the classic expected-waiting-time-for-a-streak result: the expected number of trades to see 2 consecutive wins with p = 0.5 is 1/p + 1/p^2 = 2 + 4 = 6.",
      },
    ],
    constraints: ["0 < p < 1", "1 <= n <= 60"],
    approach:
      "Model the process as a Markov chain whose state is the current consecutive-win streak length (0 through n, with n absorbing). From streak length i (i < n), one more trade either advances the streak to i+1 with probability p or resets it to 0 with probability (1-p), and you want the expected number of steps to reach state n starting from state 0. Solving the resulting system of hitting-time equations in closed form gives E = sum over k=1..n of (1/p)^k -- each additional required consecutive win multiplies the expected remaining wait by roughly 1/p, which is why this quantity grows fast for p below 0.5 even for a moderate n.",
    code: `def expected_trades_for_streak(p: float, n: int) -> float:
    # closed-form solution of the Markov chain's hitting-time equations:
    # state = current consecutive-win streak (0..n, n absorbing).
    # E = sum_{k=1}^{n} (1/p)^k -- each extra required win multiplies
    # the expected remaining wait by roughly 1/p
    expected = sum((1.0 / p) ** k for k in range(1, n + 1))
    return round(expected, 4)

print(expected_trades_for_streak(0.5, 2))   # 6.0
print(expected_trades_for_streak(0.6, 3))   # 9.0741`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261107-position-tracker-avg-cost",
    title: "Design a Position Tracker With Average Cost Basis and Realized P&L on Partial Closes",
    difficulty: "medium",
    topics: ["design"],
    problem:
      "Design a class PositionTracker supporting buy(qty, price), which adds to a long position using a volume-weighted average cost basis, and sell(qty, price), which reduces the position (never called with qty exceeding the current quantity) and returns the realized P&L from that sell, computed against the position's average cost basis at the time of the sell. Also support current_quantity() and average_cost() (returns None if flat).",
    examples: [
      {
        input: "buy(100, 10.0); buy(100, 12.0); sell(50, 15.0); average_cost(); current_quantity()",
        output: "sell returns 200.0; average_cost() = 11.0; current_quantity() = 150",
        explanation:
          "After both buys, 200 shares sit at a volume-weighted average cost of (100*10 + 100*12) / 200 = 11.0. Selling 50 shares at 15 realizes (15 - 11) * 50 = 200 in P&L. Selling never changes the average cost basis of the remaining shares, so it stays at 11.0 with 150 shares left.",
      },
    ],
    constraints: ["0 < qty, price <= 10^9", "sell is never called with qty exceeding current_quantity()"],
    approach:
      "Track running quantity and average cost directly. On a buy, blend the new lot into the existing basis: new_total_cost = old_qty * old_avg_cost + new_qty * new_price, then divide by the new total quantity. On a sell, compute realized P&L as (sell_price - current_avg_cost) * sell_qty BEFORE reducing quantity, since a sell never changes the average cost of the shares that remain -- only a subsequent buy does. Reset the average cost once quantity hits exactly zero, since a flat position has no meaningful basis until the next buy.",
    code: `class PositionTracker:
    def __init__(self) -> None:
        self._qty = 0
        self._avg_cost = 0.0   # meaningless while _qty == 0

    def buy(self, qty: int, price: float) -> None:
        # volume-weighted average cost: blend the new lot into the existing basis
        total_cost = self._qty * self._avg_cost + qty * price
        self._qty += qty
        self._avg_cost = total_cost / self._qty

    def sell(self, qty: int, price: float) -> float:
        # realized P&L uses the CURRENT average cost basis, computed before
        # quantity shrinks -- selling never changes the remaining avg cost
        realized_pnl = (price - self._avg_cost) * qty
        self._qty -= qty
        if self._qty == 0:
            self._avg_cost = 0.0   # flat: basis is meaningless until the next buy
        return realized_pnl

    def current_quantity(self) -> int:
        return self._qty

    def average_cost(self) -> float | None:
        return self._avg_cost if self._qty > 0 else None

tracker = PositionTracker()
tracker.buy(100, 10.0)
tracker.buy(100, 12.0)
print(tracker.sell(50, 15.0))        # 200.0
print(tracker.average_cost())        # 11.0
print(tracker.current_quantity())    # 150`,
    language: "python",
    complexity: { time: "O(1) per call", space: "O(1)" },
  },
];
