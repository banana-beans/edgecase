import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-16
// Median resting order size from a streaming fill feed (heap /
// two-heap median), longest window where VWAP stays within a
// tolerance band (sliding window), min cost to acquire a target
// position across price levels with a per-day buy cap (DP),
// probability a market maker's inventory random walk hits a risk
// limit before flattening (probability/Markov), and a position
// tracker that supports partial fills against resting limit
// orders with FIFO lot accounting (design).
// ============================================================

export const financeBatch20261016: LeetCodeProblem[] = [
  {
    id: "lc-20261016-streaming-median-fill-size",
    title: "Streaming Median of Fill Sizes From a Live Execution Feed",
    difficulty: "hard",
    topics: ["heap"],
    problem:
      "Design a class that consumes a live stream of trade fill sizes one at a time via add_fill(size) and supports current_median() at any point, returning the median of all fills seen so far.",
    examples: [
      {
        input: "add_fill(200); add_fill(500); current_median(); add_fill(100); current_median()",
        output: "350.0, 200.0",
        explanation:
          "After [200, 500] the median of the two middle values is (200+500)/2 = 350.0. After adding 100, the sorted fills are [100, 200, 500] and the median is the middle value, 200.0.",
      },
    ],
    constraints: ["up to 10^5 add_fill calls", "up to 10^5 current_median calls interleaved", "1 <= size <= 10^9"],
    approach:
      "Maintain two heaps that split the stream in half: a max-heap holding the smaller half of fills seen so far, and a min-heap holding the larger half. Every new fill is pushed to whichever heap it belongs with based on size, then a single rebalancing step moves at most one element between heaps to keep their sizes equal (or off by one) -- this invariant is what makes the median always readable in O(1) from the tops of the two heaps, without ever re-sorting the full stream. Each add_fill does O(log n) work for the push plus the rebalance, and current_median is O(1), which is the only way to keep both operations fast as the stream grows into the hundreds of thousands of fills a live feed can produce.",
    code: `import heapq

class StreamingMedian:
    def __init__(self):
        self.small = []   # max-heap (negated) for the smaller half
        self.large = []   # min-heap for the larger half

    def add_fill(self, size: int) -> None:
        # route the new value, then rebalance so sizes differ by at most 1
        if self.small and size > -self.small[0]:
            heapq.heappush(self.large, size)
        else:
            heapq.heappush(self.small, -size)

        if len(self.small) > len(self.large) + 1:
            heapq.heappush(self.large, -heapq.heappop(self.small))
        elif len(self.large) > len(self.small) + 1:
            heapq.heappush(self.small, -heapq.heappop(self.large))

    def current_median(self) -> float:
        if len(self.small) == len(self.large):
            return (-self.small[0] + self.large[0]) / 2
        return float(-self.small[0]) if len(self.small) > len(self.large) else float(self.large[0])

feed = StreamingMedian()
feed.add_fill(200)
feed.add_fill(500)
print(feed.current_median())   # 350.0
feed.add_fill(100)
print(feed.current_median())   # 200.0`,
    language: "python",
    complexity: { time: "O(log n) per add_fill, O(1) per current_median", space: "O(n)" },
    leetcodeNumber: 295,
  },
  {
    id: "lc-20261016-longest-window-vwap-within-tolerance",
    title: "Longest Contiguous Window Where Price Stays Within a Tolerance Band of VWAP",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a sequence of (price, volume) trade ticks in execution order and a tolerance fraction, return the length of the longest contiguous run of ticks whose volume-weighted average price (VWAP), computed over just that window, stays within tolerance of every individual price inside the window.",
    examples: [
      {
        input: "prices = [100, 101, 99, 103, 100], volumes = [10, 10, 10, 10, 10], tolerance = 0.02",
        output: "3",
        explanation:
          "The window [100, 101, 99] has VWAP = 100.0 and every price in it is within 2% of 100.0; extending to include 103 breaks the 2% band, so 3 is the longest qualifying run.",
      },
    ],
    constraints: ["1 <= prices.length == volumes.length <= 10^5", "prices[i] > 0", "0 < tolerance < 1"],
    approach:
      "A naive approach recomputes VWAP and re-checks every price against it for every candidate window, which is O(n^2) or worse. Because the condition 'does this window still satisfy the band' only gets harder to satisfy as the window grows (adding a tick can only add a new price to check and can only move VWAP, never make an already-failing price pass), a two-pointer sliding window is sound: advance the right pointer, maintain running sums for VWAP in O(1), and whenever the window's current VWAP and tolerance band no longer cover every price inside it, shrink from the left. The subtlety is that VWAP recomputation after adding one tick is cheap (O(1) from running sums), but validating the whole window's prices against the new band naively is not -- the practical fix is to shrink from the left eagerly whenever the newest price alone breaks the band, which keeps each step amortized O(1) in the common case.",
    code: `def longest_vwap_window(prices: list[float], volumes: list[float], tolerance: float) -> int:
    left = 0
    sum_pv = 0.0   # running sum of price * volume
    sum_v = 0.0    # running sum of volume
    best = 0

    for right in range(len(prices)):
        sum_pv += prices[right] * volumes[right]
        sum_v += volumes[right]

        # shrink from the left while the window's own VWAP no longer
        # covers every price currently inside the window within tolerance
        while left <= right:
            vwap = sum_pv / sum_v
            lo, hi = vwap * (1 - tolerance), vwap * (1 + tolerance)
            if all(lo <= prices[i] <= hi for i in range(left, right + 1)):
                break
            sum_pv -= prices[left] * volumes[left]
            sum_v -= volumes[left]
            left += 1

        best = max(best, right - left + 1)

    return best

print(longest_vwap_window([100, 101, 99, 103, 100], [10, 10, 10, 10, 10], 0.02))
# 3`,
    language: "python",
    complexity: { time: "O(n) amortized, O(n^2) worst case due to the inner scan", space: "O(1)" },
  },
  {
    id: "lc-20261016-min-cost-acquire-position-daily-cap",
    title: "Minimum Cost to Acquire a Target Position Under a Per-Day Buy Cap",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given a forecasted price for each of n future trading days and a per-day maximum number of shares you're allowed to buy, return the minimum total cost to acquire exactly a target number of shares by day n, buying only on the given days (no selling, no short positions).",
    examples: [
      {
        input: "prices = [10, 8, 12, 9], daily_cap = 5, target = 12",
        output: "105",
        explanation:
          "Sorted by price ascending, the cheapest days are 8, 9, 10, 12. Greedily filling the cap from cheapest to most expensive: 5 shares at 8, then 5 shares at 9, then the last 2 shares at 10 -- 5*8 + 5*9 + 2*10 = 40 + 45 + 20 = 105. Any swap that takes shares from a cheaper day and buys them on a more expensive day instead can only raise the total, so this is optimal.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^4", "1 <= daily_cap <= 10^4", "0 <= target <= daily_cap * prices.length"],
    approach:
      "Because there is no constraint linking WHICH days you buy on to each other (no sequencing penalty, no holding cost, just a per-day cap and a flat price), the greedy of 'always buy as much as possible from the cheapest remaining day first' is provably optimal: any solution that leaves a cheaper day's capacity unused while buying from a more expensive day can be improved by shifting shares from the expensive day to the cheap one, strictly lowering cost. This reduces the problem to sorting days by price and greedily filling the cap on each from cheapest to most expensive until the target is met -- an O(n log n) greedy, not actually DP, which is the interview insight: recognizing when a problem that LOOKS like it needs DP (bounded-knapsack-shaped) collapses to a greedy because the 'items' are unconstrained by order or interaction with each other.",
    code: `def min_cost_to_acquire(prices: list[int], daily_cap: int, target: int) -> int:
    # no sequencing constraint between days -- greedy cheapest-first is optimal
    order = sorted(range(len(prices)), key=lambda i: prices[i])

    remaining = target
    cost = 0
    for i in order:
        if remaining <= 0:
            break
        buy = min(daily_cap, remaining)
        cost += buy * prices[i]
        remaining -= buy

    return cost

print(min_cost_to_acquire([10, 8, 12, 9], 5, 12))
# 105  -> 5 shares @ 8, 5 shares @ 9, 2 shares @ 10`,
    language: "python",
    complexity: { time: "O(n log n)", space: "O(n)" },
  },
  {
    id: "lc-20261016-inventory-random-walk-risk-limit-probability",
    title: "Probability a Market Maker's Inventory Hits a Risk Limit Before Flattening",
    difficulty: "medium",
    topics: ["probability"],
    problem:
      "A market maker's inventory moves by +1 with probability p (a buy fill) or -1 with probability 1-p (a sell fill) on each tick, starting at inventory 0. Given a risk limit L (a symmetric absolute inventory bound) and assuming the desk stops and flattens the instant inventory returns to 0 or hits +L or -L, return the probability inventory hits the limit (+L or -L) before returning to 0.",
    examples: [
      {
        input: "p = 0.5, L = 3",
        output: "0.3333",
        explanation:
          "After the mandatory first tick, inventory sits one step away from 0 (at +1 or -1) and L-1 steps away from the limit. For a fair (p=0.5) walk, gambler's ruin gives probability 1/L of reaching the far boundary before returning to 0 from a one-step-away state, so the answer is 1/3 regardless of which direction that first tick went.",
      },
    ],
    constraints: ["0 < p < 1", "2 <= L <= 10^4"],
    approach:
      "This is the classic gambler's ruin setup but asking for the probability of hitting the FAR boundary before returning to the START, rather than before hitting 0 from some interior state. Reframe it as gambler's ruin starting one step away from 0: after the mandatory first tick, inventory is at +1 (with probability p) or -1 (with probability 1-p), and from either point, standard gambler's ruin gives a closed form for the probability of reaching the boundary at distance L-1 before falling back to 0, as a function of the ratio q/p raised to powers of position. For p != 0.5 the closed form involves ((1-p)/p)^k terms; for p = 0.5 it degenerates to the simple linear form k/L. The answer combines the two first-tick branches by symmetry of the walk's structure (the problem is symmetric in L for a symmetric coin, and the general formula handles the skewed case directly).",
    code: `def prob_hits_limit_before_zero(p: float, L: int) -> float:
    q = 1 - p

    def ruin_prob(start: int, boundary: int, up_prob: float) -> float:
        # standard gambler's ruin: probability of reaching 'boundary' before 0,
        # starting from 'start', on a walk whose up-move probability is up_prob
        if up_prob == 0.5:
            return start / boundary
        ratio = (1 - up_prob) / up_prob
        return (1 - ratio ** start) / (1 - ratio ** boundary)

    # after the first tick, inventory is at +1 or -1; from there, reaching the
    # FAR limit (L-1 away from the +1/-1 state) before returning to 0 is gambler's ruin.
    # from -1, hitting -L before 0 mirrors the walk, so swap which side is "up"
    prob_from_plus1 = ruin_prob(1, L, p)       # reach +L before 0, starting at +1
    prob_from_minus1 = ruin_prob(1, L, q)      # reach -L before 0, starting at -1 (mirrored)

    return p * prob_from_plus1 + q * prob_from_minus1

print(round(prob_hits_limit_before_zero(0.5, 3), 4))
# 0.3333 -- matches the known gambler's-ruin result of 1/L for a fair walk`,
    language: "python",
    complexity: { time: "O(1)", space: "O(1)" },
  },
  {
    id: "lc-20261016-design-fifo-position-tracker-partial-fills",
    title: "Design a Position Tracker With FIFO Lot Accounting for Partial Fills",
    difficulty: "hard",
    topics: ["design"],
    problem:
      "Design a class PositionTracker that processes buy(price, size) and sell(price, size) calls against a single instrument and supports realized_pnl(), the cumulative realized P&L so far, and open_position(), the current net open size. Sells are matched against open buy lots on a FIFO basis (oldest lot first), and a sell may partially consume a lot or span multiple lots.",
    examples: [
      {
        input: "buy(100, 10); buy(102, 10); sell(105, 15); open_position(); realized_pnl()",
        output: "5, 65",
        explanation:
          "The sell of 15 consumes all 10 shares from the first lot (bought at 100) and 5 shares from the second lot (bought at 102): realized P&L = 10*(105-100) + 5*(105-102) = 50 + 15 = 65. Open position is the remaining 5 shares from the second lot.",
      },
    ],
    constraints: ["up to 10^5 buy/sell calls", "sell size never exceeds total open position at the time", "prices and sizes are positive"],
    approach:
      "FIFO lot matching is naturally a queue problem: maintain a deque of (price, remaining_size) lots in the order they were bought. A buy simply appends a new lot. A sell walks the deque from the front, consuming each lot's remaining_size (fully popping a lot that's entirely consumed, or reducing a lot's remaining_size and stopping if it's only partially consumed), accumulating realized P&L as (sell_price - lot_price) * size_consumed_from_that_lot at each step. Because each lot, once fully consumed, is popped and never revisited, the total work across ALL sells over the tracker's lifetime is bounded by the total number of buy lots ever created, giving amortized O(1) per unit of size matched rather than O(lots) on every single sell call.",
    code: `from collections import deque

class PositionTracker:
    def __init__(self):
        self.lots = deque()      # FIFO queue of [price, remaining_size]
        self.realized = 0.0
        self.open_size = 0

    def buy(self, price: float, size: int) -> None:
        self.lots.append([price, size])
        self.open_size += size

    def sell(self, price: float, size: int) -> None:
        remaining_to_sell = size
        while remaining_to_sell > 0:
            lot_price, lot_size = self.lots[0]
            matched = min(lot_size, remaining_to_sell)

            self.realized += (price - lot_price) * matched
            self.lots[0][1] -= matched
            remaining_to_sell -= matched

            if self.lots[0][1] == 0:
                self.lots.popleft()   # this lot is fully consumed -- never revisited

        self.open_size -= size

    def realized_pnl(self) -> float:
        return self.realized

    def open_position(self) -> int:
        return self.open_size

tracker = PositionTracker()
tracker.buy(100, 10)
tracker.buy(102, 10)
tracker.sell(105, 15)
print(tracker.open_position(), tracker.realized_pnl())
# 5 65.0`,
    language: "python",
    complexity: { time: "O(1) amortized per unit matched", space: "O(n) lots held" },
  },
];
