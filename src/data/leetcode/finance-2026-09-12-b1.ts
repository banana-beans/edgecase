import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-12
// A k-way heap merge across live venue bid streams, an
// at-most-k sliding window over circuit-breaker halts, a
// state-machine DP for trading under a T+1 settlement
// cooldown, a closed-form gambler's-ruin probability for
// take-profit vs stop-loss, and a FIFO lot-accounting
// position tracker with realized P&L.
// ============================================================

export const financeBatch20260912: LeetCodeProblem[] = [
  {
    id: "lc-20260912-merge-k-bid-streams",
    title: "Merge K Live Bid Streams Into One Best-Bid Sequence",
    difficulty: "medium",
    topics: ["heap", "merge-k-sorted"],
    problem:
      "You are given k venues, each streaming its own resting bid prices for the same instrument as a list already sorted in decreasing order (best bid first, matching how each venue reports its own book). Merge all k lists into one globally sorted (decreasing) sequence of bid prices representing the combined view across every venue -- the sequence a smart order router walks when hunting for the best available price.",
    examples: [
      {
        input: "bids = [[102.5,101.0,100.0],[103.0,100.5],[101.5,101.0,99.5]]",
        output: "[103.0,102.5,101.5,101.0,101.0,100.5,100.0,99.5]",
        explanation:
          "A standard k-way merge of already-sorted (descending) lists, preserving duplicate price levels that happen to appear at more than one venue.",
      },
    ],
    constraints: ["1 <= k <= 500", "each venue's list is already sorted descending", "up to 10^5 total bids across all venues"],
    approach:
      "Classic k-way merge with a heap: push the first (largest) element of each venue's list, tagged with its venue id and index, negated so Python's min-heap behaves like a max-heap. Pop the current largest, append it to the result, and if that venue has another bid behind it, push that one too. Every bid is pushed and popped exactly once, each at O(log k) since the heap never holds more than one entry per venue -- so total cost is O(n log k) where n is the combined bid count, versus O(n log n) for concatenating everything and sorting from scratch. The saving matters exactly when k (venues) is modest but n (total quoted depth) is large, which is the realistic shape of a consolidated book.",
    code: `import heapq

def merge_bid_streams(bids: list[list[float]]) -> list[float]:
    heap: list[tuple[float, int, int]] = []
    for venue_id, prices in enumerate(bids):
        if prices:
            # negate for max-heap behavior on top of heapq's min-heap;
            # venue_id breaks ties so heapq never compares list contents
            heapq.heappush(heap, (-prices[0], venue_id, 0))

    merged: list[float] = []
    while heap:
        neg_price, venue_id, idx = heapq.heappop(heap)
        merged.append(-neg_price)
        next_idx = idx + 1
        if next_idx < len(bids[venue_id]):
            heapq.heappush(heap, (-bids[venue_id][next_idx], venue_id, next_idx))
    return merged

print(merge_bid_streams([[102.5, 101.0, 100.0], [103.0, 100.5], [101.5, 101.0, 99.5]]))
# [103.0, 102.5, 101.5, 101.0, 101.0, 100.5, 100.0, 99.5]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-20260912-longest-window-at-most-k-halts",
    title: "Longest Trading Window With At Most K Circuit-Breaker Halts",
    difficulty: "easy",
    topics: ["sliding-window", "two-pointer"],
    problem:
      "Given a binary array where a 1 marks a minute in which trading was halted by a circuit breaker and 0 marks a normal trading minute, find the length of the longest contiguous window of minutes containing at most k halted minutes.",
    examples: [
      {
        input: "halts=[0,0,1,0,0,1,1,0], k=1",
        output: "5",
        explanation: "The window [0,0,1,0,0] (indices 0-4) contains exactly 1 halt and has length 5; every length-6 window in this array contains 2 or more halts.",
      },
    ],
    constraints: ["1 <= halts.length <= 10^5", "halts[i] is 0 or 1", "0 <= k <= halts.length"],
    approach:
      "Standard at-most-k two-pointer sliding window. Expand the right pointer one step at a time, tracking a running count of halts inside the current window. Whenever that count exceeds k, shrink from the left until it's back within budget. The left pointer only ever moves forward and never revisits a position it has already passed, so the whole scan does O(n) total pointer movement rather than O(n) work per window position -- the same amortized-linear argument behind every classic at-most-k sliding window.",
    code: `def longest_window_at_most_k_halts(halts: list[int], k: int) -> int:
    left = 0
    halt_count = 0
    best = 0
    for right, val in enumerate(halts):
        halt_count += val
        # shrink from the left only as far as needed to restore the budget --
        # left never moves backward, which is what keeps this O(n) overall
        while halt_count > k:
            halt_count -= halts[left]
            left += 1
        best = max(best, right - left + 1)
    return best

print(longest_window_at_most_k_halts([0, 0, 1, 0, 0, 1, 1, 0], 1))   # 5`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260912-trade-with-t1-cooldown",
    title: "Best Trading Profit With a Mandatory T+1 Settlement Cooldown",
    difficulty: "hard",
    topics: ["dynamic-programming", "state-machine"],
    problem:
      "Given daily prices for one instrument, you may make as many trades as you like (buy, later sell), but after SELLING you must wait exactly one full day before you are allowed to buy again -- a T+1 settlement cooldown on the sale proceeds. You may still buy on the day right after a cooldown day, just never on the day immediately following a sell itself. Return the maximum total profit achievable.",
    examples: [
      {
        input: "prices=[1,2,3,0,2]",
        output: "3",
        explanation:
          "Buy on day 0 at 1, sell on day 1 at 2 (profit 1); day 2 is the mandatory cooldown; buy on day 3 at 0, sell on day 4 at 2 (profit 2). Total profit 1 + 2 = 3, which is optimal.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000", "0 <= prices[i] <= 10^5"],
    approach:
      "Model three mutually exclusive states per day rather than trying to patch a greedy scan: HOLD (currently holding a position), SOLD (just sold today, so tomorrow is a forced cooldown), and REST (not holding, and free to buy today because any cooldown has already elapsed). The transitions: today's HOLD is the better of staying in HOLD from yesterday, or buying today out of yesterday's REST; today's SOLD is yesterday's HOLD plus today's price; today's REST is the better of staying in REST or yesterday's SOLD finishing its cooldown. The cooldown is enforced structurally by REST only ever being reachable from SOLD one day later, never directly from SOLD itself -- so a naive buy-sell-buy-sell greedy that ignores the forced gap will overstate profit whenever back-to-back trades would otherwise be optimal. Track only the three rolling scalars for O(1) space.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    hold = -prices[0]   # holding stock, best cumulative profit so far
    sold = 0            # just sold today -- tomorrow is a forced cooldown
    rest = 0            # not holding, cooldown (if any) has already elapsed

    for price in prices[1:]:
        prev_hold, prev_sold, prev_rest = hold, sold, rest
        hold = max(prev_hold, prev_rest - price)   # keep holding, or buy today
        sold = prev_hold + price                    # sell what we were holding
        rest = max(prev_rest, prev_sold)             # stay resting, or cooldown just ended

    return max(sold, rest)   # best final state is never HOLD -- must exit to realize profit

print(max_profit_with_cooldown([1, 2, 3, 0, 2]))   # 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260912-gamblers-ruin-take-profit",
    title: "Probability of Hitting Take-Profit Before Stop-Loss",
    difficulty: "medium",
    topics: ["probability", "markov-chain", "math"],
    problem:
      "A position's mark-to-market P&L moves in discrete unit ticks: up one tick with probability p, down one tick with probability 1-p, independently each tick. Starting at P&L 0, the position is closed the instant P&L first hits either +a ticks (take-profit) or -b ticks (stop-loss). Compute, in closed form -- no simulation -- the probability that take-profit is hit first.",
    examples: [
      {
        input: "a=3, b=2, p=0.5",
        output: "0.4",
        explanation: "For a fair walk (p=0.5) the general gambler's-ruin formula has a removable 0/0 singularity whose limit is the simple linear ratio b / (a + b) = 2/5 = 0.4.",
      },
      {
        input: "a=3, b=2, p=0.6",
        output: "0.6398",
        explanation: "With p != 0.5, use the ratio q/p raised to the barrier distances in the general closed form; the upward drift raises the take-profit probability well above the fair-coin value of 0.4.",
      },
    ],
    constraints: ["1 <= a, b <= 10^6", "0 < p < 1"],
    approach:
      "This is the classic gambler's ruin problem: a random walk absorbed at two barriers. Shift coordinates so the walk starts at state b out of a total range of a+b (0 = stop-loss barrier, a+b = take-profit barrier). For p != 1-p, the probability of reaching the top barrier before the bottom one, starting at position i, has the closed form (1 - (q/p)^i) / (1 - (q/p)^N) where q=1-p and N is the total distance between barriers -- substitute i=b, N=a+b. For the fair case p=0.5 that expression is 0/0, so use its limiting value instead: since a fair random walk is a martingale, the optional stopping theorem gives a * P(take-profit) - b * P(stop-loss) = 0 directly, which combined with the two probabilities summing to 1 yields the simple ratio b / (a+b) with no limit-taking required in code.",
    code: `def prob_take_profit_first(a: int, b: int, p: float) -> float:
    if abs(p - 0.5) < 1e-12:
        # fair-walk case: optional stopping theorem gives the linear ratio
        # directly, sidestepping the 0/0 indeterminate form below
        return b / (a + b)

    q = 1 - p
    ratio = q / p
    # gambler's ruin closed form, shifted so the walk starts at position b
    # within a barrier range of width a + b
    return (1 - ratio ** b) / (1 - ratio ** (a + b))

print(round(prob_take_profit_first(3, 2, 0.5), 4))   # 0.4
print(round(prob_take_profit_first(3, 2, 0.6), 4))   # 0.6398`,
    language: "python",
    complexity: { time: "O(log(a+b)) for the power operations", space: "O(1)" },
  },
  {
    id: "lc-20260912-fifo-position-tracker",
    title: "Design a FIFO Position Tracker With Realized P&L",
    difficulty: "medium",
    topics: ["design", "queue"],
    problem:
      "Design a class that tracks a single instrument's position using FIFO lot accounting. Implement buy(qty, price) to add a new lot, and sell(qty, price), which consumes the OLDEST open lots first and returns the realized P&L generated by the sale, computed against each consumed lot's own original cost (not a blended average). Also expose get_position(), returning the current total open quantity and its quantity-weighted average remaining cost basis. Assume a sell never exceeds the currently open quantity.",
    examples: [
      {
        input: "buy(100,10.0); buy(50,12.0); sell(120,15.0)",
        output: "realized P&L = 560.0; get_position() = (30, 12.0)",
        explanation:
          "The sell of 120 first fully consumes the oldest lot, 100 shares at cost 10.0, for a profit of (15-10)*100=500, then consumes 20 of the 50 shares from the next lot at cost 12.0, for a profit of (15-12)*20=60. Total realized 560.0, leaving 30 shares of the second lot still open at its original cost of 12.0.",
      },
    ],
    constraints: ["up to 10^5 total buy/sell calls", "sell quantity never exceeds currently open quantity", "quantities and prices are positive"],
    approach:
      "Maintain a deque of [quantity, cost] lots in arrival order, oldest at the front. A buy simply appends a new lot to the back -- O(1). A sell repeatedly peeks at the front lot, consumes as much of it as needed (capped by the lot's own remaining quantity), accumulates realized P&L as (sell_price - lot_cost) times the consumed amount, and pops that lot once it is fully drained, continuing until the requested sell quantity is satisfied. Because each lot is popped at most once across its entire lifetime, the amortized cost of a sell that spans m lots is O(m), never O(n) over the whole position history. get_position simply sums the remaining lots' quantities and value for a reporting-level weighted average -- FIFO order only matters for computing realized P&L on a sell, not for describing the aggregate remaining position.",
    code: `from collections import deque

class FIFOPositionTracker:
    def __init__(self):
        self.lots: deque[list[float]] = deque()   # [qty, cost], oldest at the front

    def buy(self, qty: float, price: float) -> None:
        self.lots.append([qty, price])

    def sell(self, qty: float, price: float) -> float:
        realized = 0.0
        remaining = qty
        while remaining > 0:
            lot_qty, lot_cost = self.lots[0]
            consumed = min(lot_qty, remaining)
            realized += (price - lot_cost) * consumed
            remaining -= consumed
            if consumed == lot_qty:
                self.lots.popleft()            # this lot is now fully used up
            else:
                self.lots[0][0] -= consumed     # partially consumed, stays at the front
        return realized

    def get_position(self) -> tuple[float, float]:
        total_qty = sum(q for q, _ in self.lots)
        if total_qty == 0:
            return (0, 0.0)
        total_cost = sum(q * c for q, c in self.lots)
        return (total_qty, total_cost / total_qty)

tracker = FIFOPositionTracker()
tracker.buy(100, 10.0)
tracker.buy(50, 12.0)
print(tracker.sell(120, 15.0))     # 560.0
print(tracker.get_position())      # (30, 12.0)`,
    language: "python",
    complexity: { time: "O(1) amortized per unit of quantity touched", space: "O(number of open lots)" },
  },
];
