import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-25
// A k-way heap merge of sorted price streams, a minimum-window
// substring variant for covering a required ticker set, a
// buy-sell-with-cooldown DP variant, an expected-value Markov
// chain problem for consecutive up-ticks, and a binary-search
// design problem for point-in-time price lookups.
// ============================================================

export const financeBatch20260825: LeetCodeProblem[] = [
  {
    id: "lc-merge-k-sorted-price-streams",
    title: "Merge K Sorted Price Streams into One Timeline",
    difficulty: "hard",
    topics: ["heap", "divide-and-conquer"],
    problem:
      "You receive k separate feeds of timestamped trade prints, each already sorted by timestamp internally (e.g. one feed per exchange reporting the same symbol). Merge all k feeds into a single globally time-sorted list of prints.",
    examples: [
      {
        input: "feeds = [[(1,100.1),(4,100.3)], [(2,100.2),(3,100.25)], [(5,100.4)]]",
        output: "[(1,100.1),(2,100.2),(3,100.25),(4,100.3),(5,100.4)]",
        explanation:
          "Each of the 3 feeds is already sorted by timestamp on its own; merging picks the globally smallest timestamp available across all feeds at every step, producing one fully sorted output.",
      },
    ],
    constraints: ["1 <= k <= 500", "1 <= total prints across all feeds <= 10^5"],
    approach:
      "This is the classic k-way merge, and a min-heap is the right structure because at every output step you only need the single smallest current-head element across k already-sorted lists, not a full sort of everything. Seed the heap with the first element of each feed (tagged with which feed and index it came from), then repeatedly pop the smallest, emit it, and push that feed's next element if one remains. Each of the n total elements is pushed and popped exactly once, and each heap operation costs O(log k) since the heap never holds more than k elements at a time -- O(n log k) total, versus O(n log n) for concatenating everything and sorting from scratch, which ignores that each feed individually is already sorted.",
    code: `import heapq

def merge_price_streams(feeds: list[list[tuple[int, float]]]) -> list[tuple[int, float]]:
    # heap entries: (timestamp, feed_index, position_in_feed) -- feed_index
    # breaks ties deterministically since tuples compare element-wise
    heap = [(feed[0][0], i, 0) for i, feed in enumerate(feeds) if feed]
    heapq.heapify(heap)

    merged = []
    while heap:
        ts, feed_i, pos = heapq.heappop(heap)
        merged.append(feeds[feed_i][pos])
        if pos + 1 < len(feeds[feed_i]):
            next_ts = feeds[feed_i][pos + 1][0]
            heapq.heappush(heap, (next_ts, feed_i, pos + 1))

    return merged

feeds = [[(1, 100.1), (4, 100.3)], [(2, 100.2), (3, 100.25)], [(5, 100.4)]]
print(merge_price_streams(feeds))
# [(1, 100.1), (2, 100.2), (3, 100.25), (4, 100.3), (5, 100.4)]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-min-window-required-tickers",
    title: "Minimum Window Covering a Required Set of Tickers",
    difficulty: "hard",
    topics: ["sliding-window", "hash-map"],
    problem:
      "Given a chronological list of ticker symbols printed by a trade feed and a required set of tickers a strategy needs a fresh quote for, find the shortest contiguous window of the print sequence that contains at least one print for every required ticker.",
    examples: [
      {
        input: 'prints=["AAPL","MSFT","AAPL","GOOG","MSFT"], required={"AAPL","GOOG","MSFT"}',
        output: "indices 2-4 (AAPL, GOOG, MSFT), length 3",
        explanation:
          "The window from index 2 to 4 (AAPL, GOOG, MSFT) is the shortest contiguous stretch containing all three required tickers at least once; no shorter window covers all three.",
      },
    ],
    constraints: ["1 <= number of prints <= 10^5", "1 <= size of required set <= number of distinct tickers"],
    approach:
      "This is the minimum-window-substring pattern applied to tickers instead of characters: expand a right pointer through the print sequence, tracking how many copies of each required ticker are in the current window with a hash map, plus a single counter for how many DISTINCT required tickers currently have at least one copy in the window. Once that counter reaches the full required-set size, the window is valid, so try shrinking from the left as far as possible while it stays valid, recording the shortest valid window seen. Each pointer only moves forward, so despite the nested-looking loop the whole scan is O(n) -- every print is added by the right pointer and removed by the left pointer at most once each.",
    code: `from collections import Counter

def min_window_covering(prints: list[str], required: set[str]) -> tuple[int, int] | None:
    need = Counter(required)          # each required ticker needed >=1 time
    window_counts = Counter()
    have = 0                          # distinct required tickers currently satisfied
    left = 0
    best = None                       # (length, left, right)

    for right, ticker in enumerate(prints):
        if ticker in need:
            window_counts[ticker] += 1
            if window_counts[ticker] == need[ticker]:
                have += 1

        # window covers everything required -- try to shrink from the left
        while have == len(need):
            if best is None or (right - left + 1) < best[0]:
                best = (right - left + 1, left, right)
            left_ticker = prints[left]
            if left_ticker in need:
                window_counts[left_ticker] -= 1
                if window_counts[left_ticker] < need[left_ticker]:
                    have -= 1
            left += 1

    return (best[1], best[2]) if best else None

prints = ["AAPL", "MSFT", "AAPL", "GOOG", "MSFT"]
print(min_window_covering(prints, {"AAPL", "GOOG", "MSFT"}))   # (2, 4)`,
    language: "python",
    complexity: { time: "O(n)", space: "O(size of required set)" },
  },
  {
    id: "lc-longest-increasing-signal-run",
    title: "Longest Increasing Subsequence of Daily Signal Scores",
    difficulty: "medium",
    topics: ["dynamic-programming", "binary-search"],
    problem:
      "Given a daily momentum-ranking score for one name over n days, find the length of the longest subsequence of days (not necessarily contiguous) on which the score is strictly increasing -- a proxy for the longest a trending regime persisted underneath the day-to-day noise.",
    examples: [
      {
        input: "scores=[3,1,4,1,5,9,2,6]",
        output: "4",
        explanation:
          "One longest strictly increasing subsequence is [1,4,5,9] (days 1,2,4,5), and no strictly increasing subsequence of length 5 exists in this array, so the answer is 4.",
      },
    ],
    constraints: ["1 <= number of days <= 10^5", "-10^9 <= score <= 10^9"],
    approach:
      "The O(n^2) DP -- best[i] = 1 + max(best[j] for j < i where scores[j] < scores[i]) -- is correct but too slow at 10^5 days, so reach for the O(n log n) patience-sorting formulation instead. Maintain a list 'tails' where tails[k] holds the smallest possible tail value of any strictly increasing subsequence of length k+1 seen so far; because tails is always sorted, for each new score you can binary-search for the leftmost position it can extend or replace: bisect_left finds the first tail >= score, so replacing that slot with score keeps every prefix's best tail as small as possible without ever shrinking the achievable length, which is exactly what preserves future extension opportunities. Only when the new score is larger than every current tail does the list actually grow, and the final length of tails is the answer -- tails itself is not a valid subsequence, only its length is meaningful.",
    code: `import bisect

def longest_increasing_run(scores: list[int]) -> int:
    tails: list[int] = []   # tails[k] = smallest tail value achievable for length k+1

    for score in scores:
        # leftmost tail >= score: replacing it keeps that length's tail
        # as small as possible, maximizing room for future extensions
        pos = bisect.bisect_left(tails, score)
        if pos == len(tails):
            tails.append(score)   # score extends the longest run seen so far
        else:
            tails[pos] = score    # score gives a strictly better (smaller) tail

    return len(tails)   # tails itself isn't the subsequence -- only its length matters

print(longest_increasing_run([3, 1, 4, 1, 5, 9, 2, 6]))   # 4 -- e.g. [1, 4, 5, 9]`,
    language: "python",
    complexity: { time: "O(n log n)", space: "O(n)" },
  },
  {
    id: "lc-expected-flips-three-uptick-streak",
    title: "Expected Number of Ticks Until Three Consecutive Up-Ticks",
    difficulty: "medium",
    topics: ["probability", "markov-chain"],
    problem:
      "A price moves up on each tick with probability p (independent of history) or down otherwise. Compute the expected number of ticks until you observe three consecutive up-ticks for the first time.",
    examples: [
      {
        input: "p=0.5",
        output: "14.0",
        explanation:
          "With a fair coin the expected number of flips to see 3 consecutive heads is the well-known closed form (2^(3+1) - 2) / (2 - 1) = 14 for p=0.5, matching the classic streak-waiting-time result.",
      },
    ],
    constraints: ["0 < p < 1"],
    approach:
      "Model this as a Markov chain on 4 states representing the length of the current up-tick streak: state 0 (no streak, or streak just broken), state 1 (one consecutive up-tick so far), state 2 (two consecutive up-ticks so far), and state 3, absorbing (three consecutive up-ticks reached). Let E[i] be the expected additional ticks needed starting from state i. From any non-absorbing state i, one more tick either advances the streak to i+1 with probability p, or breaks it back to state 0 with probability 1-p, giving the recurrence E[i] = 1 + p*E[i+1] + (1-p)*E[0], with E[3] = 0. This is 3 linear equations in E[0], E[1], E[2] that solve in closed form, and matches a simpler direct derivation: define E[0] as the answer and note E[1] = E[0] - 1/p relationships fall out of substitution -- but the cleanest general approach for an arbitrary target streak length is just solving the small linear system directly, which also generalizes immediately to 'k consecutive up-ticks' by extending the state count.",
    code: `import numpy as np

def expected_ticks_to_streak(p: float, streak_len: int = 3) -> float:
    # states 0..streak_len-1 are non-absorbing "current streak length so far";
    # state streak_len is absorbing (target streak reached). Solve
    # E[i] = 1 + p*E[i+1] + (1-p)*E[0]  for i = 0 .. streak_len-1, E[streak_len] = 0
    # as a linear system A @ E = b over the unknowns E[0..streak_len-1].
    n = streak_len
    A = np.zeros((n, n))
    b = np.full(n, -1.0)

    for i in range(n):
        A[i, i] += 1.0                 # E[i] term
        A[i, 0] -= (1 - p)             # -(1-p)*E[0] term (breaks streak back to 0)
        if i + 1 < n:
            A[i, i + 1] -= p           # -p*E[i+1] term (advances streak)
        # if i + 1 == n, E[i+1] = E[streak_len] = 0, contributes nothing to A

    E = np.linalg.solve(A, b)
    return E[0]

print(round(expected_ticks_to_streak(0.5, 3), 2))    # 14.0 -- matches the classic result
print(round(expected_ticks_to_streak(0.6, 3), 2))    # fewer expected ticks: upward drift helps`,
    language: "python",
    complexity: { time: "O(streak_len^3) to solve the linear system", space: "O(streak_len^2)" },
  },
  {
    id: "lc-time-based-price-store",
    title: "Design a Time-Based Price Store for Point-in-Time Lookups",
    difficulty: "medium",
    topics: ["design", "binary-search", "hash-map"],
    problem:
      "Design a store that records a ticker's price at a given timestamp via set(ticker, price, timestamp) (timestamps for a given ticker arrive in strictly increasing order) and answers get(ticker, timestamp) by returning the price at or most recently before that timestamp -- the price that was actually known as of that moment -- or -1 if no price exists for the ticker at or before it, matching a point-in-time price lookup.",
    examples: [
      {
        input:
          'set("AAPL",100,1); set("AAPL",102,3); set("AAPL",105,7); get("AAPL",5); get("AAPL",1); get("AAPL",0)',
        output: "102, 100, -1",
        explanation:
          "get(AAPL,5) falls between timestamps 3 and 7, so it returns the most recent price at or before 5, which is 102 from timestamp 3; get(AAPL,1) matches exactly; get(AAPL,0) precedes every recorded timestamp, so it returns -1.",
      },
    ],
    constraints: ["1 <= number of set/get calls <= 10^5", "timestamps for a given ticker are strictly increasing across set calls"],
    approach:
      "Store each ticker's (timestamp, price) pairs in a list kept in increasing timestamp order -- true for free, since set() is called with strictly increasing timestamps per ticker -- inside a hash map keyed by ticker. Because the list is already sorted, get() is a binary search for the rightmost timestamp <= the query, not a linear scan: exactly bisect_right's job, then step back one index. This mirrors point-in-time price lookups in a research pipeline directly -- you never want the value effective sometime later, only the latest one known as of the query moment, which is precisely what searching for the insertion point and stepping left encodes.",
    code: `import bisect

class TimePriceStore:
    def __init__(self):
        # ticker -> parallel lists of timestamps and prices, each strictly increasing
        self.timestamps: dict[str, list[int]] = {}
        self.prices: dict[str, list[float]] = {}

    def set(self, ticker: str, price: float, timestamp: int) -> None:
        self.timestamps.setdefault(ticker, []).append(timestamp)
        self.prices.setdefault(ticker, []).append(price)

    def get(self, ticker: str, timestamp: int) -> float:
        ts_list = self.timestamps.get(ticker)
        if not ts_list:
            return -1

        # rightmost index whose timestamp is <= the query -- the price
        # actually known as of that moment, never a later, not-yet-known one
        idx = bisect.bisect_right(ts_list, timestamp) - 1
        if idx < 0:
            return -1
        return self.prices[ticker][idx]

store = TimePriceStore()
store.set("AAPL", 100, 1)
store.set("AAPL", 102, 3)
store.set("AAPL", 105, 7)
print(store.get("AAPL", 5))   # 102 -- most recent price at or before timestamp 5
print(store.get("AAPL", 1))   # 100 -- exact match
print(store.get("AAPL", 0))   # -1 -- before any recorded price`,
    language: "python",
    complexity: { time: "O(1) amortized set, O(log n) get via binary search", space: "O(n)" },
  },
];