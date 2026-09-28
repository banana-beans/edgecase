import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-28
// A running-median two-heap problem, a minimum-window sliding
// window over multi-venue quotes, the buy/sell-with-cooldown DP
// stock variant, an expected-value Markov-chain streak problem,
// and a lazy-deletion two-heap order-book top-of-book design
// problem.
// ============================================================

export const financeBatch20260928: LeetCodeProblem[] = [
  {
    id: "lc-20260928-running-median-trade-stream",
    title: "Running Median of a Live Trade Price Stream",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Design a class MedianTracker that processes a live stream of trade prices via add_price(price) and supports median(), which returns the median of all prices seen so far, without re-sorting the full history on every query.",
    examples: [
      {
        input: "add_price(5); add_price(15); median(); add_price(1); median()",
        output: "10.0, then 5.0",
        explanation:
          "After [5, 15], the sorted list is [5, 15], so the median is (5+15)/2 = 10.0. After adding 1, the sorted list is [1, 5, 15], so the median is the middle element, 5.0.",
      },
    ],
    constraints: ["1 <= number of add_price calls <= 10^5", "price > 0", "median() is only called after at least one add_price"],
    approach:
      "Maintain two heaps: a max-heap (via negation, since Python's heapq is min-heap only) holding the smaller half of prices seen so far, and a min-heap holding the larger half. On every add, push into the appropriate half and rebalance so the two heaps' sizes never differ by more than one -- this keeps the median always sitting at one or both heap tops. When sizes are equal the median is the average of both tops; when the lower heap has one extra element, the median is its top alone. Each add is O(log n) for the heap push/rebalance, and every median query is O(1), a large win over re-sorting the full price history (O(n log n)) on each query.",
    code: `import heapq

class MedianTracker:
    def __init__(self):
        self.lo: list[float] = []   # max-heap (negated), holds the SMALLER half
        self.hi: list[float] = []   # min-heap, holds the LARGER half

    def add_price(self, price: float) -> None:
        # push to the small half, then rebalance sizes across both heaps
        heapq.heappush(self.lo, -price)
        heapq.heappush(self.hi, -heapq.heappop(self.lo))
        if len(self.hi) > len(self.lo):
            heapq.heappush(self.lo, -heapq.heappop(self.hi))

    def median(self) -> float:
        if len(self.lo) > len(self.hi):
            return float(-self.lo[0])
        return (-self.lo[0] + self.hi[0]) / 2.0

tracker = MedianTracker()
tracker.add_price(5)
tracker.add_price(15)
print(tracker.median())   # 10.0
tracker.add_price(1)
print(tracker.median())   # 5.0`,
    language: "python",
    complexity: { time: "O(log n) per add_price, O(1) per median()", space: "O(n)" },
  },
  {
    id: "lc-20260928-min-window-all-venues",
    title: "Shortest Window Containing a Quote From Every Venue",
    difficulty: "hard",
    topics: ["sliding-window", "hash-map"],
    problem:
      "Given a chronological list of quote updates, each tagged with the venue that sent it, and the set of all distinct venue ids a smart-order-router must hear from before it can compute a consolidated best price, return the length of the shortest contiguous window of updates that contains at least one quote from every venue.",
    examples: [
      {
        input: "venues=[1, 2, 1, 3, 2, 1], all_venues={1, 2, 3}",
        output: "3",
        explanation:
          "The window at indices 1-3, [2, 1, 3], contains all three venues and has length 3. No shorter window can work, since a valid window needs at least one update from each of the 3 distinct venues.",
      },
    ],
    constraints: ["1 <= updates.length <= 10^5", "1 <= number of distinct venues <= 20", "a valid window is guaranteed to exist"],
    approach:
      "This is the classic minimum-window-substring pattern applied to venues instead of characters. Expand the right pointer through the updates, keeping a count of how many times each venue currently appears inside the window and a running count of how many DISTINCT required venues have at least one update in the window. Once every venue is represented, the window is valid, so shrink from the left as far as possible while it stays valid, recording the shortest length seen at each fully-valid state before advancing the left pointer past a venue's last remaining copy in the window. Because each pointer only ever advances forward, the whole scan is O(n) despite the window resizing at every step.",
    code: `def min_window_all_venues(venues: list[int], all_venues: set[int]) -> int:
    need = len(all_venues)
    window_count: dict[int, int] = {}
    satisfied = 0
    best = float("inf")
    left = 0

    for right, v in enumerate(venues):
        window_count[v] = window_count.get(v, 0) + 1
        if v in all_venues and window_count[v] == 1:
            satisfied += 1   # first time this venue appears in the window

        # once every venue has at least one quote, shrink from the left
        while satisfied == need:
            best = min(best, right - left + 1)
            left_v = venues[left]
            window_count[left_v] -= 1
            if left_v in all_venues and window_count[left_v] == 0:
                satisfied -= 1
            left += 1

    return int(best)

print(min_window_all_venues([1, 2, 1, 3, 2, 1], {1, 2, 3}))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(distinct venues)" },
  },
  {
    id: "lc-20260928-buy-sell-cooldown",
    title: "Best Time to Buy and Sell Stock With a One-Day Cooldown",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices, you may complete as many buy-then-sell transactions as you like (hold at most one share at a time, sell before buying again), but after selling you must wait one full day (a cooldown) before your next buy. Return the maximum achievable profit.",
    examples: [
      {
        input: "prices=[1, 2, 3, 0, 2]",
        output: "3",
        explanation:
          "Buy at 1 (day 0), sell at 2 (day 1) for profit 1, cooldown on day 2, buy at 0 (day 3), sell at 2 (day 4) for profit 2. Total profit 1+2=3 -- higher than a single round trip buying at 1 and selling at 3 (profit 2), because splitting into two trips banks the dip at 0.",
      },
    ],
    constraints: ["0 <= prices.length <= 5000", "0 <= prices[i] <= 1000"],
    approach:
      "Track three running states per day instead of the usual two, to encode the cooldown rule: hold (currently holding a share), sold (just sold today, so cooldown applies tomorrow), and rest (not holding and free to buy today). The transitions each day are: hold can either keep yesterday's held position or be entered today by buying out of yesterday's rest state; sold is always entered today by selling yesterday's held position; rest can either continue from yesterday's rest, or begin today because yesterday was a sold day (cooldown just ended). The answer is the better of ending in sold or rest on the final day, since ending mid-hold with an unsold share is never optimal.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    hold = -prices[0]   # holding a share, best profit so far
    sold = 0             # just sold today (cooldown starts tomorrow)
    rest = 0             # not holding, free to buy today

    for price in prices[1:]:
        prev_hold, prev_sold, prev_rest = hold, sold, rest
        hold = max(prev_hold, prev_rest - price)   # keep holding, or buy today
        sold = prev_hold + price                    # sell today's held share
        rest = max(prev_rest, prev_sold)             # stay out, or cooldown just ended

    return max(sold, rest)

print(max_profit_with_cooldown([1, 2, 3, 0, 2]))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260928-expected-days-up-streak",
    title: "Expected Number of Days Until K Consecutive Up-Days",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "Each trading day is independently an up-day with probability p and a down-day with probability 1-p. Return the expected number of days until you first observe a run of K consecutive up-days in a row.",
    examples: [
      {
        input: "p=0.5, k=2",
        output: "6.0",
        explanation:
          "For a fair coin needing 2 consecutive successes, the closed-form expected waiting time (1 - p^k) / ((1-p) * p^k) evaluates to (1-0.25) / (0.5*0.25) = 0.75/0.125 = 6.0 days.",
      },
    ],
    constraints: ["0 < p < 1", "k >= 1"],
    approach:
      "Model this as an absorbing Markov chain over streak states 0, 1, ..., k, where state i means the current run of consecutive up-days has length i, and state k is absorbing (success). Let E_i be the expected additional days to reach state k starting from state i. Conditioning on the next day's outcome gives the recurrence E_i = 1 + p*E_{i+1} + (1-p)*E_0 for i < k, with E_k = 0. Solving that linear system (it telescopes cleanly because every down-day resets the streak all the way to state 0) yields the closed form E_0 = (1 - p^k) / ((1-p) * p^k), which evaluates in O(1) instead of solving a (k+1)-state linear system directly.",
    code: `def expected_days_to_k_up_streak(p: float, k: int) -> float:
    # Absorbing Markov chain over streak-length states 0..k; conditioning
    # on the next day's outcome gives E_i = 1 + p*E_(i+1) + (1-p)*E_0,
    # with E_k = 0 (absorbed). Because a single down-day resets the
    # streak all the way to state 0, the recurrence telescopes to:
    #     E_0 = (1 - p**k) / ((1 - p) * p**k)
    return (1.0 - p ** k) / ((1.0 - p) * p ** k)

print(expected_days_to_k_up_streak(p=0.5, k=2))
# 6.0

print(round(expected_days_to_k_up_streak(p=0.55, k=3), 2))
# a favorable edge (p > 0.5) sharply cuts the expected wait vs the fair case`,
    language: "python",
    complexity: { time: "O(1) (or O(k) computing p**k iteratively for numerical stability at very small p)", space: "O(1)" },
  },
  {
    id: "lc-20260928-top-of-book-cancel",
    title: "Design a Top-of-Book Tracker With Order Cancellation",
    difficulty: "medium",
    topics: ["design", "heap"],
    problem:
      "Design a class TopOfBook supporting add_order(order_id, side, price), where side is 'buy' or 'sell', cancel(order_id), which removes a previously added order, and best_bid() / best_ask(), which return the highest active buy price and lowest active sell price (or None if no active orders remain on that side).",
    examples: [
      {
        input: "add_order(1,'buy',100); add_order(2,'buy',105); add_order(3,'sell',110); best_bid(); cancel(2); best_bid()",
        output: "105, then 100",
        explanation:
          "Before cancel(2), the best (highest) active buy is order 2 at 105. After cancelling it, the best remaining active buy is order 1 at 100.",
      },
    ],
    constraints: ["1 <= number of calls <= 10^5", "order_id values are unique", "cancel is only called on an order_id that was added and not yet cancelled"],
    approach:
      "Keep a max-heap (via negated prices) for buy orders and a min-heap for sell orders, each entry a (price, order_id) pair. A heap doesn't support removing an arbitrary interior element efficiently, so cancellation is handled with lazy deletion: cancel(order_id) just records the id in a cancelled set in O(1) and leaves the heap untouched. Only when best_bid() or best_ask() is actually queried does the code pop and discard any heap-top entries whose order_id is in the cancelled set, stopping once a live order surfaces at the top. Since every order is pushed once and popped-and-discarded at most once across the object's lifetime, total work across n operations stays O(n log n) amortized even though individual cancels are O(1).",
    code: `import heapq

class TopOfBook:
    def __init__(self):
        self.buys: list[tuple[float, int]] = []    # max-heap: (-price, order_id)
        self.sells: list[tuple[float, int]] = []    # min-heap: (price, order_id)
        self.cancelled: set[int] = set()

    def add_order(self, order_id: int, side: str, price: float) -> None:
        if side == "buy":
            heapq.heappush(self.buys, (-price, order_id))
        else:
            heapq.heappush(self.sells, (price, order_id))

    def cancel(self, order_id: int) -> None:
        # O(1): mark it dead, don't touch the heap yet -- lazy deletion
        self.cancelled.add(order_id)

    def _clean(self, heap: list[tuple[float, int]]) -> None:
        # discard cancelled orders sitting at the top; each is popped once, ever
        while heap and heap[0][1] in self.cancelled:
            heapq.heappop(heap)

    def best_bid(self):
        self._clean(self.buys)
        return -self.buys[0][0] if self.buys else None

    def best_ask(self):
        self._clean(self.sells)
        return self.sells[0][0] if self.sells else None

book = TopOfBook()
book.add_order(1, "buy", 100)
book.add_order(2, "buy", 105)
book.add_order(3, "sell", 110)
print(book.best_bid())   # 105
book.cancel(2)
print(book.best_bid())   # 100`,
    language: "python",
    complexity: { time: "O(log n) per add_order, O(1) per cancel, O(log n) amortized per best_bid/best_ask", space: "O(n)" },
  },
];
