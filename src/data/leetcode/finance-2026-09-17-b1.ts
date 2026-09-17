import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-17
// A two-heap running-median tracker for a live price feed, a
// positive-sum sliding window for a notional budget, a two-state
// DP for buy/sell with a transaction fee, a linear-algebra
// stationary-distribution solve for a market maker's inventory
// Markov chain, and a price-time-priority limit order book design.
// ============================================================

export const financeBatch20260917: LeetCodeProblem[] = [
  {
    id: "lc-20260917-running-median-price-feed",
    title: "Running Median of a Live Price Feed",
    difficulty: "medium",
    topics: ["heap", "design"],
    problem:
      "Design a class that ingests a live stream of prices one at a time via add(price) and supports median() returning the current median of all prices seen so far, in O(log n) time per add and O(1) time per query, without re-sorting the full history on each call.",
    examples: [
      {
        input: "add(5); add(2); median() -> 3.5; add(7); median() -> 5",
        output: "the median of all values added so far",
        explanation:
          "After add(5), add(2), the sorted values are [2,5], median is their average, 3.5. After add(7), sorted values are [2,5,7], median is the middle value, 5.",
      },
    ],
    constraints: ["up to 10^5 add calls", "prices are finite floating point values"],
    approach:
      "Maintain two heaps that split the data at the median: a max-heap (via negation, since Python's heapq is min-heap only) holding the smaller half, and a min-heap holding the larger half. On each add, route the new value to whichever half it belongs in by comparing against the max-heap's top, then rebalance so the max-heap never holds more than one extra element versus the min-heap. The median is then either the max-heap's top (odd total count) or the average of both heaps' tops (even total count) -- both O(1) reads. Each add does at most one push and one rebalancing pop-and-push, so it's O(log n); median() never touches the heap structure, just peeks at the tops.",
    code: `import heapq

class RunningMedian:
    def __init__(self):
        self.lower: list[float] = []   # max-heap via negation -- smaller half
        self.upper: list[float] = []   # min-heap -- larger half

    def add(self, price: float) -> None:
        # route the new value to whichever half it belongs in, then rebalance
        if self.lower and price > -self.lower[0]:
            heapq.heappush(self.upper, price)
        else:
            heapq.heappush(self.lower, -price)

        # keep sizes within one of each other; lower is allowed the extra
        if len(self.lower) > len(self.upper) + 1:
            heapq.heappush(self.upper, -heapq.heappop(self.lower))
        elif len(self.upper) > len(self.lower):
            heapq.heappush(self.lower, -heapq.heappop(self.upper))

    def median(self) -> float:
        if len(self.lower) > len(self.upper):
            return -self.lower[0]
        return (-self.lower[0] + self.upper[0]) / 2

rm = RunningMedian()
rm.add(5)
rm.add(2)
print(rm.median())   # 3.5
rm.add(7)
print(rm.median())   # 5`,
    language: "python",
    complexity: { time: "O(log n) per add, O(1) per median", space: "O(n)" },
  },
  {
    id: "lc-20260917-longest-window-within-budget",
    title: "Longest Contiguous Order Sequence Within a Notional Budget",
    difficulty: "medium",
    topics: ["sliding-window", "two-pointer"],
    problem:
      "Given an array of order notionals (positive integers) representing a sequence of orders arriving in time, and a capital budget, return the length of the longest contiguous run of orders whose notionals sum to at most budget.",
    examples: [
      {
        input: "notionals=[4,2,1,3,5], budget=6",
        output: "3",
        explanation:
          "The window [2,1,3] sums to 6, which is within budget, and has length 3. No length-4 window fits: [4,2,1,3] sums to 10, and [2,1,3,5] sums to 11.",
      },
    ],
    constraints: ["1 <= notionals.length <= 10^5", "1 <= notionals[i] <= 10^9", "1 <= budget <= 10^9"],
    approach:
      "Because every notional is strictly positive, the running window sum is monotonic in both pointers, which is exactly the condition that makes the classic two-pointer sliding window valid: expanding the right pointer only ever increases the sum, and shrinking from the left only ever decreases it. Expand right, adding each new notional to a running total; whenever that total exceeds budget, shrink from the left until it's back within budget. Because each index enters and leaves the window at most once across the whole scan, total work is O(n) despite the nested-looking shrink loop. This technique breaks the moment negative notionals are allowed, since shrinking the window would no longer guarantee a decreasing sum.",
    code: `def longest_within_budget(notionals: list[int], budget: int) -> int:
    left = 0
    window_sum = 0
    best = 0

    for right, notional in enumerate(notionals):
        window_sum += notional
        # shrink from the left while over budget -- safe only because every
        # notional is positive, so removing one strictly decreases the sum
        while window_sum > budget:
            window_sum -= notionals[left]
            left += 1
        best = max(best, right - left + 1)

    return best

print(longest_within_budget([4, 2, 1, 3, 5], 6))   # 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260917-max-profit-transaction-fee",
    title: "Best Time to Buy and Sell Stock With a Transaction Fee",
    difficulty: "medium",
    topics: ["dynamic-programming", "greedy"],
    problem:
      "Given daily prices and a fixed fee charged once per completed round trip, where you may hold at most one share at a time and make unlimited transactions, return the maximum achievable profit.",
    examples: [
      {
        input: "prices=[1,3,2,8,4,9], fee=2",
        output: "8",
        explanation:
          "Buy at 1, sell at 8: profit 8-1-2=5. Buy at 4, sell at 9: profit 9-4-2=3. Total 5+3=8, which beats any other combination of round trips.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^4", "0 <= fee <= 10^4"],
    approach:
      "Track two running states day by day instead of an explicit 2D table: cash, the best achievable profit while flat (holding no position), and hold, the best achievable profit while currently holding one share. Each day, cash can either stay the same or come from selling today (hold plus today's price, minus the fee, charged exactly once per round trip on the sell side); hold can either stay the same or come from buying today (cash minus today's price). Both transitions only ever reference the PREVIOUS day's cash and hold, so two scalars replace an O(n)-sized DP array, giving O(1) space instead of O(n).",
    code: `def max_profit_with_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    cash = 0                 # best profit while flat (no position)
    hold = -prices[0]        # best profit while holding one share

    for price in prices[1:]:
        # sell today: fee charged exactly once per round trip, on the sell
        cash = max(cash, hold + price - fee)
        # buy today: only worth it if it beats staying flat
        hold = max(hold, cash - price)

    return cash   # end of period, the best result requires being flat

print(max_profit_with_fee([1, 3, 2, 8, 4, 9], 2))   # 8`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260917-market-maker-inventory-stationary",
    title: "Long-Run Inventory Distribution of a Market Maker",
    difficulty: "hard",
    topics: ["markov-chain", "probability", "linear-algebra"],
    problem:
      "A market maker's inventory, in lots, does a birth-death random walk on integer states -N..N. From any interior state i, inventory moves to i+1 with probability u (a buy fill), to i-1 with probability d (a sell fill), and stays at i with probability 1-u-d. At the boundaries +N and -N, the maker skews quotes hard enough to guarantee a move back toward zero: from +N it moves to N-1 with probability 1, and symmetrically from -N to -N+1 with probability 1. Given u, d, and N, return the long-run (stationary) probability of each inventory state.",
    examples: [
      {
        input: "N=1, u=0.5, d=0.5",
        output: "[0.25, 0.5, 0.25]",
        explanation:
          "For states -1, 0, 1: the boundary's forced pull-back combined with the interior's symmetric 50/50 walk yields a distribution that is symmetric and weighted toward the center inventory state 0.",
      },
    ],
    constraints: ["1 <= N <= 50", "0 < u, d and u + d <= 1", "boundaries deterministically pull back toward zero"],
    approach:
      "Build the full (2N+1) x (2N+1) transition matrix P directly from the stated rules: interior rows get probability u to the state above, d to the state below, and 1-u-d as a self-loop; the two boundary rows are deterministic, moving with probability 1 to their single neighbor. The stationary distribution pi satisfies pi = pi @ P, i.e. (P^T - I) @ pi = 0, together with the normalization constraint that pi sums to 1. Since that homogeneous system is singular by construction (rows of P^T - I sum to zero), replace one of its equations with the normalization constraint directly and solve the resulting well-posed linear system with a standard solver, rather than trying to find a null-space vector by hand.",
    code: `import numpy as np

def stationary_inventory_distribution(N: int, u: float, d: float) -> np.ndarray:
    states = list(range(-N, N + 1))
    n = len(states)
    P = np.zeros((n, n))

    for idx, i in enumerate(states):
        if i == N:
            P[idx, idx - 1] = 1.0     # forced pull back from the top boundary
        elif i == -N:
            P[idx, idx + 1] = 1.0     # forced pull back from the bottom boundary
        else:
            P[idx, idx + 1] = u
            P[idx, idx - 1] = d
            P[idx, idx] = 1 - u - d

    # solve pi = pi @ P, i.e. (P.T - I) @ pi = 0, subject to sum(pi) == 1 --
    # replace one (redundant) equation with the normalization constraint
    A = P.T - np.eye(n)
    A[-1, :] = 1.0
    b = np.zeros(n)
    b[-1] = 1.0

    return np.linalg.solve(A, b)

pi = stationary_inventory_distribution(N=1, u=0.5, d=0.5)
print(np.round(pi, 4))   # [0.25, 0.5, 0.25]`,
    language: "python",
    complexity: { time: "O(N^3) for the linear solve", space: "O(N^2) for the transition matrix" },
  },
  {
    id: "lc-20260917-limit-order-book-matcher",
    title: "Design a Price-Time Priority Limit Order Matching Engine",
    difficulty: "hard",
    topics: ["design", "heap", "queue"],
    problem:
      "Design a class implementing a single-instrument limit order book with price-time priority matching. add_order(order_id, side, price, qty) inserts a new limit order and immediately matches it against the opposite side's best-priced resting orders (a buy matches asks priced at or below its price, a sell matches bids priced at or above its price), with the oldest order at a given price level filling first; any unfilled remainder rests in the book. cancel(order_id) removes a resting order. best_bid() and best_ask() return the best available price on each side, or None if that side is empty.",
    examples: [
      {
        input: "add_order(1,'sell',101,50); add_order(2,'buy',102,30)",
        output: "best_ask() -> 101; best_bid() -> None",
        explanation:
          "Order 2's buy at 102 crosses order 1's ask at 101, filling 30 of order 1's 50 shares. Order 1 rests with 20 remaining at 101 (still the best ask). Order 2 is fully filled, so nothing rests on the bid side.",
      },
    ],
    constraints: ["up to 10^5 add_order/cancel calls", "prices are integer ticks", "quantities are positive"],
    approach:
      "Store each side's resting orders as a dict from price to a deque of [order_id, remaining_qty], where deque order enforces time priority (oldest at index 0), plus a heap of candidate price levels per side (negated for a bid max-heap, plain for an ask min-heap) to find the best price in O(log P). Cancellation is handled with lazy deletion -- an order_id is added to a cancelled set and simply skipped wherever it's popped off a deque, avoiding the need for O(1) arbitrary-position removal from a deque. On add_order, repeatedly peek the opposite side's best price while it still crosses the incoming price, draining resting quantity oldest-first until either the incoming order is fully filled or the opposite side no longer crosses; any leftover quantity then rests as a new order on the incoming side.",
    code: `import heapq
from collections import deque, defaultdict

class OrderBook:
    def __init__(self):
        # price -> deque of [order_id, remaining_qty], oldest at index 0
        self.bids: dict[int, deque] = defaultdict(deque)
        self.asks: dict[int, deque] = defaultdict(deque)
        self.bid_heap: list[int] = []   # negated prices -- max-heap of candidate bids
        self.ask_heap: list[int] = []   # min-heap of candidate asks
        self.cancelled: set[int] = set()

    def _best_price(self, heap: list[int], book: dict, negated: bool) -> int | None:
        # lazily drop heap entries whose price level has fully emptied
        while heap:
            price = -heap[0] if negated else heap[0]
            if book.get(price):
                return price
            heapq.heappop(heap)
        return None

    def best_bid(self) -> int | None:
        return self._best_price(self.bid_heap, self.bids, negated=True)

    def best_ask(self) -> int | None:
        return self._best_price(self.ask_heap, self.asks, negated=False)

    def cancel(self, order_id: int) -> None:
        self.cancelled.add(order_id)   # O(1) lazy delete, resolved when popped

    def add_order(self, order_id: int, side: str, price: int, qty: int) -> None:
        is_buy = side == "buy"
        opp_book = self.asks if is_buy else self.bids
        opp_heap = self.ask_heap if is_buy else self.bid_heap
        crosses = (lambda p: p <= price) if is_buy else (lambda p: p >= price)

        while qty > 0:
            best = self._best_price(opp_heap, opp_book, negated=not is_buy)
            if best is None or not crosses(best):
                break
            level = opp_book[best]
            while level and qty > 0:
                resting_id, resting_qty = level[0]
                if resting_id in self.cancelled:
                    level.popleft()
                    continue
                fill = min(qty, resting_qty)
                qty -= fill
                level[0][1] -= fill
                if level[0][1] == 0:
                    level.popleft()
            if not level:
                del opp_book[best]

        if qty > 0:
            book, heap = (self.bids, self.bid_heap) if is_buy else (self.asks, self.ask_heap)
            book[price].append([order_id, qty])
            heapq.heappush(heap, -price if is_buy else price)

book = OrderBook()
book.add_order(1, "sell", 101, 50)
book.add_order(2, "buy", 102, 30)     # crosses -- fills 30 against order 1
print(book.best_ask())    # 101 -- order 1 still resting with 20 left
print(book.best_bid())    # None -- order 2 fully filled, nothing rests`,
    language: "python",
    complexity: { time: "O(log P) amortized per operation (P = distinct price levels)", space: "O(n)" },
  },
];
