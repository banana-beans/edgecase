import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-08
// A two-heap sliding-window median over order sizes, a variable
// window under a volume participation cap, a stock DP combining
// a cooldown with a short-borrow holding fee, fast matrix-power
// evaluation of a market-regime Markov chain, and a lazy-deletion
// limit order book design problem.
// ============================================================

export const financeBatch20260908: LeetCodeProblem[] = [
  {
    id: "lc-20260908-sliding-window-median-order-size",
    title: "Sliding Window Median of Order Sizes Using Two Heaps",
    difficulty: "hard",
    topics: ["heap", "sliding-window"],
    problem:
      "Given a stream of order sizes and a window length k, return the median order size for every window of k consecutive orders as the window slides one order at a time.",
    examples: [
      {
        input: "orders=[10,20,30,40,50], k=3",
        output: "[20, 30, 40]",
        explanation:
          "Window [10,20,30] has median 20; window [20,30,40] has median 30; window [30,40,50] has median 40.",
      },
    ],
    constraints: ["1 <= k <= orders.length <= 10^5", "order sizes are positive integers"],
    approach:
      "Maintain a max-heap ('small', values negated) for the lower half of the current window and a min-heap ('large') for the upper half, balanced so 'small' always holds ceil(k/2) elements. Removing an element that leaves the window can't be done in O(log k) directly from the middle of a heap, so use lazy deletion: mark the outgoing value in a delayed-removal counter, and only actually pop it from a heap when it happens to surface at the top -- both the balance step and the median read first 'prune' the top of whichever heap they touch, discarding any value whose delayed count is still positive. Because lazy deletion works by VALUE rather than by tracking a specific heap slot, duplicate values are interchangeable and the aggregate multiset stays correct even though a stale entry may sit buried in a heap for a while before it happens to be pruned.",
    code: `import heapq
from collections import defaultdict

def median_sliding_window(nums: list[int], k: int) -> list[float]:
    small, large = [], []          # small: max-heap (negated); large: min-heap
    to_delete = defaultdict(int)   # value -> count pending lazy removal
    small_size = large_size = 0

    def prune(heap, is_small):
        while heap:
            top = -heap[0] if is_small else heap[0]
            if to_delete[top] > 0:
                to_delete[top] -= 1
                heapq.heappop(heap)
            else:
                return

    def balance():
        nonlocal small_size, large_size
        if small_size > large_size + 1:
            prune(small, True)
            heapq.heappush(large, -heapq.heappop(small))
            small_size -= 1
            large_size += 1
        elif small_size < large_size:
            prune(large, False)
            heapq.heappush(small, -heapq.heappop(large))
            large_size -= 1
            small_size += 1

    def add_num(num):
        nonlocal small_size, large_size
        prune(small, True)
        if not small or num <= -small[0]:
            heapq.heappush(small, -num)
            small_size += 1
        else:
            heapq.heappush(large, num)
            large_size += 1
        balance()

    def remove_num(num):
        nonlocal small_size, large_size
        to_delete[num] += 1
        prune(small, True)
        if small and num <= -small[0]:
            small_size -= 1
        else:
            large_size -= 1
        balance()

    def get_median():
        prune(small, True)
        return float(-small[0]) if k % 2 else (-small[0] + large[0]) / 2.0

    result = []
    for i, num in enumerate(nums):
        add_num(num)
        if i >= k:
            remove_num(nums[i - k])
        if i >= k - 1:
            result.append(get_median())
    return result

print(median_sliding_window([10, 20, 30, 40, 50], 3))   # [20.0, 30.0, 40.0]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-20260908-longest-window-under-participation-cap",
    title: "Longest Run of Trading Days Under a Volume Participation Cap",
    difficulty: "medium",
    topics: ["sliding-window", "prefix-sum"],
    problem:
      "Given daily traded volumes for a stock and a cap C, find the length of the longest contiguous run of days whose TOTAL volume does not exceed C.",
    examples: [
      {
        input: "volumes=[4,2,1,7,3], cap=8",
        output: "3",
        explanation:
          "The run [4,2,1] sums to 7 (<=8) and has length 3, the longest such run -- extending it to include 7 pushes the sum to 14, over the cap.",
      },
    ],
    constraints: ["1 <= volumes.length <= 10^5", "volumes[i] >= 0", "0 <= cap <= 10^9"],
    approach:
      "Because every volume is non-negative, this is the classic variable-size (two-pointer) sliding window: extend the right edge one day at a time, adding its volume to a running sum, and whenever the sum exceeds the cap, shrink from the left -- subtracting the departing day's volume -- until it's back within budget. Non-negativity is what makes the window monotonically shrinkable rather than requiring a full recompute: since removing a day can only decrease the sum, the left pointer never needs to move backward, giving a single O(n) pass instead of an O(n^2) brute force over every start/end pair.",
    code: `def longest_window_under_cap(volumes: list[int], cap: int) -> int:
    left = 0
    window_sum = 0
    best = 0

    for right, v in enumerate(volumes):
        window_sum += v
        while window_sum > cap:
            window_sum -= volumes[left]
            left += 1
        best = max(best, right - left + 1)

    return best

print(longest_window_under_cap([4, 2, 1, 7, 3], cap=8))   # 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260908-stock-cooldown-short-borrow-fee",
    title: "Max Profit With a Cooldown and a Per-Day Short-Borrow Fee",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for a stock, you may hold a single-unit LONG or SHORT position (never both at once), must wait one day after closing any position before opening a new one (cooldown), and pay a fixed per-day borrow fee for every day a SHORT position remains open, charged on both the day it opens and every day it is held. Return the maximum achievable profit, ending flat.",
    examples: [
      {
        input: "prices=[10,15,12,20], fee=1",
        output: "10",
        explanation:
          "Buying at 10 (day 0) and selling at 20 (day 3) nets 10. The DP also explores opening and holding shorts along the way, but none of those round trips close out more profitably within this short window.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000", "0 <= prices[i] <= 10^4", "0 <= fee <= 10^3"],
    approach:
      "Extend the classic 'stock with cooldown' state machine with a second open-position state for shorts, tracked with rolling scalars (O(1) space) rather than per-day arrays: rest (flat and free to trade), cooldown (closed a position today, blocked from opening a new one today), hold_long (currently long), hold_short (currently short, accruing the fee). Each day's transitions read only the PREVIOUS day's four values -- rest updates from yesterday's rest or cooldown; hold_long either carries over or opens fresh from yesterday's rest; hold_short either carries over (paying the fee again) or opens fresh from yesterday's rest (also paying the fee the day it opens); cooldown is whichever of closing a long or covering a short was more profitable today. The final answer takes the better of ending in rest or cooldown, since a position left open at the end was never actually realized as profit.",
    code: `def max_profit_cooldown_short_fee(prices: list[int], fee: int) -> float:
    if not prices:
        return 0.0

    NEG_INF = float("-inf")
    rest = 0.0          # flat, free to trade
    cooldown = NEG_INF  # closed a position TODAY -- can't open a new one today
    hold_long = NEG_INF # currently holding long
    hold_short = NEG_INF# currently holding short (fee accrues while open)

    for price in prices:
        prev_rest, prev_cooldown = rest, cooldown
        prev_hold_long, prev_hold_short = hold_long, hold_short

        rest = max(prev_rest, prev_cooldown)
        hold_long = max(prev_hold_long, prev_rest - price)
        hold_short = max(prev_hold_short - fee, prev_rest + price - fee)
        cooldown = max(prev_hold_long + price, prev_hold_short - price)

    return max(rest, cooldown)

print(max_profit_cooldown_short_fee([10, 15, 12, 20], fee=1))   # 10.0`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260908-markov-regime-distribution-matrix-power",
    title: "Market Regime Distribution After N Days via Matrix Exponentiation",
    difficulty: "medium",
    topics: ["probability", "math", "matrix-exponentiation"],
    problem:
      "Given a k-by-k Markov transition matrix P for daily market regimes (P[i][j] is the probability of moving from regime i to regime j in one day), a starting regime index, and a horizon N (which may be very large), compute the probability distribution over regimes after N days.",
    examples: [
      {
        input: "P=[[0.9,0.1],[0.2,0.8]], start=0, N=2",
        output: "[0.83, 0.17]",
        explanation:
          "P^2 = [[0.83,0.17],[0.34,0.66]]; starting in regime 0, the distribution after 2 days is row 0 of P^2.",
      },
    ],
    constraints: [
      "2 <= k <= 20 states",
      "each row of P sums to 1 (a valid stochastic matrix)",
      "1 <= N <= 10^9",
    ],
    approach:
      "Naively multiplying the starting distribution by P, N times in a row, is O(N*k^2) -- infeasible once N reaches the billions, which is exactly the scale a 'probability after N periods' interview question tends to push toward. Because Markov transition is linear, the distribution after N steps is exactly the starting one-hot vector times P raised to the Nth power, and matrix powers support the same binary (fast) exponentiation trick as scalar powers: repeatedly square the matrix and multiply the accumulated result in whenever the corresponding bit of N is set, needing only O(log N) matrix multiplications instead of N. Each matrix multiplication of two k-by-k matrices costs O(k^3), so the total cost is O(k^3 log N) -- for k around 20 and N in the billions, that's a few thousand multiplications instead of a billion.",
    code: `def regime_distribution(P: list[list[float]], start: int, N: int) -> list[float]:
    k = len(P)

    def mat_mult(A, B):
        return [[sum(A[i][x] * B[x][j] for x in range(k)) for j in range(k)] for i in range(k)]

    def mat_pow(M, power):
        result = [[1.0 if i == j else 0.0 for j in range(k)] for i in range(k)]  # identity
        base = [row[:] for row in M]
        while power > 0:
            if power & 1:
                result = mat_mult(result, base)
            base = mat_mult(base, base)
            power >>= 1
        return result

    Pn = mat_pow(P, N)
    return Pn[start]   # P(state_N = j | state_0 = start), for each j

dist = regime_distribution([[0.9, 0.1], [0.2, 0.8]], start=0, N=2)
print([round(x, 2) for x in dist])   # [0.83, 0.17]`,
    language: "python",
    complexity: { time: "O(k^3 log N)", space: "O(k^2)" },
  },
  {
    id: "lc-20260908-design-limit-order-book-lazy-heaps",
    title: "Design a Limit Order Book With O(log n) Best Bid/Ask and Cancel",
    difficulty: "medium",
    topics: ["design", "heap"],
    problem:
      "Design a class supporting add_order(order_id, side, price, quantity) where side is 'buy' or 'sell', cancel_order(order_id), best_bid() returning the highest active buy price (or None), and best_ask() returning the lowest active sell price (or None).",
    examples: [
      {
        input:
          "add_order(1,'buy',100.5,10); add_order(2,'buy',101.0,5); add_order(3,'sell',102.0,8); best_bid(); cancel_order(2); best_bid()",
        output: "101.0, then 100.5",
        explanation:
          "Before the cancel, order 2's price 101.0 is the highest active bid; after cancelling it, order 1's 100.5 becomes the best remaining bid.",
      },
    ],
    constraints: ["up to 10^5 total operations", "order_id values are unique", "prices and quantities are positive"],
    approach:
      "Keep a max-heap of (-price, order_id) for bids and a min-heap of (price, order_id) for asks -- one push per add_order, O(log n). A heap doesn't support deleting an arbitrary interior element cheaply, so cancel_order just removes the order from a live hash map and records its id in a 'cancelled' set without touching the heaps directly (O(1)). Both best_bid and best_ask first run a small cleanup loop that pops and discards any heap-top entries whose order_id is in the cancelled set, so stale cancelled orders are purged lazily -- and only ever from the top, where they're cheap to detect -- rather than searched for and removed from the middle of the heap.",
    code: `import heapq

class OrderBook:
    def __init__(self):
        self.bids: list[tuple[float, int]] = []   # max-heap: (-price, order_id)
        self.asks: list[tuple[float, int]] = []   # min-heap: (price, order_id)
        self.orders: dict[int, tuple[str, float, int]] = {}   # active orders only
        self.cancelled: set[int] = set()

    def add_order(self, order_id: int, side: str, price: float, quantity: int) -> None:
        self.orders[order_id] = (side, price, quantity)
        if side == "buy":
            heapq.heappush(self.bids, (-price, order_id))
        else:
            heapq.heappush(self.asks, (price, order_id))

    def cancel_order(self, order_id: int) -> None:
        if order_id in self.orders:
            del self.orders[order_id]
            self.cancelled.add(order_id)

    def _clean(self, heap: list[tuple[float, int]]) -> None:
        # lazy deletion -- only ever touches the TOP, where it's cheap to check
        while heap and heap[0][1] in self.cancelled:
            _, oid = heapq.heappop(heap)
            self.cancelled.discard(oid)

    def best_bid(self):
        self._clean(self.bids)
        return -self.bids[0][0] if self.bids else None

    def best_ask(self):
        self._clean(self.asks)
        return self.asks[0][0] if self.asks else None

book = OrderBook()
book.add_order(1, "buy", 100.5, 10)
book.add_order(2, "buy", 101.0, 5)
book.add_order(3, "sell", 102.0, 8)
print(book.best_bid())    # 101.0
book.cancel_order(2)
print(book.best_bid())    # 100.5`,
    language: "python",
    complexity: {
      time: "O(log n) amortized per add_order/cancel_order/best_bid/best_ask",
      space: "O(n) for n outstanding orders",
    },
  },
];
