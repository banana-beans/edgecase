import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-30
// Two-heap running median of trade prints (heap), longest window
// where the bid-ask spread stays under a threshold (sliding
// window / monotonic deque), max profit with a flat transaction
// fee per round trip (DP stock variant), gambler's-ruin
// probability of hitting a profit target before a stop-loss
// (probability / absorbing random walk), and a FIFO position
// tracker computing realized P&L on partial sells (design).
// ============================================================

export const financeBatch20261030: LeetCodeProblem[] = [
  {
    id: "lc-20261030-running-median-two-heaps",
    title: "Running Median of a Live Trade Print Stream Using Two Heaps",
    difficulty: "hard",
    topics: ["heap"],
    problem:
      "Design a class that processes a live stream of trade prices one at a time via add_price(price), and at any point can return the median of all prices seen so far via get_median().",
    examples: [
      {
        input: "add_price(10); add_price(20); get_median(); add_price(15); get_median()",
        output: "15.0; then 15.0",
        explanation:
          "After [10, 20] the median of the two middle values is (10+20)/2 = 15.0. After inserting 15, the sorted stream is [10, 15, 20] and the median is the single middle element, 15.0.",
      },
    ],
    constraints: ["up to 10^5 calls to add_price", "-10^6 <= price <= 10^6"],
    approach:
      "Keep two heaps that together always hold a valid split of everything seen so far: a max-heap (as a min-heap of negated prices) for the lower half, and a min-heap for the upper half, kept balanced so their sizes never differ by more than one. On insert, push into whichever heap it belongs to by comparing against the lower half's max, then rebalance by moving the top of the larger heap to the smaller one if the size invariant breaks. get_median reads off the top of the larger heap (odd total count) or averages both tops (even total count) in O(1), since the heaps already keep those boundary elements at the top.",
    code: `import heapq

class RunningMedian:
    def __init__(self) -> None:
        self._lower: list[int] = []   # max-heap via negated prices -- smaller half
        self._upper: list[int] = []   # min-heap, natural order -- larger half

    def add_price(self, price: int) -> None:
        # route into the correct half, comparing against the lower half's max
        if self._lower and price > -self._lower[0]:
            heapq.heappush(self._upper, price)
        else:
            heapq.heappush(self._lower, -price)

        # rebalance so the two halves never differ in size by more than one
        if len(self._lower) > len(self._upper) + 1:
            heapq.heappush(self._upper, -heapq.heappop(self._lower))
        elif len(self._upper) > len(self._lower) + 1:
            heapq.heappush(self._lower, -heapq.heappop(self._upper))

    def get_median(self) -> float:
        if len(self._lower) == len(self._upper):
            return (-self._lower[0] + self._upper[0]) / 2
        if len(self._lower) > len(self._upper):
            return float(-self._lower[0])
        return float(self._upper[0])

rm = RunningMedian()
for p in [10, 20]:
    rm.add_price(p)
print(rm.get_median())   # 15.0
rm.add_price(15)
print(rm.get_median())   # 15.0`,
    language: "python",
    complexity: { time: "O(log n) per add_price, O(1) per get_median", space: "O(n)" },
    leetcodeNumber: 295,
  },
  {
    id: "lc-20261030-longest-window-spread-under-threshold",
    title: "Longest Window Where the Bid-Ask Spread Never Exceeds a Threshold",
    difficulty: "medium",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given an array of mid-prices sampled at fixed intervals and an integer limit, return the length of the longest contiguous window where the difference between the window's maximum and minimum price never exceeds limit.",
    examples: [
      {
        input: "prices = [8,2,4,7], limit = 4",
        output: "2",
        explanation:
          "The window [4,7] has max 7, min 4, spread 3 <= 4, length 2. Extending to [2,4,7] gives spread 7-2=5 > 4, which is too wide, so 2 is the longest valid window here.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^9", "0 <= limit <= 10^9"],
    approach:
      "Slide a right pointer forward while maintaining two monotonic deques: one strictly decreasing (tracks the window's running max at its front) and one strictly increasing (tracks the window's running min at its front). Each new price pops any deque entries it invalidates (any smaller entries from the back of the max-deque, any larger entries from the back of the min-deque) before being appended. Whenever front(max-deque) - front(min-deque) exceeds limit, shrink from the left, popping the leaving index off the front of either deque if it sits there. Every index is pushed and popped from each deque at most once, giving O(n) total despite the nested-looking loops.",
    code: `from collections import deque

def longest_window_within_spread(prices: list[int], limit: int) -> int:
    max_deque: deque[int] = deque()   # indices, decreasing prices -- front is the window max
    min_deque: deque[int] = deque()   # indices, increasing prices -- front is the window min
    left = 0
    best = 0

    for right, price in enumerate(prices):
        while max_deque and prices[max_deque[-1]] <= price:
            max_deque.pop()
        max_deque.append(right)

        while min_deque and prices[min_deque[-1]] >= price:
            min_deque.pop()
        min_deque.append(right)

        while prices[max_deque[0]] - prices[min_deque[0]] > limit:
            left += 1
            if max_deque[0] < left:
                max_deque.popleft()
            if min_deque[0] < left:
                min_deque.popleft()

        best = max(best, right - left + 1)

    return best

print(longest_window_within_spread([8, 2, 4, 7], limit=4))
# 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
    leetcodeNumber: 1438,
  },
  {
    id: "lc-20261030-max-profit-with-transaction-fee",
    title: "Max Profit With Unlimited Round Trips, Each Charged a Flat Transaction Fee",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given a daily price array and an integer fee, you may complete as many buy-then-sell round trips as you like (must fully sell before buying again), but each completed round trip costs fee, charged once per round trip. Return the maximum achievable profit net of fees.",
    examples: [
      {
        input: "prices = [1,3,2,8,4,9], fee = 2",
        output: "8",
        explanation:
          "Buy at 1, sell at 8, netting 8-1-2=5. Then buy at 4, sell at 9, netting 9-4-2=3. Total 5+3=8, which beats any other combination of round trips once the fee is paid on each one.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^5", "0 <= fee <= 10^5"],
    approach:
      "Track two running values as you scan left to right: cash is the best net profit achievable while holding no position right now, and hold is the best net profit achievable while currently holding one share. Each day, cash can either stay as-is or come from selling today (hold + price - fee, charging the fee once on the sell leg rather than the buy leg, which is an arbitrary but consistent choice that avoids double-charging); hold can either stay as-is or come from buying today (cash - price). The answer is cash after the last day, since ending while still holding a share can never beat having sold it.",
    code: `def max_profit_with_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    cash = 0                 # best profit while flat (no open position)
    hold = -prices[0]        # best profit while holding one share

    for price in prices[1:]:
        cash = max(cash, hold + price - fee)   # charge the fee once, on the sell leg
        hold = max(hold, cash - price)

    return cash

print(max_profit_with_fee([1, 3, 2, 8, 4, 9], fee=2))
# 8`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 714,
  },
  {
    id: "lc-20261030-gamblers-ruin-profit-target-before-stoploss",
    title: "Probability of Hitting a Profit Target Before a Stop-Loss (Gambler's Ruin)",
    difficulty: "medium",
    topics: ["probability", "random-walk"],
    problem:
      "A strategy's running P&L moves up by one unit with probability p and down by one unit with probability 1 - p on each independent trade. Starting from P&L 0, return the probability that the P&L hits +target before it hits -stop (i.e., the strategy locks in its profit target before getting stopped out).",
    examples: [
      {
        input: "p = 0.5, target = 3, stop = 2",
        output: "0.4",
        explanation:
          "With a fair walk, the classic gambler's-ruin formula collapses to the simple ratio stop / (target + stop) = 2/5 = 0.4 -- the symmetric case has a closed form that doesn't need the general p != 0.5 formula at all.",
      },
    ],
    constraints: ["0 < p < 1", "1 <= target <= 10^4", "1 <= stop <= 10^4"],
    approach:
      "This is the classic gambler's ruin problem with absorbing barriers at +target and -stop. Let q = 1 - p and r = q / p. For p != 0.5, the probability of hitting +target before -stop starting from 0 is (1 - r^stop) / (1 - r^(target + stop)) -- derived by setting up the hitting-probability recursion P(i) = p*P(i+1) + q*P(i-1) with boundary conditions P(-stop) = 0 and P(target) = 1, and solving the resulting linear recurrence, which has a geometric-ratio solution exactly because the recursion is a constant-coefficient second-order linear one. For the boundary case p = 0.5 (r = 1), that formula is 0/0, and the separate, simpler closed form stop / (target + stop) applies instead, which also has a clean intuition: a fair walk's hitting probability is linear in starting position, so it splits the interval proportionally.",
    code: `def prob_hit_target_before_stop(p: float, target: int, stop: int) -> float:
    q = 1 - p

    if abs(p - 0.5) < 1e-12:
        # fair-walk special case -- hitting probability is linear in position
        return stop / (target + stop)

    r = q / p
    return (1 - r ** stop) / (1 - r ** (target + stop))

print(round(prob_hit_target_before_stop(0.5, target=3, stop=2), 4))
# 0.4 -- matches the simple stop / (target + stop) ratio

print(round(prob_hit_target_before_stop(0.55, target=3, stop=2), 4))
# a slight positive edge per trade noticeably raises the hit-target-first probability`,
    language: "python",
    complexity: { time: "O(log(target + stop)) for the power terms", space: "O(1)" },
  },
  {
    id: "lc-20261030-design-fifo-position-tracker",
    title: "Design a FIFO Position Tracker With Realized P&L on Partial Sells",
    difficulty: "medium",
    topics: ["design", "queue"],
    problem:
      "Design a class PositionTracker for a single symbol supporting buy(qty, price), which adds a new lot at that price, and sell(qty, price), which closes out quantity against the OLDEST open lots first (FIFO) and returns the realized P&L from this sell (using each consumed lot's own cost basis, not an average), raising an error if qty exceeds the currently open position.",
    examples: [
      {
        input: "buy(10,100); buy(10,110); sell(15,120)",
        output: "250.0",
        explanation:
          "FIFO consumes the first lot fully: 10 shares at (120-100)=20 profit each = 200. Then 5 shares from the second lot at (120-110)=10 profit each = 50. Total realized P&L = 200+50 = 250.0, leaving 5 shares of the second lot still open at cost 110.",
      },
    ],
    constraints: ["up to 10^5 calls across buy and sell", "qty and price are positive"],
    approach:
      "Hold open lots in a deque, each entry (qty, cost_price), appended on buy and consumed from the LEFT on sell, which is exactly what FIFO requires and exactly what a deque's O(1) popleft/append give you for free. On sell, repeatedly peek the front lot: if it fully covers the remaining qty to sell, partially consume it in place (shrink its qty, leave it at the front) and stop; otherwise consume it entirely (popleft it), accumulate its full P&L contribution, and continue against the next lot. Summing (sell_price - lot_cost_price) * qty_consumed per lot consumed as you go gives the correct realized P&L without ever needing to track a blended average cost.",
    code: `from collections import deque

class PositionTracker:
    def __init__(self) -> None:
        self._lots: deque[list[float]] = deque()   # [qty, cost_price] per open lot, oldest first

    def buy(self, qty: float, price: float) -> None:
        self._lots.append([qty, price])

    def sell(self, qty: float, price: float) -> float:
        remaining = qty
        realized_pnl = 0.0

        while remaining > 0:
            if not self._lots:
                raise ValueError("sell quantity exceeds open position")

            lot_qty, lot_cost = self._lots[0]
            consumed = min(lot_qty, remaining)
            realized_pnl += (price - lot_cost) * consumed
            remaining -= consumed

            if consumed == lot_qty:
                self._lots.popleft()       # this lot is fully closed out
            else:
                self._lots[0][0] -= consumed   # partially closed -- shrink in place

        return realized_pnl

tracker = PositionTracker()
tracker.buy(10, 100.0)
tracker.buy(10, 110.0)
print(tracker.sell(15, 120.0))
# 250.0`,
    language: "python",
    complexity: { time: "O(lots consumed) per sell, amortized O(1) per buy", space: "O(open lots)" },
  },
];
