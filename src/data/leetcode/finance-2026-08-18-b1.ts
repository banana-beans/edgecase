import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-18
// A capped min-heap for top-k realized P&L trades, a fixed
// sliding window for the best k-day price average, a long/short
// unlimited-transaction profit problem, a coupon-collector
// expected-value problem for regime coverage, and a Welford's-
// algorithm real-time Sharpe ratio tracker design problem.
// ============================================================

export const financeBatch20260818: LeetCodeProblem[] = [
  {
    id: "lc-k-largest-realized-pnl-trades",
    title: "K Largest Realized P&L Trades From a Closed-Trade Log",
    difficulty: "easy",
    topics: ["heap"],
    problem:
      "Given a list of realized P&L values from a closed-trade log (one float per closed round-trip trade) and an integer k, return the k largest P&L values, in descending order.",
    examples: [
      {
        input: "pnls=[120.5, -30.0, 875.2, 40.0, -500.0, 210.0], k=3",
        output: "[875.2, 210.0, 120.5]",
        explanation:
          "The three largest realized P&Ls in the log, sorted descending -- the -500.0 and -30.0 losing trades and the 40.0 winner are all excluded since they don't make the top 3.",
      },
    ],
    constraints: ["1 <= k <= len(pnls) <= 10^5"],
    approach:
      "Sorting the whole log and slicing off the top k costs O(n log n), which is wasted work when k is small relative to n -- a running trade log easily has 10^5+ entries but a risk desk usually only wants the top 10-20. Maintain a min-heap capped at size k: push each P&L, and whenever the heap would exceed size k, pop its smallest element (or just skip anything smaller than the current heap minimum once the heap is full). After one pass, the heap holds exactly the k largest values, in O(n log k) instead of O(n log n) -- the smaller k is relative to n, the bigger the win. Sort the final k-sized heap (cheap, since k is small) to return the result in descending order.",
    code: `import heapq

def k_largest_pnls(pnls: list[float], k: int) -> list[float]:
    heap: list[float] = []
    for p in pnls:
        if len(heap) < k:
            heapq.heappush(heap, p)
        elif p > heap[0]:
            heapq.heapreplace(heap, p)   # p beats the current smallest of the top-k
    return sorted(heap, reverse=True)`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-max-average-window-smoothed-price",
    title: "Maximum Average Price Over Any Window of Length K",
    difficulty: "easy",
    topics: ["sliding-window"],
    problem:
      "Given a series of daily closing prices and a fixed window length k, return the maximum average closing price over any k consecutive trading days -- the best k-day smoothing window in the series.",
    examples: [
      {
        input: "prices=[10,12,9,15,20,7,8], k=3",
        output: "14.67",
        explanation:
          "Window [9,15,20] averages (9+15+20)/3 = 14.67, the best 3-day window in the series -- better than the flatter windows at either end.",
      },
    ],
    constraints: ["1 <= k <= len(prices) <= 10^5"],
    approach:
      "Recomputing the sum of each window from scratch is O(nk); since consecutive windows overlap in all but one element, maintain a running sum instead: slide the window by adding the element entering on the right and subtracting the one leaving on the left, giving O(1) work per step after the first window is built in O(k). Track the maximum running SUM seen, not the average, to avoid repeated division inside the loop, and divide once by k at the very end.",
    code: `def max_average_window(prices: list[float], k: int) -> float:
    window_sum = sum(prices[:k])
    best_sum = window_sum

    for i in range(k, len(prices)):
        window_sum += prices[i] - prices[i - k]   # slide: add new day, drop old day
        best_sum = max(best_sum, window_sum)

    return best_sum / k`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-max-profit-long-short-unlimited",
    title: "Max Profit With Unlimited Transactions, Allowing Both Long and Short Round-Trips",
    difficulty: "medium",
    topics: ["dynamic-programming", "greedy"],
    problem:
      "Given daily prices, you may take unlimited round-trip trades, each either a LONG (buy then sell) or a SHORT (sell-to-open then buy-to-cover), with at most one position open at a time and no overlap between trades. Return the maximum total achievable profit.",
    examples: [
      {
        input: "prices=[5,3,8,2,9]",
        output: "20",
        explanation:
          "Short the 5->3 drop (+2), go long the 3->8 rise (+5), short the 8->2 drop (+6), go long the 2->9 rise (+7). Total 2+5+6+7=20 -- every single day-to-day move gets captured by picking the matching side.",
      },
    ],
    constraints: ["1 <= len(prices) <= 10^5"],
    approach:
      "Because both long and short round-trips are allowed with no fee and no cap on transaction count, the optimal strategy decomposes into capturing every single consecutive day-to-day price move in whichever direction it goes -- go long across every up-move (buy at the local trough, sell at the local peak) and short across every down-move (sell at the local peak, cover at the local trough). There's no benefit to holding through a move in the 'wrong' direction, since you could always exit and immediately re-enter on the opposite side to capture more profit instead -- so the closed-form answer is just the sum of the absolute values of consecutive daily price differences, with no explicit DP table needed (though it's easy to also derive from one, tracking hold-long, hold-short, and cash states day by day, and confirming they collapse to exactly this sum).",
    code: `def max_profit_long_short(prices: list[float]) -> float:
    if len(prices) < 2:
        return 0.0
    # every up-move is captured going long, every down-move captured going short --
    # unlimited fee-free round trips means summing |consecutive diffs| is optimal
    return sum(abs(prices[i] - prices[i - 1]) for i in range(1, len(prices)))`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-coupon-collector-regimes",
    title: "Expected Number of Ticks to Observe Every Market Regime At Least Once",
    difficulty: "hard",
    topics: ["probability", "expected-value"],
    problem:
      "A regime classifier labels each tick with one of n equally likely market regimes, independently each tick. Return the expected number of ticks needed to have seen every one of the n regimes at least once.",
    examples: [
      {
        input: "n=4",
        output: "8.33",
        explanation:
          "This is the coupon collector's problem: expected ticks = n * (1 + 1/2 + 1/3 + 1/4) = 4 * 2.0833 = 8.33.",
      },
    ],
    constraints: ["1 <= n <= 10^4"],
    approach:
      "This is the classic coupon collector's problem in disguise: after already having seen k distinct regimes, the probability the NEXT tick reveals a brand-new regime is (n-k)/n, so the number of ticks to wait for the next new regime is geometrically distributed with expectation n/(n-k). Summing that expectation over k = 0 up to n-1 (going from 0 distinct regimes seen to n-1 seen, waiting each time for the next new one) telescopes into E[T] = n times the n-th harmonic number, sum of 1/i for i=1..n. This is exact, not a simulation approximation, and the harmonic sum has the well-known ln(n) plus the Euler-Mascheroni constant asymptotic, so E[T] grows like n*ln(n) for large n -- collecting the last few rare regimes dominates the total wait, not the first ones seen early on.",
    code: `def expected_ticks_all_regimes(n: int) -> float:
    if n <= 0:
        return 0.0
    # harmonic number H_n = sum of 1/i for i=1..n
    harmonic = sum(1.0 / i for i in range(1, n + 1))
    return n * harmonic`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-design-realtime-sharpe-tracker",
    title: "Design a Real-Time Sharpe Ratio Tracker",
    difficulty: "medium",
    topics: ["design", "math"],
    problem:
      "Design a class supporting add_return(r), which records a new daily strategy return, and sharpe(), which returns the current annualized Sharpe ratio (mean divided by standard deviation of all returns seen so far, scaled by sqrt(252)) in O(1) time per call, without storing or rescanning the full return history.",
    examples: [
      {
        input: "add_return(0.01); add_return(-0.005); add_return(0.02); sharpe()",
        output: "an annualized Sharpe computed purely from running statistics",
        explanation:
          "Mean, count, and sum of squared deviations are all maintained incrementally on each add_return call, so sharpe() is a constant-time read of those three running values rather than a rescan of stored history.",
      },
    ],
    approach:
      "Recomputing mean and standard deviation from scratch on every sharpe() call means rescanning the whole history, O(n) per query -- fine for a one-off report but wasteful for something queried every tick. Welford's online algorithm maintains a running count n, running mean, and running sum of squared deviations from the mean (M2) with O(1) update work per new data point and no need to store the raw returns at all; variance falls straight out as M2/(n-1), and Sharpe is just mean/std scaled by sqrt(252). The key numerical trick in Welford's update is computing the new mean first, then updating M2 using BOTH the old and new mean in the same step -- naively accumulating sum and sum-of-squares separately and subtracting at the end is simpler code but loses precision badly for returns with a large mean relative to their variance, a classic catastrophic-cancellation trap.",
    code: `import math

class SharpeTracker:
    def __init__(self):
        self.n = 0
        self.mean = 0.0
        self.m2 = 0.0   # running sum of squared deviations (Welford's algorithm)

    def add_return(self, r: float) -> None:
        self.n += 1
        delta = r - self.mean
        self.mean += delta / self.n
        delta2 = r - self.mean          # uses the UPDATED mean, not the old one
        self.m2 += delta * delta2

    def sharpe(self, periods_per_year: int = 252) -> float:
        if self.n < 2:
            return 0.0
        variance = self.m2 / (self.n - 1)   # sample variance
        std = math.sqrt(variance)
        if std == 0.0:
            return 0.0
        return (self.mean / std) * math.sqrt(periods_per_year)`,
    language: "python",
    complexity: {
      time: "O(1) per add_return and per sharpe() call",
      space: "O(1)",
    },
  },
];
