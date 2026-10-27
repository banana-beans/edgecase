import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-27
// Running median of a streaming tick feed (two heaps), longest
// window of prices whose high-low range stays within a band
// (sliding window + monotonic deques), max profit with unlimited
// trades plus a flat fee AND a cooldown (DP), expected ticks for
// a resting limit order to reach the front of the queue and fill
// (birth-death Markov chain), and a price-time priority limit
// order matching engine (design).
// ============================================================

export const financeBatch20261027: LeetCodeProblem[] = [
  {
    id: "lc-20261027-running-median-midpoint",
    title: "Running Median of the Bid-Ask Midpoint From a Streaming Tick Feed",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given a stream of midpoint prices (floats) arriving one at a time, return, after each new price, the median of all prices seen so far.",
    examples: [
      {
        input: "prices = [100.0, 102.0, 101.0, 105.0]",
        output: "[100.0, 101.0, 101.0, 101.5]",
        explanation:
          "After each new price the median of everything seen so far is recomputed: {100}->100.0, {100,102}->101.0, {100,101,102}->101.0, {100,101,102,105}->101.5.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5"],
    approach:
      "Split the running data into two heaps: a max-heap (via negation) holding the lower half and a min-heap holding the upper half, kept balanced to within one element of each other. Each new price goes into whichever half preserves max(lower) <= min(upper), then a size rebalance keeps the halves within one of each other. The median is read directly off the two heap tops in O(1) once the halves are balanced, so each insertion is O(log n) and no re-sorting is ever needed.",
    code: `import heapq

def running_medians(prices: list[float]) -> list[float]:
    lo: list[float] = []   # max-heap (negated) for the LOWER half
    hi: list[float] = []   # min-heap for the UPPER half
    medians: list[float] = []

    for price in prices:
        # push into whichever half keeps max(lo) <= min(hi)
        if lo and price < -lo[0]:
            heapq.heappush(lo, -price)
        else:
            heapq.heappush(hi, price)

        # rebalance so the two halves never differ in size by more than 1
        if len(lo) > len(hi) + 1:
            heapq.heappush(hi, -heapq.heappop(lo))
        elif len(hi) > len(lo) + 1:
            heapq.heappush(lo, -heapq.heappop(hi))

        if len(lo) == len(hi):
            medians.append((-lo[0] + hi[0]) / 2)
        elif len(lo) > len(hi):
            medians.append(float(-lo[0]))
        else:
            medians.append(float(hi[0]))

    return medians

print(running_medians([100.0, 102.0, 101.0, 105.0]))
# [100.0, 101.0, 101.0, 101.5]`,
    language: "python",
    complexity: { time: "O(n log n) total", space: "O(n)" },
    leetcodeNumber: 295,
  },
  {
    id: "lc-20261027-longest-window-price-range-band",
    title: "Longest Window of Consecutive Prices Whose High-Low Range Stays Within a Band",
    difficulty: "medium",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given an array of prices in time order and a limit, return the length of the longest contiguous subarray whose maximum value minus minimum value is at most limit.",
    examples: [
      {
        input: "prices = [8,2,4,7], limit = 4",
        output: "2",
        explanation:
          "The full array has range 8-2=6 > 4. The longest valid window is length 2, e.g. [2,4] or [4,7], each with range <= 4.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= limit <= 10^9"],
    approach:
      "As the window grows by adding to the right with the left fixed, its max can only increase (or stay the same) and its min can only decrease (or stay the same) -- so the range is monotonically non-decreasing in window growth. That monotonicity is exactly what makes a two-pointer sliding window correct: once a window is invalid, only shrinking from the left can fix it, never growing further. Maintain the window's running max and min with two monotonic deques (amortized O(1) per step) instead of recomputing max/min over the whole window on every move.",
    code: `from collections import deque

def longest_window_within_band(prices: list[int], limit: int) -> int:
    max_deque: deque[int] = deque()   # indices, prices decreasing front-to-back
    min_deque: deque[int] = deque()   # indices, prices increasing front-to-back
    left = 0
    best = 0

    for right, price in enumerate(prices):
        # maintain max_deque decreasing so its front is always the window's max
        while max_deque and prices[max_deque[-1]] <= price:
            max_deque.pop()
        max_deque.append(right)

        # maintain min_deque increasing so its front is always the window's min
        while min_deque and prices[min_deque[-1]] >= price:
            min_deque.pop()
        min_deque.append(right)

        # range only grows as the window grows -- that monotonicity is what
        # makes shrinking from the left (never re-growing) correct here
        while prices[max_deque[0]] - prices[min_deque[0]] > limit:
            left += 1
            if max_deque[0] < left:
                max_deque.popleft()
            if min_deque[0] < left:
                min_deque.popleft()

        best = max(best, right - left + 1)

    return best

print(longest_window_within_band([8, 2, 4, 7], limit=4))
# 2`,
    language: "python",
    complexity: { time: "O(n) amortized", space: "O(n) worst case" },
    leetcodeNumber: 1438,
  },
  {
    id: "lc-20261027-max-profit-fee-cooldown",
    title: "Max Profit With Unlimited Trades, a Flat Fee Per Trade, and a One-Day Cooldown After Selling",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given a daily price array and an integer fee charged on every sell, you may buy and sell an unlimited number of times, but after selling you must wait one full day (a cooldown) before buying again. Return the maximum achievable profit.",
    examples: [
      {
        input: "prices = [1,2,4], fee = 1",
        output: "2",
        explanation:
          "Buy at 1, sell at 4: profit = (4 - 1) - 1 = 2. Buying at 1 and selling at 2 then trying to re-enter is blocked by the cooldown day and nets a worse result anyway.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000", "0 <= fee <= 10^4"],
    approach:
      "Extend the classic three-state cooldown DP (hold / sold / rest) by charging the fee exactly once, at the moment of selling, rather than at the buy. Each day's new state depends only on yesterday's three values, so the whole thing runs in one O(n) left-to-right pass with O(1) extra memory -- no DP table needs to be materialized.",
    code: `def max_profit_fee_cooldown(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    NEG_INF = float("-inf")
    hold = -prices[0]   # holding a position bought on day 0, fee charged only at sell
    sold = NEG_INF        # can't have "just sold" before any trade happens
    rest = 0               # not holding, free to buy

    for price in prices[1:]:
        prev_hold, prev_sold, prev_rest = hold, sold, rest
        hold = max(prev_hold, prev_rest - price)   # keep holding, or buy from a rested state
        sold = prev_hold + price - fee               # sell today -- fee charged HERE, once per trade
        rest = max(prev_rest, prev_sold)             # yesterday's sell forces today to be cooldown

    return max(sold, rest)

print(max_profit_fee_cooldown([1, 2, 4], fee=1))
# 2 -- buy at 1, sell at 4, one trade, one fee: profit = (4 - 1) - 1`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261027-expected-fill-time-queue-position",
    title: "Expected Number of Ticks Until a Resting Limit Order at the Back of the Queue Gets Filled",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "A resting limit order sits k orders behind the front of its price level's queue. On each tick, independently: with probability p the order currently at the front fills and every order (including yours, if you're not yet at the front) moves up one spot; with probability c (only relevant while you're not at the front) one of the orders strictly ahead of you cancels, also moving you up one spot. Once you reach the front, each tick fills your own order with probability p. Compute the expected number of ticks until your order executes, given p, c, and k.",
    examples: [
      {
        input: "p = 0.1, c = 0.05, k = 3",
        output: "30.0",
        explanation:
          "Each step ahead of the front costs an expected 1/(p+c) ticks to close (fill-at-front or cancel-ahead each advance you one spot), plus 1/p expected ticks once you're at the front and waiting for your own geometric fill.",
      },
    ],
    constraints: ["0 < p < 1", "0 <= c < 1", "0 <= k <= 10^4"],
    approach:
      "Condition on the first tick (law of total expectation) to set up a linear recursion. Once at the front (k=0), each tick is an independent Bernoulli(p) fill attempt, so the wait is geometric with expectation 1/p. For k > 0, your position advances by one whenever EITHER the front fills (prob p) OR an order ahead cancels (prob c), so those two events combine additively into a single 'advance' rate (p+c): E[k] = 1 + (p+c)*E[k-1] + (1-p-c)*E[k], which solves to E[k] = 1/(p+c) + E[k-1] -- a recursion that telescopes into one closed form.",
    code: `def expected_ticks_to_fill(p: float, c: float, k: int) -> float:
    # E[0]: at the front, each tick is an independent fill attempt with
    # probability p, so the wait is geometric: expected ticks = 1/p
    e0 = 1 / p

    # E[k] for k > 0: your queue position drops by one whenever EITHER the
    # front order fills (prob p) OR an order ahead of you cancels (prob c) --
    # both move you from state k to state k-1, combining additively in rate.
    # Solving E[k] = 1 + (p+c)*E[k-1] + (1-p-c)*E[k] telescopes to this closed form.
    return k / (p + c) + e0

print(expected_ticks_to_fill(p=0.1, c=0.05, k=3))
# 30.0

# sanity check via Monte Carlo simulation of the same Markov chain
import random

def simulate(p: float, c: float, k: int, trials: int = 20000) -> float:
    total_ticks = 0
    for _ in range(trials):
        pos = k
        ticks = 0
        while True:
            ticks += 1
            roll = random.random()
            if pos == 0:
                if roll < p:
                    break   # your order filled
            elif roll < p + c:
                pos -= 1
        total_ticks += ticks
    return total_ticks / trials

print(round(simulate(0.1, 0.05, 3), 1))  # converges toward 30.0`,
    language: "python",
    complexity: {
      time: "O(1) for the closed form; O(expected ticks) per trial for the simulation",
      space: "O(1)",
    },
  },
  {
    id: "lc-20261027-design-limit-order-matcher",
    title: "Design a Price-Time Priority Limit Order Matching Engine",
    difficulty: "hard",
    topics: ["design", "heap", "hash-map"],
    problem:
      "Design a class OrderBook supporting add_order(order_id, side, price, qty), which adds a resting limit order and immediately matches it against the opposite side at or better than its price in strict price-time priority (best price first, earliest-added first among equal prices), partially filling as needed and resting any unfilled remainder; and cancel(order_id), which removes a still-resting order. add_order returns the list of (resting_order_id, fill_qty, fill_price) trades generated.",
    examples: [
      {
        input: "add_order(1,'sell',101,50); add_order(2,'buy',102,30)",
        output: "trades = [(1, 30, 101)]",
        explanation:
          "Order 2 crosses the book and fills 30 against resting order 1 at order 1's price (101, the resting order's price, the standard convention). Order 1 now rests with 20 remaining; order 2 is fully filled and rests nothing.",
      },
    ],
    constraints: ["up to 10^5 calls to add_order/cancel", "price and qty are positive"],
    approach:
      "Keep a min-heap of resting sells keyed by (price, arrival-sequence) and a max-heap of resting buys keyed by (-price, arrival-sequence) -- the sequence counter is what enforces time priority among equal prices. An incoming order walks the opposite heap, matching while the opposite best price is at least as good as its own limit, filling at the RESTING order's price each time. Cancellation is lazy: mark the order cancelled in a side table and skip it the next time it's popped off a heap, which avoids needing an O(log n) heap-delete operation for an arbitrary order id.",
    code: `import heapq
import itertools

class OrderBook:
    def __init__(self) -> None:
        self._seq = itertools.count()                      # breaks ties by arrival order
        self._buys: list[tuple[float, int, int]] = []       # heap of (-price, seq, order_id)
        self._sells: list[tuple[float, int, int]] = []      # heap of (price, seq, order_id)
        self._orders: dict[int, list] = {}                  # id -> [side, price, remaining_qty, cancelled]

    def add_order(self, order_id: int, side: str, price: float, qty: int) -> list[tuple[int, int, float]]:
        trades: list[tuple[int, int, float]] = []
        book, opposite = (self._buys, self._sells) if side == "buy" else (self._sells, self._buys)
        crosses = (lambda rp: rp <= price) if side == "buy" else (lambda rp: rp >= price)

        remaining = qty
        while remaining > 0 and opposite:
            _, _, resting_id = opposite[0]
            resting = self._orders.get(resting_id)
            if resting is None or resting[3]:          # already filled/cancelled -- lazy delete
                heapq.heappop(opposite)
                continue
            if not crosses(resting[1]):
                break   # best opposite price is worse than our limit -- no more matches possible

            fill_qty = min(remaining, resting[2])
            trades.append((resting_id, fill_qty, resting[1]))   # fills at the RESTING order's price
            resting[2] -= fill_qty
            remaining -= fill_qty
            if resting[2] == 0:
                resting[3] = True
                heapq.heappop(opposite)

        if remaining > 0:
            seq = next(self._seq)
            self._orders[order_id] = [side, price, remaining, False]
            key = (-price, seq, order_id) if side == "buy" else (price, seq, order_id)
            heapq.heappush(book, key)

        return trades

    def cancel(self, order_id: int) -> None:
        if order_id in self._orders:
            self._orders[order_id][3] = True   # lazy delete -- skipped when popped later

book = OrderBook()
book.add_order(1, "sell", 101, 50)
print(book.add_order(2, "buy", 102, 30))
# [(1, 30, 101)]`,
    language: "python",
    complexity: { time: "O(log n) amortized per call", space: "O(n)" },
  },
];
