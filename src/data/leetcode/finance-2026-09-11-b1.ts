import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-11
// A bounded min-heap for a stream's kth-largest fill, a
// monotonic-deque-over-prefix-sums shortest window with signed
// values, a two-running-extremes single trade DP, a closed-form
// expected-value probability question, and an iceberg-order
// extension to a price-time-priority order book.
// ============================================================

export const financeBatch20260911: LeetCodeProblem[] = [
  {
    id: "lc-20260911-kth-largest-fill-price",
    title: "Kth Largest Fill Price From a Stream of Partial Fills",
    difficulty: "medium",
    topics: ["heap", "design"],
    problem:
      "You receive a stream of partial fill reports for a large parent order, each carrying a fill price. Design a class initialized with k and an initial list of fill prices, exposing add(price) that ingests one more price and returns the k-th largest fill price seen so far, in O(log k) time per call.",
    examples: [
      {
        input: "k=3, initial=[4,5,8,2]; add(3); add(5); add(10); add(9); add(4)",
        output: "4, 5, 5, 8, 8",
        explanation:
          "With k=3 the answer is always the smallest value currently sitting in a size-3 min-heap of the largest prices seen so far.",
      },
    ],
    constraints: ["1 <= k <= initial.length + 1", "up to 10^5 total add calls", "prices are positive floats"],
    approach:
      "Maintain a min-heap capped at size k. Push every incoming price, and if the heap grows past k, pop its smallest element -- the root of a size-k min-heap built from the largest values seen is, by definition, the k-th largest overall, an O(1) read after an O(log k) push/pop. The key realization: you never need to remember the full fill history, no matter how long the parent order's stream runs, only the current top k, so memory and per-call cost stay bounded regardless of stream length.",
    code: `import heapq

class KthLargestFillTracker:
    def __init__(self, k: int, initial_prices: list[float]):
        self.k = k
        self.heap: list[float] = []   # min-heap, capped at size k
        for p in initial_prices:
            self.add(p)

    def add(self, price: float) -> float:
        heapq.heappush(self.heap, price)
        # cap the heap at k elements -- we never need to remember more than
        # the k largest, no matter how long the fill stream runs
        if len(self.heap) > self.k:
            heapq.heappop(self.heap)
        return self.heap[0]   # root of a size-k min-heap IS the kth largest

tracker = KthLargestFillTracker(3, [4, 5, 8, 2])
for p in [3, 5, 10, 9, 4]:
    print(tracker.add(p))
# 4, 5, 5, 8, 8`,
    language: "python",
    complexity: { time: "O(log k) per add", space: "O(k)" },
  },
  {
    id: "lc-20260911-shortest-window-net-flow-k",
    title: "Shortest Consecutive-Day Window With Net Order Flow At Least K",
    difficulty: "hard",
    topics: ["sliding-window", "monotonic-deque", "prefix-sum"],
    problem:
      "Given an array of daily net order flow (positive means net buying, negative means net selling -- any integer, can be negative) and a target K, find the length of the shortest contiguous run of days whose net order flow sums to at least K. Return -1 if no such window exists.",
    examples: [
      { input: "flow=[2,-1,2], K=3", output: "3", explanation: "The only window summing to at least 3 is the whole array; every shorter window falls short because of the -1 day in between." },
      { input: "flow=[1,2], K=4", output: "-1", explanation: "The best possible sum, using both days, is only 3." },
    ],
    constraints: ["1 <= flow.length <= 10^5", "-10^5 <= flow[i] <= 10^5", "1 <= K <= 10^9"],
    approach:
      "Negative values break the usual two-pointer sliding window, because prefix sums are no longer monotonic in the window's right endpoint, so shrinking from the left is not guaranteed safe. Instead build prefix sums P[0..n] and scan them with a monotonic increasing deque of INDICES. For each new prefix index i: first, while the earliest index in the deque gives a window sum of at least K (P[i] - P[front] >= K), record that window's length and pop it from the front -- once a start index has produced a valid window, no LATER right endpoint can ever beat that window's length using the same start, so it is safe to discard. Second, before appending i, pop any index from the BACK whose prefix sum is >= P[i], since a later index with an equal-or-smaller prefix sum is a strictly better (or equal) future left endpoint. This keeps the deque both index-increasing and prefix-sum-increasing, giving an O(n) single pass despite the signed values.",
    code: `from collections import deque

def shortest_window_at_least_k(flow: list[int], k: int) -> int:
    n = len(flow)
    prefix = [0] * (n + 1)
    for i, f in enumerate(flow):
        prefix[i + 1] = prefix[i] + f

    dq: deque[int] = deque()   # indices into prefix, kept sum-increasing
    best = n + 1

    for i in range(n + 1):
        # this start already reaches K -- record it, then drop it: no later
        # right endpoint can produce a SHORTER window from the same start
        while dq and prefix[i] - prefix[dq[0]] >= k:
            best = min(best, i - dq.popleft())

        # a later index with an equal-or-smaller prefix sum makes every
        # earlier back-of-deque index strictly worse as a future start
        while dq and prefix[dq[-1]] >= prefix[i]:
            dq.pop()

        dq.append(i)

    return best if best <= n else -1

print(shortest_window_at_least_k([2, -1, 2], 3))   # 3
print(shortest_window_at_least_k([1, 2], 4))        # -1`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-20260911-best-single-trade-long-or-short",
    title: "Best Single Trade Profit Allowing Either a Long or a Short Position",
    difficulty: "easy",
    topics: ["dynamic-programming", "greedy"],
    problem:
      "Given daily prices for a stock, you may make exactly one round-trip trade: either go long (buy then sell later at a higher price) or go short (sell then buy back later at a lower price) -- whichever direction produces the larger single-trade profit. Return the maximum achievable profit, or 0 if no profitable trade exists in either direction.",
    examples: [
      {
        input: "prices=[7,1,5,3,6,4]",
        output: "6",
        explanation:
          "Shorting at 7 (day 0) and covering at 1 (day 1) profits 6, which beats the best long trade of 5 (buy at 1, sell at 6).",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^5"],
    approach:
      "Track two running extremes in a single pass: the minimum price seen so far (for the long side, profit = current price minus that running minimum) and the maximum price seen so far (for the short side, profit = that running maximum minus current price). Update both running best-profit trackers together as you scan once, left to right, and return the larger of the two totals at the end -- effectively Kadane's-style tracking done twice in parallel, with no need for two separate passes or an O(n^2) comparison of every pair.",
    code: `def best_single_trade(prices: list[float]) -> float:
    if not prices:
        return 0.0

    min_so_far = max_so_far = prices[0]
    best_long = best_short = 0.0

    for price in prices[1:]:
        # long side: buy low, sell later at a higher price
        best_long = max(best_long, price - min_so_far)
        min_so_far = min(min_so_far, price)

        # short side: sell high, buy back later at a lower price
        best_short = max(best_short, max_so_far - price)
        max_so_far = max(max_so_far, price)

    return max(best_long, best_short)

print(best_single_trade([7, 1, 5, 3, 6, 4]))   # 6 (short: sell 7, cover 1)`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260911-expected-sign-changes",
    title: "Expected Number of Sign Changes in N Days of IID Coin-Flip Returns",
    difficulty: "medium",
    topics: ["probability"],
    problem:
      "A signal's daily return sign is modeled as an IID coin flip: +1 (up) with probability p, -1 (down) with probability 1-p, independent across days. Given N days and p, compute the expected number of sign changes (a day whose sign differs from the immediately preceding day) over the whole sequence in closed form -- no simulation required.",
    examples: [
      { input: "n_days=5, p=0.5", output: "2.0", explanation: "4 adjacent day-pairs, each independently flipping sign with probability 2*0.5*0.5 = 0.5, so 4 * 0.5 = 2.0." },
      { input: "n_days=10, p=0.6", output: "4.32", explanation: "9 adjacent pairs, each flipping with probability 2*0.6*0.4 = 0.48, so 9 * 0.48 = 4.32." },
    ],
    constraints: ["2 <= n_days <= 10^9", "0 < p < 1"],
    approach:
      "Reach for linearity of expectation instead of trying to reason about the full joint distribution of the path. Define one indicator per adjacent day-pair: 1 if the two signs differ, 0 otherwise. By independence, P(differ) = P(up then down) + P(down then up) = p(1-p) + (1-p)p = 2p(1-p), the same for every one of the N-1 pairs regardless of what happened elsewhere in the sequence. Summing N-1 identical indicator expectations gives the closed form directly: E[changes] = (N-1) * 2p(1-p) -- an O(1) answer even for N in the billions, with a Monte Carlo simulation as a cheap sanity check rather than the actual method.",
    code: `import numpy as np

def expected_sign_changes(n_days: int, p: float) -> float:
    # linearity of expectation: sum the per-adjacent-pair sign-change
    # probability across all N-1 pairs -- no need to reason about the
    # full joint path distribution at all
    p_change = 2 * p * (1 - p)   # P(up,down) + P(down,up), by independence
    return (n_days - 1) * p_change

print(expected_sign_changes(5, 0.5))    # 2.0
print(expected_sign_changes(10, 0.6))   # 4.32

# Monte Carlo sanity check -- confirms the formula, is not the method itself
def simulate(n_days: int, p: float, trials: int = 200_000, seed: int = 0) -> float:
    rng = np.random.default_rng(seed)
    signs = rng.random((trials, n_days)) < p   # True = up day
    changes = (signs[:, 1:] != signs[:, :-1]).sum(axis=1)
    return changes.mean()

print(round(simulate(10, 0.6), 3))   # close to 4.32`,
    language: "python",
    complexity: { time: "O(1) closed form, O(trials * n_days) for the simulation check", space: "O(1)" },
  },
  {
    id: "lc-20260911-design-iceberg-order-book",
    title: "Design an Order Book Supporting Iceberg Orders With Price-Time Priority",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Extend a price-time-priority limit order book to support iceberg orders: an iceberg order has a total quantity but only DISPLAYS a fixed slice at a time. When the currently displayed slice is fully filled, the next slice of the same display size automatically replenishes at the same price -- but the replenished slice goes to the BACK of the time-priority queue at that price level, exactly like a real exchange treats iceberg replenishment. Implement add_iceberg_sell(order_id, price, total_qty, display_qty) and add_buy(order_id, price, qty) -> list of (matched_order_id, price, qty) fills.",
    examples: [
      {
        input: "add_iceberg_sell(1,100.0,300,100); add_buy(2,100.0,100); add_buy(3,100.0,50)",
        output: "[(1,100.0,100)] then [(1,100.0,50)]",
        explanation:
          "The first buy drains the whole 100-share displayed slice. The iceberg still has 200 hidden shares, so it replenishes a new 100-share slice at the same price -- but under a fresh sequence number, so it matches any new resting sell at 100.0 only after that order, not before it.",
      },
    ],
    constraints: ["up to 10^5 total order operations", "total_qty is a multiple of display_qty in these examples", "prices and quantities are positive"],
    approach:
      "Store each iceberg order's total remaining quantity separately from its currently displayed remaining quantity -- only the DISPLAYED quantity is ever visible for matching. Use the same resting-sell min-heap of (price, seq, order_id) entries as a plain book. When an incoming buy drains a displayed slice to zero and the iceberg still has quantity left, pop the exhausted heap entry, decrement total remaining by the slice size, and push a NEW heap entry with a FRESHLY issued sequence number at the same price -- issuing a new sequence number is exactly what sends the replenished slice to the back of the time-priority queue, modeling the real exchange mechanic instead of silently refilling the same queue position. Only quantity actually matched against the currently displayed size is ever reported as a fill.",
    code: `import heapq
import itertools

class IcebergBook:
    def __init__(self):
        self.sells: list[tuple[float, int, int]] = []   # min-heap: (price, seq, order_id)
        self.display_left: dict[int, int] = {}   # order_id -> qty left in CURRENT slice
        self.total_left: dict[int, int] = {}      # order_id -> qty left TOTAL (iceberg only)
        self.display_size: dict[int, int] = {}     # order_id -> fixed slice size (iceberg only)
        self._seq = itertools.count()

    def add_iceberg_sell(self, order_id: int, price: float, total_qty: int, display_qty: int) -> None:
        slice_qty = min(display_qty, total_qty)
        self.total_left[order_id] = total_qty
        self.display_size[order_id] = display_qty
        self.display_left[order_id] = slice_qty
        heapq.heappush(self.sells, (price, next(self._seq), order_id))

    def add_buy(self, order_id: int, price: float, qty: int) -> list[tuple[int, float, int]]:
        fills = []
        rem = qty
        while rem > 0 and self.sells and self.sells[0][0] <= price:
            sell_price, _, sell_id = self.sells[0]
            traded = min(rem, self.display_left[sell_id])
            fills.append((sell_id, sell_price, traded))
            rem -= traded
            self.display_left[sell_id] -= traded
            self.total_left[sell_id] -= traded

            if self.display_left[sell_id] == 0:
                heapq.heappop(self.sells)
                remaining_total = self.total_left.get(sell_id, 0)
                if remaining_total > 0:
                    # replenish: NEW sequence number -> back of time priority,
                    # exactly like a real exchange treats iceberg refills
                    next_slice = min(self.display_size[sell_id], remaining_total)
                    self.display_left[sell_id] = next_slice
                    heapq.heappush(self.sells, (sell_price, next(self._seq), sell_id))
                else:
                    del self.display_left[sell_id], self.total_left[sell_id], self.display_size[sell_id]
        return fills

book = IcebergBook()
book.add_iceberg_sell(1, 100.0, total_qty=300, display_qty=100)
print(book.add_buy(2, 100.0, 100))   # [(1, 100.0, 100)] -- drains the whole first slice
print(book.add_buy(3, 100.0, 50))    # [(1, 100.0, 50)] -- replenished slice, now at the
# back of the queue: any OTHER sell resting at 100.0 in between would fill first`,
    language: "python",
    complexity: { time: "O(log n) amortized per fill/replenish event", space: "O(n) resting orders" },
  },
];
