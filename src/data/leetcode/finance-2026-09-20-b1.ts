import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-20
// A fixed-size min-heap for streaming kth-largest trade size, a
// hashmap sliding window bounding distinct tickers, a k-transaction
// stock DP, an absorbing-Markov-chain credit default probability,
// and a streaming sliding-window VWAP calculator.
// ============================================================

export const financeBatch20260920: LeetCodeProblem[] = [
  {
    id: "lc-20260920-kth-largest-trade-stream",
    title: "Kth Largest Trade Size in a Live Stream",
    difficulty: "easy",
    topics: ["heap", "streaming"],
    problem:
      "Design a class KthLargestTradeSize that is initialized with an integer k and a list of initial trade sizes, and supports add(trade_size), which inserts a new trade size and returns the kth largest trade size among all trades seen so far.",
    examples: [
      {
        input: "k=3, initial=[4,5,8,2]; then add(3), add(5), add(10), add(9), add(4)",
        output: "[4, 5, 5, 8, 8]",
        explanation:
          "After add(3): sorted desc [8,5,4,3,2], 3rd largest is 4. After add(5): [8,5,5,4,3,2], 3rd largest is 5. After add(10): [10,8,5,5,4,3,2], 3rd largest is 5. After add(9): [10,9,8,5,5,4,3,2], 3rd largest is 8. After add(4): still 8.",
      },
    ],
    constraints: ["1 <= k <= 10^4", "trade sizes fit in a 32-bit int"],
    approach:
      "Maintain a min-heap of size exactly k holding the k largest trades seen so far; its root (the smallest of those k) is, by definition, the kth largest overall. On each add, push the new value then, if the heap exceeds size k, pop the smallest -- both operations are O(log k) regardless of how many trades have streamed in total, which is the whole point versus re-sorting the full history on every call. Seed the heap with the initial list the same way (push then trim) rather than sorting it and slicing, so initialization and streaming updates share one code path.",
    code: `import heapq

class KthLargestTradeSize:
    def __init__(self, k: int, initial: list[int]):
        self.k = k
        self.heap: list[int] = []   # min-heap, kept at size k: root is the kth largest
        for size in initial:
            self.add(size)

    def add(self, trade_size: int) -> int:
        heapq.heappush(self.heap, trade_size)
        # trim down to k -- the smallest of the k largest sits at the root
        if len(self.heap) > self.k:
            heapq.heappop(self.heap)
        return self.heap[0]

tracker = KthLargestTradeSize(3, [4, 5, 8, 2])
print([tracker.add(v) for v in [3, 5, 10, 9, 4]])   # [4, 5, 5, 8, 8]`,
    language: "python",
    complexity: { time: "O(log k) per add", space: "O(k)" },
  },
  {
    id: "lc-20260920-longest-window-k-distinct-tickers",
    title: "Longest Run of Trades With At Most K Distinct Tickers",
    difficulty: "medium",
    topics: ["sliding-window", "hash-table"],
    problem:
      "Given a chronological list of ticker symbols traded (one per tick) and an integer k, return the length of the longest contiguous run of ticks that contains at most k distinct tickers.",
    examples: [
      {
        input: 'tickers=["AAPL","AAPL","MSFT","MSFT","GOOG"], k=2',
        output: "4",
        explanation:
          'The window ["AAPL","AAPL","MSFT","MSFT"] (indices 0..3) has exactly 2 distinct tickers. Extending it to include GOOG would push the distinct count to 3, which exceeds k.',
      },
    ],
    constraints: ["1 <= tickers.length <= 10^5", "1 <= k <= 26"],
    approach:
      "Classic two-pointer sliding window with a hashmap counting occurrences of each ticker in the current window. Expand right one tick at a time, incrementing that ticker's count; whenever the map's SIZE (distinct ticker count, not total count) exceeds k, shrink from the left, decrementing counts and evicting a ticker from the map entirely once its count hits zero -- checking map size rather than rescanning the window on every step is what keeps this O(n) instead of O(n*k). Track the best window length after each expansion, since total steps only move forward even though the window's boundaries slide.",
    code: `from collections import defaultdict

def longest_window_k_distinct(tickers: list[str], k: int) -> int:
    counts: dict[str, int] = defaultdict(int)
    left = 0
    best = 0

    for right, ticker in enumerate(tickers):
        counts[ticker] += 1

        # shrink while too many DISTINCT tickers are in the window --
        # checking len(counts) is O(1), no need to rescan the window
        while len(counts) > k:
            left_ticker = tickers[left]
            counts[left_ticker] -= 1
            if counts[left_ticker] == 0:
                del counts[left_ticker]   # evict once fully out of the window
            left += 1

        best = max(best, right - left + 1)

    return best

print(longest_window_k_distinct(["AAPL", "AAPL", "MSFT", "MSFT", "GOOG"], 2))   # 4`,
    language: "python",
    complexity: { time: "O(n)", space: "O(k)" },
  },
  {
    id: "lc-20260920-max-profit-k-transactions",
    title: "Best Time to Buy and Sell Stock With At Most K Transactions",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices and an integer k, you may complete at most k buy-then-sell round trips (each must fully close before the next opens; no overlapping positions). Return the maximum achievable profit.",
    examples: [
      {
        input: "prices=[3,2,6,5,0,3], k=2",
        output: "7",
        explanation:
          "Buy at 2, sell at 6 (profit 4); buy at 0, sell at 3 (profit 3). Total 4+3=7, the best split into at most 2 round trips.",
      },
    ],
    constraints: ["1 <= prices.length <= 1000", "0 <= k <= 100", "0 <= prices[i] <= 1000"],
    approach:
      "Generalize the single-transaction-slot DP into k independent slots: hold[j] is the best profit while currently holding a share on your jth round trip, and cash[j] is the best profit while not holding, having completed at most j round trips. hold[j] updates from buying using cash[j-1] (opening trip j, funded by profit already banked from the first j-1 trips) -- that dependency on j-1 rather than j is what enforces the 'at most k, non-overlapping' constraint. cash[j] then updates from selling out of the just-updated hold[j]. Iterate days on the outer loop and slots 1..k in increasing order on the inner loop, so within a day cash[j-1] is already this day's updated value when hold[j] reads it -- closing trip j-1 and opening trip j on the same day is legal and the DP relies on that same-day chaining. One edge case worth handling explicitly: once k covers more than half the days, the cap never binds and the answer collapses to the unlimited-transactions greedy (sum of positive day-over-day deltas), which avoids paying O(n*k) when k is effectively unconstrained.",
    code: `def max_profit_k_transactions(prices: list[int], k: int) -> int:
    n = len(prices)
    if n == 0 or k == 0:
        return 0

    # once k covers more than half the days, the cap never binds --
    # falls back to the unlimited-transactions case, O(n) instead of O(n*k)
    if k >= n // 2:
        return sum(max(prices[i + 1] - prices[i], 0) for i in range(n - 1))

    hold = [float("-inf")] * (k + 1)   # hold[j]: best profit, holding, on round trip j
    cash = [0] * (k + 1)               # cash[j]: best profit, not holding, <= j trips done

    for price in prices:
        for j in range(1, k + 1):
            # buy first: funded by cash[j-1], already updated THIS day
            # (j-1 processed earlier in this same inner loop) -- closing
            # trip j-1 and opening trip j on the same day is allowed
            hold[j] = max(hold[j], cash[j - 1] - price)
            # sell second: closes trip j using the hold[j] just updated
            cash[j] = max(cash[j], hold[j] + price)

    return cash[k]

print(max_profit_k_transactions([3, 2, 6, 5, 0, 3], 2))   # 7`,
    language: "python",
    complexity: { time: "O(n*k)", space: "O(k)" },
  },
  {
    id: "lc-20260920-credit-migration-absorption",
    title: "Probability of Eventual Default in a Credit Rating Migration Chain",
    difficulty: "hard",
    topics: ["probability", "markov-chain", "linear-algebra"],
    problem:
      "You're given a credit rating transition matrix over n non-default ratings plus two absorbing outcomes, Default and Paid-Off: each year, a bond in rating i moves to rating j with probability trans[i][j], or is absorbed into Default with probability default_prob[i], or into Paid-Off with the remaining probability (each row of non-default probabilities plus default_prob plus paidoff_prob sums to 1). Given a starting rating, return the probability the bond is eventually absorbed into Default rather than Paid-Off, over an infinite time horizon.",
    examples: [
      {
        input: "trans=[[0.8,0.1],[0.2,0.5]], default_prob=[0.02,0.1], start=0",
        output: "0.25",
        explanation:
          "Using the fundamental matrix N=(I-Q)^-1 of the transient sub-chain Q=trans, the probability of absorption into Default from state i is row i of N dotted with the direct one-step default-probability vector; here that evaluates to 0.25 starting from state 0.",
      },
    ],
    constraints: ["1 <= n <= 50", "all probabilities in [0,1]", "each full row (transient probs plus default_prob plus paidoff_prob) sums to 1"],
    approach:
      "This is the classic absorbing Markov chain setup: split the state space into transient states (the credit ratings) and absorbing states (Default, Paid-Off). Instead of simulating forward for many years and hoping it converges, solve for the exact answer directly. Let Q be the transient-to-transient transition matrix and d be the vector of direct one-step default probabilities from each transient state. The fundamental matrix N=(I-Q)^-1 has a clean interpretation: entry N[i][j] is the expected number of times the chain visits transient state j before absorption, starting from i. The absorption probability vector into Default is then B=N@d, since summing expected visits to j times the probability of defaulting FROM j in one step, over all j, gives exactly the total probability of eventually defaulting. One linear solve, exact, not a simulation cut off at some horizon.",
    code: `import numpy as np

def probability_of_default(
    trans: list[list[float]],
    default_prob: list[float],
    start: int,
) -> float:
    Q = np.array(trans)               # transient-to-transient transitions
    d = np.array(default_prob)        # direct one-step default probability per state
    n = Q.shape[0]

    # fundamental matrix: N[i][j] = expected visits to state j before
    # absorption, starting from i -- solves the infinite-horizon sum in
    # one linear solve instead of simulating forward and hoping it converges
    N = np.linalg.inv(np.eye(n) - Q)

    # total default probability from each start state = expected visits
    # to each transient state, weighted by that state's own default rate
    B = N @ d
    return float(B[start])

trans = [[0.8, 0.1], [0.2, 0.5]]
default_prob = [0.02, 0.1]
print(round(probability_of_default(trans, default_prob, start=0), 4))   # 0.25`,
    language: "python",
    complexity: { time: "O(n^3) for the matrix inverse", space: "O(n^2)" },
  },
  {
    id: "lc-20260920-design-sliding-vwap",
    title: "Design a Sliding-Time-Window VWAP Calculator",
    difficulty: "medium",
    topics: ["design", "queue"],
    problem:
      "Design a class that ingests trades as they arrive, each with a strictly increasing timestamp, a price, and a size, and supports get_vwap(), returning the volume-weighted average price (sum of price times size, divided by sum of size) over only the trades within the trailing window_seconds seconds of the most recent trade.",
    examples: [
      {
        input: "window_seconds=60; add_trade(t=0,price=100,size=10); add_trade(t=30,price=102,size=5); add_trade(t=70,price=105,size=20); get_vwap()",
        output: "104.4",
        explanation:
          "The trade at t=0 falls outside the trailing 60-second window once the trade at t=70 arrives (70-60=10, and 0<=10), so only the t=30 and t=70 trades remain: (102*5+105*20)/(5+20) = 2610/25 = 104.4.",
      },
    ],
    constraints: ["timestamps strictly increasing", "1 <= window_seconds <= 10^6", "sizes positive"],
    approach:
      "Maintain a deque of (timestamp, price, size) for trades currently inside the window, plus two running accumulators, sum of price times size and sum of size, so get_vwap is O(1) instead of re-summing the whole window on every call. On each add_trade, append the new trade and add its contribution to both accumulators, then evict from the LEFT any trades whose timestamp now falls at or before latest_ts minus window_seconds, subtracting each evicted trade's contribution from the accumulators before dropping it. Because timestamps are strictly increasing, the window's left edge only ever moves forward, so each trade is appended once and evicted at most once across the whole run -- the eviction loop is amortized O(1) per trade, the same argument as a monotonic-deque sliding window.",
    code: `from collections import deque

class SlidingVWAP:
    def __init__(self, window_seconds: float):
        self.window = window_seconds
        self.trades: deque[tuple[float, float, float]] = deque()  # (ts, price, size)
        self.sum_pv = 0.0   # running sum of price * size
        self.sum_v = 0.0    # running sum of size

    def add_trade(self, ts: float, price: float, size: float) -> None:
        self.trades.append((ts, price, size))
        self.sum_pv += price * size
        self.sum_v += size

        # evict trades that fell out of the trailing window -- each trade
        # is evicted at most once total, so this amortizes to O(1)/trade
        cutoff = ts - self.window
        while self.trades and self.trades[0][0] <= cutoff:
            old_ts, old_price, old_size = self.trades.popleft()
            self.sum_pv -= old_price * old_size
            self.sum_v -= old_size

    def get_vwap(self) -> float:
        if self.sum_v == 0:
            return 0.0
        return self.sum_pv / self.sum_v

vwap = SlidingVWAP(window_seconds=60)
vwap.add_trade(0, 100, 10)
vwap.add_trade(30, 102, 5)
vwap.add_trade(70, 105, 20)
print(round(vwap.get_vwap(), 4))   # 104.4`,
    language: "python",
    complexity: { time: "O(1) amortized per add_trade, O(1) for get_vwap", space: "O(w) trades held in the window" },
  },
];
