import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-09
// Heaps, monotonic-deque sliding window, stock DP, a Markov
// steady-state problem, and a streaming design problem.
// ============================================================

export const financeBatch20260809: LeetCodeProblem[] = [
  {
    id: "lc-top-k-volume-movers",
    title: "Top-K Volume Movers (Streaming)",
    difficulty: "medium",
    topics: ["heap", "streaming", "top-k"],
    problem:
      "You receive a live stream of (ticker, volume) updates -- each update REPLACES that ticker's current volume, it is not a delta. At any point, return the K tickers with the highest current volume, in descending order. Support update(ticker, volume) and top_k() for a stream where the same ticker updates repeatedly throughout the day.",
    examples: [
      {
        input:
          "update('AAPL',100); update('MSFT',300); update('AAPL',500); top_k(2)",
        output: "[('AAPL', 500), ('MSFT', 300)]",
        explanation:
          "AAPL's second update replaces its volume, so the first (100) entry must not count toward top_k.",
      },
    ],
    constraints: ["1 <= K <= number of distinct tickers", "up to 10^6 updates in the stream"],
    approach:
      "The obvious re-sort-everything-per-query approach is O(n log n) per top_k call. Instead keep a dict of ticker -> current (latest) volume as the single source of truth, and a max-heap (via negation) that lazily accumulates one entry per update rather than per ticker -- old entries for a ticker that has since updated again are left in place and simply detected as stale later. On top_k(), pop entries off the heap; an entry is stale if its cached volume no longer matches the dict's current value for that ticker, or if that ticker was already collected from an earlier (fresher) pop this query -- skip both cases. Push every popped entry back afterward so future queries can still use it. This is the same lazy-deletion pattern used for a changing-key heap elsewhere in this bank, applied to a top-K query instead of an order book.",
    code: `import heapq

class TopKVolumeTracker:
    def __init__(self, k: int):
        self.k = k
        self.volume: dict[str, int] = {}          # ticker -> current (latest) volume
        self.heap: list[tuple[int, str]] = []      # lazy max-heap via negation: (-volume, ticker)

    def update(self, ticker: str, volume: int) -> None:
        self.volume[ticker] = volume
        heapq.heappush(self.heap, (-volume, ticker))   # old heap entries for this ticker go stale

    def top_k(self) -> list[tuple[str, int]]:
        result = []
        popped = []
        seen = set()
        while self.heap and len(result) < self.k:
            neg_vol, ticker = heapq.heappop(self.heap)
            popped.append((neg_vol, ticker))
            if ticker in seen:
                continue                                    # duplicate stale entry for this ticker
            seen.add(ticker)
            if -neg_vol != self.volume[ticker]:
                continue                                    # stale: volume changed since this was pushed
            result.append((ticker, self.volume[ticker]))
        for entry in popped:                                 # push everything back for future queries
            heapq.heappush(self.heap, entry)
        return result`,
    language: "python",
    complexity: { time: "O(log n) per update; O(k log n) amortized per top_k", space: "O(number of updates)" },
  },
  {
    id: "lc-longest-consolidation-window",
    title: "Longest Consolidation Window (Bounded Price Range)",
    difficulty: "medium",
    topics: ["sliding-window", "monotonic-deque", "two-pointer"],
    problem:
      "Given daily closing prices and a range threshold band, find the length of the longest contiguous run of days during which the price stayed within a band of width band -- i.e. max(window) - min(window) <= band, a simple consolidation / range-bound detector. Do it in O(n), not O(n^2) or O(n log n).",
    examples: [
      {
        input: "prices=[10,10.5,10.2,9.8,10.1,15,15.3,15.1], band=1.0",
        output: "5",
        explanation:
          "Days 0-4 ([10,10.5,10.2,9.8,10.1]) have range 0.7 <= 1.0, length 5. The later run [15,15.3,15.1] has range 0.3 but length only 3.",
      },
    ],
    approach:
      "Maintain two monotonic deques over the current window [left, right]: max_dq keeps indices with strictly decreasing price (front = window max), min_dq keeps indices with strictly increasing price (front = window min) -- the same technique as a trailing-stop window max, run twice. For each right, push into both deques while popping anything from the back that can no longer be the extreme. Then while the window's range (max_dq front minus min_dq front) exceeds band, advance left, popping expired indices from the front of both deques. The key correctness fact that makes shrink-only-from-left valid here: range is monotonically non-decreasing as a window widens -- adding an element can only raise the max, lower the min, or leave both unchanged -- so once left has advanced past some index for a given right, it never needs to move back for any larger right. (Standard deviation does NOT have this property, which is why a naive two-pointer over std would be unsound -- range is the safe choice.)",
    code: `from collections import deque

def longest_consolidation(prices: list[float], band: float) -> int:
    max_dq: deque[int] = deque()   # indices, prices strictly decreasing front-to-back
    min_dq: deque[int] = deque()   # indices, prices strictly increasing front-to-back
    left = 0
    best = 0
    for right, p in enumerate(prices):
        while max_dq and prices[max_dq[-1]] <= p:
            max_dq.pop()
        max_dq.append(right)
        while min_dq and prices[min_dq[-1]] >= p:
            min_dq.pop()
        min_dq.append(right)

        # range (max - min) only grows as the window widens, so shrinking
        # left is the correct, sufficient move whenever the band is broken
        while prices[max_dq[0]] - prices[min_dq[0]] > band:
            left += 1
            if max_dq[0] < left:
                max_dq.popleft()
            if min_dq[0] < left:
                min_dq.popleft()

        best = max(best, right - left + 1)
    return best`,
    language: "python",
    complexity: { time: "O(n) amortized", space: "O(window)" },
  },
  {
    id: "lc-buy-sell-cooldown",
    leetcodeNumber: 309,
    title: "Best Time to Buy and Sell Stock with Cooldown",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Maximize profit trading a single stock with unlimited transactions, but after selling you must wait one full day (cooldown) before buying again -- you cannot buy on the day immediately following a sell.",
    examples: [
      {
        input: "prices = [1,2,3,0,2]",
        output: "3",
        explanation: "Buy day0 (1), sell day1 (2) for +1; cooldown day2; buy day3 (0), sell day4 (2) for +2; total profit 3, respecting the one-day cooldown after each sell.",
      },
    ],
    approach:
      "Three rolling states per day, no array needed: hold (currently own a share), sold (sold today, entering cooldown tomorrow), rest (no share, not in cooldown, free to buy today). Transitions each day: new hold is the better of keep-holding or buy-today-from-rest; new sold is old-hold plus today's price (sell whatever was held); new rest is the better of stay-resting or cooldown-just-ended-from-yesterday's-sold. Answer is the max of sold and rest after the last day -- ending in hold is never optimal since an open position captures no more upside once the data ends. All three states update in O(1) per day, so the full pass is O(n) time and O(1) space, versus an O(n) array of 3 states which also works but is not necessary.",
    code: `def max_profit_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0
    hold = float('-inf')   # own a share
    sold = 0                # just sold today (entering cooldown tomorrow)
    rest = 0                # no share, free to buy (not in cooldown)
    for p in prices:
        prev_sold = sold
        sold = hold + p                       # sell whatever we were holding
        hold = max(hold, rest - p)             # keep holding, or buy today from rest
        rest = max(rest, prev_sold)            # stay resting, or cooldown just ended
    return max(sold, rest)`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-markov-regime-steady-state",
    title: "Steady-State Probabilities of a Market Regime Chain",
    difficulty: "hard",
    topics: ["probability", "markov-chain", "linear-algebra"],
    problem:
      "A simple regime model classifies each trading day as Trending, Mean-Reverting, or Choppy, with a given day-to-day transition probability matrix P (rows sum to 1). Compute the long-run (stationary) fraction of days spent in each regime -- the distribution pi such that pi = pi @ P -- without simulating thousands of days.",
    examples: [
      {
        input: "P = [[0.7,0.2,0.1],[0.3,0.5,0.2],[0.2,0.3,0.5]]",
        output: "pi ~ [0.500, 0.300, 0.200]",
        explanation: "Solved directly as a linear system, not by iterating the chain forward.",
      },
    ],
    approach:
      "The stationary distribution solves pi @ P = pi with sum(pi) = 1, i.e. pi is the left eigenvector of P for eigenvalue 1, normalized to sum to 1. Equivalently, transpose to a standard linear system: (P^T - I) @ pi = 0. That system is singular by construction (a stochastic matrix always has 1 as an eigenvalue, so P^T - I has a nontrivial null space), so solve it by replacing one redundant row with the normalization constraint sum(pi) = 1 and using a direct linear solve -- far more precise than iterating pi_next = pi @ P until convergence, though power iteration is a good independent sanity check since it should converge to the same answer.",
    code: `import numpy as np

def stationary_distribution(P: np.ndarray) -> np.ndarray:
    n = P.shape[0]
    # solve pi @ P = pi, sum(pi) = 1
    # transpose to a standard linear system: (P^T - I) pi = 0, plus normalization
    A = (P.T - np.eye(n))
    A[-1, :] = 1.0                 # replace one (redundant) equation with sum(pi) = 1
    b = np.zeros(n)
    b[-1] = 1.0
    pi = np.linalg.solve(A, b)
    return pi

P = np.array([
    [0.7, 0.2, 0.1],   # Trending -> {Trending, Mean-Reverting, Choppy}
    [0.3, 0.5, 0.2],
    [0.2, 0.3, 0.5],
])
pi = stationary_distribution(P)
print(np.round(pi, 3))          # long-run fraction of days in each regime

# sanity check via power iteration (should converge to the same pi)
def power_iterate(P, iters=2000):
    n = P.shape[0]
    v = np.full(n, 1.0 / n)
    for _ in range(iters):
        v = v @ P
    return v

print(np.round(power_iterate(P), 3))`,
    language: "python",
    complexity: { time: "O(n^3) for the linear solve (n = number of regimes)", space: "O(n^2)" },
  },
  {
    id: "lc-vwap-tracker-design",
    title: "Design a Sliding-Window VWAP Tracker",
    difficulty: "medium",
    topics: ["design", "queue", "streaming"],
    problem:
      "Design a tracker, constructed with a fixed window_size (number of most recent trades), that ingests a stream of trades via trade(price, size) and answers vwap() queries for the volume-weighted average price over the last window_size trades -- both operations O(1) amortized, not O(window_size) per query.",
    examples: [
      {
        input: "window_size=2; trade(10,100); trade(11,50); trade(9,200); vwap()",
        output: "9.4",
        explanation:
          "Only the last 2 trades count: (11*50 + 9*200) / (50 + 200) = 2350 / 250 = 9.4.",
      },
    ],
    approach:
      "Maintain a deque of the most recent trades plus two running accumulators: notional_sum (sum of price*size over the window) and size_sum (sum of size over the window). On each new trade, append it and add its contribution to both sums; if the deque now exceeds window_size, pop the oldest trade from the left and SUBTRACT its contribution from both sums rather than re-scanning the window. A vwap() query then reads straight off the two accumulators in O(1) -- no iteration over the window at query time. This is the same incremental-window-sum idea used for O(1) rolling statistics elsewhere in this bank, here exposed as a streaming class interface instead of a one-shot array pass.",
    code: `from collections import deque

class VWAPTracker:
    def __init__(self, window_size: int):
        self.window_size = window_size
        self.trades: deque[tuple[float, float]] = deque()   # (price, size), oldest at the left
        self.notional_sum = 0.0     # running sum of price * size in the window
        self.size_sum = 0.0         # running sum of size in the window

    def trade(self, price: float, size: float) -> None:
        self.trades.append((price, size))
        self.notional_sum += price * size
        self.size_sum += size
        if len(self.trades) > self.window_size:
            old_price, old_size = self.trades.popleft()
            self.notional_sum -= old_price * old_size   # incrementally remove the evicted trade
            self.size_sum -= old_size

    def vwap(self) -> float:
        if self.size_sum == 0:
            return 0.0
        return self.notional_sum / self.size_sum        # O(1): no re-scan of the window`,
    language: "python",
    complexity: { time: "O(1) amortized per trade() and per vwap()", space: "O(window_size)" },
  },
];
