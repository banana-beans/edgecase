import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-13
// Running median trade price over a sliding tick window (two
// heaps + lazy deletion, LC480 shape), shortest tick window to
// accumulate a target traded volume (sliding window, LC209
// shape), max profit with a mandatory one-day cooldown after
// selling (DP stock variant, LC309 shape), probability of
// hitting a profit target before a stop-loss under a biased
// random walk (Gambler's Ruin), and a top-of-book tracker
// supporting O(log n) add/cancel via lazy deletion (design).
// ============================================================

export const financeBatch20261013: LeetCodeProblem[] = [
  {
    id: "lc-20261013-running-median-sliding-window",
    title: "Running Median Trade Price Over the Last K Ticks (Sliding Window Median)",
    difficulty: "hard",
    topics: ["heap"],
    problem:
      "Given a stream of trade prices and a window size k, return the median trade price over the last k ticks after each new tick arrives (once at least k ticks have arrived). This feeds a robust, outlier-resistant rolling fair-value estimate that a single fat-finger print can't drag around the way a rolling mean would.",
    examples: [
      {
        input: "prices = [5, 2, 8, 4, 9, 1], k = 3",
        output: "[5.0, 4.0, 8.0, 4.0]",
        explanation:
          "Window [5,2,8] has median 5.0, [2,8,4] has median 4.0, [8,4,9] has median 8.0, [4,9,1] has median 4.0 -- one output per tick once the window first fills.",
      },
    ],
    constraints: ["1 <= k <= prices.length <= 10^5", "prices[i] can repeat"],
    approach:
      "Maintain two heaps: a max-heap lo for the smaller half of the current window and a min-heap hi for the larger half, kept balanced in size (differing by at most one), so the median is always lo's top (odd k) or the average of both tops (even k). The twist versus a plain running median is that this window SLIDES rather than only grows: a value falling out the left edge must be removed from whichever heap holds it, but heaps don't support efficient arbitrary deletion. The fix is lazy deletion -- track a per-value count of pending removals in a hashmap, and whenever a heap's top happens to be a value with a pending removal, pop it and decrement the pending count before trusting what's now on top. Rebalance the two heaps' sizes after every push and every lazy-pop so the size invariant keeps holding.",
    code: `import heapq
from collections import defaultdict

def sliding_window_median(prices: list[int], k: int) -> list[float]:
    lo: list[int] = []   # max-heap (negated) -- smaller half
    hi: list[int] = []   # min-heap -- larger half
    pending: dict[int, int] = defaultdict(int)   # value -> count awaiting lazy removal
    lo_size = hi_size = 0
    result: list[float] = []

    def prune(heap: list[int], is_lo: bool) -> None:
        while heap:
            top = -heap[0] if is_lo else heap[0]
            if pending[top] > 0:
                pending[top] -= 1
                heapq.heappop(heap)
            else:
                break

    for i, price in enumerate(prices):
        if not lo or price <= -lo[0]:
            heapq.heappush(lo, -price)
            lo_size += 1
        else:
            heapq.heappush(hi, price)
            hi_size += 1

        if i >= k:
            old = prices[i - k]
            pending[old] += 1
            if old <= -lo[0]:
                lo_size -= 1
            else:
                hi_size -= 1

        # rebalance sizes, then drop any stale top left exposed by the rebalance
        if lo_size > hi_size + 1:
            prune(lo, True)
            heapq.heappush(hi, -heapq.heappop(lo))
            lo_size -= 1
            hi_size += 1
        elif hi_size > lo_size:
            prune(hi, False)
            heapq.heappush(lo, -heapq.heappop(hi))
            hi_size -= 1
            lo_size += 1

        prune(lo, True)
        prune(hi, False)

        if i >= k - 1:
            if lo_size > hi_size:
                result.append(float(-lo[0]))
            else:
                result.append((-lo[0] + hi[0]) / 2.0)

    return result

print(sliding_window_median([5, 2, 8, 4, 9, 1], 3))
# [5.0, 4.0, 8.0, 4.0]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
    leetcodeNumber: 480,
  },
  {
    id: "lc-20261013-shortest-window-target-volume",
    title: "Shortest Tick Window to Accumulate At Least a Target Volume",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a sequence of per-tick traded volumes and a target volume V, return the length of the shortest contiguous window of ticks whose volumes sum to at least V, or 0 if no such window exists. This estimates how many ticks a TWAP execution slice needs to watch before enough real market volume has printed to safely trade against it.",
    examples: [
      {
        input: "volumes = [2, 1, 5, 3, 2], V = 7",
        output: "2",
        explanation:
          "The window [5, 3] sums to 8 >= 7 with length 2, and no window of length 1 reaches 7, so 2 is the shortest qualifying window.",
      },
    ],
    constraints: ["1 <= volumes.length <= 10^5", "1 <= volumes[i] <= 10^4", "1 <= V <= 10^9"],
    approach:
      "Classic variable-size two-pointer window: expand the right pointer, adding each tick's volume to a running sum. The moment the running sum reaches at least V, the window from the current left pointer to here is a candidate, so record its length and then shrink from the left -- subtracting as you go -- for as long as the sum stays at or above V, since a shorter window ending at this same right pointer is strictly better. Both pointers only ever move forward across the whole scan, so the total work is O(n) despite the shrink loop looking nested inside the expand loop.",
    code: `def shortest_window_for_volume(volumes: list[int], target: int) -> int:
    left = 0
    running_sum = 0
    best = len(volumes) + 1   # sentinel larger than any real window

    for right, vol in enumerate(volumes):
        running_sum += vol

        # shrink from the left while the window still clears the target
        while running_sum >= target:
            best = min(best, right - left + 1)
            running_sum -= volumes[left]
            left += 1

    return best if best <= len(volumes) else 0

print(shortest_window_for_volume([2, 1, 5, 3, 2], 7))
# 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 209,
  },
  {
    id: "lc-20261013-max-profit-cooldown",
    title: "Maximum Profit With a Mandatory One-Day Cooldown After Selling",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices, you may buy and sell as many times as you like, never holding more than one share at once, but after selling you must wait one full day before buying again (a cooldown, as if a wash-sale-style rule applied). Return the maximum achievable profit.",
    examples: [
      {
        input: "prices = [1, 2, 3, 0, 2]",
        output: "3",
        explanation:
          "Buy at 1, sell at 2 (profit 1), skip a day for cooldown, buy at 0, sell at 2 (profit 2). Total profit 1 + 2 = 3, which beats any schedule that tries to trade through the cooldown.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000"],
    approach:
      "Track three running states instead of a full day-indexed table: hold, the best profit while currently holding a share; sold, the best profit on a day you just sold (which forces cooldown tomorrow); and rest, the best profit while flat and free to buy. Each day's updates read ONLY yesterday's three values: hold becomes max(yesterday's hold, yesterday's rest minus today's price), sold becomes yesterday's hold plus today's price, and rest becomes max(yesterday's rest, yesterday's sold) -- that last transition is exactly what encodes the one-day cooldown, since rest can only inherit from sold one step late, never from the same day's sold. Three scalars updated once per day replace what looks like it needs an O(n)-sized table, so the whole pass runs in O(1) extra space.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    hold = -prices[0]   # best profit while holding a share
    sold = 0             # best profit on the day you just sold
    rest = 0             # best profit while flat and free to buy

    for price in prices[1:]:
        prev_hold, prev_sold, prev_rest = hold, sold, rest
        hold = max(prev_hold, prev_rest - price)
        sold = prev_hold + price
        rest = max(prev_rest, prev_sold)   # cooldown: rest can't inherit TODAY's sold

    return max(sold, rest)

print(max_profit_with_cooldown([1, 2, 3, 0, 2]))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 309,
  },
  {
    id: "lc-20261013-gamblers-ruin-profit-target",
    title: "Probability of Hitting a Profit Target Before a Stop-Loss (Gambler's Ruin)",
    difficulty: "hard",
    topics: ["probability"],
    problem:
      "A strategy's P&L moves in discrete one-tick steps: up one tick with probability p, down one tick with probability q = 1 - p, each step independent of the last. Starting at P&L 0, return the probability the strategy hits +a (its profit target) strictly before it hits -b (its stop-loss).",
    examples: [
      {
        input: "p = 0.5, a = 3, b = 2",
        output: "0.4",
        explanation:
          "For a fair (p=0.5) random walk, the hit probability is simply b / (a + b) = 2 / 5 = 0.4 -- the walk is a martingale, so its expected stopping value must be zero, which pins down this exact ratio.",
      },
    ],
    constraints: ["0 < p < 1", "a and b are positive integers"],
    approach:
      "This is the classical Gambler's Ruin problem, and the fast path to the answer is a martingale argument rather than brute-force recursion. When p = 0.5, P&L itself is a martingale (its expectation never drifts), so E[final P&L] = 0 forces a * P(hit +a first) - b * (1 - P(hit +a first)) = 0, which solves to P = b / (a + b). When p != 0.5, plain P&L isn't a martingale, but (q/p) raised to the P&L IS one, by construction -- that's the quantity whose expectation is invariant -- and setting its expectation at the boundary equal to its start gives the general closed form P = (1 - r^b) / (1 - r^(a+b)) where r = q/p. Coding this directly from the recursive first-step equation (condition on the first tick, solve the resulting linear recursion with boundary conditions P(a)=1, P(-b)=0) arrives at the same formula -- the martingale trick is just the fast way to see WHY it has that shape, which is what an interviewer is actually listening for.",
    code: `def profit_before_stoploss(p: float, a: int, b: int) -> float:
    if p == 0.5:
        # fair walk: P&L itself is a martingale, so the hit probability
        # is pinned down by E[final P&L] = 0 at the two boundaries
        return b / (a + b)

    q = 1 - p
    r = q / p   # (q/p)^P&L is the martingale when p != 0.5
    return (1 - r**b) / (1 - r**(a + b))

print(round(profit_before_stoploss(0.5, 3, 2), 4))
# 0.4 -- a fair walk with a tighter stop (b=2) than target (a=3) still favors the stop more than half the time

print(round(profit_before_stoploss(0.55, 3, 2), 4))
# higher than 0.4 -- even a small positive edge per tick meaningfully shifts the odds toward the target`,
    language: "python",
    complexity: { time: "O(1)", space: "O(1)" },
  },
  {
    id: "lc-20261013-design-top-of-book-lazy-deletion",
    title: "Design a Top-of-Book Tracker Supporting O(log n) Add and Cancel",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design a class TopOfBook supporting add_bid(order_id, price), add_ask(order_id, price), cancel(order_id) (the id may belong to a resting bid or ask), best_bid(), and best_ask(). best_bid()/best_ask() return the price of the highest live bid / lowest live ask among orders not yet cancelled, or None if there are none.",
    examples: [
      {
        input:
          "book=TopOfBook(); book.add_bid(1,100.0); book.add_bid(2,100.5); book.add_ask(3,101.0); book.cancel(2); book.best_bid()",
        output: "100.0",
        explanation:
          "Order 2 was the best bid at 100.5, but it gets cancelled before best_bid() is called, so the best LIVE bid is order 1 at 100.0 -- the cancelled order must never surface as the top even though it's still technically sitting in whatever internal structure holds it.",
      },
    ],
    constraints: ["up to 10^6 total calls across all methods", "a given order_id is added at most once and cancelled at most once"],
    approach:
      "Use a max-heap for bids and a min-heap for asks (bids via negated prices, same trick as before), plus a hashmap from order_id to its price and a plain set of cancelled order_ids. Cancelling is O(1): just record the id as cancelled, without touching either heap -- there is no cheap way to remove an arbitrary element from a heap, so don't try. The cost is deferred to best_bid()/best_ask(): each lazily pops and discards entries off its heap's top for as long as that top's order_id is in the cancelled set, stopping the moment a live order surfaces (or the heap empties, meaning no live orders remain on that side). Every entry is pushed at most once and popped at most once over its lifetime, so total work amortizes to O(log n) per operation across the whole sequence of calls, even though a single best_bid() call occasionally does more than O(log n) work by itself.",
    code: `import heapq

class TopOfBook:
    def __init__(self):
        self.bids: list[tuple[float, int]] = []   # max-heap: (-price, order_id)
        self.asks: list[tuple[float, int]] = []   # min-heap: (price, order_id)
        self.cancelled: set[int] = set()

    def add_bid(self, order_id: int, price: float) -> None:
        heapq.heappush(self.bids, (-price, order_id))

    def add_ask(self, order_id: int, price: float) -> None:
        heapq.heappush(self.asks, (price, order_id))

    def cancel(self, order_id: int) -> None:
        self.cancelled.add(order_id)   # O(1) -- no heap touched yet

    def best_bid(self):
        while self.bids and self.bids[0][1] in self.cancelled:
            heapq.heappop(self.bids)   # lazily discard a stale, cancelled top
        return -self.bids[0][0] if self.bids else None

    def best_ask(self):
        while self.asks and self.asks[0][1] in self.cancelled:
            heapq.heappop(self.asks)
        return self.asks[0][0] if self.asks else None

book = TopOfBook()
book.add_bid(1, 100.0)
book.add_bid(2, 100.5)
book.add_ask(3, 101.0)
book.cancel(2)
print(book.best_bid())   # 100.0 -- order 2 was better but is cancelled
print(book.best_ask())   # 101.0`,
    language: "python",
    complexity: { time: "O(log n) amortized per operation", space: "O(n)" },
  },
];
