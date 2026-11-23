import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-23
// K-way merge of sorted price ladders (heap), shortest window of
// trades hitting a funding target (sliding window / two pointer),
// at-most-two-trades-with-commission (DP), expected trades until
// a win streak (probability / Markov via linear system), and a
// token-bucket order-rate limiter (design).
// ============================================================

export const financeBatch20261123: LeetCodeProblem[] = [
  {
    id: "lc-20261123-merge-k-sorted-price-ladders",
    title: "Merge K Sorted Price Ladders Into a Single Best-Price Stream",
    difficulty: "hard",
    topics: ["heap", "divide-and-conquer"],
    problem:
      "You receive K separate price-ladder feeds for the same instrument, each already sorted in increasing price order as a list of (price, size) levels from a different venue. Merge all K ladders into one combined, sorted-by-price ladder, aggregating size at any price level that appears in more than one feed.",
    examples: [
      {
        input: "ladders = [[(100,5),(102,3)], [(101,4)], [(100,2),(103,1)]]",
        output: "[(100,7),(101,4),(102,3),(103,1)]",
        explanation:
          "Price 100 appears in feed 1 (size 5) and feed 3 (size 2), so it's aggregated to 7. Prices 101, 102, and 103 each appear in only one feed and pass through unchanged. The result is sorted by price across all feeds combined.",
      },
    ],
    constraints: [
      "1 <= K <= 1000",
      "total levels across all feeds up to 10^5",
      "each feed is sorted ascending by price",
      "prices are positive integers (ticks), sizes are positive integers",
    ],
    approach:
      "Classic k-way merge using a min-heap of size K: push the head element of each non-empty feed (keyed by price, with a feed index and level index to stay unique) onto the heap. Repeatedly pop the smallest price; if it equals the price already at the back of the output, aggregate the size into that same output level instead of starting a new one, otherwise append a new level. After popping a feed's head, push that feed's next element (if any) onto the heap. This processes all N levels across every feed in O(N log K), versus O(N log N) for naively concatenating everything and sorting from scratch, and never holds more than K elements in the heap at once.",
    code: `import heapq


def merge_price_ladders(ladders: list[list[tuple[int, int]]]) -> list[tuple[int, int]]:
    heap = []  # (price, feed_idx, level_idx, size)
    for feed_idx, ladder in enumerate(ladders):
        if ladder:
            price, size = ladder[0]
            heapq.heappush(heap, (price, feed_idx, 0, size))

    merged: list[tuple[int, int]] = []
    while heap:
        price, feed_idx, level_idx, size = heapq.heappop(heap)
        if merged and merged[-1][0] == price:
            # same price as the last output level -- aggregate size instead
            merged[-1] = (price, merged[-1][1] + size)
        else:
            merged.append((price, size))

        next_level_idx = level_idx + 1
        if next_level_idx < len(ladders[feed_idx]):
            next_price, next_size = ladders[feed_idx][next_level_idx]
            heapq.heappush(heap, (next_price, feed_idx, next_level_idx, next_size))

    return merged


print(merge_price_ladders([[(100, 5), (102, 3)], [(101, 4)], [(100, 2), (103, 1)]]))
# [(100, 7), (101, 4), (102, 3), (103, 1)]`,
    language: "python",
    complexity: { time: "O(N log K)", space: "O(K + N)" },
    leetcodeNumber: 23,
  },
  {
    id: "lc-20261123-min-window-notional-funding-target",
    title: "Smallest Window of Trades Whose Total Notional Reaches a Funding Target",
    difficulty: "medium",
    topics: ["sliding-window", "two-pointer"],
    problem:
      "Given a chronological list of trade notional amounts (all strictly positive) and a funding target T, return the length of the shortest contiguous run of trades whose total notional is at least T. Return 0 if no such run exists.",
    examples: [
      {
        input: "notionals = [10, 20, 30, 15, 5], T = 50",
        output: "2",
        explanation:
          "The window [20, 30] sums to exactly 50 and has length 2. [10, 20, 30] also reaches the target but at length 3, which is worse. No length-1 window reaches 50.",
      },
    ],
    constraints: ["1 <= notionals.length <= 10^5", "1 <= notionals[i] <= 10^9", "1 <= T <= 10^15"],
    approach:
      "Because every notional is strictly positive, this is the classic minimum-length-subarray-with-sum-at-least-target two-pointer sweep: expand the window by moving right and adding to a running sum; once the running sum meets the target, shrink from the left as far as possible while it still meets the target, recording the window length at each valid shrink before continuing to expand. Each index enters and leaves the window at most once, giving O(n) overall versus the O(n^2) cost of checking every pair of endpoints directly.",
    code: `def shortest_window_hitting_target(notionals: list[int], target: int) -> int:
    left = 0
    running_sum = 0
    best = None  # smallest qualifying window length found so far

    for right, notional in enumerate(notionals):
        running_sum += notional
        # shrink from the left as long as we still meet the target
        while running_sum >= target:
            window_len = right - left + 1
            best = window_len if best is None else min(best, window_len)
            running_sum -= notionals[left]
            left += 1

    return best if best is not None else 0


print(shortest_window_hitting_target([10, 20, 30, 15, 5], 50))
# 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 209,
  },
  {
    id: "lc-20261123-two-trades-with-commission",
    title: "Maximum Profit With At Most Two Trades and a Flat Commission Per Trade",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for a single stock and a flat commission C charged on every sell, you may complete at most two buy-then-sell round trips (you must sell before buying again). Return the maximum total profit net of commissions.",
    examples: [
      {
        input: "prices = [3, 8, 2, 9, 1, 10], C = 2",
        output: "12",
        explanation:
          "Buy at index 2 (price 2), sell at index 3 (price 9): profit 7 - 2 = 5. Buy at index 4 (price 1), sell at index 5 (price 10): profit 9 - 2 = 7. Total: 5 + 7 = 12, which beats any other pair of non-overlapping trades or a single trade across the whole range.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^4", "0 <= C <= 10^4"],
    approach:
      "This is the well-known 'at most k transactions' DP (LeetCode's Best Time to Buy and Sell Stock IV) with k = 2, extended with a flat commission subtracted at each sell. Track, for each of the two transaction slots, the best achievable net worth if currently holding one share having just bought into that slot (buy_j), and the best achievable profit if currently holding no shares having completed that slot's sell (sell_j). Sweep once through prices updating buy_1, sell_1, buy_2, sell_2 in order each day: buy_j = max(buy_j, sell_(j-1) - price), sell_j = max(sell_j, buy_j + price - commission). The commission is subtracted once per completed round trip, exactly at the sell update. The final answer is sell_2. One pass, O(n) time, O(1) extra state since only two transaction slots are tracked.",
    code: `def max_profit_two_trades(prices: list[int], commission: int) -> int:
    neg_inf = float("-inf")
    buy1 = buy2 = neg_inf   # best net worth after buying for trade 1 / trade 2
    sell1 = sell2 = 0       # best profit after completing trade 1 / trade 2

    for price in prices:
        buy1 = max(buy1, -price)                       # first buy, no prior profit to fund it
        sell1 = max(sell1, buy1 + price - commission)   # commission charged on the sell
        buy2 = max(buy2, sell1 - price)                 # second buy, funded by trade 1's profit
        sell2 = max(sell2, buy2 + price - commission)

    return max(sell2, 0)


print(max_profit_two_trades([3, 8, 2, 9, 1, 10], 2))
# 12`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 123,
  },
  {
    id: "lc-20261123-expected-trades-until-three-consecutive-wins",
    title: "Expected Number of Trades Until Three Consecutive Profitable Trades",
    difficulty: "hard",
    topics: ["probability", "markov-chain", "math"],
    problem:
      "A trader's individual trades are independently profitable with probability p (and unprofitable with probability 1-p). Trading continues until the trader has produced three CONSECUTIVE profitable trades in a row (the streak resets to zero on any loss). Given p, return the expected number of trades needed.",
    examples: [
      {
        input: "p = 0.5",
        output: "14.0",
        explanation:
          "This is the well-known 'expected number of coin flips until three heads in a row' result for a fair coin, reframed as trades: the expected number needed is 14.",
      },
    ],
    constraints: ["0 < p < 1, p given as a float", "return the answer as a float"],
    approach:
      "Model this as an absorbing Markov chain with states 0, 1, 2 representing the current win streak length (state 3 is absorbing: three in a row achieved). Let E_i be the expected number of ADDITIONAL trades needed starting from streak state i. From state i < 3, one more trade either extends the streak to i+1 with probability p, or resets it to streak 0 with probability (1-p): E_i = 1 + p * E_(i+1) + (1-p) * E_0, with E_3 = 0 (and E_0 appearing on the right-hand side of every equation, since any loss resets all the way to streak zero). Rather than deriving the closed form by hand under interview pressure, set up and solve the small linear system directly; it generalizes immediately to any target streak length.",
    code: `import numpy as np


def expected_trades_until_streak(p: float, streak_target: int = 3) -> float:
    # states 0..streak_target-1 are transient; solve E_i = 1 + p*E_(i+1) + (1-p)*E_0
    # as a linear system A @ E = b, with E_target implicitly 0
    n = streak_target
    a = np.zeros((n, n))
    b = np.full(n, -1.0)  # move the "+1" to the right-hand side

    for i in range(n):
        a[i, i] += 1.0           # E_i term
        a[i, 0] -= (1 - p)       # -(1-p) * E_0 term (reset on a loss)
        if i + 1 < n:
            a[i, i + 1] -= p     # -p * E_(i+1) term
        # if i+1 == n, that term is p * E_target = p * 0, contributes nothing

    e = np.linalg.solve(a, b)
    return e[0]  # expected trades starting from streak 0


print(round(expected_trades_until_streak(0.5), 2))
# 14.0`,
    language: "python",
    complexity: { time: "O(k^3) to solve the k x k linear system", space: "O(k^2)" },
  },
  {
    id: "lc-20261123-design-token-bucket-order-limiter",
    title: "Design a Token-Bucket Rate Limiter for Outgoing Orders",
    difficulty: "medium",
    topics: ["design", "sliding-window"],
    problem:
      "Design an order-throttling structure that allows at most N outgoing orders in any trailing window of W seconds, the way exchanges commonly enforce an order-rate limit. allow(timestamp) is called once per prospective order attempt in non-decreasing timestamp order and returns True if the order is allowed to proceed (and counts against the limit) or False if it must be rejected.",
    examples: [
      {
        input: "N = 3, W = 10; allow(0), allow(2), allow(3), allow(5), allow(11)",
        output: "[True, True, True, False, True]",
        explanation:
          "The first three orders (t=0,2,3) all land in the window and are allowed, filling the limit. At t=5 the trailing 10s window is [-5, 5], which still contains all three earlier orders, so this 4th attempt is rejected. By t=11 the window is [1, 11], which no longer contains the order at t=0 -- only t=2 and t=3 remain in-window, so there's room and the order at t=11 is allowed.",
      },
    ],
    constraints: [
      "up to 10^5 calls to allow",
      "timestamps are non-decreasing across calls",
      "1 <= N <= 10^4",
      "1 <= W <= 10^6",
    ],
    approach:
      "Keep a deque of timestamps of ORDERS THAT WERE ALLOWED (not every attempt) within the trailing window. On each call, first evict from the front any allowed-order timestamp at or before (timestamp - W). Then if the deque's size is still below N, allow this order (append its timestamp) and return True; otherwise reject and return False. Because only allowed orders ever enter the deque and each one is evicted exactly once over its lifetime, both the eviction step and the admission check are amortized O(1) per call.",
    code: `from collections import deque


class OrderRateLimiter:
    def __init__(self, max_orders: int, window_seconds: float) -> None:
        self.max_orders = max_orders
        self.window = window_seconds
        self.allowed_timestamps: deque[float] = deque()  # only ALLOWED orders

    def allow(self, timestamp: float) -> bool:
        cutoff = timestamp - self.window
        while self.allowed_timestamps and self.allowed_timestamps[0] <= cutoff:
            self.allowed_timestamps.popleft()

        if len(self.allowed_timestamps) < self.max_orders:
            self.allowed_timestamps.append(timestamp)
            return True
        return False


limiter = OrderRateLimiter(max_orders=3, window_seconds=10)
print([limiter.allow(t) for t in [0, 2, 3, 5, 11]])
# [True, True, True, False, True]`,
    language: "python",
    complexity: { time: "O(1) amortized per call", space: "O(N)" },
  },
];
