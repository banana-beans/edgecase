import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-05
// Two running-median heaps for a live trade tape, a minimum
// sliding window covering every required venue in an order
// router, a buy/sell DP variant with a mandatory cooldown day,
// a gambler's-ruin probability problem for inventory stop-outs,
// and a position-tracker design problem with weighted-average
// cost basis.
// ============================================================

export const financeBatch20261005: LeetCodeProblem[] = [
  {
    id: "lc-20261005-running-median-trade-stream",
    title: "Running Median of a Live Trade Price Stream",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Design a class MedianTracker with add(price) that ingests one trade price at a time from a live stream, and median() that returns the median of all prices seen so far in O(log n) for add and O(1) for median.",
    examples: [
      {
        input: "add(5); add(2); median(); add(8); median()",
        output: "3.5, 5.0",
        explanation:
          "After [5, 2], sorted is [2, 5], median of an even-sized set is the average of the two middle elements: (2+5)/2 = 3.5. After adding 8, sorted is [2, 5, 8], an odd-sized set whose median is the single middle element, 5.0.",
      },
    ],
    constraints: ["up to 10^5 calls to add", "prices fit in a double"],
    approach:
      "Split the stream across two heaps that always differ in size by at most one: a max-heap holding the smaller half (negated prices, since Python's heapq is a min-heap) and a min-heap holding the larger half. Every add() pushes onto the max-heap first, then immediately moves its root over to the min-heap to guarantee every element in the max-heap is <= every element in the min-heap -- the invariant that makes the two roots the actual two middle values. After that transfer, rebalance sizes by moving one element back if the min-heap has grown more than one larger than the max-heap. median() then reads only the two heap roots: the single top of the larger heap when sizes differ, or the average of both roots when they're equal, both O(1).",
    code: `import heapq

class MedianTracker:
    def __init__(self):
        self.small: list[float] = []  # max-heap via negation: the smaller half
        self.large: list[float] = []  # min-heap: the larger half

    def add(self, price: float) -> None:
        heapq.heappush(self.small, -price)
        # guarantee every element in 'small' <= every element in 'large'
        heapq.heappush(self.large, -heapq.heappop(self.small))
        # rebalance: large may now be at most one bigger than small
        if len(self.large) > len(self.small) + 1:
            heapq.heappush(self.small, -heapq.heappop(self.large))

    def median(self) -> float:
        if len(self.small) == len(self.large):
            return (-self.small[0] + self.large[0]) / 2.0
        return float(self.large[0])  # large always holds the extra element when sizes differ

tracker = MedianTracker()
tracker.add(5)
tracker.add(2)
print(tracker.median())  # 3.5
tracker.add(8)
print(tracker.median())  # 5.0`,
    language: "python",
    complexity: { time: "O(log n) per add, O(1) per median", space: "O(n)" },
  },
  {
    id: "lc-20261005-min-window-all-required-venues",
    title: "Minimum Order-Flow Window Covering Every Required Venue",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a chronological list of venue codes events representing where each child order routed, and a set required of venue codes that must all appear, return the length of the shortest contiguous subarray that contains every venue in required at least once. Return 0 if no such window exists.",
    examples: [
      {
        input: 'events=["NYSE","ARCA","NYSE","BATS","ARCA"], required={"NYSE","BATS"}',
        output: "4",
        explanation:
          'The window events[0:4] = ["NYSE","ARCA","NYSE","BATS"] is the shortest contiguous run containing both NYSE and BATS at least once; no window of length 3 or less covers both.',
      },
    ],
    constraints: ["1 <= events.length <= 10^5", "1 <= len(required) <= 20"],
    approach:
      "Classic minimum-window-substring shape: expand right, tracking counts of required venues currently in the window plus a running count of how many distinct required venues have a nonzero count ('satisfied'). Once satisfied equals len(required), the window is valid, so greedily shrink from the left -- recording the best (shortest) length seen -- until shrinking would drop a required venue's count to zero and break validity. Only required venues need counting; non-required venues in the stream are ignored entirely for the count/satisfied bookkeeping, though they still occupy space inside the window and therefore still affect its length.",
    code: `from collections import defaultdict

def min_window_covering_venues(events: list[str], required: set[str]) -> int:
    need = defaultdict(int)
    for v in required:
        need[v] = 0  # tracked separately from counts of venues NOT required

    counts: dict[str, int] = defaultdict(int)
    satisfied = 0
    best = float("inf")
    left = 0

    for right, venue in enumerate(events):
        if venue in required:
            counts[venue] += 1
            if counts[venue] == 1:
                satisfied += 1  # this required venue just became present

        while satisfied == len(required):
            best = min(best, right - left + 1)
            left_venue = events[left]
            if left_venue in required:
                counts[left_venue] -= 1
                if counts[left_venue] == 0:
                    satisfied -= 1  # shrinking further would drop coverage
            left += 1

    return 0 if best == float("inf") else best

print(min_window_covering_venues(
    ["NYSE", "ARCA", "NYSE", "BATS", "ARCA"], {"NYSE", "BATS"}
))
# 4`,
    language: "python",
    complexity: { time: "O(n)", space: "O(len(required))" },
  },
  {
    id: "lc-20261005-max-profit-cooldown",
    title: "Maximum Profit With a Mandatory Cooldown Day After Each Sale",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for a stock, return the maximum profit achievable with unlimited buy/sell transactions (never holding more than one share at a time), given that after selling you cannot buy again on the very next day (one mandatory cooldown day).",
    examples: [
      {
        input: "prices=[1,2,3,0,2]",
        output: "3",
        explanation:
          "Buy at index 0 (price 1), sell at index 1 (price 2) for profit 1, cooldown on index 2 (forced, can't buy the day right after selling), then buy at index 3 (price 0), sell at index 4 (price 2) for profit 2. Total profit 1 + 2 = 3, which beats the alternative of buying at 1 and selling at 3 for a single profit of 2.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000"],
    approach:
      "Three-state day-by-day DP, one state per 'mode' you can be in after today: held (currently holding a share), sold (just sold today, so tomorrow is a forced cooldown), and rest (not holding, and free to buy tomorrow -- either never bought, or it's been at least one day since a sale). Transitions: held today is either held yesterday (no action) or rest yesterday minus today's price (bought today); sold today is held yesterday plus today's price (sold today); rest today is the better of rest yesterday (still waiting) or sold yesterday (the cooldown day has now passed). The cooldown is enforced purely structurally -- 'rest' can only be reached FROM 'sold' with a one-day lag baked into the transition graph, never directly funding a same-day buy.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    held = float("-inf")  # holding a share
    sold = 0               # just sold today (forces cooldown tomorrow)
    rest = 0                # not holding, free to buy

    for price in prices:
        prev_sold = sold
        sold = held + price               # sell what we were holding
        held = max(held, rest - price)    # keep holding, or buy from 'rest' state
        rest = max(rest, prev_sold)       # cooldown day has passed since that sale

    return max(sold, rest)

print(max_profit_with_cooldown([1, 2, 3, 0, 2]))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261005-gamblers-ruin-inventory-stopout",
    title: "Probability of Hitting a Stop-Out Before a Profit Target on a Random-Walk Inventory",
    difficulty: "medium",
    topics: ["probability", "math"],
    problem:
      "A market maker's inventory starts at i lots (0 < i < N) and changes by +1 or -1 each tick with equal probability 0.5 each, independent across ticks. Inventory hitting 0 means a forced stop-out (de-risking); hitting N means a profit target that closes the book. Return the probability the stop-out (0) is hit before the profit target (N).",
    examples: [
      {
        input: "i=2, N=5",
        output: "0.6",
        explanation:
          "This is the classic gambler's ruin setup with fair (p=0.5) steps. For a fair random walk, the probability of ruin starting from i is exactly (N-i)/N, so with i=2 and N=5 that's (5-2)/5 = 0.6.",
      },
    ],
    constraints: ["0 < i < N", "N <= 10^6"],
    approach:
      "Let P(i) be the probability of hitting 0 (ruin) before N, starting from state i. The walk is a fair coin flip each step, so P(i) = 0.5*P(i-1) + 0.5*P(i+1), a second-order linear recurrence with boundary conditions P(0) = 1 and P(N) = 0. For the SYMMETRIC (p=0.5) case this recurrence's solution is exactly linear in i -- P(i) = (N - i) / N -- which you can verify by substitution: it satisfies both boundaries and the averaging recurrence exactly, since the midpoint of two consecutive linear values is itself linear. For a biased walk (p != 0.5) the solution is instead a ratio of geometric terms in (q/p)^i, not linear; the fair case is the single special case where the closed form collapses to something this simple, which is worth flagging explicitly since it's easy to assume the linear formula generalizes when it doesn't.",
    code: `def prob_stopout_before_target(i: int, n: int) -> float:
    # fair (p=0.5) gambler's ruin: P(ruin) is exactly linear in the starting state
    return (n - i) / n

print(prob_stopout_before_target(2, 5))
# 0.6

# sanity check against Monte Carlo simulation of the actual random walk
import random
def simulate_once(i: int, n: int) -> bool:
    pos = i
    while 0 < pos < n:
        pos += 1 if random.random() < 0.5 else -1
    return pos == 0  # True if ruin (stop-out) happened first

random.seed(1)
trials = [simulate_once(2, 5) for _ in range(20000)]
print(round(sum(trials) / len(trials), 2))  # lands close to 0.6

# for a BIASED walk (p != 0.5), the linear formula no longer applies --
# the closed form is a ratio of geometric terms, not (n - i) / n
def prob_stopout_biased(i: int, n: int, p: float) -> float:
    if p == 0.5:
        return (n - i) / n
    q_over_p = (1 - p) / p
    return (q_over_p ** i - q_over_p ** n) / (1 - q_over_p ** n)

print(round(prob_stopout_biased(2, 5, 0.5), 4))  # matches the fair-case formula: 0.6`,
    language: "python",
    complexity: { time: "O(1) via the closed form", space: "O(1)" },
  },
  {
    id: "lc-20261005-position-tracker-avg-cost",
    title: "Design a Position Tracker With Weighted-Average Cost Basis",
    difficulty: "medium",
    topics: ["design"],
    problem:
      "Design a class PositionTracker with trade(qty, price) (qty positive for a buy, negative for a sell) that maintains a running share position and its weighted-average cost basis, and realized_pnl() returning cumulative realized P&L so far. A buy that adds to an existing position (same sign) updates the average cost as a size-weighted blend of the old and new cost. A sell (or a buy that reduces/flips an existing position) realizes P&L against the CURRENT average cost for the portion that closes, and if it overshoots past flat, the remainder opens a fresh position at the trade's own price with no blending.",
    examples: [
      {
        input: "trade(100, 10.0); trade(50, 12.0); trade(-120, 15.0); realized_pnl()",
        output: "520.0",
        explanation:
          "Buy 100 @ 10 -> position 100 @ avg cost 10.0. Buy 50 @ 12 -> position 150 @ blended avg cost (100*10 + 50*12)/150 = 10.6667. Sell 120 @ 15 closes 120 of the 150 shares, realizing (15 - 10.6667)*120 = 520.0 of P&L against the average cost, leaving 30 shares still open @ avg cost 10.6667.",
      },
    ],
    constraints: ["qty != 0 on every trade() call", "price > 0"],
    approach:
      "Track signed position (positive long, negative short) and a single average_cost that's only meaningful while position != 0. A new trade either EXTENDS the position (same sign as current position, or current position is zero) -- in which case blend average_cost as a size-weighted average of old position*old cost and new qty*price -- or OFFSETS it (opposite sign), in which case the shares that close (min of the two magnitudes) realize P&L as (price - average_cost) * closing_qty, signed appropriately for whether you were long or short going in. If the offsetting trade's magnitude exceeds the current position, it flips through flat: realize P&L on the full old position, then open a brand-new position for the leftover quantity at the trade's own price as its fresh average cost, with no blending since there's nothing to blend against.",
    code: `class PositionTracker:
    def __init__(self):
        self.position = 0       # signed: positive long, negative short
        self.avg_cost = 0.0
        self.realized = 0.0

    def trade(self, qty: int, price: float) -> None:
        if self.position == 0 or (qty > 0) == (self.position > 0):
            # extending (or opening) in the same direction -- blend average cost
            total_cost = self.position * self.avg_cost + qty * price
            self.position += qty
            self.avg_cost = total_cost / self.position
            return

        # offsetting trade: closes up to min(|qty|, |position|) against avg_cost
        closing_qty = min(abs(qty), abs(self.position))
        direction = 1 if self.position > 0 else -1
        self.realized += direction * (price - self.avg_cost) * closing_qty

        remaining = qty + self.position  # signed leftover after closing
        if abs(qty) >= abs(self.position):
            self.position = remaining
            self.avg_cost = price if remaining != 0 else 0.0  # fresh position, if any
        else:
            self.position = remaining  # partial close, same side, avg_cost unchanged

    def realized_pnl(self) -> float:
        return self.realized

tracker = PositionTracker()
tracker.trade(100, 10.0)
tracker.trade(50, 12.0)
tracker.trade(-120, 15.0)
print(round(tracker.realized_pnl(), 2))`,
    language: "python",
    complexity: { time: "O(1) per trade", space: "O(1)" },
  },
];
