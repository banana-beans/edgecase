import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-04
// Sliding-window median of trade prices (heap/sorted structure),
// longest window touching at most K venues (sliding window with
// a distinct-count constraint), max profit with both a K-transaction
// cap AND a cooldown day combined (DP stock variant), the stationary
// distribution of a three-regime market model (probability/Markov,
// linear-algebra companion to prior batches' absorption problems),
// and a per-client VWAP aggregator with a daily reset (design).
// ============================================================

export const financeBatch20261104: LeetCodeProblem[] = [
  {
    id: "lc-20261104-sliding-window-median-trade-prices",
    title: "Sliding-Window Median of Trade Prices",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given an array of trade prices and a window size k, return an array containing the median price of every contiguous window of length k as the window slides from the start of the array to the end, one trade at a time. For an even-sized window, the median is the average of the two middle values.",
    examples: [
      {
        input: "prices = [2, 4, 1, 7, 5, 3, 6, 8], k = 3",
        output: "[2, 4, 5, 5, 5, 6]",
        explanation:
          "Windows are [2,4,1]->median 2, [4,1,7]->median 4, [1,7,5]->median 5, [7,5,3]->median 5, [5,3,6]->median 5, [3,6,8]->median 6.",
      },
    ],
    constraints: ["1 <= k <= prices.length <= 10^5", "prices[i] fits in a double"],
    approach:
      "Maintain a sorted copy of the current window and use bisect to keep it sorted as the window slides: bisect_left finds the leaving element's position in O(log k), list.pop removes it, and bisect.insort finds-and-inserts the entering element, also in O(log k) search but O(k) for the underlying array shift. That makes each step O(k) overall, for O(n*k) total -- fine for a window that's small relative to the feed, and far simpler to get right than the fully optimal two-balanced-heaps-with-lazy-deletion technique, which achieves O(log k) per step but needs careful bookkeeping to avoid corrupting the heap invariants on removal (heaps don't support an O(log k) delete-by-value natively). Reaching for the heap version is the right call only once profiling shows the simpler bisect approach is actually the bottleneck.",
    code: `import bisect

def median_sliding_window(prices: list[float], k: int) -> list[float]:
    window = sorted(prices[:k])
    medians: list[float] = []

    def median_of(w: list[float]) -> float:
        mid = len(w) // 2
        return w[mid] if k % 2 else (w[mid - 1] + w[mid]) / 2

    medians.append(median_of(window))
    for i in range(k, len(prices)):
        # the price leaving the window on the left, and the one entering on the right
        leaving_idx = bisect.bisect_left(window, prices[i - k])
        window.pop(leaving_idx)
        bisect.insort(window, prices[i])
        medians.append(median_of(window))

    return medians

print(median_sliding_window([2, 4, 1, 7, 5, 3, 6, 8], 3))
# [2, 4, 5, 5, 5, 6]`,
    language: "python",
    complexity: { time: "O(n*k) with the bisect-based list; O(n log k) with balanced heaps and lazy deletion", space: "O(k)" },
  },
  {
    id: "lc-20261104-longest-window-at-most-k-venues",
    title: "Longest Window of Trades Touching At Most K Venues",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given an array of venue codes, one per trade print in chronological order, and an integer k, return the length of the longest contiguous window of trades that touches at most k distinct venues.",
    examples: [
      {
        input: 'venues = ["NYSE","NYSE","ARCA","NYSE","IEX","ARCA","ARCA"], k = 2',
        output: "4",
        explanation:
          "The window [NYSE, NYSE, ARCA, NYSE] (indices 0-3) touches only {NYSE, ARCA} -- 2 distinct venues -- and length 4. Extending it to include IEX at index 4 would push distinct venues to 3, violating k.",
      },
    ],
    constraints: ["1 <= venues.length <= 10^5", "1 <= k <= 26"],
    approach:
      "Classic two-pointer 'at most k distinct' sliding window: expand the right edge by one trade at a time, tracking a running count of each venue seen in the current window via a hash map. Whenever the number of distinct keys in that map exceeds k, shrink from the left -- decrementing and evicting the leftmost venue's count -- until the distinct-venue count is back at or under k. Because the right pointer only ever moves forward and the left pointer only ever moves forward (never backward), each index is visited a bounded number of times total, giving linear time despite the nested-looking loop.",
    code: `from collections import defaultdict

def longest_window_at_most_k_venues(venues: list[str], k: int) -> int:
    counts: dict[str, int] = defaultdict(int)
    left = 0
    best = 0

    for right, venue in enumerate(venues):
        counts[venue] += 1
        # shrink from the left until we're back within the distinct-venue budget
        while len(counts) > k:
            left_venue = venues[left]
            counts[left_venue] -= 1
            if counts[left_venue] == 0:
                del counts[left_venue]
            left += 1
        best = max(best, right - left + 1)

    return best

print(longest_window_at_most_k_venues(
    ["NYSE", "NYSE", "ARCA", "NYSE", "IEX", "ARCA", "ARCA"], 2
))
# 4`,
    language: "python",
    complexity: { time: "O(n)", space: "O(k) for the venue count map" },
  },
  {
    id: "lc-20261104-max-profit-k-transactions-cooldown",
    title: "Max Profit With At Most K Transactions and a Cooldown Day After Selling",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given an array of daily prices and an integer k, find the maximum profit achievable with at most k buy-sell transactions, where you may hold at most one share at a time, and after selling you must wait one full day (a cooldown) before you're allowed to buy again.",
    examples: [
      {
        input: "prices = [1, 5, 2, 7], k = 2",
        output: "6",
        explanation:
          "Buying at day 0 (price 1) and holding straight through to sell at day 3 (price 7) nets 6. Taking two smaller round trips instead -- buy day 0 sell day 1 for profit 4, then (after the forced cooldown on day 2) there's no day left to complete a second profitable trade -- only nets 4. The cooldown constraint makes the single long hold the better use of the two available transaction slots.",
      },
    ],
    constraints: ["1 <= prices.length <= 1000", "1 <= k <= 50", "0 <= prices[i] <= 10^4"],
    approach:
      "Extend the classic 'buy-sell with cooldown' three-state machine (hold / just-sold / resting) with a second dimension for the transaction count. hold[i] is the best profit while holding a share counted as part of transaction i; sold[i] is the best profit having just sold to complete transaction i (today's sale, cooldown starts tomorrow); rest[i] is the best profit resting (free to buy) having completed at most i transactions. Each day's hold[i] can only buy using rest[i-1] FROM YESTERDAY (not today, since today's rest/sold haven't been computed yet and a same-day buy-after-sell would violate the cooldown), and rest[i] only becomes available to buy against one day after a sale clears into sold[i]. The snapshot-then-update pattern each iteration avoids accidentally reading a value that's already been overwritten earlier in the same day's loop.",
    code: `def max_profit_k_transactions_cooldown(prices: list[int], k: int) -> int:
    n = len(prices)
    if n < 2 or k == 0:
        return 0
    NEG_INF = float("-inf")
    hold = [NEG_INF] * (k + 1)
    sold = [NEG_INF] * (k + 1)
    rest = [0] * (k + 1)   # rest[0] stays 0 forever -- the "0 completed transactions" baseline

    for price in prices:
        prev_hold, prev_sold, prev_rest = hold[:], sold[:], rest[:]
        for i in range(1, k + 1):
            # buy using proceeds that already cleared cooldown -- YESTERDAY's rest[i-1]
            hold[i] = max(prev_hold[i], prev_rest[i - 1] - price)
            sold[i] = prev_hold[i] + price              # sell today, completing transaction i
            rest[i] = max(prev_rest[i], prev_sold[i])    # yesterday's sale clears cooldown today

    return max(rest[k], sold[k])

print(max_profit_k_transactions_cooldown([1, 5, 2, 7], 2))
# 6`,
    language: "python",
    complexity: { time: "O(n*k)", space: "O(k)" },
  },
  {
    id: "lc-20261104-stationary-distribution-three-regime-market",
    title: "Stationary Distribution of a Three-Regime Market Model",
    difficulty: "medium",
    topics: ["probability"],
    problem:
      "A market is modeled as a Markov chain over three regimes -- risk-on, neutral, and risk-off -- with a given day-to-day transition probability matrix. Compute the long-run stationary distribution: the fraction of days the market spends in each regime over a very long horizon, assuming the chain is irreducible and aperiodic.",
    examples: [
      {
        input:
          "P = [[0.90, 0.08, 0.02], [0.20, 0.60, 0.20], [0.10, 0.30, 0.60]]  (rows/cols ordered risk-on, neutral, risk-off)",
        output: "[0.6173, 0.2346, 0.1481]",
        explanation:
          "Even though risk-off is the 'stickiest' state in isolation (0.60 probability of staying put), the market still spends only ~15% of days there long-run, because it's rarely entered in the first place -- stickiness and long-run frequency are different things.",
      },
    ],
    constraints: ["each row of P sums to 1", "P describes an irreducible, aperiodic chain"],
    approach:
      "The stationary distribution pi is the row vector satisfying pi = pi @ P with sum(pi) == 1, i.e. a left eigenvector of P for eigenvalue 1. Transposing gives (P^T) pi^T = pi^T, i.e. (P^T - I) pi = 0 -- a homogeneous linear system with one redundant equation (because P's rows already sum to 1). Swap one of those redundant rows out for the normalization constraint sum(pi) = 1, then solve the resulting square, well-determined system directly with np.linalg.solve instead of via eigendecomposition, which is overkill and numerically fussier for a state space this small.",
    code: `import numpy as np

def stationary_distribution(P: np.ndarray) -> np.ndarray:
    n = P.shape[0]
    A = P.T - np.eye(n)   # (P^T - I) pi = 0 encodes pi = pi @ P
    A[-1, :] = 1.0        # replace the redundant last equation with the normalization constraint
    b = np.zeros(n)
    b[-1] = 1.0
    return np.linalg.solve(A, b)

P = np.array([
    [0.90, 0.08, 0.02],   # risk-on
    [0.20, 0.60, 0.20],   # neutral
    [0.10, 0.30, 0.60],   # risk-off
])
pi = stationary_distribution(P)
print(np.round(pi, 4))
# [0.6173 0.2346 0.1481]`,
    language: "python",
    complexity: { time: "O(n^3) for the dense linear solve", space: "O(n^2)" },
  },
  {
    id: "lc-20261104-per-client-vwap-aggregator",
    title: "Design a Per-Client VWAP Aggregator With Daily Reset",
    difficulty: "medium",
    topics: ["design"],
    problem:
      "Design a class VwapAggregator supporting record_fill(client_id, price, qty, day), which records one execution for a client on a given trading day, and get_vwap(client_id), which returns that client's volume-weighted average price across all fills recorded so far on the CURRENT trading day. The first fill of a new day (for any client) resets every client's accumulated state, since VWAP is a within-day concept.",
    examples: [
      {
        input:
          'record_fill("A", 100.0, 10, day=1); record_fill("A", 102.0, 5, day=1); get_vwap("A"); record_fill("A", 90.0, 10, day=2); get_vwap("A"); get_vwap("B")',
        output: "100.6667, 90.0, None",
        explanation:
          "A's day-1 VWAP is (100*10 + 102*5) / 15 = 100.6667. The day=2 fill rolls the trading day forward, wiping every client's accumulated totals, so A's day-2 VWAP is just its one fill, 90.0, and B (no fills yet today) has no VWAP to report.",
      },
    ],
    constraints: ["up to 10^5 calls to record_fill and get_vwap combined", "day is a monotonically non-decreasing integer across calls"],
    approach:
      "Track a single running 'current day' value and two per-client accumulators: the running sum of price*qty and the running sum of qty. On record_fill, if the incoming day differs from the tracked current day, treat it as a new trading session -- clear both accumulator maps entirely (VWAP is explicitly a same-day concept, so yesterday's volume must never leak into today's average) and update the tracked day. Then add this fill's contribution to that client's two running sums. get_vwap is just the ratio of the two sums for that client, or None if the client has no fills recorded yet today.",
    code: `class VwapAggregator:
    def __init__(self) -> None:
        self._day: int | None = None
        self._sum_px_qty: dict[str, float] = {}
        self._sum_qty: dict[str, float] = {}

    def record_fill(self, client_id: str, price: float, qty: float, day: int) -> None:
        if day != self._day:
            # a new trading day starts: VWAP never carries volume across session boundaries
            self._day = day
            self._sum_px_qty.clear()
            self._sum_qty.clear()
        self._sum_px_qty[client_id] = self._sum_px_qty.get(client_id, 0.0) + price * qty
        self._sum_qty[client_id] = self._sum_qty.get(client_id, 0.0) + qty

    def get_vwap(self, client_id: str) -> float | None:
        qty = self._sum_qty.get(client_id, 0.0)
        if qty == 0:
            return None
        return self._sum_px_qty[client_id] / qty

agg = VwapAggregator()
agg.record_fill("A", 100.0, 10, day=1)
agg.record_fill("A", 102.0, 5, day=1)
print(round(agg.get_vwap("A"), 4))     # 100.6667
agg.record_fill("A", 90.0, 10, day=2)  # new day -- resets everyone
print(agg.get_vwap("A"))               # 90.0
print(agg.get_vwap("B"))               # None -- no fills today`,
    language: "python",
    complexity: { time: "O(1) per call", space: "O(number of active clients)" },
  },
];
