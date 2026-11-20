import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-20
// Merging K sorted trade tapes into one chronological stream
// (heap, k-way merge), the longest window where the intraday
// spread never breaches a risk limit (sliding window with
// monotonic deques), unlimited buy/sell transactions with a
// flat per-trade fee (stock DP with hold/cash states), the
// probability a streak of K consecutive up-days ever appears
// across N trading days (Markov chain / DP), and a sliding-
// window order-submission rate limiter (design).
// ============================================================

export const financeBatch20261120: LeetCodeProblem[] = [
  {
    id: "lc-20261120-merge-k-sorted-trade-tapes",
    title: "Merge K Sorted Trade Tapes Into One Chronological Stream",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "You have K separate trade tapes (one per exchange feed), each already sorted by timestamp. Merge all K tapes into a single list of trades in overall chronological order.",
    examples: [
      {
        input: "tapes = [[1, 4, 9], [2, 5], [3, 6, 7, 8]]  (timestamps only, shown for brevity)",
        output: "[1, 2, 3, 4, 5, 6, 7, 8, 9]",
        explanation:
          "Each input list is already individually sorted; merging all three in timestamp order interleaves them into one fully sorted stream.",
      },
    ],
    constraints: ["1 <= K <= 10^4", "0 <= total trades across all tapes <= 10^5", "each individual tape is sorted by timestamp"],
    approach:
      "A pairwise merge of all K tapes one at a time costs O(N*K) in the worst case, since every merge pass touches all N trades seen so far. Instead, push the first trade of each of the K tapes onto a min-heap keyed by timestamp, along with which tape and index it came from. Repeatedly pop the smallest, append it to the output, and if that tape has a next trade, push it onto the heap. The heap never holds more than K elements at once, and each of the N total trades is pushed and popped exactly once, giving O(N log K) instead of O(N*K) -- the same trick used for merging K sorted linked lists, just applied to trade tapes instead.",
    code: `import heapq


def merge_trade_tapes(tapes: list[list[int]]) -> list[int]:
    heap = []
    # seed the heap with the first timestamp from each non-empty tape
    for tape_idx, tape in enumerate(tapes):
        if tape:
            heapq.heappush(heap, (tape[0], tape_idx, 0))

    merged: list[int] = []
    while heap:
        ts, tape_idx, elem_idx = heapq.heappop(heap)
        merged.append(ts)
        next_idx = elem_idx + 1
        if next_idx < len(tapes[tape_idx]):
            heapq.heappush(heap, (tapes[tape_idx][next_idx], tape_idx, next_idx))

    return merged


print(merge_trade_tapes([[1, 4, 9], [2, 5], [3, 6, 7, 8]]))
# [1, 2, 3, 4, 5, 6, 7, 8, 9]`,
    language: "python",
    complexity: { time: "O(N log K) where N is total trades across all tapes", space: "O(K)" },
    leetcodeNumber: 23,
  },
  {
    id: "lc-20261120-longest-window-spread-within-limit",
    title: "Longest Window Where the Intraday Spread Never Exceeds a Risk Limit",
    difficulty: "hard",
    topics: ["sliding-window"],
    problem:
      "Given intraday prices and a risk limit L, return the length of the longest contiguous window where (max price in the window) minus (min price in the window) never exceeds L.",
    examples: [
      {
        input: "prices = [5, 8, 6, 7, 10, 9], L = 3",
        output: "4",
        explanation:
          "The window [5, 8, 6, 7] has max 8 and min 5, a spread of exactly 3, so it's valid at length 4. Extending it to include the 10 pushes the spread to 5, which breaks the limit, and no other window reaches length 4 while staying within it.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= L <= 10^9"],
    approach:
      "This is a classic variable-length sliding window, but the window's validity condition depends on the max and min of the CURRENT window, which change as the window slides -- a plain running max/min would need to rescan the whole window whenever the left edge moves past the current extreme. Maintain two monotonic deques: one decreasing (fronts hold the current window's max candidates) and one increasing (fronts hold the min candidates). Expanding the right edge pops any deque entries that can never be the extreme again (since the new price dominates them); shrinking the left edge pops entries that have fallen out of the window entirely. The window's spread is always deque_max[0] - deque_min[0] in O(1), so the whole scan runs in amortized O(n) despite needing a live max and min at every step.",
    code: `from collections import deque


def longest_window_within_limit(prices: list[int], limit: int) -> int:
    max_deque: deque[int] = deque()  # indices, decreasing prices front-to-back
    min_deque: deque[int] = deque()  # indices, increasing prices front-to-back
    left = 0
    best = 0

    for right, price in enumerate(prices):
        while max_deque and prices[max_deque[-1]] <= price:
            max_deque.pop()
        max_deque.append(right)

        while min_deque and prices[min_deque[-1]] >= price:
            min_deque.pop()
        min_deque.append(right)

        # shrink from the left until the spread is back within the limit
        while prices[max_deque[0]] - prices[min_deque[0]] > limit:
            left += 1
            if max_deque[0] < left:
                max_deque.popleft()
            if min_deque[0] < left:
                min_deque.popleft()

        best = max(best, right - left + 1)

    return best


print(longest_window_within_limit([5, 8, 6, 7, 10, 9], 3))
# 4`,
    language: "python",
    complexity: { time: "O(n) amortized", space: "O(n) worst case for the deques" },
  },
  {
    id: "lc-20261120-unlimited-transactions-with-fee",
    title: "Max Profit With Unlimited Buy/Sell Transactions and a Flat Per-Trade Fee",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices and a flat fee charged on every SELL, you may buy and sell as many times as you like (one share at a time, must sell before buying again). Return the maximum total profit after fees.",
    examples: [
      {
        input: "prices = [1, 3, 2, 8, 4, 9], fee = 2",
        output: "8",
        explanation:
          "Buy at 1, sell at 8 (net 8-1-2=5); buy at 4, sell at 9 (net 9-4-2=3). Total 5+3=8. Trying to also trade the small 2-to-3 wiggle isn't worth a second fee.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i], fee <= 10^4"],
    approach:
      "Track two running states day by day instead of searching over all possible trade partitions: cash[i] = best profit if you hold NO share after day i, and hold[i] = best profit if you DO hold a share after day i. cash transitions from either staying in cash, or selling what you held yesterday (paying the fee now, which is the natural place to charge it exactly once per round trip). hold transitions from either staying in a position, or buying today out of yesterday's cash balance. Only two numbers need to be carried forward at each step, so the whole thing runs in O(n) time and O(1) space despite allowing unlimited trades.",
    code: `def max_profit_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    cash = 0                    # best profit, currently holding nothing
    hold = -prices[0]           # best profit, currently holding one share

    for price in prices[1:]:
        # charge the fee on the SELL leg -- exactly once per round trip
        cash = max(cash, hold + price - fee)
        hold = max(hold, cash - price)

    return cash   # end holding nothing is always at least as good as holding


print(max_profit_fee([1, 3, 2, 8, 4, 9], 2))
# 8`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 714,
  },
  {
    id: "lc-20261120-probability-k-streak-in-n-days",
    title: "Probability That a Streak of K Consecutive Up-Days Occurs Somewhere in N Trading Days",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "Each trading day is independently an up-day with probability p. Over N trading days, return the probability that a run of at least K consecutive up-days occurs somewhere in that span.",
    examples: [
      {
        input: "N = 4, K = 2, p = 0.5",
        output: "0.5",
        explanation:
          "Out of 16 equally likely up/down sequences of length 4, exactly 8 contain 'UU' somewhere (e.g. UUDD, DUUD, UUUD, ...), giving probability 8/16 = 0.5.",
      },
    ],
    constraints: ["1 <= K <= N <= 10^5", "0 < p < 1"],
    approach:
      "Rather than enumerating sequences, track a Markov-style DP state: no_streak_yet[j] = probability that, after some number of days, the current trailing run of up-days has length exactly j (for j = 0..K-1) AND a run of length K has never yet occurred. Each day, every state with trailing run j transitions to trailing run j+1 with probability p (an up-day extends the run) or resets to trailing run 0 with probability 1-p (a down-day breaks it) -- except that reaching j+1 = K means the streak has now happened, so that probability mass leaves the 'no streak yet' tracking entirely and gets added straight into the final answer instead of being carried forward. After N days, the answer is 1 minus whatever probability mass is still sitting in the 'no streak yet' states.",
    code: `def probability_of_k_streak(n: int, k: int, p: float) -> float:
    # dp[j] = probability that no K-streak has occurred yet AND the
    # current trailing run of up-days has length exactly j
    dp = [0.0] * k
    dp[0] = 1.0  # before any days, trailing run length is 0, no streak yet
    streak_occurred = 0.0

    for _ in range(n):
        new_dp = [0.0] * k
        for j in range(k):
            if dp[j] == 0.0:
                continue
            # down-day: run resets to 0, still no streak
            new_dp[0] += dp[j] * (1 - p)
            # up-day: run extends; if it would hit k, the streak has
            # now happened and that mass leaves the "no streak" tracking
            if j + 1 == k:
                streak_occurred += dp[j] * p
            else:
                new_dp[j + 1] += dp[j] * p
        dp = new_dp
        # once a sequence has escaped into streak_occurred it never
        # re-enters dp -- dp only ever tracks "no streak yet" mass

    return streak_occurred


print(round(probability_of_k_streak(4, 2, 0.5), 4))
# 0.5`,
    language: "python",
    complexity: { time: "O(n*k)", space: "O(k)" },
  },
  {
    id: "lc-20261120-design-order-submission-rate-limiter",
    title: "Design a Sliding-Window Order-Submission Rate Limiter",
    difficulty: "medium",
    topics: ["design"],
    problem:
      "Design a risk-control gate that allows at most N order submissions within any rolling T-millisecond window. allow(timestamp) is called with a strictly non-decreasing sequence of timestamps and returns True if the order is permitted (and counts toward the limit) or False if it must be rejected.",
    examples: [
      {
        input: "N = 2, T = 1000; allow(0), allow(100), allow(200), allow(1100)",
        output: "True, True, False, True",
        explanation:
          "The first two orders (t=0, t=100) both fit within the first 1000ms window. The third at t=200 would make 3 orders within [0,1000], so it's rejected. By t=1100, the order at t=0 has rolled out of the trailing 1000ms window, leaving room for one more.",
      },
    ],
    constraints: ["1 <= N <= 10^5", "1 <= T <= 10^9", "timestamps arrive in non-decreasing order", "up to 10^5 calls to allow"],
    approach:
      "Keep a deque holding the timestamps of currently-accepted orders, oldest first. On each call, first evict from the front every timestamp older than (current timestamp - T), since those have aged out of the rolling window and no longer count against the limit. Then the order is allowed if and only if the deque's remaining size is still below N; if allowed, append the new timestamp. Because timestamps arrive in non-decreasing order, each eviction only ever needs to look at the front of the deque, and each timestamp is pushed and popped at most once, giving amortized O(1) per call rather than rescanning the whole window on every check.",
    code: `from collections import deque


class OrderRateLimiter:
    def __init__(self, max_orders: int, window_ms: int) -> None:
        self.max_orders = max_orders
        self.window_ms = window_ms
        self.accepted: deque[int] = deque()

    def allow(self, timestamp: int) -> bool:
        # evict accepted orders that have aged out of the rolling window
        cutoff = timestamp - self.window_ms
        while self.accepted and self.accepted[0] <= cutoff:
            self.accepted.popleft()

        if len(self.accepted) < self.max_orders:
            self.accepted.append(timestamp)
            return True
        return False


gate = OrderRateLimiter(max_orders=2, window_ms=1000)
for t in [0, 100, 200, 1100]:
    print(t, gate.allow(t))
# 0 True
# 100 True
# 200 False
# 1100 True`,
    language: "python",
    complexity: { time: "O(1) amortized per call", space: "O(N)" },
  },
];
