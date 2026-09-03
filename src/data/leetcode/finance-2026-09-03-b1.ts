import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-03
// A two-heap streaming median for trade prices, a positive-sum
// sliding window under a participation cap, the classic stock DP
// with a post-sell cooldown, a binomial DP for VWAP-slice fill
// probability, and a FIFO position / realized P&L tracker.
// ============================================================

export const financeBatch20260903: LeetCodeProblem[] = [
  {
    id: "lc-streaming-median-trade-prices",
    title: "Design a Streaming Median Tracker for Trade Prices",
    difficulty: "medium",
    topics: ["heap", "design"],
    problem:
      "Design a data structure that processes a live stream of trade prices one at a time via add(price), and supports median() to return the current median of every price seen so far. Both operations need to stay efficient as the stream grows -- you should not resort the entire history on every median() call.",
    examples: [
      {
        input: "add(5); add(2); add(8); median(); add(1); median()",
        output: "5, then 3.5",
        explanation:
          "After 5, 2, 8: sorted [2,5,8], median is the middle value 5. After adding 1: sorted [1,2,5,8], median is the average of the two middle values (2+5)/2 = 3.5.",
      },
    ],
    constraints: ["1 <= number of operations <= 10^5", "0 < price <= 10^6"],
    approach:
      "Maintain two heaps: a max-heap 'lo' holding the smaller half of the prices seen so far (Python's heapq is a min-heap, so store negated values), and a min-heap 'hi' holding the larger half, keeping their sizes within one of each other. On add, push the new price into lo, then always ferry lo's current max into hi -- this guarantees every element in lo is <= every element in hi after the step, regardless of where the new price landed. Then rebalance sizes: if hi ever ends up larger than lo, move its min back into lo, since lo is allowed at most one more element than hi, never fewer. With that invariant, median() is O(1): if lo has one extra element, the median is -lo[0]; if the sizes are equal, it's the average of -lo[0] and hi[0]. Each add does O(log n) heap work; resorting the full history on every query would cost O(n log n) per query instead.",
    code: `import heapq

class StreamingMedian:
    def __init__(self):
        self.lo: list[float] = []   # max-heap (negated) for the smaller half
        self.hi: list[float] = []   # min-heap for the larger half

    def add(self, price: float) -> None:
        # push to lo first, then always ferry lo's max into hi -- guarantees
        # every element in lo is <= every element in hi after this step
        heapq.heappush(self.lo, -price)
        heapq.heappush(self.hi, -heapq.heappop(self.lo))

        # rebalance: lo is allowed at most one more element than hi, never fewer
        if len(self.hi) > len(self.lo):
            heapq.heappush(self.lo, -heapq.heappop(self.hi))

    def median(self) -> float:
        if len(self.lo) > len(self.hi):
            return -self.lo[0]
        return (-self.lo[0] + self.hi[0]) / 2

tracker = StreamingMedian()
for p in [5, 2, 8]:
    tracker.add(p)
print(tracker.median())   # 5
tracker.add(1)
print(tracker.median())   # 3.5`,
    language: "python",
    complexity: { time: "O(log n) per add, O(1) per median", space: "O(n)" },
  },
  {
    id: "lc-longest-window-volume-cap",
    title: "Longest Contiguous Window of Trades Under a Volume Cap",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a chronological list of per-trade volumes (each a positive integer) and an integer cap C representing a participation limit, return the length of the longest contiguous window of trades whose total volume does not exceed C.",
    examples: [
      {
        input: "volumes=[4,2,5,1,3], cap=8",
        output: "3",
        explanation:
          "The window [2,5,1] (indices 1-3) sums to exactly 8, the longest contiguous run whose total doesn't exceed the cap -- every length-4 window sums above 8.",
      },
    ],
    constraints: ["1 <= volumes.length <= 10^5", "1 <= volumes[i] <= 10^6", "1 <= cap <= 10^9"],
    approach:
      "Because every volume is strictly positive, the running window sum is monotonically nondecreasing as the right pointer advances and monotonically nonincreasing as the left pointer advances -- exactly the property that makes a plain two-pointer sliding window correct here. (It would not be valid if volumes could be negative, since shrinking the window then isn't guaranteed to reduce the sum.) Expand right, adding each volume to a running sum; whenever the running sum exceeds the cap, shrink from the left, subtracting volumes out, until the window is valid again. Track the best (right - left + 1) seen whenever the window is valid. Each index enters and leaves the window at most once across the whole pass, so total work is O(n) despite the nested-looking while loop.",
    code: `def longest_window_under_cap(volumes: list[int], cap: int) -> int:
    left = 0
    running_sum = 0
    best_len = 0

    for right, vol in enumerate(volumes):
        running_sum += vol
        # shrinking is only correct here because every volume is positive --
        # removing a left element strictly decreases running_sum
        while running_sum > cap and left <= right:
            running_sum -= volumes[left]
            left += 1
        best_len = max(best_len, right - left + 1)

    return best_len

print(longest_window_under_cap([4, 2, 5, 1, 3], cap=8))   # 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-stock-cooldown",
    title: "Maximum Stock Profit With a Cooldown Day After Selling",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices, unlimited transactions are allowed (never hold more than one share at a time), but after selling you cannot buy again the very next day -- you must wait at least one cooldown day before your next buy. Find the maximum achievable total profit.",
    examples: [
      {
        input: "prices=[1,2,3,0,2]",
        output: "3",
        explanation:
          "Buy at 1, sell at 2 (profit 1), the cooldown day is forced next, then buy at 0 and sell at 2 (profit 2). Total profit 1+2=3, and no plan obeying the cooldown beats it.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000", "0 <= prices[i] <= 5000"],
    approach:
      "Track three rolling states per day instead of the usual two: hold (currently long), sold (just sold today, so tomorrow is a forced cooldown), and rest (not holding and free to buy). Transitions: hold[i] = max(hold[i-1], rest[i-1] - price[i]) -- keep holding, or buy today funded from being free to trade yesterday. sold[i] = hold[i-1] + price[i] -- sell whatever was held. rest[i] = max(rest[i-1], sold[i-1]) -- stay resting, or the cooldown from yesterday's sale just lifted. The cooldown constraint is entirely encoded in rest only being reachable from sold with a one-day lag, never directly re-entering hold the same day a sale happened. The answer is max(sold, rest) on the last day, since ending while still holding can never be optimal.",
    code: `def max_profit_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    NEG_INF = float("-inf")
    hold, sold, rest = NEG_INF, 0, 0   # day-0 base cases: nothing has been sold yet

    for price in prices:
        prev_hold, prev_sold, prev_rest = hold, sold, rest
        hold = max(prev_hold, prev_rest - price)   # keep holding, or buy from rest
        sold = prev_hold + price                    # sell today
        rest = max(prev_rest, prev_sold)             # stay resting, or cooldown just ended

    return max(sold, rest)

print(max_profit_cooldown([1, 2, 3, 0, 2]))   # 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-vwap-fill-probability",
    title: "Probability of Filling at Least K of N VWAP Slices",
    difficulty: "medium",
    topics: ["probability", "dynamic-programming"],
    problem:
      "An algo splits a parent order into N equal time slices and attempts to fill one child unit in each slice. Each slice independently fills with probability p, regardless of the others. Given N, p, and a required minimum number of filled slices k for the parent order to count as acceptably filled, compute the probability that at least k of the N slices fill.",
    examples: [
      {
        input: "N=3, p=0.5, k=2",
        output: "0.5",
        explanation:
          "P(at least 2 of 3 fill) = P(exactly 2) + P(exactly 3) = 3*(0.5^3) + 1*(0.5^3) = 0.375 + 0.125 = 0.5.",
      },
    ],
    constraints: ["1 <= N <= 2000", "0 < p < 1", "0 <= k <= N"],
    approach:
      "This is a binomial tail probability, but rather than evaluate the binomial coefficient formula directly -- which risks overflow or precision loss for larger N combined with small p -- build the full probability distribution over 'number of slices filled' incrementally with DP: after processing i slices, dist[j] is the probability that exactly j of those i slices filled. Each step branches dist[j] into next_dist[j] (this slice misses, weight 1-p) and next_dist[j+1] (this slice fills, weight p). After processing all N slices, sum dist[k:] for the answer. This costs O(N^2) time and O(N) space with a rolling array, stays numerically stable for any practical N, and generalizes immediately if p varies by slice (e.g. fills get harder late in the day), which the closed-form binomial coefficient doesn't handle as cleanly.",
    code: `def prob_at_least_k_filled(N: int, p: float, k: int) -> float:
    # dist[j] = probability exactly j of the slices processed so far have filled
    dist = [1.0] + [0.0] * N   # 0 slices processed, 0 filled, probability 1

    for _ in range(N):
        new_dist = [0.0] * (N + 1)
        for j in range(N + 1):
            if dist[j] == 0.0:
                continue
            new_dist[j] += dist[j] * (1 - p)      # this slice misses
            if j + 1 <= N:
                new_dist[j + 1] += dist[j] * p      # this slice fills
        dist = new_dist

    return sum(dist[k:])

print(round(prob_at_least_k_filled(N=3, p=0.5, k=2), 4))   # 0.5`,
    language: "python",
    complexity: { time: "O(N^2)", space: "O(N)" },
  },
  {
    id: "lc-fifo-position-pnl-tracker",
    title: "Design a FIFO Position and Realized P&L Tracker",
    difficulty: "medium",
    topics: ["design", "queue"],
    problem:
      "Design a single-symbol position tracker that supports trade(side, qty, price), recording a buy or sell fill, using FIFO lot matching -- a sell is matched against the oldest still-open buy lots first, and symmetrically a buy that closes a short matches the oldest open sell lots first. Support realized_pnl(), returning cumulative realized P&L so far, and position(), returning the current signed net quantity (positive = long, negative = short).",
    examples: [
      {
        input: "trade('buy',10,100); trade('buy',5,110); trade('sell',12,105); realized_pnl(); position()",
        output: "40.0, 3",
        explanation:
          "The sell for 12 first fully closes the oldest lot (10 @ 100): (105-100)*10 = 50. The remaining 2 units close 2 of the second lot (5 @ 110): (105-110)*2 = -10. Total realized P&L = 50 - 10 = 40. The second lot's leftover 3 shares @ 110 stay open, so position() is 3.",
      },
    ],
    constraints: [
      "1 <= number of trade() calls <= 10^5",
      "0 < qty, price <= 10^6",
      "side is 'buy' or 'sell'",
    ],
    approach:
      "Maintain a deque of open lots as [signed_qty, price] pairs -- positive signed_qty for long lots, negative for short lots -- oldest first. On each trade, convert side and qty into a single signed_qty for the incoming trade. While there's still incoming quantity left AND it has the opposite sign of the oldest open lot, it's closing exposure: match min(abs of both) units against that lot, realize (price - lot_price) times the matched amount with the sign flipped appropriately for closing a short, shrink both the lot and the remaining incoming quantity toward zero, and pop the lot once it's fully matched (FIFO: oldest closes first). If any incoming quantity is left once the deque is empty or same-signed, it opens a new lot. Because the same-side check gates the whole loop, opening trades are O(1); a trade that closes several lots costs proportional to lots it actually closes, which amortizes to O(1) per trade over the whole sequence since each lot is only ever closed once. realized_pnl() and position() are then O(1) and O(number of open lots) respectively (or O(1) if a running position total is also cached).",
    code: `from collections import deque

class FifoPositionTracker:
    def __init__(self):
        self.lots: deque[list] = deque()   # [qty, price], oldest first; qty>0=long lot, qty<0=short lot
        self.realized_pnl = 0.0

    def trade(self, side: str, qty: float, price: float) -> None:
        signed_qty = qty if side == "buy" else -qty

        # closing exposure only happens while the incoming trade's sign is
        # opposite the oldest open lot's sign -- otherwise it just opens more
        while signed_qty != 0 and self.lots and (self.lots[0][0] > 0) != (signed_qty > 0):
            lot = self.lots[0]
            closed_qty = min(abs(signed_qty), abs(lot[0]))
            direction = 1 if lot[0] > 0 else -1   # +1 closing a long, -1 closing a short

            self.realized_pnl += direction * (price - lot[1]) * closed_qty
            lot[0] -= direction * closed_qty
            signed_qty += direction * closed_qty   # shrinks signed_qty's magnitude toward 0

            if lot[0] == 0:
                self.lots.popleft()   # fully matched -- oldest lot retires first (FIFO)

        if signed_qty != 0:
            self.lots.append([signed_qty, price])   # remainder opens a new lot

    def position(self) -> float:
        return sum(lot[0] for lot in self.lots)

tracker = FifoPositionTracker()
tracker.trade("buy", 10, 100)
tracker.trade("buy", 5, 110)
tracker.trade("sell", 12, 105)
print(tracker.realized_pnl)   # 40.0 -- (105-100)*10 + (105-110)*2
print(tracker.position())     # 3 -- 3 shares left from the second lot, still long`,
    language: "python",
    complexity: { time: "O(1) amortized per trade, O(1) per realized_pnl", space: "O(number of open lots)" },
  },
];
