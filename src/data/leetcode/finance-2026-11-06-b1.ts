import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-06
// K closest trade prices to the day's VWAP (heap), longest
// trading window under a volume budget (sliding window, two
// pointer since volumes are non-negative), max profit with
// unlimited transactions under a T+1-style settlement cooldown
// (DP stock variant), the N-step probability distribution of a
// 3-regime market Markov chain, and a limit order book matching
// engine with price-time priority (design).
// ============================================================

export const financeBatch20261106: LeetCodeProblem[] = [
  {
    id: "lc-20261106-k-closest-prices-to-vwap",
    title: "K Closest Trade Prices to the Day's VWAP",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given an array of trade prices executed during the day and a target value equal to the day's VWAP (volume-weighted average price), return the k prices closest to the VWAP. Ties (equal distance) break toward the smaller price. The order of the result does not matter.",
    examples: [
      {
        input: "prices = [90, 95, 101, 99, 110, 85], vwap = 100, k = 3",
        output: "[95, 99, 101]",
        explanation:
          "Distances from 100: 90->10, 95->5, 101->1, 99->1, 110->10, 85->15. The three smallest distances belong to 101 (1), 99 (1), and 95 (5) -- 90 and 110 tie at distance 10 but both lose to 95's smaller distance of 5, and 85 is farthest at 15.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i], vwap <= 10^6", "1 <= k <= prices.length"],
    approach:
      "Maintain a heap of size at most k holding (distance, price) for the current best candidates, but encode it so heapq's O(1) peek-and-pop at the root always gives the WORST candidate, not the best -- push (-distance, -price) so the most negative tuple (largest actual distance, and on a distance tie, the largest actual price) always sorts to the root, and pop the root whenever the heap exceeds size k. This keeps exactly the k closest prices at all times with the correct smaller-price tie-break, using one heap and a single pass instead of sorting the whole array.",
    code: `import heapq

def k_closest_to_vwap(prices: list[float], vwap: float, k: int) -> list[float]:
    heap: list[tuple[float, float]] = []   # max-heap (via negation) of (distance, price)

    for price in prices:
        distance = abs(price - vwap)
        # negate both so heapq's min-pop always evicts the WORST candidate:
        # largest distance first, and on a distance tie, the larger price first
        heapq.heappush(heap, (-distance, -price))
        if len(heap) > k:
            heapq.heappop(heap)   # discard whichever candidate is currently worst

    return sorted(-neg_price for _, neg_price in heap)

print(k_closest_to_vwap([90, 95, 101, 99, 110, 85], vwap=100.0, k=3))
# [95.0, 99.0, 101.0]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-20261106-longest-window-volume-budget",
    title: "Longest Contiguous Trading Window Under a Volume Budget",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given an array of daily non-negative trading volumes and an integer budget, return the length of the longest contiguous subarray of days whose total volume does not exceed budget.",
    examples: [
      {
        input: "volumes = [4, 2, 1, 7, 3], budget = 10",
        output: "3",
        explanation:
          "[4, 2, 1] sums to 7 (length 3) and [2, 1, 7] sums to 10 (length 3), both at or under budget. Extending either window past length 3 always pushes the sum over 10, so 3 is the longest window achievable.",
      },
    ],
    constraints: ["1 <= volumes.length <= 10^5", "0 <= volumes[i] <= 10^4", "0 <= budget <= 10^9"],
    approach:
      "Because every volume is non-negative, the classic two-pointer window applies directly: expanding the right edge only ever increases the running sum, so once the sum exceeds budget, shrinking from the left strictly decreases it and eventually restores feasibility, with no risk of overshooting past a feasible state the way a signed-value array would create. Expand right one day at a time, shrink left while the sum is over budget, and track the best (right - left + 1) seen after each step.",
    code: `def longest_window_under_budget(volumes: list[int], budget: int) -> int:
    left = 0
    window_sum = 0
    best = 0

    for right, v in enumerate(volumes):
        window_sum += v
        while window_sum > budget:
            window_sum -= volumes[left]
            left += 1
        best = max(best, right - left + 1)

    return best

print(longest_window_under_budget([4, 2, 1, 7, 3], budget=10))   # 3`,
    language: "python",
    complexity: { time: "O(n) -- left advances at most n times total", space: "O(1)" },
  },
  {
    id: "lc-20261106-max-profit-cooldown",
    title: "Max Profit With Unlimited Transactions and a One-Day Settlement Cooldown",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices, you may complete as many buy-sell transactions as you like, but after selling you must wait at least one full day before buying again (a T+1-style settlement cooldown) -- you may not buy on the day immediately after a sell. Return the maximum achievable profit.",
    examples: [
      {
        input: "prices = [1, 2, 3, 0, 2]",
        output: "3",
        explanation:
          "Buy day 0 at 1, sell day 1 at 2 for profit 1. Day 2 is a forced cooldown (no buying), but day 3 is free -- buy at 0, sell day 4 at 2 for profit 2. Total profit 1 + 2 = 3, which beats any pairing that tries to also use day 2's price of 3.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^4"],
    approach:
      "Track three running states per day instead of one: hold (currently holding a share), sold (sold TODAY, so tomorrow is forced cooldown), and rest (not holding and free to buy, either because no cooldown is active or it just ended). Transitions: hold can continue holding or be entered today by buying from rest; sold is only reachable by selling today's price out of yesterday's hold; rest can continue resting or become available again the day after a sell. The answer is the better of ending in sold or rest, since ending while still holding a share you never sold can never beat selling it.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    hold = -prices[0]   # holding a share bought on day 0
    sold = 0             # just sold today -- impossible on day 0, 0 is a safe init
    rest = 0             # not holding, free to buy

    for price in prices[1:]:
        prev_hold, prev_sold, prev_rest = hold, sold, rest
        hold = max(prev_hold, prev_rest - price)   # keep holding, or buy today from rest
        sold = prev_hold + price                    # sell today, entering cooldown tomorrow
        rest = max(prev_rest, prev_sold)             # stay free, or cooldown from yesterday just ended

    return max(sold, rest)

print(max_profit_with_cooldown([1, 2, 3, 0, 2]))   # 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261106-markov-chain-n-step-regime-distribution",
    title: "N-Step Probability Distribution of a 3-State Market Regime Markov Chain",
    difficulty: "medium",
    topics: ["probability", "dynamic-programming"],
    problem:
      "A market is modeled as a Markov chain with 3 regimes: Calm, Volatile, Crisis. Given the transition probability matrix (row i holds the probabilities of moving FROM regime i to each regime), an initial distribution over regimes, and an integer n, return the probability distribution over regimes after exactly n transitions.",
    examples: [
      {
        input:
          "transition = [[0.90, 0.08, 0.02], [0.20, 0.70, 0.10], [0.10, 0.30, 0.60]], initial = [1.0, 0.0, 0.0], n = 2",
        output: "[0.828, 0.134, 0.038]",
        explanation:
          "Starting purely in Calm, one step gives [0.90, 0.08, 0.02] (row 0 of the matrix directly). Applying the transition matrix a second time mixes that vector through all three rows, landing at roughly 82.8% Calm, 13.4% Volatile, 3.8% Crisis -- still dominated by Calm but with Crisis probability already compounding faster than Volatile's.",
      },
    ],
    constraints: ["transition is a 3x3 row-stochastic matrix", "0 <= n <= 10^4"],
    approach:
      "The distribution after n transitions is the initial row vector right-multiplied by the transition matrix n times: dist_n = dist_0 times P^n. For a small, fixed number of states and a moderate n, repeatedly multiplying the current distribution vector by P in a simple loop is the clearest implementation. For very large n, replace the loop with matrix exponentiation by repeated squaring of P, which computes P^n in O(k^3 log n) instead of O(k^3 n) -- worth doing once k or n gets large enough that the linear loop is the bottleneck, but unnecessary complexity for a 3-state chain and a modest n.",
    code: `import numpy as np

def regime_distribution_after_n_steps(
    transition: list[list[float]], initial: list[float], n: int
) -> list[float]:
    P = np.array(transition, dtype=float)
    dist = np.array(initial, dtype=float)

    # apply the transition matrix n times: dist_n = dist_0 @ P^n.
    # fine for small n; for very large n, swap this loop for matrix
    # exponentiation by squaring to get O(k^3 log n) instead of O(k^3 n)
    for _ in range(n):
        dist = dist @ P

    return dist.tolist()

transition = [
    [0.90, 0.08, 0.02],   # from Calm
    [0.20, 0.70, 0.10],   # from Volatile
    [0.10, 0.30, 0.60],   # from Crisis
]
print(regime_distribution_after_n_steps(transition, initial=[1.0, 0.0, 0.0], n=2))
# [0.828, 0.134, 0.038]`,
    language: "python",
    complexity: { time: "O(n * k^2) with the simple loop, O(k^3 log n) via matrix exponentiation", space: "O(k^2)" },
  },
  {
    id: "lc-20261106-order-book-matching-engine",
    title: "Design a Limit Order Book Matching Engine With Price-Time Priority",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design a class OrderBook supporting add_limit_order(side, price, qty), which adds a buy or sell limit order and immediately matches it against the opposite side's resting orders by price-time priority (best price first; among equal prices, earliest arrival first) for as much quantity as the price allows, resting any unfilled remainder in the book. It returns the list of (price, qty) fills generated by that call. Also support best_bid() and best_ask(), each returning the current best resting price on its side, or None if that side is empty.",
    examples: [
      {
        input:
          'add_limit_order("sell", 101, 50); add_limit_order("sell", 100, 30); add_limit_order("buy", 100, 40); best_bid(); best_ask()',
        output: "fills of the third call: [(100, 30)]; best_bid() = 100; best_ask() = 101",
        explanation:
          "The incoming buy at 100 can only cross asks priced at or below 100, so it matches the resting 100 x 30 ask in full (a fill of 30 at 100) but cannot touch the 101 x 50 ask, which is priced above what the buyer is willing to pay. The remaining 10 units of the buy order rest in the book at 100, becoming the new best bid; the untouched 101 x 50 sell remains the best ask.",
      },
    ],
    constraints: [
      'side is "buy" or "sell"',
      "up to 10^5 combined calls to add_limit_order/best_bid/best_ask",
      "0 < price, qty <= 10^9",
    ],
    approach:
      "Keep two heaps of resting orders: asks as a plain min-heap of (price, arrival_seq) so the best ask is always the root, and bids as a min-heap of (-price, arrival_seq) so negating price makes the highest actual bid sort to the root -- arrival_seq is a strictly increasing counter, so it naturally breaks price ties by earliest arrival without any extra negation. Resting quantities live in a side table keyed by arrival_seq so they can shrink in place as fills happen; when a heap's root entry's live quantity has hit zero, pop it as a stale entry before reading the heap (the same lazy-deletion pattern used for sliding-window top-k), since heaps don't support efficient arbitrary removal. To match an incoming order, repeatedly peek the opposite heap's best price, stop as soon as that price is no longer eligible (an ask above the buy's limit, or a bid below the sell's limit) or quantity runs out, and fill min(incoming remaining, resting remaining) each step; any unfilled remainder becomes a new resting order with a fresh arrival_seq.",
    code: `import heapq
import itertools

class OrderBook:
    def __init__(self) -> None:
        self._seq = itertools.count()                 # strictly increasing arrival counter
        self._bids: list[tuple[float, int]] = []        # max via negated price: (-price, seq)
        self._asks: list[tuple[float, int]] = []        # min-heap: (price, seq)
        self._live: dict[int, list] = {}                 # seq -> [side, price, qty]

    def _prune(self, heap: list[tuple[float, int]]) -> None:
        while heap:
            _, seq = heap[0]
            if seq in self._live and self._live[seq][2] > 0:
                return
            heapq.heappop(heap)   # stale: already fully filled

    def best_bid(self):
        self._prune(self._bids)
        return -self._bids[0][0] if self._bids else None

    def best_ask(self):
        self._prune(self._asks)
        return self._asks[0][0] if self._asks else None

    def add_limit_order(self, side: str, price: float, qty: int) -> list[tuple[float, int]]:
        fills: list[tuple[float, int]] = []
        opposite = self._asks if side == "buy" else self._bids

        while qty > 0:
            self._prune(opposite)
            if not opposite:
                break
            top_price, top_seq = opposite[0]
            resting_price = top_price if side == "buy" else -top_price
            eligible = resting_price <= price if side == "buy" else resting_price >= price
            if not eligible:
                break

            resting = self._live[top_seq]
            fill_qty = min(qty, resting[2])
            fills.append((resting_price, fill_qty))
            qty -= fill_qty
            resting[2] -= fill_qty
            if resting[2] == 0:
                heapq.heappop(opposite)

        if qty > 0:
            seq = next(self._seq)
            self._live[seq] = [side, price, qty]
            heap_key = (-price, seq) if side == "buy" else (price, seq)
            heapq.heappush(self._bids if side == "buy" else self._asks, heap_key)

        return fills

book = OrderBook()
print(book.add_limit_order("sell", 101, 50))   # []
print(book.add_limit_order("sell", 100, 30))   # []
print(book.add_limit_order("buy", 100, 40))    # [(100, 30)]
print(book.best_bid(), book.best_ask())        # 100 101`,
    language: "python",
    complexity: { time: "O(log n) amortized per call", space: "O(n) resting orders" },
  },
];
