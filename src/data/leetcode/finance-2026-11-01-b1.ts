import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-01
// Running median of a streaming bid-ask spread (two heaps),
// longest window of price changes with at most K direction
// reversals (sliding window), max profit with unlimited trades
// under a percentage (not flat) transaction fee (DP stock
// variant), expected time to ruin for an asymmetric inventory
// random walk (probability / linear system), and an order book
// supporting cancel and amend-quantity via lazy heap deletion
// (design).
// ============================================================

export const financeBatch20261101: LeetCodeProblem[] = [
  {
    id: "lc-20261101-running-median-streaming-spread",
    title: "Running Median of a Streaming Bid-Ask Spread",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "You receive a live stream of quotes, each given as (bid, ask) with ask >= bid. Each tick's spread is ask - bid. Implement a class SpreadTracker with add_quote(bid, ask), which processes one new quote, and median(), which returns the median of all spreads seen so far (the average of the two middle values when the count is even).",
    examples: [
      {
        input: "add_quote(99.98, 100.02); add_quote(99.95, 100.01); add_quote(100.00, 100.03); median()",
        output: "0.04",
        explanation:
          "The three spreads are 0.04, 0.06, and 0.03. Sorted, that's [0.03, 0.04, 0.06], whose middle value is 0.04.",
      },
    ],
    constraints: ["up to 10^5 calls to add_quote", "0 <= bid <= ask <= 10^6"],
    approach:
      "Maintain two heaps that always hold the lower and upper halves of all spreads seen so far: a max-heap (via negation) for the lower half and a min-heap for the upper half. Every new spread is pushed into the lower heap first, then its current maximum is immediately moved into the upper heap, keeping the invariant that every value in the lower heap is <= every value in the upper heap. Rebalancing afterward (moving the upper heap's minimum back into the lower heap whenever the upper heap grows strictly larger) keeps the two heaps within one element of each other at all times, so the median is always either the lower heap's top (odd count) or the average of both heaps' tops (even count) -- each add is O(log n), and each median lookup is O(1).",
    code: `import heapq

class SpreadTracker:
    def __init__(self) -> None:
        self._lower: list[float] = []  # max-heap (negated) for the lower half
        self._upper: list[float] = []  # min-heap for the upper half

    def add_quote(self, bid: float, ask: float) -> None:
        spread = ask - bid
        # route into the lower half first, then rebalance against the upper half
        heapq.heappush(self._lower, -spread)
        heapq.heappush(self._upper, -heapq.heappop(self._lower))
        if len(self._upper) > len(self._lower):
            heapq.heappush(self._lower, -heapq.heappop(self._upper))

    def median(self) -> float:
        if len(self._lower) > len(self._upper):
            return -self._lower[0]
        return (-self._lower[0] + self._upper[0]) / 2.0

tracker = SpreadTracker()
for bid, ask in [(99.98, 100.02), (99.95, 100.01), (100.00, 100.03)]:
    tracker.add_quote(bid, ask)
print(tracker.median())
# 0.04`,
    language: "python",
    complexity: { time: "O(log n) per add_quote, O(1) per median", space: "O(n)" },
    leetcodeNumber: 295,
  },
  {
    id: "lc-20261101-longest-window-at-most-k-reversals",
    title: "Longest Window of Price Changes With At Most K Direction Reversals",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given an array of daily price changes (each positive, negative, or zero) and an integer k, a 'reversal' occurs at index i (1 <= i < n) if changes[i] and changes[i-1] have strictly opposite signs (a zero never counts as a sign flip either way). Return the length of the longest contiguous subarray of changes containing at most k reversals.",
    examples: [
      {
        input: "changes = [1,2,-1,-3,4,5,-2], k = 1",
        output: "4",
        explanation:
          "The subarray [1,2,-1,-3] has exactly one reversal (between 2 and -1) and length 4. Any length-5 window straddles a second reversal and exceeds k = 1.",
      },
    ],
    constraints: ["1 <= changes.length <= 10^5", "-10^4 <= changes[i] <= 10^4", "0 <= k <= changes.length"],
    approach:
      "First collapse the problem to a cleaner one: build a boolean 'reversal flag' array of length n-1, one flag per boundary between consecutive changes, set to 1 exactly where a sign flip happens. A window of the original array spanning elements [l, r] contains exactly the flags at boundary indices l..r-1, so the longest valid element-window is exactly (the longest run of flags with sum <= k) plus one. That reduces directly to the standard 'longest subarray with at most k ones' two-pointer pattern: since each flag is 0 or 1, the running sum over the window is monotonically non-decreasing as the right pointer advances and monotonically non-increasing as the left pointer advances, which is exactly the property a shrink-from-the-left sliding window needs -- expand right, and whenever the flag-sum exceeds k, shrink from the left until it doesn't, tracking the best window length throughout.",
    code: `def longest_window_at_most_k_reversals(changes: list[int], k: int) -> int:
    n = len(changes)
    if n <= 1:
        return n

    def sign(x: int) -> int:
        return (x > 0) - (x < 0)

    # one flag per boundary between consecutive changes -- 1 where signs strictly flip
    flags = [
        1 if sign(changes[i]) and sign(changes[i - 1]) and sign(changes[i]) != sign(changes[i - 1]) else 0
        for i in range(1, n)
    ]

    left = 0
    reversals_in_window = 0
    best_flags_run = 0
    for right, flag in enumerate(flags):
        reversals_in_window += flag
        while reversals_in_window > k:
            reversals_in_window -= flags[left]
            left += 1
        best_flags_run = max(best_flags_run, right - left + 1)

    return best_flags_run + 1   # a run of M boundary flags spans M + 1 elements

print(longest_window_at_most_k_reversals([1, 2, -1, -3, 4, 5, -2], k=1))
# 4`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-20261101-max-profit-percentage-fee",
    title: "Max Profit With Unlimited Transactions Under a Percentage Transaction Fee",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given a daily price array and a fee_rate (e.g. 0.1 for a 10% fee), you may buy and sell as many times as you like, one share at a time, fully selling before buying again. Each buy costs price * (1 + fee_rate) and each sell pays out price * (1 - fee_rate) -- the fee is charged on both legs, proportional to notional, not a flat amount. Return the maximum achievable profit.",
    examples: [
      {
        input: "prices = [1,3,2,8,4,9], fee_rate = 0.1",
        output: "10.3",
        explanation:
          "Buying at 1 and 4, and selling at 3 and 8 (skipping 2 and 9's worse entries), after the 10% fee on every leg, nets 10.3 total -- less than the no-fee optimum of 13, since every round trip now pays away roughly 20% of its notional in fees.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^4", "0 <= fee_rate < 1"],
    approach:
      "Track two running states day by day: hold (best net cash position while currently holding a share) and cash (best net cash position while flat). Each day's hold is either yesterday's hold (do nothing) or yesterday's cash minus today's price times (1 + fee_rate) (buy today, paying the fee on the buy notional). Each day's cash is either yesterday's cash (do nothing) or yesterday's hold plus today's price times (1 - fee_rate) (sell today, paying the fee on the sell notional). Because the fee is now proportional to price rather than a flat constant, it folds directly into the same two multiplicative terms without changing the DP's structure at all -- the recurrence is otherwise identical to the classic flat-fee stock problem.",
    code: `def max_profit_pct_fee(prices: list[float], fee_rate: float) -> float:
    cash = 0.0
    hold = float("-inf")   # can't be holding a share before day 0

    for price in prices:
        hold = max(hold, cash - price * (1 + fee_rate))   # buy today, pay fee on notional
        cash = max(cash, hold + price * (1 - fee_rate))   # sell today, pay fee on notional

    return cash   # ending while still holding a share can never be optimal

print(round(max_profit_pct_fee([1, 3, 2, 8, 4, 9], fee_rate=0.1), 4))
# 10.3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 714,
  },
  {
    id: "lc-20261101-expected-time-to-ruin-asymmetric-walk",
    title: "Expected Number of Ticks Until an Asymmetric Inventory Walk Hits Either Bound",
    difficulty: "hard",
    topics: ["probability", "markov-chain", "linear-algebra"],
    problem:
      "A market maker's inventory moves by +1 with probability p and -1 with probability 1-p on every tick, starting at 0, with absorbing bounds at -N and +N (the position-limit breach in either direction). Given N, p, and a starting inventory, return the expected number of ticks until the walk first reaches either bound.",
    examples: [
      {
        input: "N = 3, p = 0.55, start = 0",
        output: "8.767",
        explanation:
          "A slight upward drift (p > 0.5) shortens the expected time to absorption relative to the driftless case -- at p = 0.5 the same N = 3 setup gives exactly N^2 = 9 ticks by the classic symmetric gambler's ruin formula, and 8.767 is a bit faster thanks to the drift nudging the walk toward a bound sooner on average.",
      },
    ],
    constraints: ["1 <= N <= 500", "0 < p < 1", "-N < start < N"],
    approach:
      "Let E[i] be the expected number of remaining ticks starting from inventory i. For every interior state i (strictly between -N and N), one tick elapses and then the walk is at i+1 with probability p or i-1 with probability 1-p, giving the recurrence E[i] = 1 + p * E[i+1] + (1-p) * E[i-1]; the boundary states have E[N] = E[-N] = 0 since the walk is already absorbed there. This is a linear system in the 2N-1 unknown interior E values -- build its coefficient matrix (tridiagonal, since each equation only involves E[i] and its two neighbors) and right-hand side directly from the recurrence and solve it exactly with a standard linear solver, rather than simulating, which would only approximate the expectation.",
    code: `import numpy as np

def expected_ruin_time(N: int, p: float, start: int) -> float:
    q = 1 - p
    states = list(range(-N + 1, N))         # interior states; -N and N are absorbing (E = 0)
    index = {s: i for i, s in enumerate(states)}
    n = len(states)

    A = np.zeros((n, n))
    b = np.ones(n)                           # each equation's "+1" for the tick just taken
    for i, s in enumerate(states):
        A[i, i] = 1.0
        up, down = s + 1, s - 1
        if up in index:                      # if up is a boundary, its E contributes 0 -- omit it
            A[i, index[up]] -= p
        if down in index:
            A[i, index[down]] -= q

    E = np.linalg.solve(A, b)
    return E[index[start]]

print(round(expected_ruin_time(N=3, p=0.55, start=0), 3))   # 8.767
print(round(expected_ruin_time(N=3, p=0.50, start=0), 3))   # 9.0 -- matches the N^2 symmetric formula`,
    language: "python",
    complexity: { time: "O(N^3) for the dense linear solve (tridiagonal-aware solvers do O(N))", space: "O(N^2)" },
  },
  {
    id: "lc-20261101-design-order-book-cancel-amend",
    title: "Design an Order Book Supporting Cancel and Amend-Quantity via Lazy Heap Deletion",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design a class OrderBook supporting add_order(order_id, side, price, qty), cancel_order(order_id), amend_quantity(order_id, new_qty), best_bid(), and best_ask(). best_bid/best_ask return the (price, qty) of the best resting order on that side, skipping any order that has since been cancelled or amended down to zero quantity, or None if the side is empty.",
    examples: [
      {
        input:
          "add_order('b1','buy',100.00,500); add_order('b2','buy',100.05,300); add_order('a1','sell',100.10,400); best_bid(); best_ask(); cancel_order('b2'); best_bid()",
        output: "(100.05, 300); (100.10, 400); (100.00, 500)",
        explanation:
          "b2 is initially the best bid at 100.05. After it's cancelled, the heap entry for b2 is skipped lazily and b1 at 100.00 becomes the reported best bid.",
      },
    ],
    constraints: ["up to 10^5 total calls across all methods", "price and qty are positive at add time"],
    approach:
      "Keep a dict mapping order_id to its current [side, price, qty], the single source of truth that cancel_order and amend_quantity mutate directly in O(1). Keep two heaps of (price-key, sequence, order_id) for resting orders -- bids as a max-heap via negated price, asks as a min-heap -- exactly as in a matching engine, but here an order's heap entry is never removed or updated when it's cancelled or amended; instead, best_bid/best_ask lazily pop and discard any heap-top entry whose order_id's live quantity has dropped to zero or below before returning the next genuine top. This defers all the cleanup cost to query time, amortized across however many stale entries accumulate, which is far cheaper than maintaining a heap that supports arbitrary-position deletion or updates.",
    code: `import heapq
import itertools

class OrderBook:
    def __init__(self) -> None:
        self._bids: list[tuple[float, int, str]] = []   # max-heap via negated price
        self._asks: list[tuple[float, int, str]] = []   # min-heap
        self._live: dict[str, list] = {}                 # order_id -> [side, price, qty]
        self._seq = itertools.count()

    def add_order(self, order_id: str, side: str, price: float, qty: float) -> None:
        seq = next(self._seq)
        self._live[order_id] = [side, price, qty]
        if side == "buy":
            heapq.heappush(self._bids, (-price, seq, order_id))
        else:
            heapq.heappush(self._asks, (price, seq, order_id))

    def cancel_order(self, order_id: str) -> None:
        if order_id in self._live:
            self._live[order_id][2] = 0   # lazy delete -- heap entry stays, qty zeroed

    def amend_quantity(self, order_id: str, new_qty: float) -> None:
        if order_id in self._live:
            self._live[order_id][2] = new_qty

    def _clean(self, heap: list) -> None:
        while heap and self._live[heap[0][2]][2] <= 0:
            heapq.heappop(heap)   # discard stale entries: cancelled, zeroed, or fully filled

    def best_bid(self):
        self._clean(self._bids)
        if not self._bids:
            return None
        neg_price, _, order_id = self._bids[0]
        return (-neg_price, self._live[order_id][2])

    def best_ask(self):
        self._clean(self._asks)
        if not self._asks:
            return None
        price, _, order_id = self._asks[0]
        return (price, self._live[order_id][2])

book = OrderBook()
book.add_order("b1", "buy", 100.00, 500)
book.add_order("b2", "buy", 100.05, 300)
book.add_order("a1", "sell", 100.10, 400)
print(book.best_bid(), book.best_ask())   # (100.05, 300) (100.1, 400)
book.cancel_order("b2")
print(book.best_bid())                    # (100.0, 500)`,
    language: "python",
    complexity: { time: "O(log n) amortized per operation", space: "O(n) resting orders" },
  },
];
