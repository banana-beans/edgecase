import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-16
// Top-k largest daily P&L values in a stream (heap), max
// high-low range in any window of size k (sliding window /
// monotonic deque), buy/sell with a cooldown period (DP stock
// variant), probability a random walk of trades ends net
// positive (probability / combinatorics), and a level-1 order
// book supporting best bid/ask with cancel (design).
// ============================================================

export const financeBatch20261116: LeetCodeProblem[] = [
  {
    id: "lc-20261116-top-k-largest-daily-pnl",
    title: "Top K Largest Daily P&L Values in a Stream",
    difficulty: "easy",
    topics: ["heap"],
    problem:
      "Design a class that ingests a stream of daily P&L values one at a time and, after each ingestion, can report the k largest P&L values seen so far (k is fixed when the tracker is created).",
    examples: [
      {
        input: "k = 3; add(5); add(-2); add(9); add(1); add(7); top_k()",
        output: "[5, 7, 9]",
        explanation:
          "After all five values [5, -2, 9, 1, 7], the three largest are 5, 7, and 9. A min-heap of size k keeps exactly those three without ever sorting the full history.",
      },
    ],
    constraints: ["up to 10^5 add calls", "k is fixed and at least 1", "P&L values can be negative"],
    approach:
      "Keep a min-heap capped at size k. Every new value is pushed in; if that makes the heap larger than k, pop the smallest element right away. The heap's root is always the SMALLEST of the current top-k, not the overall minimum of everything seen, which is exactly the invariant that makes this work: anything smaller than the current root can never make the top k, so it is safe to discard immediately instead of keeping the full history around.",
    code: `import heapq


class TopKPnl:
    def __init__(self, k: int) -> None:
        self.k = k
        self.heap: list[float] = []  # min-heap, capped at size k

    def add(self, pnl: float) -> None:
        heapq.heappush(self.heap, pnl)
        if len(self.heap) > self.k:
            heapq.heappop(self.heap)  # discard the smallest of the top-k

    def top_k(self) -> list[float]:
        return sorted(self.heap)


tracker = TopKPnl(k=3)
for value in [5, -2, 9, 1, 7]:
    tracker.add(value)
print(tracker.top_k())
# [5, 7, 9]`,
    language: "python",
    complexity: { time: "O(log k) per add", space: "O(k)" },
  },
  {
    id: "lc-20261116-max-range-window-k",
    title: "Maximum High-Low Range in Any Window of Size K",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given an array of daily closing prices and a window length k, return the largest value of (max price - min price) over any contiguous window of exactly k consecutive days.",
    examples: [
      {
        input: "prices = [10, 12, 8, 15, 9, 11], k = 3",
        output: "7",
        explanation:
          "The window [8, 15, 9] (indices 2-4) has max 15 and min 8, a range of 7, which is larger than any other window of length 3.",
      },
    ],
    constraints: ["1 <= k <= prices.length <= 10^5", "0 <= prices[i] <= 10^6"],
    approach:
      "A naive approach recomputes max and min over each window from scratch, costing O(n*k). Instead, maintain two monotonic deques of INDICES as the window slides: a decreasing deque tracks the current window's max candidate at its front, an increasing deque tracks the min candidate at its front. On each step, pop any deque entries from the back that are dominated by the new price (a smaller value can never be the max again once a bigger one is in the window, and vice versa for the min deque), then pop expired indices from the front once they fall outside the window. Each index enters and leaves each deque at most once, so the whole scan is O(n) even though max and min are both available at every step.",
    code: `from collections import deque


def max_range_in_window(prices: list[int], k: int) -> int:
    max_deque: deque[int] = deque()  # indices, decreasing prices front-to-back
    min_deque: deque[int] = deque()  # indices, increasing prices front-to-back
    best = 0

    for i, price in enumerate(prices):
        while max_deque and prices[max_deque[-1]] <= price:
            max_deque.pop()
        max_deque.append(i)

        while min_deque and prices[min_deque[-1]] >= price:
            min_deque.pop()
        min_deque.append(i)

        # drop indices that have fallen out of the current window
        if max_deque[0] <= i - k:
            max_deque.popleft()
        if min_deque[0] <= i - k:
            min_deque.popleft()

        if i >= k - 1:
            best = max(best, prices[max_deque[0]] - prices[min_deque[0]])

    return best


print(max_range_in_window([10, 12, 8, 15, 9, 11], k=3))
# 7`,
    language: "python",
    complexity: { time: "O(n)", space: "O(k)" },
  },
  {
    id: "lc-20261116-max-profit-with-cooldown",
    title: "Best Time to Buy and Sell Stock With a Cooldown Day",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for one instrument, you may buy and sell any number of times (never holding more than one unit at a time), but after selling you must wait one full day (a cooldown) before buying again. Return the maximum total profit.",
    examples: [
      {
        input: "prices = [1, 2, 3, 0, 2]",
        output: "3",
        explanation:
          "Buy on day 0 at 1, sell on day 1 at 2 for a profit of 1. Day 2 is a forced cooldown after that sale. Buy again on day 3 at 0, sell on day 4 at 2 for a profit of 2. Total profit: 1 + 2 = 3, which beats any single round trip (the best single trip, buy at 0 and sell at 3, only earns 2).",
      },
    ],
    constraints: ["1 <= prices.length <= 5000", "0 <= prices[i] <= 1000"],
    approach:
      "Track three running states day by day: hold (max profit while currently holding a position), sold (max profit on a day you just sold, which triggers the next day's cooldown), and rest (max profit while not holding and not fresh off a sale, free to buy). Transitions: new_hold is the better of staying in hold or buying today funded from yesterday's rest; new_sold is yesterday's hold plus today's price (selling today); new_rest is the better of staying in rest or coming off yesterday's sold (the cooldown day has now passed). The answer is the max of sold and rest at the end, since ending while still holding is never optimal when you could have sold.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    hold = float("-inf")  # max profit, currently holding a position
    sold = 0.0            # max profit, just sold today (cooldown starts tomorrow)
    rest = 0.0            # max profit, not holding, free to buy today

    for price in prices:
        prev_hold, prev_sold, prev_rest = hold, sold, rest
        hold = max(prev_hold, prev_rest - price)   # keep holding, or buy from rest
        sold = prev_hold + price                   # sell today
        rest = max(prev_rest, prev_sold)            # stay resting, or cooldown just ended

    return max(sold, rest)


print(max_profit_with_cooldown([1, 2, 3, 0, 2]))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261116-prob-random-walk-net-positive",
    title: "Probability a Sequence of N Independent +1/-1 Trades Ends Net Positive",
    difficulty: "medium",
    topics: ["probability", "dynamic-programming"],
    problem:
      "A trader makes n independent trades, each winning +1 with probability p or losing -1 with probability 1-p. Return the probability that the trader's cumulative P&L after all n trades is strictly positive (greater than 0).",
    examples: [
      {
        input: "n = 3, p = 0.5",
        output: "0.5",
        explanation:
          "With 3 fair coin-flip trades, the net P&L is odd, so it is never exactly 0 -- by symmetry, P(net > 0) equals P(net < 0), and together they must sum to 1, giving exactly 0.5 each.",
      },
      {
        input: "n = 2, p = 0.6",
        output: "0.36",
        explanation:
          "Net P&L is positive only if both trades win: 0.6 * 0.6 = 0.36. Splitting one win and one loss nets to exactly 0, which does not count as strictly positive.",
      },
    ],
    constraints: ["1 <= n <= 1000", "0 < p < 1"],
    approach:
      "If w is the number of winning trades out of n, net P&L equals w - (n - w) = 2w - n, which is strictly positive exactly when w > n/2. So the answer is the upper tail of a Binomial(n, p) distribution: the sum over w from floor(n/2)+1 to n of the binomial PMF. Computing this with a DP over (number of trades so far, running win count) avoids any numerical overflow from computing raw binomial coefficients for n up to 1000, and naturally generalizes if trade outcomes were not identically distributed.",
    code: `def prob_net_positive(n: int, p: float) -> float:
    # dp[w] = probability of exactly w wins after the trades processed so far
    dp = [0.0] * (n + 1)
    dp[0] = 1.0

    for _ in range(n):
        new_dp = [0.0] * (n + 1)
        for w in range(n + 1):
            if dp[w] == 0.0:
                continue
            if w + 1 <= n:
                new_dp[w + 1] += dp[w] * p          # this trade wins
            new_dp[w] += dp[w] * (1 - p)            # this trade loses
        dp = new_dp

    # net P&L = 2*w - n > 0  <=>  w > n / 2
    return sum(dp[w] for w in range(n + 1) if 2 * w - n > 0)


print(round(prob_net_positive(3, 0.5), 4))
# 0.5
print(round(prob_net_positive(2, 0.6), 4))
# 0.36`,
    language: "python",
    complexity: { time: "O(n^2)", space: "O(n)" },
  },
  {
    id: "lc-20261116-design-level1-order-book",
    title: "Design: Level-1 Order Book (Best Bid/Ask With Cancel)",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design an OrderBook supporting add_bid(order_id, price), add_ask(order_id, price), cancel(order_id), best_bid(), and best_ask(). best_bid/best_ask must return the highest live bid price and lowest live ask price (or None if that side is empty).",
    examples: [
      {
        input:
          "add_bid(1, 100); add_bid(2, 102); add_ask(3, 105); best_bid(); best_ask(); cancel(2); best_bid()",
        output: "102, 105, 100",
        explanation:
          "After the first three orders, the best bid is the higher of 100 and 102 (102), and the best ask is 105. Cancelling order 2 (the 102 bid) drops the best bid back down to 100.",
      },
    ],
    constraints: ["order_ids are unique", "up to 10^5 operations", "any live order may be cancelled at most once"],
    approach:
      "Keep a max-heap of (price, order_id) for bids and a min-heap of (price, order_id) for asks (bids negate price since Python's heapq is min-heap only), plus a side dict mapping order_id to its heap and a cancelled set for lazy deletion. Cancelling just marks the id cancelled instead of searching the heap -- heaps don't support efficient arbitrary removal. best_bid/best_ask pop and discard any cancelled entries sitting at the top of their heap before reading the true top, so cancelled orders are cleaned up lazily, only when they would otherwise be mistaken for the best price.",
    code: `import heapq


class OrderBook:
    def __init__(self) -> None:
        self.bids: list[tuple[float, int]] = []  # max-heap via negated price
        self.asks: list[tuple[float, int]] = []  # min-heap
        self.side: dict[int, str] = {}
        self.cancelled: set[int] = set()

    def add_bid(self, order_id: int, price: float) -> None:
        heapq.heappush(self.bids, (-price, order_id))
        self.side[order_id] = "bid"

    def add_ask(self, order_id: int, price: float) -> None:
        heapq.heappush(self.asks, (price, order_id))
        self.side[order_id] = "ask"

    def cancel(self, order_id: int) -> None:
        # lazy delete: heaps can't remove an arbitrary element cheaply,
        # so just flag it and skip it later when it surfaces at the top
        self.cancelled.add(order_id)

    def best_bid(self) -> float | None:
        while self.bids and self.bids[0][1] in self.cancelled:
            heapq.heappop(self.bids)
        return -self.bids[0][0] if self.bids else None

    def best_ask(self) -> float | None:
        while self.asks and self.asks[0][1] in self.cancelled:
            heapq.heappop(self.asks)
        return self.asks[0][0] if self.asks else None


book = OrderBook()
book.add_bid(1, 100)
book.add_bid(2, 102)
book.add_ask(3, 105)
print(book.best_bid(), book.best_ask())
book.cancel(2)
print(book.best_bid())
# 102 105
# 100`,
    language: "python",
    complexity: { time: "O(log n) amortized per operation", space: "O(n)" },
  },
];
