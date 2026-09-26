import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-26
// A two-heap running-median design problem, a fixed-size
// sliding-window average problem, a transaction-fee DP stock
// variant, a waiting-time Markov chain problem, and an
// iceberg-order matching engine design problem.
// ============================================================

export const financeBatch20260926: LeetCodeProblem[] = [
  {
    id: "lc-20260926-running-median-trade-price",
    title: "Running Median Trade Price via Two Heaps",
    difficulty: "medium",
    topics: ["heap", "design"],
    problem:
      "Design a class MedianTracker supporting add_price(price), which ingests one trade price at a time, and median(), which returns the median of every price ingested so far. Both methods must avoid re-sorting the whole history on every call.",
    examples: [
      {
        input: 'add_price(101); add_price(105); median(); add_price(99); median()',
        output: "103.0, 101.0",
        explanation:
          "After [101, 105] the median is the average of both (103.0). After adding 99, the sorted set is [99, 101, 105] and the median is the middle value, 101.0.",
      },
    ],
    constraints: ["1 <= number of add_price calls <= 10^5", "prices fit in a 32-bit int"],
    approach:
      "Split the running data into two heaps at the midpoint: a max-heap holding the lower half (store negated prices, since heapq is a min-heap) and a min-heap holding the upper half. After every insert, rebalance so the two heaps differ in size by at most one -- always route the new price to the side it belongs on, then shift one element across if a heap grew too large. With that invariant maintained, the median is always either the top of the larger heap (odd total count) or the average of both tops (even total count), an O(1) lookup. Each insert costs O(log n) for the heap push/pop, versus O(n log n) to re-sort on every call.",
    code: `import heapq

class MedianTracker:
    def __init__(self):
        self.lower: list[float] = []   # max-heap (negated): the smaller half
        self.upper: list[float] = []   # min-heap: the larger half

    def add_price(self, price: float) -> None:
        # route to the correct side first, then rebalance sizes
        if self.lower and price > -self.lower[0]:
            heapq.heappush(self.upper, price)
        else:
            heapq.heappush(self.lower, -price)

        # keep the two heaps within one element of each other
        if len(self.lower) > len(self.upper) + 1:
            heapq.heappush(self.upper, -heapq.heappop(self.lower))
        elif len(self.upper) > len(self.lower) + 1:
            heapq.heappush(self.lower, -heapq.heappop(self.upper))

    def median(self) -> float:
        if len(self.lower) == len(self.upper):
            return (-self.lower[0] + self.upper[0]) / 2.0
        # the larger heap's top is the median when counts are unequal
        return -self.lower[0] if len(self.lower) > len(self.upper) else self.upper[0]

tracker = MedianTracker()
tracker.add_price(101)
tracker.add_price(105)
print(tracker.median())   # 103.0
tracker.add_price(99)
print(tracker.median())   # 101.0`,
    language: "python",
    complexity: { time: "O(log n) per add_price, O(1) per median", space: "O(n)" },
  },
  {
    id: "lc-20260926-max-avg-notional-fixed-window",
    title: "Maximum Average Notional Over Any Fixed K-Minute Window",
    difficulty: "easy",
    topics: ["sliding-window"],
    problem:
      "Given an array of per-minute traded notional and an integer k, return the maximum average notional over any contiguous window of exactly k minutes.",
    examples: [
      {
        input: "notional=[40, 90, 20, 70, 60], k=2",
        output: "65.0",
        explanation:
          "Every 2-minute window's sum: [40,90]=130, [90,20]=110, [20,70]=90, [70,60]=130. The max sum is 130 (two windows tie for it), so the max average is 130/2 = 65.0.",
      },
    ],
    constraints: ["1 <= k <= len(notional) <= 10^5", "notional[i] >= 0"],
    approach:
      "A fixed window size means the sliding-window update is O(1) per step rather than needing an inner shrink loop: maintain a running sum over exactly k elements, and as the window slides forward by one minute, add the newly entered element and subtract the one that just fell out the back. Track the maximum sum seen across all valid windows, then divide by k once at the end rather than doing a division on every step, since dividing by a constant on every iteration is pure overhead when you only need the final ratio.",
    code: `def max_avg_notional(notional: list[int], k: int) -> float:
    window_sum = sum(notional[:k])   # the first window, computed once
    best_sum = window_sum

    for i in range(k, len(notional)):
        # O(1) slide: add the new right edge, drop the old left edge
        window_sum += notional[i] - notional[i - k]
        best_sum = max(best_sum, window_sum)

    return best_sum / k   # divide once at the end, not on every step

print(max_avg_notional([40, 90, 20, 70, 60], k=2))
# 65.0`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260926-buy-sell-transaction-fee",
    title: "Best Time to Buy and Sell Stock With a Transaction Fee",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices and a fixed fee charged once per completed round trip, you may complete as many non-overlapping buy-then-sell transactions as you like (sell before buying again, hold at most one share at a time). Return the maximum achievable profit after fees.",
    examples: [
      {
        input: "prices=[1, 3, 2, 8, 4, 9], fee=2",
        output: "8",
        explanation:
          "Buy at 1, sell at 8: profit 7 minus fee 2 = 5. Buy at 4, sell at 9: profit 5 minus fee 2 = 3. Total 5+3=8, better than any single round trip alone.",
      },
    ],
    constraints: ["0 <= prices.length <= 10^5", "0 <= prices[i] <= 10^5", "0 <= fee <= 10^5"],
    approach:
      "Track two running scalars instead of a full DP table, updated once per day using only yesterday's values: cash, the best profit achievable while NOT currently holding a share, and hold, the best profit achievable while currently holding one (already net of its purchase price). The fee only needs to be charged at ONE side of the round trip, not both, since charging it once fully accounts for the cost of a complete buy-sell pair -- charging it at the sell is the natural choice, since that is the moment a round trip actually completes. Each day: cash can either stay the same or come from selling today's held share (hold + price - fee); hold can either stay the same or come from buying today out of cash (cash - price).",
    code: `def max_profit_with_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    cash = 0                 # best profit while not holding
    hold = -prices[0]        # best profit while holding, net of purchase price

    for price in prices[1:]:
        # fee charged exactly once per round trip -- at the sell, not the buy
        cash = max(cash, hold + price - fee)
        hold = max(hold, cash - price)

    return cash   # ending while holding is never optimal

print(max_profit_with_fee([1, 3, 2, 8, 4, 9], fee=2))
# 8`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260926-expected-days-two-consecutive-wins",
    title: "Expected Number of Days Until Two Consecutive Winning Days",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "Each trading day is independently a winning day with probability p, otherwise a losing day. Return the expected number of days until you first observe two consecutive winning days.",
    examples: [
      {
        input: "p=0.5",
        output: "6.0",
        explanation:
          "This is the classic 'expected coin flips until two heads in a row' result: for a fair coin the expected wait is exactly 6 days.",
      },
    ],
    constraints: ["0 < p < 1"],
    approach:
      "Model this as a small absorbing Markov chain with three states: 0 (no current win streak), 1 (yesterday was a win), and absorbed (two wins in a row just happened). Let E0 be the expected remaining days starting fresh (state 0) and E1 be the expected remaining days given yesterday was a win (state 1). One more day always elapses, and from state 0 you move to state 1 with probability p or stay at state 0 with probability 1-p, giving E0 = 1 + p*E1 + (1-p)*E0. From state 1, a second win (probability p) ends it immediately, otherwise (probability 1-p) you fall back to state 0, giving E1 = 1 + (1-p)*E0. Solving these two linear equations together (rather than simulating) collapses to the closed form E0 = (1 + p) / p^2, which is O(1) to evaluate for any p.",
    code: `def expected_days_two_wins_in_a_row(p: float) -> float:
    # closed form solved from the two-state absorbing Markov chain:
    #   E0 = 1 + p*E1 + (1-p)*E0
    #   E1 = 1 + (1-p)*E0
    # substituting E1 into the E0 equation and solving for E0 gives:
    return (1.0 + p) / (p ** 2)

print(expected_days_two_wins_in_a_row(0.5))
# 6.0 -- matches the classic "expected flips until HH" result

print(round(expected_days_two_wins_in_a_row(0.6), 3))
# a higher per-day win probability shortens the expected wait, as it should`,
    language: "python",
    complexity: { time: "O(1) with the closed form", space: "O(1)" },
  },
  {
    id: "lc-20260926-iceberg-order-matching",
    title: "Design an Iceberg Order Matching Engine",
    difficulty: "hard",
    topics: ["design", "queue"],
    problem:
      "Design a class IcebergBook, scoped to a single resting side at a single price, supporting add_iceberg(order_id, display_size, total_size), which rests an order that only ever shows display_size shares at a time (the rest stays hidden), and add_market_order(size), which matches an incoming market order against the resting queue in arrival order, filling only the currently VISIBLE size of the order at the front. Whenever a resting order's visible clip is fully consumed, replenish it with a fresh clip from its hidden remainder (display_size, or whatever hidden amount is left if smaller) and send it to the BACK of the queue, losing its time priority -- the standard convention for iceberg replenishment. Return the list of (order_id, fill_size) fills produced by one market order call.",
    examples: [
      {
        input:
          'add_iceberg(1, display_size=10, total_size=25); add_iceberg(2, display_size=5, total_size=5); add_market_order(size=12)',
        output: "[(1, 10), (2, 2)]",
        explanation:
          "Order 1 shows 10; the market order takes all 10, exhausting the visible clip, so order 1 replenishes 10 more from its hidden 15 and moves to the BACK of the queue. Order 2 is now at the front showing 5; the remaining 2 shares of the market order fill against it.",
      },
    ],
    constraints: ["order_ids are unique while active", "display_size, total_size, and market order sizes are positive integers", "display_size <= total_size"],
    approach:
      "Keep one FIFO queue of resting iceberg orders, each tracked as (order_id, display_size, visible_remaining, hidden_remaining). A market order walks the queue from the front: consume min(visible_remaining, size_left) from the order at the front, record that fill, and reduce both the order's visible_remaining and the market order's remaining size. If the front order's visible_remaining hits zero, decide its fate before moving on -- if it still has hidden shares, replenish a fresh clip (min(display_size, hidden_remaining)) into visible_remaining, deduct that clip from hidden_remaining, and requeue it at the BACK (popleft then append), which is what actually costs it time priority; if it has no hidden shares left, it is simply done and gets dropped instead of requeued. Continue until the market order is fully filled or the queue empties.",
    code: `from collections import deque

class IcebergBook:
    def __init__(self):
        # each entry: [order_id, display_size, visible_remaining, hidden_remaining]
        self.queue: deque[list[int]] = deque()

    def add_iceberg(self, order_id: int, display_size: int, total_size: int) -> None:
        visible = min(display_size, total_size)
        hidden = total_size - visible
        self.queue.append([order_id, display_size, visible, hidden])

    def add_market_order(self, size: int) -> list[tuple[int, int]]:
        fills: list[tuple[int, int]] = []
        remaining = size

        while remaining > 0 and self.queue:
            front = self.queue[0]
            order_id, display_size, visible, hidden = front
            fill_size = min(visible, remaining)
            fills.append((order_id, fill_size))
            front[2] -= fill_size          # reduce visible_remaining
            remaining -= fill_size

            if front[2] == 0:
                self.queue.popleft()
                if front[3] > 0:
                    # replenish from hidden size, then requeue at the BACK --
                    # this is exactly what costs an iceberg its time priority
                    clip = min(display_size, front[3])
                    front[3] -= clip
                    front[2] = clip
                    self.queue.append(front)
                # else: fully exhausted, dropped instead of requeued

        return fills

book = IcebergBook()
book.add_iceberg(1, display_size=10, total_size=25)
book.add_iceberg(2, display_size=5, total_size=5)
print(book.add_market_order(12))
# [(1, 10), (2, 2)]`,
    language: "python",
    complexity: { time: "O(size / average display_size) amortized per market order", space: "O(number of resting orders)" },
  },
];
