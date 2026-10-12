import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-12
// Smallest price range covering a quote from every venue (heap,
// LC632 shape), shortest tick window containing a trade in every
// basket symbol (sliding window, LC76 shape), max profit with at
// most two round-trip trades (DP stock variant, LC123 shape),
// majority-vote accuracy of independent signals (Condorcet Jury
// Theorem probability), and a point-in-time price cache with
// asof() lookups (design, binary search).
// ============================================================

export const financeBatch20261012: LeetCodeProblem[] = [
  {
    id: "lc-20261012-smallest-range-k-venue-prices",
    title: "Smallest Price Range Covering a Quote From Every Venue",
    difficulty: "hard",
    topics: ["heap"],
    problem:
      "Given K venues' sorted lists of distinct quoted prices seen during the day (each list sorted ascending), find the smallest price range [lo, hi] such that it contains at least one price from EVERY venue's list. This bounds how wide a price band you'd need to treat as 'the same price' across a fragmented, multi-venue market at any instant.",
    examples: [
      {
        input: "venues = [[4,10,15,24,26], [0,9,12,20], [5,18,22,30]]",
        output: "[20, 24]",
        explanation:
          "Picking 24 from venue A, 20 from venue B, and 22 from venue C gives the window [20,24], width 4; the heap-based scan proves no narrower window touches all three venues.",
      },
    ],
    constraints: ["1 <= venues.length <= 500", "1 <= venues[i].length", "each venue's list is sorted ascending"],
    approach:
      "Use a min-heap holding one pointer per venue, initialized at each list's first (smallest) element, while separately tracking the current max across all pointers. At every step, the current window [heap_min, current_max] already touches all k venues, since exactly one live pointer per venue sits in the heap at all times -- record it if narrower than the best seen so far. Then pop the global minimum and advance ONLY that venue's pointer to its next element, updating current_max if the new value is larger. Stop the moment any venue's list runs out, since no narrower window can cover all k venues past that point. Because current_max only moves up and exactly one entry is popped per step, the whole scan is O(n log k) across all n total prices.",
    code: `import heapq

def smallest_range_covering_all_venues(venues: list[list[int]]) -> list[int]:
    heap = []  # (price, venue_idx, position_in_that_venues_list)
    current_max = float("-inf")
    for v, prices in enumerate(venues):
        heapq.heappush(heap, (prices[0], v, 0))
        current_max = max(current_max, prices[0])

    best = [float("-inf"), float("inf")]
    while True:
        low, v, i = heapq.heappop(heap)
        if current_max - low < best[1] - best[0]:
            best = [low, current_max]
        if i + 1 == len(venues[v]):
            break  # this venue is exhausted -- no narrower window can cover all k venues
        nxt = venues[v][i + 1]
        current_max = max(current_max, nxt)
        heapq.heappush(heap, (nxt, v, i + 1))
    return best

print(smallest_range_covering_all_venues([[4, 10, 15, 24, 26], [0, 9, 12, 20], [5, 18, 22, 30]]))
# [20, 24]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
    leetcodeNumber: 632,
  },
  {
    id: "lc-20261012-min-window-all-required-symbols",
    title: "Shortest Tick Window Containing a Trade in Every Basket Symbol",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a tick-by-tick sequence of symbols traded (one per tick) and a required basket of distinct symbols, return the shortest contiguous window of ticks that contains at least one trade in EVERY symbol in the basket. Return an empty list if no such window exists.",
    examples: [
      {
        input: "ticks = ['AAPL','MSFT','AAPL','GOOG','MSFT'], basket = {'AAPL','GOOG'}",
        output: "['AAPL', 'GOOG']",
        explanation:
          "The window at indices 2-3 (AAPL, GOOG) has length 2 and covers the whole basket. No window of length 1 can, since no single tick trades both required symbols.",
      },
    ],
    constraints: ["1 <= ticks.length <= 10^5", "1 <= basket.length <= 26"],
    approach:
      "This is minimum-window-substring with a simpler stopping condition: you only need at least ONE occurrence of each required symbol in the window, not an exact multiset count. Advance the right pointer, incrementing a running count for any symbol that's in the basket, and track how many DISTINCT basket symbols currently have count >= 1. The moment that count equals the basket size, the window is fully covered, so shrink from the left -- recording the best (shortest) window seen -- until shrinking would drop a basket symbol's count to zero, which un-covers the window and ends the shrink. Both pointers only move forward over the whole scan, so the total work is O(n) despite the nested-looking shrink loop.",
    code: `from collections import defaultdict

def shortest_window_all_symbols(ticks: list[str], basket: set[str]) -> list[str]:
    need = len(basket)
    counts: dict[str, int] = defaultdict(int)
    have = 0
    left = 0
    best = None  # (length, left, right)

    for right, sym in enumerate(ticks):
        if sym in basket:
            counts[sym] += 1
            if counts[sym] == 1:
                have += 1

        # shrink while the window already covers the whole basket
        while have == need:
            if best is None or right - left + 1 < best[0]:
                best = (right - left + 1, left, right)
            left_sym = ticks[left]
            if left_sym in basket:
                counts[left_sym] -= 1
                if counts[left_sym] == 0:
                    have -= 1
            left += 1

    if best is None:
        return []
    _, lo, hi = best
    return ticks[lo : hi + 1]

print(shortest_window_all_symbols(["AAPL", "MSFT", "AAPL", "GOOG", "MSFT"], {"AAPL", "GOOG"}))
# ['AAPL', 'GOOG']`,
    language: "python",
    complexity: { time: "O(n)", space: "O(basket size)" },
    leetcodeNumber: 76,
  },
  {
    id: "lc-20261012-max-profit-at-most-two-transactions",
    title: "Maximum Profit With At Most Two Round-Trip Trades",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices, you may complete at most two buy-then-sell round trips, never holding more than one share at once (a sell must happen before the next buy). Return the maximum achievable profit.",
    examples: [
      {
        input: "prices = [3, 3, 5, 0, 0, 3, 1, 4]",
        output: "6",
        explanation:
          "Buy at 0, sell at 3 (profit 3), then buy at 1, sell at 4 (profit 3). Two round trips, total profit 3 + 3 = 6 -- the best achievable with at most two transactions.",
      },
    ],
    constraints: ["0 <= prices.length <= 10^5", "0 <= prices[i] <= 10^5"],
    approach:
      "This is the k=2 special case of the general at-most-k-transactions DP, but it's worth deriving directly because it collapses to four running scalars instead of an array: buy1, the best running 'cost basis' (most negative spent) for the first trade; sell1, the best profit after closing the first trade; buy2, the best profit after funding a second buy out of sell1's realized profit; sell2, the best profit after closing the second trade. Each day, update all four in order from buy1 to sell2 -- the order matters, since sell1 must use TODAY's updated buy1, and buy2 must use TODAY's updated sell1, chaining the two round trips together in a single O(1)-space pass.",
    code: `def max_profit_two_transactions(prices: list[int]) -> int:
    buy1 = buy2 = float("-inf")
    sell1 = sell2 = 0

    for price in prices:
        buy1 = max(buy1, -price)          # cheapest cost basis for trade 1 so far
        sell1 = max(sell1, buy1 + price)   # best profit after closing trade 1
        buy2 = max(buy2, sell1 - price)    # trade 2 funded by trade 1's realized profit
        sell2 = max(sell2, buy2 + price)   # best profit after closing trade 2

    return sell2

print(max_profit_two_transactions([3, 3, 5, 0, 0, 3, 1, 4]))
# 6`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 123,
  },
  {
    id: "lc-20261012-majority-vote-signal-accuracy",
    title: "Majority-Vote Accuracy of N Independent Trading Signals (Condorcet Jury Theorem)",
    difficulty: "medium",
    topics: ["probability"],
    problem:
      "You have n independent trading signals (n odd), each correct about tomorrow's direction with the same probability p > 0.5. You combine them by majority vote. Return the probability that the majority vote is correct.",
    examples: [
      {
        input: "n = 5, p = 0.6",
        output: "0.6826",
        explanation:
          "P(majority correct) = P(at least 3 of 5 correct) under Binomial(5, 0.6), which works out to about 68.3% -- noticeably higher than any single signal's own 60% accuracy.",
      },
    ],
    constraints: ["n is a positive odd integer", "0.5 < p <= 1"],
    approach:
      "The majority is correct exactly when MORE than n/2 of the n independent signals are correct, which is the upper tail of a Binomial(n, p) distribution evaluated above the threshold n//2. Rather than summing binomial coefficients by hand (fine for intuition, but numerically fragile for larger n), use a library's stable survival function: P(majority correct) = P(X > n//2) for X ~ Binomial(n, p). The result you should be able to say out loud is the Condorcet Jury Theorem itself -- as n grows, majority-vote accuracy converges to 1 whenever each individual signal only needs to beat a coin flip, which is exactly why ensembling many weak, genuinely INDEPENDENT signals works, and why correlated signals (which quietly violate that independence assumption) don't get this benefit for free.",
    code: `from scipy.stats import binom

def majority_vote_accuracy(n: int, p: float) -> float:
    # majority needs MORE than n/2 correct; for odd n that's at least n//2 + 1
    threshold = n // 2
    return float(binom.sf(threshold, n, p))   # P(X > threshold) for X ~ Binomial(n, p)

print(round(majority_vote_accuracy(5, 0.6), 4))
# 0.6826 -- majority vote (68.3%) beats any single signal's own 60% accuracy`,
    language: "python",
    complexity: { time: "O(1) via a stable binomial tail", space: "O(1)" },
  },
  {
    id: "lc-20261012-design-point-in-time-price-cache",
    title: "Design a Point-in-Time Price Cache With asof(timestamp) Lookups",
    difficulty: "medium",
    topics: ["design", "binary-search"],
    problem:
      "Design a class PITPriceCache supporting record(timestamp, price), appending a new observation (timestamps arrive in non-decreasing order), and asof(query_timestamp), which returns the most recent recorded price at or before query_timestamp, or None if no such observation exists yet. This is the lookup primitive behind any point-in-time join: 'what did we know as of this moment.'",
    examples: [
      {
        input: "cache=PITPriceCache(); cache.record(10,100.0); cache.record(20,101.5); cache.record(35,99.0); cache.asof(25)",
        output: "101.5",
        explanation:
          "At query time 25, the most recent recorded observation at or before it is the one recorded at timestamp 20 (price 101.5); the one at 35 hasn't happened yet as of t=25.",
      },
    ],
    constraints: ["timestamps passed to record are non-decreasing across calls", "up to 10^6 total calls"],
    approach:
      "Since timestamps arrive non-decreasing, an append-only pair of parallel lists stays sorted for free, with no need to re-sort on every record(). A query asof(t) needs the LAST timestamp <= t, which is exactly what bisect_right(timestamps, t) - 1 gives: the insertion point for t among the existing timestamps, minus one, lands on the index of the greatest timestamp not exceeding t. If that index is -1, nothing was recorded at or before t yet, so return None. record() is O(1) amortized and asof() is O(log n), which is the right tradeoff since a real PIT cache answers asof() far more often than it appends.",
    code: `import bisect

class PITPriceCache:
    def __init__(self):
        self.timestamps: list[int] = []
        self.prices: list[float] = []

    def record(self, timestamp: int, price: float) -> None:
        # timestamps arrive non-decreasing -- a plain append keeps sort order
        self.timestamps.append(timestamp)
        self.prices.append(price)

    def asof(self, query_timestamp: int):
        # last index whose timestamp is <= query_timestamp
        idx = bisect.bisect_right(self.timestamps, query_timestamp) - 1
        return self.prices[idx] if idx >= 0 else None

cache = PITPriceCache()
cache.record(10, 100.0)
cache.record(20, 101.5)
cache.record(35, 99.0)
print(cache.asof(25))   # 101.5 -- the most recent price known AS OF t=25
print(cache.asof(5))    # None -- nothing had been recorded yet`,
    language: "python",
    complexity: { time: "O(1) amortized record, O(log n) asof", space: "O(n)" },
  },
];
