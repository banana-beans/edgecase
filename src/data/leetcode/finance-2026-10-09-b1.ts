import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-09
// Running median of a live trade-price stream (two heaps),
// shortest window of signed trade volumes reaching a target
// (monotonic-deque prefix sums, LC862 shape), max profit under
// a mandatory T+1 settlement cooldown (DP stock variant, House
// Robber / LC309 shape), probability a resting quote gets picked
// off before an auto-cancel barrier (gambler's ruin), and a
// lazily-deleted two-heap top-of-book tracker (design).
// ============================================================

export const financeBatch20261009: LeetCodeProblem[] = [
  {
    id: "lc-20261009-running-median-trade-stream",
    title: "Running Median Trade Price From a Live Stream (Two-Heap Median Finder)",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "You receive a live stream of trade prices, one at a time. After each new trade arrives, report the median of every trade price seen so far.",
    examples: [
      {
        input: "trades = [5, 2, 8, 1]",
        output: "[5.0, 3.5, 5.0, 3.5]",
        explanation:
          "After [5]: median 5.0. After [5,2]: median (2+5)/2=3.5. After [5,2,8]: sorted [2,5,8], median 5.0. After [5,2,8,1]: sorted [1,2,5,8], median (2+5)/2=3.5.",
      },
    ],
    constraints: ["1 <= number of trades <= 10^6", "prices are positive floats"],
    approach:
      "Split the stream into two heaps instead of re-sorting on every trade: a max-heap (via negated values) holding the LOWER half of prices seen so far, and a min-heap holding the UPPER half. Each new price is pushed onto whichever heap it belongs with -- the low heap if it's no larger than the low heap's current max, the high heap otherwise -- and then the two heap sizes are rebalanced so they never differ by more than one element, by popping the top of the larger heap onto the smaller one. The median is then read directly off the tops of both heaps in O(1): either the low heap's max alone (odd count) or the average of both tops (even count), with each insertion costing O(log n) instead of the O(n log n) a full re-sort on every trade would cost.",
    code: `import heapq

class RunningMedian:
    def __init__(self):
        self.lo: list[float] = []   # max-heap (negated), holds the LOWER half
        self.hi: list[float] = []   # min-heap, holds the UPPER half

    def add(self, price: float) -> float:
        # route the new price to the half it belongs with, then rebalance
        if self.lo and price > -self.lo[0]:
            heapq.heappush(self.hi, price)
        else:
            heapq.heappush(self.lo, -price)

        # keep the two heaps within one element of each other in size
        if len(self.lo) > len(self.hi) + 1:
            heapq.heappush(self.hi, -heapq.heappop(self.lo))
        elif len(self.hi) > len(self.lo):
            heapq.heappush(self.lo, -heapq.heappop(self.hi))

        if len(self.lo) > len(self.hi):
            return -self.lo[0]
        return (-self.lo[0] + self.hi[0]) / 2

rm = RunningMedian()
for trade in [5, 2, 8, 1]:
    print(rm.add(trade))
# 5.0, 3.5, 5.0, 3.5`,
    language: "python",
    complexity: { time: "O(log n) per trade", space: "O(n)" },
    leetcodeNumber: 295,
  },
  {
    id: "lc-20261009-min-window-volume-target",
    title: "Shortest Window of Signed Trade Volumes Reaching a Target Sum",
    difficulty: "hard",
    topics: ["sliding-window"],
    problem:
      "Given a sequence of signed trade volumes (positive = an executed trade, negative = a cancellation reversing previously counted volume), find the length of the shortest contiguous window whose sum is at least a target. Return -1 if no such window exists.",
    examples: [
      {
        input: "volumes = [2, -1, 2, 4, 3], target = 7",
        output: "2",
        explanation:
          "The window [4, 3] (indices 3-4) sums to exactly 7 in just 2 trades -- shorter than [2,-1,2,4] (4 trades, sum 7) or [2,4,3] (3 trades, sum 9).",
      },
    ],
    constraints: ["1 <= volumes.length <= 10^5", "-10^4 <= volumes[i] <= 10^4"],
    approach:
      "Because cancellations make some entries negative, a plain two-pointer window (which only works when every value is non-negative, so the running sum is monotonic as the window grows) is not valid here -- this needs the prefix-sum-plus-monotonic-deque technique for 'shortest subarray with sum at least K'. Build the prefix-sum array, then scan it left to right while maintaining a deque of indices whose prefix sums are kept strictly increasing: before appending the current index, pop any trailing index whose prefix sum is >= the current one, since that index can never start a shorter qualifying window than starting from here. Then, while the gap between the current prefix sum and the deque's front is at least the target, that front index closes out a valid window -- record its length and pop it, since a smaller prefix sum further back can only be useful for an even later right endpoint. Both ends of the deque only move forward, so the whole scan is O(n) despite the nested-looking while loops.",
    code: `from collections import deque

def shortest_window_to_target_volume(volumes: list[int], target: int) -> int:
    n = len(volumes)
    prefix = [0] * (n + 1)
    for i, v in enumerate(volumes):
        prefix[i + 1] = prefix[i] + v

    dq: deque[int] = deque()   # indices into prefix, kept with increasing prefix value
    best = n + 1

    for right in range(n + 1):
        # any earlier index whose prefix sum is >= today's can never give a
        # shorter window than starting fresh from today, so drop it for good
        while dq and prefix[dq[-1]] >= prefix[right]:
            dq.pop()
        # today's prefix is big enough to close out a pending window --
        # close the one with the SMALLEST prefix (front) first
        while dq and prefix[right] - prefix[dq[0]] >= target:
            best = min(best, right - dq.popleft())
        dq.append(right)

    return best if best <= n else -1

print(shortest_window_to_target_volume([2, -1, 2, 4, 3], 7))
# 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
    leetcodeNumber: 862,
  },
  {
    id: "lc-20261009-max-profit-settlement-cooldown",
    title: "Maximum Profit With a Mandatory One-Day Settlement Cooldown After Selling",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given a sequence of daily prices, you may buy and sell an unlimited number of times (never holding more than one share at once), but after selling you must wait one full day before buying again -- a T+1 settlement cooldown. Return the maximum achievable profit.",
    examples: [
      {
        input: "prices = [1, 2, 3, 0, 2]",
        output: "3",
        explanation:
          "Buy day0 @1, sell day1 @2 (profit 1), cooldown on day2, buy day3 @0, sell day4 @2 (profit 2). Total profit 1 + 2 = 3.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^4"],
    approach:
      "Track three mutually exclusive states per day instead of trying to enumerate transactions directly: hold (currently holding a share), sold (sold TODAY, so tomorrow is a forced cooldown), and rest (not holding and free to buy, either because you've been idle or your one-day cooldown just ended). Each day's hold is either yesterday's hold (keep waiting) or yesterday's rest minus today's price (buy today, only legal from rest, never from sold); each day's sold is yesterday's hold plus today's price (sell what you were holding); each day's rest is the better of yesterday's rest (stay idle) or yesterday's sold (the cooldown day has just finished, you're free again). The cooldown constraint falls out naturally because rest can only come from sold with a one-day delay, never allowing a buy on the very day after a sale. The answer is the better of ending in sold or rest, since ending while still holding is never optimal with unlimited future trades.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    hold = -prices[0]   # currently holding a share
    sold = 0            # sold TODAY -- tomorrow is a forced cooldown
    rest = 0            # idle and free to buy, no cooldown pending

    for price in prices[1:]:
        prev_hold, prev_sold, prev_rest = hold, sold, rest
        hold = max(prev_hold, prev_rest - price)   # keep holding, or buy from rest
        sold = prev_hold + price                   # sell today's holding
        rest = max(prev_rest, prev_sold)            # stay idle, or cooldown just ended

    return max(sold, rest)

print(max_profit_with_cooldown([1, 2, 3, 0, 2]))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 309,
  },
  {
    id: "lc-20261009-quote-pick-off-probability",
    title: "Probability a Resting Quote Gets Picked Off Before an Auto-Cancel Barrier (Gambler's Ruin)",
    difficulty: "hard",
    topics: ["probability"],
    problem:
      "Your resting limit quote sits d ticks away from the current mid-price. Each discrete tick, the mid-price moves one tick CLOSER to your quote with probability p, or one tick FARTHER with probability 1-p. If the mid-price ever drifts n ticks farther away before reaching your quote, a risk system auto-cancels it (safe). Return the probability your quote gets picked off (the mid-price reaches it) before that cancellation.",
    examples: [
      {
        input: "d=3, n=10, p=0.5",
        output: "0.7",
        explanation:
          "A fair (symmetric) random walk between two absorbing barriers has a ruin probability linear in distance: starting 3 ticks from the pick-off barrier out of 10 total, the probability of reaching it first is (10-3)/10 = 0.7.",
      },
    ],
    constraints: ["1 <= d < n <= 10^4", "0 < p < 1"],
    approach:
      "Recognize this as gambler's ruin: a random walk on the integers 0..n with absorbing barriers at 0 (picked off) and n (safely cancelled), starting at d. The walk moves toward 0 with probability p and toward n with probability q=1-p each step. For a FAIR walk (p=0.5) the classic result is that the probability of ruin (hitting 0 first) starting from d is exactly (n-d)/n -- linear in distance, with no dependence on the step probabilities since there's no drift. For a BIASED walk, define rho = p/q as the ratio of the toward-ruin probability over the away-from-ruin probability; the probability of being absorbed at 0 starting from d is (rho^d - rho^n) / (1 - rho^n). Both branches satisfy the same boundary conditions (probability 1 exactly at d=0, probability 0 exactly at d=n), and the biased formula correctly degenerates toward the linear one as p approaches 0.5 even though it can't be evaluated there directly (0/0), which is exactly why the fair case needs its own branch in code.",
    code: `def pick_off_probability(d: int, n: int, p: float) -> float:
    # d: ticks between the quote and being picked off right now
    # n: ticks between the quote and the auto-cancel safety barrier
    # p: probability the mid-price moves ONE tick TOWARD the quote each tick
    q = 1 - p
    if p == q:
        return (n - d) / n   # symmetric random walk: ruin probability is linear

    rho = p / q   # ratio of toward-ruin probability over away-from-ruin probability
    return (rho ** d - rho ** n) / (1 - rho ** n)

print(round(pick_off_probability(d=3, n=10, p=0.5), 4))
# 0.7 -- symmetric walk, linear in distance: (10-3)/10

print(round(pick_off_probability(d=3, n=10, p=0.6), 4))
# roughly 0.9581 -- p > 0.5 means the mid-price drifts toward the quote on
# average, so pick-off risk is far higher than the symmetric baseline`,
    language: "python",
    complexity: { time: "O(log d) for the power terms", space: "O(1)" },
  },
  {
    id: "lc-20261009-design-top-of-book",
    title: "Design a Top-of-Book Tracker (Best Bid/Ask) With Lazy-Deleted Heaps",
    difficulty: "medium",
    topics: ["design", "heap"],
    problem:
      "Design a class TopOfBook supporting add_order(side, price, order_id), cancel_order(order_id), best_bid(), and best_ask(), each running in amortized O(log n) time.",
    examples: [
      {
        input:
          "t=TopOfBook(); t.add_order('bid',99.50,1); t.add_order('bid',99.75,2); t.add_order('ask',100.25,3); t.best_bid(); t.cancel_order(2); t.best_bid()",
        output: "99.75, then 99.50",
        explanation:
          "With orders 1 and 2 both resting bids, the best bid is the higher price, 99.75 (order 2). Cancelling order 2 leaves order 1's 99.50 as the new best bid.",
      },
    ],
    constraints: ["up to 10^6 total calls across all methods", "order_id values are unique"],
    approach:
      "Keep one max-heap for bids (via negated prices) and one min-heap for asks, exactly like a standard top-of-book, but never try to remove a cancelled order from the MIDDLE of a heap -- that costs O(n) and defeats the point of using a heap at all. Instead, cancel_order does nothing to the heaps themselves; it only records the order_id in a cancelled set, an O(1) operation. The real deletion happens lazily, only when a query actually needs to look at the top: best_bid/best_ask first pop and discard any entries whose order_id is in the cancelled set, repeating until the heap's true top is a live order. Because each order can only ever be lazily popped once in its lifetime, the total cost of all those lazy pops across the whole run is bounded by the total number of orders ever added, which is where the AMORTIZED O(log n) comes from despite individual calls occasionally doing extra cleanup work.",
    code: `import heapq

class TopOfBook:
    def __init__(self):
        self.bids: list[tuple[float, int]] = []   # max-heap via negated price
        self.asks: list[tuple[float, int]] = []   # min-heap
        self.cancelled: set[int] = set()

    def add_order(self, side: str, price: float, order_id: int) -> None:
        if side == "bid":
            heapq.heappush(self.bids, (-price, order_id))
        else:
            heapq.heappush(self.asks, (price, order_id))

    def cancel_order(self, order_id: int) -> None:
        # lazy deletion: just mark it cancelled -- removing from the middle
        # of a heap is O(n), so defer the cost until it's actually at the top
        self.cancelled.add(order_id)

    def _peek_best(self, heap: list[tuple[float, int]]) -> float | None:
        while heap and heap[0][1] in self.cancelled:
            heapq.heappop(heap)   # pay the deletion cost only when it's on top
        return heap[0][0] if heap else None

    def best_bid(self) -> float | None:
        price = self._peek_best(self.bids)
        return -price if price is not None else None

    def best_ask(self) -> float | None:
        return self._peek_best(self.asks)

book = TopOfBook()
book.add_order("bid", 99.50, 1)
book.add_order("bid", 99.75, 2)
book.add_order("ask", 100.25, 3)
print(book.best_bid(), book.best_ask())   # 99.75 100.25
book.cancel_order(2)
print(book.best_bid())   # 99.50 -- order 2 lazily popped on this query`,
    language: "python",
    complexity: { time: "O(log n) amortized per call", space: "O(n)" },
  },
];
