import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-14
// Merging k sorted venue tick streams into one ordered tape
// (k-way heap merge, LC23 shape), longest stretch where price
// stays within a fixed band of its own recent range (monotonic
// deque sliding window, LC1438 shape), max profit with at most
// k round-trip transactions (DP, LC188 shape), the steady-state
// probability of each market regime under a Markov transition
// matrix, and a price-time priority order-matching engine that
// actually crosses and partially fills incoming orders (design).
// ============================================================

export const financeBatch20261014: LeetCodeProblem[] = [
  {
    id: "lc-20261014-merge-k-sorted-trade-streams",
    title: "Merge K Sorted Venue Tick Streams Into One Global Tape",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "You receive trade prints from k different venues, each already sorted by timestamp within its own feed, as k separate lists. Merge all k lists into a single list sorted by timestamp, reconstructing the one true consolidated tape a smart order router would have seen.",
    examples: [
      {
        input: "streams = [[(1, 'A'), (5, 'A')], [(2, 'B'), (3, 'B')], [(4, 'C')]]",
        output: "[(1,'A'), (2,'B'), (3,'B'), (4,'C'), (5,'A')]",
        explanation:
          "Each inner list is already sorted by its own timestamp; the merged tape just needs all k lists interleaved by timestamp across venues.",
      },
    ],
    constraints: ["1 <= k <= 500", "each stream has length >= 0", "total prints across all streams <= 10^5"],
    approach:
      "Keep a min-heap seeded with one entry per non-empty stream: (timestamp, stream_index, position_within_stream). Pop the globally smallest timestamp, append it to the output, then push that same stream's NEXT element (if one exists) back onto the heap. This never compares more than k candidates at once no matter how long the streams are, because each stream only ever has one representative sitting in the heap at a time. Total work is O(n log k) for n total prints across all streams, versus the O(n log n) you'd pay by dumping everything into one list and sorting from scratch, or the O(nk) you'd pay comparing all k heads at every step with a plain scan instead of a heap.",
    code: `import heapq

def merge_k_tick_streams(streams: list[list[tuple[int, str]]]) -> list[tuple[int, str]]:
    heap: list[tuple[int, int, int]] = []   # (timestamp, stream_idx, pos)
    for i, stream in enumerate(streams):
        if stream:
            heapq.heappush(heap, (stream[0][0], i, 0))

    merged: list[tuple[int, str]] = []
    while heap:
        ts, stream_idx, pos = heapq.heappop(heap)
        merged.append(streams[stream_idx][pos])

        # advance only the stream we just took from -- at most k entries ever live in the heap
        next_pos = pos + 1
        if next_pos < len(streams[stream_idx]):
            next_ts = streams[stream_idx][next_pos][0]
            heapq.heappush(heap, (next_ts, stream_idx, next_pos))

    return merged

streams = [[(1, "A"), (5, "A")], [(2, "B"), (3, "B")], [(4, "C")]]
print(merge_k_tick_streams(streams))
# [(1, 'A'), (2, 'B'), (3, 'B'), (4, 'C'), (5, 'A')]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
    leetcodeNumber: 23,
  },
  {
    id: "lc-20261014-longest-window-price-band",
    title: "Longest Stretch Where Price Stays Within a Fixed Band of Its Own Range",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a sequence of daily prices and a band width `limit`, return the length of the longest contiguous window during which the gap between the window's own highest and lowest price never exceeds `limit`. This is the longest stretch a volatility-band trigger would have stayed quiet.",
    examples: [
      {
        input: "prices = [8, 2, 4, 7], limit = 4",
        output: "2",
        explanation:
          "Window [2,4] has range 2 (ok), [4,7] has range 3 (ok, length 2 too), but [2,4,7] has range 5 > 4, and [8,2] has range 6 > 4 -- so the longest qualifying window has length 2.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= limit <= 10^9"],
    approach:
      "A plain two-pointer window needs the CURRENT max and min inside it at every step, and recomputing those from scratch on every shrink would be O(n) per step. Maintain two monotonic deques instead: a decreasing deque tracking candidates for the window's max, and an increasing deque for its min. When a new price arrives, pop from the back of each deque while the new price would beat the existing back element, then push it on -- this keeps each deque's front always holding the true current max/min in O(1) to read. When range (front of max-deque minus front of min-deque) exceeds limit, shrink from the left, popping any deque entries that fall out of the window from their FRONT. Every price is pushed and popped from each deque at most once over the whole scan, so total work is O(n) despite looking like it needs a full max/min recompute per window.",
    code: `from collections import deque

def longest_window_within_band(prices: list[int], limit: int) -> int:
    max_deque: deque[int] = deque()   # indices, decreasing prices -- front is current max
    min_deque: deque[int] = deque()   # indices, increasing prices -- front is current min
    left = 0
    best = 0

    for right, price in enumerate(prices):
        while max_deque and prices[max_deque[-1]] <= price:
            max_deque.pop()
        max_deque.append(right)

        while min_deque and prices[min_deque[-1]] >= price:
            min_deque.pop()
        min_deque.append(right)

        # shrink while the window's range exceeds the band -- drop stale fronts as the window moves
        while prices[max_deque[0]] - prices[min_deque[0]] > limit:
            if max_deque[0] == left:
                max_deque.popleft()
            if min_deque[0] == left:
                min_deque.popleft()
            left += 1

        best = max(best, right - left + 1)

    return best

print(longest_window_within_band([8, 2, 4, 7], 4))
# 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
    leetcodeNumber: 1438,
  },
  {
    id: "lc-20261014-max-profit-k-transactions",
    title: "Maximum Profit With At Most K Buy-Sell Transactions",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices and an integer k, you may complete at most k buy-then-sell round trips, never holding more than one share at a time and never opening a new position before closing the current one. Return the maximum achievable total profit.",
    examples: [
      {
        input: "prices = [3, 2, 6, 5, 0, 3], k = 2",
        output: "7",
        explanation:
          "Buy at 2, sell at 6 (profit 4); buy at 0, sell at 3 (profit 3). Total 4 + 3 = 7, and no schedule using at most 2 round trips beats that.",
      },
    ],
    constraints: ["1 <= k <= 100", "1 <= prices.length <= 1000"],
    approach:
      "Track two arrays of length k+1: hold[j], the best profit having made at most j buys so far and currently holding a share, and cash[j], the best profit having made at most j complete round trips and currently flat. For each new day's price, update from j=1..k using ONLY values computed so far this same pass (cash[j-1] feeding hold[j] models buying into the j-th position, and hold[j] feeding cash[j] models selling out of it) -- processing j in increasing order each day lets a single day's buy and sell for the same j-th slot both be considered without an extra dimension for time. If k is at least half the number of trading days, there's no binding constraint at all -- every local upswing can be captured -- so it collapses to the unlimited-transactions greedy (sum of positive day-over-day deltas), which also protects against k itself blowing up the array when prices is short.",
    code: `def max_profit_k_transactions(k: int, prices: list[int]) -> int:
    n = len(prices)
    if n == 0 or k == 0:
        return 0

    # k >= n // 2 means no transaction count is ever binding -- capture every upswing
    if k >= n // 2:
        return sum(max(prices[i + 1] - prices[i], 0) for i in range(n - 1))

    hold = [float("-inf")] * (k + 1)   # best profit after <= j buys, currently holding
    cash = [0] * (k + 1)               # best profit after <= j round trips, currently flat

    for price in prices:
        for j in range(1, k + 1):
            hold[j] = max(hold[j], cash[j - 1] - price)   # buy into the j-th slot
            cash[j] = max(cash[j], hold[j] + price)        # sell out of the j-th slot

    return cash[k]

print(max_profit_k_transactions(2, [3, 2, 6, 5, 0, 3]))
# 7`,
    language: "python",
    complexity: { time: "O(n*k)", space: "O(k)" },
    leetcodeNumber: 188,
  },
  {
    id: "lc-20261014-markov-regime-stationary-distribution",
    title: "Steady-State Probability of Each Market Regime (Stationary Markov Distribution)",
    difficulty: "medium",
    topics: ["probability"],
    problem:
      "A market is modeled as switching daily between n regimes (e.g. Bull, Bear, Chop) according to a fixed Markov transition matrix P, where P[i][j] is the probability of moving from regime i to regime j the next day. Return the long-run (stationary) probability of being in each regime, assuming the chain is irreducible and aperiodic.",
    examples: [
      {
        input: "P = [[0.9, 0.075, 0.025], [0.15, 0.8, 0.05], [0.25, 0.25, 0.5]]",
        output: "[0.625, 0.3125, 0.0625]",
        explanation:
          "Solving pi = pi * P with pi summing to 1 gives roughly 62.5% Bull, 31.25% Bear, 6.25% Chop as the long-run time spent in each regime, regardless of which regime you start in.",
      },
    ],
    constraints: ["2 <= n <= 50", "each row of P sums to 1", "the chain is irreducible and aperiodic"],
    approach:
      "The stationary distribution pi is the row vector satisfying pi = pi @ P with sum(pi) = 1 -- a LEFT eigenvector of P for eigenvalue 1, not a right eigenvector, which is the detail most likely to trip someone up since numpy's eig returns right eigenvectors by default. The clean way to get it without hand-deriving eigenvectors is to solve the equivalent linear system directly: transpose so the equation becomes (P^T - I) @ pi^T = 0, replace one redundant row of that system with the normalization constraint sum(pi) = 1 (the original system is rank-deficient by exactly one, so you need that substitution to pin down a unique solution), and solve the resulting square linear system. This generalizes cleanly to any n without ever actually computing eigenvectors by hand.",
    code: `import numpy as np

def stationary_distribution(P: list[list[float]]) -> list[float]:
    P = np.array(P)
    n = P.shape[0]

    # pi = pi @ P  <=>  (P^T - I) @ pi^T = 0 -- solve as a linear system, not via eig directly
    A = P.T - np.eye(n)
    A[-1, :] = 1.0          # replace one (redundant) equation with the normalization constraint
    b = np.zeros(n)
    b[-1] = 1.0             # sum(pi) == 1

    pi = np.linalg.solve(A, b)
    return pi.tolist()

P = [[0.9, 0.075, 0.025], [0.15, 0.8, 0.05], [0.25, 0.25, 0.5]]
print([round(x, 4) for x in stationary_distribution(P)])
# [0.625, 0.3125, 0.0625]`,
    language: "python",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
  },
  {
    id: "lc-20261014-design-order-matching-engine",
    title: "Design a Price-Time Priority Order Matching Engine",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design a class OrderBook supporting add_buy(order_id, price, size) and add_sell(order_id, price, size). Each new order first tries to MATCH against the resting book on the opposite side at or better than its own price, in strict price-then-time priority, consuming resting size (partially filling a resting order if it's bigger than the incoming remainder) before any unfilled remainder joins the book as a new resting order. Return the list of fills produced by each call, as (resting_order_id, incoming_order_id, price, size) tuples.",
    examples: [
      {
        input:
          "book=OrderBook(); book.add_sell(1,100.0,10); book.add_sell(2,100.0,5); book.add_buy(3,100.0,12)",
        output: "[(1, 3, 100.0, 10), (2, 3, 100.0, 2)]",
        explanation:
          "Order 3 wants to buy 12 at 100.0. It matches resting order 1 first (arrived first at the same price -- time priority), fully consuming its 10, then matches 2 ticks more size out of order 2's remaining 5, leaving order 2 resting with 3 left and nothing left of order 3 to rest.",
      },
    ],
    constraints: ["up to 10^5 total calls", "prices and sizes are positive", "a given order_id is added at most once"],
    approach:
      "Hold resting sell orders in a min-heap keyed by (price, arrival_sequence, order_id) and resting buy orders in a max-heap keyed by (-price, arrival_sequence, order_id) -- the arrival_sequence tiebreak is what encodes time priority at a shared price level. An incoming buy only ever matches a resting sell priced at or BELOW its own limit (and symmetrically for an incoming sell against resting buys), so the matching loop repeatedly peeks the opposite heap's top, checks the price condition, and if it holds, trades the smaller of the two remaining sizes, fully removing whichever side hit zero and leaving the other side's remainder in place for the next iteration. If the opposite heap's top no longer satisfies the price condition (or the heap is empty) before the incoming order is fully filled, whatever size is left over joins its own side's heap as a new resting order, tagged with the current call's arrival_sequence so later orders correctly rank behind it at the same price.",
    code: `import heapq
import itertools

class OrderBook:
    def __init__(self):
        self.sells: list[tuple[float, int, int, int]] = []   # (price, seq, order_id, size) min-heap
        self.buys: list[tuple[float, int, int, int]] = []    # (-price, seq, order_id, size) max-heap
        self._seq = itertools.count()

    def add_buy(self, order_id: int, price: float, size: int):
        fills = []
        remaining = size
        while remaining > 0 and self.sells and self.sells[0][0] <= price:
            ask_price, seq, resting_id, resting_size = heapq.heappop(self.sells)
            traded = min(remaining, resting_size)
            fills.append((resting_id, order_id, ask_price, traded))
            remaining -= traded
            resting_size -= traded
            if resting_size > 0:
                heapq.heappush(self.sells, (ask_price, seq, resting_id, resting_size))

        if remaining > 0:
            heapq.heappush(self.buys, (-price, next(self._seq), order_id, remaining))
        return fills

    def add_sell(self, order_id: int, price: float, size: int):
        fills = []
        remaining = size
        while remaining > 0 and self.buys and -self.buys[0][0] >= price:
            neg_bid, seq, resting_id, resting_size = heapq.heappop(self.buys)
            traded = min(remaining, resting_size)
            fills.append((resting_id, order_id, -neg_bid, traded))
            remaining -= traded
            resting_size -= traded
            if resting_size > 0:
                heapq.heappush(self.buys, (neg_bid, seq, resting_id, resting_size))

        if remaining > 0:
            heapq.heappush(self.sells, (price, next(self._seq), order_id, remaining))
        return fills

book = OrderBook()
book.add_sell(1, 100.0, 10)
book.add_sell(2, 100.0, 5)
print(book.add_buy(3, 100.0, 12))
# [(1, 3, 100.0, 10), (2, 3, 100.0, 2)]`,
    language: "python",
    complexity: { time: "O(log n) amortized per operation", space: "O(n)" },
  },
];
