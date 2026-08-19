import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-19
// A capped min-heap for a streaming grid-search top-k, a
// two-pointer "high-water mark" drawdown-recovery scan, a
// calendar-partitioned single-transaction DP, an absorbing
// Markov chain expected-time-to-default problem, and a
// deque-based rolling circuit-breaker design problem.
// ============================================================

export const financeBatch20260819: LeetCodeProblem[] = [
  {
    id: "lc-topk-sharpe-grid-search",
    title: "K Best Sharpe Ratios From a Streaming Backtest Grid Search",
    difficulty: "easy",
    topics: ["heap"],
    problem:
      "A grid search streams in (param_id, sharpe) pairs one at a time from parallel backtest workers -- you don't know the total count in advance and can't hold them all in memory. Maintain the k best (param_id, sharpe) pairs seen so far and support returning them, sorted by Sharpe descending, at any point.",
    examples: [
      {
        input: "k=2, stream=[(1,0.8),(2,1.9),(3,1.2),(4,2.1),(5,0.5)]",
        output: "[(4,2.1),(2,1.9)]",
        explanation:
          "After streaming all five results, the two highest Sharpes seen are param 4 (2.1) and param 2 (1.9); the rest never displaced them from the size-2 heap.",
      },
    ],
    constraints: ["1 <= k", "results arrive one at a time, total count unknown in advance"],
    approach:
      "Same shape as the 'k largest' pattern but as a streaming/online structure rather than a batch: maintain a min-heap capped at size k, keyed on Sharpe. Each incoming (param_id, sharpe) either fills the heap (while under capacity) or, once full, only gets pushed if its Sharpe beats the current worst-of-the-best (the heap's root), evicting the old worst via heapreplace. This keeps O(log k) work per incoming result regardless of how many total results stream in, and O(k) memory instead of O(n), which matters when a grid search can produce far more parameter combinations than fit comfortably in memory. A snapshot of the current best-k is just sorting the k-sized heap on demand.",
    code: `import heapq

class TopKSharpeTracker:
    def __init__(self, k: int):
        self.k = k
        self.heap: list[tuple[float, int]] = []   # (sharpe, param_id), min-heap on sharpe

    def add_result(self, param_id: int, sharpe: float) -> None:
        if len(self.heap) < self.k:
            heapq.heappush(self.heap, (sharpe, param_id))
        elif sharpe > self.heap[0][0]:
            heapq.heapreplace(self.heap, (sharpe, param_id))

    def best_k(self) -> list[tuple[int, float]]:
        # snapshot, sorted descending by sharpe -- cheap since only k elements
        return [(pid, sh) for sh, pid in sorted(self.heap, reverse=True)]`,
    language: "python",
    complexity: {
      time: "O(log k) per add_result, O(k log k) per best_k snapshot",
      space: "O(k)",
    },
  },
  {
    id: "lc-min-days-recoup-drawdown",
    title: "Minimum Trading Days to Recoup Every Drawdown",
    difficulty: "medium",
    topics: ["sliding-window", "two-pointer"],
    problem:
      "Given a daily price series, define a drawdown episode as starting at each new running-maximum (peak) and ending on the first later day where price recovers to at least that peak level. Return the length, in trading days, of the LONGEST such episode. A final peak that is never recovered by the last day does not count.",
    examples: [
      {
        input: "prices=[100,90,80,85,95,105,70,72,110]",
        output: "5",
        explanation:
          "The peak of 100 set on day 0 isn't recovered until day 5 (price 105) -- a 5-day episode. That day 5 peak of 105 is then recovered on day 8 (price 110) -- only a 3-day episode. The longest is 5.",
      },
    ],
    constraints: ["1 <= len(prices) <= 10^5"],
    approach:
      "This is the two-pointer/high-water-mark pattern: maintain a single anchor (peak value, peak index) rather than tracking every historical peak independently, since only the CURRENT running peak's recovery time can still be accumulating -- any earlier peak already recovered is closed, and any earlier peak not yet recovered is dominated by (contained within) the current running peak's still-open episode, because running peaks only increase. One linear pass suffices: whenever price closes the current episode (reaches or exceeds the anchor), record the elapsed days as a candidate answer, then re-anchor at that day, since a fresh drawdown episode can start from this new high-water mark. A final open episode that never recovers by the last day simply never gets recorded, matching the problem's definition.",
    code: `def max_drawdown_recovery_days(prices: list[float]) -> int:
    if not prices:
        return 0
    peak = prices[0]
    peak_idx = 0
    max_days = 0

    for i in range(1, len(prices)):
        if prices[i] >= peak:
            # closes the CURRENT episode -- earlier unresolved peaks are
            # already dominated by this one, since running peaks only increase
            max_days = max(max_days, i - peak_idx)
            peak, peak_idx = prices[i], i   # re-anchor: a fresh episode can start here
        # else: still underwater, the open episode keeps accumulating implicitly

    return max_days`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-max-profit-one-txn-per-month",
    title: "Maximum Profit With At Most One Buy-Sell Pair Per Calendar Month",
    difficulty: "medium",
    topics: ["dynamic-programming", "greedy"],
    problem:
      "Given daily prices each tagged with a (year, month) label, and the constraint that you may complete at most one buy-then-sell round trip within each calendar month (a position must be closed by month end, never carried across months), return the maximum total profit.",
    examples: [
      {
        input: "prices=[10,12,8,15], months=['2026-01','2026-01','2026-02','2026-02']",
        output: "9",
        explanation:
          "January: buy at 10, sell at 12, profit 2 -- the best single transaction within Jan's [10,12]. February: buy at 8, sell at 15, profit 7. Total 2+7=9, each month solved independently as its own single-transaction subproblem.",
      },
    ],
    constraints: ["1 <= len(prices) <= 10^5", "months is non-decreasing (data arrives in chronological order)"],
    approach:
      "Because a position must close by month end, the problem decomposes cleanly: partition the series into contiguous runs sharing the same month label, and within EACH partition independently solve the classic single-transaction 'best time to buy and sell stock' problem (track the running minimum price seen so far in that month, and the best profit selling at each day against that running minimum), then sum the best profit across all months. No DP state carries across month boundaries at all -- the calendar constraint turns what could be a harder multi-period DP into n independent, cheap linear-scan subproblems, and months already arriving in chronological order means the partition itself is a single linear pass with no sorting or grouping overhead.",
    code: `def max_profit_per_month(prices: list[float], months: list[str]) -> float:
    total = 0.0
    i = 0
    n = len(prices)

    while i < n:
        j = i
        while j < n and months[j] == months[i]:   # find this month's contiguous run
            j += 1

        # classic single-transaction problem, solved independently on prices[i:j]
        running_min = prices[i]
        best_this_month = 0.0
        for p in prices[i:j]:
            running_min = min(running_min, p)
            best_this_month = max(best_this_month, p - running_min)

        total += best_this_month
        i = j   # advance to the next month's run

    return total`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1) excluding the output" },
  },
  {
    id: "lc-credit-rating-absorption-time",
    title: "Expected Time to Default in a Credit Rating Markov Chain",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "A bond issuer's credit rating transitions each year between three states: Investment Grade (IG), High Yield (HY), and Default (an absorbing state -- once entered, it is never left). Given the one-year transition probabilities among the transient states, compute the expected number of years until default for an issuer currently in each of IG and HY.",
    examples: [
      {
        input:
          "Q (transient-to-transient) = {IG: {IG:0.90, HY:0.08}, HY: {IG:0.10, HY:0.75}} (remainder of each row goes to Default)",
        output: "{IG: 19.41, HY: 11.76}",
        explanation:
          "Solving t_IG = 1 + 0.90*t_IG + 0.08*t_HY and t_HY = 1 + 0.10*t_IG + 0.75*t_HY gives t_IG ~= 19.41 and t_HY ~= 11.76 -- HY defaults sooner on average despite occasionally upgrading, since its direct default probability each year is much higher.",
      },
    ],
    constraints: [
      "transition probabilities from each transient state sum to 1 across all three states",
      "Default is absorbing: P[Default][Default] = 1",
    ],
    approach:
      "This is the fundamental-matrix technique for absorbing Markov chains. Restrict the transition matrix to just the transient (non-absorbing) states -- here IG and HY -- call that sub-matrix Q. The fundamental matrix N = (I - Q)^-1 has a clean interpretation: entry N[i][j] is the expected number of years spent in transient state j before absorption, given the chain starts in transient state i. Summing each ROW of N gives the expected total years until absorption (default) starting from that state, since it's the expected time spent across ALL transient states before falling into the absorbing one. This turns a recursive expected-value system (which you could also set up directly, e.g. t_IG = 1 + 0.90*t_IG + 0.08*t_HY, and solve by substitution) into one matrix inversion -- the same answer, but the fundamental-matrix formulation generalizes cleanly to many transient states where hand-deriving the linear system gets unwieldy.",
    code: `import numpy as np

def expected_years_to_default(transient_states: list[str], q_matrix: list[list[float]]):
    Q = np.array(q_matrix)                    # transition probs AMONG transient states only
    n = len(transient_states)
    N = np.linalg.inv(np.eye(n) - Q)           # the fundamental matrix
    expected_total = N.sum(axis=1)             # row sums: total expected time to absorption

    return dict(zip(transient_states, expected_total))

# IG, HY transition probabilities restricted to the transient (non-Default) states
states = ["IG", "HY"]
Q = [
    [0.90, 0.08],   # from IG: to IG, to HY (remaining 0.02 goes to Default, omitted from Q)
    [0.10, 0.75],   # from HY: to IG, to HY (remaining 0.15 goes to Default, omitted from Q)
]
print(expected_years_to_default(states, Q))   # {'IG': ~19.41, 'HY': ~11.76}`,
    language: "python",
    complexity: {
      time: "O(n^3) for the matrix inversion (n = number of transient states)",
      space: "O(n^2)",
    },
  },
  {
    id: "lc-design-circuit-breaker-tracker",
    title: "Design a Rolling-Window Circuit Breaker Trigger",
    difficulty: "medium",
    topics: ["design", "sliding-window"],
    problem:
      "Design a class supporting add_price(timestamp, price), which records a new tick, and is_triggered(), which returns True if price has moved by more than a threshold percentage relative to the earliest tick still within the trailing window_seconds -- a simplified single-stock circuit breaker.",
    examples: [
      {
        input:
          "threshold=0.07, window_seconds=300; add ticks at t=0 price=100, t=120 price=103, t=310 price=91; call is_triggered() after each add",
        output: "False, False, True",
        explanation:
          "At t=310, the oldest tick still within the 300-second window is (t=120, price=103) since t=0 has aged out; 91 vs 103 is a -11.7% move, past the 7% threshold, so is_triggered() returns True. At t=120 the only reference is t=0 (103 vs 100, +3%), under threshold.",
      },
    ],
    approach:
      "The core requirement is maintaining exactly the ticks within a trailing time window and cheaply accessing both ends of it -- classic deque-over-time territory, but here the breaker needs the OLDEST surviving tick specifically as its reference point, not an aggregate over the window. A plain deque of (timestamp, price) works: on every add_price, first evict from the left any ticks older than timestamp - window_seconds, then append the new tick to the right. is_triggered() just compares the newest (rightmost) price against the oldest (leftmost) surviving price -- both O(1) deque accesses. Eviction is amortized O(1) per tick since each tick is pushed and popped at most once over the object's lifetime, even though a single add_price call can evict several stale ticks at once.",
    code: `from collections import deque

class CircuitBreakerTracker:
    def __init__(self, threshold: float, window_seconds: float):
        self.threshold = threshold
        self.window = window_seconds
        self.ticks: deque[tuple[float, float]] = deque()   # (timestamp, price)

    def add_price(self, timestamp: float, price: float) -> None:
        self.ticks.append((timestamp, price))
        # evict anything older than the trailing window -- amortized O(1) per tick
        while self.ticks and self.ticks[0][0] < timestamp - self.window:
            self.ticks.popleft()

    def is_triggered(self) -> bool:
        if len(self.ticks) < 2:
            return False
        oldest_price = self.ticks[0][1]
        newest_price = self.ticks[-1][1]
        move = abs(newest_price - oldest_price) / oldest_price
        return move > self.threshold`,
    language: "python",
    complexity: {
      time: "O(1) amortized per add_price, O(1) per is_triggered",
      space: "O(w) where w is the max number of ticks within one window",
    },
  },
];
