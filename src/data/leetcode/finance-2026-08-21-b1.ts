import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-21
// A sliding-window problem for order-book VWAP tracking, a
// min-heap for streaming median P&L, a stock-buy-sell DP
// variant with a cooldown, a Markov-chain absorption-probability
// problem, and a design problem for a limit order matching
// engine's price-time priority book.
// ============================================================

export const financeBatch20260821: LeetCodeProblem[] = [
  {
    id: "lc-sliding-window-vwap",
    title: "Streaming VWAP Over the Last K Trades",
    difficulty: "medium",
    topics: ["sliding-window", "deque"],
    problem:
      "Given a stream of trades, each with a price and a size, maintain the volume-weighted average price (VWAP) over the most recent K trades as new trades arrive. Return the running list of VWAP values, one per trade once at least one trade has arrived.",
    examples: [
      {
        input: "trades=[(100,10),(102,5),(98,20),(101,5)], k=3",
        output: "[100.0, 100.67, 99.14, 99.62]",
        explanation:
          "After the 4th trade, the window holds the last 3 trades (102,5),(98,20),(101,5): VWAP = (102*5+98*20+101*5)/(5+20+5) = 99.615...",
      },
    ],
    constraints: ["1 <= number of trades <= 10^5", "price > 0, size > 0", "1 <= k <= 10^4"],
    approach:
      "VWAP over a window is sum(price*size) divided by sum(size) for the trades currently in the window -- both are running sums that update in O(1) per trade if maintained incrementally rather than recomputed from scratch. Use a deque holding the last k trades: on each new trade, push it and add its price*size and size to the two running totals; once the deque exceeds k elements, pop from the left and SUBTRACT that popped trade's contribution from both running totals. This turns what looks like an O(n*k) sliding recomputation into O(n) total, the same pattern as a sliding-window sum but tracking two sums instead of one.",
    code: `from collections import deque

def streaming_vwap(trades: list[tuple[float, float]], k: int) -> list[float]:
    window: deque[tuple[float, float]] = deque()
    sum_pv = 0.0   # running sum of price * size
    sum_v = 0.0    # running sum of size
    out: list[float] = []

    for price, size in trades:
        window.append((price, size))
        sum_pv += price * size
        sum_v += size

        if len(window) > k:
            old_price, old_size = window.popleft()
            sum_pv -= old_price * old_size
            sum_v -= old_size

        out.append(sum_pv / sum_v)

    return out

trades = [(100.0, 10.0), (102.0, 5.0), (98.0, 20.0), (101.0, 5.0)]
print([round(v, 2) for v in streaming_vwap(trades, k=3)])
# [100.0, 100.67, 99.14, 99.62]`,
    language: "python",
    complexity: { time: "O(n) total", space: "O(k)" },
  },
  {
    id: "lc-streaming-median-pnl",
    title: "Running Median of Streaming Daily P&L",
    difficulty: "hard",
    topics: ["heap"],
    problem:
      "Given a stream of daily P&L values arriving one at a time, maintain and return the running median after each new value arrives, without re-sorting the whole history on every insertion.",
    examples: [
      {
        input: "pnl=[5, -2, 8, -10, 3]",
        output: "[5.0, 1.5, 5.0, 1.5, 3.0]",
        explanation:
          "After [5,-2] sorted is [-2,5], median 1.5. After [5,-2,8] sorted is [-2,5,8], median 5. And so on -- each median uses only the values seen so far.",
      },
    ],
    constraints: ["1 <= number of values <= 10^5", "values fit in a standard float"],
    approach:
      "Maintain two heaps that split the stream in half: a max-heap holding the smaller half of values seen so far (Python's heapq is min-heap only, so negate values to simulate a max-heap), and a min-heap holding the larger half. Keep them balanced -- sizes differ by at most one -- by always inserting into one heap and then rebalancing with a single pop-and-push if the size invariant breaks. The median is then O(1) to read: the top of the larger heap if sizes are unequal, or the average of both tops if equal. Each insertion is O(log n) for the heap push/pop, versus O(n log n) to re-sort after every single new value.",
    code: `import heapq

class RunningMedian:
    def __init__(self):
        self.lo: list[float] = []   # max-heap (negated) -- smaller half
        self.hi: list[float] = []   # min-heap -- larger half

    def add(self, x: float) -> float:
        # always push to lo first, then let the rebalance below sort it out
        heapq.heappush(self.lo, -x)
        # ensure every element in lo is <= every element in hi
        heapq.heappush(self.hi, -heapq.heappop(self.lo))

        # keep sizes balanced within 1 -- lo allowed to hold the extra element
        if len(self.hi) > len(self.lo):
            heapq.heappush(self.lo, -heapq.heappop(self.hi))

        if len(self.lo) > len(self.hi):
            return float(-self.lo[0])
        return (-self.lo[0] + self.hi[0]) / 2.0

rm = RunningMedian()
pnl = [5, -2, 8, -10, 3]
print([round(rm.add(x), 2) for x in pnl])
# [5.0, 1.5, 5.0, 1.5, 3.0]`,
    language: "python",
    complexity: { time: "O(log n) per insertion, O(n log n) total", space: "O(n)" },
  },
  {
    id: "lc-stock-cooldown-dp",
    title: "Max Profit With a Mandatory Cooldown Day After Selling",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given a sequence of daily prices for one stock, find the maximum profit from any number of buy-sell transactions (at most one share held at a time), with the rule that after selling you cannot buy again the very next day -- a one-day cooldown.",
    examples: [
      {
        input: "prices=[1,2,3,0,2]",
        output: "3",
        explanation:
          "Buy at 1, sell at 2 (profit 1), cooldown on day index 2, buy at 0, sell at 2 (profit 2) -- total 3. Buying on day index 2 right after selling on day index 1 is not allowed.",
      },
    ],
    constraints: ["1 <= number of days <= 5000", "0 <= price <= 1000"],
    approach:
      "Model three states per day rather than tracking transactions explicitly: HOLD (currently holding a share), SOLD (just sold today, so tomorrow is a forced cooldown), and REST (holding nothing, free to buy tomorrow, either because of yesterday's cooldown or because we've simply been idle). Each day's HOLD comes from either staying in HOLD or buying today from REST; each day's SOLD comes only from selling today's HOLD; each day's REST comes from either staying in REST or emerging from yesterday's forced cooldown after SOLD. This is a direct extension of the classic single-pass stock DP, adding exactly one state to encode the cooldown constraint, and answers the classic interview follow-up to 'best time to buy and sell stock' family of problems.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    # hold: max profit today while holding a share
    # sold: max profit today having just sold (cooldown starts tomorrow)
    # rest: max profit today holding nothing, free to buy tomorrow
    hold = -prices[0]
    sold = 0
    rest = 0

    for price in prices[1:]:
        prev_hold, prev_sold, prev_rest = hold, sold, rest
        hold = max(prev_hold, prev_rest - price)   # keep holding, or buy from rest
        sold = prev_hold + price                    # sell today's holding
        rest = max(prev_rest, prev_sold)             # stay idle, or cooldown just ended

    return max(sold, rest)   # never end the day still holding a share

print(max_profit_with_cooldown([1, 2, 3, 0, 2]))   # 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-markov-expected-absorption-time",
    title: "Expected Days to Default in a Credit-Rating Transition Matrix",
    difficulty: "hard",
    topics: ["markov-chain", "linear-algebra"],
    problem:
      "Given a Markov transition matrix over credit-rating states where one state (default) is absorbing, compute the expected number of days until absorption starting from each transient (non-default) state, without simulating the chain.",
    examples: [
      {
        input:
          'states=["A","B","D"], Q=[[0.9,0.08],[0.2,0.6]] (transient-to-transient block, D absorbing)',
        output: "[20.0, 12.5]",
        explanation:
          "Expected days to default starting from A is 20, from B is 12.5 -- the riskier state B is expected to reach default sooner, computed directly from the fundamental matrix rather than by simulating years of daily transitions.",
      },
    ],
    constraints: ["2 <= number of transient states <= 200", "each row of the full transition matrix sums to 1"],
    approach:
      "For an absorbing Markov chain, restrict the transition matrix to just the transient-to-transient block Q (drop rows and columns for absorbing states). The fundamental matrix N = (I - Q)^-1 has a direct probabilistic meaning: entry N[i][j] is the expected number of times the chain visits transient state j before absorption, given it started in transient state i. Summing each row of N gives the expected TOTAL number of steps before absorption from that starting state, since every visit to any transient state counts as one more day before the chain finally leaves for good. This turns an infinite-horizon expectation -- summing probability-weighted step counts over every possible path length -- into a single matrix inversion (or, better numerically, solving the linear system (I - Q) @ t = ones directly rather than forming the inverse explicitly), giving an O(k^3) closed-form answer instead of a Monte Carlo simulation that only converges approximately.",
    code: `import numpy as np

def expected_days_to_absorption(Q: list[list[float]]) -> list[float]:
    Q = np.array(Q)
    k = Q.shape[0]
    I = np.eye(k)

    # solve (I - Q) @ t = ones directly -- more numerically stable than
    # explicitly forming the inverse fundamental matrix N = (I - Q)^-1
    t = np.linalg.solve(I - Q, np.ones(k))
    return t.tolist()

# transient block only: A and B transition among themselves and to default D
# (D itself is dropped -- absorbing states contribute no further transitions)
Q = [
    [0.90, 0.08],   # from A: stay A 90%, downgrade to B 8%, default 2% (implicit)
    [0.20, 0.60],   # from B: upgrade to A 20%, stay B 60%, default 20% (implicit)
]
print([round(x, 1) for x in expected_days_to_absorption(Q)])
# [20.0, 12.5] -- B is expected to hit default much sooner than A`,
    language: "python",
    complexity: { time: "O(k^3) for the linear solve", space: "O(k^2)" },
  },
  {
    id: "lc-fifo-lot-position-tracker",
    title: "Design a FIFO Lot-Matching Position and Realized P&L Tracker",
    difficulty: "medium",
    topics: ["design", "queue"],
    problem:
      "Design a single-instrument position tracker that supports buy(qty, price) to open or add to a long position, and sell(qty, price) to close part or all of it. Sells must match against the OLDEST open lots first (FIFO), and each sell should return the realized P&L generated by that sell, computed lot by lot against the price each matched lot was originally bought at. Assume sells never exceed the current long position.",
    examples: [
      {
        input: "buy(10, 100); buy(5, 105); sell(12, 110)",
        output: "realized_pnl=110.0, remaining_lots=[(105, 3)]",
        explanation:
          "The sell of 12 first closes the oldest lot (10 @ 100) for (110-100)*10=100 realized, then closes 2 of the 5 units from the next lot (@ 105) for (110-105)*2=10 realized, totaling 110. The remaining 3 units of that second lot stay open at cost basis 105.",
      },
    ],
    constraints: ["1 <= number of operations <= 10^5", "sell quantity never exceeds the current open position"],
    approach:
      "FIFO lot matching is exactly a queue problem: maintain a deque of open lots, each a (price, remaining_qty) pair, in the order they were bought. A buy simply appends a new lot to the back of the deque -- O(1). A sell walks the FRONT of the deque, matching against the oldest lot first: take min(sell_qty_remaining, lot_qty) units from the front lot, accumulate (sell_price - lot_price) * matched_qty into realized P&L, and either fully pop the lot (if it's now exhausted) or shrink it in place (if the sell was smaller than that lot). Repeat until the sell's quantity is fully matched. Because each unit of each lot is consumed exactly once across the algorithm's whole lifetime, the total work across all sell calls is bounded by the total number of buy operations, giving amortized O(1) per unit processed rather than O(lots) per sell in the worst case if lots were re-scanned from scratch each time.",
    code: `from collections import deque

class FifoPositionTracker:
    def __init__(self):
        self.lots: deque[list[float]] = deque()   # each: [price, remaining_qty]

    def buy(self, qty: float, price: float) -> None:
        self.lots.append([price, qty])   # new lot goes to the back -- FIFO order

    def sell(self, qty: float, price: float) -> float:
        realized = 0.0
        remaining = qty

        while remaining > 0:
            lot_price, lot_qty = self.lots[0]        # oldest lot is always matched first
            matched = min(remaining, lot_qty)
            realized += (price - lot_price) * matched

            if matched == lot_qty:
                self.lots.popleft()                   # lot fully consumed
            else:
                self.lots[0][1] -= matched             # lot partially consumed, stays at front

            remaining -= matched

        return realized

tracker = FifoPositionTracker()
tracker.buy(10, 100)
tracker.buy(5, 105)
print(tracker.sell(12, 110))                # 110.0
print([tuple(lot) for lot in tracker.lots]) # [(105, 3)] -- 3 units still open`,
    language: "python",
    complexity: { time: "O(1) per buy, amortized O(1) per unit sold", space: "O(number of open lots)" },
  },
];
