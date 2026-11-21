import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-21
// Running median of a streaming price feed (two heaps), the
// longest window with at most K distinct tickers traded
// (sliding window / hash map), best time to buy and sell a
// stock with a mandatory cooldown day (stock DP with three
// states), the expected number of trading days until a streak
// of K consecutive down-days first appears (absorbing Markov
// chain / expected value), and a minimal price-time priority
// limit order book matching engine (design).
// ============================================================

export const financeBatch20261121: LeetCodeProblem[] = [
  {
    id: "lc-20261121-running-median-price-stream",
    title: "Running Median of a Streaming Price Feed",
    difficulty: "hard",
    topics: ["heap"],
    problem:
      "Prices arrive one at a time from a live feed. After each new price, report the median of all prices seen so far.",
    examples: [
      {
        input: "prices = [5, 10, 2, 8]",
        output: "[5, 7.5, 5, 6.5]",
        explanation:
          "After [5] the median is 5. After [5, 10] it's the average of the two middle values, 7.5. After [5, 10, 2] (sorted [2,5,10]) it's 5. After [5, 10, 2, 8] (sorted [2,5,8,10]) it's the average of the two middle values, 6.5.",
      },
    ],
    constraints: ["1 <= number of prices <= 10^5", "-10^6 <= price <= 10^6"],
    approach:
      "Re-sorting the whole list after every new price is O(n log n) per insert. Instead, split the data into two heaps: a max-heap holding the smaller half of the values seen so far, and a min-heap holding the larger half, kept balanced so their sizes never differ by more than one. On each new price, push it into whichever heap is appropriate based on comparing it to the max-heap's top, then rebalance by moving one element across if the size invariant breaks. The median is always derivable in O(1) from the two heap tops: either the max-heap's top alone (odd total count) or the average of both tops (even total count). Each insert is O(log n) instead of O(n log n), since a heap push/pop is logarithmic and nothing else touches the full dataset.",
    code: `import heapq


class RunningMedian:
    def __init__(self) -> None:
        self.small: list[int] = []   # max-heap (negated), holds the lower half
        self.large: list[int] = []   # min-heap, holds the upper half

    def add(self, price: int) -> float:
        # route the new price to the correct half, then rebalance
        if not self.small or price <= -self.small[0]:
            heapq.heappush(self.small, -price)
        else:
            heapq.heappush(self.large, price)

        if len(self.small) > len(self.large) + 1:
            heapq.heappush(self.large, -heapq.heappop(self.small))
        elif len(self.large) > len(self.small):
            heapq.heappush(self.small, -heapq.heappop(self.large))

        if len(self.small) > len(self.large):
            return float(-self.small[0])
        return (-self.small[0] + self.large[0]) / 2.0


tracker = RunningMedian()
print([tracker.add(p) for p in [5, 10, 2, 8]])
# [5.0, 7.5, 5.0, 6.5]`,
    language: "python",
    complexity: { time: "O(log n) per insert, O(1) per median query", space: "O(n)" },
    leetcodeNumber: 295,
  },
  {
    id: "lc-20261121-longest-window-at-most-k-distinct-tickers",
    title: "Longest Window Of Trades With At Most K Distinct Tickers",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a chronological list of ticker symbols traded (one per trade) and an integer K, return the length of the longest contiguous run of trades that touches at most K distinct tickers.",
    examples: [
      {
        input: 'tickers = ["AAPL", "MSFT", "AAPL", "GOOG", "AAPL"], K = 2',
        output: "3",
        explanation:
          'The window ["AAPL", "MSFT", "AAPL"] uses only 2 distinct tickers (AAPL, MSFT) and has length 3. Extending it to include GOOG would introduce a third distinct ticker, breaking the K=2 limit.',
      },
    ],
    constraints: ["1 <= tickers.length <= 10^5", "1 <= K <= 10^5"],
    approach:
      "Maintain a sliding window [left, right] and a hash map counting occurrences of each ticker currently inside it. Expand right one trade at a time, incrementing that ticker's count in the map. Whenever the map holds more than K distinct keys, shrink from the left, decrementing counts and deleting any ticker whose count drops to zero, until the distinct-key count is back at or under K. Track the best (right - left + 1) seen at every step. Each trade enters and leaves the window at most once, so the whole scan is amortized O(n) despite the nested-looking shrink step.",
    code: `def longest_window_k_distinct(tickers: list[str], k: int) -> int:
    counts: dict[str, int] = {}
    left = 0
    best = 0

    for right, ticker in enumerate(tickers):
        counts[ticker] = counts.get(ticker, 0) + 1

        while len(counts) > k:
            left_ticker = tickers[left]
            counts[left_ticker] -= 1
            if counts[left_ticker] == 0:
                del counts[left_ticker]
            left += 1

        best = max(best, right - left + 1)

    return best


print(longest_window_k_distinct(["AAPL", "MSFT", "AAPL", "GOOG", "AAPL"], 2))
# 3`,
    language: "python",
    complexity: { time: "O(n) amortized", space: "O(K)" },
  },
  {
    id: "lc-20261121-stock-with-cooldown",
    title: "Best Time to Buy and Sell Stock With a Mandatory Cooldown Day",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices, you may buy and sell as many times as you like (one share at a time), but after you sell you must wait one full day before you're allowed to buy again. Return the maximum total profit.",
    examples: [
      {
        input: "prices = [1, 2, 3, 0, 2]",
        output: "3",
        explanation:
          "Buy at 1, sell at 3 (profit 2), cooldown on the day priced 0, then buy at 0, sell at 2 (profit 2) -- wait, that double counts the cooldown day as both end of cooldown and buy day, which is allowed; total profit is 3: buy day0(1)->sell day2(3) profit 2, cooldown day3, buy day3(0)->sell day4(2) profit 2 is actually 4, but the cooldown after selling on day2 blocks buying on day3, so the actual best is buy day0 sell day2 (profit 2) then cooldown day3 then buy day4 is too late to sell -- the true optimal path for this classic input is profit 3, via hold through to day2, sell, cooldown, and a smaller second trade is not better than holding one position; the DP recurrence below finds this exactly.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000", "0 <= prices[i] <= 1000"],
    approach:
      "Track three running states day by day instead of enumerating trade sequences: held = best profit ending today while holding a share, sold = best profit ending today having just sold (so tomorrow is forced cooldown), and rest = best profit ending today holding nothing and free to buy tomorrow. held transitions from staying held, or buying today out of yesterday's rest (never out of yesterday's sold, since that would skip the cooldown). sold transitions only from selling what was held yesterday. rest transitions from staying in rest, or from yesterday's sold now finishing its cooldown. Carrying forward just these three numbers gives O(n) time and O(1) space while correctly enforcing the one-day cooldown.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    held = -prices[0]   # holding a share, bought today or earlier
    sold = 0             # just sold today -- tomorrow is forced cooldown
    rest = 0             # holding nothing, free to buy tomorrow

    for price in prices[1:]:
        prev_held, prev_sold, prev_rest = held, sold, rest
        held = max(prev_held, prev_rest - price)   # buy only out of REST, never SOLD
        sold = prev_held + price                    # sell what was held yesterday
        rest = max(prev_rest, prev_sold)             # cooldown day completes into rest

    return max(sold, rest)   # ending holding a share is never optimal


print(max_profit_with_cooldown([1, 2, 3, 0, 2]))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 309,
  },
  {
    id: "lc-20261121-expected-days-until-k-down-streak",
    title: "Expected Number of Trading Days Until a Streak of K Consecutive Down-Days First Appears",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "Each trading day is independently a down-day with probability p (and an up-day otherwise). Return the expected number of days until the first time a run of K consecutive down-days has occurred.",
    examples: [
      {
        input: "K = 2, p = 0.5",
        output: "6.0",
        explanation:
          "This is the classic expected-waiting-time-for-a-run result: for K=2 and p=0.5 the expected number of days until two consecutive down-days first appear is 6, matching the closed form sum_{i=1}^{K} (1/p)^i.",
      },
    ],
    constraints: ["1 <= K <= 10^5", "0 < p < 1"],
    approach:
      "Model this as an absorbing Markov chain with states 0..K, where state j means 'the current trailing run of down-days has length j and a K-streak has not yet occurred,' and state K is absorbing (the streak has happened). Let E[j] be the expected number of ADDITIONAL days needed starting from state j. From state j < K, one more day passes (+1), and with probability p you advance to state j+1 while with probability (1-p) you reset to state 0: E[j] = 1 + p*E[j+1] + (1-p)*E[0], with E[K] = 0. This gives K+1 linear equations in K+1 unknowns (E[0]..E[K-1], plus E[K]=0), solvable in closed form by back-substituting from E[K-1] down to E[0], or numerically by setting up and solving the small linear system directly -- both run in O(K) time, far better than any direct simulation-based estimate.",
    code: `def expected_days_until_k_streak(k: int, p: float) -> float:
    # E[j] = expected additional days from "current run length j, no streak yet"
    # E[j] = 1 + p * E[j+1] + (1-p) * E[0],  E[k] = 0
    # Solve by expressing every E[j] as a linear function of E[0]: E[j] = a[j] + b[j]*E[0]
    a = [0.0] * (k + 1)
    b = [0.0] * (k + 1)
    a[k] = 0.0
    b[k] = 0.0

    for j in range(k - 1, -1, -1):
        # E[j] = 1 + p*(a[j+1] + b[j+1]*E0) + (1-p)*E0
        a[j] = 1 + p * a[j + 1]
        b[j] = p * b[j + 1] + (1 - p)

    # E[0] = a[0] + b[0]*E[0]  ->  E[0]*(1 - b[0]) = a[0]
    e0 = a[0] / (1 - b[0])
    return e0


print(round(expected_days_until_k_streak(2, 0.5), 4))
# 6.0`,
    language: "python",
    complexity: { time: "O(K)", space: "O(K)" },
  },
  {
    id: "lc-20261121-design-limit-order-book",
    title: "Design a Price-Time Priority Limit Order Book",
    difficulty: "hard",
    topics: ["design"],
    problem:
      "Design a matching engine for a single instrument. add_order(order_id, side, price, size) submits a limit order that matches immediately against any crossing resting orders on the opposite side (best price first, then earliest order at that price), resting any unfilled remainder; cancel(order_id) removes a resting order. Return the list of (resting_order_id, fill_size) fills produced by each add_order call.",
    examples: [
      {
        input: 'add_order("s1", "sell", 101, 5); add_order("b1", "buy", 101, 3)',
        output: "[], [(\"s1\", 3)]",
        explanation:
          "The sell rests with no opposite-side liquidity to match. The buy at 101 crosses the resting sell at 101: it fills 3 shares against s1 (which has 5 resting, so 2 remain resting afterward), and the buy order is fully filled with nothing left to rest.",
      },
    ],
    constraints: ["up to 10^5 total add_order/cancel calls", "1 <= price, size <= 10^9"],
    approach:
      "Keep two price-sorted structures, one per side: resting sells in a min-heap keyed by (price, sequence_number) so the lowest price and, within a price, the earliest order, surfaces first; resting buys the same way in a max-heap (negate price, keep sequence ascending). A sequence counter gives strict time priority as the tiebreak within a price level. On add_order, repeatedly peek the best resting order on the OPPOSITE side: while it exists, its price crosses the incoming order's price, and the incoming order still has size left, match the smaller of the two remaining sizes as a fill, decrement both sides' remaining size, and pop the opposite-side order if it's now fully filled. Once nothing more matches, rest whatever size remains of the incoming order on its own side. cancel marks an order_id dead in a side table so a lazily-popped stale heap entry is skipped rather than matched, avoiding an O(n) heap search on every cancel.",
    code: `import heapq
from itertools import count


class LimitOrderBook:
    def __init__(self) -> None:
        self._seq = count()
        self.sells: list[tuple[int, int, str]] = []   # (price, seq, order_id) min-heap
        self.buys: list[tuple[int, int, str]] = []     # (-price, seq, order_id) max-heap
        self.remaining: dict[str, int] = {}
        self.side_of: dict[str, str] = {}
        self.price_of: dict[str, int] = {}

    def _book(self, side: str) -> list:
        return self.sells if side == "sell" else self.buys

    def _opposite_crosses(self, side: str, price: int, opp_price: int) -> bool:
        return opp_price <= price if side == "buy" else opp_price >= price

    def add_order(self, order_id: str, side: str, price: int, size: int):
        fills = []
        opposite = self.sells if side == "buy" else self.buys

        while opposite and size > 0:
            opp_price_key, opp_seq, opp_id = opposite[0]
            opp_price = -opp_price_key if side == "buy" else opp_price_key
            if opp_id not in self.remaining:   # stale/cancelled -- lazily discard
                heapq.heappop(opposite)
                continue
            if not self._opposite_crosses(side, price, opp_price):
                break

            fill = min(size, self.remaining[opp_id])
            fills.append((opp_id, fill))
            size -= fill
            self.remaining[opp_id] -= fill
            if self.remaining[opp_id] == 0:
                del self.remaining[opp_id]
                heapq.heappop(opposite)

        if size > 0:
            self.remaining[order_id] = size
            self.side_of[order_id] = side
            self.price_of[order_id] = price
            key = -price if side == "buy" else price
            heapq.heappush(self._book(side), (key, next(self._seq), order_id))

        return fills

    def cancel(self, order_id: str) -> None:
        self.remaining.pop(order_id, None)   # stale heap entry skipped lazily later


book = LimitOrderBook()
print(book.add_order("s1", "sell", 101, 5))   # []
print(book.add_order("b1", "buy", 101, 3))    # [("s1", 3)]`,
    language: "python",
    complexity: { time: "O(log n) amortized per add_order, O(1) per cancel", space: "O(n)" },
  },
];
