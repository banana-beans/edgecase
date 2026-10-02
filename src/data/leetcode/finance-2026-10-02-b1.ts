import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-02
// A two-heap running median of a streaming trade-price tape, a
// variable-size sliding window for the shortest run of days
// hitting a cumulative-volume target, a buy/sell-with-cooldown
// DP stock variant, a gambler's-ruin probability problem for a
// PnL random walk, and a position-tracker design problem with
// FIFO lot matching for realized P&L.
// ============================================================

export const financeBatch20261002: LeetCodeProblem[] = [
  {
    id: "lc-20261002-running-median-trade-stream",
    title: "Running Median of a Streaming Trade-Price Tape",
    difficulty: "hard",
    topics: ["heap", "design"],
    problem:
      "Design a class that ingests trade prices one at a time via add_price(price) and can report the median of all prices seen so far via get_median() at any point, in better than O(n log n) per call.",
    examples: [
      {
        input: "add_price(5); add_price(2); get_median(); add_price(8); get_median()",
        output: "3.5, 5.0",
        explanation:
          "After [5,2] the sorted order is [2,5], median is the average of both middle elements, 3.5. After [5,2,8] the sorted order is [2,5,8], median is the single middle element, 5.0.",
      },
    ],
    constraints: ["up to 10^5 calls to add_price", "prices fit in a double"],
    approach:
      "Maintain two heaps that split the stream in half: a max-heap holding the smaller half of all prices seen (so its top is the largest of the small half) and a min-heap holding the larger half (so its top is the smallest of the large half). On every insert, push into one heap then rebalance by moving the top element across if either heap is more than one element larger than the other -- this keeps the size invariant |low| - |high| <= 1 at all times. The median is then either the max-heap's top alone (odd total count) or the average of both heaps' tops (even count). Each insert costs O(log n) for the heap push plus a possible O(log n) rebalance move, and get_median is O(1), which beats resorting the whole stream on every query.",
    code: `import heapq

class RunningMedian:
    def __init__(self):
        self.low = []   # max-heap (negated values): smaller half of the stream
        self.high = []  # min-heap: larger half of the stream

    def add_price(self, price: float) -> None:
        heapq.heappush(self.low, -price)
        # rebalance: make sure every value in low <= every value in high
        heapq.heappush(self.high, -heapq.heappop(self.low))
        # keep sizes within one of each other
        if len(self.high) > len(self.low):
            heapq.heappush(self.low, -heapq.heappop(self.high))

    def get_median(self) -> float:
        if len(self.low) > len(self.high):
            return -self.low[0]
        return (-self.low[0] + self.high[0]) / 2.0

rm = RunningMedian()
rm.add_price(5)
rm.add_price(2)
print(rm.get_median())  # 3.5
rm.add_price(8)
print(rm.get_median())  # 5.0`,
    language: "python",
    complexity: { time: "O(log n) per insert, O(1) per query", space: "O(n)" },
  },
  {
    id: "lc-20261002-shortest-window-volume-target",
    title: "Shortest Run of Trading Days Hitting a Cumulative Volume Target",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given daily trading volumes for a stock as a list of positive integers volumes, and a target total target, return the length of the shortest contiguous run of days whose volumes sum to at least target. Return 0 if no such run exists.",
    examples: [
      {
        input: "volumes=[2,3,1,2,4,3], target=7",
        output: "2",
        explanation:
          "The run [4,3] at the end sums to 7 in just 2 days, which is shorter than any other run reaching at least 7 (e.g. [2,3,1,2] takes 4 days for the same target).",
      },
    ],
    constraints: ["1 <= volumes.length <= 10^5", "1 <= volumes[i] <= 10^4", "1 <= target <= 10^9"],
    approach:
      "Because every volume is strictly positive, the running sum over any window only grows as the window expands and only shrinks as it contracts -- that monotonicity is exactly what makes a variable-size sliding window valid here. Expand a right pointer, adding each day's volume to a running total; whenever the total meets or exceeds target, the current window is valid, so record its length and then greedily shrink from the left for as long as the window stays valid, since a smaller valid window is always at least as good as a larger one covering the same right endpoint. Each index enters and leaves the window at most once across the whole scan, giving O(n) total work versus the O(n^2) of checking every start/end pair directly.",
    code: `def shortest_window_hitting_volume(volumes: list[int], target: int) -> int:
    left = 0
    running_sum = 0
    best = float("inf")

    for right, v in enumerate(volumes):
        running_sum += v

        # shrink greedily while the window still meets the target
        while running_sum >= target:
            best = min(best, right - left + 1)
            running_sum -= volumes[left]
            left += 1

    return 0 if best == float("inf") else best

print(shortest_window_hitting_volume([2, 3, 1, 2, 4, 3], target=7))
# 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261002-best-time-to-trade-with-cooldown",
    title: "Maximum Profit With a Mandatory Cooldown After Selling",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for a single stock, you may buy and sell multiple times (never holding more than one share at once), but after selling you must wait one full day before you're allowed to buy again (a one-day cooldown, modeling a compliance-driven flatten-before-re-entry rule). Return the maximum total profit achievable.",
    examples: [
      {
        input: "prices=[1,2,3,0,2]",
        output: "3",
        explanation:
          "Buy at 1, sell at 2 (profit 1), cooldown on the next day, buy at 0, sell at 2 (profit 2). Total profit 3 -- better than buying at 1 and selling at 3 for profit 2 alone, because re-entering after the dip is worth the cooldown cost.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000"],
    approach:
      "Model this as a 3-state machine evaluated one day at a time: held (currently holding a share), sold (just sold today, so tomorrow is the mandatory cooldown day and you cannot buy), and rest (not holding, and free to buy -- either never bought, or it's been at least one day since your last sale). The transitions capture the cooldown rule directly: held today is either held yesterday, or rest yesterday minus today's price (buying is only legal from rest, never from sold); sold today is held yesterday plus today's price (you can only sell out of a held position); rest today is the better of rest yesterday or sold yesterday (cooldown ends and you become free to buy again). Carrying only the three running values forward makes this O(n) time and O(1) space, versus the O(n) states x O(n) days a naive table would need if not collapsed.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    held = -prices[0]   # holding a share, bought on day 0
    sold = 0             # sold today -- impossible to have sold before day 0 starts
    rest = 0             # not holding, free to buy (no shares yet)

    for price in prices[1:]:
        prev_held, prev_sold, prev_rest = held, sold, rest
        held = max(prev_held, prev_rest - price)   # buy only from rest, not from sold
        sold = prev_held + price                   # sell out of a held position
        rest = max(prev_rest, prev_sold)            # cooldown ends -> free to buy again

    return max(sold, rest)   # never end the day still holding for max profit

print(max_profit_with_cooldown([1, 2, 3, 0, 2]))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261002-gamblers-ruin-pnl-random-walk",
    title: "Probability of Hitting a Profit Target Before a Stop-Loss (Gambler's Ruin)",
    difficulty: "hard",
    topics: ["probability", "math"],
    problem:
      "A trader's PnL moves up by one unit with probability p and down by one unit with probability 1-p on each trade, starting at 0. Given a profit target T (a positive integer) and a stop-loss S (a positive integer, so the trader stops at -S), return the probability the trader hits the profit target before the stop-loss.",
    examples: [
      {
        input: "p=0.5, T=3, S=2",
        output: "0.4",
        explanation:
          "With a fair coin (p=0.5), the probability of reaching +3 before -2 from a symmetric random walk is simply S / (S + T) = 2/5 = 0.4 -- the classic gambler's ruin result for the fair case.",
      },
    ],
    constraints: ["0 < p < 1", "1 <= T, S <= 10^6"],
    approach:
      "This is the classical gambler's ruin problem. Let f(k) be the probability of reaching +T before -S starting from current position k (measured from -S, so k ranges 0 to S+T, with f(0)=0 and f(S+T)=1). For the fair case p=0.5, the walk is a martingale, so the win probability is exactly linear in starting position: f(k) = k / (S+T), giving the simple ratio S / (S+T) from a start of k=S (position 0 in PnL terms is k=S in the shifted coordinate). For p != 0.5, the closed form instead involves the ratio r = (1-p)/p: f(k) = (1 - r^k) / (1 - r^(S+T)), which comes from solving the recursion f(k) = p*f(k+1) + (1-p)*f(k-1) as a linear difference equation -- the non-obvious part is recognizing that an UNFAIR walk's hitting probabilities are governed by a geometric ratio in r rather than a linear ratio, which is exactly why the two cases need genuinely different formulas, not just a limit of one into the other (though the r != 1 formula does converge to the fair-case formula as p approaches 0.5).",
    code: `def prob_hit_target_before_stoploss(p: float, target: int, stop_loss: int) -> float:
    total = target + stop_loss
    start = stop_loss  # shift coordinates so the walk starts at k = stop_loss

    if abs(p - 0.5) < 1e-12:
        # fair walk: a martingale, so hitting probability is linear in position
        return start / total

    r = (1 - p) / p
    # unfair walk: hitting probability follows a geometric ratio in r,
    # derived by solving f(k) = p*f(k+1) + (1-p)*f(k-1) as a linear recursion
    return (1 - r ** start) / (1 - r ** total)

print(round(prob_hit_target_before_stoploss(0.5, target=3, stop_loss=2), 4))
# 0.4

# an edge with p slightly above 0.5 should do noticeably better than the
# fair-coin ratio for the same target/stop-loss
print(round(prob_hit_target_before_stoploss(0.55, target=3, stop_loss=2), 4))
# 0.4713 -- higher than the fair-case 0.4, as expected with a real edge`,
    language: "python",
    complexity: { time: "O(log(target+stop_loss)) via exponentiation", space: "O(1)" },
  },
  {
    id: "lc-20261002-fifo-position-tracker",
    title: "Design a FIFO Position Tracker With Realized/Unrealized PnL",
    difficulty: "hard",
    topics: ["design", "queue"],
    problem:
      "Design a class PositionTracker with buy(qty, price) to add shares to a long position, sell(qty, price) to reduce it using FIFO lot matching (the oldest unsold shares are closed first), and unrealized_pnl(mark_price) / realized_pnl() to report PnL. Assume the position never goes short (sell quantity never exceeds current holdings).",
    examples: [
      {
        input: "buy(100,10.0); buy(50,12.0); sell(120,15.0); realized_pnl(); unrealized_pnl(16.0)",
        output: "realized_pnl=560.0, unrealized_pnl=120.0",
        explanation:
          "FIFO closes the oldest lot first: all 100 shares bought at 10.0 close for a profit of (15-10)*100=500, then the sell still needs 20 more shares, closing 20 of the 50 shares bought at 12.0 for (15-12)*20=60. Total realized is 500+60=560. The remaining 30 shares from the 12.0 lot are still open, marked at 16.0 for an unrealized profit of (16-12)*30=120.",
      },
    ],
    constraints: ["qty, price > 0", "cumulative sells never exceed cumulative buys"],
    approach:
      "Keep open lots in a FIFO queue (a deque works well since we only ever consume from the front and append to the back), each lot storing its remaining quantity and its cost basis price. A buy simply appends a new lot. A sell walks the queue from the front, closing out each lot's remaining quantity (or as much of it as the sell needs) at the lot's own cost basis against the sell price, accumulating realized PnL as the sum of (sell_price - lot_price) * qty_closed across however many lots the sell consumes, and popping any lot fully closed while partially reducing the quantity of the one lot that only gets partially closed. Unrealized PnL at any time is just the sum over all remaining open lots of (mark_price - lot_price) * remaining_qty -- no FIFO logic needed there since it's a pure snapshot of what's still open.",
    code: `from collections import deque

class PositionTracker:
    def __init__(self):
        self.lots: deque[list[float]] = deque()  # each lot: [qty_remaining, price]
        self.realized = 0.0

    def buy(self, qty: float, price: float) -> None:
        self.lots.append([qty, price])

    def sell(self, qty: float, price: float) -> None:
        remaining_to_sell = qty
        while remaining_to_sell > 0:
            lot = self.lots[0]              # oldest open lot -- FIFO
            closed_qty = min(lot[0], remaining_to_sell)
            self.realized += (price - lot[1]) * closed_qty
            lot[0] -= closed_qty
            remaining_to_sell -= closed_qty
            if lot[0] == 0:
                self.lots.popleft()         # this lot is fully closed now

    def unrealized_pnl(self, mark_price: float) -> float:
        return sum((mark_price - price) * qty for qty, price in self.lots)

    def realized_pnl(self) -> float:
        return self.realized

pt = PositionTracker()
pt.buy(100, 10.0)
pt.buy(50, 12.0)
pt.sell(120, 15.0)   # closes all 100@10 (profit 500) + 20@12 (profit 60) = 560
print(pt.realized_pnl())          # 560.0
print(pt.unrealized_pnl(16.0))    # (16 - 12) * 30 remaining = 120.0`,
    language: "python",
    complexity: { time: "O(1) amortized per buy/sell lot touched", space: "O(number of open lots)" },
  },
];
