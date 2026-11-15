import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-15
// Running median of a trade-price stream (two heaps), shortest
// window whose volume reaches a target (sliding window), max
// profit with at most k transactions (DP), gambler's ruin
// absorption probability (probability / Markov chain), and a
// weighted-average cost-basis position tracker (design).
// ============================================================

export const financeBatch20261115: LeetCodeProblem[] = [
  {
    id: "lc-20261115-running-median-trade-price",
    title: "Running Median of Trade Prices (Two Heaps)",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Design a class that ingests trade prices one at a time as they print and, after each ingestion, reports the median of all prices seen so far.",
    examples: [
      {
        input: "add(5); add(2); add(8); add(1)",
        output: "5, 3.5, 5, 3.5",
        explanation:
          "After [5] median is 5. After [5,2] sorted [2,5] median is the average of both, 3.5. After [5,2,8] sorted [2,5,8] median is 5. After [5,2,8,1] sorted [1,2,5,8] median is the average of the middle two (2 and 5), 3.5.",
      },
    ],
    constraints: ["up to 10^5 add calls", "prices are positive numbers"],
    approach:
      "Split the seen values across two heaps: a max-heap for the lower half, a min-heap for the upper half, kept balanced in size (differing by at most one element). Every insert goes to the max-heap first, then the max-heap's top is pushed across to the min-heap to keep the invariant that every value in the max-heap is less than or equal to every value in the min-heap; finally, if the min-heap outgrew the max-heap, one value is pushed back across. Whichever heap has more elements holds the median directly, and when they're equal the median is the average of each heap's top. Python's heapq is min-heap only, so the max-heap is simulated by negating every value going in and out.",
    code: `import heapq


class RunningMedian:
    def __init__(self) -> None:
        self.lower: list[float] = []  # max-heap (negated), holds the smaller half
        self.upper: list[float] = []  # min-heap, holds the larger half

    def add(self, price: float) -> float:
        heapq.heappush(self.lower, -price)
        # keep the invariant: every value in lower <= every value in upper
        heapq.heappush(self.upper, -heapq.heappop(self.lower))
        # rebalance sizes so they differ by at most one element
        if len(self.upper) > len(self.lower):
            heapq.heappush(self.lower, -heapq.heappop(self.upper))

        if len(self.lower) > len(self.upper):
            return -self.lower[0]
        return (-self.lower[0] + self.upper[0]) / 2


tracker = RunningMedian()
for price in [5, 2, 8, 1]:
    print(tracker.add(price))
# 5, 3.5, 5, 3.5`,
    language: "python",
    complexity: { time: "O(log n) per add", space: "O(n)" },
  },
  {
    id: "lc-20261115-min-window-target-volume",
    title: "Shortest Contiguous Window of Ticks Whose Volume Reaches a Target",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given an array of per-tick trade volumes and a target total volume, return the length of the shortest contiguous window of ticks whose volumes sum to at least target, or -1 if no window qualifies. This models finding the fewest consecutive prints needed to fill a target size.",
    examples: [
      {
        input: "volumes = [2,3,1,2,4,3], target = 7",
        output: "2",
        explanation:
          "The window [4,3] (indices 4-5) sums to 7 in just 2 ticks -- no shorter window reaches the target.",
      },
    ],
    constraints: ["1 <= volumes.length <= 10^5", "1 <= volumes[i] <= 10^4", "1 <= target <= 10^9"],
    approach:
      "Classic variable-length sliding window: expand the right edge, adding each volume to a running sum, and whenever the running sum meets or exceeds target, shrink from the left as far as possible while the sum still qualifies, recording the window length at each valid shrink. Because volumes are all positive, the running sum is monotonic as the window shrinks, which is exactly what makes the two-pointer approach correct instead of needing to recheck every possible left boundary -- each pointer only ever moves forward, giving O(n) total work instead of the O(n^2) of checking every window explicitly.",
    code: `def min_window_for_target_volume(volumes: list[int], target: int) -> int:
    left = 0
    running_sum = 0
    best = float("inf")

    for right, vol in enumerate(volumes):
        running_sum += vol

        # shrink from the left as long as we still meet the target --
        # volumes are all positive, so running_sum only drops as left advances
        while running_sum >= target:
            best = min(best, right - left + 1)
            running_sum -= volumes[left]
            left += 1

    return best if best != float("inf") else -1


print(min_window_for_target_volume([2, 3, 1, 2, 4, 3], target=7))
# 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261115-max-profit-k-transactions",
    title: "Max Profit With At Most K Buy/Sell Transactions",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for one instrument and an integer k, you may complete at most k buy-then-sell round trips (never holding more than one unit at a time, and you must sell before buying again). Return the maximum total profit.",
    examples: [
      {
        input: "k = 2, prices = [3,2,6,5,0,3]",
        output: "7",
        explanation:
          "Buy at 2, sell at 6 for profit 4 (one transaction). Buy at 0, sell at 3 for profit 3 (a second transaction). Total 4 + 3 = 7, using both allowed transactions.",
      },
    ],
    constraints: ["0 <= k <= 100", "1 <= prices.length <= 1000", "0 <= prices[i] <= 1000"],
    approach:
      "Track two arrays indexed by transaction count j from 1 to k: hold[j] (max profit after buying into the j-th transaction, still holding) and done[j] (max profit after completing the j-th transaction). For each day's price, update from j=1 up to k: hold[j] = max(hold[j], done[j-1] - price) (buy today, funded by having already finished transaction j-1) and done[j] = max(done[j], hold[j] + price) (sell today to close out the j-th transaction). The answer is done[k]. When k is at least n/2, the transaction cap never actually binds, so it degenerates to the unlimited-transactions case: just sum every positive day-over-day move, which avoids a wasted O(n*k) pass when k is needlessly large.",
    code: `def max_profit_k_transactions(k: int, prices: list[int]) -> int:
    n = len(prices)
    if n == 0 or k == 0:
        return 0

    # k >= n // 2 means the transaction cap never binds -- fall back to
    # the unlimited-transaction case: sum every positive day-over-day move
    if k >= n // 2:
        return sum(max(prices[i + 1] - prices[i], 0) for i in range(n - 1))

    hold = [float("-inf")] * (k + 1)  # max profit after buying into transaction j
    done = [0] * (k + 1)              # max profit after completing transaction j

    for price in prices:
        for j in range(1, k + 1):
            hold[j] = max(hold[j], done[j - 1] - price)
            done[j] = max(done[j], hold[j] + price)

    return done[k]


print(max_profit_k_transactions(2, [3, 2, 6, 5, 0, 3]))
# 7`,
    language: "python",
    complexity: { time: "O(n*k)", space: "O(k)" },
  },
  {
    id: "lc-20261115-gamblers-ruin-absorption-probability",
    title: "Probability a Market Maker's Inventory Random Walk Hits the Upper Barrier First",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "A market maker's inventory starts at s shares, with 0 < s < N, and each tick moves to s + 1 with probability p or s - 1 with probability 1 - p, until it is absorbed at either 0 or N. Given p, N, and s, return the probability the walk is absorbed at N (the upper barrier) rather than at 0.",
    examples: [
      {
        input: "p = 0.5, N = 4, s = 2",
        output: "0.5",
        explanation:
          "For an unbiased (p = 0.5) walk, the probability of hitting the upper barrier first is simply s / N: 2 / 4 = 0.5.",
      },
      {
        input: "p = 0.4, N = 3, s = 1",
        output: "0.211",
        explanation:
          "With an unfavorable downward drift (p = 0.4), the biased closed-form expression gives roughly 0.211 -- noticeably below the naive s/N = 0.333 you'd get from ignoring the drift.",
      },
    ],
    constraints: ["0 < s < N", "1 <= N <= 10^6", "0 < p < 1"],
    approach:
      "This is the classical gambler's ruin problem. A first-step argument gives P(s) = p*P(s+1) + (1-p)*P(s-1) with boundary conditions P(0) = 0, P(N) = 1. For the unbiased case (p = 0.5) this collapses to the clean closed form P(s) = s / N. For the biased case, with q = 1-p and r = q/p, the closed form is P(s) = (1 - r^s) / (1 - r^N). The numerically dangerous part is evaluating r^N directly: when p < 0.5, r = q/p > 1, and r^N overflows for large N long before the final ratio (which is well-behaved, between 0 and 1) is computed. Dividing numerator and denominator by r^N -- equivalently working with r^(s-N) and r^(-N), both of which stay bounded whenever r > 1 -- avoids ever materializing the overflowing intermediate term.",
    code: `def prob_hits_upper_barrier(p: float, n: int, s: int) -> float:
    # unbiased walk: probability collapses to the simple ratio
    if abs(p - 0.5) < 1e-12:
        return s / n

    q = 1 - p
    r = q / p  # classical gambler's ruin ratio

    if r <= 1:
        # p >= 0.5: r**s and r**n are both <= 1, safe to evaluate directly
        return (1 - r ** s) / (1 - r ** n)

    # p < 0.5: r > 1, so r**n would overflow for large n. Rewrite using
    # negative exponents (r**-n and r**(s-n) are both <= 1) instead.
    return (r ** (s - n) - r ** -n) / (1 - r ** -n)


print(round(prob_hits_upper_barrier(0.5, 4, 2), 3))
# 0.5
print(round(prob_hits_upper_barrier(0.4, 3, 1), 3))
# 0.211`,
    language: "python",
    complexity: { time: "O(1) with the closed form", space: "O(1)" },
  },
  {
    id: "lc-20261115-design-position-avg-cost-tracker",
    title: "Design: Position Size and Weighted-Average Cost Basis Tracker",
    difficulty: "medium",
    topics: ["design"],
    problem:
      "Design a PositionTracker supporting buy(qty, price) and sell(qty, price), which may only sell up to the currently held quantity. Track the current position size, the weighted-average cost basis of the open position, and the cumulative REALIZED P&L across all sells so far.",
    examples: [
      {
        input: "buy(10, 100); buy(10, 120); sell(5, 150); position(); avg_cost(); realized_pnl()",
        output: "15, 110.0, 200.0",
        explanation:
          "After the two buys: 20 shares at a quantity-weighted average cost of (10*100 + 10*120)/20 = 110. Selling 5 shares at 150 realizes (150-110)*5 = 200 of P&L and leaves 15 shares still held at the same 110 average cost, since a sell never changes the average cost of what remains.",
      },
    ],
    constraints: [
      "buy and sell quantities and prices are positive",
      "a sell never requests more than the currently held quantity",
      "up to 10^5 operations",
    ],
    approach:
      "The key invariant is that average cost basis only changes on a BUY, never on a SELL. A buy updates the weighted average by blending the new shares' cost into the existing position: new_avg = (old_qty*old_avg + buy_qty*buy_price) / (old_qty + buy_qty). A sell realizes (sell_price - current_avg_cost) * sell_qty into cumulative P&L, reduces the held quantity, and leaves avg_cost completely untouched -- the remaining shares were always carried at that average cost, selling some of them doesn't retroactively change what the others cost. This mirrors how a real books-and-records system computes realized P&L under weighted-average (as opposed to FIFO or LIFO) costing.",
    code: `class PositionTracker:
    def __init__(self) -> None:
        self.qty = 0
        self.avg_cost = 0.0
        self.realized_pnl = 0.0

    def buy(self, qty: int, price: float) -> None:
        # blend the new shares' cost into the existing weighted average --
        # this is the only operation that ever changes avg_cost
        total_cost = self.avg_cost * self.qty + price * qty
        self.qty += qty
        self.avg_cost = total_cost / self.qty

    def sell(self, qty: int, price: float) -> None:
        # realize P&L against the CURRENT average cost, then shrink the
        # position -- avg_cost itself is untouched by a sell
        self.realized_pnl += (price - self.avg_cost) * qty
        self.qty -= qty

    def position(self) -> int:
        return self.qty


tracker = PositionTracker()
tracker.buy(10, 100)
tracker.buy(10, 120)
tracker.sell(5, 150)
print(tracker.position(), tracker.avg_cost, tracker.realized_pnl)
# 15 110.0 200.0`,
    language: "python",
    complexity: { time: "O(1) per operation", space: "O(1)" },
  },
];
