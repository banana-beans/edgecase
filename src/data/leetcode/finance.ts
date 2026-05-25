import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant / finance-flavoured interview problems for /grind.
// These appear alongside the canonical LeetCode set.
// ============================================================

export const financeProblems: LeetCodeProblem[] = [
  {
    id: "lc-best-time-buy-sell-ii",
    leetcodeNumber: 122,
    title: "Best Time to Buy and Sell Stock II (Unlimited)",
    difficulty: "medium",
    topics: ["array", "greedy"],
    problem:
      "You may complete as many transactions as you like (buy one and sell one share many times). You may not engage in multiple transactions simultaneously (must sell before buying again). Maximize total profit.",
    examples: [
      { input: "prices = [7,1,5,3,6,4]", output: "7", explanation: "Buy 1 sell 5 (+4), buy 3 sell 6 (+3)." },
      { input: "prices = [1,2,3,4,5]", output: "4", explanation: "Capture every up-day." },
    ],
    approach:
      "Sum every positive day-over-day delta. Each up move is an independent trade you would take. No DP needed.",
    code: `def max_profit_ii(prices: list[int]) -> int:
    total = 0
    for i in range(1, len(prices)):
        diff = prices[i] - prices[i - 1]
        if diff > 0:
            total += diff
    return total`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-best-time-buy-sell-cooldown",
    leetcodeNumber: 309,
    title: "Best Time to Buy and Sell with Cooldown",
    difficulty: "medium",
    topics: ["dynamic-programming", "state-machine"],
    problem:
      "You may complete as many transactions as you like, but after you sell, you cannot buy on the next day (cooldown of one day). Maximize profit.",
    examples: [
      { input: "prices = [1,2,3,0,2]", output: "3", explanation: "Buy 1, sell 2, cooldown, buy 0, sell 2." },
    ],
    approach:
      "Three-state DP: hold (own a share), sold (just sold, in cooldown), rest (not holding, can buy). Iterate, updating each from the previous day's states.",
    code: `def max_profit_cooldown(prices: list[int]) -> int:
    hold = float('-inf')   # owning a share
    sold = 0               # just sold today
    rest = 0               # not holding, free to buy
    for p in prices:
        prev_sold = sold
        sold = hold + p              # sell from a hold
        hold = max(hold, rest - p)   # keep holding, or buy from rest
        rest = max(rest, prev_sold)  # stay resting, or come off cooldown
    return max(sold, rest)`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-best-time-buy-sell-fee",
    leetcodeNumber: 714,
    title: "Best Time to Buy and Sell with Transaction Fee",
    difficulty: "medium",
    topics: ["dynamic-programming", "greedy"],
    problem:
      "Pay a fee for every completed transaction. Maximize profit net of fees.",
    examples: [
      { input: "prices = [1,3,2,8,4,9], fee = 2", output: "8", explanation: "Buy 1 sell 8 (-2 fee), buy 4 sell 9 (-2 fee) = 5 + 3 = 8." },
    ],
    approach:
      "Two-state DP: hold and cash. Update hold = max(hold, cash - p); cash = max(cash, hold + p - fee). The fee discourages high-turnover noise trades.",
    code: `def max_profit_fee(prices: list[int], fee: int) -> int:
    cash = 0
    hold = -prices[0]
    for p in prices[1:]:
        cash = max(cash, hold + p - fee)
        hold = max(hold, cash - p)
    return cash`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-best-time-buy-sell-k",
    leetcodeNumber: 188,
    title: "Best Time to Buy and Sell with at Most K Transactions",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Complete at most k transactions to maximize profit.",
    examples: [
      { input: "k = 2, prices = [3,2,6,5,0,3]", output: "7", explanation: "Buy 2 sell 6, buy 0 sell 3." },
    ],
    approach:
      "DP over k transactions and per-day buy/sell state. When k >= n/2 it degenerates to unlimited transactions (Stock II). Otherwise iterate t from 1..k, maintaining max_diff = max(max_diff, dp[t-1][i] - price) for O(nk).",
    code: `def max_profit_k(k: int, prices: list[int]) -> int:
    n = len(prices)
    if n == 0 or k == 0:
        return 0
    if k >= n // 2:
        # Unlimited transactions optimum
        return sum(max(0, prices[i] - prices[i - 1]) for i in range(1, n))

    dp = [[0] * n for _ in range(k + 1)]
    for t in range(1, k + 1):
        max_diff = -prices[0]
        for i in range(1, n):
            dp[t][i] = max(dp[t][i - 1], prices[i] + max_diff)
            max_diff = max(max_diff, dp[t - 1][i] - prices[i])
    return dp[k][n - 1]`,
    language: "python",
    complexity: { time: "O(nk)", space: "O(nk)" },
  },
  {
    id: "lc-stock-span",
    leetcodeNumber: 901,
    title: "Online Stock Span (Monotonic Stack)",
    difficulty: "medium",
    topics: ["stack", "monotonic-stack", "design"],
    problem:
      "Design a class that takes daily stock prices in arrival order and, for each new price, returns the 'span' — the number of consecutive days (including today) where the price was <= today's price.",
    examples: [
      { input: "prices stream: 100, 80, 60, 70, 60, 75, 85", output: "1, 1, 1, 2, 1, 4, 6" },
    ],
    approach:
      "Maintain a monotonic stack of (price, span). For each new price, pop entries with price <= new and accumulate their spans, then push the combined entry.",
    code: `class StockSpanner:
    def __init__(self):
        self.stack: list[tuple[int, int]] = []   # (price, span)

    def next(self, price: int) -> int:
        span = 1
        while self.stack and self.stack[-1][0] <= price:
            span += self.stack.pop()[1]
        self.stack.append((price, span))
        return span`,
    language: "python",
    complexity: { time: "O(1) amortised per call", space: "O(n)" },
  },
  {
    id: "lc-median-from-stream",
    leetcodeNumber: 295,
    title: "Find Median from Data Stream",
    difficulty: "hard",
    topics: ["heap", "two-heaps", "design"],
    problem:
      "Design a class that supports addNum(int) and findMedian() over the running stream of inserted values.",
    examples: [
      { input: "add 1, add 2, find -> ?, add 3, find -> ?", output: "1.5, 2" },
    ],
    approach:
      "Two heaps: a max-heap for the lower half, min-heap for the upper half. Keep their sizes within 1. Median is the top of the larger heap, or the average when equal. Python's heapq is a min-heap — negate values for the max-heap.",
    code: `import heapq

class MedianFinder:
    def __init__(self):
        self.lo: list[int] = []   # max-heap (negate)
        self.hi: list[int] = []   # min-heap

    def addNum(self, num: int) -> None:
        heapq.heappush(self.lo, -num)
        heapq.heappush(self.hi, -heapq.heappop(self.lo))
        if len(self.hi) > len(self.lo):
            heapq.heappush(self.lo, -heapq.heappop(self.hi))

    def findMedian(self) -> float:
        if len(self.lo) > len(self.hi):
            return -self.lo[0]
        return (-self.lo[0] + self.hi[0]) / 2.0`,
    language: "python",
    complexity: { time: "O(log n) add, O(1) find", space: "O(n)" },
  },
  {
    id: "lc-kth-largest-stream",
    leetcodeNumber: 703,
    title: "Kth Largest Element in a Stream",
    difficulty: "easy",
    topics: ["heap", "design"],
    problem:
      "Design a class that returns the k-th largest element of the stream after each insertion.",
    examples: [
      { input: "k=3, init [4,5,8,2], add 3 -> ?, add 5 -> ?", output: "4, 5" },
    ],
    approach:
      "Maintain a min-heap of size k. The root is always the k-th largest. On each add, push then pop if heap is too big — O(log k) per op.",
    code: `import heapq

class KthLargest:
    def __init__(self, k: int, nums: list[int]):
        self.k = k
        self.heap: list[int] = []
        for x in nums:
            self.add(x)

    def add(self, val: int) -> int:
        heapq.heappush(self.heap, val)
        if len(self.heap) > self.k:
            heapq.heappop(self.heap)
        return self.heap[0]`,
    language: "python",
    complexity: { time: "O(log k) per add", space: "O(k)" },
  },
  {
    id: "lc-trapping-rain-water",
    leetcodeNumber: 42,
    title: "Trapping Rain Water (Two Pointers)",
    difficulty: "hard",
    topics: ["two-pointers", "array", "stack"],
    problem:
      "Given n non-negative integers representing the heights of bars in an elevation map, compute how much water can be trapped after raining.",
    examples: [
      { input: "height = [0,1,0,2,1,0,1,3,2,1,2,1]", output: "6" },
    ],
    approach:
      "Two pointers from both ends. Maintain left_max and right_max. The shorter side determines water level; advance that pointer. Each position contributes max(side_max - height[i], 0).",
    code: `def trap(height: list[int]) -> int:
    left, right = 0, len(height) - 1
    left_max = right_max = 0
    total = 0
    while left < right:
        if height[left] < height[right]:
            if height[left] >= left_max:
                left_max = height[left]
            else:
                total += left_max - height[left]
            left += 1
        else:
            if height[right] >= right_max:
                right_max = height[right]
            else:
                total += right_max - height[right]
            right -= 1
    return total`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-sliding-window-max",
    leetcodeNumber: 239,
    title: "Sliding Window Maximum",
    difficulty: "hard",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given an array nums and a window size k, return the maximum value of every contiguous window of size k as the window slides from left to right.",
    examples: [
      { input: "nums = [1,3,-1,-3,5,3,6,7], k = 3", output: "[3,3,5,5,6,7]" },
    ],
    approach:
      "Monotonic deque holding indices. Before pushing i, evict indices whose value is <= nums[i] (they can never be max again). Evict the front if it falls out of the window. Front is always the current max.",
    code: `from collections import deque

def max_sliding_window(nums: list[int], k: int) -> list[int]:
    dq: deque[int] = deque()
    out: list[int] = []
    for i, x in enumerate(nums):
        while dq and dq[0] <= i - k:
            dq.popleft()
        while dq and nums[dq[-1]] <= x:
            dq.pop()
        dq.append(i)
        if i >= k - 1:
            out.append(nums[dq[0]])
    return out`,
    language: "python",
    complexity: { time: "O(n)", space: "O(k)" },
  },
  {
    id: "lc-vwap-rolling",
    leetcodeNumber: 0,
    title: "Rolling VWAP (Volume-Weighted Average Price)",
    difficulty: "medium",
    topics: ["sliding-window", "finance"],
    problem:
      "Given a stream of (price, volume) ticks and a window of N most-recent ticks, return the VWAP — sum(p*v) / sum(v) — after each tick.",
    examples: [
      { input: "window=3, ticks: (100,10), (101,5), (99,20), (102,15)", output: "100.0, 100.33, 99.71, 100.97" },
    ],
    approach:
      "Sliding window with running sums of (p*v) and v. On each new tick, add to both sums and (if window full) subtract the oldest tick's contributions. O(1) per tick.",
    code: `from collections import deque

class RollingVWAP:
    def __init__(self, window: int):
        self.window = window
        self.q: deque[tuple[float, float]] = deque()
        self.sum_pv = 0.0
        self.sum_v = 0.0

    def push(self, price: float, vol: float) -> float:
        self.q.append((price, vol))
        self.sum_pv += price * vol
        self.sum_v += vol
        if len(self.q) > self.window:
            p_old, v_old = self.q.popleft()
            self.sum_pv -= p_old * v_old
            self.sum_v -= v_old
        return self.sum_pv / self.sum_v if self.sum_v > 0 else 0.0`,
    language: "python",
    complexity: { time: "O(1) per tick", space: "O(window)" },
  },
  {
    id: "lc-coin-from-biased",
    leetcodeNumber: 0,
    title: "Fair Coin from a Biased Coin",
    difficulty: "medium",
    topics: ["probability", "math"],
    problem:
      "Given a function biased() that returns 1 with unknown probability p (0 < p < 1) and 0 otherwise, implement fair() that returns 0 or 1 with exactly 50/50 probability.",
    examples: [
      { input: "1000 calls to fair() with p=0.7", output: "~500/500 split" },
    ],
    approach:
      "Von Neumann trick. Flip the biased coin twice. HT and TH each occur with probability p(1-p) regardless of p. Return 0 on HT, 1 on TH, retry on HH/TT. Expected flips per output bit: 2 / (2p(1-p)).",
    code: `def fair(biased) -> int:
    while True:
        a = biased()
        b = biased()
        if a != b:
            return 0 if a == 1 else 1`,
    language: "python",
    complexity: { time: "O(1) expected (depends on p)", space: "O(1)" },
  },
  {
    id: "lc-russian-doll-envelopes",
    leetcodeNumber: 354,
    title: "Russian Doll Envelopes (LIS variant)",
    difficulty: "hard",
    topics: ["sorting", "binary-search", "longest-increasing-subsequence"],
    problem:
      "Given pairs (w, h), find the maximum number that can be nested (each must be strictly wider AND taller). A classic quant interview question dressed up.",
    examples: [
      { input: "envelopes = [[5,4],[6,4],[6,7],[2,3]]", output: "3", explanation: "[2,3] -> [5,4] -> [6,7]" },
    ],
    approach:
      "Sort by width ascending, tie-break by height DESCENDING (so same-width envelopes can't both be picked). Then run LIS on heights using patience sorting / binary search for O(n log n).",
    code: `from bisect import bisect_left

def max_envelopes(envs: list[list[int]]) -> int:
    envs.sort(key=lambda e: (e[0], -e[1]))
    tails: list[int] = []
    for _, h in envs:
        idx = bisect_left(tails, h)
        if idx == len(tails):
            tails.append(h)
        else:
            tails[idx] = h
    return len(tails)`,
    language: "python",
    complexity: { time: "O(n log n)", space: "O(n)" },
  },
];
