import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-14
// A heap-based kth-largest trade size tracker, a variable-size
// sliding window bounded by a volatility threshold, buy/sell
// stock with a cooldown period, a finite-horizon DP for ruin
// probability on a biased walk, and a FIFO-lot position tracker
// with realized P&L accounting.
// ============================================================

export const financeBatch20260914: LeetCodeProblem[] = [
  {
    id: "lc-20260914-kth-largest-trade-size",
    title: "Kth Largest Trade Size in a Live Stream",
    difficulty: "medium",
    topics: ["heap", "design"],
    problem:
      "Design a class that ingests a live stream of trade sizes one at a time via add(size), and after each addition returns the Kth largest trade size seen so far (K is fixed at construction). Assume at least K trades have already arrived before the first query that matters.",
    examples: [
      {
        input: "k=3; add(50) -> 50; add(200) -> None; add(120) -> 50; add(80) -> 80; add(300) -> 120",
        output: "the running 3rd-largest after each add",
        explanation:
          "After [50,200,120] the 3rd largest of {50,120,200} is 50. After adding 80, {80,120,200} makes the 3rd largest 80. After adding 300, {120,200,300} makes it 120.",
      },
    ],
    constraints: ["1 <= k <= 10^4", "up to 10^5 total add calls", "trade sizes are positive integers"],
    approach:
      "Maintain a min-heap capped at exactly K elements -- the smallest element in that heap is always the current Kth largest overall, because every element NOT in the heap is smaller than everything that is. On each add: push the new size, and if the heap now holds more than K elements, pop the minimum (it can no longer be the Kth largest once K+1 or more larger-or-equal candidates exist). The top of the heap after this maintenance step is the answer, in O(log k) per add instead of re-sorting the full history on every query.",
    code: `import heapq

class KthLargestTrade:
    def __init__(self, k: int):
        self.k = k
        self.heap: list[int] = []   # min-heap, capped at size k

    def add(self, size: int) -> int | None:
        heapq.heappush(self.heap, size)
        # once more than k trades tracked, the smallest can never be
        # the kth largest again -- drop it permanently
        if len(self.heap) > self.k:
            heapq.heappop(self.heap)
        # fewer than k trades seen so far: no kth-largest exists yet
        return self.heap[0] if len(self.heap) == self.k else None

kth = KthLargestTrade(3)
for size in [50, 200, 120, 80, 300]:
    print(kth.add(size))
# None, 50, 50, 80, 120`,
    language: "python",
    complexity: { time: "O(log k) per add", space: "O(k)" },
  },
  {
    id: "lc-20260914-longest-low-volatility-window",
    title: "Longest Window With Realized Volatility Below a Threshold",
    difficulty: "medium",
    topics: ["sliding-window", "two-pointer"],
    problem:
      "Given an array of daily returns and a volatility cap, return the length of the longest contiguous subarray whose standard deviation is at most the cap. Standard deviation must be recomputed for the actual window in question, not approximated.",
    examples: [
      {
        input: "returns=[0.01,-0.01,0.02,-0.15,0.01,0.00,-0.01], cap=0.03",
        output: "4",
        explanation:
          "The window [0.01,0.00,-0.01] plus one more calm day, or the leading [0.01,-0.01,0.02] extended, tops out at length 4 once the -0.15 outlier is excluded -- including it in any window blows the std well past the cap.",
      },
    ],
    constraints: ["1 <= returns.length <= 10^5", "cap > 0"],
    approach:
      "A plain two-pointer/expand-and-shrink window doesn't directly work here because standard deviation is not monotonic under element removal the way a sum or max is -- shrinking the window from the left can, in principle, still leave the std above the cap depending on which values remain. The practical fix used in interviews: maintain running sum and running sum-of-squares for O(1) mean/variance updates as the right pointer expands, and when the window's std exceeds the cap, shrink from the left one step at a time, updating both running sums, until it's back under the cap or the window is empty. This keeps each pointer moving strictly forward across the whole pass, giving amortized O(n) despite the repeated shrink checks, since each element enters and leaves the window at most once.",
    code: `import math

def longest_low_vol_window(returns: list[float], cap: float) -> int:
    n = len(returns)
    left = 0
    running_sum = 0.0
    running_sq = 0.0
    best = 0

    def std(count: int) -> float:
        if count < 2:
            return 0.0
        mean = running_sum / count
        var = running_sq / count - mean ** 2
        return math.sqrt(max(var, 0.0))   # clamp tiny negative float noise

    for right in range(n):
        running_sum += returns[right]
        running_sq += returns[right] ** 2

        # shrink from the left until the window is back under the cap;
        # each index leaves the window at most once across the whole pass
        while std(right - left + 1) > cap:
            running_sum -= returns[left]
            running_sq -= returns[left] ** 2
            left += 1

        best = max(best, right - left + 1)

    return best

print(longest_low_vol_window([0.01, -0.01, 0.02, -0.15, 0.01, 0.00, -0.01], 0.03))   # 4`,
    language: "python",
    complexity: { time: "O(n) amortized", space: "O(1)" },
  },
  {
    id: "lc-20260914-stock-cooldown",
    title: "Maximum Profit With Unlimited Trades and a One-Day Cooldown",
    difficulty: "medium",
    topics: ["dynamic-programming", "state-machine"],
    problem:
      "Given daily prices for one instrument, you may buy and sell as many times as you like (never holding more than one unit at a time), but after selling you must wait one full day before buying again. Return the maximum total profit achievable.",
    examples: [
      {
        input: "prices=[1,2,3,0,2]",
        output: "3",
        explanation:
          "Buy at 1, sell at 2 (profit 1), cooldown on day index 2, buy at 0, sell at 2 (profit 2): total 3. Selling at 3 first looks tempting but the mandatory cooldown after any sell forces missing the 0->2 leg entirely.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000", "0 <= prices[i] <= 1000"],
    approach:
      "Classic three-state DP over each day: held (currently holding a share), sold (just sold today, so tomorrow is forced cooldown), and rest (not holding, free to buy tomorrow -- either never bought, or it's been at least a day since a sale). Transitions: held[t] is either held[t-1] (keep holding) or rest[t-1] minus price[t] (buy today, only legal from rest, never straight from sold); sold[t] is held[t-1] plus price[t] (sell today); rest[t] is max(rest[t-1], sold[t-1]) (stay resting, or yesterday's sale just finished its cooldown). The answer is the best of sold and rest on the final day, since ending while still holding is never optimal for realized profit.",
    code: `def max_profit_with_cooldown(prices: list[float]) -> float:
    if not prices:
        return 0.0

    NEG_INF = float("-inf")
    held, sold, rest = -prices[0], 0.0, 0.0   # state after day 0

    for price in prices[1:]:
        prev_held, prev_sold, prev_rest = held, sold, rest
        # buy today only from "rest" -- a fresh sale must cool down first
        held = max(prev_held, prev_rest - price)
        sold = prev_held + price
        rest = max(prev_rest, prev_sold)

    return max(sold, rest)   # ending still holding is never optimal

print(max_profit_with_cooldown([1, 2, 3, 0, 2]))   # 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260914-finite-horizon-ruin-probability",
    title: "Probability of Hitting a Stop-Loss Before a Take-Profit Within N Ticks",
    difficulty: "medium",
    topics: ["dynamic-programming", "probability"],
    problem:
      "A position's P&L moves up one tick with probability p and down one tick with probability 1-p, starting at 0. Given a stop-loss at -b, a take-profit at +a, and a maximum horizon of N ticks after which the position is flattened at whatever level it's at (neither barrier counted as hit), compute the probability the stop-loss is hit strictly before the take-profit and before the horizon runs out.",
    examples: [
      {
        input: "a=2, b=2, p=0.5, n=3",
        output: "0.375",
        explanation:
          "With only 3 ticks available and symmetric barriers 2 ticks away, several paths never reach either barrier in time (e.g. up-down-up ends at +1, no barrier hit) -- unlike the unbounded gambler's-ruin formula, the finite horizon leaves real probability mass on 'neither hit yet.'",
      },
    ],
    constraints: ["1 <= a, b <= 200", "1 <= n <= 500", "0 < p < 1"],
    approach:
      "Unlike the closed-form infinite-horizon gambler's ruin, a FINITE step budget has no simple closed form because 'neither barrier hit within N ticks' is a real outcome with positive probability, not a measure-zero edge case -- so solve it with DP over (ticks remaining, current position). Let dp[t][i] be the probability of eventually hitting the lower barrier before the upper one, starting from position i with t ticks left: dp[0][i] = 0 for any i strictly between the barriers (horizon expired with neither hit), dp[t][-b] = 1, dp[t][a] = 0 for all t, and otherwise dp[t][i] = p*dp[t-1][i+1] + (1-p)*dp[t-1][i-1]. Iterate t from 1 to N, reusing a rolling array indexed by position shifted into range [0, a+b].",
    code: `def ruin_probability_finite_horizon(a: int, b: int, p: float, n: int) -> float:
    width = a + b + 1          # positions from -b to +a, shifted to [0, width-1]
    start = b                  # position 0 shifted by +b
    lower_idx, upper_idx = 0, width - 1

    # dp[i]: probability of hitting the LOWER barrier before the upper
    # one, from shifted position i, with the ticks-remaining budget
    # processed so far (starts as the t=0 base case: no ticks left)
    dp = [0.0] * width   # t=0: horizon expired everywhere -> prob 0

    for _t in range(1, n + 1):
        new_dp = [0.0] * width
        new_dp[lower_idx] = 1.0   # already at the stop-loss: certain hit
        new_dp[upper_idx] = 0.0   # already at the take-profit: certain miss
        for i in range(1, width - 1):
            new_dp[i] = p * dp[i + 1] + (1 - p) * dp[i - 1]
        dp = new_dp

    return dp[start]

print(round(ruin_probability_finite_horizon(2, 2, 0.5, 3), 3))   # 0.375`,
    language: "python",
    complexity: { time: "O(n * (a + b))", space: "O(a + b)" },
  },
  {
    id: "lc-20260914-fifo-position-tracker",
    title: "Design a FIFO-Lot Position Tracker With Realized P&L",
    difficulty: "hard",
    topics: ["design", "queue"],
    problem:
      "Design a class tracking a single instrument's position that supports trade(qty, price) (positive qty buys, negative qty sells) and realized_pnl(), returning cumulative realized profit and loss to date. Closing trades must be matched against opening lots on a FIFO basis: the oldest still-open lot is closed first, partial fills split a lot, and a trade that flips the position from long to short (or vice versa) closes out all existing lots before opening a new one on the other side.",
    examples: [
      {
        input: "trade(100,10.0); trade(50,12.0); trade(-120,11.0)",
        output: "realized_pnl() -> 80.0",
        explanation:
          "The sell of 120 consumes FIFO: the oldest lot (100 @ 10.0) closes first for a profit of 100*(11-10)=100, then 20 of the 50 @ 12.0 lot closes for 20*(11-12)=-20, leaving 30 still open at 12.0. Net realized profit is 100-20=80; closing the 12.0 lot first instead (ignoring FIFO order) would have given a different, wrong number.",
      },
    ],
    constraints: ["up to 10^5 total trade calls", "prices are positive", "position may go long, flat, or short over time"],
    approach:
      "Keep a deque of open lots as (quantity, price) pairs, always FIFO-ordered by entry time. A trade whose sign is OPPOSITE the current net position direction closes lots from the front of the deque: match against the oldest lot's remaining quantity, book qty_matched * (trade_price - lot_price) times the position's original sign as realized P&L, shrink or pop that lot, and continue consuming the trade's remaining quantity against the next-oldest lot. If the trade's quantity outlasts every existing lot (a flip from long to short or vice versa), the leftover, after closing everything, opens a brand-new lot on the other side. A trade whose sign MATCHES the current position (or the position is flat) simply appends a new lot -- no closing occurs.",
    code: `from collections import deque

class FifoPositionTracker:
    def __init__(self):
        self.lots: deque[list[float]] = deque()   # [qty, price], FIFO order; qty always > 0
        self.side = 0        # +1 long, -1 short, 0 flat
        self.pnl = 0.0

    def trade(self, qty: float, price: float) -> None:
        trade_side = 1 if qty > 0 else -1
        remaining = abs(qty)

        # opposite (or closing) side of the current position: consume
        # open lots FIFO before any new lot can be opened
        if self.side != 0 and trade_side != self.side:
            while remaining > 0 and self.lots:
                lot_qty, lot_price = self.lots[0]
                matched = min(remaining, lot_qty)
                # position's ORIGINAL side determines the P&L sign:
                # a long lot profits when trade_price > lot_price
                self.pnl += matched * (price - lot_price) * self.side
                lot_qty -= matched
                remaining -= matched
                if lot_qty == 0:
                    self.lots.popleft()
                else:
                    self.lots[0][0] = lot_qty

            if not self.lots:
                self.side = 0

        # any leftover quantity (same-side trade, or a flip past flat)
        # opens a new lot on the trade's own side
        if remaining > 0:
            self.side = trade_side
            self.lots.append([remaining, price])

    def realized_pnl(self) -> float:
        return self.pnl

tracker = FifoPositionTracker()
tracker.trade(100, 10.0)
tracker.trade(50, 12.0)
tracker.trade(-120, 11.0)
print(round(tracker.realized_pnl(), 2))   # 80.0: 100@(11-10) + 20@(11-12)`,
    language: "python",
    complexity: { time: "O(1) amortized per trade", space: "O(open lots)" },
  },
];
