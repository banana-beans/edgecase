import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-21
// K closest trades to the mid-price (heap), longest run of
// trades within a notional budget (sliding window), max profit
// with a flat per-round-trip transaction fee (DP stock variant),
// expected trades until two consecutive wins (probability/Markov),
// and a limit order book top-of-book matching engine (design).
// ============================================================

export const financeBatch20261021: LeetCodeProblem[] = [
  {
    id: "lc-20261021-k-closest-trades-mid-price",
    title: "K Closest Trades to the Mid-Price",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given an array of trade prices executed during one second and the current mid-price, return the k trade prices closest to the mid-price. If two prices are equally close, the smaller price comes first in the result order.",
    examples: [
      {
        input: "prices = [101, 99, 100, 103, 97], mid = 100, k = 3",
        output: "[100, 99, 101]",
        explanation:
          "Distances are 1,1,0,3,3. The three closest are 100 (distance 0), then the distance-1 tie between 99 and 101, with 99 ordered first since it's the smaller price.",
      },
    ],
    constraints: ["1 <= k <= prices.length <= 10^5"],
    approach:
      "Maintain a bounded max-heap of size k on (distance, price), implemented as a min-heap over negated tuples so Python's heapq pops the current worst candidate (largest distance, and among ties the larger price, since the smaller price should win a tie). Push every price in, and whenever the heap exceeds size k, pop the worst one off -- after one pass the heap holds exactly the k best survivors in O(n log k) total. A final sort of just those k items gives the required closest-first, smaller-price-first ordering.",
    code: `import heapq

def k_closest_trades(prices: list[int], mid: int, k: int) -> list[int]:
    heap: list[tuple[int, int]] = []
    for price in prices:
        distance = abs(price - mid)
        # max-heap on (distance, price) via negation -- top is the current worst
        heapq.heappush(heap, (-distance, -price))
        if len(heap) > k:
            heapq.heappop(heap)

    # unpack and sort ascending by (distance, price) for the required order
    closest = sorted((-d, -p) for d, p in heap)
    return [p for _, p in closest]

print(k_closest_trades([101, 99, 100, 103, 97], mid=100, k=3))
# [100, 99, 101]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-20261021-longest-run-within-notional-budget",
    title: "Longest Contiguous Run of Trades Within a Notional Budget",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given an array of trade notional sizes (all positive) in execution order and a capital budget, return the length of the longest contiguous run of trades whose total notional does not exceed the budget.",
    examples: [
      {
        input: "notionals = [5, 10, 5, 10, 5], budget = 25",
        output: "3",
        explanation:
          "The window [10, 5, 10] sums to 25, and no longer contiguous window stays within the budget.",
      },
    ],
    constraints: ["1 <= notionals.length <= 10^5", "0 < notionals[i], budget <= 10^9"],
    approach:
      "Because every notional is strictly positive, the running window sum only grows as the right edge advances and only shrinks as the left edge advances -- that monotonicity is exactly what makes the classic two-pointer sliding window both correct and O(n) here. Expand the window one trade at a time, and whenever the running sum exceeds budget, advance the left pointer (subtracting trades as they leave) until it's valid again, tracking the longest valid window length seen along the way.",
    code: `def longest_run_within_budget(notionals: list[float], budget: float) -> int:
    left = 0
    window_sum = 0.0
    best = 0

    for right, notional in enumerate(notionals):
        window_sum += notional
        # shrink from the left while the running total breaks budget
        while window_sum > budget:
            window_sum -= notionals[left]
            left += 1
        best = max(best, right - left + 1)

    return best

print(longest_run_within_budget([5, 10, 5, 10, 5], budget=25))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261021-max-profit-transaction-fee",
    title: "Maximum Profit With a Flat Transaction Fee Per Round Trip",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for one instrument and a flat fee charged once per completed round trip (buy then sell), return the maximum achievable profit. Any number of round trips is allowed, but you cannot hold more than one unit at a time.",
    examples: [
      {
        input: "prices = [1, 3, 2, 8, 4, 9], fee = 2",
        output: "8",
        explanation:
          "Buy at 1, sell at 8: profit 7 minus fee 2 = 5. Buy at 4, sell at 9: profit 5 minus fee 2 = 3. Total profit 8.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i], fee <= 10^4"],
    approach:
      "Track two running states day by day: cash (max profit so far if currently flat) and hold (max profit so far if currently holding one unit). Each day, hold can either keep holding or buy using yesterday's cash; cash can either stay flat or sell today's held unit, paying the fee once on the sell leg. Charging the fee at the sell step rather than the buy step is an arbitrary but convenient accounting choice -- every completed round trip pays exactly one fee regardless of which leg it's attached to, so the final answer is unaffected. Both states only need the previous day's values, so this runs in O(1) space.",
    code: `def max_profit_with_fee(prices: list[int], fee: int) -> int:
    cash = 0                  # max profit, currently flat
    hold = float("-inf")      # max profit, currently holding one unit

    for price in prices:
        prev_cash = cash
        # sell today: pay the fee once, on the sell leg, by convention
        cash = max(cash, hold + price - fee)
        # buy today: use cash left over from before today's update
        hold = max(hold, prev_cash - price)

    return cash

print(max_profit_with_fee([1, 3, 2, 8, 4, 9], fee=2))
# 8`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261021-expected-trades-until-two-consecutive-wins",
    title: "Expected Number of Trades Until Two Consecutive Winning Trades",
    difficulty: "hard",
    topics: ["probability"],
    problem:
      "Each trade independently wins with probability p. Return the expected number of trades needed until you observe two wins in a row for the first time.",
    examples: [
      {
        input: "p = 0.5",
        output: "6.0",
        explanation:
          "The classic 'expected flips until two heads in a row' result for a fair coin is 6.",
      },
    ],
    constraints: ["0 < p < 1"],
    approach:
      "Model this as a Markov chain on the current win-streak length: state 0 (no streak, or just broke one) and state 1 (one win in a row), with two-in-a-row absorbing. Let E0 and E1 be the expected additional trades needed from each state. From state 0, one trade moves you to state 1 with probability p or keeps you at state 0 otherwise: E0 = 1 + p*E1 + (1-p)*E0. From state 1, one trade either completes the streak (probability p, 0 further trades needed) or drops you back to state 0: E1 = 1 + (1-p)*E0. Solving these two linear equations gives the closed form E0 = 1/p + 1/p^2, which collapses to 6.0 at p = 0.5 and shortens rapidly as p rises, since a higher win rate makes the SECOND consecutive win disproportionately easier to land once you already have the first.",
    code: `def expected_trades_until_two_wins(p: float) -> float:
    # closed form from the two-state Markov chain (streak length 0 or 1),
    # derived by solving E0 = 1/p + E1 and E1 = 1/p^2 for E0 directly
    return 1 / p + 1 / (p ** 2)

print(expected_trades_until_two_wins(0.5))
# 6.0

print(round(expected_trades_until_two_wins(0.6), 4))
# a higher per-trade win probability shortens the expected wait a lot more
# than proportionally, since landing the SECOND consecutive win gets much
# easier once the first one is already in hand`,
    language: "python",
    complexity: { time: "O(1)", space: "O(1)" },
  },
  {
    id: "lc-20261021-design-limit-order-book-top-of-book",
    title: "Design a Limit Order Book (Top-of-Book Matching Engine)",
    difficulty: "hard",
    topics: ["design"],
    problem:
      "Design a class LimitOrderBook supporting add_order(order_id, side, price, quantity) where side is 'buy' or 'sell', cancel_order(order_id), and best_bid_ask() returning a (best_bid_price, best_ask_price) tuple (None for a side with no resting orders). An incoming order that crosses the opposite side's best price should execute immediately, in price-time priority, against resting orders before any unfilled remainder rests on the book.",
    examples: [
      {
        input:
          "add_order(1,'buy',100,10); add_order(2,'sell',101,5); best_bid_ask(); add_order(3,'sell',100,10); best_bid_ask()",
        output: "(100, 101), then (None, 101)",
        explanation:
          "Order 3 crosses the resting bid at 100 and fully fills against it (10 for 10), so order 1 is gone and the bid side is empty, while order 2's resting ask at 101 is untouched.",
      },
    ],
    constraints: ["up to 10^5 total operations"],
    approach:
      "Keep two heaps: a max-heap of bids keyed by negated price (so the lowest tuple is the highest price) and a min-heap of asks keyed by price directly, both with a monotonically increasing sequence number as a tie-break to preserve price-time priority. Remaining quantity lives in a separate order_id-to-size dict, since heap entries are immutable once pushed; a cancelled or fully-filled order is never removed from the middle of a heap (that's not O(log n)) but simply marked with zero remaining size, and lazily skipped wherever it later surfaces at the top. add_order matches against the opposite side's heap while prices cross and both sides still have size, decrementing remaining quantities and popping any resting order that becomes fully filled; any unfilled remainder of the incoming order is then pushed onto its own side. best_bid_ask pops stale entries off each heap's top until it finds a live one.",
    code: `import heapq
import itertools

class LimitOrderBook:
    def __init__(self):
        self.bids: list[tuple[int, int, int]] = []    # (-price, seq, order_id)
        self.asks: list[tuple[int, int, int]] = []     # (price, seq, order_id)
        self.remaining: dict[int, int] = {}
        self.seq = itertools.count()

    def add_order(self, order_id: int, side: str, price: int, quantity: int) -> None:
        self.remaining[order_id] = quantity
        book, opposite = (self.bids, self.asks) if side == "buy" else (self.asks, self.bids)
        # a buy crosses any resting ask at or below its price; a sell crosses
        # any resting bid at or above its price
        crosses = (lambda p: p <= price) if side == "buy" else (lambda p: p >= price)

        while opposite and self.remaining[order_id] > 0:
            top_id = opposite[0][2]
            if self.remaining.get(top_id, 0) <= 0:
                heapq.heappop(opposite)   # lazily discard a filled/cancelled resting order
                continue
            # bids store price negated (max-heap via a min-heap); asks store it directly
            top_price = opposite[0][0] if side == "buy" else -opposite[0][0]
            if not crosses(top_price):
                break
            fill = min(self.remaining[order_id], self.remaining[top_id])
            self.remaining[order_id] -= fill
            self.remaining[top_id] -= fill
            if self.remaining[top_id] == 0:
                heapq.heappop(opposite)

        if self.remaining[order_id] > 0:
            key = -price if side == "buy" else price
            heapq.heappush(book, (key, next(self.seq), order_id))

    def cancel_order(self, order_id: int) -> None:
        self.remaining[order_id] = 0   # lazy delete -- skipped wherever it later surfaces

    def best_bid_ask(self):
        def best(heap, negate):
            while heap and self.remaining.get(heap[0][2], 0) <= 0:
                heapq.heappop(heap)
            if not heap:
                return None
            return -heap[0][0] if negate else heap[0][0]

        return (best(self.bids, True), best(self.asks, False))

book = LimitOrderBook()
book.add_order(1, "buy", 100, 10)
book.add_order(2, "sell", 101, 5)
print(book.best_bid_ask())        # (100, 101)
book.add_order(3, "sell", 100, 10)
print(book.best_bid_ask())        # (None, 101)`,
    language: "python",
    complexity: { time: "O(log n) amortized per operation", space: "O(n)" },
  },
];
