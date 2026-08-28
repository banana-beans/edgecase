import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-28
// A bounded-size max-heap for k trades closest to a benchmark
// price, a dual-monotonic-deque sliding window for the longest
// range-bound stretch of prices, a buy/sell/cooldown stock DP,
// an expected-duration gambler's-ruin variant for a market
// maker's inventory band, and a weighted-average-cost position
// tracker design.
// ============================================================

export const financeBatch20260828: LeetCodeProblem[] = [
  {
    id: "lc-k-closest-trades-benchmark",
    title: "K Closest Trades to a Benchmark Price (Heap)",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given an array of n trade prices from a day's tape and a benchmark reference price (say, the day's VWAP), return the k trade prices closest to the benchmark, in any order. Closeness is measured by absolute difference.",
    examples: [
      {
        input: "prices=[8,2,14,5,11,9], benchmark=10, k=3",
        output: "[8,9,11] (in some order)",
        explanation:
          "Distances from 10 are 2,8,4,5,1,1. The three smallest belong to 11 (dist 1), 9 (dist 1), and 8 (dist 2), so those three prices are returned.",
      },
    ],
    constraints: ["1 <= k <= n <= 10^5", "0 <= price, benchmark <= 10^6"],
    approach:
      "Maintain a max-heap (keyed on distance from the benchmark) capped at size k as you scan the prices once: push each (distance, price) pair, and whenever the heap exceeds size k, pop the entry with the largest distance. Because the heap never grows past k, each push/pop is O(log k) instead of O(log n), giving O(n log k) overall versus sorting the full array at O(n log n) -- a real difference when k is much smaller than n, like finding the 5 prints closest to VWAP out of a day's hundreds of thousands of trades. Python's heapq is a min-heap, so negate the distance to simulate a max-heap on distance.",
    code: `import heapq

def k_closest_to_benchmark(prices: list[int], benchmark: int, k: int) -> list[int]:
    heap: list[tuple[int, int]] = []  # (-distance, price) -- max-heap on distance

    for price in prices:
        dist = abs(price - benchmark)
        heapq.heappush(heap, (-dist, price))
        if len(heap) > k:
            heapq.heappop(heap)   # evict whichever entry is currently farthest away

    return [price for _, price in heap]

print(sorted(k_closest_to_benchmark([8, 2, 14, 5, 11, 9], benchmark=10, k=3)))
# [8, 9, 11]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-longest-window-bounded-band",
    title: "Longest Trading Window Where Price Stays Within a Volatility Band",
    difficulty: "hard",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given a sequence of intraday prices and a band width w, find the length of the longest contiguous window where the difference between the maximum and minimum price in that window never exceeds w -- the longest stretch a mean-reversion strategy could safely treat as range-bound.",
    examples: [
      {
        input: "prices=[10,1,2,4,7,2], w=5",
        output: "4",
        explanation:
          "The window [2,4,7,2] (indices 2-5) has max 7 and min 2, a range of 5, which fits the band -- no longer window satisfies the constraint.",
      },
    ],
    constraints: ["1 <= number of prices <= 10^5", "0 <= price[i] <= 10^6", "0 <= w <= 10^6"],
    approach:
      "Maintain two monotonic deques over a right-expanding window -- one strictly decreasing (its front is always the window's current max) and one strictly increasing (its front is always the window's current min). Expand the right pointer one step at a time, pushing into both deques after popping any entries the new price makes irrelevant, then while the window's range (max minus min, read off both fronts) exceeds w, shrink from the left, dropping any deque front that has fallen out of the shrunk window. Every price is pushed and popped from each deque at most once across the entire scan, so despite the nested-looking while loop the total work is O(n); track the best window length after each expansion.",
    code: `from collections import deque

def longest_bounded_window(prices: list[int], w: int) -> int:
    max_dq: deque[int] = deque()   # indices, prices strictly decreasing
    min_dq: deque[int] = deque()   # indices, prices strictly increasing
    left = 0
    best = 0

    for right, price in enumerate(prices):
        while max_dq and prices[max_dq[-1]] <= price:
            max_dq.pop()
        max_dq.append(right)

        while min_dq and prices[min_dq[-1]] >= price:
            min_dq.pop()
        min_dq.append(right)

        # shrink from the left while the window's range exceeds the band
        while prices[max_dq[0]] - prices[min_dq[0]] > w:
            left += 1
            if max_dq[0] < left:
                max_dq.popleft()
            if min_dq[0] < left:
                min_dq.popleft()

        best = max(best, right - left + 1)

    return best

print(longest_bounded_window([10, 1, 2, 4, 7, 2], w=5))   # 4 -- window [2,4,7,2]`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-max-profit-cooldown",
    title: "Maximum Profit with a Mandatory One-Day Cooldown After Each Sale",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily closing prices, find the maximum profit from any number of buy-then-sell transactions (holding at most one unit at a time, must sell before buying again), with a compliance rule that after selling you cannot buy again the very next day -- you must sit out at least one day before re-entering.",
    examples: [
      {
        input: "prices=[1,2,3,0,2]",
        output: "3",
        explanation:
          "Buy at 1, sell at 2 (profit 1), sit out the mandatory cooldown day (price 3), then buy at 0 and sell at 2 (profit 2), for a total of 3 -- buying on day 2 right after selling on day 1 is exactly what the cooldown forbids.",
      },
    ],
    constraints: ["0 <= number of prices <= 5000", "0 <= price[i] <= 10^4"],
    approach:
      "Track three rolling states per day: hold (best profit while currently holding), sold (best profit on a day you just sold, entering cooldown), and rest (best profit while flat and free to buy). Transitions each day: hold' = max(hold, rest - price) -- keep holding, or buy today only if you were free to (not fresh off a sale); sold' = hold + price -- selling is only reachable from a held position; rest' = max(rest, sold) -- stay free, or yesterday's cooldown has now lapsed. The key structural move versus the plain unlimited-transactions version of this problem is splitting 'flat and can buy today' (rest) from 'flat because you just sold' (sold) -- collapsing those two into one state is exactly the bug that silently ignores the cooldown rule.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if len(prices) < 2:
        return 0

    hold = float("-inf")   # currently holding a position
    sold = 0                # just sold today -- forces cooldown tomorrow
    rest = 0                # flat and free to buy today

    for price in prices:
        prev_hold, prev_sold, prev_rest = hold, sold, rest
        hold = max(prev_hold, prev_rest - price)   # keep holding, or buy (must've been "rest")
        sold = prev_hold + price                    # sell today, only from a held position
        rest = max(prev_rest, prev_sold)             # stay flat, or cooldown just lapsed

    return max(sold, rest)   # ending mid-hold with no exit plan is never optimal

print(max_profit_with_cooldown([1, 2, 3, 0, 2]))   # 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-expected-ticks-inventory-band",
    title: "Expected Number of Ticks Until an Inventory Random Walk Hits Either Risk Limit",
    difficulty: "hard",
    topics: ["probability", "dynamic-programming", "random-walk"],
    problem:
      "A market maker's inventory moves by +1 with probability p (a buy fill) or -1 with probability 1-p on each incoming order, independent of history. Risk limits force a stop once inventory hits 0 or N. Starting from inventory i (0 < i < N), compute the expected number of ticks (order fills) until inventory first hits either boundary.",
    examples: [
      {
        input: "N=4, i=2, p=0.5",
        output: "4.0",
        explanation:
          "For a symmetric walk the expected time to absorption has the closed form i*(N-i): with i=2, N=4, that's 2*2=4.0 expected fills before hitting either boundary.",
      },
    ],
    constraints: ["2 <= N <= 10^6", "0 < i < N", "0 < p < 1"],
    approach:
      "This is the gambler's ruin EXPECTED DURATION problem, distinct from the hitting-PROBABILITY version: the recurrence is T[i] = 1 + p*T[i+1] + (1-p)*T[i-1] for 0 < i < N, with boundary conditions T[0] = T[N] = 0. For the symmetric case p=0.5 this collapses to the clean closed form i*(N-i) -- reflecting that a driftless walk's absorption time depends only on how centered the start is between the two barriers. For p != 0.5, the closed form is T[i] = i/(q-p) - (N/(q-p)) * (1 - r^i)/(1 - r^N), where q=1-p and r=q/p. As with the companion hitting-probability version of this problem, evaluating the general formula naively at p=0.5 divides 0/0 -- a removable singularity -- so the symmetric case must be special-cased explicitly.",
    code: `def expected_ticks_to_absorption(N: int, i: int, p: float) -> float:
    if p == 0.5:
        # removable singularity in the general formula -- a driftless walk's
        # expected duration has the clean closed form i * (N - i)
        return i * (N - i)

    q = 1 - p
    r = q / p
    drift = q - p
    return i / drift - (N / drift) * (1 - r**i) / (1 - r**N)

print(expected_ticks_to_absorption(N=4, i=2, p=0.5))     # 4.0
print(expected_ticks_to_absorption(N=10, i=4, p=0.5))    # 24.0  (4 * 6)
print(expected_ticks_to_absorption(N=10, i=4, p=0.55))   # shorter than symmetric -- drift speeds absorption`,
    language: "python",
    complexity: { time: "O(log N) (exponentiation)", space: "O(1)" },
  },
  {
    id: "lc-position-tracker-avg-cost",
    title: "Design a Position Tracker with Weighted-Average Cost Basis",
    difficulty: "medium",
    topics: ["design"],
    problem:
      "Design a structure that tracks a single-symbol position through a stream of fills via trade(side, price, size) for side in {'buy','sell'}, maintaining a weighted-average cost basis, and reporting realized_pnl() (cumulative P&L booked from closing trades) and unrealized_pnl(mark_price) (paper P&L on the current open position at a given mark). A trade that increases or opens a position blends into the average cost; a trade that reduces or closes a position books realized P&L against the current average cost and leaves that average cost unchanged for any shares still open. A trade that flips the position from long to short (or vice versa) resets the average cost, for the new opposite-side remainder, to that trade's own price.",
    examples: [
      {
        input: "trade('buy',100,10); trade('buy',110,10); trade('sell',120,15)",
        output: "avg_cost=105.0 before the sell; realized_pnl=225.0 and position=5 @ 105.0 after",
        explanation:
          "The two buys blend to an average cost of (100*10 + 110*10) / 20 = 105.0. Selling 15 of the 20 held books realized P&L of 15*(120-105)=225.0 and leaves the remaining 5 shares at the SAME unchanged average cost of 105.0 -- a partial sell never touches the cost basis of the shares that stay open.",
      },
    ],
    constraints: ["1 <= size per trade <= 10^4", "0 < price <= 10^6"],
    approach:
      "Track two numbers as state: position (signed size, positive for long, negative for short) and avg_cost (average price of the currently open position). A trade on the same side as the current position, or one that opens from flat, is a pure cost-basis blend: new_avg = (abs(position)*avg_cost + size*price) / (abs(position)+size), and no P&L is booked. A trade on the opposite side first offsets against the existing position: the offsetting portion books realized P&L of offset_size * (trade_price - avg_cost), sign-adjusted for which side is closing, and the average cost is left UNCHANGED for whatever open size remains from before the trade. If the opposite-side trade's size exceeds the currently open size, the position flips sign, and the average cost for the new, opposite-direction remainder resets to the trade's own price -- it's a fresh position, not a continuation of the old cost basis.",
    code: `class PositionTracker:
    def __init__(self):
        self.position = 0        # signed: +long, -short
        self.avg_cost = 0.0      # average cost of the CURRENT open position
        self.realized_pnl = 0.0

    def trade(self, side: str, price: float, size: int) -> None:
        signed_size = size if side == "buy" else -size

        # same direction as current position (or opening from flat): blend cost basis
        if self.position == 0 or (self.position > 0) == (signed_size > 0):
            total_size = abs(self.position) + size
            self.avg_cost = (abs(self.position) * self.avg_cost + size * price) / total_size
            self.position += signed_size
            return

        # opposite direction: offset against the open position first
        offset = min(size, abs(self.position))
        pnl_per_share = (price - self.avg_cost) if self.position > 0 else (self.avg_cost - price)
        self.realized_pnl += offset * pnl_per_share
        self.position += signed_size

        remaining_trade_size = size - offset
        if remaining_trade_size > 0:
            # the trade was bigger than the open position -- it FLIPPED sides,
            # so the new remainder is a fresh position priced at the trade itself
            self.avg_cost = price

    def unrealized_pnl(self, mark_price: float) -> float:
        if self.position > 0:
            return self.position * (mark_price - self.avg_cost)
        if self.position < 0:
            return abs(self.position) * (self.avg_cost - mark_price)
        return 0.0

pos = PositionTracker()
pos.trade("buy", 100, 10)
pos.trade("buy", 110, 10)
print(pos.avg_cost)                  # 105.0
pos.trade("sell", 120, 15)
print(pos.realized_pnl)              # 225.0
print(pos.position, pos.avg_cost)    # 5, 105.0 -- remaining shares keep the old cost basis`,
    language: "python",
    complexity: { time: "O(1) per trade", space: "O(1)" },
  },
];
