import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-23
// Merging K sorted order-book feeds (heap), shortest trading
// window to recover a drawdown (sliding window / prefix sums),
// max profit with K transactions plus a per-trade fee (DP),
// expected return time of a symmetric random walk (probability),
// and an order-submission rate limiter (design).
// ============================================================

export const financeBatch20261023: LeetCodeProblem[] = [
  {
    id: "lc-20261023-merge-k-sorted-order-feeds",
    title: "Merge K Sorted Order-Book Update Feeds Into One Time-Ordered Stream",
    difficulty: "hard",
    topics: ["heap"],
    problem:
      "You receive order-book update events from K separate venue feeds, each already sorted by timestamp. Merge all K feeds into a single list of events sorted by timestamp.",
    examples: [
      {
        input: "feeds = [[1,4,9], [2,5], [3,6,7,8]]",
        output: "[1,2,3,4,5,6,7,8,9]",
        explanation:
          "Each inner list is one venue's already-sorted timestamps; the merged output interleaves all three into one globally sorted stream.",
      },
    ],
    constraints: ["1 <= k <= 1000", "0 <= total events <= 10^5"],
    approach:
      "Push the first element of each of the K feeds onto a min-heap, tagged with which feed it came from and its index within that feed. Repeatedly pop the smallest, append it to the output, and if that feed has a next element, push it onto the heap. This never compares more than K elements at once regardless of how many feeds there are, giving O(n log k) instead of the O(n log n) you'd get from dumping everything into one list and sorting it from scratch, which also ignores that each feed already arrives sorted.",
    code: `import heapq

def merge_k_sorted_feeds(feeds: list[list[int]]) -> list[int]:
    heap = []
    for feed_idx, feed in enumerate(feeds):
        if feed:
            # (timestamp, feed_idx, position_in_feed) -- feed_idx breaks ties deterministically
            heapq.heappush(heap, (feed[0], feed_idx, 0))

    merged: list[int] = []
    while heap:
        ts, feed_idx, pos = heapq.heappop(heap)
        merged.append(ts)
        if pos + 1 < len(feeds[feed_idx]):
            next_ts = feeds[feed_idx][pos + 1]
            heapq.heappush(heap, (next_ts, feed_idx, pos + 1))

    return merged

print(merge_k_sorted_feeds([[1, 4, 9], [2, 5], [3, 6, 7, 8]]))
# [1, 2, 3, 4, 5, 6, 7, 8, 9]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
    leetcodeNumber: 23,
  },
  {
    id: "lc-20261023-shortest-window-recover-drawdown",
    title: "Shortest Contiguous Window Needed to Recover a Drawdown",
    difficulty: "medium",
    topics: ["sliding-window", "monotonic-deque", "prefix-sum"],
    problem:
      "Given a day-by-day P&L array, find the length of the shortest contiguous window whose cumulative sum is at least a given target recovery amount. Return -1 if no such window exists.",
    examples: [
      {
        input: "pnl = [-5, 2, 1, 8, -3, 6], target = 9",
        output: "2",
        explanation:
          "The window [1, 8] sums to 9 in length 2 -- the shortest contiguous stretch whose combined P&L reaches the recovery target.",
      },
    ],
    constraints: ["1 <= pnl.length <= 10^5", "-10^4 <= pnl[i] <= 10^4"],
    approach:
      "This is the 'shortest subarray with sum at least target' pattern, which works even with negative numbers (unlike a plain two-pointer sliding window) because you operate on prefix sums with a monotonic deque instead of shrinking a window directly. Build prefix sums, then for each right endpoint, drop any earlier prefix index from the front of the deque whose cumulative sum already satisfies the target with the current index (that candidate can never beat a shorter one found later from the same window), and before that, pop any prefix from the BACK of the deque that's larger than the current prefix (a smaller, more recent prefix is strictly better for every future right endpoint). Each index enters and leaves the deque once, giving O(n) overall despite negative P&L days.",
    code: `from collections import deque

def shortest_window_to_recover(pnl: list[int], target: int) -> int:
    n = len(pnl)
    prefix = [0] * (n + 1)
    for i, p in enumerate(pnl):
        prefix[i + 1] = prefix[i] + p

    best = float("inf")
    dq = deque()  # indices into prefix, increasing prefix value front-to-back

    for right in range(n + 1):
        # any earlier prefix that already clears the target can't improve by waiting
        while dq and prefix[right] - prefix[dq[0]] >= target:
            best = min(best, right - dq.popleft())
        # a prefix no larger than the current one is strictly worse to keep
        while dq and prefix[dq[-1]] >= prefix[right]:
            dq.pop()
        dq.append(right)

    return -1 if best == float("inf") else best

print(shortest_window_to_recover([-5, 2, 1, 8, -3, 6], target=9))
# 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
    leetcodeNumber: 862,
  },
  {
    id: "lc-20261023-max-profit-k-transactions-with-fee",
    title: "Maximum Profit With At Most K Transactions And A Flat Fee Per Trade",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices, a transaction limit k, and a flat fee charged once per completed round trip (one buy plus the matching sell), return the maximum achievable profit using at most k round trips.",
    examples: [
      {
        input: "prices = [3,2,6,5,0,3], k = 2, fee = 1",
        output: "5",
        explanation:
          "Buy at 2, sell at 6 for profit 4 minus fee 1 = 3; buy at 0, sell at 3 for profit 3 minus fee 1 = 2. Total 3 + 2 = 5, using both allowed round trips.",
      },
    ],
    constraints: ["1 <= k <= 50", "1 <= prices.length <= 1000", "0 <= fee <= 1000"],
    approach:
      "Extend the classic 'at most k transactions' DP by folding the fee into the sell transition. Track two arrays indexed by transaction count j from 1 to k: hold[j] (max profit with j-th round trip open, currently holding a share) and sold[j] (max profit with j-th round trip closed). Each day: hold[j] = max(hold[j], sold[j-1] - price) (buy to start round trip j, financed by having closed round trip j-1); sold[j] = max(sold[j], hold[j] + price - fee) (close round trip j, paying the fee once per completed trip, not per day held). Charging the fee only at the sell transition, not the buy, is what keeps it a flat per-round-trip cost rather than a cost that scales with the number of days a position is held.",
    code: `def max_profit_k_transactions_with_fee(prices: list[int], k: int, fee: int) -> int:
    if not prices or k == 0:
        return 0

    NEG_INF = float("-inf")
    hold = [NEG_INF] * (k + 1)   # max profit after buying to open round trip j
    sold = [0] * (k + 1)         # max profit after closing round trip j

    for price in prices:
        for j in range(1, k + 1):
            hold[j] = max(hold[j], sold[j - 1] - price)
            # fee is charged exactly once here, at the close of round trip j --
            # never at the buy, and never again while the position is simply held
            sold[j] = max(sold[j], hold[j] + price - fee)

    return max(sold)

print(max_profit_k_transactions_with_fee([3, 2, 6, 5, 0, 3], k=2, fee=1))
# 5`,
    language: "python",
    complexity: { time: "O(n * k)", space: "O(k)" },
  },
  {
    id: "lc-20261023-expected-return-time-symmetric-walk",
    title: "Expected Number of Ticks for a Mean-Reverting Price to Return to Its Starting Level",
    difficulty: "hard",
    topics: ["probability"],
    problem:
      "A price moves up or down by one tick each period with equal probability 1/2 (a symmetric random walk). Given that the price returns to its starting level with probability 1, compute the EXPECTED number of ticks until that first return, and explain the surprising result.",
    examples: [
      {
        input: "p = 0.5 (symmetric)",
        output: "infinity",
        explanation:
          "A symmetric random walk on the integers returns to its origin with probability exactly 1 (it is recurrent), yet the EXPECTED number of steps to do so is infinite -- an event that is certain to happen can still have an infinite expected waiting time.",
      },
    ],
    constraints: ["p = 0.5 for the symmetric case; the surprising result does not hold for p != 0.5"],
    approach:
      "This is a classic result, not a loop to optimize: for a simple symmetric random walk on the integers, the probability of first return to the origin at step 2n decays only like n^(-3/2) (a standard combinatorial identity involving Catalan-like counting of paths that avoid zero until step 2n). The expected return time is the sum over n of (2n) times that probability, and since the terms only shrink like n^(-1/2), the sum diverges -- the expectation is infinite even though the walk is certain (probability 1) to return eventually. This is the single most useful 'gotcha' intuition in the topic: recurrence (it happens with probability 1) and finite expectation (how long you'd wait on average) are two completely different claims, and a fair, symmetric process can satisfy the first while badly failing the second. The moment you bias the walk away from p = 0.5, the walk becomes transient and may never return at all with positive probability -- a different, non-surprising failure mode.",
    code: `import numpy as np

def simulate_return_time(p: float, rng: np.random.Generator, max_steps: int = 2_000_000) -> int | None:
    position = 0
    for step in range(1, max_steps + 1):
        position += 1 if rng.random() < p else -1
        if position == 0:
            return step
    return None  # didn't return within max_steps -- expected for p = 0.5 on a long run

rng = np.random.default_rng(0)
trials = [simulate_return_time(0.5, rng) for _ in range(2000)]
finite_trials = [t for t in trials if t is not None]

print(sum(t is None for t in trials))          # a nontrivial fraction never return within the cap
print(round(np.mean(finite_trials), 1))        # the AVERAGE of the ones that did return keeps
                                                 # climbing as max_steps grows -- consistent with
                                                 # a true expectation of infinity, not a large-but-finite number`,
    language: "python",
    complexity: { time: "O(1) analytically; simulation is O(max_steps) per trial", space: "O(1)" },
  },
  {
    id: "lc-20261023-design-order-throttle",
    title: "Design an Order Throttle Enforcing At Most N Orders Per Rolling Window",
    difficulty: "medium",
    topics: ["design", "sliding-window"],
    problem:
      "Design a class OrderThrottle(max_orders, window_ms) with a method allow(timestamp_ms) that returns True if submitting an order at that timestamp would keep the count of allowed orders within the last window_ms milliseconds at or below max_orders, and False otherwise (the order is throttled and not counted).",
    examples: [
      {
        input: "max_orders = 3, window_ms = 1000; allow(0), allow(200), allow(300), allow(900), allow(1100)",
        output: "True, True, True, False, True",
        explanation:
          "The first three orders (at 0, 200, 300) are all within any 1000ms window together, so the 4th at 900 would make 4 orders inside [0, 1000) and is throttled; by 1100 the order at 0 has fallen outside the trailing 1000ms window, freeing up a slot.",
      },
    ],
    constraints: ["1 <= max_orders <= 10^4", "1 <= window_ms <= 10^6", "up to 10^5 calls to allow"],
    approach:
      "Keep a queue of the timestamps of accepted orders only (rejected ones never occupy a slot). On each call, first evict from the front of the queue every timestamp older than timestamp_ms - window_ms -- those have aged out of the trailing window and no longer count against the limit. Then accept the new order (push its timestamp and return True) only if the queue's size is still below max_orders after that eviction; otherwise reject it and leave the queue untouched. Because timestamps arrive in non-decreasing order, eviction from the front is always correct and each timestamp is evicted exactly once, so total work across all calls is O(n) amortized.",
    code: `from collections import deque

class OrderThrottle:
    def __init__(self, max_orders: int, window_ms: int):
        self.max_orders = max_orders
        self.window_ms = window_ms
        self.accepted: deque[int] = deque()   # timestamps of orders that were allowed through

    def allow(self, timestamp_ms: int) -> bool:
        cutoff = timestamp_ms - self.window_ms
        while self.accepted and self.accepted[0] <= cutoff:
            self.accepted.popleft()   # this order has aged out of the trailing window

        if len(self.accepted) < self.max_orders:
            self.accepted.append(timestamp_ms)
            return True
        return False   # throttled -- does not occupy a slot

throttle = OrderThrottle(max_orders=3, window_ms=1000)
for ts in [0, 200, 300, 900, 1100]:
    print(throttle.allow(ts))
# True, True, True, False, True`,
    language: "python",
    complexity: { time: "O(1) amortized per call", space: "O(max_orders)" },
  },
];
