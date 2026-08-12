import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-12
// A min-heap interval-scheduling problem, an "at most k" shrinking
// window, the general k-transactions stock DP, an expected-value
// streak problem (companion to the gambler's-ruin cards), and an
// O(1)-per-tick rolling volatility tracker.
// ============================================================

export const financeBatch20260812: LeetCodeProblem[] = [
  {
    id: "lc-min-halt-monitoring-channels",
    title: "Minimum Monitoring Channels for Overlapping Trading Halts",
    difficulty: "medium",
    topics: ["heap", "intervals", "greedy"],
    problem:
      "You're given a list of trading halts across different symbols, each as [start, end] in minutes since market open. Each active halt needs one compliance monitor watching it live, and a monitor becomes free to reuse the instant its current halt ends. Return the minimum number of monitors needed to cover all halts.",
    examples: [
      {
        input: "halts=[[0,30],[5,10],[15,20]]",
        output: "2",
        explanation:
          "[0,30] is active the whole time, overlapping both [5,10] and [15,20], so a second monitor is needed while either of those is live. [5,10] and [15,20] never overlap each other, so they can share that second monitor.",
      },
    ],
    constraints: ["1 <= halts.length <= 10^5", "0 <= start < end <= 10^9"],
    approach:
      "This is the meeting-rooms-II pattern: sort halts by start time, then greedily track the end times of currently active halts in a min-heap. For each new halt, if the earliest-ending active halt (the heap top) ends at or before the new halt's start, that monitor is free -- pop it and reuse it by pushing the new end in its place. Otherwise no monitor is free, so push a new end, growing the heap. The final heap size is exactly the peak number of simultaneously active halts, which is the minimum number of monitors needed -- reusing a monitor the instant it frees up is never worse than opening a new one, the standard greedy-exchange argument behind this pattern.",
    code: `import heapq

def min_monitoring_channels(halts: list[list[int]]) -> int:
    if not halts:
        return 0
    halts.sort(key=lambda h: h[0])          # process halts in start-time order
    end_heap = []                            # min-heap of end times of active monitors
    for start, end in halts:
        if end_heap and end_heap[0] <= start:
            heapq.heapreplace(end_heap, end)  # reuse the monitor that just freed up
        else:
            heapq.heappush(end_heap, end)     # no free monitor -- open a new one
    return len(end_heap)                      # heap size = peak concurrent halts`,
    language: "python",
    complexity: { time: "O(n log n)", space: "O(n)" },
  },
  {
    id: "lc-longest-window-k-halted-days",
    title: "Longest Trading Window With At Most K Halted Days",
    difficulty: "medium",
    topics: ["sliding-window", "hash-map"],
    problem:
      "Given a boolean array halted where halted[i] is true if day i's session was halted (no trading), and an integer k, find the length of the longest contiguous window of days containing at most k halted days.",
    examples: [
      {
        input: "halted=[F,F,T,F,T,F,F], k=1",
        output: "4",
        explanation:
          "The window covering indices 0-3 ([F,F,T,F]) contains exactly one halted day, length 4. Extending further in either direction brings in a second halted day, which exceeds k=1.",
      },
    ],
    constraints: ["1 <= len(halted) <= 10^5", "0 <= k <= len(halted)"],
    approach:
      "Standard shrinking-window pattern, same skeleton as 'longest substring with at most k distinct characters': expand the window one day at a time, incrementing a running halted-day count whenever that day is halted. While the count exceeds k, shrink from the left, decrementing the count as halted days leave the window. Because right only ever advances and left only ever advances, this is a single amortized linear pass -- track the best width seen along the way.",
    code: `def longest_window_at_most_k_halts(halted: list[bool], k: int) -> int:
    left = 0
    halt_count = 0
    best = 0
    for right, is_halted in enumerate(halted):
        halt_count += is_halted            # bool adds as 0/1
        while halt_count > k:              # window has too many halted days
            halt_count -= halted[left]
            left += 1
        best = max(best, right - left + 1)
    return best`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-buy-sell-stock-iv",
    leetcodeNumber: 188,
    title: "Best Time to Buy and Sell Stock IV (At Most K Transactions)",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices and an integer k, maximize total profit using at most k buy-sell transactions. A transaction is one buy followed by a later sell; you must sell before buying again, no overlapping positions.",
    examples: [
      {
        input: "prices=[3,2,6,5,0,3], k=2",
        output: "7",
        explanation:
          "Buy at 2, sell at 6 (profit 4); buy at 0, sell at 3 (profit 3); total 7.",
      },
    ],
    constraints: [
      "1 <= k <= 100",
      "1 <= len(prices) <= 1000",
      "0 <= prices[i] <= 1000",
    ],
    approach:
      "Generalize the single-transaction and two-transaction DPs to arbitrary k with two rolling arrays: hold[j] = best profit while holding a share as part of transaction j, and cash[j] = best profit while flat, having completed transaction j. For each price and each j from 1..k: hold[j] = max(hold[j], cash[j-1] - price) (open transaction j, funded by having just closed j-1), cash[j] = max(cash[j], hold[j] + price) (close transaction j). Efficiency guard: once k >= n // 2, the transaction cap no longer binds -- you cannot fit more than n // 2 disjoint transactions into n days regardless -- so fall back to the unlimited-transactions greedy (sum every positive day-to-day delta) rather than pay O(n*k) for a k that's effectively infinite.",
    code: `def max_profit_k_transactions(prices: list[int], k: int) -> int:
    n = len(prices)
    if n < 2 or k == 0:
        return 0

    # k is unbounded in practice once it exceeds n // 2 -- no more disjoint
    # transactions than that can ever fit, so cap the DP width
    if k >= n // 2:
        return sum(max(prices[i + 1] - prices[i], 0) for i in range(n - 1))

    hold = [float('-inf')] * (k + 1)   # hold[j]: holding a share, j-th transaction open
    cash = [0] * (k + 1)               # cash[j]: flat, j transactions completed
    for price in prices:
        for j in range(1, k + 1):
            hold[j] = max(hold[j], cash[j - 1] - price)
            cash[j] = max(cash[j], hold[j] + price)
    return cash[k]`,
    language: "python",
    complexity: { time: "O(n*k), O(n) when the greedy fallback triggers", space: "O(k)" },
  },
  {
    id: "lc-expected-trades-win-streak",
    title: "Expected Number of Trades Until a Win Streak of Length K",
    difficulty: "hard",
    topics: ["probability", "dynamic-programming", "markov-chain"],
    problem:
      "A trader wins each individual trade independently with probability p. Compute the EXPECTED number of trades until the first time you observe k consecutive wins in a row. Do not simulate -- give a closed-form computation.",
    examples: [
      {
        input: "p=0.5, k=2",
        output: "6.0",
        explanation:
          "The well-known closed form for a fair coin gives (1 - 0.5^2) / (0.5 * 0.5^2) = 0.75 / 0.125 = 6.0 expected trades to see two wins in a row.",
      },
    ],
    constraints: ["0 < p < 1", "1 <= k <= 50"],
    approach:
      "Model states 0..k, where state i is the current win streak length and state k is absorbing (target reached). Let E[i] be the expected number of ADDITIONAL trades from state i. Playing one more trade from state i < k: with probability p the streak extends to i+1; with probability 1-p a single loss erases the ENTIRE streak, resetting to state 0, not to i-1. That gives E[i] = 1 + p*E[i+1] + (1-p)*E[0] with E[k] = 0 -- the same absorption-time recurrence family as the gambler's-ruin duration problem elsewhere in this bank. Solving that recurrence in closed form gives E[0] = (1 - p^k) / ((1-p) * p^k), computable in O(1) instead of solving a (k+1)-variable linear system or simulating.",
    code: `def expected_trades_to_streak(p: float, k: int) -> float:
    # closed form: E[trades to first run of k wins] = (1 - p^k) / ((1-p) * p^k),
    # derived from the state recurrence E[i] = 1 + p*E[i+1] + (1-p)*E[0], E[k]=0
    # -- same absorption-time family as the gambler's-ruin duration problem
    if p >= 1.0:
        return float(k)              # certain win every trade -- exactly k needed
    return (1.0 - p ** k) / ((1.0 - p) * p ** k)

# sanity checks
print(round(expected_trades_to_streak(0.5, 2), 2))   # 6.0
print(round(expected_trades_to_streak(0.6, 3), 2))    # higher edge shortens the wait`,
    language: "python",
    complexity: { time: "O(1) with the closed form", space: "O(1)" },
  },
  {
    id: "lc-design-rolling-volatility-tracker",
    title: "Design a Sliding-Window Realized Volatility Tracker",
    difficulty: "medium",
    topics: ["design", "streaming", "math"],
    problem:
      "Design a class that ingests a stream of daily returns via add(ret) and supports vol(), returning the realized volatility (standard deviation) of the most recent window returns, where window is fixed at construction. Both operations must run in O(1) time; older returns are dropped once the window is full.",
    examples: [
      {
        input:
          "window=3; add(0.01); add(-0.02); add(0.015); vol(); add(0.03); vol()",
        output:
          "first vol() = std of [0.01, -0.02, 0.015]; second vol() = std of [-0.02, 0.015, 0.03], with 0.01 evicted",
      },
    ],
    approach:
      "Recomputing std over the last `window` returns on every call is O(window) per query. Instead maintain running totals alongside a deque of the last `window` returns: a running sum and a running sum-of-squares. On add, push the new return and add it to both totals; once the deque exceeds window, pop the oldest return from the left and SUBTRACT it from both totals, keeping them in sync with exactly what's in the window. Variance is then sum_sq/n - (sum/n)^2, the computational (single-pass) formula, evaluated in O(1) from the two running totals -- vol is its square root. Tradeoff versus a textbook two-pass recompute: running sum-of-squares can lose precision to cancellation over a very long-running stream with large values, worth flagging even though it's harmless for a bounded, modest-size window.",
    code: `from collections import deque
import math

class RollingVolTracker:
    def __init__(self, window: int):
        self.window = window
        self.buf: deque[float] = deque()
        self.sum = 0.0
        self.sum_sq = 0.0

    def add(self, ret: float) -> None:
        self.buf.append(ret)
        self.sum += ret
        self.sum_sq += ret * ret
        if len(self.buf) > self.window:
            old = self.buf.popleft()          # evict the oldest return
            self.sum -= old
            self.sum_sq -= old * old          # keep both running totals in sync

    def vol(self) -> float:
        n = len(self.buf)
        if n < 2:
            return 0.0
        mean = self.sum / n
        # population variance from running totals -- O(1), no rescan needed
        var = max(self.sum_sq / n - mean * mean, 0.0)  # guard tiny negative float error
        return math.sqrt(var)`,
    language: "python",
    complexity: { time: "O(1) amortized per add/vol call", space: "O(window)" },
  },
];
