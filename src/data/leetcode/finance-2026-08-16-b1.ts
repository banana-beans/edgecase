import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-16
// A lazy-deletion heap for top-k volume movers under overwrite
// updates, a monotonic-deque window bounded by a volatility
// band, a transaction-fee stock DP, a credit-rating Markov
// chain solved via matrix exponentiation, and a rolling VWAP
// tracker design problem.
// ============================================================

export const financeBatch20260816: LeetCodeProblem[] = [
  {
    id: "lc-top-k-volume-movers",
    title: "Top-K Volume Movers With Streaming Updates",
    difficulty: "medium",
    topics: ["heap", "hash-map"],
    problem:
      "You receive a stream of (ticker, volume) updates where each update OVERWRITES that ticker's current volume (not adds to it). After each update, return the k tickers with the highest current volume, in descending order of volume, ties broken alphabetically by ticker.",
    examples: [
      {
        input:
          'updates=[("AAPL",100),("MSFT",200),("AAPL",150),("GOOG",300)], k=2',
        output: '[["AAPL"], ["MSFT","AAPL"], ["MSFT","AAPL"], ["GOOG","MSFT"]]',
        explanation:
          "After update 3, AAPL's volume is overwritten from 100 to 150 -- MSFT (200) still leads, so the top-2 stays [MSFT, AAPL] even though AAPL's own value changed. After update 4, GOOG's 300 overtakes both.",
      },
    ],
    constraints: ["1 <= len(updates) <= 10^5", "1 <= k <= number of distinct tickers"],
    approach:
      "Overwriting volumes (not incrementing them) means a ticker's OLD value becomes stale the instant it's updated again -- the same lazy-deletion problem as a sliding-window median, since a heap doesn't support efficient in-place updates to an arbitrary entry. Push every new (-volume, ticker) pair onto a min-heap (negated so the largest volume sits at the top) and mark the ticker's previous entry as stale in a counter whenever it's overwritten. Before reading off the top-k, prune any heap-top entries whose counter says they're stale. Popped-but-fresh entries get pushed straight back after being read, since they're still the genuine top-k -- only entries that were superseded by a newer update for the same ticker ever get discarded for good.",
    code: `import heapq
from collections import Counter

def top_k_volume_movers(updates: list[tuple[str, int]], k: int) -> list[list[str]]:
    current: dict[str, int] = {}       # ticker -> true current volume
    heap: list[tuple[int, str]] = []   # (-volume, ticker); may hold stale entries
    stale: Counter = Counter()          # (-volume, ticker) -> pending-removal count
    results: list[list[str]] = []

    def prune() -> None:
        while heap and stale[heap[0]] > 0:
            stale[heap[0]] -= 1
            heapq.heappop(heap)

    for ticker, volume in updates:
        if ticker in current:
            stale[(-current[ticker], ticker)] += 1   # old entry is now stale
        current[ticker] = volume
        heapq.heappush(heap, (-volume, ticker))
        prune()

        # pull off up to k fresh entries (prune keeps the top genuinely
        # fresh at every step), then push them straight back
        top: list[str] = []
        buffer: list[tuple[int, str]] = []
        while heap and len(top) < k:
            entry = heapq.heappop(heap)
            buffer.append(entry)
            top.append(entry[1])
            prune()
        for entry in buffer:
            heapq.heappush(heap, entry)
        results.append(top)

    return results`,
    language: "python",
    complexity: {
      time: "O(u * k log u) amortized over the stream",
      space: "O(u) for accumulated stale entries",
    },
  },
  {
    id: "lc-longest-window-volatility-band",
    title: "Longest Window Where Price Stays Within a Volatility Band",
    difficulty: "hard",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given a chronological list of prices and a maximum allowed band width, find the length of the longest contiguous window where the difference between the window's highest and lowest price does not exceed the band width.",
    examples: [
      {
        input: "prices=[8, 2, 4, 7], limit=4",
        output: "2",
        explanation:
          "Window [2,4] has range 2 and window [4,7] has range 3, both within limit=4, each length 2. No length-3 window stays within the band: [8,2,4] has range 6, [2,4,7] has range 5.",
      },
    ],
    constraints: ["1 <= len(prices) <= 10^5"],
    approach:
      "Recomputing max and min for every candidate window from scratch is O(n) per window, O(n^2) total. As the window slides, only the RUNNING max and min matter, and both can be tracked with a monotonic deque: the max-deque holds indices with strictly decreasing prices so its front is always the window's current max, the min-deque mirrors that increasingly. When a new price arrives, pop everything off the BACK of each deque that it dominates -- a new price at least as high can never lose to an older, lower max-candidate again, so that older candidate is permanently useless -- before pushing the new index on. Whenever the current max-min band exceeds the limit, shrink the window from the left, evicting any deque-front index that has aged out. Each index enters and leaves each deque at most once across the whole scan, so total deque work is O(n) despite the nested loops. A heap would track the global extreme efficiently but can't evict an arbitrary aged-out element without the same lazy-deletion bookkeeping seen elsewhere -- the monotonic deque sidesteps that entirely, since its front is always automatically the in-window extreme.",
    code: `from collections import deque

def longest_window_within_band(prices: list[float], limit: float) -> int:
    max_deque: deque = deque()   # decreasing prices; front = window max
    min_deque: deque = deque()   # increasing prices; front = window min
    left = 0
    best = 0

    for right, price in enumerate(prices):
        while max_deque and prices[max_deque[-1]] <= price:
            max_deque.pop()
        max_deque.append(right)
        while min_deque and prices[min_deque[-1]] >= price:
            min_deque.pop()
        min_deque.append(right)

        while prices[max_deque[0]] - prices[min_deque[0]] > limit:
            left += 1
            if max_deque[0] < left:
                max_deque.popleft()
            if min_deque[0] < left:
                min_deque.popleft()

        best = max(best, right - left + 1)

    return best`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-max-profit-transaction-fee",
    title: "Max Profit With a Flat Fee Per Round-Trip Trade",
    difficulty: "medium",
    topics: ["dynamic-programming", "greedy"],
    problem:
      "Given daily prices and a flat fee charged once per completed round-trip trade (buy then sell), with unlimited transactions allowed but no overlapping holdings, return the maximum achievable profit after fees.",
    examples: [
      {
        input: "prices=[1,3,2,8,4,9], fee=2",
        output: "8",
        explanation:
          "Buy at 1, sell at 8: profit 7, minus the 2 fee, nets 5. Buy at 4, sell at 9: profit 5, minus the 2 fee, nets 3. Total 5 + 3 = 8, more than any other combination once fees are accounted for.",
      },
    ],
    constraints: ["1 <= len(prices) <= 5 * 10^4", "0 <= fee <= 10^4"],
    approach:
      "Same hold/cash state-machine DP as the cooldown and k-transaction variants, collapsed to two states since there's no cooldown and no cap on transaction count -- only a cost. Charge the fee exactly once per completed round trip by subtracting it at the SELL transition (charging it at buy instead would work identically, since it's paid exactly once either way); charging it at both would double-count, and forgetting it entirely collapses this back into the fee-free unlimited-transactions problem, which greedily captures every tiny positive up-tick that a real fee would actually make unprofitable. Because a transaction now has a real cost, that greedy 'sum every positive daily delta' shortcut no longer applies -- it only holds in the fee-free version, since with a fee, summing tiny deltas systematically overtrades and racks up more in fees than the captured moves are worth. The DP instead has to weigh holding through a small dip against paying to round-trip out and back in.",
    code: `def max_profit_with_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0
    cash = 0                  # flat, no position
    hold = -prices[0]         # holding, bought on day 0

    for price in prices[1:]:
        # sell today (pay the fee once per round trip) or stay flat
        cash = max(cash, hold + price - fee)
        # buy today (funded by being flat) or keep holding
        hold = max(hold, cash - price)

    return cash`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-rating-migration-default-probability",
    title: "Credit Rating Migration: Probability of Default Within N Years",
    difficulty: "hard",
    topics: ["probability", "matrix-exponentiation", "markov-chain"],
    problem:
      "Given a one-year credit rating transition matrix (rows are the current rating, columns the next year's rating, each row summing to 1, with Default as an absorbing state), a starting rating, and a horizon of N years, return the probability of having transitioned into Default at or before the end of year N.",
    examples: [
      {
        input:
          "P=[[0.90,0.08,0.02],[0.10,0.80,0.10],[0.00,0.00,1.00]] (order A,B,Default), start=A, n_years=2",
        output: "0.046",
        explanation:
          "P squared gives the two-year transition matrix directly; entry (A, Default) of P^2 is 0.9*0.02 + 0.08*0.10 + 0.02*1.00 = 0.018 + 0.008 + 0.02 = 0.046, the probability of reaching Default by year 2 starting from A.",
      },
    ],
    constraints: ["2 <= number of ratings <= 20", "1 <= n_years <= 100"],
    approach:
      "This is a discrete-time Markov chain with Default as an absorbing state, so the probability of being in Default after N years starting from rating r is exactly the (r, Default) entry of P raised to the N-th power. Multiplying the starting distribution by P in a loop N times is O(N * s^2) for s ratings -- fine for a small horizon, wasteful for something like a 30-year cumulative curve evaluated across many starting ratings. The standard speed-up is matrix exponentiation by squaring: compute P^N in O(s^3 log N) by repeatedly squaring the matrix and multiplying in the bits of N's binary representation, the same technique used for fast Fibonacci-via-matrix-power. Economically, this is exactly how a one-year transition matrix -- the only thing directly observable from historical migration data -- gets turned into a multi-year cumulative default curve, under the Markov assumption that next year's transition depends only on this year's rating, not the path taken to get there. Simulating the chain year by year with random draws and averaging over many trials is strictly worse here on both speed and precision, since the exact answer is one matrix power away; Monte Carlo earns its keep only when transitions are path-dependent or the state space is too large to exponentiate directly.",
    code: `import numpy as np

def default_probability_n_years(transition: np.ndarray, start_idx: int,
                                  default_idx: int, n_years: int) -> float:
    # matrix exponentiation by squaring: O(s^3 log n) instead of O(n * s^2)
    def mat_power(m: np.ndarray, power: int) -> np.ndarray:
        result = np.eye(m.shape[0])
        base = m.copy()
        while power > 0:
            if power & 1:
                result = result @ base
            base = base @ base
            power >>= 1
        return result

    p_n = mat_power(transition, n_years)
    return float(p_n[start_idx, default_idx])

# ratings ordered [A, B, Default]
P = np.array([
    [0.90, 0.08, 0.02],
    [0.10, 0.80, 0.10],
    [0.00, 0.00, 1.00],
])
prob = default_probability_n_years(P, start_idx=0, default_idx=2, n_years=2)
# prob ~= 0.046`,
    language: "python",
    complexity: { time: "O(s^3 log n_years)", space: "O(s^2)" },
  },
  {
    id: "lc-design-rolling-vwap",
    title: "Design a Rolling VWAP Tracker Over the Last K Trades",
    difficulty: "medium",
    topics: ["design", "queue"],
    problem:
      "Design a class that supports add_trade(price, qty), recording a new trade, and vwap(), returning the volume-weighted average price over the most recent k trades (k fixed at construction), both in O(1) time.",
    examples: [
      {
        input: "k=3; add_trade(10,100); add_trade(12,50); add_trade(11,150); vwap()",
        output: "10.8333...",
        explanation:
          "(10*100 + 12*50 + 11*150) / (100 + 50 + 150) = 3250 / 300 = 10.8333. A 4th add_trade(9,200) would evict the oldest trade (10,100) from the window before the next vwap() call.",
      },
    ],
    approach:
      "Recomputing the volume-weighted average from scratch over the last k trades on every call is O(k) per query. VWAP is just a ratio of two RUNNING sums -- sum of price times quantity, and sum of quantity -- and both update in O(1) as trades arrive: add the new trade's contribution, and once the window exceeds k trades, subtract the contribution of whichever trade just aged out. This is the same running-sum-with-a-deque pattern used for any fixed-window average, just weighted by quantity instead of counted equally; keeping the actual (price, qty) pairs in a deque, not just the running sums, is what makes the eviction possible at all, since you need to know exactly what to subtract when the oldest trade leaves. Watch the edge case of an empty window (or a qty=0 trade) leaving sum_qty at zero, which divides by zero on the first vwap() call.",
    code: `from collections import deque

class RollingVWAP:
    def __init__(self, k: int):
        self.k = k
        self.trades: deque = deque()   # (price, qty), oldest at the front
        self.sum_pq = 0.0               # running sum of price * qty
        self.sum_qty = 0.0              # running sum of qty

    def add_trade(self, price: float, qty: float) -> None:
        self.trades.append((price, qty))
        self.sum_pq += price * qty
        self.sum_qty += qty
        if len(self.trades) > self.k:
            old_price, old_qty = self.trades.popleft()
            self.sum_pq -= old_price * old_qty
            self.sum_qty -= old_qty

    def vwap(self) -> float:
        if self.sum_qty == 0:
            return 0.0
        return self.sum_pq / self.sum_qty`,
    language: "python",
    complexity: { time: "O(1) per operation", space: "O(k)" },
  },
];
