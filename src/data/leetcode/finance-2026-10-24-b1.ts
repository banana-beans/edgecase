import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-24
// K closest trade prices to a reference (heap), shortest window
// of fills that flattens a running position (prefix-sum/hash-map),
// max combined P&L from two non-overlapping fixed-length trading
// windows (DP), gambler's-ruin expected trades to profit target
// or stop loss (probability/Markov), and a weighted-average-cost
// position tracker (design).
// ============================================================

export const financeBatch20261024: LeetCodeProblem[] = [
  {
    id: "lc-20261024-k-closest-trades-to-reference-price",
    title: "K Closest Executed Trade Prices to a Reference Price",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given an array of this session's executed trade prices and a reference price (e.g. a theoretical fair value), return the k trade prices closest to the reference, in any order.",
    examples: [
      {
        input: "prices = [186.40, 187.10, 185.90, 188.00, 187.05], ref = 187.00, k = 3",
        output: "[186.40, 187.05, 187.10]",
        explanation:
          "Distances from 187.00 are 0.60, 0.10, 1.10, 1.00, 0.05 -- the three smallest belong to 187.05, 187.10, and 186.40.",
      },
    ],
    constraints: ["1 <= k <= prices.length <= 10^5"],
    approach:
      "This is the 'k closest' pattern: maintain a bounded max-heap of size k, keyed by distance from the reference (negated, so the heap's top is always the current FARTHEST of the k best candidates kept so far). Push every price in; whenever the heap exceeds size k, pop the top, discarding whichever candidate is currently farthest from the reference. Because the heap never holds more than k elements, this costs O(n log k) instead of the O(n log n) a full sort would cost -- a meaningful difference when k is small relative to the number of trades in the session.",
    code: `import heapq

def k_closest_trade_prices(prices: list[float], ref: float, k: int) -> list[float]:
    # max-heap (via negated distance) holding only the k best candidates seen so far
    heap: list[tuple[float, float]] = []
    for p in prices:
        dist = abs(p - ref)
        heapq.heappush(heap, (-dist, p))
        if len(heap) > k:
            heapq.heappop(heap)   # discard the current farthest-from-ref candidate

    return [p for _, p in heap]

result = k_closest_trade_prices([186.40, 187.10, 185.90, 188.00, 187.05], ref=187.00, k=3)
print(sorted(result))
# [186.4, 187.05, 187.1]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
    leetcodeNumber: 973,
  },
  {
    id: "lc-20261024-shortest-window-flatten-position",
    title: "Shortest Contiguous Window of Fills That Flattens a Running Position to Zero",
    difficulty: "hard",
    topics: ["prefix-sum", "hash-map", "sliding-window"],
    problem:
      "Given an array of signed share deltas from a sequence of fills (positive = buy, negative = sell), find the length of the shortest contiguous window whose deltas sum to exactly zero (the position taken on during that window is fully flat by its end). Return -1 if no such window exists.",
    examples: [
      {
        input: "deltas = [100, -50, -50, 30, -30]",
        output: "2",
        explanation:
          "deltas[0:3] = [100, -50, -50] sums to 0 (length 3), but deltas[3:5] = [30, -30] also sums to 0 and is shorter, at length 2.",
      },
    ],
    constraints: ["1 <= deltas.length <= 10^5", "-10^4 <= deltas[i] <= 10^4"],
    approach:
      "Build prefix sums and look for two equal prefix-sum values -- the window between them sums to zero. The subtlety versus the 'longest zero-sum subarray' version of this problem: that one keeps the EARLIEST index seen for each prefix-sum value (to maximize window length), but this one wants the SHORTEST window, so it must keep the MOST RECENT index seen for each prefix-sum value and update it every time that value recurs. Each index is compared against the closest prior occurrence of its own prefix sum, which is what minimizes the candidate window length, and the running best is updated in a single O(n) pass.",
    code: `def shortest_window_to_flatten(deltas: list[int]) -> int:
    n = len(deltas)
    prefix = 0
    # most recent index at which each prefix-sum value was seen -- NOT the earliest,
    # since the closest prior occurrence gives the shortest window, not the longest
    last_seen: dict[int, int] = {0: -1}
    best = float("inf")

    for i, d in enumerate(deltas):
        prefix += d
        if prefix in last_seen:
            best = min(best, i - last_seen[prefix])
        last_seen[prefix] = i   # always overwrite with the latest index for this prefix sum

    return -1 if best == float("inf") else best

print(shortest_window_to_flatten([100, -50, -50, 30, -30]))
# 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-20261024-max-sum-two-non-overlapping-trading-windows",
    title: "Maximum Combined P&L From Two Non-Overlapping Trading Windows of Fixed Lengths",
    difficulty: "hard",
    topics: ["dynamic-programming", "prefix-sum"],
    problem:
      "Given a daily P&L array and two window lengths, firstLen and secondLen, choose a length-firstLen window and a length-secondLen window that do not overlap (in either order) to maximize their combined sum.",
    examples: [
      {
        input: "pnl = [2,1,5,6,0,9,5], firstLen = 1, secondLen = 2",
        output: "20",
        explanation:
          "The length-1 window [9] (index 5) and the length-2 window [5,6] (indices 2-3) do not overlap and sum to 9 + 11 = 20, the best achievable combination.",
      },
    ],
    constraints: ["2 <= pnl.length <= 1000", "1 <= firstLen, secondLen <= 1000", "firstLen + secondLen <= pnl.length"],
    approach:
      "Precompute prefix sums for O(1) range-sum lookups. Because the two windows can appear in either order, write a helper best(a, b) that scans every split point where a length-a window ends strictly before a length-b window begins, tracking the best length-a window sum seen SO FAR (as the right edge advances) and combining it with each new length-b window sum at the current position. Running best(firstLen, secondLen) handles 'first window before second' and best(secondLen, firstLen) handles the reverse order; taking the max of both covers every valid non-overlapping placement in O(n) total.",
    code: `def max_sum_two_non_overlapping(pnl: list[int], first_len: int, second_len: int) -> int:
    n = len(pnl)
    prefix = [0] * (n + 1)
    for i, x in enumerate(pnl):
        prefix[i + 1] = prefix[i] + x

    def best(a: int, b: int) -> int:
        # max combined sum where a length-a window ends at or before a length-b window begins
        best_a = 0
        result = 0
        for i in range(a + b, n + 1):
            # best length-a window fully contained in everything before the current length-b window
            best_a = max(best_a, prefix[i - b] - prefix[i - b - a])
            b_sum = prefix[i] - prefix[i - b]
            result = max(result, best_a + b_sum)
        return result

    # the two windows can appear in either order -- try both and keep the better one
    return max(best(first_len, second_len), best(second_len, first_len))

print(max_sum_two_non_overlapping([2, 1, 5, 6, 0, 9, 5], first_len=1, second_len=2))
# 20`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
    leetcodeNumber: 1477,
  },
  {
    id: "lc-20261024-gamblers-ruin-expected-trades-profit-target-stop-loss",
    title: "Expected Number of Trades Until a Strategy Hits Its Profit Target or Stop Loss",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "A strategy's cumulative P&L moves up one unit with probability p or down one unit with probability 1-p on each trade, independently. Trading stops the moment cumulative P&L reaches +target (profit target) or -stopLoss (stop loss). Compute the probability the profit target is hit first, and the expected number of trades until the strategy stops.",
    examples: [
      {
        input: "p = 0.5, target = 5, stopLoss = 5",
        output: "prob_target_first = 0.5, expected_trades = 25.0",
        explanation:
          "For a fair (p = 0.5) walk this is the classic gambler's ruin: by symmetry the target and stop loss are equally likely to be hit first, and the expected duration is target * stopLoss.",
      },
    ],
    constraints: ["0 < p < 1", "1 <= target, stopLoss <= 10^4"],
    approach:
      "This is gambler's ruin on the integers with absorbing barriers. Shift coordinates so 0 represents the stop-loss boundary and n = target + stopLoss represents the profit-target boundary, with the walk starting at i = stopLoss. The classical closed forms (Feller): for p != 1-p, letting r = (1-p)/p, the probability of reaching n before 0 starting at i is (1 - r^i) / (1 - r^n), and the expected number of steps to absorption is i/(1-2p) - (n/(1-2p)) * (1 - r^i)/(1 - r^n). For the symmetric case p = 0.5 both formulas degenerate to 0/0 and have separate closed forms: probability i/n, and expected duration i*(n-i). Coding both branches explicitly avoids a numerically unstable 0/0 near p = 0.5.",
    code: `def gamblers_ruin_stats(p: float, target: int, stop_loss: int) -> tuple[float, float]:
    # shift coordinates: 0 = stop-loss boundary, n = profit-target boundary, start at i = stop_loss
    q = 1 - p
    i, n = stop_loss, target + stop_loss

    if p == q:
        # the symmetric case has its own closed form -- the general formula is 0/0 here
        prob_target_first = i / n
        expected_trades = i * (n - i)
    else:
        r = q / p
        prob_target_first = (1 - r**i) / (1 - r**n)
        expected_trades = i / (q - p) - (n / (q - p)) * (1 - r**i) / (1 - r**n)

    return prob_target_first, expected_trades

print(gamblers_ruin_stats(p=0.5, target=5, stop_loss=5))
# (0.5, 25.0)
print(gamblers_ruin_stats(p=0.55, target=5, stop_loss=5))
# a slight positive edge tilts the probability above 0.5 and shortens the expected wait`,
    language: "python",
    complexity: { time: "O(1) per query (iterative power, not recursion)", space: "O(1)" },
  },
  {
    id: "lc-20261024-design-position-tracker-weighted-avg-cost",
    title: "Design a Position Tracker With Weighted-Average Cost Basis and Realized P&L on Partial Sells",
    difficulty: "medium",
    topics: ["design", "hash-map"],
    problem:
      "Design a class PositionTracker with buy(qty, price), which adds to the position using weighted-average cost accounting, and sell(qty, price), which reduces the position and returns the realized P&L for that sell. Also support get_position(), returning (qty, avg_cost).",
    examples: [
      {
        input: "buy(100, 50.0); buy(100, 60.0); sell(50, 70.0); get_position()",
        output: "sell returns 750.0; get_position returns (150, 55.0)",
        explanation:
          "Two buys blend to an average cost of 55.0 for 200 shares; selling 50 at 70.0 realizes (70 - 55) * 50 = 750.0 profit, and the remaining 150 shares keep the same 55.0 average cost.",
      },
    ],
    constraints: ["up to 10^5 calls to buy/sell", "a sell never exceeds the current open quantity"],
    approach:
      "A buy blends the new lot's cost into the existing position's weighted-average cost: new_avg_cost = (old_avg_cost * old_qty + price * qty) / (old_qty + qty). A sell realizes P&L against the CURRENT average cost -- (sell_price - avg_cost) * qty -- and reduces quantity, but crucially does NOT change avg_cost for the shares that remain open; only a new buy changes the average cost. If the position fully closes (qty reaches 0), the average cost resets to zero rather than sticking at its last value, since there's no open lot left for it to describe.",
    code: `class PositionTracker:
    def __init__(self) -> None:
        self.qty = 0
        self.avg_cost = 0.0

    def buy(self, qty: int, price: float) -> None:
        # weighted-average cost basis: blend the new lot's cost into the existing position
        new_qty = self.qty + qty
        self.avg_cost = (self.avg_cost * self.qty + price * qty) / new_qty
        self.qty = new_qty

    def sell(self, qty: int, price: float) -> float:
        if qty > self.qty:
            raise ValueError("cannot sell more than the current open position")
        # realized P&L uses the CURRENT weighted-average cost -- unaffected by the sell itself
        realized_pnl = (price - self.avg_cost) * qty
        self.qty -= qty
        if self.qty == 0:
            self.avg_cost = 0.0   # no open lots left -- cost basis resets, it doesn't "stick"
        return realized_pnl

    def get_position(self) -> tuple[int, float]:
        return self.qty, self.avg_cost

tracker = PositionTracker()
tracker.buy(100, 50.0)        # avg cost 50.0
tracker.buy(100, 60.0)        # avg cost blends to 55.0
print(tracker.get_position())            # (200, 55.0)
print(tracker.sell(50, 70.0))            # realized P&L = (70 - 55) * 50 = 750.0
print(tracker.get_position())            # (150, 55.0) -- avg cost unchanged by a sell`,
    language: "python",
    complexity: { time: "O(1) per operation", space: "O(1)" },
  },
];
