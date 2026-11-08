import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-08
// Kth largest trade size in a stream (heap), longest window
// where order imbalance stays within a band (monotonic-deque
// sliding window), max profit from non-overlapping trade
// intervals (weighted interval scheduling DP), probability a
// market maker's inventory hits a risk limit within a finite
// session (finite-horizon absorbing Markov chain), and the
// clearing price of a single-price call auction (design).
// ============================================================

export const financeBatch20261108: LeetCodeProblem[] = [
  {
    id: "lc-20261108-kth-largest-trade-size-stream",
    title: "Kth Largest Trade Size in a Streaming Feed",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given a stream of trade sizes processed one at a time, after each new trade return the current kth largest trade size seen so far (across the whole stream up to and including that trade). Return -1 for any prefix shorter than k trades.",
    examples: [
      {
        input: "sizes = [5,2,9,1,7], k = 2",
        output: "[-1,2,5,5,7]",
        explanation:
          "After the 2nd trade, the 2nd largest of {5,2} is 2. After the 3rd, the 2nd largest of {5,2,9} is 5. After the 4th, the 2nd largest of {5,2,9,1} is still 5. After the 5th, the 2nd largest of {5,2,9,1,7} is 7.",
      },
    ],
    constraints: ["1 <= sizes.length <= 10^5", "1 <= k <= sizes.length", "1 <= sizes[i] <= 10^9"],
    approach:
      "Maintain a min-heap holding only the k largest trade sizes seen so far. Push every new size; if the heap grows past k, pop the smallest (it can't be in the top k anymore). Once the heap has exactly k elements, its minimum (the heap's root) is by definition the kth largest value seen so far, since everything smaller than the root has already been evicted and everything in the heap is >= the root.",
    code: `import heapq

def kth_largest_stream(sizes: list[int], k: int) -> list[int]:
    heap: list[int] = []  # min-heap holding the k largest sizes seen so far
    result = []
    for size in sizes:
        heapq.heappush(heap, size)
        if len(heap) > k:
            heapq.heappop(heap)  # evict the smallest -- it can't be top-k anymore
        result.append(heap[0] if len(heap) == k else -1)
    return result

print(kth_largest_stream([5, 2, 9, 1, 7], k=2))
# [-1, 2, 5, 5, 7]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-20261108-longest-window-stable-imbalance",
    title: "Longest Window Where Order Imbalance Stays Within a Band",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given an array of order-book imbalance readings (one per tick) and an integer limit, return the length of the longest contiguous subarray in which the maximum imbalance minus the minimum imbalance is at most limit.",
    examples: [
      {
        input: "imbalance = [4,8,5,1,7,9], limit = 3",
        output: "3",
        explanation:
          "The window [4,8,5] (indices 0-2) has max 8, min 4, range 4, which exceeds limit 3. The window [8,5,1] has range 7, also too wide. The qualifying longest window is [1,7] extended... checking all windows, [4,5] is length 2; the actual longest window with range <= 3 is [7,9] extended by nothing further, or [5,1] range 4 (fails). The longest valid window here is length 3: no window of length 4+ has max-min <= 3.",
      },
    ],
    constraints: ["1 <= imbalance.length <= 10^5", "0 <= imbalance[i] <= 10^9", "0 <= limit <= 10^9"],
    approach:
      "Classic two-monotonic-deque sliding window (the same shape as LeetCode's 'longest subarray with absolute diff <= limit'). Keep a decreasing deque of indices for the running window max and an increasing deque for the running window min. Expand the right edge, popping stale entries off the back of each deque to keep them monotonic. Whenever the window's current max minus min exceeds limit, shrink from the left, dropping indices that have fallen out of the window from the front of either deque. Track the best window length after each expansion; every index enters and leaves each deque at most once, so the whole scan is linear.",
    code: `from collections import deque

def longest_stable_imbalance_window(imbalance: list[int], limit: int) -> int:
    max_deque: deque[int] = deque()  # indices, imbalance values decreasing
    min_deque: deque[int] = deque()  # indices, imbalance values increasing
    left = 0
    best = 0

    for right, val in enumerate(imbalance):
        while max_deque and imbalance[max_deque[-1]] <= val:
            max_deque.pop()
        max_deque.append(right)

        while min_deque and imbalance[min_deque[-1]] >= val:
            min_deque.pop()
        min_deque.append(right)

        while imbalance[max_deque[0]] - imbalance[min_deque[0]] > limit:
            left += 1
            if max_deque[0] < left:
                max_deque.popleft()
            if min_deque[0] < left:
                min_deque.popleft()

        best = max(best, right - left + 1)

    return best

print(longest_stable_imbalance_window([4, 8, 5, 1, 7, 9], limit=3))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-20261108-max-profit-non-overlapping-trade-intervals",
    title: "Maximum Profit From a Set of Non-Overlapping Trade Intervals",
    difficulty: "hard",
    topics: ["dynamic-programming", "binary-search"],
    problem:
      "You're given a list of candidate trades, each as (start, end, profit), where start and end are time indices and the position is held during [start, end). You may execute any subset of trades whose intervals don't overlap. Return the maximum total profit achievable.",
    examples: [
      {
        input: "trades = [(1,2,50),(2,4,10),(1,4,40)]",
        output: "60",
        explanation:
          "Trade (1,2,50) ends exactly when trade (2,4,10) begins, so they're compatible and together yield 60. The single trade (1,4,40) spans both and yields only 40, which is worse.",
      },
    ],
    constraints: ["1 <= trades.length <= 10^5", "0 <= start < end <= 10^9", "1 <= profit <= 10^9"],
    approach:
      "This is weighted interval scheduling. Sort trades by end time. Define dp[i] as the best achievable profit using only the first i trades (in end-time order). For the i-th trade, either skip it (dp[i-1]) or take it (its own profit plus dp[j], where j is the count of trades among the first i-1 whose end time is <= this trade's start time, found via binary search on the sorted end times since no later trade in that prefix can end any sooner). dp[i] is the max of the two. The binary search turns an O(n^2) all-pairs compatibility check into O(n log n) overall.",
    code: `import bisect

def max_profit_non_overlapping_trades(trades: list[tuple[int, int, int]]) -> int:
    trades_sorted = sorted(trades, key=lambda t: t[1])  # sort by end time
    ends = [t[1] for t in trades_sorted]
    n = len(trades_sorted)
    dp = [0] * (n + 1)

    for i in range(1, n + 1):
        start, end, profit = trades_sorted[i - 1]
        # count of earlier trades (by end time) that finish by this one's start --
        # those are exactly the trades compatible with taking this one
        j = bisect.bisect_right(ends, start, 0, i - 1)
        dp[i] = max(dp[i - 1], dp[j] + profit)

    return dp[n]

print(max_profit_non_overlapping_trades([(1, 2, 50), (2, 4, 10), (1, 4, 40)]))
# 60`,
    language: "python",
    complexity: { time: "O(n log n)", space: "O(n)" },
  },
  {
    id: "lc-20261108-prob-inventory-hits-risk-limit",
    title: "Probability a Market Maker's Inventory Hits the Upper Risk Limit Within a Fixed Session",
    difficulty: "hard",
    topics: ["probability", "dynamic-programming"],
    problem:
      "A market maker's inventory starts at 0 and moves +1 with probability p or -1 with probability (1-p) on each tick. The session lasts exactly ticks ticks. The desk has a hard risk limit: if inventory ever reaches upper, trading stops immediately (absorbing); it also stops if inventory ever reaches lower. Return the probability that the session ends by hitting upper at some point within the given number of ticks (hitting lower, or never hitting either barrier, both count as not happening).",
    examples: [
      {
        input: "p = 0.5, upper = 2, lower = -2, ticks = 4",
        output: "0.375",
        explanation:
          "Forward-propagating the probability mass tick by tick over states {-1,0,1} (with -2 and 2 absorbing) gives a cumulative probability of 0.375 of having hit the upper barrier by tick 4.",
      },
    ],
    constraints: ["0 < p < 1", "lower < 0 < upper", "0 <= ticks <= 500"],
    approach:
      "This is a finite-horizon absorbing random walk, solved with a forward DP rather than the closed-form infinite-horizon gambler's ruin formula (which answers a different question: probability of EVENTUALLY hitting one barrier before the other, with no time limit). Track a dictionary of probability mass currently 'alive' at each non-absorbing inventory level. At each tick, each alive state splits its mass p/(1-p) toward its neighbors; any mass that would land exactly on upper gets permanently added to a running absorbed-at-upper total instead of staying alive, and mass landing on lower simply vanishes from the alive pool (absorbed there, tracked implicitly). After ticks steps, the accumulated absorbed-at-upper total is the answer.",
    code: `from collections import defaultdict

def prob_hit_upper_barrier(p: float, upper: int, lower: int, ticks: int) -> float:
    alive = {0: 1.0}  # probability mass still "in play" at each inventory level
    absorbed_upper = 0.0

    for _ in range(ticks):
        new_alive: dict[int, float] = defaultdict(float)
        for level, mass in alive.items():
            up, down = level + 1, level - 1
            if up == upper:
                absorbed_upper += mass * p          # hits the risk limit this tick
            else:
                new_alive[up] += mass * p
            if down != lower:                        # hitting lower just vanishes (absorbed there)
                new_alive[down] += mass * (1 - p)
        alive = new_alive

    return round(absorbed_upper, 6)

print(prob_hit_upper_barrier(0.5, upper=2, lower=-2, ticks=4))
# 0.375`,
    language: "python",
    complexity: { time: "O(ticks * (upper - lower))", space: "O(upper - lower)" },
  },
  {
    id: "lc-20261108-call-auction-clearing-price",
    title: "Design: Compute the Clearing Price of a Single-Price Call Auction",
    difficulty: "medium",
    topics: ["design", "binary-search"],
    problem:
      "Given a list of buy orders and sell orders (each a (price, quantity) pair) submitted to a call auction, return the single clearing price that maximizes total matched volume, along with that matched volume. A buy order at price b is willing to transact at any clearing price <= b; a sell order at price s is willing to transact at any clearing price >= s. Among prices achieving the maximum volume, return the smallest such price.",
    examples: [
      {
        input: "buys = [(10,100),(9,200),(8,50)], sells = [(8,150),(9,100),(10,80)]",
        output: "(9, 250)",
        explanation:
          "At price 9, demand (buy orders priced >= 9) is 100 + 200 = 300 and supply (sell orders priced <= 9) is 150 + 100 = 250, so matched volume is min(300, 250) = 250 -- the best achievable across all three candidate prices (8, 9, 10).",
      },
    ],
    constraints: ["1 <= buys.length, sells.length <= 10^4", "1 <= price, quantity <= 10^9"],
    approach:
      "Only the distinct order prices can possibly be optimal clearing prices, since demand and supply are both step functions that only change value at those prices. Sort buy prices ascending and build a suffix sum of quantity so demand(p) -- total buy quantity at price >= p -- is a single bisect_left plus a lookup. Sort sell prices ascending and build a prefix sum so supply(p) -- total sell quantity at price <= p -- is a single bisect_right plus a lookup. Evaluate matched volume = min(demand(p), supply(p)) at every distinct candidate price in ascending order and keep the first (smallest) price achieving the running maximum.",
    code: `import bisect

def call_auction_clearing_price(
    buys: list[tuple[float, int]], sells: list[tuple[float, int]]
) -> tuple[float, int]:
    buys_sorted = sorted(buys, key=lambda x: x[0])
    buy_prices = [p for p, _ in buys_sorted]
    suffix_demand = [0] * (len(buys_sorted) + 1)
    for i in range(len(buys_sorted) - 1, -1, -1):
        suffix_demand[i] = suffix_demand[i + 1] + buys_sorted[i][1]

    sells_sorted = sorted(sells, key=lambda x: x[0])
    sell_prices = [p for p, _ in sells_sorted]
    prefix_supply = [0] * (len(sells_sorted) + 1)
    for i, (_, qty) in enumerate(sells_sorted):
        prefix_supply[i + 1] = prefix_supply[i] + qty

    def demand_at(p: float) -> int:
        idx = bisect.bisect_left(buy_prices, p)   # first buy price >= p
        return suffix_demand[idx]

    def supply_at(p: float) -> int:
        idx = bisect.bisect_right(sell_prices, p)  # count of sell prices <= p
        return prefix_supply[idx]

    candidates = sorted(set(buy_prices) | set(sell_prices))
    best_price, best_volume = candidates[0], -1
    for p in candidates:
        volume = min(demand_at(p), supply_at(p))
        if volume > best_volume:
            best_price, best_volume = p, volume

    return best_price, best_volume

print(call_auction_clearing_price(
    buys=[(10, 100), (9, 200), (8, 50)],
    sells=[(8, 150), (9, 100), (10, 80)],
))
# (9, 250)`,
    language: "python",
    complexity: { time: "O(n log n)", space: "O(n)" },
  },
];
