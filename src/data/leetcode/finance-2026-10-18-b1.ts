import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-18
// Smallest price range covering a quote from every venue
// (heap), longest run of fills within a limited number of
// distinct price levels (sliding window), max profit with a
// mandatory cooldown after closing a position (DP stock
// variant), gambler's-ruin probability of hitting a profit
// target before a stop-loss (probability/Markov), and an
// incremental rolling VWAP tracker (design).
// ============================================================

export const financeBatch20261018: LeetCodeProblem[] = [
  {
    id: "lc-20261018-smallest-price-range-covering-every-venue",
    title: "Smallest Price Range Covering a Quote From Every Venue",
    difficulty: "hard",
    topics: ["heap"],
    problem:
      "Given K venues, each providing its own sorted (ascending) list of quoted prices, return the smallest price range [low, high] that includes at least one quote from every venue.",
    examples: [
      {
        input: "venues = [[4,10,15,24,26],[0,9,12,20],[5,18,22,30]]",
        output: "[20, 24]",
        explanation:
          "The range [20, 24] contains 24 from venue 1, 20 from venue 2, and 22 from venue 3 -- one quote from each venue, in a range of width 4, which is the smallest achievable.",
      },
    ],
    constraints: [
      "1 <= venues.length (k) <= 3500",
      "1 <= venues[i].length",
      "each venues[i] is sorted in ascending order",
      "-10^5 <= venues[i][j] <= 10^5",
    ],
    approach:
      "Maintain a min-heap holding exactly one 'current' quote per venue, plus a running track of the current maximum across those k quotes. At each step the heap's minimum and the tracked maximum together define a candidate range that covers all k venues; record it if it's the smallest seen so far. Then advance ONLY the venue that contributed the minimum (pop it, push its venue's next quote), since that's the only pointer that can shrink the range further. Stop the moment any venue's quote list is exhausted, since no future candidate could then cover all k venues. This mirrors the classic 'smallest range covering elements from k lists' pattern: each of the k pointers only moves forward, giving O(n log k) over n total quotes instead of checking every combination.",
    code: `import heapq

def smallest_range_covering_every_venue(venues: list[list[int]]) -> list[int]:
    heap = []  # (price, venue_idx, price_idx) -- one entry per venue at a time
    current_max = float("-inf")

    # seed the heap with each venue's lowest quote
    for v, prices in enumerate(venues):
        heapq.heappush(heap, (prices[0], v, 0))
        current_max = max(current_max, prices[0])

    best_low, best_high = float("-inf"), float("inf")

    while True:
        low, v, i = heapq.heappop(heap)
        if current_max - low < best_high - best_low:
            best_low, best_high = low, current_max

        # this venue has no more quotes -- no later range can cover every venue
        if i + 1 == len(venues[v]):
            break

        next_price = venues[v][i + 1]
        current_max = max(current_max, next_price)
        heapq.heappush(heap, (next_price, v, i + 1))

    return [best_low, best_high]

print(smallest_range_covering_every_venue([
    [4, 10, 15, 24, 26], [0, 9, 12, 20], [5, 18, 22, 30],
]))
# [20, 24]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-20261018-longest-run-limited-price-levels",
    title: "Longest Run of Consecutive Fills Within K Distinct Price Levels",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a sequence of fill prices in execution order and an integer k, return the length of the longest contiguous run of fills that contains at most k distinct price levels.",
    examples: [
      {
        input: "prices = [1, 2, 1, 2, 3], k = 2",
        output: "4",
        explanation:
          "The run [1, 2, 1, 2] (indices 0-3) has exactly 2 distinct price levels and length 4; extending it to include the 3 at index 4 would push the distinct count to 3, which exceeds k.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "1 <= k <= prices.length"],
    approach:
      "This is the sliding-window 'at most k distinct values' pattern: expand the right pointer, tracking a running count of each price level currently inside the window in a hashmap. Whenever the number of DISTINCT keys in that hashmap exceeds k, shrink from the left, decrementing counts and removing a price level from the map entirely once its count hits zero, until the window is valid again. The window length is recorded as a candidate maximum on every iteration (not only when it shrinks), since a still-valid, still-growing window can itself be the new longest. Both pointers only move forward, so the whole scan is O(n) despite the nested-looking expand/shrink structure.",
    code: `from collections import defaultdict

def longest_run_limited_price_levels(prices: list[int], k: int) -> int:
    counts: dict[int, int] = defaultdict(int)
    left = 0
    best = 0

    for right, price in enumerate(prices):
        counts[price] += 1

        # shrink from the left while the window holds more than k distinct levels
        while len(counts) > k:
            left_price = prices[left]
            counts[left_price] -= 1
            if counts[left_price] == 0:
                del counts[left_price]
            left += 1

        best = max(best, right - left + 1)

    return best

print(longest_run_limited_price_levels([1, 2, 1, 2, 3], k=2))
# 4`,
    language: "python",
    complexity: { time: "O(n)", space: "O(k)" },
  },
  {
    id: "lc-20261018-max-profit-with-cooldown",
    title: "Maximum Profit With a Mandatory Cooldown After Closing a Position",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given a sequence of daily prices for one instrument, return the maximum total profit from any number of non-overlapping round-trip trades, where you must wait at least one full day after selling before you're allowed to buy again.",
    examples: [
      {
        input: "prices = [1, 2, 3, 0, 2]",
        output: "3",
        explanation:
          "Buy at 1 (index 0), sell at 2 (index 1): profit 1. Day 2 is a mandatory cooldown (can't buy at 3). Buy at 0 (index 3), sell at 2 (index 4): profit 2. Total profit 3, which beats any other sequence of trades respecting the cooldown.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000", "0 <= prices[i] <= 1000"],
    approach:
      "This is the DP state-machine form of the buy/sell-stock family with a cooldown constraint added as a third state. Track three running values after each day: hold (currently holding a position), sold (sold TODAY, so tomorrow is forced cooldown), and rest (not holding and free to buy, either never having traded or with the cooldown already satisfied). The key transition is that 'rest' can only come from yesterday's 'rest' or yesterday's 'sold' -- never directly from yesterday's 'hold' skipping a sell -- which is exactly what encodes the one-day cooldown rule. Each day's states depend only on the previous day's states, so this runs in O(n) time and O(1) space instead of exploring every possible trade sequence.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    # hold: currently holding a position
    # sold: sold TODAY -- tomorrow is a forced cooldown, can't buy
    # rest: not holding, free to buy (never traded yet, or cooldown has passed)
    hold, sold, rest = -prices[0], 0, 0

    for price in prices[1:]:
        prev_hold, prev_sold, prev_rest = hold, sold, rest
        hold = max(prev_hold, prev_rest - price)
        sold = prev_hold + price
        rest = max(prev_rest, prev_sold)

    return max(sold, rest)

print(max_profit_with_cooldown([1, 2, 3, 0, 2]))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261018-gamblers-ruin-profit-target-before-stop",
    title: "Gambler's Ruin: Probability of Hitting a Profit Target Before a Stop-Loss",
    difficulty: "medium",
    topics: ["probability"],
    problem:
      "A position's mark-to-market P&L moves up by 1 tick with probability p, or down by 1 tick with probability (1 - p), each step, starting at 0. Given a stop-loss level at -S ticks and a take-profit level at +T ticks (both positive integers), return the probability the P&L hits +T before it hits -S.",
    examples: [
      {
        input: "p = 0.5, stop_loss = 3, take_profit = 5",
        output: "0.375",
        explanation:
          "With a fair (p = 0.5) random walk, the classic gambler's-ruin result gives probability S / (S + T) = 3 / 8 = 0.375 of reaching the profit target before the stop-loss.",
      },
    ],
    constraints: ["0 < p < 1", "1 <= stop_loss, take_profit <= 10^4"],
    approach:
      "This is the classic gambler's ruin problem: a random walk with two absorbing barriers, at -S and +T, starting at 0. For a fair walk (p = 0.5), the probability of absorption at +T before -S is simply S / (S + T), by a symmetry argument. For a biased walk (p != 0.5), the closed-form solution comes from solving a linear difference equation on the absorption probability as a function of starting position, using the ratio r = (1 - p) / p: the probability of hitting +T first is (1 - r^S) / (1 - r^(S+T)). Both cases are O(1) once you have the formula, avoiding a O(S+T) state-by-state DP (which also works, but the closed form is the fast path an interviewer is probing for).",
    code: `def prob_hit_profit_target_first(p: float, stop_loss: int, take_profit: int) -> float:
    # gambler's ruin: absorbing barriers at -stop_loss and +take_profit,
    # starting at 0, step +1 with probability p, -1 with probability (1 - p)
    if p == 0.5:
        return stop_loss / (stop_loss + take_profit)

    r = (1 - p) / p
    return (1 - r ** stop_loss) / (1 - r ** (stop_loss + take_profit))

print(prob_hit_profit_target_first(p=0.5, stop_loss=3, take_profit=5))
# 0.375

print(round(prob_hit_profit_target_first(p=0.48, stop_loss=3, take_profit=5), 4))
# slightly below 0.375 -- a per-tick edge below 50/50 lowers the odds of
# reaching the profit target first, even over this short a walk`,
    language: "python",
    complexity: { time: "O(1)", space: "O(1)" },
  },
  {
    id: "lc-20261018-design-rolling-vwap-tracker",
    title: "Design an Incremental Rolling VWAP Tracker",
    difficulty: "medium",
    topics: ["design"],
    problem:
      "Design a class RollingVWAP(window) that supports add_trade(price, size), recording a new trade, and get_vwap(), returning the volume-weighted average price over only the most recent `window` trades. Both operations must run in O(1) time.",
    examples: [
      {
        input:
          "window = 3; add_trade(100, 10); add_trade(102, 5); add_trade(101, 20); add_trade(105, 5); get_vwap()",
        output: "101.8333",
        explanation:
          "After the 4th trade, the (100, 10) trade has rolled out of the window. VWAP over the remaining 3 is (102*5 + 101*20 + 105*5) / (5 + 20 + 5) = 3055 / 30 ~= 101.8333.",
      },
    ],
    constraints: ["1 <= window <= 10^5", "up to 10^5 calls to add_trade", "price > 0, size > 0"],
    approach:
      "Maintain a deque of the last `window` (price, size) trades along with two running totals: the sum of price*size and the sum of size, across exactly the trades currently in the deque. On add_trade, append the new trade and add its contribution to both running totals in O(1); if the deque now holds more than `window` trades, pop the oldest one off the front and SUBTRACT its contribution from both running totals, also O(1). get_vwap() then only needs to divide the two running totals, never re-summing the window's trades from scratch. This incremental-running-sum technique is the general fix for any 'rolling window average' that would otherwise cost O(window) per call if recomputed naively.",
    code: `from collections import deque

class RollingVWAP:
    def __init__(self, window: int):
        self.window = window
        self.trades: deque[tuple[float, int]] = deque()  # (price, size)
        self.sum_price_size = 0.0
        self.sum_size = 0

    def add_trade(self, price: float, size: int) -> None:
        self.trades.append((price, size))
        self.sum_price_size += price * size
        self.sum_size += size

        # evict the oldest trade's contribution once the window overflows --
        # O(1) because running sums are tracked instead of resumming each call
        if len(self.trades) > self.window:
            old_price, old_size = self.trades.popleft()
            self.sum_price_size -= old_price * old_size
            self.sum_size -= old_size

    def get_vwap(self) -> float:
        if self.sum_size == 0:
            return 0.0
        return self.sum_price_size / self.sum_size

vwap = RollingVWAP(window=3)
for price, size in [(100, 10), (102, 5), (101, 20), (105, 5)]:
    vwap.add_trade(price, size)
print(round(vwap.get_vwap(), 4))
# 101.8333 -- VWAP over just the last 3 trades; (100, 10) has rolled off`,
    language: "python",
    complexity: { time: "O(1) per operation", space: "O(window)" },
  },
];
