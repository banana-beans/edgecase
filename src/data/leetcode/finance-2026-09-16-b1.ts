import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-16
// A bounded min-heap for a streaming top-K volatility query, a
// monotonic-deque sliding window for the longest range-bounded
// window, a weighted-interval-scheduling DP for non-overlapping
// trading windows, a closed-form gambler's-ruin probability
// (contrasted with duration from 09-15), and an average-cost-
// basis position tracker design problem.
// ============================================================

export const financeBatch20260916: LeetCodeProblem[] = [
  {
    id: "lc-20260916-topk-volatile-stream",
    title: "Top-K Most Volatile Tickers in a Streaming Feed",
    difficulty: "medium",
    topics: ["heap", "design"],
    problem:
      "Design a class that ingests (ticker, abs_return) pairs one at a time via update(ticker, abs_return), where abs_return replaces that ticker's previously stored value if it already has one. At any point, top_k() must return the k tickers with the largest current abs_return, in descending order, in better than O(n log n) time overall.",
    examples: [
      {
        input:
          "k=2; update('AAPL',0.02); update('TSLA',0.08); update('MSFT',0.01); top_k() -> ['TSLA','AAPL']; update('AAPL',0.10); top_k() -> ['AAPL','TSLA']",
        output: "the k largest current values, descending",
        explanation:
          "Re-updating AAPL to 0.10 replaces its old 0.02 value entirely -- it isn't a second entry -- and immediately changes the top-k ranking.",
      },
    ],
    constraints: ["up to 10^5 update calls", "1 <= k <= number of distinct tickers seen"],
    approach:
      "Keep a hashmap from ticker to its current abs_return as the source of truth (handles the 'replace, don't duplicate' requirement), plus a size-capped min-heap of (value, ticker) holding a candidate top-k set. On each update, push the new value; if the heap exceeds size k, pop its minimum, which is safe to discard AS A CANDIDATE only because we cross-check against the hashmap when reading it back out. Because a ticker's value can change after it's already in the heap, the heap can contain stale entries -- so top_k() lazily filters: pop entries whose heap-stored value doesn't match the hashmap's current value for that ticker (this ticker got updated since being pushed, so this heap entry is stale), keeping only fresh ones, until k valid entries remain or the heap empties. Each update is O(log n) for the heap push/pop; top_k amortizes the same bound since each stale entry is discarded at most once.",
    code: `import heapq

class TopKVolatility:
    def __init__(self, k: int):
        self.k = k
        self.current: dict[str, float] = {}      # ticker -> latest abs_return
        self.heap: list[tuple[float, str]] = []   # min-heap of (value, ticker), may go stale

    def update(self, ticker: str, abs_return: float) -> None:
        self.current[ticker] = abs_return
        heapq.heappush(self.heap, (abs_return, ticker))
        # cap heap growth so it never grows unbounded across many re-updates
        if len(self.heap) > 4 * max(self.k, 1):
            self._compact()

    def _compact(self) -> None:
        # rebuild the heap keeping only each ticker's freshest pushed entry
        fresh = [(v, t) for t, v in self.current.items()]
        heapq.heapify(fresh)
        self.heap = fresh

    def top_k(self) -> list[str]:
        seen: set[str] = set()
        result: list[tuple[float, str]] = []
        scratch = list(self.heap)
        heapq.heapify(scratch)
        while scratch and len(result) < self.k:
            value, ticker = heapq.heappop(scratch)
            # stale entry: this ticker has since been updated to a different value
            if ticker in seen or self.current.get(ticker) != value:
                continue
            seen.add(ticker)
            result.append((value, ticker))
        return [t for _, t in sorted(result, reverse=True)]

tk = TopKVolatility(k=2)
tk.update("AAPL", 0.02)
tk.update("TSLA", 0.08)
tk.update("MSFT", 0.01)
print(tk.top_k())          # ['TSLA', 'AAPL']
tk.update("AAPL", 0.10)
print(tk.top_k())          # ['AAPL', 'TSLA']`,
    language: "python",
    complexity: { time: "O(log n) per update, O(n) worst-case per top_k", space: "O(n)" },
  },
  {
    id: "lc-20260916-longest-bounded-range-window",
    title: "Longest Window Where the Price Stays Within a Volatility Band",
    difficulty: "medium",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given an array of daily prices and a band width limit, return the length of the longest contiguous window where max(window) - min(window) <= limit.",
    examples: [
      {
        input: "prices=[8,2,4,7], limit=4",
        output: "2",
        explanation:
          "[2,4] has range 2 (<=4). [4,7] has range 3 (<=4). Any 3-length window (e.g. [2,4,7], range 5, or [8,2,4], range 6) breaks the limit, so 2 is the longest valid window.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^9", "0 <= limit"],
    approach:
      "As the right pointer extends the window, the window's max and min are each monotonic in a specific sense that lets us track them in O(1) amortized time with two monotonic deques: a decreasing deque tracks candidates for the current max (pop from the back anything smaller than the incoming price, since it can never be the max again while the new price is in-window), and an increasing deque does the mirror for the min. Whenever the window's current max-min exceeds limit, shrink from the left, popping any deque-front index that has fallen out of the window. Because both deques only ever grow and shrink from their ends and every index is pushed and popped at most once, total work across the whole scan is O(n) despite the nested-looking left-pointer shrink.",
    code: `from collections import deque

def longest_bounded_window(prices: list[int], limit: int) -> int:
    max_deque: deque[int] = deque()   # indices, prices decreasing -- front is window max
    min_deque: deque[int] = deque()   # indices, prices increasing -- front is window min
    left = 0
    best = 0

    for right, price in enumerate(prices):
        # maintain decreasing deque: drop anything the new price makes irrelevant
        while max_deque and prices[max_deque[-1]] <= price:
            max_deque.pop()
        max_deque.append(right)

        while min_deque and prices[min_deque[-1]] >= price:
            min_deque.pop()
        min_deque.append(right)

        # shrink from the left while the band is violated
        while prices[max_deque[0]] - prices[min_deque[0]] > limit:
            left += 1
            if max_deque[0] < left:
                max_deque.popleft()
            if min_deque[0] < left:
                min_deque.popleft()

        best = max(best, right - left + 1)

    return best

print(longest_bounded_window([8, 2, 4, 7], 4))   # 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-20260916-nonoverlapping-trading-windows",
    title: "Maximum Profit From Non-Overlapping Trading Windows",
    difficulty: "hard",
    topics: ["dynamic-programming", "binary-search", "sorting"],
    problem:
      "You're given n candidate trading windows, each defined by (start_day, end_day, profit) -- a pre-computed profit you'd realize by holding a position from start_day to end_day. You may select any number of windows as long as no two selected windows overlap in time (end_day of one must be <= start_day of the next). Return the maximum total profit achievable.",
    examples: [
      {
        input: "windows=[(1,3,50),(2,5,20),(4,6,70),(6,8,60)]",
        output: "180",
        explanation:
          "Picking (1,3,50), (4,6,70), (6,8,60) gives 50+70+60=180. Window (4,6) ending exactly where (6,8) starts is allowed -- touching, not overlapping. (2,5,20) overlaps both (1,3) and (4,6), so including it instead of either would only lower the total.",
      },
    ],
    constraints: ["1 <= n <= 5*10^4", "1 <= start_day < end_day <= 10^9", "0 <= profit <= 10^4"],
    approach:
      "This is weighted interval scheduling. Sort windows by end_day. Define dp[i] as the best achievable profit using only the first i windows (in end-day order). For window i, either skip it (dp[i-1]) or take it, in which case add its profit to the best dp value among all windows whose end_day is <= this window's start_day -- found via binary search over the sorted end_days rather than a linear scan, since that predecessor set is a contiguous prefix once sorted. dp[i] = max(dp[i-1], profit_i + dp[p(i)]) where p(i) is the binary-searched predecessor index. This turns an apparently combinatorial choice among overlapping windows into O(n log n) total, dominated by the sort and n binary searches.",
    code: `from bisect import bisect_right

def max_profit_nonoverlapping(windows: list[tuple[int, int, int]]) -> int:
    windows = sorted(windows, key=lambda w: w[1])   # sort by end_day
    n = len(windows)
    end_days = [w[1] for w in windows]

    dp = [0] * (n + 1)   # dp[i] = best profit using first i windows (1-indexed)

    for i in range(1, n + 1):
        start, end, profit = windows[i - 1]
        # latest predecessor window whose end_day <= this window's start_day
        # bisect_right on end_days finds the count of windows ending at or before 'start'
        p = bisect_right(end_days, start, hi=i - 1)
        dp[i] = max(dp[i - 1], profit + dp[p])

    return dp[n]

print(max_profit_nonoverlapping([(1, 3, 50), (2, 5, 20), (4, 6, 70), (6, 8, 60)]))   # 180`,
    language: "python",
    complexity: { time: "O(n log n)", space: "O(n)" },
  },
  {
    id: "lc-20260916-gamblers-ruin-probability",
    title: "Probability of Hitting a Profit Target Before a Stop-Loss",
    difficulty: "medium",
    topics: ["probability", "markov-chain", "math"],
    problem:
      "A position's P&L, in whole ticks, starts at integer level s strictly between -n and +n. Each tick moves up by 1 with probability p and down by 1 with probability 1-p. A stop-loss at -n and a take-profit at +n both absorb (the process stops). Return the probability the process is absorbed at +n rather than -n.",
    examples: [
      {
        input: "n=3, s=0, p=0.5",
        output: "0.5",
        explanation:
          "A symmetric random walk starting exactly at the midpoint between two equidistant barriers hits either barrier with equal probability by the classic gambler's-ruin result.",
      },
      {
        input: "n=3, s=0, p=0.6",
        output: "0.6730",
        explanation:
          "With an upward drift (p > 0.5), the closed-form ratio-based formula applies instead of the symmetric 50/50 case.",
      },
    ],
    constraints: ["1 <= n <= 10^6", "-n < s < n", "0 < p < 1", "p may equal 0.5 exactly"],
    approach:
      "This is the classic gambler's-ruin PROBABILITY question, distinct from the expected-DURATION version (that one needs a tridiagonal linear solve; this one has a closed form). Shift coordinates so the walk runs from 0 to 2n with the start at s+n. For p != 0.5, let r = (1-p)/p; the probability of reaching the upper barrier first starting from position i is (1 - r^i) / (1 - r^(2n)) -- derived from solving the same first-step recursion P[i] = p*P[i+1] + (1-p)*P[i-1] but exploiting that its general solution is a linear combination of 1 and r^i, fixed by the two boundary conditions P[0]=0, P[2n]=1. For the symmetric p=0.5 case that formula is a 0/0 limit, so handle it separately with the simpler linear solution P[i] = i / (2n). Both branches are O(1) given n, s, p -- no iteration needed, unlike the duration problem.",
    code: `def ruin_probability(n: int, s: int, p: float) -> float:
    # shift to [0, 2n], start position i = s + n; barriers at 0 and 2n
    width = 2 * n
    i = s + n

    if abs(p - 0.5) < 1e-12:
        # symmetric case: the general log-linear solution degenerates to a
        # straight line, P[i] = i / width -- a separate closed form, not a
        # limit you want to evaluate numerically near r == 1
        return i / width

    r = (1 - p) / p
    # general solution of P[i] = p*P[i+1] + (1-p)*P[i-1] is A + B*r^i,
    # fixed by P[0] = 0 and P[width] = 1
    return (1 - r ** i) / (1 - r ** width)

print(round(ruin_probability(3, 0, 0.5), 4))    # 0.5
print(round(ruin_probability(3, 0, 0.6), 4))    # 0.6730`,
    language: "python",
    complexity: { time: "O(log width) for exponentiation, O(1) conceptually", space: "O(1)" },
  },
  {
    id: "lc-20260916-avg-cost-position-tracker",
    title: "Design a Position Tracker With Average Cost Basis",
    difficulty: "medium",
    topics: ["design", "math"],
    problem:
      "Design a class tracking a single instrument's position using average-cost accounting. buy(qty, price) increases the position and updates the average cost basis. sell(qty, price) reduces the position, realizes P&L on the sold quantity at (price - avg_cost), and does NOT change avg_cost for the remaining shares. Support realized_pnl(), unrealized_pnl(mark_price), and net_qty(). Selling more than the current position (going short past flat, or covering past flat from a short) must correctly reset or re-establish avg_cost for the new side.",
    examples: [
      {
        input: "buy(100,10); buy(100,20); sell(150,25)",
        output: "avg_cost after buys = 15.0; realized_pnl after sell = 1500.0; net_qty = 50",
        explanation:
          "Two buys of 100@10 and 100@20 give avg_cost (100*10+100*20)/200=15. Selling 150 at 25 realizes (25-15)*150=1500 profit and leaves 50 shares still at avg_cost 15.",
      },
    ],
    constraints: ["quantities and prices are positive", "position may go net short"],
    approach:
      "Average-cost accounting only needs two state variables: net_qty (signed, positive=long, negative=short) and avg_cost (meaningful only while net_qty != 0). A trade that ADDS to the current side (buy while long-or-flat, or sell while short-or-flat) blends into avg_cost via the weighted-average formula and never realizes P&L, since nothing is being closed. A trade that REDUCES the current side realizes (trade_price - avg_cost) times the closed quantity, signed appropriately for the side being closed, on the portion that fits within the existing position, and avg_cost is untouched for whatever position remains. The subtlety is a trade that closes the entire existing position AND opens a new position on the opposite side in one call (e.g. selling more than you're long) -- split it: close the existing qty at the old avg_cost (realizing P&L), then treat the remainder as a fresh trade establishing avg_cost on the new side from scratch.",
    code: `class PositionTracker:
    def __init__(self):
        self.net_qty = 0        # signed: + long, - short
        self.avg_cost = 0.0     # meaningful only while net_qty != 0
        self.realized = 0.0

    def _trade(self, signed_qty: float, price: float) -> None:
        # signed_qty > 0 for a buy, < 0 for a sell
        same_side = self.net_qty == 0 or (self.net_qty > 0) == (signed_qty > 0)

        if same_side:
            # adding to (or opening) the current side -- blend into avg_cost,
            # nothing is being closed so no P&L realized here
            new_qty = self.net_qty + signed_qty
            self.avg_cost = (
                (abs(self.net_qty) * self.avg_cost + abs(signed_qty) * price) / abs(new_qty)
                if new_qty != 0 else 0.0
            )
            self.net_qty = new_qty
            return

        # reducing (or flipping through) the current side
        closing_qty = min(abs(signed_qty), abs(self.net_qty))
        side_sign = 1 if self.net_qty > 0 else -1
        # P&L per closed unit: (price - avg_cost) if closing a long, mirrored if short
        self.realized += side_sign * (price - self.avg_cost) * closing_qty

        leftover = abs(signed_qty) - closing_qty
        self.net_qty += signed_qty if abs(signed_qty) <= abs(self.net_qty) else -self.net_qty
        if leftover > 0:
            # flipped through flat -- the remainder opens a brand-new position
            self.net_qty = leftover if signed_qty > 0 else -leftover
            self.avg_cost = price

    def buy(self, qty: float, price: float) -> None:
        self._trade(qty, price)

    def sell(self, qty: float, price: float) -> None:
        self._trade(-qty, price)

    def realized_pnl(self) -> float:
        return self.realized

    def unrealized_pnl(self, mark_price: float) -> float:
        return self.net_qty * (mark_price - self.avg_cost)

    def net_qty_(self) -> float:
        return self.net_qty

pt = PositionTracker()
pt.buy(100, 10)
pt.buy(100, 20)
pt.sell(150, 25)
print(pt.realized_pnl(), pt.net_qty_())   # 1500.0 50`,
    language: "python",
    complexity: { time: "O(1) per operation", space: "O(1)" },
  },
];
