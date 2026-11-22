import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-22
// Kth largest trade size in a live stream (heap), the longest
// run of trades that stays under a capital limit (sliding
// window), best single buy-sell pair under a mandatory minimum
// holding period (DP / lagged running minimum), the stationary
// distribution of a market-regime Markov chain (probability /
// linear algebra), and a streaming VWAP over a trailing time
// window (design).
// ============================================================

export const financeBatch20261122: LeetCodeProblem[] = [
  {
    id: "lc-20261122-kth-largest-trade-size-stream",
    title: "Kth Largest Trade Size in a Live Stream",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Trade sizes arrive one at a time from a live feed. Design a structure that, after each new trade size arrives, reports the K-th largest trade size seen so far (K is fixed when the structure is created, and the answer is undefined until at least K trades have arrived).",
    examples: [
      {
        input: "k = 3, stream = [5, 10, 2, 8, 1, 9]",
        output: "[None, None, 2, 5, 5, 8]",
        explanation:
          "After [5] and [5, 10] fewer than 3 values have arrived, so there's no 3rd largest yet. After [5, 10, 2] the 3rd largest of {2, 5, 10} is 2. After adding 8, the top 3 are {5, 8, 10} and the 3rd largest is 5. Adding 1 doesn't crack the top 3, so it stays 5. Adding 9 pushes 5 out of the top 3 (now {8, 9, 10}), so the 3rd largest becomes 8.",
      },
    ],
    constraints: [
      "1 <= k <= 10^4",
      "up to 10^5 trade sizes arrive in total",
      "1 <= trade size <= 10^9",
    ],
    approach:
      "Maintain a min-heap that holds exactly the k largest values seen so far; the smallest element in that heap IS the k-th largest overall, by definition of what's in the heap. On each new value: if the heap has fewer than k elements, just push it in (still building up to k). Otherwise, only push the new value if it's larger than the heap's current minimum (the current k-th largest) -- and if you do push, pop the old minimum first, since it's no longer among the top k. Anything smaller than the current k-th largest is irrelevant and gets ignored outright. This keeps the heap at size k at all times once warmed up, so each update is O(log k) instead of resorting everything.",
    code: `import heapq


class KthLargestTradeSize:
    def __init__(self, k: int) -> None:
        self.k = k
        self.heap: list[int] = []   # min-heap holding the k largest values seen so far

    def add(self, size: int) -> int | None:
        if len(self.heap) < self.k:
            heapq.heappush(self.heap, size)
        elif size > self.heap[0]:
            heapq.heapreplace(self.heap, size)   # pop the old k-th largest, push the new one
        # else: size is too small to crack the top k, ignore it

        if len(self.heap) < self.k:
            return None
        return self.heap[0]   # the smallest of the k largest IS the k-th largest


tracker = KthLargestTradeSize(3)
stream = [5, 10, 2, 8, 1, 9]
print([tracker.add(s) for s in stream])
# [None, None, 2, 5, 5, 8]`,
    language: "python",
    complexity: { time: "O(log k) per update", space: "O(k)" },
    leetcodeNumber: 703,
  },
  {
    id: "lc-20261122-longest-window-capital-limit",
    title: "Longest Run of Trades You Could Execute Without Breaching a Capital Limit",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "You're given a chronological list of trade notional amounts (each one strictly positive) you'd need to commit capital to, and a fixed capital limit L. Return the length of the longest contiguous run of trades whose total notional never exceeds L.",
    examples: [
      {
        input: "notionals = [20, 30, 10, 40, 15], L = 60",
        output: "3",
        explanation:
          "The window [20, 30, 10] sums to exactly 60, the limit, and has length 3. No longer contiguous window keeps its running total at or under 60 -- extending it to include 40 pushes the sum to 100.",
      },
    ],
    constraints: [
      "1 <= notionals.length <= 10^5",
      "1 <= notionals[i] <= 10^9",
      "1 <= L <= 10^15",
    ],
    approach:
      "Because every notional is strictly positive, the running sum of a window only grows as the right edge extends and only shrinks as the left edge advances -- there's no sign flip to fight, so a classic variable-length two-pointer sweep applies cleanly. Expand the window by moving right and adding to a running sum; whenever that sum exceeds L, shrink from the left (subtracting as you go) until it's back at or under L. Track the best window length seen at each step. Every index enters and leaves the window at most once, so the whole scan is O(n) despite the nested-looking shrink loop.",
    code: `def longest_run_within_capital(notionals: list[int], limit: int) -> int:
    left = 0
    running_sum = 0
    best = 0

    for right, notional in enumerate(notionals):
        running_sum += notional
        # shrink from the left while committing this run would breach the limit
        while running_sum > limit:
            running_sum -= notionals[left]
            left += 1
        best = max(best, right - left + 1)

    return best


print(longest_run_within_capital([20, 30, 10, 40, 15], 60))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261122-stock-minimum-holding-period",
    title: "Best Time to Buy and Sell Stock Once, With a Mandatory Minimum Holding Period",
    difficulty: "medium",
    topics: ["dynamic-programming", "array"],
    problem:
      "Given daily prices and an integer H, you may buy on at most one day and sell on a single later day, but the sell day's index must be at least H days after the buy day's index. Return the maximum achievable profit, or 0 if no trade meeting the holding requirement is profitable.",
    examples: [
      {
        input: "prices = [7, 1, 5, 3, 6, 4], H = 2",
        output: "5",
        explanation:
          "Buying on day 1 (price 1) and selling on day 4 (price 6) holds for 3 days, which satisfies H = 2, for a profit of 5. No eligible pair (one with a holding period of at least 2 days) does better.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= H < prices.length", "0 <= prices[i] <= 10^4"],
    approach:
      "This is the classic single-pass max-profit sweep, but with the running minimum deliberately lagged by H days so a too-recent buy day can never be paired with the current sell day. Walk the sell day forward from index H; just before evaluating it as a candidate sell day, fold in the price at (sell_day - H) into a running minimum over all buy days that are now eligible. The best profit at each step is the current price minus that lagged running minimum. One pass, O(1) extra state, and the lag structurally enforces the holding-period constraint instead of checking it explicitly.",
    code: `def max_profit_min_hold(prices: list[int], h: int) -> int:
    n = len(prices)
    if h >= n:
        return 0

    # running minimum over buy days that are eligible for the CURRENT sell day
    min_price_so_far = prices[0]
    best_profit = 0

    for sell_day in range(h, n):
        # the newest buy day that becomes eligible once we're considering sell_day
        newly_eligible_buy_day = sell_day - h
        min_price_so_far = min(min_price_so_far, prices[newly_eligible_buy_day])
        best_profit = max(best_profit, prices[sell_day] - min_price_so_far)

    return best_profit


print(max_profit_min_hold([7, 1, 5, 3, 6, 4], 2))
# 5`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261122-stationary-distribution-regime-chain",
    title: "Stationary Distribution of a Market-Regime Markov Chain",
    difficulty: "hard",
    topics: ["probability", "markov-chain", "linear-algebra"],
    problem:
      "A market is modeled as switching day to day between N discrete regimes (e.g. calm, stressed, crisis) according to a given N x N row-stochastic transition matrix, where entry [i][j] is the probability of moving from regime i to regime j in one day. Assuming the chain is irreducible and aperiodic, return its long-run stationary distribution: the probability of being in each regime after an arbitrarily large number of days, independent of the starting regime.",
    examples: [
      {
        input: "transition = [[0.9, 0.1], [0.3, 0.7]]",
        output: "[0.75, 0.25]",
        explanation:
          "Solving pi = pi * transition subject to the probabilities summing to 1 gives pi = [0.75, 0.25]: regime 0 (calm) is visited 3 times as often in the long run as regime 1 (stressed), consistent with it being the much 'stickier' state (0.9 probability of staying).",
      },
    ],
    constraints: [
      "2 <= N <= 50",
      "every row of transition sums to 1 (within floating-point tolerance)",
      "the chain is irreducible and aperiodic",
    ],
    approach:
      "The stationary distribution pi satisfies pi = pi * P -- it's the left eigenvector of the transition matrix for eigenvalue 1, normalized to sum to 1. Rather than solving that (singular) linear system directly, use power iteration: start from any probability vector (uniform is fine) and repeatedly multiply by P. For an irreducible, aperiodic chain, the Perron-Frobenius theorem guarantees this converges to the unique stationary distribution regardless of the starting vector. Renormalizing after each step guards against floating-point drift. With only a handful of regimes, a few thousand iterations converges comfortably.",
    code: `import numpy as np


def stationary_distribution(transition: list[list[float]], iterations: int = 10_000) -> list[float]:
    p = np.array(transition, dtype=float)
    n = p.shape[0]

    # start from a uniform distribution -- any valid starting distribution converges
    # to the same stationary distribution for an irreducible, aperiodic chain
    pi = np.full(n, 1.0 / n)

    for _ in range(iterations):
        pi = pi @ p     # one more day's worth of regime transitions
        pi /= pi.sum()  # renormalize to guard against floating-point drift

    return pi.tolist()


print([round(x, 4) for x in stationary_distribution([[0.9, 0.1], [0.3, 0.7]])])
# [0.75, 0.25]`,
    language: "python",
    complexity: { time: "O(iterations * N^2)", space: "O(N^2)" },
  },
  {
    id: "lc-20261122-design-streaming-vwap",
    title: "Design a Streaming VWAP Over a Trailing Time Window",
    difficulty: "medium",
    topics: ["design", "queue"],
    problem:
      "Design a structure that ingests (timestamp, price, size) trade ticks in increasing timestamp order and supports a query for the volume-weighted average price (VWAP) over the trailing W-second window ending at the most recently ingested tick's timestamp. add_trade(timestamp, price, size) ingests a new tick; vwap() returns the VWAP over that trailing window.",
    examples: [
      {
        input: "W = 10; add_trade(0, 100, 10); add_trade(5, 102, 20); add_trade(12, 101, 30); vwap()",
        output: "101.4",
        explanation:
          "The latest timestamp is 12, so the trailing 10-second window covers [2, 12]. The tick at t=0 falls outside it and is excluded. VWAP over the remaining two ticks is (102*20 + 101*30) / (20 + 30) = 5070 / 50 = 101.4.",
      },
    ],
    constraints: [
      "timestamps strictly increasing across calls to add_trade",
      "up to 10^5 total add_trade calls",
      "1 <= price, size <= 10^9",
      "0 < W <= 10^6",
    ],
    approach:
      "Keep a deque of (timestamp, price, size) ticks in arrival order, plus running sums of notional (price * size) and volume (size) for everything currently sitting in the deque. On every add_trade, append the new tick and fold its contribution into both running sums, then evict from the FRONT of the deque any tick whose timestamp has fallen outside the trailing W-second window relative to the newest timestamp, subtracting each evicted tick's contribution as it leaves. Since every tick enters and leaves the deque exactly once over its lifetime, both add_trade and the eviction step are amortized O(1), and vwap() is then just one division of the two running sums.",
    code: `from collections import deque


class StreamingVWAP:
    def __init__(self, window_seconds: float) -> None:
        self.window = window_seconds
        self.ticks: deque[tuple[float, float, float]] = deque()  # (ts, price, size)
        self.notional_sum = 0.0   # running sum of price * size inside the window
        self.volume_sum = 0.0     # running sum of size inside the window

    def add_trade(self, timestamp: float, price: float, size: float) -> None:
        self.ticks.append((timestamp, price, size))
        self.notional_sum += price * size
        self.volume_sum += size
        self._evict_stale(timestamp)

    def _evict_stale(self, latest_timestamp: float) -> None:
        cutoff = latest_timestamp - self.window
        while self.ticks and self.ticks[0][0] < cutoff:
            ts, price, size = self.ticks.popleft()
            self.notional_sum -= price * size
            self.volume_sum -= size

    def vwap(self) -> float:
        if self.volume_sum == 0:
            return 0.0
        return self.notional_sum / self.volume_sum


book = StreamingVWAP(window_seconds=10)
book.add_trade(0, 100, 10)
book.add_trade(5, 102, 20)
book.add_trade(12, 101, 30)
print(round(book.vwap(), 2))
# 101.4`,
    language: "python",
    complexity: { time: "O(1) amortized per add_trade, O(1) per vwap query", space: "O(n) worst case" },
  },
];
