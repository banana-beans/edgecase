import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-06
// Top-K most active tickers from a streaming trade tape (heap),
// the longest window of trades under a participation volume cap
// (sliding window), max profit with at most K transactions (DP
// stock variant), expected time to flatten a mean-reverting
// random-walk position (Markov / gambler's ruin duration), and a
// token-bucket rate limiter for order submission (design).
// ============================================================

export const financeBatch20261006: LeetCodeProblem[] = [
  {
    id: "lc-20261006-top-k-active-tickers-stream",
    title: "Top K Most Active Tickers in a Streaming Trade Tape",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Design a class ActivityTracker with record(ticker) that ingests one trade event at a time for a ticker, and top_k(k) that returns the k tickers with the highest trade counts so far, in descending order of count.",
    examples: [
      {
        input:
          'record("AAPL"); record("MSFT"); record("AAPL"); record("GOOG"); top_k(2)',
        output: '["AAPL", "MSFT"]',
        explanation:
          "AAPL has count 2, MSFT and GOOG each have count 1. Among the two count-1 tickers, insertion order (MSFT before GOOG) breaks the tie, so the top 2 by count are AAPL then MSFT.",
      },
    ],
    constraints: ["up to 10^6 calls to record", "k <= number of distinct tickers seen"],
    approach:
      "Maintain a running count per ticker in a hash map, updated in O(1) per record() call -- no heap work happens on the hot ingestion path at all. top_k(k) is called far less often than record(), so defer the ordering cost to query time: use heapq.nlargest(k, counts.items(), key=count) to do a partial, heap-based selection in roughly O(m log k) where m is the number of distinct tickers, rather than fully sorting every distinct ticker just to read off the top k. This split -- O(1) writes, O(m log k) reads -- matches the actual access pattern of a live tape, where ticks vastly outnumber dashboard refreshes.",
    code: `import heapq
from collections import defaultdict

class ActivityTracker:
    def __init__(self):
        self.counts: dict[str, int] = defaultdict(int)
        self.insertion_order: dict[str, int] = {}
        self._next_order = 0

    def record(self, ticker: str) -> None:
        if ticker not in self.counts:
            self.insertion_order[ticker] = self._next_order
            self._next_order += 1
        self.counts[ticker] += 1  # O(1) -- the hot path stays cheap

    def top_k(self, k: int) -> list[str]:
        # tie-break on earlier insertion order (negated order sorts "earlier" first)
        ranked = heapq.nlargest(
            k,
            self.counts.items(),
            key=lambda item: (item[1], -self.insertion_order[item[0]]),
        )
        return [ticker for ticker, _ in ranked]

tracker = ActivityTracker()
for t in ["AAPL", "MSFT", "AAPL", "GOOG"]:
    tracker.record(t)
print(tracker.top_k(2))
# ["AAPL", "MSFT"]`,
    language: "python",
    complexity: { time: "O(1) per record, O(m log k) per top_k", space: "O(m)" },
  },
  {
    id: "lc-20261006-longest-window-under-participation-cap",
    title: "Longest Contiguous Window of Trades Under a Participation Volume Cap",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a chronological list of trade sizes volumes for one name and a cap max_volume, return the length of the longest contiguous subarray whose SUM of volumes does not exceed max_volume. Assume every individual volume is itself <= max_volume.",
    examples: [
      {
        input: "volumes=[200,300,100,400,100], max_volume=600",
        output: "3",
        explanation:
          "The window [300,100,400] sums to 800, too high. The window [100,400,100] (indices 2-4) sums to 600, exactly at the cap, and has length 3 -- no longer valid window exists.",
      },
    ],
    constraints: ["1 <= volumes.length <= 10^5", "every volumes[i] <= max_volume"],
    approach:
      "Classic variable-length sliding window: expand right, adding each new volume to a running window sum. Whenever the running sum exceeds max_volume, shrink from the left -- subtracting volumes[left] and incrementing left -- until the sum is back within the cap; since every individual volume is guaranteed <= max_volume, this shrink loop always terminates at a valid (possibly single-element) window rather than ever needing to skip past a value it can't fit. Track the best (longest) window length seen after each right-pointer step. Both pointers only move forward, so the whole pass is O(n) despite the nested-looking while loop, because the inner loop's total iterations across the whole run are bounded by n.",
    code: `def longest_window_under_cap(volumes: list[int], max_volume: int) -> int:
    left = 0
    window_sum = 0
    best = 0

    for right, vol in enumerate(volumes):
        window_sum += vol
        while window_sum > max_volume:
            window_sum -= volumes[left]
            left += 1
        best = max(best, right - left + 1)

    return best

print(longest_window_under_cap([200, 300, 100, 400, 100], 600))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261006-max-profit-at-most-k-transactions",
    title: "Maximum Profit With At Most K Buy/Sell Transactions",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for a stock and an integer k, return the maximum profit achievable using at most k buy-then-sell transactions (never holding more than one share at a time, and a sale must happen before the next buy).",
    examples: [
      {
        input: "k=2, prices=[3,2,6,5,0,3]",
        output: "7",
        explanation:
          "Buy at index 1 (price 2), sell at index 2 (price 6) for profit 4. Buy at index 4 (price 0), sell at index 5 (price 3) for profit 3. Total profit using 2 transactions: 4 + 3 = 7, and no combination of at most 2 transactions beats that.",
      },
    ],
    constraints: ["0 <= k <= 100", "1 <= prices.length <= 1000"],
    approach:
      "Two-dimensional DP indexed by (transaction number, holding state). hold[j] is the best profit achievable having completed at most j-1 full transactions and currently holding a share bought during transaction j; cash[j] is the best profit having completed at most j full transactions and currently not holding anything. Transitions per day, for each j from 1 to k: hold[j] = max(hold[j], cash[j-1] - price) (keep holding, or buy today to start transaction j funded from having finished j-1 transactions), and cash[j] = max(cash[j], hold[j] + price) (stay flat, or sell today to complete transaction j). Iterating j in increasing order within the same day lets cash[j-1] already reflect today's price when used to update hold[j], which is intentional -- it allows a buy and an immediately-prior sell to both execute 'on' the same day without an extra day of delay, matching the problem's same-day buy-after-sell convention. When k is large enough to never bind (k >= n/2), this degenerates to the unlimited-transactions greedy of just summing positive day-over-day deltas.",
    code: `def max_profit_k_transactions(k: int, prices: list[int]) -> int:
    n = len(prices)
    if n < 2 or k == 0:
        return 0

    # k unbounded in effect once it covers every possible alternating move
    if k >= n // 2:
        return sum(max(0, prices[i] - prices[i - 1]) for i in range(1, n))

    hold = [float("-inf")] * (k + 1)  # holding a share, j transactions started
    cash = [0] * (k + 1)               # flat, j transactions completed

    for price in prices:
        for j in range(1, k + 1):
            hold[j] = max(hold[j], cash[j - 1] - price)
            cash[j] = max(cash[j], hold[j] + price)

    return cash[k]

print(max_profit_k_transactions(2, [3, 2, 6, 5, 0, 3]))
# 7`,
    language: "python",
    complexity: { time: "O(n*k)", space: "O(k)" },
  },
  {
    id: "lc-20261006-expected-ticks-to-flatten-position",
    title: "Expected Number of Ticks to Flatten a Mean-Reverting Random-Walk Position",
    difficulty: "medium",
    topics: ["probability", "math"],
    problem:
      "A trader's inventory starts at i lots (0 < i < N) and changes by +1 or -1 each tick with equal probability 0.5 each, independent across ticks. The position is flattened the instant it hits either boundary, 0 or N. Return the expected number of ticks until the position hits one boundary or the other.",
    examples: [
      {
        input: "i=2, N=5",
        output: "6.0",
        explanation:
          "For a fair (p=0.5) random walk between absorbing barriers 0 and N, the expected number of steps to absorption starting from i is exactly i*(N-i). With i=2, N=5, that's 2*3 = 6.0 ticks on average.",
      },
    ],
    constraints: ["0 < i < N", "N <= 10^6"],
    approach:
      "Let E(i) be the expected number of ticks to absorption starting from state i. Conditioning on the first step: E(i) = 1 + 0.5*E(i-1) + 0.5*E(i+1), with boundary conditions E(0) = E(N) = 0 (already absorbed, zero additional ticks needed). This is a second-order linear recurrence with a particular solution that's quadratic in i rather than linear, because the '+1' on the right side (one tick always elapses) accumulates differently than the ruin-probability recurrence's purely averaging relationship. Substituting E(i) = i*(N-i) into the recurrence and checking it satisfies both the boundary conditions and the one-step relation confirms the closed form directly, without needing to solve the recurrence from scratch by hand.",
    code: `def expected_ticks_to_flatten(i: int, n: int) -> float:
    # fair (p=0.5) random walk between absorbing barriers: E(i) = i * (N - i)
    return float(i * (n - i))

print(expected_ticks_to_flatten(2, 5))
# 6.0

# sanity check against Monte Carlo simulation of the actual random walk
import random

def simulate_ticks_to_flatten(i: int, n: int) -> int:
    pos = i
    ticks = 0
    while 0 < pos < n:
        pos += 1 if random.random() < 0.5 else -1
        ticks += 1
    return ticks

random.seed(0)
trials = [simulate_ticks_to_flatten(2, 5) for _ in range(20000)]
print(round(sum(trials) / len(trials), 1))  # lands close to 6.0`,
    language: "python",
    complexity: { time: "O(1) via the closed form", space: "O(1)" },
  },
  {
    id: "lc-20261006-token-bucket-order-rate-limiter",
    title: "Design a Token-Bucket Rate Limiter for Order Submission",
    difficulty: "medium",
    topics: ["design"],
    problem:
      "Design a class RateLimiter(capacity, refill_rate) with allow(timestamp) that returns True and consumes one token if a token is available at that timestamp, or False otherwise. Tokens refill continuously at refill_rate tokens per second, up to capacity, and timestamps arrive as monotonically non-decreasing floats (seconds).",
    examples: [
      {
        input:
          "RateLimiter(capacity=3, refill_rate=1); allow(0.0)x3; allow(0.1); allow(1.1)",
        output: "True, True, True, False, True",
        explanation:
          "Bucket starts full at 3 tokens. Three calls at t=0.0 drain it to 0. At t=0.1, only 0.1 tokens have refilled (not enough for a whole token), so the 4th call is rejected. By t=1.1, a full second has passed since the bucket hit 0, refilling exactly 1 token, so the 5th call succeeds.",
      },
    ],
    constraints: ["capacity > 0", "refill_rate > 0", "timestamps non-decreasing across calls"],
    approach:
      "Store a fractional token count and the timestamp of the last update, rather than scheduling discrete refill events -- this avoids any timer or background thread. On each allow(timestamp) call, first compute elapsed time since the last update, add elapsed * refill_rate tokens (capped at capacity), then update last_update to the current timestamp. If at least one token is now available, subtract one and return True; otherwise return False with the bucket left at its current (possibly fractional) level. Because refill is computed lazily from elapsed time rather than on a schedule, the limiter needs no polling and handles arbitrarily long gaps between calls correctly -- a one-hour gap just means a correspondingly large elapsed * refill_rate top-up, naturally capped at capacity.",
    code: `class RateLimiter:
    def __init__(self, capacity: float, refill_rate: float):
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.tokens = capacity          # bucket starts full
        self.last_update = 0.0

    def allow(self, timestamp: float) -> bool:
        elapsed = timestamp - self.last_update
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_update = timestamp

        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True
        return False

limiter = RateLimiter(capacity=3, refill_rate=1)
print(limiter.allow(0.0))  # True  (3 -> 2)
print(limiter.allow(0.0))  # True  (2 -> 1)
print(limiter.allow(0.0))  # True  (1 -> 0)
print(limiter.allow(0.1))  # False (0 + 0.1 refill = 0.1, not enough)
print(limiter.allow(1.1))  # True  (0.1 + 1.0 refill = 1.1 -> 0.1)`,
    language: "python",
    complexity: { time: "O(1) per allow", space: "O(1)" },
  },
];
