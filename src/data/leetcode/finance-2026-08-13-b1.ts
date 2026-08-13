import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-13
// A k-pairs-with-smallest-sums heap problem, a min-window venue
// coverage problem, weighted interval scheduling for trade
// selection, a ballot-problem-style DP for path positivity,
// and a HIFO tax-lot position tracker.
// ============================================================

export const financeBatch20260813: LeetCodeProblem[] = [
  {
    id: "lc-k-smallest-cross-venue-costs",
    title: "K Smallest Combined Costs Pairing Two Venue Quote Lists",
    difficulty: "hard",
    topics: ["heap", "two-pointers"],
    problem:
      "You can hedge a position by pairing one quote from venue A's sorted ascending cost list with one quote from venue B's sorted ascending cost list; the combined cost of a pairing (i, j) is a[i] + b[j]. Return the k pairs with the smallest combined cost, without generating and sorting all len(a) * len(b) pairs.",
    examples: [
      {
        input: "a=[1,7,11], b=[2,4,6], k=3",
        output: "[(1,2), (1,4), (1,6)]",
        explanation:
          "Pairing a[0]=1 against b's three smallest quotes beats every pairing that uses a[1]=7 or a[2]=11, since a is sorted and 1 is its minimum -- those three dominate the k=3 smallest sums here.",
      },
    ],
    constraints: ["1 <= len(a), len(b) <= 10^5", "1 <= k <= len(a) * len(b)"],
    approach:
      "Generating all pairs is O(len(a) * len(b)), wasteful when k is small. Because both lists are pre-sorted, the smallest possible sum overall is always a[0] + b[0]. Seed a min-heap with the pairs (a[i] + b[0], i, 0) for every i up to min(k, len(a)) -- each of those is the best possible pairing for its row, so this seed set is guaranteed to contain the true global minimum. Then k times: pop the smallest sum, emit it, and push its successor in the same row, (a[i] + b[j+1], i, j+1), the next-best pairing available once column j in that row has been used. This 'advance one pointer at a time, guided by a heap instead of a nested loop' pattern is the standard k-smallest-pairs technique, and it only ever touches O(k) heap operations instead of materializing the full cross product.",
    code: `import heapq

def k_smallest_costs(a: list[int], b: list[int], k: int) -> list[tuple[int, int]]:
    if not a or not b or k <= 0:
        return []
    # seed: pairing each row i with column 0 -- b[0] is the best any row can do
    heap = [(a[i] + b[0], i, 0) for i in range(min(k, len(a)))]
    heapq.heapify(heap)
    result: list[tuple[int, int]] = []

    while heap and len(result) < k:
        s, i, j = heapq.heappop(heap)
        result.append((a[i], b[j]))
        if j + 1 < len(b):
            # next-best option in THIS row once column j is used up
            heapq.heappush(heap, (a[i] + b[j + 1], i, j + 1))

    return result`,
    language: "python",
    complexity: { time: "O(k log min(k, len(a)))", space: "O(k)" },
  },
  {
    id: "lc-min-window-all-venues-filled",
    title: "Smallest Trade Window Covering Every Required Venue",
    difficulty: "medium",
    topics: ["sliding-window", "hash-map"],
    problem:
      "You have a chronological list of fills, each tagged with the venue that executed it, and a set of required venues your smart-order-router must have touched at least once for a best-execution audit. Find the length of the shortest contiguous window of fills that includes at least one fill from every required venue. Return 0 if no such window exists.",
    examples: [
      {
        input: "venues=['A','B','A','C','B'], required={'A','B','C'}",
        output: "3",
        explanation:
          "The window [A,C,B] at indices 2-4 is the shortest containing all three required venues at least once; no window of length 2 can cover three distinct required venues.",
      },
    ],
    constraints: ["1 <= len(venues) <= 10^5", "1 <= len(required) <= 26"],
    approach:
      "This is the minimum-window-substring pattern applied to venues instead of characters: expand a window's right edge one fill at a time, tracking counts of required venues currently inside the window in a hash map plus a running count of how many DISTINCT required venues currently have count greater than zero. Once that distinct count equals the full required set, the window is valid, so try to shrink from the left as far as possible while it stays valid, recording the best (shortest) length at each fully-shrunk point. Each fill enters and leaves the window at most once across the whole scan, so the two pointers together do only O(n) total work despite the nested-looking while loop -- the classic amortized-linear two-pointer argument.",
    code: `from collections import defaultdict

def shortest_window_all_venues(venues: list[str], required: set[str]) -> int:
    if not required:
        return 0
    need = len(required)
    count: dict[str, int] = defaultdict(int)
    have = 0            # distinct required venues currently present (count > 0)
    left = 0
    best = float('inf')

    for right, v in enumerate(venues):
        if v in required:
            count[v] += 1
            if count[v] == 1:
                have += 1

        while have == need:                      # window is valid -- try to shrink
            best = min(best, right - left + 1)
            lv = venues[left]
            if lv in required:
                count[lv] -= 1
                if count[lv] == 0:
                    have -= 1                     # shrinking just broke validity
            left += 1

    return 0 if best == float('inf') else int(best)`,
    language: "python",
    complexity: { time: "O(n)", space: "O(len(required))" },
  },
  {
    id: "lc-weighted-trade-opportunity-scheduling",
    title: "Maximum Profit Selecting Non-Overlapping Trade Opportunities",
    difficulty: "hard",
    topics: ["dynamic-programming", "binary-search", "greedy"],
    problem:
      "You're given a list of trade opportunities, each with a start time, an end time (you hold the position for that whole window and cannot open another that overlaps it), and a profit. Choose a subset of non-overlapping opportunities that maximizes total profit. Two opportunities are non-overlapping if one ends at or before the other starts.",
    examples: [
      {
        input:
          "opportunities=[(1,3,50),(2,5,20),(4,6,70),(6,8,30)]",
        output: "150",
        explanation:
          "(4,6) ends at 6 and (6,8) starts at 6, so they're compatible: taking (1,3,50), then (4,6,70), then (6,8,30) totals 50+70+30=150, which beats every other combination -- picking greedily by highest profit first (start with (4,6,70)) can miss compatible follow-on opportunities like this, which is exactly why this needs DP, not a greedy profit-sort.",
      },
    ],
    constraints: ["1 <= len(opportunities) <= 10^5"],
    approach:
      "This is weighted interval scheduling, not the unweighted activity-selection problem greedy solves -- with profits attached, always picking the highest-profit or earliest-ending option first can be strictly wrong, so it needs DP. Sort opportunities by end time. Define dp[i] as the best achievable profit using only the first i opportunities in that sorted order. For opportunity i, either skip it (dp[i-1]) or take it (its profit plus dp[p(i)], where p(i) is the last opportunity that ends at or before opportunity i starts). Finding p(i) by linear scan is O(n) per item; since end times are sorted, binary search for the latest end time <= opportunity i's start time brings the total to O(n log n). This is the standard DP-plus-binary-search construction, and it strictly generalizes both plain interval scheduling (all profits equal) and the single-machine weighted job sequencing problem from operations research.",
    code: `import bisect

def max_profit_scheduling(opportunities: list[tuple[int, int, int]]) -> int:
    # sort by END time -- required for both the DP recurrence and the binary search
    opps = sorted(opportunities, key=lambda o: o[1])
    n = len(opps)
    ends = [o[1] for o in opps]
    dp = [0] * (n + 1)   # dp[i] = best profit using opps[0:i] (1-indexed prefix)

    for i in range(1, n + 1):
        start, end, profit = opps[i - 1]
        # latest opportunity whose end <= this one's start -- compatible predecessor
        p = bisect.bisect_right(ends, start, 0, i - 1)
        take = profit + dp[p]
        skip = dp[i - 1]
        dp[i] = max(take, skip)

    return dp[n]`,
    language: "python",
    complexity: { time: "O(n log n)", space: "O(n)" },
  },
  {
    id: "lc-pnl-path-never-negative",
    title: "Probability a P&L Path Never Goes Negative Over N Trades",
    difficulty: "hard",
    topics: ["probability", "dynamic-programming"],
    problem:
      "A trader's cumulative P&L moves by +1 tick with probability p and -1 tick with probability 1-p on each of n trades, starting at 0. Compute the probability that the cumulative P&L never goes strictly negative at any point across all n trades (it may touch exactly 0). Give an approach that works for a general p, not just p=0.5.",
    examples: [
      {
        input: "p=0.5, n=2",
        output: "0.5",
        explanation:
          "Four equally likely paths: ++  (never negative), +-  (touches 0, never negative), -+  (goes to -1, DOES go negative), --  (goes negative). Two of four paths stay non-negative throughout: probability 0.5.",
      },
    ],
    constraints: ["0 < p < 1", "1 <= n <= 2000"],
    approach:
      "For a general (possibly asymmetric) p, this is not a clean closed form the way the symmetric reflection-principle result is -- so build a DP directly over (step, current cumulative P&L) as the state. Let f(t, s) be the probability of being at cumulative value s after t trades WITHOUT ever having gone negative along the way. The recurrence only allows transitions that keep the running value non-negative: f(t, s) = p * f(t-1, s-1) [if s-1 >= 0] + (1-p) * f(t-1, s+1), with the base case f(0, 0) = 1. Answer is the sum of f(n, s) over all reachable non-negative s. The state space is O(n) values of s per step and n steps, giving O(n^2) time -- for the symmetric p=0.5 case this DP's final answer will match the classical reflection-principle formula exactly, which is a good correctness check to run against.",
    code: `def prob_path_never_negative(p: float, n: int) -> float:
    q = 1.0 - p
    # dp[s] = probability of being at cumulative value s after t steps,
    # having NEVER gone negative along the way. Offset s by n to index
    # a list, since cumulative value ranges from -n to n.
    dp = [0.0] * (2 * n + 1)
    dp[n] = 1.0          # start at value 0 (index n after the +n offset)

    for _t in range(n):
        new_dp = [0.0] * (2 * n + 1)
        for s in range(2 * n + 1):
            if dp[s] == 0.0:
                continue
            value = s - n
            # up-move: always allowed (never goes MORE negative)
            if s + 1 <= 2 * n:
                new_dp[s + 1] += dp[s] * p
            # down-move: only allowed if it does not cross below 0
            if value - 1 >= 0 and s - 1 >= 0:
                new_dp[s - 1] += dp[s] * q
        dp = new_dp

    return sum(dp)

print(round(prob_path_never_negative(0.5, 2), 4))    # 0.5, matches hand count
print(round(prob_path_never_negative(0.6, 10), 4))    # favorable drift raises it`,
    language: "python",
    complexity: { time: "O(n^2)", space: "O(n)" },
  },
  {
    id: "lc-design-hifo-tax-lot-tracker",
    title: "Design a HIFO (Highest-In-First-Out) Tax-Lot Position Tracker",
    difficulty: "medium",
    topics: ["design", "heap"],
    problem:
      "Design a tracker supporting buy(ticker, qty, price), which opens a new tax lot, and sell(ticker, qty), which closes lots using HIFO -- the highest-cost-basis lot is sold first, to minimize realized taxable gains (or maximize realized losses) each time. A sell may partially consume a lot and may span multiple lots. Return the list of (lot_price, qty_from_this_lot) consumed by the sell, in the order consumed.",
    examples: [
      {
        input:
          "buy('AAPL',100,150); buy('AAPL',50,180); buy('AAPL',30,160); sell('AAPL',60)",
        output: "[(180, 50), (160, 10)]",
        explanation:
          "HIFO sells the highest-cost lot first: the 180-cost lot (50 shares) is fully consumed first, then 10 more shares are needed, taken from the next-highest-cost lot at 160 -- the 150-cost lot is untouched, left for a later sell.",
      },
    ],
    approach:
      "FIFO and average-cost trackers only need a queue or a single running number; HIFO needs a max-heap keyed on cost basis, since every sell must find the currently-highest-cost lot regardless of when it was bought. Maintain one max-heap per ticker of (-price, lot_id, qty) so heap order directly gives highest-price-first, with lot_id as a tiebreaker for determinism among lots at an identical price. A sell repeatedly pops the top (highest-price) lot, consumes min(remaining sell qty, lot qty), pushes the lot back with reduced quantity if it wasn't fully consumed, and stops once the sell quantity is exhausted -- structurally the same repeated-pop-partial-consume-push-back loop as the order-book matching pattern, just keyed on cost basis instead of order price, and with the tax-optimization MOTIVATION (minimize realized gains) being the actual reason a real brokerage offers HIFO as a lot-selection method at all, distinct from FIFO's simplicity or average-cost's smoothing.",
    code: `import heapq
import itertools

class HifoTracker:
    def __init__(self):
        self._lot_id = itertools.count()
        self.lots: dict[str, list] = {}   # ticker -> max-heap of [-price, lot_id, qty]

    def buy(self, ticker: str, qty: int, price: float) -> None:
        heap = self.lots.setdefault(ticker, [])
        heapq.heappush(heap, [-price, next(self._lot_id), qty])

    def sell(self, ticker: str, qty: int) -> list[tuple[float, int]]:
        heap = self.lots.get(ticker, [])
        consumed: list[tuple[float, int]] = []
        remaining = qty

        while remaining > 0 and heap:
            lot = heap[0]                       # highest-cost lot: HIFO
            take = min(remaining, lot[2])
            consumed.append((-lot[0], take))     # un-negate for the reported price
            lot[2] -= take
            remaining -= take
            if lot[2] == 0:
                heapq.heappop(heap)               # lot fully consumed

        return consumed`,
    language: "python",
    complexity: { time: "O(log n) per lot touched", space: "O(number of open lots)" },
  },
];
