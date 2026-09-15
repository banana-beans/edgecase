import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-15
// A two-heap running median, a prefix-sum/hashmap shortest-run
// problem (signed trade sizes rule out a plain two-pointer
// window), an at-most-two-round-trips stock DP, an expected-
// duration gambler's-ruin problem solved with a tridiagonal
// linear solve, and a price-time priority order book matcher.
// ============================================================

export const financeBatch20260915: LeetCodeProblem[] = [
  {
    id: "lc-20260915-running-median-trade-price",
    title: "Running Median of Trade Prices via Two Heaps",
    difficulty: "medium",
    topics: ["heap", "design"],
    problem:
      "Design a class that ingests trade prices one at a time via add(price) and returns the running median of all prices seen so far via median(). The median must be available after every add call in better than O(n log n) time overall.",
    examples: [
      {
        input: "add(30); add(10); median() -> 20.0; add(20); median() -> 20.0",
        output: "running median after each query",
        explanation:
          "After [30,10], sorted is [10,30], median is their average 20.0. After adding 20, sorted [10,20,30], median is the middle value 20.0.",
      },
    ],
    constraints: ["up to 10^5 total add calls", "prices are positive floats"],
    approach:
      "Maintain two heaps: a max-heap for the lower half of values seen so far, and a min-heap for the upper half, kept balanced in size (differing by at most one). Push each new value into the max-heap (lower half) first, then rebalance by moving its top into the min-heap so every value in the lower half stays <= every value in the upper half; if the min-heap then grows larger than the max-heap, move one element back to restore the size invariant. The median is the top of whichever heap holds the extra element (odd total count), or the average of both tops (even total count) -- both reachable in O(1), with each add costing O(log n) for the heap operations.",
    code: `import heapq

class RunningMedian:
    def __init__(self):
        self.lo: list[float] = []   # max-heap (stored negated) -- lower half
        self.hi: list[float] = []   # min-heap -- upper half

    def add(self, price: float) -> None:
        # push into lower half first, then promote its top into upper half
        # so every "lo" value ends up <= every "hi" value
        heapq.heappush(self.lo, -price)
        heapq.heappush(self.hi, -heapq.heappop(self.lo))
        # keep sizes balanced within 1 -- lo is allowed the extra element
        if len(self.hi) > len(self.lo):
            heapq.heappush(self.lo, -heapq.heappop(self.hi))

    def median(self) -> float:
        if len(self.lo) > len(self.hi):
            return float(-self.lo[0])
        return (-self.lo[0] + self.hi[0]) / 2.0

rm = RunningMedian()
for p in [30, 10, 20]:
    rm.add(p)
    print(rm.median())
# 30.0, 20.0, 20.0`,
    language: "python",
    complexity: { time: "O(log n) per add, O(1) per median", space: "O(n)" },
  },
  {
    id: "lc-20260915-shortest-subarray-target-exposure",
    title: "Shortest Contiguous Trade Run Summing to a Target Net Exposure",
    difficulty: "medium",
    topics: ["array", "hash-table", "prefix-sum"],
    problem:
      "Given an array of signed trade sizes (positive = buy, negative = sell) in execution order, and a target net exposure, return the length of the shortest contiguous run of trades whose sizes sum exactly to the target. Return -1 if no such run exists. Trade sizes can be negative, so a two-pointer window is not directly valid.",
    examples: [
      {
        input: "trades=[4,1,-2,3], target=5",
        output: "2",
        explanation:
          "The run [4,1] sums to 5 in 2 trades. No single trade equals 5, and every other contiguous run either misses the target or is longer, so 2 is shortest.",
      },
    ],
    constraints: ["1 <= trades.length <= 10^5", "-10^4 <= trades[i] <= 10^4"],
    approach:
      "Because elements can be negative, sums are not monotonic as the window grows, so a sliding two-pointer window (valid only for non-negative arrays) doesn't directly apply. Instead track prefix sums and, for each right endpoint, look up whether prefix_sum[right] - target has already been seen as some earlier prefix_sum[left] -- that's exactly the condition for the subarray between them to sum to target. Store in a hashmap the MOST RECENT index at which each prefix-sum value occurred: since we scan right to left-to-right and only ever look up prefix sums recorded before the current index, keeping the latest occurrence maximizes the candidate left index for any given right, which is exactly what minimizes window length. Each right endpoint costs one O(1) hashmap lookup and update, giving O(n) overall.",
    code: `def shortest_run_for_target(trades: list[int], target: int) -> int:
    # prefix_index[s] = most RECENT index i with prefix_sum(trades[:i]) == s.
    # keeping the most recent index maximizes "left" for any future "right",
    # which is exactly what minimizes window length
    prefix_index = {0: 0}   # prefix sum of 0 occurs at index 0 (empty prefix)
    prefix = 0
    best = float("inf")

    for right, size in enumerate(trades, start=1):
        prefix += size
        needed = prefix - target
        if needed in prefix_index:
            best = min(best, right - prefix_index[needed])
        # overwrite: this index becomes the new "most recent" for this sum
        prefix_index[prefix] = right

    return best if best != float("inf") else -1

print(shortest_run_for_target([4, 1, -2, 3], 5))   # 2  -> [4, 1]`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-20260915-at-most-two-transactions",
    title: "Maximum Profit With At Most Two Round-Trip Trades",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for one instrument over a quarter, you may complete at most two non-overlapping buy-then-sell round trips (you must sell before buying again). Return the maximum total profit achievable.",
    examples: [
      {
        input: "prices=[3,3,5,0,0,3,1,4]",
        output: "6",
        explanation:
          "Buy at 0 (index 3), sell at 3 (index 5) for profit 3; buy at 1 (index 6), sell at 4 (index 7) for profit 3. Total 6, better than any single round trip alone.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^5"],
    approach:
      "Track four running states across a single pass: buy1 (max profit-so-far after a first buy, i.e. a negative cash outlay), sell1 (max profit after closing the first round trip), buy2 (max profit after a second buy, funded conceptually by sell1's proceeds), sell2 (max profit after closing the second round trip). Update them in the order buy1, sell1, buy2, sell2 within the same loop iteration -- buy2's formula is allowed to use TODAY's freshly-updated sell1, which only helps, since an earlier profit can't be worse than a later, equal-or-better one. The answer is sell2 at the end, since a completed second round trip always dominates completing only one or none.",
    code: `def max_profit_two_transactions(prices: list[int]) -> int:
    if not prices:
        return 0

    buy1 = buy2 = float("-inf")
    sell1 = sell2 = 0

    for price in prices:
        # order matters: sell1 uses today's buy1, buy2 uses today's sell1 --
        # each is allowed to reuse the SAME day's just-updated value, which
        # models "buy and sell on the same day" as a valid, zero-profit no-op
        buy1 = max(buy1, -price)
        sell1 = max(sell1, buy1 + price)
        buy2 = max(buy2, sell1 - price)
        sell2 = max(sell2, buy2 + price)

    return sell2

print(max_profit_two_transactions([3, 3, 5, 0, 0, 3, 1, 4]))   # 6`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260915-expected-ticks-mean-reversion",
    title: "Expected Number of Ticks Until a Bounded Walk Hits a Barrier",
    difficulty: "medium",
    topics: ["dynamic-programming", "probability", "markov-chain"],
    problem:
      "A position's P&L, in whole ticks, starts at integer level s strictly between -n and +n. Each tick moves up by 1 with probability p and down by 1 with probability 1-p. A stop-loss at -n and a take-profit at +n both absorb (the process stops). Compute the expected number of ticks until absorption at either barrier, starting from s.",
    examples: [
      {
        input: "n=3, s=0, p=0.5",
        output: "9.0",
        explanation:
          "For a symmetric walk with barriers at -n and +n starting at the midpoint 0, the classic gambler's-ruin expected-duration result gives n^2 = 9 -- unlike a probability question, this asks for expected TIME, a different quantity entirely.",
      },
    ],
    constraints: ["1 <= n <= 500", "-n < s < n", "0 < p < 1"],
    approach:
      "This asks for expected DURATION until absorption, not the probability of hitting one barrier before the other, so define E[i] as the expected number of remaining ticks starting from position i, with E[-n] = E[n] = 0 at the absorbing barriers. For every interior i, one tick always elapses, then with probability p you're left with E[i+1]'s worth of remaining ticks and with probability 1-p with E[i-1]'s: E[i] = 1 + p*E[i+1] + (1-p)*E[i-1]. Each unknown only couples to its immediate neighbors, so this forms a tridiagonal linear system across all interior positions -- solvable exactly and in O(width) with the Thomas algorithm, a specialized Gaussian elimination for tridiagonal systems, instead of a general O(width^3) elimination or a slow, approximate iterative relaxation.",
    code: `def expected_ticks_to_absorption(n: int, s: int, p: float) -> float:
    # shift positions [-n, n] to indices [0, width-1]; index i encodes position i-n
    width = 2 * n + 1
    start = s + n

    # tridiagonal system for interior points i=1..width-2:
    #   -(1-p)*E[i-1] + 1*E[i] - p*E[i+1] = 1
    # boundary rows (absorbing barriers) are trivial: E[0] = 0, E[width-1] = 0
    sub = [0.0] * width      # coefficient of E[i-1]
    diag = [1.0] * width     # coefficient of E[i]
    sup = [0.0] * width      # coefficient of E[i+1]
    rhs = [0.0] * width

    for i in range(1, width - 1):
        sub[i] = -(1 - p)
        sup[i] = -p
        rhs[i] = 1.0
    # diag[0] and diag[width-1] stay 1, rhs stays 0 (absorbing boundaries)

    # Thomas algorithm: forward sweep eliminates the sub-diagonal
    for i in range(1, width):
        factor = sub[i] / diag[i - 1]
        diag[i] -= factor * sup[i - 1]
        rhs[i] -= factor * rhs[i - 1]

    # back substitution
    e = [0.0] * width
    e[-1] = rhs[-1] / diag[-1]
    for i in range(width - 2, -1, -1):
        e[i] = (rhs[i] - sup[i] * e[i + 1]) / diag[i]

    return e[start]

print(round(expected_ticks_to_absorption(3, 0, 0.5), 2))   # 9.0`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-20260915-limit-order-book-matcher",
    title: "Design a Price-Time Priority Limit Order Book Matcher",
    difficulty: "hard",
    topics: ["design", "heap", "queue"],
    problem:
      "Design a class supporting add_order(order_id, side, price, qty) for a single instrument's limit order book. A BUY order matches against the lowest-priced resting SELL orders whose price is at most the buy's price (and vice versa for a SELL), executing at the RESTING order's price, in strict price-then-time priority. Any unfilled remainder rests in the book. Support get_best_bid() and get_best_ask(), each returning the best resting price on that side or None.",
    examples: [
      {
        input:
          "add_order(1,'SELL',101.0,50); add_order(2,'BUY',101.0,30); add_order(3,'BUY',100.0,100)",
        output: "get_best_ask() -> 101.0; get_best_bid() -> 100.0",
        explanation:
          "Order 2 crosses and fills 30 of order 1's 50, leaving 20 resting at 101.0 (still the best ask). Order 3's price of 100.0 doesn't cross the 101.0 ask, so it rests as the best bid instead of matching.",
      },
    ],
    constraints: ["up to 10^5 total add_order calls", "prices and quantities are positive"],
    approach:
      "Maintain two sides of the book, each as a price-level-to-deque map of [order_id, qty] pairs, plus one heap per side for O(log levels) best-price lookup: a max-heap (via negation) of price levels for bids, a min-heap for asks. On a new order, repeatedly peek the opposing side's best price level: while it's marketable against the incoming order's price and the incoming order still has quantity, match against the FRONT of that level's deque (time priority within a price level), execute at the resting order's price, and pop or shrink that resting order. Once no marketable cross remains, any leftover incoming quantity rests as a new order in its own price level's deque, pushing that price onto the appropriate heap only the first time a level is created. Lazily skipping heap entries for price levels that have emptied out (checked against the book, not deleted from the heap) avoids needing an O(log n) heap-delete for arbitrary interior fills.",
    code: `import heapq
from collections import deque, defaultdict

class OrderBook:
    def __init__(self):
        # price -> deque of [order_id, qty], time-ordered within a price level
        self.bids: dict[float, deque] = defaultdict(deque)
        self.asks: dict[float, deque] = defaultdict(deque)
        self.bid_heap: list[float] = []   # max-heap via negation
        self.ask_heap: list[float] = []   # min-heap

    def _best(self, heap, book, is_max_heap):
        # lazy deletion: skip heap entries whose price level has emptied out
        while heap:
            price = -heap[0] if is_max_heap else heap[0]
            if book[price]:
                return price
            heapq.heappop(heap)
        return None

    def get_best_bid(self):
        return self._best(self.bid_heap, self.bids, True)

    def get_best_ask(self):
        return self._best(self.ask_heap, self.asks, False)

    def add_order(self, order_id: int, side: str, price: float, qty: int) -> None:
        opp_book = self.asks if side == "BUY" else self.bids
        opp_heap = self.ask_heap if side == "BUY" else self.bid_heap
        crosses = (lambda p: p <= price) if side == "BUY" else (lambda p: p >= price)

        while qty > 0:
            best = self._best(opp_heap, opp_book, side == "SELL")
            if best is None or not crosses(best):
                break
            level = opp_book[best]
            resting_id, resting_qty = level[0]
            matched = min(qty, resting_qty)
            qty -= matched
            resting_qty -= matched
            if resting_qty == 0:
                level.popleft()
            else:
                level[0][1] = resting_qty

        if qty > 0:   # unfilled remainder rests in the book
            own_book = self.bids if side == "BUY" else self.asks
            own_heap = self.bid_heap if side == "BUY" else self.ask_heap
            if not own_book[price]:
                heapq.heappush(own_heap, -price if side == "BUY" else price)
            own_book[price].append([order_id, qty])

book = OrderBook()
book.add_order(1, "SELL", 101.0, 50)
book.add_order(2, "BUY", 101.0, 30)
book.add_order(3, "BUY", 100.0, 100)
print(book.get_best_ask(), book.get_best_bid())   # 101.0 100.0`,
    language: "python",
    complexity: { time: "O(log levels) amortized per order", space: "O(open orders)" },
  },
];
