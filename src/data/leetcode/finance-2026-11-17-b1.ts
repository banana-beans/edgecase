import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-17
// Minimum execution venues to clear non-overlapping block orders
// (heap/greedy-interval), shortest order-flow window containing an
// exact required multiset of order types (sliding window with
// counts), max profit under a flat fee AND a hard cap on total
// shares traded (2D knapsack-style DP), expected trades until every
// one of K alpha signals has fired at least once (coupon collector
// probability), and an LFU cache for recently-quoted instruments.
// ============================================================

export const financeBatch20261117: LeetCodeProblem[] = [
  {
    id: "lc-20261117-min-venues-non-overlapping-blocks",
    title: "Minimum Number of Execution Venues to Clear Non-Overlapping Block Orders",
    difficulty: "medium",
    topics: ["heap", "greedy"],
    problem:
      "Given a list of block orders, each with a [start, end] execution time window, each venue can only work on one order at a time and an order must run start-to-end on a single venue without interruption. Return the minimum number of venues needed so every order gets executed.",
    examples: [
      {
        input: "orders = [[0, 30], [5, 10], [15, 20]]",
        output: "2",
        explanation:
          "[5, 10] and [15, 20] don't overlap each other, so they can share one venue back to back. [0, 30] overlaps both of them, so it needs a second venue.",
      },
    ],
    constraints: ["1 <= orders.length <= 10^5", "0 <= start < end <= 10^9"],
    approach:
      "Sort orders by start time, then walk through them while tracking the end times of all venues currently busy in a min-heap. For each new order, check the heap's smallest end time: if it is less than or equal to the new order's start, that venue has freed up, so pop it and reuse it (push the new end time back in). Otherwise no venue is free, so open a new one by pushing without popping. The heap size at the end is the number of venues that were ever needed simultaneously, since each push represents a venue slot and reuse only happens when the earliest-finishing venue has actually finished.",
    code: `import heapq


def min_venues(orders: list[list[int]]) -> int:
    orders.sort(key=lambda o: o[0])
    busy_until: list[int] = []  # min-heap of each open venue's current end time

    for start, end in orders:
        if busy_until and busy_until[0] <= start:
            heapq.heapreplace(busy_until, end)  # reuse the venue that just freed up
        else:
            heapq.heappush(busy_until, end)     # no free venue -- open a new one

    return len(busy_until)


print(min_venues([[0, 30], [5, 10], [15, 20]]))
# 2`,
    language: "python",
    complexity: { time: "O(n log n)", space: "O(n)" },
  },
  {
    id: "lc-20261117-shortest-window-exact-order-type-multiset",
    title: "Shortest Order-Flow Window Containing an Exact Required Multiset of Order Types",
    difficulty: "hard",
    topics: ["sliding-window"],
    problem:
      "Given a stream of order-type characters and a required multiset of counts (e.g. needing at least 2 'L' (limit), 1 'M' (market), 1 'C' (cancel) orders), return the length of the shortest contiguous window of the stream that contains at least that many of each required type. Return 0 if no such window exists.",
    examples: [
      {
        input: 'events = "LMLCLM", required = {"L": 2, "M": 1, "C": 1}',
        output: "4",
        explanation:
          'The window "LMLC" (indices 0-3) contains 2 L, 1 M, and 1 C -- exactly enough of each. No shorter window satisfies all three counts at once.',
      },
    ],
    constraints: ["1 <= events.length <= 10^5", "required has at most 26 distinct order-type keys"],
    approach:
      "This is the minimum-window-substring pattern, but matching on counts rather than just presence. Expand the window with a right pointer, keeping a running count of every type seen inside it, and a counter of how many required types currently have ENOUGH of their need satisfied. Once every required type is satisfied, repeatedly shrink from the left, recording the window length whenever it is a new best, and decrementing the satisfied counter the moment shrinking would drop a type below its required count. Each event index only ever moves the left or right pointer forward, so the whole scan is O(n) despite the apparent nested loop.",
    code: `from collections import Counter


def shortest_window_with_counts(events: str, required: dict[str, int]) -> int:
    need = Counter(required)
    have: Counter = Counter()
    satisfied = 0          # how many required types currently have enough
    best = float("inf")
    left = 0

    for right, ch in enumerate(events):
        if ch in need:
            have[ch] += 1
            if have[ch] == need[ch]:
                satisfied += 1

        while satisfied == len(need):
            best = min(best, right - left + 1)
            left_ch = events[left]
            if left_ch in need:
                if have[left_ch] == need[left_ch]:
                    satisfied -= 1  # shrinking would drop below the requirement
                have[left_ch] -= 1
            left += 1

    return 0 if best == float("inf") else int(best)


print(shortest_window_with_counts("LMLCLM", {"L": 2, "M": 1, "C": 1}))
# 4`,
    language: "python",
    complexity: { time: "O(n)", space: "O(k) for k required types" },
  },
  {
    id: "lc-20261117-max-profit-fee-and-share-cap",
    title: "Max Profit With a Flat Per-Trade Fee and a Hard Cap on Total Shares Traded",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for one instrument, a flat fee charged per round trip, and a hard budget on the TOTAL number of shares you may buy across the whole period (you trade exactly one share per transaction), choose which days to buy and sell on to maximize profit without exceeding the share budget.",
    examples: [
      {
        input: "prices = [3, 1, 4, 8, 2, 9], fee = 1, budget = 2",
        output: "10",
        explanation:
          "Buy at 1 (day 1), sell at 8 (day 3): profit 7 - 1 fee = 6, using 1 of the 2 share budget. Buy at 2 (day 4), sell at 9 (day 5): profit 7 - 1 fee = 6... but that would use both shares for a total of 12 minus 2 fees = 10. Buying at 1 and selling at 9 directly uses only 1 share for profit 8 - 1 = 7, worse than using both allowed round trips.",
      },
    ],
    constraints: ["1 <= prices.length <= 2000", "0 <= fee, prices[i] <= 10^4", "0 <= budget <= prices.length // 2"],
    approach:
      "This extends the classic buy-sell-with-fee DP with a second dimension for shares used so far. Track hold[j] = best profit while currently holding a share, having used j of the budget to buy it, and cash[j] = best profit while flat, having completed j round trips. Transitions per day: cash[j] can come from staying flat, or selling today from hold[j] (fee charged on the sell, same convention as the classic fee problem); hold[j] can come from staying held, or buying today from cash[j-1] (consuming one unit of budget). The answer is the best cash[j] over all j, since ending while still holding is never optimal when selling is free to consider.",
    code: `def max_profit_fee_and_cap(prices: list[int], fee: int, budget: int) -> int:
    n = len(prices)
    NEG_INF = float("-inf")
    # hold[j]: best profit currently holding one share, j buys used so far
    # cash[j]: best profit currently flat, j round trips completed so far
    hold = [NEG_INF] * (budget + 1)
    cash = [0] * (budget + 1)

    for price in prices:
        new_hold = hold[:]
        new_cash = cash[:]
        for j in range(budget + 1):
            if j > 0 and cash[j - 1] != NEG_INF:
                new_hold[j] = max(new_hold[j], cash[j - 1] - price)  # buy today
            if hold[j] != NEG_INF:
                new_cash[j] = max(new_cash[j], hold[j] + price - fee)  # sell today
        hold, cash = new_hold, new_cash

    return max(cash)


print(max_profit_fee_and_cap([3, 1, 4, 8, 2, 9], fee=1, budget=2))
# 10`,
    language: "python",
    complexity: { time: "O(n * budget)", space: "O(budget)" },
  },
  {
    id: "lc-20261117-coupon-collector-signal-coverage",
    title: "Expected Number of Trades Until a Desk Has Triggered Every One of K Alpha Signals",
    difficulty: "medium",
    topics: ["probability"],
    problem:
      "A desk's execution system fires exactly one of k equally likely alpha signal types on every trade, independently each time. Return the expected number of trades needed until every one of the k signal types has fired at least once.",
    examples: [
      {
        input: "k = 4",
        output: "8.3333",
        explanation:
          "This is the coupon collector's problem: the expected count is k * (1 + 1/2 + 1/3 + ... + 1/k) = 4 * (1 + 0.5 + 0.3333 + 0.25) = 4 * 2.0833 = 8.3333.",
      },
    ],
    constraints: ["1 <= k <= 10^4"],
    approach:
      "Decompose the wait into k stages: stage i starts right after you've seen the i-th distinct new signal type and ends when you see the (i+1)-th. While i types have already been seen, each new trade has probability (k - i) / k of producing a NEW type, so the number of trades needed to clear that stage is geometric with mean k / (k - i). Summing the expected length of each of the k stages (i from 0 to k-1) gives the classic harmonic-number result: k times the sum of 1/j for j from 1 to k. No simulation is needed -- it reduces to one harmonic sum, computed directly instead of accumulating k separate geometric means by hand.",
    code: `def expected_trades_to_cover_all_signals(k: int) -> float:
    if k == 0:
        return 0.0
    # stage i (0-indexed, i types already seen) is geometric with
    # success probability (k - i) / k, so its expected length is k / (k - i)
    harmonic_sum = sum(1.0 / j for j in range(1, k + 1))
    return k * harmonic_sum


print(round(expected_trades_to_cover_all_signals(4), 4))
# 8.3333`,
    language: "python",
    complexity: { time: "O(k)", space: "O(1)" },
  },
  {
    id: "lc-20261117-design-lfu-quote-cache",
    title: "Design an LFU Cache for Recently-Quoted Instrument Snapshots",
    difficulty: "hard",
    topics: ["design"],
    problem:
      "Design a cache with fixed capacity that stores the latest quote snapshot per instrument, supporting get(symbol) and put(symbol, quote). When the cache is full and a new symbol must be inserted, evict the LEAST FREQUENTLY accessed symbol; if there's a tie in access frequency, evict the least recently used among them. Both get and put count as an access.",
    examples: [
      {
        input: "capacity=2; put(A,q1); put(B,q2); get(A); put(C,q3); get(B); get(C)",
        output: "q1, None, q3",
        explanation:
          "get(A) bumps A's frequency above B's. Inserting C forces an eviction: A has freq 2, B has freq 1, so B (least frequent) is evicted, not A. get(B) then returns None, get(C) returns q3.",
      },
    ],
    constraints: ["up to 10^5 operations total", "capacity >= 1"],
    approach:
      "Keep three structures: a dict from symbol to (value, frequency), a dict from frequency to an OrderedDict of symbols currently at that frequency (ordered by recency within the frequency, giving LRU tie-breaking for free), and a running min_freq pointer. On every access, read the symbol's current frequency, remove it from that frequency's OrderedDict, bump the frequency by one, and re-insert it at the back of the new frequency's OrderedDict; if the old frequency's bucket is now empty and it was the min_freq, bump min_freq. On an eviction, pop the LEAST recently added entry (the front) from the min_freq bucket, which is the correct combined LFU-then-LRU victim in O(1).",
    code: `from collections import OrderedDict, defaultdict


class LFUQuoteCache:
    def __init__(self, capacity: int) -> None:
        self.capacity = capacity
        self.value: dict[str, object] = {}
        self.freq: dict[str, int] = {}
        self.buckets: dict[int, OrderedDict] = defaultdict(OrderedDict)  # freq -> {symbol: True}
        self.min_freq = 0

    def _touch(self, symbol: str) -> None:
        f = self.freq[symbol]
        del self.buckets[f][symbol]
        if not self.buckets[f] and f == self.min_freq:
            self.min_freq += 1
        self.freq[symbol] = f + 1
        self.buckets[f + 1][symbol] = True

    def get(self, symbol: str):
        if symbol not in self.value:
            return None
        self._touch(symbol)
        return self.value[symbol]

    def put(self, symbol: str, quote: object) -> None:
        if self.capacity == 0:
            return
        if symbol in self.value:
            self.value[symbol] = quote
            self._touch(symbol)
            return
        if len(self.value) >= self.capacity:
            victim, _ = self.buckets[self.min_freq].popitem(last=False)  # LRU within min freq
            del self.value[victim]
            del self.freq[victim]
        self.value[symbol] = quote
        self.freq[symbol] = 1
        self.buckets[1][symbol] = True
        self.min_freq = 1


cache = LFUQuoteCache(2)
cache.put("A", "q1")
cache.put("B", "q2")
cache.get("A")
cache.put("C", "q3")
print(cache.get("B"), cache.get("C"))
# None q3`,
    language: "python",
    complexity: { time: "O(1) per operation", space: "O(capacity)" },
  },
];
