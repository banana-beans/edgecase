import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-18
// Running median of a live trade-price stream (two-heap design),
// longest order-flow window tolerating at most K cancellations
// (sliding window), max profit with a mandatory T+1 cooldown day
// after selling (stock DP with an extra state), expected number of
// trades until a market maker's inventory random walk hits a risk
// limit (gambler's ruin probability), and a price-level aggregated
// Level 2 order book (design, lazy-deletion heaps).
// ============================================================

export const financeBatch20261118: LeetCodeProblem[] = [
  {
    id: "lc-20261118-running-median-trade-stream",
    title: "Running Median of a Live Trade Price Stream",
    difficulty: "hard",
    topics: ["heap"],
    problem:
      "Design a data structure that processes a stream of trade prices one at a time via add_price(price), and can return the median of every price seen so far via find_median(), called after any number of additions, in better than O(n) time per call.",
    examples: [
      {
        input: "add_price(10); add_price(20); find_median(); add_price(30); find_median()",
        output: "15.0, 20.0",
        explanation:
          "After [10, 20] the median is the average of both middle values, 15.0. After [10, 20, 30] the middle value is 20.0.",
      },
    ],
    constraints: ["up to 10^5 calls total", "0 <= price <= 10^6"],
    approach:
      "Split the stream into two heaps: a max-heap holding the smaller half of the values seen so far, and a min-heap holding the larger half. On every insert, push into one side then rebalance by moving the top of whichever heap is heavier onto the other, keeping their sizes within one of each other. The median is then either the max-heap's top (odd total count) or the average of both heaps' tops (even count) -- no sorting, no scan, because the two heaps keep the data partitioned around the midpoint at all times. Python's heapq is min-heap only, so the 'max-heap' side stores negated values.",
    code: `import heapq


class RunningMedian:
    def __init__(self) -> None:
        self.lower = []  # max-heap of the smaller half, stored negated
        self.upper = []  # min-heap of the larger half

    def add_price(self, price: float) -> None:
        heapq.heappush(self.lower, -price)
        # make sure every value in lower <= every value in upper
        heapq.heappush(self.upper, -heapq.heappop(self.lower))
        # keep lower at least as large as upper (at most one more)
        if len(self.upper) > len(self.lower):
            heapq.heappush(self.lower, -heapq.heappop(self.upper))

    def find_median(self) -> float:
        if len(self.lower) > len(self.upper):
            return float(-self.lower[0])
        return (-self.lower[0] + self.upper[0]) / 2.0


stream = RunningMedian()
for p in (10, 20):
    stream.add_price(p)
print(stream.find_median())  # 15.0
stream.add_price(30)
print(stream.find_median())  # 20.0`,
    language: "python",
    complexity: { time: "O(log n) per add, O(1) per median", space: "O(n)" },
  },
  {
    id: "lc-20261118-longest-window-max-k-cancels",
    title: "Longest Order-Flow Window With At Most K Cancellations",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a string of order-flow events where each character is 'A' (new order added) or 'C' (an order cancelled), return the length of the longest contiguous window of the stream containing at most K cancellation events.",
    examples: [
      {
        input: 'events = "AACAACAAAC", k = 1',
        output: "5",
        explanation:
          'The window "CAAAC" has 2 cancels, too many. "AACAA" (indices 1-5) or "ACAAA" style windows with exactly one C work -- the longest valid window, e.g. indices 3-7 "ACAAA", has length 5 with exactly 1 cancel.',
      },
    ],
    constraints: ["1 <= events.length <= 10^5", "0 <= k <= events.length"],
    approach:
      "Classic at-most-K sliding window. Expand the right pointer across every event, incrementing a cancel counter whenever the new event is 'C'. Whenever that counter exceeds k, shrink from the left one step at a time (decrementing the counter if the character leaving is itself a 'C') until the window is valid again. Track the best (right - left + 1) seen at every step. Because left only ever moves forward and right visits each index once, the whole scan is O(n) even though it looks like it could be quadratic.",
    code: `def longest_window_with_k_cancels(events: str, k: int) -> int:
    left = 0
    cancels = 0
    best = 0

    for right, ch in enumerate(events):
        if ch == "C":
            cancels += 1

        while cancels > k:
            if events[left] == "C":
                cancels -= 1
            left += 1

        best = max(best, right - left + 1)

    return best


print(longest_window_with_k_cancels("AACAACAAAC", k=1))
# 5`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261118-max-profit-t1-cooldown",
    title: "Max Profit With a Mandatory One-Day Cooldown After Selling (T+1 Settlement)",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for one instrument, you may hold at most one share at a time. After selling, settlement rules force a mandatory one-day cooldown during which you may not buy again (you may still just stay flat). Return the maximum achievable profit.",
    examples: [
      {
        input: "prices = [1, 2, 3, 0, 2]",
        output: "3",
        explanation:
          "Buy day 0 at 1, sell day 1 at 2 (profit 1), cooldown on day 2, buy day 3 at 0, sell day 4 at 2 (profit 2). Total profit 1 + 2 = 3. Selling at the day-2 peak of 3 instead would use up the only other share-eligible day on a cooldown with no time left to re-buy and sell again at 2, netting less.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000", "0 <= prices[i] <= 10^4"],
    approach:
      "Extend the classic single-share stock DP with a THIRD state to represent the cooldown, since 'just sold' and 'free to buy' are no longer the same state. Track hold = best profit while holding a share, sold = best profit on the day you just sold (entering cooldown), and free = best profit while flat and eligible to buy. Transitions per day: new_hold is either staying held or buying today from free (NOT from sold, since sold can't buy yet); new_sold is selling today from hold; new_free is staying free or graduating out of yesterday's cooldown (sold one day prior). The answer is the max of sold and free at the end, since ending while holding is never optimal when you could have sold for free.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    NEG_INF = float("-inf")
    hold, sold, free = NEG_INF, 0, 0  # day-0 state before any trade

    for price in prices:
        prev_hold, prev_sold, prev_free = hold, sold, free
        hold = max(prev_hold, prev_free - price)   # keep holding, or buy from free
        sold = prev_hold + price                    # sell today -> enters cooldown
        free = max(prev_free, prev_sold)             # stay free, or cooldown just ended

    return max(sold, free)


print(max_profit_with_cooldown([1, 2, 3, 0, 2]))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261118-gamblers-ruin-inventory-risk-limit",
    title: "Expected Number of Trades Until a Market Maker's Inventory Hits a Risk Limit",
    difficulty: "medium",
    topics: ["probability"],
    problem:
      "A market maker's inventory starts at 0 shares. Each trade independently moves inventory by +1 (probability p, a buy order hits their offer) or -1 (probability 1-p). The desk must flatten the moment inventory reaches +N or -N (a hard risk limit on either side). Given p, N, and a starting inventory s with -N < s < N, return the expected number of trades until inventory first hits either limit.",
    examples: [
      {
        input: "p = 0.5, N = 3, s = 0",
        output: "9.0",
        explanation:
          "A symmetric random walk starting at the midpoint of a [-3, 3] absorbing range takes, in expectation, (N - s) * (N + s) = 3 * 3 = 9 steps to hit either barrier.",
      },
    ],
    constraints: ["0 < p < 1", "1 <= N <= 1000", "-N < s < N"],
    approach:
      "This is the classic gambler's ruin expected-absorption-time problem, just relabeled as inventory risk rather than casino chips. For a symmetric walk (p = 0.5) on an absorbing range [-N, N] starting at s, the closed form is (N - s) * (N + s). For the asymmetric case (p != 0.5), use the general formula built from q = 1 - p and r = q / p: expected time to absorption at either of -N or +N from s is s / (q - p) minus (2N) / (q - p) times (1 - r^(N + s)) / (1 - r^(2N)), derived from solving the recursive expectation equation E[s] = 1 + p*E[s+1] + q*E[s-1] with boundary conditions E[N] = E[-N] = 0. No simulation is needed -- it reduces to one closed-form evaluation.",
    code: `def expected_trades_to_risk_limit(p: float, n: int, s: int) -> float:
    q = 1 - p
    if abs(p - 0.5) < 1e-12:
        # symmetric random walk: simple closed form
        return float((n - s) * (n + s))

    r = q / p
    numerator = 1 - r ** (n + s)
    denominator = 1 - r ** (2 * n)
    return s / (q - p) - (2 * n) / (q - p) * (numerator / denominator)


print(round(expected_trades_to_risk_limit(p=0.5, n=3, s=0), 4))
# 9.0
print(round(expected_trades_to_risk_limit(p=0.55, n=3, s=0), 4))
# slightly fewer expected trades than the symmetric case, since a
# directional drift reaches one of the two barriers faster on average`,
    language: "python",
    complexity: { time: "O(log n) for the power terms", space: "O(1)" },
  },
  {
    id: "lc-20261118-design-level2-order-book",
    title: "Design a Price-Level Aggregated Level 2 Order Book",
    difficulty: "hard",
    topics: ["design"],
    problem:
      "Design an order book supporting add_order(side, price, size) (side is 'bid' or 'ask'), cancel_order(order_id), and best_bid() / best_ask(), where best_bid/best_ask return the highest bid price / lowest ask price that still has positive total resting size. Orders at the same price level aggregate.",
    examples: [
      {
        input: "add_order('bid', 100, 10, id=1); add_order('bid', 101, 5, id=2); cancel_order(2); best_bid()",
        output: "100",
        explanation:
          "After adding bids at 100 and 101 and then cancelling the order at 101, only the level at 100 still has resting size, so best_bid() returns 100.",
      },
    ],
    constraints: ["up to 10^5 operations total", "price and size are positive integers"],
    approach:
      "Keep a dict order_id -> (side, price, size) for cancellation lookups, and a dict price -> total resting size per side for O(1) aggregation updates. For best_bid/best_ask, use a max-heap of bid prices and a min-heap of ask prices for candidate 'best' prices, but use LAZY deletion: a cancel only decrements the price-level total and does not touch the heap, so a heap can contain stale price entries whose level total has dropped to zero (or below, if that price was fully cancelled). best_bid/best_ask pops stale entries (price levels with <= 0 resting size) off the top of the heap until it finds one that is still live, which amortizes to O(log n) per operation across the whole run even though any single call could pop several stale entries.",
    code: `import heapq
from collections import defaultdict


class Level2OrderBook:
    def __init__(self) -> None:
        self.orders: dict[int, tuple[str, int, int]] = {}  # id -> (side, price, size)
        self.level_size: dict[tuple[str, int], int] = defaultdict(int)  # (side, price) -> total
        self.bid_heap: list[int] = []   # max-heap via negation
        self.ask_heap: list[int] = []   # min-heap

    def add_order(self, side: str, price: int, size: int, order_id: int) -> None:
        self.orders[order_id] = (side, price, size)
        self.level_size[(side, price)] += size
        if side == "bid":
            heapq.heappush(self.bid_heap, -price)
        else:
            heapq.heappush(self.ask_heap, price)

    def cancel_order(self, order_id: int) -> None:
        side, price, size = self.orders.pop(order_id)
        self.level_size[(side, price)] -= size  # lazy: heap entry is left in place

    def best_bid(self) -> int | None:
        while self.bid_heap and self.level_size[("bid", -self.bid_heap[0])] <= 0:
            heapq.heappop(self.bid_heap)  # discard a now-empty price level
        return -self.bid_heap[0] if self.bid_heap else None

    def best_ask(self) -> int | None:
        while self.ask_heap and self.level_size[("ask", self.ask_heap[0])] <= 0:
            heapq.heappop(self.ask_heap)
        return self.ask_heap[0] if self.ask_heap else None


book = Level2OrderBook()
book.add_order("bid", 100, 10, order_id=1)
book.add_order("bid", 101, 5, order_id=2)
book.cancel_order(2)
print(book.best_bid())
# 100`,
    language: "python",
    complexity: { time: "O(log n) amortized per operation", space: "O(n)" },
  },
];
