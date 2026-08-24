import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-24
// A max-heap two-heap median tracker for a rolling mid-price
// feed, a sliding-window problem bounding cumulative slippage
// budget, a buy-sell-with-limited-transactions DP variant, a
// Markov-chain probability problem for a random walk hitting a
// stop-loss before a take-profit, and a design problem for an
// LRU-based position/quote cache with capacity eviction.
// ============================================================

export const financeBatch20260824: LeetCodeProblem[] = [
  {
    id: "lc-rolling-median-midprice",
    title: "Rolling Median of a Streaming Mid-Price Feed",
    difficulty: "hard",
    topics: ["heap", "design"],
    problem:
      "Design a data structure that ingests a stream of mid-prices one tick at a time via add_price(price) and can report the median of all prices seen so far via get_median() in better than linear time per call, matching a common building block for a robust (outlier-resistant) real-time price-level estimator.",
    examples: [
      {
        input: "add_price(5), add_price(2), get_median(), add_price(9), get_median()",
        output: "3.5, 5.0",
        explanation:
          "After [5, 2] the sorted order is [2, 5], so the median of two values is their average, 3.5. After adding 9 the sorted order is [2, 5, 9], so the median is the single middle value, 5.0.",
      },
    ],
    constraints: ["1 <= number of add_price calls <= 10^5", "-10^6 <= price <= 10^6"],
    approach:
      "Maintain two heaps that split the stream at the median: a max-heap holding the smaller half of prices seen so far (so its top is the largest of the small half) and a min-heap holding the larger half (so its top is the smallest of the large half). On every insert, push into whichever heap is appropriate then rebalance by moving one element across if a heap's top value would violate the ordering invariant (max-heap's top must stay <= min-heap's top), and rebalance sizes so the two heaps never differ by more than one element. get_median then reads only the top(s) of the heaps: the larger heap's top if sizes differ, or the average of both tops if equal -- O(log n) per insert, O(1) per median query, versus O(n) per query if you resorted the whole stream every time.",
    code: `import heapq

class RollingMedian:
    def __init__(self):
        self.small = []   # max-heap (negated values): the smaller half
        self.large = []   # min-heap: the larger half

    def add_price(self, price: float) -> None:
        # push into small first, then always let one element cross over --
        # this keeps the cross-heap ordering invariant correct after every insert
        heapq.heappush(self.small, -price)
        heapq.heappush(self.large, -heapq.heappop(self.small))

        # rebalance sizes: small may lead large by at most one element
        if len(self.large) > len(self.small):
            heapq.heappush(self.small, -heapq.heappop(self.large))

    def get_median(self) -> float:
        if len(self.small) > len(self.large):
            return float(-self.small[0])
        return (-self.small[0] + self.large[0]) / 2.0

feed = RollingMedian()
for tick in (5, 2, 9, 1, 7):
    feed.add_price(tick)
print(feed.get_median())   # median of [1, 2, 5, 7, 9] -> 5.0`,
    language: "python",
    complexity: { time: "O(log n) per insert, O(1) per query", space: "O(n)" },
  },
  {
    id: "lc-longest-window-slippage-budget",
    title: "Longest Trading Window Within a Cumulative Slippage Budget",
    difficulty: "medium",
    topics: ["sliding-window", "prefix-sum"],
    problem:
      "Given the per-trade slippage cost (in bps, all non-negative) for a sequence of executed child orders and a total slippage budget, find the length of the longest contiguous run of trades whose slippage costs sum to at most the budget.",
    examples: [
      {
        input: "slippage=[2,1,4,3,1,2], budget=6",
        output: "3",
        explanation:
          "The window [4,3,1] no longer works (sums to 8 with 4+3, already over before adding 1), but [1,4] sums to 5 and extending to [1,4,3] sums to 8, over budget; the actual best window is [3,1,2] summing to 6, achieving length 3 -- checking all windows confirms no length-4 run stays within the budget of 6.",
      },
    ],
    constraints: ["1 <= number of trades <= 10^5", "0 <= slippage[i] <= 10^4", "0 <= budget <= 10^9"],
    approach:
      "Because every slippage cost is non-negative, the running sum over any window only grows as the window widens, which is exactly the monotonicity a two-pointer sliding window needs. Expand the right pointer one trade at a time, adding its cost to a running window sum; whenever that sum exceeds the budget, shrink from the left until it's back within budget. Track the best (right - left + 1) seen across the whole pass. This is the non-negative-array variant of the classic 'shortest/longest subarray with sum constraint' pattern, and it only works because costs can't be negative -- a negative slippage value (a price improvement) would break the monotonicity the shrink step relies on and require a different technique like a prefix-sum plus binary search or deque.",
    code: `def longest_window_within_budget(slippage: list[int], budget: int) -> int:
    left = 0
    window_sum = 0
    best = 0

    for right, cost in enumerate(slippage):
        window_sum += cost
        # non-negative costs guarantee window_sum only grows as right advances,
        # so shrinking from the left is always the correct move to restore validity
        while window_sum > budget:
            window_sum -= slippage[left]
            left += 1
        best = max(best, right - left + 1)

    return best

print(longest_window_within_budget([2, 1, 4, 3, 1, 2], budget=6))   # 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-stock-at-most-two-transactions",
    title: "Max Profit With At Most Two Round-Trip Transactions",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for one stock, find the maximum profit achievable using at most two non-overlapping buy-then-sell round trips (you must sell before you can buy again).",
    examples: [
      {
        input: "prices=[3,3,5,0,0,3,1,4]",
        output: "6",
        explanation:
          "Buy at 0 (day 3), sell at 3 (day 5) for a profit of 3, then buy at 1 (day 6), sell at 4 (day 7) for a profit of 3 -- two disjoint round trips totalling 6, more than any single round trip achieves on its own.",
      },
    ],
    constraints: ["1 <= number of days <= 10^5", "0 <= price <= 10^5"],
    approach:
      "Track four running states in a single left-to-right pass instead of searching over all ways to split the timeline into two windows: buy1 (max profit after first buy, i.e. negative cash spent), sell1 (max profit after closing the first round trip), buy2 (max profit after using sell1's proceeds to fund a second buy), and sell2 (max profit after closing the second round trip). Each state only ever improves (via max) using the PREVIOUS day's other states, so a single O(n) sweep correctly explores every possible placement and ordering of the two transactions without ever explicitly enumerating a split point.",
    code: `def max_profit_two_transactions(prices: list[int]) -> int:
    if not prices:
        return 0

    buy1 = -prices[0]      # max profit while holding after the 1st buy
    sell1 = 0               # max profit after closing the 1st round trip
    buy2 = -prices[0]      # max profit while holding after the 2nd buy
    sell2 = 0               # max profit after closing the 2nd round trip

    for price in prices[1:]:
        buy1 = max(buy1, -price)                 # cheapest possible 1st entry so far
        sell1 = max(sell1, buy1 + price)          # best 1st round trip so far
        buy2 = max(buy2, sell1 - price)           # fund the 2nd entry from 1st trip's proceeds
        sell2 = max(sell2, buy2 + price)          # best combined 2-trip profit so far

    return sell2

print(max_profit_two_transactions([3, 3, 5, 0, 0, 3, 1, 4]))   # 6`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-random-walk-hit-stop-before-target",
    title: "Probability a Random Walk Hits a Stop-Loss Before a Take-Profit",
    difficulty: "hard",
    topics: ["probability", "markov-chain", "dynamic-programming"],
    problem:
      "A position's mark-to-market P&L moves up by one tick with probability p or down by one tick with probability 1-p on each step, starting at 0. Given a stop-loss at -s ticks and a take-profit at +t ticks (both positive integers), compute the probability the stop-loss is hit before the take-profit.",
    examples: [
      {
        input: "p=0.5, s=3, t=5",
        output: "0.625",
        explanation:
          "With a fair coin this reduces to the classic gambler's ruin formula, which for p=0.5 gives simply t / (s + t) as the probability of hitting the stop first: 5 / (3 + 5) = 0.625.",
      },
    ],
    constraints: ["0 < p < 1", "1 <= s, t <= 500"],
    approach:
      "This is the gambler's ruin problem: model the P&L level as a Markov chain on integer states from -s to +t, with -s and +t absorbing. Let P(k) be the probability of hitting -s before +t starting from level k, shifted to a 0-indexed state i = k + s running from 0 to s+t (0 and s+t absorbing, 0 meaning 'already at the stop'). For p != 0.5 the closed form uses the ratio r = (1-p)/p: P(i) = (r^i - r^(s+t)) / (1 - r^(s+t)); for the symmetric p=0.5 case the walk has no drift and the formula degenerates to the simple linear ratio (s+t-i)/(s+t). Solving the underlying linear recurrence directly with dynamic programming (fill an array of s+t+1 states using P(i) = p*P(i+1) + (1-p)*P(i-1), boundary values P(0)=1, P(s+t)=0) reproduces the same answer and is the safer approach under interview time pressure since it sidesteps floating-point issues from r^i when r is very close to 1.",
    code: `def prob_hit_stop_first(p: float, s: int, t: int) -> float:
    n = s + t   # total number of ticks between the two absorbing barriers
    r = (1 - p) / p

    if abs(p - 0.5) < 1e-12:
        # symmetric walk has no closed-form ratio term (r == 1) -- degenerates
        # to a linear interpolation between the two barriers
        return t / n

    # closed-form gambler's ruin: probability of ruin (hitting 0, i.e. the
    # stop) starting from state s (s ticks away from the stop, t from target)
    return (r**s - r**n) / (1 - r**n)

print(round(prob_hit_stop_first(0.5, 3, 5), 4))    # 0.625
print(round(prob_hit_stop_first(0.55, 3, 5), 4))   # a slight upward drift lowers stop-first odds

def prob_hit_stop_first_dp(p: float, s: int, t: int) -> float:
    n = s + t
    P = [0.0] * (n + 1)
    P[0] = 1.0   # already at the stop-loss barrier -> certain "hit stop first"
    # iterate the linear system to convergence instead of solving it in closed form --
    # avoids r**i overflow/precision issues when r is extremely close to 1
    for _ in range(20_000):
        new_P = P[:]
        for i in range(1, n):
            new_P[i] = p * P[i + 1] + (1 - p) * P[i - 1]
        P = new_P
    return P[s]

print(round(prob_hit_stop_first_dp(0.5, 3, 5), 4))   # matches 0.625`,
    language: "python",
    complexity: { time: "O(1) closed form, O(n * iterations) DP", space: "O(1) closed form, O(n) DP" },
  },
  {
    id: "lc-lru-quote-cache",
    title: "Design an LRU Cache for Recent Instrument Quotes",
    difficulty: "medium",
    topics: ["design", "hash-map", "linked-list"],
    problem:
      "Design a fixed-capacity cache for the most recently accessed instrument quotes: get(symbol) returns the cached quote or -1 if absent (and marks it as recently used), and put(symbol, quote) inserts or updates a quote, evicting the least-recently-used symbol if the cache is at capacity. Both operations must run in O(1), matching the access pattern of a hot-path quote cache sitting in front of a slower reference-data lookup.",
    examples: [
      {
        input: "capacity=2; put(A,1), put(B,2), get(A), put(C,3), get(B), put(D,4), get(A), get(C), get(D)",
        output: "1, -1, -1, -1, 4",
        explanation:
          "get(A) after put(C,3) evicts B (least recently used at that point, since A was just touched by the get) is -1 as expected; put(D,4) then evicts A itself (least recently used after B was evicted and C, A were both touched, but A hasn't been touched since before C was inserted) making the final get(A) also -1, while C and D remain cached.",
      },
    ],
    constraints: ["1 <= capacity <= 10^4", "at most 10^5 total get/put calls"],
    approach:
      "Combine a hash map (symbol -> node) for O(1) lookup with a doubly linked list ordered by recency, so both get and put can move a node to the 'most recently used' end in O(1) without scanning. On get, if the symbol exists, splice its node out and re-insert it at the front, then return its value. On put, if the symbol already exists, update its value and move it to the front the same way; otherwise insert a new node at the front, and if that pushes the map over capacity, remove the node at the back of the list (the true least-recently-used entry) and delete it from the map too. Python's OrderedDict gives this exact behavior for free via move_to_end and popitem(last=False), which is the idiomatic way to implement this without hand-rolling the linked list.",
    code: `from collections import OrderedDict

class QuoteCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache: OrderedDict[str, float] = OrderedDict()  # insertion order == recency order

    def get(self, symbol: str) -> float:
        if symbol not in self.cache:
            return -1
        self.cache.move_to_end(symbol)   # mark as most-recently-used
        return self.cache[symbol]

    def put(self, symbol: str, quote: float) -> None:
        if symbol in self.cache:
            self.cache.move_to_end(symbol)
        self.cache[symbol] = quote
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)   # evict the true least-recently-used entry

cache = QuoteCache(capacity=2)
cache.put("A", 1); cache.put("B", 2)
print(cache.get("A"))       # 1 -- A is now most-recently-used
cache.put("C", 3)            # evicts B (least-recently-used)
print(cache.get("B"))       # -1
cache.put("D", 4)            # evicts A
print(cache.get("A"), cache.get("C"), cache.get("D"))   # -1 3 4 -- A was evicted, C and D remain`,
    language: "python",
    complexity: { time: "O(1) per get/put", space: "O(capacity)" },
  },
];
