import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-21
// A two-heap running median of trade sizes, a min-window-substring
// pattern for order types, a buy/sell DP with a T+1 settlement
// cooldown, a gambler's-ruin profit-target probability, and a
// lazy-deletion two-heap top-of-book tracker.
// ============================================================

export const financeBatch20260921: LeetCodeProblem[] = [
  {
    id: "lc-20260921-running-median-trade-size",
    title: "Running Median of Streaming Trade Sizes",
    difficulty: "medium",
    topics: ["heap", "streaming", "design"],
    problem:
      "Design a class TradeSizeMedian that supports add(trade_size), inserting a new trade size, and median(), returning the median of all trade sizes seen so far (average of the two middle values if the count is even).",
    examples: [
      {
        input: "add(5); median(); add(15); median(); add(1); median(); add(3); median()",
        output: "5, 10.0, 5, 4.0",
        explanation:
          "After [5]: median 5. After [5,15]: median (5+15)/2=10.0. After [1,5,15]: sorted [1,5,15], median 5. After [1,3,5,15]: sorted, median (3+5)/2=4.0.",
      },
    ],
    constraints: ["up to 10^5 calls to add", "trade sizes fit in a 32-bit int"],
    approach:
      "Maintain two heaps: a max-heap 'lo' holding the smaller half of values (negated, since Python's heapq is min-heap only) and a min-heap 'hi' holding the larger half, kept balanced in size (differing by at most one element). On each add, push into lo, then move lo's max into hi to maintain the ordering invariant (everything in lo <= everything in hi), then rebalance sizes by moving the smaller heap's top back over if one heap has grown more than one element larger than the other. median() then reads off the top of whichever heap has more elements, or averages both tops when they're equal size -- both operations avoid ever re-sorting the full history, giving O(log n) inserts and O(1) median reads.",
    code: `import heapq

class TradeSizeMedian:
    def __init__(self):
        self.lo: list[int] = []   # max-heap (negated), holds the smaller half
        self.hi: list[int] = []   # min-heap, holds the larger half

    def add(self, trade_size: int) -> None:
        heapq.heappush(self.lo, -trade_size)
        # enforce lo's max <= hi's min by moving lo's top into hi
        heapq.heappush(self.hi, -heapq.heappop(self.lo))
        # rebalance: lo may hold at most one more element than hi
        if len(self.hi) > len(self.lo):
            heapq.heappush(self.lo, -heapq.heappop(self.hi))

    def median(self) -> float:
        if len(self.lo) > len(self.hi):
            return float(-self.lo[0])
        return (-self.lo[0] + self.hi[0]) / 2.0

tracker = TradeSizeMedian()
for size in [5, 15, 1, 3]:
    tracker.add(size)
    print(tracker.median())`,
    language: "python",
    complexity: { time: "O(log n) per add, O(1) per median", space: "O(n)" },
  },
  {
    id: "lc-20260921-shortest-window-order-types",
    title: "Shortest Window of Ticks Containing Every Required Order Type",
    difficulty: "hard",
    topics: ["sliding-window", "hash-table"],
    problem:
      "Given a chronological list of order-type tags per tick (e.g. LIMIT, MARKET, CANCEL, ...) and a set of required order types that must all appear, return the shortest contiguous window of ticks that contains at least one of every required type, or None if no such window exists.",
    examples: [
      {
        input: 'ticks=["LIMIT","MARKET","LIMIT","CANCEL","MARKET"], required={"MARKET","CANCEL"}',
        output: "(3, 4)",
        explanation:
          'The window ticks[3:5] = ["CANCEL","MARKET"] is the shortest contiguous window containing both required types.',
      },
    ],
    constraints: ["1 <= len(ticks) <= 10^5", "1 <= len(required) <= 26"],
    approach:
      "This is the classic minimum-window-substring pattern applied to order types instead of characters. Expand a right pointer across the ticks, incrementing a counts map and a 'satisfied' counter each time a needed type's count crosses from 0 to 1. Once satisfied equals len(required) (every required type present at least once in the window), greedily shrink from the left, decrementing counts and the satisfied counter as a required type's count drops back to 0, recording the window any time it's smaller than the best seen. Each tick is added once and removed at most once, so despite the nested loops this is O(n) overall, not O(n^2).",
    code: `def shortest_window_all_order_types(ticks: list[str], required: set[str]):
    need = {t: 0 for t in required}
    have = 0   # count of required types currently present at least once
    left = 0
    best = None

    for right, tag in enumerate(ticks):
        if tag in need:
            need[tag] += 1
            if need[tag] == 1:
                have += 1

        # window satisfies all required types -- shrink from the left
        # to find the tightest window ending at right
        while have == len(required):
            if best is None or (right - left) < (best[1] - best[0]):
                best = (left, right)
            left_tag = ticks[left]
            if left_tag in need:
                need[left_tag] -= 1
                if need[left_tag] == 0:
                    have -= 1
            left += 1

    return best

ticks = ["LIMIT", "MARKET", "LIMIT", "CANCEL", "MARKET"]
print(shortest_window_all_order_types(ticks, {"MARKET", "CANCEL"}))   # (3, 4)`,
    language: "python",
    complexity: { time: "O(n)", space: "O(k) for k required types" },
  },
  {
    id: "lc-20260921-max-profit-settlement-cooldown",
    title: "Best Time to Buy and Sell Stock With a Mandatory Settlement Cooldown",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices, you may buy and sell as many times as you like (one share at a time, no overlapping positions), but after selling you must wait one full day before you're allowed to buy again (a T+1 settlement cooldown). Return the maximum achievable profit.",
    examples: [
      {
        input: "prices=[1,2,3,0,2]",
        output: "3",
        explanation:
          "Buy day0 (price 1), sell day1 (price 2, profit 1), cooldown day2, buy day3 (price 0), sell day4 (price 2, profit 2). Total 1+2=3.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000", "0 <= prices[i] <= 1000"],
    approach:
      "Three-state DP tracked per day: held (best profit while currently holding a share), sold (best profit on the day you just sold, entering cooldown), and rest (best profit while holding nothing and free to buy). Transitions: held today is either held yesterday, or rest yesterday minus today's price (buying today); sold today is held yesterday plus today's price (selling today); rest today is the better of rest yesterday or sold yesterday (cooldown day is over). Reading max(sold, rest) at the end gives the answer -- you'd never end holding an unsold share. Rolling three scalars forward instead of arrays keeps this O(1) space.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    held = float("-inf")   # best profit, currently holding a share
    sold = 0                # best profit, just sold today (cooldown starts)
    rest = 0                # best profit, holding nothing, free to buy

    for price in prices:
        prev_sold = sold
        # sell today: was held yesterday, cash in today's price
        sold = held + price
        # buy today: must have been resting (not in cooldown) yesterday
        held = max(held, rest - price)
        # rest today: either still resting, or cooldown from yesterday's sale just ended
        rest = max(rest, prev_sold)

    return max(sold, rest)

print(max_profit_with_cooldown([1, 2, 3, 0, 2]))   # 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260921-gamblers-ruin-profit-target",
    title: "Probability of Hitting a Profit Target Before a Stop-Loss (Gambler's Ruin)",
    difficulty: "hard",
    topics: ["probability", "dynamic-programming", "markov-chain"],
    problem:
      "A trader's running P&L moves in discrete $1 ticks: up with probability p, down with probability 1-p, each tick independent. Starting at P&L 0, return the probability the trader hits a profit target of +T dollars before hitting a stop-loss of -S dollars.",
    examples: [
      {
        input: "p=0.5, target=4, stop_loss=2",
        output: "0.3333",
        explanation:
          "Symmetric random walk (p=0.5): the classic gambler's ruin closed form gives probability = S / (S+T) = 2/6 = 0.3333, the fair-coin case where the answer is just the ratio of distances.",
      },
    ],
    constraints: ["0 < p < 1", "1 <= target, stop_loss <= 10^4"],
    approach:
      "This is the gambler's ruin problem: states are the current P&L position from -S (stop-loss, absorbing) to +T (target, absorbing). Let f(i) be the probability of reaching +T before -S starting from position i. It satisfies f(i) = p*f(i+1) + (1-p)*f(i-1), a linear recurrence with boundary conditions f(-S)=0, f(T)=1. For p != 0.5 the closed form is f(0) = (1 - r^S) / (1 - r^(S+T)) where r = (1-p)/p; for the symmetric p=0.5 case the recurrence degenerates and the closed form is simply f(0) = S / (S+T), a linear rather than geometric relationship. Reaching for the closed form instead of simulating is both exact and O(1), versus a Monte Carlo estimate that only converges slowly, especially for target and stop_loss in the thousands.",
    code: `def profit_before_stoploss(p: float, target: int, stop_loss: int) -> float:
    if abs(p - 0.5) < 1e-12:
        # symmetric random walk: probability is linear in distance to each barrier
        return stop_loss / (stop_loss + target)

    # asymmetric random walk: gambler's ruin closed form with ratio r = (1-p)/p
    r = (1 - p) / p
    numerator = 1 - r ** stop_loss
    denominator = 1 - r ** (stop_loss + target)
    return numerator / denominator

print(round(profit_before_stoploss(0.5, target=4, stop_loss=2), 4))     # 0.3333
print(round(profit_before_stoploss(0.52, target=10, stop_loss=10), 4))  # edge in your favor raises the odds`,
    language: "python",
    complexity: { time: "O(log S) for exponentiation", space: "O(1)" },
  },
  {
    id: "lc-20260921-design-top-of-book",
    title: "Design a Limit Order Book Top-of-Book Tracker",
    difficulty: "medium",
    topics: ["design", "heap"],
    problem:
      "Design a class TopOfBook that supports add_order(order_id, side, price) where side is BUY or SELL, cancel_order(order_id) removing a previously added order, best_bid() returning the highest active BUY price (or None), and best_ask() returning the lowest active SELL price (or None).",
    examples: [
      {
        input:
          'add_order(1,"BUY",100); add_order(2,"BUY",102); add_order(3,"SELL",105); best_bid(); best_ask(); cancel_order(2); best_bid()',
        output: "102, 105, 100",
        explanation:
          "Best bid starts at 102 (the higher of 100/102), best ask at 105. After cancelling order 2 (the 102 bid), best bid falls back to 100.",
      },
    ],
    constraints: ["up to 10^5 total calls", "prices are positive numbers", "order_ids are unique while active"],
    approach:
      "Use two heaps for O(log n) top-of-book reads: a max-heap (negated prices) for bids, a min-heap for asks, each storing (price, order_id). Cancelling doesn't touch the heap directly (removing an arbitrary element from a heap is O(n)); instead mark the order_id cancelled in a separate set -- this is lazy deletion. best_bid/best_ask then pop from the top of the relevant heap while the top's order_id is marked cancelled, discarding stale entries until a live one surfaces (or the heap empties), so the amortized cost stays O(log n) per operation across the whole run even though any single call can clear out a run of stale entries.",
    code: `import heapq

class TopOfBook:
    def __init__(self):
        self.bids: list[tuple[float, int]] = []   # max-heap: (-price, order_id)
        self.asks: list[tuple[float, int]] = []   # min-heap: (price, order_id)
        self.cancelled: set[int] = set()

    def add_order(self, order_id: int, side: str, price: float) -> None:
        if side == "BUY":
            heapq.heappush(self.bids, (-price, order_id))
        else:
            heapq.heappush(self.asks, (price, order_id))

    def cancel_order(self, order_id: int) -> None:
        # lazy deletion: mark cancelled now, let the heap discard it later
        # rather than paying O(n) to remove it from the middle of the heap
        self.cancelled.add(order_id)

    def best_bid(self):
        while self.bids and self.bids[0][1] in self.cancelled:
            heapq.heappop(self.bids)
        return -self.bids[0][0] if self.bids else None

    def best_ask(self):
        while self.asks and self.asks[0][1] in self.cancelled:
            heapq.heappop(self.asks)
        return self.asks[0][0] if self.asks else None

book = TopOfBook()
book.add_order(1, "BUY", 100)
book.add_order(2, "BUY", 102)
book.add_order(3, "SELL", 105)
print(book.best_bid(), book.best_ask())   # 102 105
book.cancel_order(2)
print(book.best_bid())   # 100`,
    language: "python",
    complexity: { time: "O(log n) amortized per operation", space: "O(n)" },
  },
];
