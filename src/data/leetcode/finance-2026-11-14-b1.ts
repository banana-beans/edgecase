import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-14
// Kth largest trade size streamed (heap), max high-low range
// over a fixed-length sliding window of ticks (monotonic deque),
// max profit with a one-day cooldown after selling (DP), expected
// number of ticks until a market maker's inventory random walk
// hits either absorbing barrier (gambler's ruin duration), and a
// limit order book with lazy-deleted cancels (design).
// ============================================================

export const financeBatch20261114: LeetCodeProblem[] = [
  {
    id: "lc-20261114-kth-largest-trade-size-stream",
    title: "Kth Largest Trade Size Seen So Far (Streaming)",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Design a class that ingests trade sizes one at a time as they print, and after each ingestion reports the k-th largest trade size among all trades seen so far, or None if fewer than k trades have printed yet.",
    examples: [
      {
        input: "k=3; add(5); add(8); add(2); add(10); add(4)",
        output: "None, None, 2, 5, 5",
        explanation:
          "Fewer than 3 trades after the first two adds, so None. After [5,8,2] sorted descending is [8,5,2], 3rd largest is 2. After [5,8,2,10] sorted descending is [10,8,5,2], 3rd largest is 5. After [5,8,2,10,4] sorted descending is [10,8,5,4,2], 3rd largest is still 5.",
      },
    ],
    constraints: ["up to 10^5 add calls", "1 <= k <= 10^4", "each size is a positive integer"],
    approach:
      "Maintain a min-heap capped at exactly k elements holding the k largest values seen so far. Push every new value, then if the heap grows past k, pop its smallest entry -- what's left is always the k largest values seen, and the smallest of THOSE k (the top of the min-heap) is, by definition, the k-th largest overall. Until the heap actually reaches size k there haven't been enough trades to define a k-th largest, so the answer is None. This reuses the same 'wrong-direction heap for the thing you want to query cheaply' idea as a running median, just with one heap capped at a fixed size instead of two balanced halves.",
    code: `import heapq


class KthLargestTradeSize:
    def __init__(self, k: int) -> None:
        self.k = k
        self.heap: list[int] = []  # min-heap holding the k largest values seen

    def add(self, size: int) -> int | None:
        heapq.heappush(self.heap, size)
        # keep the heap capped at exactly k elements -- the smallest of
        # those k IS the k-th largest overall, by definition
        if len(self.heap) > self.k:
            heapq.heappop(self.heap)

        if len(self.heap) < self.k:
            return None
        return self.heap[0]


tracker = KthLargestTradeSize(k=3)
for size in [5, 8, 2, 10, 4]:
    print(tracker.add(size))
# None, None, 2, 5, 5`,
    language: "python",
    complexity: { time: "O(log k) per add", space: "O(k)" },
  },
  {
    id: "lc-20261114-max-range-sliding-window",
    title: "Maximum High-Low Range Over Any Fixed-Length Window of Ticks",
    difficulty: "medium",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given an array of tick prices and a window length w, return the maximum (max - min) range achieved by any contiguous window of exactly w consecutive ticks. This models scanning a session for its most volatile w-tick stretch.",
    examples: [
      {
        input: "prices = [4,2,9,1,7,3], w = 3",
        output: "8",
        explanation:
          "Windows of length 3: [4,2,9] range 7, [2,9,1] range 8, [9,1,7] range 8, [1,7,3] range 6. The maximum range across all of them is 8.",
      },
    ],
    constraints: ["1 <= w <= prices.length <= 10^5"],
    approach:
      "Track the window's max and min with two monotonic deques of indices rather than recomputing max/min from scratch on every window, which would cost O(n*w). The max-deque stays decreasing front-to-back: before appending the current index, pop from the back any index whose price is less than or equal to the current price, since those can never again be the window's max while the current, larger price is still in range. The min-deque is the mirror image, kept increasing. Both deques also pop from the FRONT whenever their oldest index has fallen outside the current window. Because every index enters and leaves each deque at most once, the whole pass is O(n) despite the nested-looking while loops.",
    code: `from collections import deque


def max_range_sliding_window(prices: list[int], w: int) -> int:
    max_deque: deque[int] = deque()  # indices, prices decreasing front-to-back
    min_deque: deque[int] = deque()  # indices, prices increasing front-to-back
    best = 0

    for right, price in enumerate(prices):
        # maintain monotonic decreasing deque for the window's max
        while max_deque and prices[max_deque[-1]] <= price:
            max_deque.pop()
        max_deque.append(right)

        # maintain monotonic increasing deque for the window's min
        while min_deque and prices[min_deque[-1]] >= price:
            min_deque.pop()
        min_deque.append(right)

        # drop indices that have fallen out of the current window
        if max_deque[0] <= right - w:
            max_deque.popleft()
        if min_deque[0] <= right - w:
            min_deque.popleft()

        if right >= w - 1:
            best = max(best, prices[max_deque[0]] - prices[min_deque[0]])

    return best


print(max_range_sliding_window([4, 2, 9, 1, 7, 3], w=3))
# 8`,
    language: "python",
    complexity: { time: "O(n) amortized", space: "O(w)" },
  },
  {
    id: "lc-20261114-max-profit-cooldown",
    title: "Max Profit With a One-Day Cooldown After Selling",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for one instrument, you may buy and sell any number of times (never holding more than one unit at a time), but after selling you must wait one full day before buying again, modeling a settlement cooldown. Return the maximum total profit.",
    examples: [
      {
        input: "prices = [1,2,3,0,2]",
        output: "3",
        explanation:
          "Buy at 1 (day 0), sell at 2 (day 1) for profit 1, day 2 is the forced cooldown, buy at 0 (day 3), sell at 2 (day 4) for profit 2. Total profit 1 + 2 = 3, and no other combination that respects the cooldown beats it.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000", "0 <= prices[i] <= 1000"],
    approach:
      "This is a three-state machine run day by day: hold (max profit while currently holding a share), sold (max profit on a day we JUST sold, which forces tomorrow into cooldown), and rest (max profit while flat and free to buy, i.e. not the day immediately after a sell). Each day's hold can either keep holding or buy today funded out of rest (never out of sold, since sold is still serving its mandatory cooldown), each day's sold is simply hold plus today's price, and each day's rest can either keep resting or graduate out of YESTERDAY's sold now that the cooldown has elapsed. Keeping only the previous day's three values turns what looks like it needs a 2D table into O(1) space.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    # hold: max profit while currently holding a share
    # sold: max profit on a day we just sold (tomorrow must be cooldown)
    # rest: max profit while flat and free to buy (not the day right after a sell)
    hold, sold, rest = float("-inf"), 0, 0

    for price in prices:
        prev_sold = sold
        sold = hold + price             # sell today: cash in whatever we were holding
        hold = max(hold, rest - price)  # keep holding, or buy today funded from "rest"
        rest = max(rest, prev_sold)     # stay resting, or roll out of yesterday's cooldown

    return max(sold, rest)


print(max_profit_with_cooldown([1, 2, 3, 0, 2]))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261114-expected-ticks-to-absorption",
    title: "Expected Number of Ticks Until an Inventory Random Walk Hits Either Limit",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "A market maker's inventory starts at s shares, with 0 < s < N, and each tick moves to s + 1 with probability p or s - 1 with probability 1 - p, until it is absorbed at either 0 or N. Given p, N, and s, return the EXPECTED NUMBER OF TICKS until absorption (not which barrier it hits).",
    examples: [
      {
        input: "p = 0.5, N = 4, s = 2",
        output: "4.0",
        explanation:
          "For an unbiased (p = 0.5) walk, the expected duration has the closed form s * (N - s): 2 * (4 - 2) = 4.0.",
      },
      {
        input: "p = 0.6, N = 3, s = 1",
        output: "2.105",
        explanation:
          "With a favorable upward drift (p = 0.6), the biased closed-form expression gives roughly 2.105 ticks on average before the walk hits either 0 or 3.",
      },
    ],
    constraints: ["0 < s < N", "1 <= N <= 10^6", "0 < p < 1"],
    approach:
      "A first-step argument gives the recurrence D(s) = 1 + p*D(s+1) + (1-p)*D(s-1) for the expected remaining ticks starting at s, with boundary conditions D(0) = D(N) = 0. For the unbiased case (p = 0.5) this collapses to the clean closed form D(s) = s*(N-s). For the biased case, with q = 1-p and r = q/p, the closed form is D(s) = s/(q-p) - (N/(q-p)) * (1 - r^s)/(1 - r^N). The numerically dangerous part is evaluating r^N directly when r is far from 1 and N is large, which overflows exactly like the sister problem of computing the ABSORPTION PROBABILITY -- rewriting the ratio using r^(s-N) and r^(-N) (both bounded whenever r > 1) avoids ever computing r^N on its own.",
    code: `def expected_ticks_to_absorption(p: float, n: int, s: int) -> float:
    # unbiased walk: expected duration collapses to the simple product
    if abs(p - 0.5) < 1e-12:
        return float(s * (n - s))

    q = 1 - p
    r = q / p  # classical gambler's ruin ratio

    if r <= 1:
        # p >= 0.5: r**s and r**n are both <= 1, safe to evaluate directly
        ratio = (1 - r ** s) / (1 - r ** n)
    else:
        # p < 0.5: r > 1, so r**n would overflow for large n. Rewrite with
        # negative exponents (r**-n and r**(s-n) are both <= 1) instead.
        ratio = (r ** -n - r ** (s - n)) / (r ** -n - 1)

    return s / (q - p) - (n / (q - p)) * ratio


print(round(expected_ticks_to_absorption(0.5, 4, 2), 3))
# 4.0
print(round(expected_ticks_to_absorption(0.6, 3, 1), 3))
# 2.105`,
    language: "python",
    complexity: { time: "O(1) with the closed form (O(N) for a direct DP sweep)", space: "O(1)" },
  },
  {
    id: "lc-20261114-design-order-book-bbo",
    title: "Design: Limit Order Book With Best Bid/Offer and Lazy-Deleted Cancels",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design an OrderBook supporting add_order(order_id, side, price) where side is 'buy' or 'sell', cancel_order(order_id), best_bid() returning the highest active buy price (or None), and best_ask() returning the lowest active sell price (or None). Cancellations are frequent relative to adds, so cancel must not require scanning the book.",
    examples: [
      {
        input:
          "add_order(1,'buy',100); add_order(2,'buy',101); add_order(3,'sell',105); best_bid(); best_ask(); cancel_order(2); best_bid()",
        output: "101, 105, 100",
        explanation:
          "After the three adds, best_bid is 101 (the higher of the two buys) and best_ask is 105. Cancelling order 2 (the 101 buy) drops the best bid back down to 100, the only remaining active buy.",
      },
    ],
    constraints: ["up to 10^5 total operations", "order_id values are unique across the book's lifetime"],
    approach:
      "Use a max-heap (prices negated) for active buys and a min-heap for active sells, each storing (price, order_id). Cancel does O(1) work: it just records the id as cancelled in a set, without touching either heap -- this is lazy deletion. best_bid and best_ask do the real cleanup: pop entries off the top of the relevant heap while that top order_id is marked cancelled, discarding them, until either the heap is empty or a still-live order surfaces. This looks like it could be slow, but every order is physically popped at most once over the book's entire lifetime, so the total cost across all cancels and all best-price queries stays amortized O(log n) per operation, even though cancel itself never touches a heap directly.",
    code: `import heapq


class OrderBook:
    def __init__(self) -> None:
        self.buy_heap: list[tuple[float, int]] = []   # max-heap (negated price)
        self.sell_heap: list[tuple[float, int]] = []  # min-heap
        self.cancelled: set[int] = set()

    def add_order(self, order_id: int, side: str, price: float) -> None:
        if side == "buy":
            heapq.heappush(self.buy_heap, (-price, order_id))
        else:
            heapq.heappush(self.sell_heap, (price, order_id))

    def cancel_order(self, order_id: int) -> None:
        # lazy deletion: mark cancelled now, physically remove it only
        # when it eventually surfaces at the top of its heap
        self.cancelled.add(order_id)

    def best_bid(self) -> float | None:
        return self._best(self.buy_heap, negate=True)

    def best_ask(self) -> float | None:
        return self._best(self.sell_heap, negate=False)

    def _best(self, heap: list[tuple[float, int]], negate: bool) -> float | None:
        # discard cancelled entries sitting at the top -- each one is
        # popped at most once over the book's whole lifetime, so this
        # stays amortized O(log n) even though it looks like a loop
        while heap and heap[0][1] in self.cancelled:
            heapq.heappop(heap)
        if not heap:
            return None
        price, _ = heap[0]
        return -price if negate else price


book = OrderBook()
book.add_order(1, "buy", 100)
book.add_order(2, "buy", 101)
book.add_order(3, "sell", 105)
print(book.best_bid(), book.best_ask())  # 101 105
book.cancel_order(2)
print(book.best_bid())  # 100`,
    language: "python",
    complexity: { time: "O(log n) amortized per operation", space: "O(n)" },
  },
];
