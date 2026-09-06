import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-06
// A smallest-range heap problem over correlated tickers, a
// distinct-sector sliding window, weighted interval scheduling
// for non-overlapping trade windows, a closed-form biased random
// walk absorption probability, and a token-bucket order-rate
// limiter design problem.
// ============================================================

export const financeBatch20260906: LeetCodeProblem[] = [
  {
    id: "lc-20260906-smallest-range-k-tickers",
    title: "Smallest Price Range Covering a Print From Each of K Correlated Tickers",
    difficulty: "hard",
    topics: ["heap"],
    problem:
      "You have K correlated tickers, each with a sorted array of prices it printed during a matching calibration window (used to check a basket is trading in line). Find the smallest price range [lo, hi] such that at least one printed price from every ticker's array falls inside it.",
    examples: [
      {
        input: "prices=[[4,10,15,24,26],[0,9,12,20],[5,18,22,30]]",
        output: "[20, 24]",
        explanation:
          "The range 20 to 24 contains 24 from list 1, 20 from list 2, and 22 from list 3 -- one print from every ticker -- and no narrower range covers all three lists.",
      },
    ],
    constraints: [
      "1 <= K <= 3500",
      "each ticker's price array is sorted ascending and non-empty",
      "1 <= total prices across all tickers <= 10^5",
    ],
    approach:
      "Keep a min-heap holding exactly one candidate price per ticker (initially each ticker's first, lowest price), tagged with which ticker and index it came from, plus a running current_max tracking the largest value currently represented in the heap. At every step the heap's minimum and current_max together define a valid range covering one print from every ticker (since every ticker has exactly one entry present); record it if it beats the best range seen so far, then pop that minimum, advance that ticker's pointer, and push its next price, updating current_max. The range can only get better by removing the SMALLEST value present and replacing it with something larger from the same ticker, since removing anything else can't shrink the low end while keeping every ticker represented -- that's what makes a greedy heap-based sweep correct rather than needing to check all combinations. Stop as soon as any ticker's array is exhausted, since no further valid range (with one print from every ticker) can be formed.",
    code: `import heapq

def smallest_range_covering_all_tickers(prices: list[list[int]]) -> list[int]:
    heap = []          # (price, ticker_index, price_index)
    current_max = float("-inf")

    # seed the heap with each ticker's lowest price -- one entry per ticker,
    # so the heap always represents exactly one print from every ticker
    for t, arr in enumerate(prices):
        heapq.heappush(heap, (arr[0], t, 0))
        current_max = max(current_max, arr[0])

    best_lo, best_hi = float("-inf"), float("inf")

    while True:
        lo, t, i = heapq.heappop(heap)
        if current_max - lo < best_hi - best_lo:
            best_lo, best_hi = lo, current_max

        # this ticker has no more prices -- no further range can include
        # a print from every ticker, so the sweep is done
        if i + 1 == len(prices[t]):
            break

        next_price = prices[t][i + 1]
        heapq.heappush(heap, (next_price, t, i + 1))
        current_max = max(current_max, next_price)

    return [best_lo, best_hi]

print(smallest_range_covering_all_tickers([[4, 10, 15, 24, 26], [0, 9, 12, 20], [5, 18, 22, 30]]))
# [20, 24]`,
    language: "python",
    complexity: { time: "O(N log K), N = total prices across all tickers", space: "O(K)" },
  },
  {
    id: "lc-20260906-longest-window-k-distinct-sectors",
    title: "Longest Trading Window Touching At Most K Distinct Sectors",
    difficulty: "medium",
    topics: ["sliding-window", "hash-map"],
    problem:
      "Given a chronological array of sector labels, one per trade, find the length of the longest contiguous window of trades that touches at most K distinct sectors -- used to bound how concentrated a rolling execution schedule is allowed to be.",
    examples: [
      {
        input: "sectors=['Tech','Tech','Energy','Fin','Energy','Energy'], k=2",
        output: "4",
        explanation:
          "The window ['Energy','Fin','Energy','Energy'] (indices 2-5) touches exactly 2 distinct sectors (Energy, Fin) and has length 4; no longer window stays within 2 distinct sectors.",
      },
    ],
    constraints: [
      "1 <= sectors.length <= 10^5",
      "1 <= k <= number of distinct sectors present",
    ],
    approach:
      "This is the standard at-most-K-distinct sliding window (the same pattern as the classic 'longest substring with at most K distinct characters'), just relabeled onto sectors. Keep a hash map of sector -> count of trades currently in the window and a running count of distinct sectors represented. Expand the right pointer, incrementing the entering sector's count and bumping distinct only when that sector's count goes from 0 to 1. Whenever distinct exceeds K, shrink from the left, decrementing the leaving sector's count and dropping distinct only when that count hits exactly 0 -- not on every decrement, since the sector may still be represented elsewhere in the window. Track the best window length after every expansion. Each index enters and leaves the window at most once, so the whole scan is O(n) despite the nested-looking shrink loop.",
    code: `from collections import defaultdict

def longest_window_at_most_k_sectors(sectors: list[str], k: int) -> int:
    counts: dict[str, int] = defaultdict(int)
    left = 0
    distinct = 0
    best = 0

    for right, sector in enumerate(sectors):
        if counts[sector] == 0:
            distinct += 1
        counts[sector] += 1

        # shrink only when we've gone OVER budget, not merely at budget --
        # this is what keeps the scan amortized O(n) instead of resetting early
        while distinct > k:
            left_sector = sectors[left]
            counts[left_sector] -= 1
            if counts[left_sector] == 0:   # only NOW does the sector truly leave the window
                distinct -= 1
            left += 1

        best = max(best, right - left + 1)

    return best

print(longest_window_at_most_k_sectors(
    ["Tech", "Tech", "Energy", "Fin", "Energy", "Energy"], k=2
))   # 4`,
    language: "python",
    complexity: { time: "O(n)", space: "O(number of distinct sectors)" },
  },
  {
    id: "lc-20260906-weighted-interval-trade-windows",
    title: "Maximum Profit From Non-Overlapping Trade Windows",
    difficulty: "hard",
    topics: ["dynamic-programming", "binary-search"],
    problem:
      "You're given a list of candidate trade windows, each (start_time, end_time, profit), representing a position you could hold from start_time to end_time for a known profit. You may only hold one position at a time, so chosen windows can't overlap (touching at the same instant is allowed -- one can start exactly when another ends). Choose a subset of non-overlapping windows to maximize total profit.",
    examples: [
      {
        input: "windows=[(1,3,5),(2,5,6),(4,6,5),(6,7,4)]",
        output: "14",
        explanation:
          "Taking (1,3,5), (4,6,5), and (6,7,4) -- all mutually non-overlapping (touching at t=6 is fine) -- totals 5+5+4=14, which beats any other combination including the single best-looking window (2,5,6).",
      },
    ],
    constraints: [
      "1 <= windows.length <= 10^5",
      "0 <= start_time < end_time <= 10^9",
      "1 <= profit <= 10^4",
    ],
    approach:
      "This is weighted interval scheduling, the DP that generalizes 'max non-overlapping intervals' once each interval carries a value instead of counting equally. Sort windows by end_time, so that for any window i, every window that could legally precede it (non-overlapping) is some prefix of this sorted order. Define dp[i] = best achievable profit using only the first i sorted windows. For window i (1-indexed), either skip it (dp[i-1]) or take it (its own profit plus the best achievable using only windows that end at or before its start_time, found via binary search over the sorted end times, since that set is exactly a prefix). Take the max of the two. Binary search for the latest compatible window turns what would be an O(n^2) DP into O(n log n) -- the same trick behind the classic 'house robber on a timeline' family of problems.",
    code: `from bisect import bisect_right

def max_profit_non_overlapping_windows(windows: list[tuple[int, int, int]]) -> int:
    windows = sorted(windows, key=lambda w: w[1])   # sort by end_time
    ends = [w[1] for w in windows]
    n = len(windows)
    dp = [0] * (n + 1)   # dp[i] = best profit using only the first i sorted windows

    for i in range(1, n + 1):
        start, end, profit = windows[i - 1]
        # latest earlier window whose end_time <= this window's start_time --
        # that's exactly a prefix of the end-time-sorted list, hence bisect works
        j = bisect_right(ends, start)
        dp[i] = max(dp[i - 1], dp[j] + profit)   # skip vs take this window

    return dp[n]

print(max_profit_non_overlapping_windows([(1, 3, 5), (2, 5, 6), (4, 6, 5), (6, 7, 4)]))   # 14`,
    language: "python",
    complexity: { time: "O(n log n)", space: "O(n)" },
  },
  {
    id: "lc-20260906-inventory-absorption-probability",
    title: "Probability a Market Maker's Inventory Hits the Risk Limit Before Flat",
    difficulty: "medium",
    topics: ["probability", "math"],
    problem:
      "A market maker's inventory starts at i shares, with 0 < i < N. Each tick, a buy fill increases inventory by 1 (probability p) or a sell fill decreases it by 1 (probability 1-p), independently. Trading halts the instant inventory hits 0 (back to flat) or N (risk limit breach, forcing a hedge). Given N, i, and p, compute the probability the risk limit is hit before the desk gets back to flat.",
    examples: [
      {
        input: "N=10, i=4, p=0.5",
        output: "0.4",
        explanation:
          "For a fair (p=0.5) walk, the absorption probability reduces to the simple ratio i/N = 4/10 = 0.4 -- the walk is equally likely per unit distance to drift either way.",
      },
    ],
    constraints: ["2 <= N <= 10^6", "0 < i < N", "0 < p < 1"],
    approach:
      "This is the classic gambler's ruin absorption-probability question (distinct from its expected-TIME-to-absorption cousin): let h(k) be the probability of hitting N before 0 starting from inventory k. The recursion h(k) = p*h(k+1) + (1-p)*h(k-1) with boundary conditions h(0)=0, h(N)=1 has a known closed form. Define r = (1-p)/p. When p != 0.5 (r != 1), h(i) = (1 - r^i) / (1 - r^N) -- a standard result from solving the linear recursion's characteristic equation. When p = 0.5 exactly, r = 1 and that formula is a 0/0 indeterminate form, so the limiting case must be handled separately: it degenerates to the simple linear ratio h(i) = i / N. Using the r != 1 formula unmodified at p = 0.5 divides by zero, so the two cases need an explicit branch, not a single unguarded expression.",
    code: `def prob_hit_limit_before_flat(N: int, i: int, p: float) -> float:
    if p == 0.5:
        # r = (1-p)/p = 1 here, and the general formula is 0/0 -- the
        # limiting case degenerates to a simple linear ratio instead
        return i / N

    r = (1 - p) / p
    # closed-form gambler's ruin absorption probability for a biased walk
    return (1 - r ** i) / (1 - r ** N)

print(round(prob_hit_limit_before_flat(N=10, i=4, p=0.5), 4))    # 0.4 -- fair walk, linear in i
print(round(prob_hit_limit_before_flat(N=10, i=4, p=0.55), 4))   # > 0.4 -- biased toward the limit
print(round(prob_hit_limit_before_flat(N=10, i=4, p=0.45), 4))   # < 0.4 -- biased toward flat`,
    language: "python",
    complexity: { time: "O(log i + log N) for the power operations", space: "O(1)" },
  },
  {
    id: "lc-20260906-design-order-rate-limiter",
    title: "Design a Token-Bucket Rate Limiter for Outbound Order Messages",
    difficulty: "medium",
    topics: ["design"],
    problem:
      "Exchanges cap how many order messages (new orders, cancels, replaces) a session can send per second, throttling or disconnecting sessions that exceed it. Design a class allow(timestamp) that a trading session calls before sending each message, returning True if the message may be sent now (and counts against the budget) or False if it must be held back, given a maximum burst capacity and a steady refill rate per second.",
    examples: [
      {
        input: "capacity=5, refill_per_sec=2; calls: allow(0.0) x5, allow(0.1), allow(0.6)",
        output: "[True,True,True,True,True, False, True]",
        explanation:
          "All 5 initial tokens are available at t=0, so the first 5 calls succeed and drain the bucket. At t=0.1, only 0.2 tokens have refilled (2/sec * 0.1s), not enough for a 6th call. At t=0.6, another 0.5s has passed since t=0.1, adding 1.0 more token, enough for one more call.",
      },
    ],
    constraints: [
      "1 <= capacity <= 10^4",
      "0 < refill_per_sec <= 10^4",
      "timestamps passed to allow() are non-decreasing",
    ],
    approach:
      "Token bucket is the standard rate-limiter primitive for exactly this shape of problem: bursts up to a cap are allowed, but sustained throughput is capped at the refill rate. Track a floating-point token count (starting full, at capacity) and the timestamp of the last refill. On every allow(timestamp) call, first refill: add (timestamp - last_refill) * refill_per_sec tokens, capped at capacity so idle time doesn't let tokens accumulate without bound, and update last_refill to the current timestamp regardless of whether the message is ultimately allowed. Then check if at least 1 token is available; if so, subtract 1 and return True, otherwise return False without consuming anything. Doing the refill unconditionally, before the allow/deny check, is what keeps the bucket's state correct even across calls that get denied -- a denied call must still advance the clock the bucket uses for its next refill calculation.",
    code: `class OrderRateLimiter:
    def __init__(self, capacity: int, refill_per_sec: float):
        self.capacity = float(capacity)
        self.refill_per_sec = refill_per_sec
        self.tokens = float(capacity)     # start full -- allow an initial burst
        self.last_refill = 0.0

    def allow(self, timestamp: float) -> bool:
        # refill FIRST, unconditionally -- even a call that ends up denied
        # must still advance last_refill for the next call's calculation
        elapsed = timestamp - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_per_sec)
        self.last_refill = timestamp

        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True
        return False

limiter = OrderRateLimiter(capacity=5, refill_per_sec=2)
results = [limiter.allow(0.0) for _ in range(5)]   # drains the initial burst
results.append(limiter.allow(0.1))                  # only 0.2 tokens refilled -- denied
results.append(limiter.allow(0.6))                  # 1.0 more refilled since t=0.1 -- allowed
print(results)   # [True, True, True, True, True, False, True]`,
    language: "python",
    complexity: { time: "O(1) per call", space: "O(1)" },
  },
];
