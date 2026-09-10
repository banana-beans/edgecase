import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-10
// A two-heap streaming median, a monotonic-deque bounded-range
// window, stock DP with a cooldown day, two-state Markov regime
// statistics, and a single-symbol limit order book matcher.
// ============================================================

export const financeBatch20260910: LeetCodeProblem[] = [
  {
    id: "lc-20260910-streaming-median-two-heaps",
    title: "Streaming Median of a Live Price Feed",
    difficulty: "medium",
    topics: ["heap", "design"],
    problem:
      "Design a class that ingests a stream of trade prices one at a time via add(price) and can report the median of every price seen so far via median() at any point, with add running in O(log n) and median in O(1).",
    examples: [
      {
        input: "add(5); add(2); median(); add(8); median()",
        output: "3.5, 5.0",
        explanation:
          "After [5, 2] the sorted values are [2, 5], median 3.5. After adding 8 the sorted values are [2, 5, 8], median 5.0.",
      },
    ],
    constraints: ["up to 10^5 total calls to add and median", "0 < price < 10^6"],
    approach:
      "Split the stream across two heaps: a max-heap 'lo' holding the smaller half of the values (stored negated, since Python's heapq is a min-heap) and a min-heap 'hi' holding the larger half. Every insert goes through lo first, then the current max of lo is pushed into hi -- this keeps the invariant 'everything in lo is <= everything in hi' true without ever comparing against a stale boundary. Rebalance afterward so lo holds at most one more element than hi. The median is then either the top of lo (odd total count) or the average of both tops (even count) -- both O(1) lookups, since heap tops are always at index 0.",
    code: `import heapq

class StreamingMedian:
    def __init__(self):
        self.lo: list[float] = []   # max-heap (negated): the smaller half
        self.hi: list[float] = []   # min-heap: the larger half

    def add(self, price: float) -> None:
        # push into lo first, then promote its current max into hi --
        # keeps "max(lo) <= min(hi)" true after every single insert
        heapq.heappush(self.lo, -price)
        heapq.heappush(self.hi, -heapq.heappop(self.lo))
        # rebalance: lo may hold at most one more element than hi
        if len(self.hi) > len(self.lo):
            heapq.heappush(self.lo, -heapq.heappop(self.hi))

    def median(self) -> float:
        if len(self.lo) > len(self.hi):
            return float(-self.lo[0])
        return (-self.lo[0] + self.hi[0]) / 2.0

sm = StreamingMedian()
for p in [5, 2, 8]:
    sm.add(p)
    print(sm.median())
# 5.0
# 3.5
# 5.0`,
    language: "python",
    complexity: { time: "O(log n) per add, O(1) per median", space: "O(n)" },
  },
  {
    id: "lc-20260910-longest-window-bounded-range",
    title: "Longest Window With Bounded Price Range",
    difficulty: "medium",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given an array of daily closing prices and a threshold limit, find the length of the longest contiguous run of trading days during which the price stayed within a band of width at most limit (max price in the window minus min price in the window <= limit).",
    examples: [
      {
        input: "prices=[8,2,4,7], limit=4",
        output: "2",
        explanation:
          "No window of length 3 or 4 has a max-min gap of 4 or less; [2,4] and [4,7] each have a gap of at most 3, so the best length is 2.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^9", "0 <= limit <= 10^9"],
    approach:
      "Slide a right pointer across the array while maintaining two monotonic deques of INDICES: one decreasing in price (its front is always the max of the current window) and one increasing in price (its front is always the min). Each new price pops any deque entries it invalidates before being appended, so both deques stay monotonic in O(1) amortized per element. Whenever the window's max minus min exceeds the limit, advance the left pointer and drop any deque fronts that have fallen out of the window. The window is always valid at the end of each step, so the answer is the largest right-minus-left-plus-one seen.",
    code: `from collections import deque

def longest_bounded_window(prices: list[int], limit: int) -> int:
    max_dq: deque[int] = deque()   # indices, prices decreasing front-to-back
    min_dq: deque[int] = deque()   # indices, prices increasing front-to-back
    left = 0
    best = 0

    for right, price in enumerate(prices):
        while max_dq and prices[max_dq[-1]] <= price:
            max_dq.pop()
        max_dq.append(right)

        while min_dq and prices[min_dq[-1]] >= price:
            min_dq.pop()
        min_dq.append(right)

        # shrink from the left until the window's range fits the limit
        while prices[max_dq[0]] - prices[min_dq[0]] > limit:
            left += 1
            if max_dq[0] < left:
                max_dq.popleft()
            if min_dq[0] < left:
                min_dq.popleft()

        best = max(best, right - left + 1)
    return best

print(longest_bounded_window([8, 2, 4, 7], 4))   # 2`,
    language: "python",
    complexity: { time: "O(n) amortized", space: "O(n)" },
  },
  {
    id: "lc-20260910-max-profit-cooldown",
    title: "Max Profit With a One-Day Cooldown",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for a stock, you may buy and sell any number of times (never holding more than one share at once), but after selling you must wait one full day (a cooldown) before buying again. Return the maximum achievable profit.",
    examples: [
      {
        input: "prices=[1,2,3,0,2]",
        output: "3",
        explanation:
          "Buy at 1, sell at 2 (profit 1), cooldown on day index 2, buy at 0, sell at 2 (profit 2). Total profit 3.",
      },
    ],
    constraints: ["0 <= prices.length <= 5000", "0 <= prices[i] <= 1000"],
    approach:
      "Track three rolling scalars per day: hold (best profit while currently holding a share), sold (best profit having just sold TODAY, which forces tomorrow into cooldown), and rest (best profit while flat and free to buy, i.e. not in a forced cooldown). Each day's hold either carries over or opens fresh by buying off of YESTERDAY's rest (never off of yesterday's sold, since that would skip the cooldown); sold is always yesterday's hold plus today's price; rest either carries over or absorbs yesterday's sold now that the cooldown has expired. The answer is the better of ending flat via a recent sale or ending flat via rest, since ending while still holding can never beat selling on the last day.",
    code: `def max_profit_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    hold = -prices[0]   # holding a share, bought on day 0
    sold = 0            # just sold today -- tomorrow is a forced cooldown
    rest = 0            # flat and free to buy

    for price in prices[1:]:
        prev_hold, prev_sold, prev_rest = hold, sold, rest
        # buy off of REST, never off of SOLD -- that is the cooldown rule
        hold = max(prev_hold, prev_rest - price)
        sold = prev_hold + price
        rest = max(prev_rest, prev_sold)

    # ending the sequence still holding a share can never beat having sold
    return max(sold, rest)

print(max_profit_cooldown([1, 2, 3, 0, 2]))   # 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260910-markov-regime-expected-duration",
    title: "Two-State Volatility Regime: Expected Duration and Stationary Share",
    difficulty: "medium",
    topics: ["probability", "markov-chain"],
    problem:
      "A volatility regime model has two states, LOW and HIGH. Each day, if the market is in LOW it switches to HIGH with probability p_lh (else stays LOW); if in HIGH it switches to LOW with probability p_hl (else stays HIGH). Given p_lh and p_hl, compute the expected number of consecutive days spent in each state before it switches away, and the long-run fraction of days spent in LOW.",
    examples: [
      {
        input: "p_lh=0.1, p_hl=0.25",
        output: "expected_low=10.0, expected_high=4.0, pi_low=0.7143",
        explanation:
          "Leaving LOW is a geometric event with success probability 0.1, so the expected sojourn is 1/0.1 = 10 days; symmetrically for HIGH. The stationary share of LOW is p_hl / (p_lh + p_hl) = 0.25 / 0.35.",
      },
    ],
    constraints: ["0 < p_lh < 1", "0 < p_hl < 1"],
    approach:
      "The number of days spent in a state before switching away is a geometric random variable: each day is an independent Bernoulli trial with 'success' meaning the regime switches, so the expected number of days until the first switch is 1 over that day's switch probability -- 1/p_lh for LOW, 1/p_hl for HIGH, no simulation needed. The long-run (stationary) fraction of time in each state follows from detailed balance on a 2-state chain: the flow of probability mass out of LOW must equal the flow back in, pi_low * p_lh == pi_high * p_hl, combined with pi_low + pi_high == 1, which solves in closed form to pi_low = p_hl / (p_lh + p_hl). A short Monte Carlo simulation is a cheap way to sanity-check the closed form before trusting it in a larger model.",
    code: `import numpy as np

def regime_stats(p_lh: float, p_hl: float) -> tuple[float, float, float]:
    # geometric distribution mean: expected days until an event with
    # per-day probability p first occurs is 1 / p
    expected_low = 1.0 / p_lh
    expected_high = 1.0 / p_hl

    # detailed balance for a 2-state chain: pi_low * p_lh == pi_high * p_hl,
    # plus pi_low + pi_high == 1, solves to this closed form
    pi_low = p_hl / (p_lh + p_hl)
    return expected_low, expected_high, pi_low

exp_low, exp_high, pi_low = regime_stats(0.1, 0.25)
print(round(exp_low, 2), round(exp_high, 2), round(pi_low, 4))

# quick simulation check that the closed form is not a bookkeeping mistake
def simulate_pi_low(p_lh: float, p_hl: float, n_days: int, seed: int = 0) -> float:
    rng = np.random.default_rng(seed)
    state, low_days = 0, 0   # 0 = LOW, 1 = HIGH
    for _ in range(n_days):
        low_days += state == 0
        draw = rng.random()
        state = 1 if (state == 0 and draw < p_lh) else (0 if (state == 1 and draw < p_hl) else state)
    return low_days / n_days

print(round(simulate_pi_low(0.1, 0.25, 50_000), 4))   # close to 0.7143`,
    language: "python",
    complexity: { time: "O(1) for the closed form, O(n_days) for the simulation check", space: "O(1)" },
  },
  {
    id: "lc-20260910-design-limit-order-book",
    title: "Design a Single-Symbol Limit Order Book Matcher",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design a limit order book for one symbol supporting add_buy(order_id, price, qty) and add_sell(order_id, price, qty). Each call attempts to match immediately against resting orders on the opposite side, best price first and, at equal prices, oldest order first (price-time priority), and returns the list of fills as (matched_order_id, fill_price, fill_qty) tuples. Any unmatched remainder rests in the book for future orders to match against.",
    examples: [
      {
        input: "add_sell(1,101.0,50); add_sell(2,101.0,30); add_buy(3,101.0,60)",
        output: "[(1, 101.0, 50), (2, 101.0, 10)]",
        explanation:
          "Both resting sells are at the same price, so the incoming buy for 60 shares fills the OLDER order (id 1) completely first, then takes the remaining 10 shares from order 2, which keeps 20 shares resting.",
      },
    ],
    constraints: ["up to 10^5 total order operations", "prices and quantities are positive"],
    approach:
      "Keep the resting buy side as a max-heap (prices negated, since heapq is min-heap) and the resting sell side as a min-heap, each entry tagged with a monotonically increasing sequence number so that equal prices break ties in arrival order -- the same price-time priority discipline as a real exchange. An incoming order walks the opposite heap's top while a match exists (buy price at least the best resting sell price, or symmetrically for an incoming sell), filling as much as available at each level and popping any resting order that is fully consumed. Any unfilled remainder is pushed onto the order's own side. Because a heap entry is only ever popped once it is fully filled, there is no need for lazy deletion or a separate cancellation-marking step in this simplified version.",
    code: `import heapq
import itertools

class OrderBook:
    def __init__(self):
        self.buys: list[tuple[float, int, int]] = []    # max-heap: (-price, seq, id)
        self.sells: list[tuple[float, int, int]] = []   # min-heap: (price, seq, id)
        self.remaining: dict[int, int] = {}              # order_id -> qty left
        self._seq = itertools.count()

    def add_buy(self, order_id: int, price: float, qty: int) -> list[tuple[int, float, int]]:
        fills = []
        rem = qty
        while rem > 0 and self.sells and self.sells[0][0] <= price:
            sell_price, _, sell_id = self.sells[0]
            traded = min(rem, self.remaining[sell_id])
            fills.append((sell_id, sell_price, traded))
            rem -= traded
            self.remaining[sell_id] -= traded
            if self.remaining[sell_id] == 0:
                heapq.heappop(self.sells)
                del self.remaining[sell_id]
        if rem > 0:
            heapq.heappush(self.buys, (-price, next(self._seq), order_id))
            self.remaining[order_id] = rem
        return fills

    def add_sell(self, order_id: int, price: float, qty: int) -> list[tuple[int, float, int]]:
        fills = []
        rem = qty
        while rem > 0 and self.buys and -self.buys[0][0] >= price:
            neg_price, _, buy_id = self.buys[0]
            traded = min(rem, self.remaining[buy_id])
            fills.append((buy_id, -neg_price, traded))
            rem -= traded
            self.remaining[buy_id] -= traded
            if self.remaining[buy_id] == 0:
                heapq.heappop(self.buys)
                del self.remaining[buy_id]
        if rem > 0:
            heapq.heappush(self.sells, (price, next(self._seq), order_id))
            self.remaining[order_id] = rem
        return fills

book = OrderBook()
book.add_sell(1, 101.0, 50)
book.add_sell(2, 101.0, 30)
print(book.add_buy(3, 101.0, 60))   # [(1, 101.0, 50), (2, 101.0, 10)]`,
    language: "python",
    complexity: { time: "O(log n) amortized per order", space: "O(n) resting orders" },
  },
];
