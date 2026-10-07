import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-07
// Running median of a live trade tape (two heaps), shortest
// window to hit a target executed volume (sliding window),
// buy/sell with a settlement cooldown (DP stock variant),
// probability of ruin for a biased inventory random walk
// (probability / Markov), and a price-time-priority limit
// order matching engine (design).
// ============================================================

export const financeBatch20261007: LeetCodeProblem[] = [
  {
    id: "lc-20261007-running-median-trade-price",
    title: "Running Median of Trade Prices in a Live Tape",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Design a class MedianTracker with add(price) that ingests one trade price at a time, and median() that returns the median of all prices ingested so far.",
    examples: [
      {
        input: "add(5); add(15); add(1); median(); add(3); median()",
        output: "5, then 4.0",
        explanation:
          "After [5,15,1], sorted is [1,5,15], median is the middle value 5. After adding 3, sorted is [1,3,5,15], median is the average of the two middle values (3+5)/2 = 4.0.",
      },
    ],
    constraints: [
      "up to 10^6 calls to add",
      "median() may be called interleaved with add() at any point",
    ],
    approach:
      "Split the data into two heaps: a max-heap for the lower half (negate prices to simulate a max-heap with Python's min-heap heapq) and a min-heap for the upper half, keeping their sizes within one of each other. Every add() pushes onto the heap chosen by comparing the new value against the top of the lower heap, then rebalances by moving one element across if sizes drift apart by more than one. median() is then O(1): either the lower heap's top (odd total count) or the average of both heaps' tops (even total count). This keeps add() at O(log n) worst case and reading the median at O(1), matching a live tape where price arrivals vastly outnumber median queries.",
    code: `import heapq

class MedianTracker:
    def __init__(self):
        self.lo: list[float] = []   # max-heap via negated values
        self.hi: list[float] = []   # min-heap, holds the upper half

    def add(self, price: float) -> None:
        # route into the correct half, then rebalance sizes to within 1
        if not self.lo or price <= -self.lo[0]:
            heapq.heappush(self.lo, -price)
        else:
            heapq.heappush(self.hi, price)

        if len(self.lo) > len(self.hi) + 1:
            heapq.heappush(self.hi, -heapq.heappop(self.lo))
        elif len(self.hi) > len(self.lo):
            heapq.heappush(self.lo, -heapq.heappop(self.hi))

    def median(self) -> float:
        if len(self.lo) > len(self.hi):
            return -self.lo[0]
        return (-self.lo[0] + self.hi[0]) / 2

t = MedianTracker()
for p in [5, 15, 1]:
    t.add(p)
print(t.median())   # 5
t.add(3)
print(t.median())   # 4.0`,
    language: "python",
    complexity: { time: "O(log n) per add, O(1) per median", space: "O(n)" },
  },
  {
    id: "lc-20261007-shortest-window-target-volume",
    title: "Shortest Window to Accumulate a Target Executed Volume",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given per-trade volumes for one name over a session (all positive) and a target total volume, return the length of the shortest contiguous subarray whose volumes sum to at least target, or -1 if no such window exists.",
    examples: [
      {
        input: "volumes=[100,50,200,100,50], target=300",
        output: "2",
        explanation:
          "The window [200,100] (indices 2-3) sums to 300, meeting the target with length 2 -- no shorter window reaches 300.",
      },
    ],
    constraints: [
      "1 <= volumes.length <= 10^5",
      "1 <= volumes[i] <= 10^6",
      "1 <= target <= 10^9",
    ],
    approach:
      "Because every volume is strictly positive, the running window sum is monotonic in both pointers: extending the right pointer only increases the sum, and advancing the left pointer only decreases it. That monotonicity is what makes a two-pointer sweep correct here -- it would NOT be if volumes could be zero or negative, since shrinking would no longer monotonically reduce the chance of still meeting target. Expand right, adding each volume; whenever the window sum meets or exceeds target, record the window length and then greedily shrink from the left as far as possible while staying at or above target, since a smaller window is always at least as good as a larger one that also meets the target. Both pointers move only forward over the whole pass, giving O(n) total work despite the nested loop shape.",
    code: `def shortest_window_for_target_volume(volumes: list[int], target: int) -> int:
    left = 0
    window_sum = 0
    best = float("inf")

    for right, vol in enumerate(volumes):
        window_sum += vol
        # positive volumes guarantee shrinking only ever decreases the sum,
        # so this greedy shrink never needs to backtrack
        while window_sum >= target:
            best = min(best, right - left + 1)
            window_sum -= volumes[left]
            left += 1

    return best if best != float("inf") else -1

print(shortest_window_for_target_volume([100, 50, 200, 100, 50], 300))
# 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261007-stock-cooldown",
    title: "Best Time to Buy and Sell Stock With a One-Day Cooldown",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for a stock, return the maximum profit from any number of buy-then-sell transactions (never holding more than one share at a time), with the rule that after selling you must wait one full day before buying again (a settlement cooldown).",
    examples: [
      {
        input: "prices=[1,2,3,0,2]",
        output: "3",
        explanation:
          "Buy at index 0 (price 1), sell at index 1 (price 2) for profit 1, cooldown on index 2 (must skip a day before buying again), buy at index 3 (price 0), sell at index 4 (price 2) for profit 2. Total profit 1 + 2 = 3, beating the single trade buy@0 sell@2 (profit 2).",
      },
    ],
    constraints: ["1 <= prices.length <= 5000", "0 <= prices[i] <= 1000"],
    approach:
      "Three-state DP per day: held (currently holding a share), sold_today (just sold, in cooldown), and rest (not holding, free to buy, not fresh off a sale). Transitions: new held = max(held, rest - price) (keep holding, or buy today from a non-cooldown rest state); new sold_today = held + price (sell today, realizing today's price as profit); new rest = max(rest, sold_today) (stay idle, or roll out of yesterday's cooldown into free rest). The cooldown rule is enforced entirely by sold_today only feeding into REST on the NEXT day, never directly back into held, so a buy can never happen the day immediately after a sell. The final answer is the better of sold_today or rest on the last day (held is never optimal to end on, since an open position realizes no profit).",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    held = float("-inf")   # holding a share
    sold = 0                 # sold today -- in cooldown tomorrow
    rest = 0                  # not holding, free to buy

    for price in prices:
        prev_held, prev_sold, prev_rest = held, sold, rest
        held = max(prev_held, prev_rest - price)   # keep holding, or buy from rest
        sold = prev_held + price                     # sell today
        rest = max(prev_rest, prev_sold)              # idle, or just finished cooldown

    return max(sold, rest)   # ending while still holding is never optimal

print(max_profit_with_cooldown([1, 2, 3, 0, 2]))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 309,
  },
  {
    id: "lc-20261007-biased-gamblers-ruin",
    title: "Probability of Ruin for a Biased Random Walk Position",
    difficulty: "medium",
    topics: ["probability", "math"],
    problem:
      "A trader's inventory starts at i lots (0 < i < N). Each tick it moves +1 with probability p and -1 with probability 1-p, independent across ticks, until it hits 0 (ruin) or N (target). Return the probability the position hits 0 before N.",
    examples: [
      {
        input: "i=4, N=10, p=0.5",
        output: "0.6",
        explanation:
          "At p=0.5 (fair walk), ruin probability is linear in the starting point: (N-i)/N = (10-4)/10 = 0.6.",
      },
      {
        input: "i=4, N=10, p=0.6",
        output: "approximately 0.1834",
        explanation:
          "With a favorable upward drift (p=0.6), ruin probability follows the biased gambler's-ruin closed form and drops well below the fair-walk value, since the walk is now more likely to drift toward N than toward 0.",
      },
    ],
    constraints: ["0 < i < N", "0 < p < 1", "N <= 10^6"],
    approach:
      "This is the classic gambler's ruin problem. Let q = 1-p and r = q/p. For p != 0.5, solving the linear recurrence P(i) = p*P(i+1) + q*P(i-1) with boundary conditions P(0)=1, P(N)=0 via its characteristic roots (1 and r) gives P(i) = (r^N - r^i) / (r^N - 1). For the degenerate p=0.5 case the characteristic equation has a repeated root and the solution is linear instead: P(i) = (N-i)/N. Both are O(1) closed forms; the only real care needed is numerical, since r^N can under- or overflow for extreme N when r is far from 1 -- fine for the realistic ranges here, but worth flagging rather than trusting blindly at the far edges of the constraint.",
    code: `def ruin_probability(i: int, n: int, p: float) -> float:
    q = 1 - p
    if abs(p - 0.5) < 1e-12:
        # repeated root in the characteristic equation -> the solution is linear
        return (n - i) / n

    r = q / p
    # closed form from solving P(i) = p*P(i+1) + q*P(i-1), P(0)=1, P(n)=0
    return (r**n - r**i) / (r**n - 1)

print(round(ruin_probability(4, 10, 0.5), 4))   # 0.6
print(round(ruin_probability(4, 10, 0.6), 4))   # 0.1834

# sanity check against Monte Carlo simulation of the actual random walk
import random

def simulate_ruin(i: int, n: int, p: float) -> bool:
    pos = i
    while 0 < pos < n:
        pos += 1 if random.random() < p else -1
    return pos == 0

random.seed(0)
trials = [simulate_ruin(4, 10, 0.6) for _ in range(20000)]
print(round(sum(trials) / len(trials), 2))   # lands near 0.18`,
    language: "python",
    complexity: {
      time: "O(1) via the closed form (Monte Carlo check only is O(N) per trial)",
      space: "O(1)",
    },
  },
  {
    id: "lc-20261007-limit-order-matching-engine",
    title: "Design a Limit Order Matching Engine (Price-Time Priority)",
    difficulty: "hard",
    topics: ["design"],
    problem:
      "Design a class OrderBook with add_limit_order(order_id, side, price, size), where side is 'buy' or 'sell'. Match the incoming order against resting orders on the opposite side at or better than its price, filling at the RESTING order's price, in price-then-arrival-time priority, partially filling as needed; any unfilled remainder rests in the book. Return the fills produced by this call as (resting_order_id, incoming_order_id, price, filled_size) tuples.",
    examples: [
      {
        input:
          "add_limit_order(1,'sell',101,50); add_limit_order(2,'sell',100,30); add_limit_order(3,'buy',101,60)",
        output: "[(2, 3, 100, 30), (1, 3, 101, 30)]",
        explanation:
          "Order 3 is a buy at 101, willing to pay up to 101. The best resting ask is order 2 at 100 (better price than order 1's 101), so it fills first for all 30 of its shares at 100. The remaining 30 shares order 3 still needs are filled against order 1 at 101, leaving order 1 resting with 20 shares left at 101.",
      },
    ],
    constraints: [
      "price and size are positive integers",
      "orders arrive one at a time, in increasing arrival order",
      "side is 'buy' or 'sell'",
    ],
    approach:
      "Keep two heaps of resting orders: a min-heap for asks keyed by (price, arrival_sequence) -- lowest price first, earliest arrival breaking ties -- and a max-heap for bids keyed by (-price, arrival_sequence) so the highest price pops first with the same tie-break, implemented with heapq by negating price. Each heap entry also stores remaining size, decremented in place as it partially fills. On an incoming buy order, repeatedly peek the best ask: while the ask heap is non-empty, its best price is <= the incoming limit price, and the incoming order still has size left, generate a fill at the RESTING order's price (price improvement goes to the aggressor, the standard price-time priority convention) for min(remaining sizes), decrement both sides, and pop the resting order once it's fully filled. Any incoming size left over after the loop exits rests on the bid heap. Sell orders are the exact mirror against the bid heap.",
    code: `import heapq
import itertools

class OrderBook:
    def __init__(self):
        self._seq = itertools.count()      # arrival order, for time priority
        self.asks: list[tuple[float, int, int, int]] = []   # (price, seq, order_id, size)
        self.bids: list[tuple[float, int, int, int]] = []   # (-price, seq, order_id, size)

    def add_limit_order(self, order_id: int, side: str, price: float, size: int):
        seq = next(self._seq)
        fills = []
        remaining = size

        if side == "buy":
            # match against the lowest-priced resting asks while price allows
            while self.asks and self.asks[0][0] <= price and remaining > 0:
                ask_price, ask_seq, ask_id, ask_size = heapq.heappop(self.asks)
                traded = min(remaining, ask_size)
                fills.append((ask_id, order_id, ask_price, traded))   # fill at RESTING price
                remaining -= traded
                ask_size -= traded
                if ask_size > 0:
                    heapq.heappush(self.asks, (ask_price, ask_seq, ask_id, ask_size))
            if remaining > 0:
                heapq.heappush(self.bids, (-price, seq, order_id, remaining))
        else:
            while self.bids and -self.bids[0][0] >= price and remaining > 0:
                neg_price, bid_seq, bid_id, bid_size = heapq.heappop(self.bids)
                traded = min(remaining, bid_size)
                fills.append((bid_id, order_id, -neg_price, traded))
                remaining -= traded
                bid_size -= traded
                if bid_size > 0:
                    heapq.heappush(self.bids, (neg_price, bid_seq, bid_id, bid_size))
            if remaining > 0:
                heapq.heappush(self.asks, (price, seq, order_id, remaining))

        return fills

book = OrderBook()
book.add_limit_order(1, "sell", 101, 50)
book.add_limit_order(2, "sell", 100, 30)
print(book.add_limit_order(3, "buy", 101, 60))
# [(2, 3, 100, 30), (1, 3, 101, 30)]`,
    language: "python",
    complexity: {
      time: "O(log n) per matched order touch, amortized over k fills",
      space: "O(n) resting orders",
    },
  },
];
