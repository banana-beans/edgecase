import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-30
// A two-heap running median applied to a derived value (spread,
// not raw price), a "delete one bad element" sliding window, a
// House-Robber-style non-adjacent-day P&L DP, a Poisson-binomial
// DP for an at-least-K-up-days probability, and a one-directional
// trailing-stop ratchet design problem.
// ============================================================

export const financeBatch20260930: LeetCodeProblem[] = [
  {
    id: "lc-20260930-running-median-spread",
    title: "Running Median of the Bid-Ask Spread From a Streaming Quote Feed",
    difficulty: "medium",
    topics: ["heap", "design", "streaming"],
    problem:
      "You receive a stream of quotes, each a (bid, ask) pair. After each new quote, return the running median of the spread (ask - bid) over every quote seen so far. Implement add(bid, ask) to be called once per quote, returning the updated median in O(log n) time.",
    examples: [
      {
        input: "add(100.00, 100.05); add(100.02, 100.09); add(99.98, 100.03)",
        output: "0.05, 0.06, 0.05",
        explanation:
          "Spreads in order: 0.05, 0.07, 0.05. Median after 1 value: 0.05. Median after 2 values: (0.05+0.07)/2 = 0.06. Median after 3 values, sorted [0.05, 0.05, 0.07]: 0.05.",
      },
    ],
    constraints: ["1 <= number of quotes <= 10^5", "ask > bid > 0 for every quote"],
    approach:
      "The value you need a running median of is the DERIVED spread, not either raw price -- compute it once per quote, then apply the standard two-heap running-median structure to that single number: a max-heap (negated, since Python's heapq is a min-heap) holding the lower half of spreads seen so far, and a min-heap holding the upper half, kept balanced so their sizes never differ by more than one. Insert each new spread into whichever heap keeps that invariant, then rebalance by moving one element across if a heap has grown more than one larger than the other. The median is always readable from the heap tops in O(1): the larger heap's top if sizes differ, or the average of both tops if they're equal, so amortized cost per quote is the O(log n) of one heap push/pop, not an O(n log n) re-sort.",
    code: `import heapq

class RunningMedianSpread:
    def __init__(self):
        self.lo: list[float] = []   # max-heap (negated), lower half
        self.hi: list[float] = []   # min-heap, upper half

    def add(self, bid: float, ask: float) -> float:
        spread = round(ask - bid, 10)   # guard against float noise

        # route into the half where it belongs, then rebalance sizes
        if not self.lo or spread <= -self.lo[0]:
            heapq.heappush(self.lo, -spread)
        else:
            heapq.heappush(self.hi, spread)

        if len(self.lo) > len(self.hi) + 1:
            heapq.heappush(self.hi, -heapq.heappop(self.lo))
        elif len(self.hi) > len(self.lo):
            heapq.heappush(self.lo, -heapq.heappop(self.hi))

        if len(self.lo) > len(self.hi):
            return -self.lo[0]
        return (-self.lo[0] + self.hi[0]) / 2

tracker = RunningMedianSpread()
for bid, ask in [(100.00, 100.05), (100.02, 100.09), (99.98, 100.03)]:
    print(tracker.add(bid, ask))
# 0.05
# 0.06
# 0.05`,
    language: "python",
    complexity: { time: "O(log n) per update", space: "O(n)" },
  },
  {
    id: "lc-20260930-longest-clean-run-one-deletion",
    title: "Longest Clean-Tick Run After Deleting One Flagged Print",
    difficulty: "medium",
    topics: ["sliding-window", "two-pointer"],
    problem:
      "Your tick-cleaning pipeline flags each print as clean (1) or bad (0) in an array is_clean. You must delete exactly one tick from the series (even if the series is already all clean). Return the length of the longest contiguous run of clean ticks achievable after that single deletion.",
    examples: [
      {
        input: "is_clean=[1,1,0,1,1,1,0,1,1]",
        output: "5",
        explanation:
          "Delete the 0 at index 6: the run is_clean[3..8] minus that one bad tick leaves a contiguous clean run of length 5 (indices 3,4,5,7,8 collapse to one run once the bad tick between them is removed).",
      },
    ],
    constraints: ["1 <= is_clean.length <= 10^5", "is_clean[i] is 0 or 1"],
    approach:
      "This is a sliding window allowing at most one flagged (0) tick inside it: expand the right edge, and whenever the window's flagged-tick count exceeds one, shrink from the left until it's back to at most one. At every valid window position, its length represents 'this many ticks, minus the one flagged tick if present, form a contiguous clean run after deleting that flagged tick' -- track the maximum window length seen. Because you must delete exactly one tick even from an all-clean window (the problem's stated rule), the final answer is the best window length minus one, not the raw window length itself. Each index enters and leaves the window at most once, so the whole scan is O(n).",
    code: `def longest_clean_run_after_one_deletion(is_clean: list[int]) -> int:
    left = 0
    flagged_in_window = 0
    best_window = 0

    for right, val in enumerate(is_clean):
        if val == 0:
            flagged_in_window += 1

        # at most one flagged tick allowed in the window at a time
        while flagged_in_window > 1:
            if is_clean[left] == 0:
                flagged_in_window -= 1
            left += 1

        best_window = max(best_window, right - left + 1)

    # exactly one tick must be deleted, even from an all-clean window
    return best_window - 1

print(longest_clean_run_after_one_deletion([1, 1, 0, 1, 1, 1, 0, 1, 1]))
# 5`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260930-max-nonadjacent-day-pnl",
    title: "Maximum P&L From Non-Adjacent Trading Days",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "You have a forecasted daily P&L, pnl[i], for each of N days (values can be negative). A risk rule forces a mandatory day off immediately after any day you trade, so you can never select two adjacent days. Choose a subset of non-adjacent days to trade, maximizing total P&L; days you skip contribute zero.",
    examples: [
      {
        input: "pnl=[5, -2, 8, 3, -1, 9]",
        output: "22",
        explanation:
          "Trade days 0, 2, and 5 (all non-adjacent): 5 + 8 + 9 = 22. Any selection touching adjacent days, or including the -2 or -1 days, does worse.",
      },
    ],
    constraints: ["1 <= pnl.length <= 10^5", "-10^4 <= pnl[i] <= 10^4"],
    approach:
      "This is the House-Robber recurrence, reframed: let best_ending_here[i] be the maximum total P&L achievable using only days 0..i, where day i's own inclusion is optional. The recurrence is best[i] = max(best[i-1], best[i-2] + pnl[i]) -- either skip day i entirely (inherit yesterday's best, which naturally excludes any bad day you never wanted to trade), or trade day i and add it to the best total from two days back (since day i-1 must then be skipped). Because the 'skip' branch is always available, a very negative pnl[i] is automatically never selected -- the DP doesn't need an explicit max-with-zero clause. Two rolling variables replace the full DP array for O(1) space.",
    code: `def max_nonadjacent_day_pnl(pnl: list[int]) -> int:
    prev2, prev1 = 0, 0   # best P&L using 0 days, then using "day -1"

    for p in pnl:
        prev2, prev1 = prev1, max(prev1, prev2 + p)

    return prev1

print(max_nonadjacent_day_pnl([5, -2, 8, 3, -1, 9]))
# 22`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260930-at-least-k-up-days-probability",
    title: "Probability of At Least K Up-Days in N Independent Trading Days",
    difficulty: "medium",
    topics: ["probability", "dynamic-programming"],
    problem:
      "A stock closes up on any given day with independent probability p, and down otherwise. Given n trading days and a threshold k, return the probability of at least k up-days over the n days.",
    examples: [
      {
        input: "n=5, p=0.6, k=3",
        output: "0.6826",
        explanation:
          "Number of up-days follows Binomial(5, 0.6). P(X=3)+P(X=4)+P(X=5) = 0.3456 + 0.2592 + 0.07776 = 0.68256, which rounds to 0.6826.",
      },
    ],
    constraints: ["1 <= n <= 1000", "0 <= p <= 1", "0 <= k <= n"],
    approach:
      "The direct formula sums C(n,j) * p^j * (1-p)^(n-j) for j from k to n, but computing C(n,j) via factorials overflows or loses precision fast once n grows past a few hundred. Instead build the full distribution with a DP that processes one day at a time: dp[j] holds the probability of exactly j up-days among the days processed so far. Each new day either keeps the up-day count the same (this day closes down, probability 1-p) or increments it (closes up, probability p), so dp updates in place from a fresh array each step. This is the general Poisson-binomial construction -- it works identically even if p varies day to day, which the closed-form binomial coefficient approach does not -- and it stays numerically stable at any n since it only ever multiplies and adds probabilities in [0, 1].",
    code: `def prob_at_least_k_up_days(n: int, p: float, k: int) -> float:
    # dp[j] = probability of exactly j up-days among days processed so far
    dp = [1.0] + [0.0] * n

    for _ in range(n):
        new_dp = [0.0] * (n + 1)
        for j in range(n + 1):
            if dp[j] == 0.0:
                continue
            new_dp[j] += dp[j] * (1 - p)        # this day closes down
            if j + 1 <= n:
                new_dp[j + 1] += dp[j] * p       # this day closes up
        dp = new_dp

    return sum(dp[k:])

print(round(prob_at_least_k_up_days(5, 0.6, 3), 4))
# 0.6826`,
    language: "python",
    complexity: { time: "O(n^2)", space: "O(n)" },
  },
  {
    id: "lc-20260930-trailing-stop-tracker",
    title: "Design a Trailing-Stop Order Tracker",
    difficulty: "easy",
    topics: ["design", "state-machine"],
    problem:
      "Design a class TrailingStop for a long position, constructed with an entry price and a trailing distance. update(price) is called once per new tick and returns the current stop level; the stop level ratchets up to (highest price seen - trail) whenever price makes a new high, and never moves down on a pullback. is_triggered(price) returns whether price has fallen to or below the current stop level.",
    examples: [
      {
        input:
          "TrailingStop(entry_price=100.0, trail=5.0); update(102.0); update(101.0); update(96.5)",
        output: "stop levels: 97.0, 97.0, 97.0; is_triggered(96.5) = True",
        explanation:
          "A new high of 102.0 raises the stop to 97.0. The pullback to 101.0 does NOT lower the stop back down -- it stays at 97.0. The drop to 96.5 is at or below 97.0, so the stop triggers.",
      },
    ],
    constraints: ["trail > 0", "prices are positive floats"],
    approach:
      "Track only two pieces of state: the highest price observed since entry, and the current stop level derived from it. On every update, compare the new price against the running high; only when it's a NEW high do you move the stop, to (new high - trail) -- a strictly one-directional ratchet, since the whole point of a trailing stop is that it locks in gains and never gives back protection on a pullback. is_triggered is then a single comparison against the last computed stop level, no recomputation needed. This is O(1) per tick, and the one-directional invariant (stop_level never decreases) is the entire correctness property worth testing explicitly.",
    code: `class TrailingStop:
    def __init__(self, entry_price: float, trail: float):
        self.trail = trail
        self.highest = entry_price
        self.stop_level = entry_price - trail

    def update(self, price: float) -> float:
        # stop only ever ratchets UP with new highs -- a pullback
        # must never loosen it back down
        if price > self.highest:
            self.highest = price
            self.stop_level = self.highest - self.trail
        return self.stop_level

    def is_triggered(self, price: float) -> bool:
        return price <= self.stop_level

ts = TrailingStop(entry_price=100.0, trail=5.0)
print(ts.update(102.0), ts.is_triggered(102.0))   # 97.0 False
print(ts.update(101.0), ts.is_triggered(101.0))   # 97.0 False (no give-back)
print(ts.update(96.5), ts.is_triggered(96.5))     # 97.0 True`,
    language: "python",
    complexity: { time: "O(1) per update", space: "O(1)" },
  },
];
