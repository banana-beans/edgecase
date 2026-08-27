import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-27
// A two-heap running median of a live trade tape, a monotonic-
// deque sliding-window maximum for a trailing high-water-mark
// alert, an at-most-K-transactions stock DP, a gambler's-ruin
// probability problem for a market maker's inventory band, and
// a price-time-priority limit order matching engine design.
// ============================================================

export const financeBatch20260827: LeetCodeProblem[] = [
  {
    id: "lc-live-median-trade-price",
    title: "Running Median of a Live Trade Price Stream (Two Heaps)",
    difficulty: "medium",
    topics: ["heap", "design"],
    problem:
      "Design a structure that ingests trade prices one at a time from a live tape via add(price) and can report the median of all prices seen so far via median(), without re-sorting the full history on every call.",
    examples: [
      {
        input: "add(5); add(2); median(); add(8); median()",
        output: "3.5, 5.0",
        explanation:
          "After [5,2] the sorted history is [2,5], median 3.5. After [5,2,8] the sorted history is [2,5,8], median 5.0.",
      },
    ],
    constraints: ["1 <= number of calls <= 10^5", "0 < price <= 10^6"],
    approach:
      "Split the stream across two heaps: a max-heap holding the lower half of prices seen so far, and a min-heap holding the upper half, kept balanced so their sizes differ by at most one. Each add() pushes into one heap and then, if that unbalances the sizes by more than one or violates the ordering (the max-heap's top exceeding the min-heap's top), moves one element across to restore both invariants -- two O(log n) heap operations per add. With the invariant held, median() is O(1): either the larger heap's top (odd total count) or the average of both tops (even total count), with no scan or sort ever needed.",
    code: `import heapq

class RunningMedian:
    def __init__(self):
        self.lower: list[float] = []   # max-heap (negated) -- smaller half
        self.upper: list[float] = []   # min-heap -- larger half

    def add(self, price: float) -> None:
        # route into the correct half by comparing to the current split point
        if self.lower and price > -self.lower[0]:
            heapq.heappush(self.upper, price)
        else:
            heapq.heappush(self.lower, -price)

        # rebalance so sizes never differ by more than one
        if len(self.lower) > len(self.upper) + 1:
            heapq.heappush(self.upper, -heapq.heappop(self.lower))
        elif len(self.upper) > len(self.lower):
            heapq.heappush(self.lower, -heapq.heappop(self.upper))

    def median(self) -> float:
        if len(self.lower) > len(self.upper):
            return -self.lower[0]
        return (-self.lower[0] + self.upper[0]) / 2.0

tape = RunningMedian()
for p in [5, 2]:
    tape.add(p)
print(tape.median())   # 3.5
tape.add(8)
print(tape.median())   # 5.0`,
    language: "python",
    complexity: { time: "O(log n) per add, O(1) per median", space: "O(n)" },
  },
  {
    id: "lc-rolling-high-water-mark",
    title: "Rolling High-Water-Mark Alert over a Sliding Tick Window",
    difficulty: "medium",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given a sequence of price ticks and a window size w, compute, for every window of w consecutive ticks, the maximum price in that window -- a rolling high-water mark used to trigger a trailing-stop alert -- in a single pass rather than rescanning each window from scratch.",
    examples: [
      {
        input: "ticks=[3,1,4,1,5,9,2,6], w=3",
        output: "[4,4,5,9,9,9]",
        explanation:
          "The window [3,1,4] has max 4, [1,4,1] has max 4, [4,1,5] has max 5, and so on through the final window [9,2,6] with max 9 -- six windows total for 8 ticks and w=3.",
      },
    ],
    constraints: ["1 <= number of ticks <= 10^5", "1 <= w <= number of ticks"],
    approach:
      "Recomputing the max of each window from scratch is O(n*w); instead maintain a deque of tick INDICES whose prices are strictly decreasing front-to-back, which makes the front always the index of the current window's maximum. On each new tick, pop from the back any indices whose price is <= the new price -- they can never be the max again while this new, later, higher-or-equal tick is still in play -- then push the new index. Separately pop from the front any index that has fallen outside the current window. Because each index is pushed once and popped at most once across the whole scan, the total work is O(n) despite the nested-looking loops.",
    code: `from collections import deque

def rolling_high_water_mark(ticks: list[float], w: int) -> list[float]:
    dq: deque[int] = deque()   # indices, prices strictly decreasing front-to-back
    result = []

    for i, price in enumerate(ticks):
        # a later tick that's >= a queued one makes the queued one irrelevant
        while dq and ticks[dq[-1]] <= price:
            dq.pop()
        dq.append(i)

        # drop the front if it has aged out of the current window
        if dq[0] <= i - w:
            dq.popleft()

        if i >= w - 1:
            result.append(ticks[dq[0]])   # front is always the window's max

    return result

print(rolling_high_water_mark([3, 1, 4, 1, 5, 9, 2, 6], w=3))
# [4, 4, 5, 9, 9, 9]`,
    language: "python",
    complexity: { time: "O(n)", space: "O(w)" },
  },
  {
    id: "lc-max-profit-at-most-k-trades",
    title: "Maximum Profit with At Most K Trades",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given a name's daily closing prices over n days and an integer k, find the maximum profit achievable using at most k buy-then-sell transactions, where you must sell (and the position must be flat) before buying again, and you can hold at most one unit of position at a time.",
    examples: [
      {
        input: "prices=[3,2,6,5,0,3], k=2",
        output: "7",
        explanation:
          "Buy at 2, sell at 6 (profit 4), then buy at 0, sell at 3 (profit 3), for a total of 7 using exactly 2 of the allowed 2 transactions -- no combination of at most 2 trades beats this.",
      },
    ],
    constraints: ["1 <= n <= 1000", "0 <= k <= 100", "0 <= price[i] <= 10^4"],
    approach:
      "Track two rolling arrays over t = 1..k transactions: hold[t] = best profit on a day where you currently hold a position having started your t-th buy, and cash[t] = best profit on a day where you're flat having completed your t-th sell. Each day's price updates both: hold[t] = max(hold[t], cash[t-1] - price) (either keep holding from before, or just spent this t-th buy funded by profit banked after t-1 sells), and cash[t] = max(cash[t], hold[t] + price) (either stay flat, or sell today to close the t-th trade). This is O(n*k), but if k >= n/2 no capacity constraint can ever bind -- you could trade every single up-move -- so fall back to the unconstrained greedy (sum every positive day-over-day change) to avoid a wasted O(n^2) blowup when k is large.",
    code: `def max_profit_k_trades(prices: list[int], k: int) -> int:
    n = len(prices)
    if n < 2 or k == 0:
        return 0

    # k unconstrained relative to n: capacity never binds, so just
    # capture every positive day-over-day move -- avoids O(n*k) blowup
    if k >= n // 2:
        return sum(max(0, prices[i] - prices[i - 1]) for i in range(1, n))

    hold = [float("-inf")] * (k + 1)   # holding a position after t-th buy
    cash = [0] * (k + 1)               # flat after t-th sell

    for price in prices:
        for t in range(1, k + 1):
            hold[t] = max(hold[t], cash[t - 1] - price)
            cash[t] = max(cash[t], hold[t] + price)

    return cash[k]

print(max_profit_k_trades([3, 2, 6, 5, 0, 3], k=2))   # 7`,
    language: "python",
    complexity: { time: "O(n*k), O(n) when k >= n/2", space: "O(k)" },
  },
  {
    id: "lc-gamblers-ruin-inventory-band",
    title: "Probability a Market Maker's Inventory Hits the Upper Risk Limit First",
    difficulty: "medium",
    topics: ["probability", "random-walk"],
    problem:
      "A market maker's inventory moves by +1 with probability p (a buy fill) or -1 with probability 1-p (a sell fill) with each incoming order, independent of history. Risk limits force the desk to stop and de-risk once inventory hits either 0 or N. Starting from an inventory of i (0 < i < N), compute the probability that inventory hits N before it hits 0.",
    examples: [
      {
        input: "N=10, i=4, p=0.5",
        output: "0.4",
        explanation:
          "With a symmetric walk (p=0.5) the hitting probability is exactly the linear fraction of the way from 0 to N, i/N = 4/10 = 0.4, the classic gambler's ruin result for a fair walk.",
      },
    ],
    constraints: ["1 <= N <= 10^6", "0 < i < N", "0 < p < 1"],
    approach:
      "This is exactly the gambler's ruin problem with inventory playing the role of a gambler's wealth and the two risk limits playing the role of absorbing barriers at 0 and N. For p != 0.5, let r = (1-p)/p; the probability of hitting N before 0 starting from i has the closed form (1 - r^i) / (1 - r^N), derived from solving the boundary-value recurrence P(i) = p*P(i+1) + (1-p)*P(i-1) with P(0)=0, P(N)=1. The p=0.5 case is a removable singularity in that formula (both numerator and denominator vanish), where the correct limit collapses to the simple linear result i/N -- a symmetric walk has no drift, so the hitting probability is just proportional to how much of the [0,N] band separates the start from each barrier. Evaluating the general formula naively at p=0.5 divides 0/0, so it must be special-cased explicitly rather than trusted to degrade gracefully.",
    code: `def prob_hits_upper_first(N: int, i: int, p: float) -> float:
    if p == 0.5:
        # removable singularity in the general formula -- fair walk is
        # driftless, so the hitting probability is just the linear fraction
        return i / N

    r = (1 - p) / p
    return (1 - r**i) / (1 - r**N)

print(prob_hits_upper_first(N=10, i=4, p=0.5))    # 0.4
print(prob_hits_upper_first(N=10, i=4, p=0.55))   # > 0.4 -- upward drift helps reach N first
print(prob_hits_upper_first(N=10, i=4, p=0.45))   # < 0.4 -- downward drift hurts it`,
    language: "python",
    complexity: { time: "O(log N) (exponentiation)", space: "O(1)" },
  },
  {
    id: "lc-price-time-priority-order-matcher",
    title: "Design a Price-Time-Priority Limit Order Matching Engine",
    difficulty: "hard",
    topics: ["design", "heap", "order-book"],
    problem:
      "Design a single-symbol matching engine with add_order(side, price, size, order_id) for side in {'buy','sell'}. An incoming order matches against resting orders on the OPPOSITE side whenever the prices cross (incoming buy price >= a resting ask, or incoming sell price <= a resting bid), always filling against the best available price first and, among orders tied at the same price, the one that arrived earliest (FIFO). Any unfilled remainder rests on the book. Return the list of fills (resting_order_id, incoming_order_id, price, size) produced by each call.",
    examples: [
      {
        input:
          "add_order('sell',101,5,'A'); add_order('sell',101,3,'B'); add_order('buy',101,6,'C')",
        output: "[('A','C',101,5), ('B','C',101,1)]",
        explanation:
          "Both resting asks are at the same price 101, so FIFO breaks the tie: A (arrived first) fills completely against 5 of C's 6 units at 101, then B fills the remaining 1 unit at 101, leaving B resting with 2 units still on the book.",
      },
    ],
    constraints: ["1 <= number of calls <= 10^5", "1 <= price, size <= 10^6"],
    approach:
      "Use two heaps: a max-heap for resting bids and a min-heap for resting asks, where each entry is (priority_price, arrival_sequence, order_id, remaining_size) -- bids store price negated so the heap's natural min-order gives the highest price first, and the arrival_sequence as the tiebreaker means the heap pops the EARLIEST order among any tied at the best price, which is exactly price-time priority. On each incoming order, loop while it has remaining size and the opposite heap's top price crosses: pop that top resting order, trade at the RESTING order's price (standard convention -- the order that was already on the book sets the execution price), fill the smaller of the two remaining sizes, and if the resting order isn't fully consumed, push it back with its ORIGINAL sequence number so it keeps its place in time priority rather than losing queue position. Whatever remains of the incoming order after the matching loop rests on its own side.",
    code: `import heapq
import itertools

class OrderMatcher:
    def __init__(self):
        self.bids: list[tuple[float, int, str, int]] = []   # (-price, seq, id, size)
        self.asks: list[tuple[float, int, str, int]] = []   # (price, seq, id, size)
        self._seq = itertools.count()

    def add_order(self, side: str, price: float, size: int, order_id: str):
        fills = []
        seq = next(self._seq)
        book, opposite = (self.bids, self.asks) if side == "buy" else (self.asks, self.bids)
        remaining = size

        while remaining > 0 and opposite:
            top_price, top_seq, top_id, top_size = opposite[0]
            resting_price = -top_price if side == "buy" else top_price
            crosses = price >= resting_price if side == "buy" else price <= resting_price
            if not crosses:
                break

            heapq.heappop(opposite)
            traded = min(remaining, top_size)
            fills.append((top_id, order_id, resting_price, traded))
            remaining -= traded
            leftover = top_size - traded
            if leftover > 0:
                # push back with the SAME seq -- it keeps its original queue position
                heapq.heappush(opposite, (top_price, top_seq, top_id, leftover))

        if remaining > 0:
            entry_price = -price if side == "buy" else price
            heapq.heappush(book, (entry_price, seq, order_id, remaining))

        return fills

engine = OrderMatcher()
engine.add_order("sell", 101, 5, "A")
engine.add_order("sell", 101, 3, "B")
print(engine.add_order("buy", 101, 6, "C"))
# [('A', 'C', 101, 5), ('B', 'C', 101, 1)] -- B rests with 2 remaining`,
    language: "python",
    complexity: { time: "O(log n) per matched order, amortized", space: "O(n)" },
  },
];
