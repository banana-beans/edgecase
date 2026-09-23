import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-23
// A max-heap two-pointer VWAP band problem, a sliding-window
// median for a rolling mid-price, a buy/sell-at-most-two-
// transactions DP, a random-walk gambler's-ruin probability
// problem, and a streaming order-book top-of-book tracker design.
// ============================================================

export const financeBatch20260923: LeetCodeProblem[] = [
  {
    id: "lc-20260923-two-sum-target-notional",
    title: "Two Fills Summing to a Target Notional",
    difficulty: "easy",
    topics: ["hash-map", "two-pointer"],
    problem:
      "Given an array of fill sizes (in shares) for a single order and a target total share count, return the indices of the two fills whose sizes sum exactly to the target, or an empty list if no such pair exists.",
    examples: [
      {
        input: "fills=[300, 150, 500, 250], target=400",
        output: "[1, 3]",
        explanation: "fills[1] + fills[3] = 150 + 250 = 400.",
      },
    ],
    constraints: ["2 <= len(fills) <= 10^5", "each fill size fits in a 32-bit int", "exactly one valid pair, or none"],
    approach:
      "Single pass with a hash map from value seen so far to its index. For each fill, compute the complement (target minus this fill's size); if that complement is already in the map, the pair is found in O(1) lookup. Otherwise record this fill's size and index and continue. This avoids the O(n^2) nested-loop check of every pair, doing the whole search in one linear pass at the cost of O(n) extra space for the map.",
    code: `def two_fills_for_target(fills: list[int], target: int) -> list[int]:
    seen: dict[int, int] = {}   # fill size -> index

    for i, size in enumerate(fills):
        complement = target - size
        if complement in seen:
            return [seen[complement], i]
        seen[size] = i

    return []

print(two_fills_for_target([300, 150, 500, 250], target=400))
# [1, 3]`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-20260923-sliding-window-median-midprice",
    title: "Rolling Median Mid-Price Over a Sliding Window",
    difficulty: "hard",
    topics: ["heap", "sliding-window", "design"],
    problem:
      "Given a stream of mid-prices and a window size k, return an array of the median mid-price over each trailing window of k ticks (starting once the window first fills).",
    examples: [
      {
        input: "prices=[5,2,8,4,9,1], k=3",
        output: "[5.0, 4.0, 8.0, 4.0]",
        explanation:
          "Window [5,2,8] sorted [2,5,8] -> median 5. Window [2,8,4] sorted [2,4,8] -> median 4. Window [8,4,9] sorted [4,8,9] -> median 8. Window [4,9,1] sorted [1,4,9] -> median 4.",
      },
    ],
    constraints: ["1 <= k <= len(prices) <= 10^5", "prices can repeat"],
    approach:
      "Maintain two heaps: a max-heap for the lower half of the current window and a min-heap for the upper half, kept balanced in size (equal, or lower half one larger for odd k), so the median is always O(1) to read off the top of one or both heaps. The twist versus a plain running median is that entries must also be REMOVED once they age out of the window k ticks later, and a heap doesn't support efficient arbitrary removal -- the standard fix is lazy deletion: track a count of values pending removal in a hash map, and only actually pop from a heap's top when the top value itself is marked for deletion, rebalancing sizes by the pending-deletion counts rather than the heaps' raw lengths.",
    code: `import heapq
from collections import defaultdict

def sliding_window_median(prices: list[int], k: int) -> list[float]:
    lo: list[int] = []   # max-heap (negated), lower half
    hi: list[int] = []   # min-heap, upper half
    pending = defaultdict(int)   # value -> count marked for lazy deletion
    lo_size = hi_size = 0
    result = []

    def prune(heap: list[int], is_max: bool):
        while heap:
            top = -heap[0] if is_max else heap[0]
            if pending[top] > 0:
                pending[top] -= 1
                heapq.heappop(heap)
            else:
                break

    def rebalance():
        nonlocal lo_size, hi_size
        if lo_size > hi_size + 1:
            heapq.heappush(hi, -heapq.heappop(lo))
            lo_size -= 1; hi_size += 1
        elif lo_size < hi_size:
            heapq.heappush(lo, -heapq.heappop(hi))
            lo_size += 1; hi_size -= 1

    for i, price in enumerate(prices):
        if not lo or price <= -lo[0]:
            heapq.heappush(lo, -price); lo_size += 1
        else:
            heapq.heappush(hi, price); hi_size += 1
        rebalance()

        if i >= k:
            old = prices[i - k]
            pending[old] += 1
            if old <= -lo[0]:
                lo_size -= 1
            else:
                hi_size -= 1
            prune(lo, is_max=True)
            prune(hi, is_max=False)
            rebalance()

        if i >= k - 1:
            median = -lo[0] if lo_size > hi_size else (-lo[0] + hi[0]) / 2
            result.append(float(median))

    return result

print(sliding_window_median([5, 2, 8, 4, 9, 1], k=3))
# [5.0, 4.0, 8.0, 4.0]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-20260923-best-time-two-transactions",
    title: "Best Time to Buy and Sell Stock With At Most Two Transactions",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices, you may complete at most two non-overlapping buy-then-sell round trips (you must sell before buying again). Return the maximum achievable profit.",
    examples: [
      {
        input: "prices=[3,3,5,0,0,3,1,4]",
        output: "6",
        explanation:
          "Buy day3 (0), sell day4... actually buy day3 (0), sell day5 (3): profit 3. Buy day6 (1), sell day7 (4): profit 3. Total 3+3=6.",
      },
    ],
    constraints: ["0 <= prices.length <= 10^5", "0 <= prices[i] <= 10^5"],
    approach:
      "Track four running scalars rather than a full 2D DP table: buy1 (best profit after one buy), sell1 (best profit after one completed round trip), buy2 (best profit after buying a second time, net of having already banked sell1's profit), and sell2 (best profit after two completed round trips). Each day, update in this exact order so later updates see today's price applied consistently: buy1 = max(buy1, -price), sell1 = max(sell1, buy1 + price), buy2 = max(buy2, sell1 - price), sell2 = max(sell2, buy2 + price). The buy2 transition folding in sell1's already-banked profit is what enforces non-overlap without an explicit index split. Runs in O(n) time and O(1) space, versus O(n) space for the naive DP table.",
    code: `def max_profit_two_transactions(prices: list[int]) -> int:
    if not prices:
        return 0

    buy1 = buy2 = float("-inf")
    sell1 = sell2 = 0

    for price in prices:
        # order matters: each stage uses the PREVIOUS stage's value from
        # today's pass, so compute in this sequence, not in parallel
        buy1 = max(buy1, -price)
        sell1 = max(sell1, buy1 + price)
        buy2 = max(buy2, sell1 - price)   # nets in the first round trip's profit
        sell2 = max(sell2, buy2 + price)

    return sell2

print(max_profit_two_transactions([3, 3, 5, 0, 0, 3, 1, 4]))
# 6`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260923-gamblers-ruin-probability",
    title: "Gambler's Ruin: Probability of Reaching a Profit Target Before a Stop-Out",
    difficulty: "hard",
    topics: ["probability", "dynamic-programming", "markov-chain"],
    problem:
      "A trader starts with i units of capital (integer). On each round, capital increases by 1 unit with probability p and decreases by 1 unit with probability 1-p. Trading stops if capital hits 0 (ruin) or hits N (profit target, N given). Return the probability of reaching N before hitting 0, given starting capital i, target N, and win probability p.",
    examples: [
      {
        input: "i=2, N=4, p=0.5",
        output: "0.5",
        explanation:
          "With a fair coin (p=0.5), the classic gambler's ruin result gives probability i/N = 2/4 = 0.5, since the fair-odds case reduces to a simple linear ratio.",
      },
    ],
    constraints: ["0 <= i <= N <= 10^4", "0 < p < 1"],
    approach:
      "Let P(i) be the probability of reaching N before 0, starting from capital i, with boundary conditions P(0)=0, P(N)=1. The classic closed-form solution avoids simulating: for p != 0.5, P(i) = (1 - r^i) / (1 - r^N) where r = (1-p)/p; for the fair case p=0.5 it degenerates to the simple linear ratio P(i) = i/N (L'Hopital's rule on the general formula as r approaches 1, or derive directly from the fact that capital is then a martingale). Using the closed form is both O(1) and numerically exact, versus solving the underlying linear recurrence P(i) = p*P(i+1) + (1-p)*P(i-1) with a tridiagonal solve, which works too but is unnecessary machinery for a problem that has an exact formula.",
    code: `def ruin_survival_probability(i: int, N: int, p: float) -> float:
    if i <= 0:
        return 0.0
    if i >= N:
        return 1.0

    if abs(p - 0.5) < 1e-12:
        return i / N   # fair game: capital is a martingale, probability is linear

    r = (1 - p) / p
    return (1 - r**i) / (1 - r**N)

print(ruin_survival_probability(i=2, N=4, p=0.5))    # 0.5
print(round(ruin_survival_probability(i=2, N=4, p=0.4), 4))   # < 0.5: unfavorable odds`,
    language: "python",
    complexity: { time: "O(1) with the closed form (O(N) if solved via recurrence)", space: "O(1)" },
  },
  {
    id: "lc-20260923-top-of-book-tracker",
    title: "Design a Streaming Top-of-Book Tracker",
    difficulty: "medium",
    topics: ["design", "heap", "hash-map"],
    problem:
      "Design a class TopOfBook supporting add_order(order_id, side, price, size) to add a resting order, cancel(order_id) to remove one, and best(side) returning the current best (highest bid or lowest ask) price and total size resting at that price, or None if that side is empty.",
    examples: [
      {
        input: 'add_order(1,"BUY",100,50); add_order(2,"BUY",101,30); best("BUY"); cancel(2); best("BUY")',
        output: "(101, 30)  then  (100, 50)",
        explanation:
          "The best bid is initially 101 with 30 shares; after cancelling order 2, the best bid falls back to 100 with 50 shares.",
      },
    ],
    constraints: ["up to 10^5 total calls", "order_ids are unique while active", "prices and sizes are positive integers"],
    approach:
      "Keep a max-heap of bid prices and a min-heap of ask prices for O(log n) best-price lookups, plus a hash map from order_id to its (side, price, size) for O(1) cancellation bookkeeping, plus a per-price-level running total size (a dict from price to aggregate size) so best() can report total resting size at the top price without rescanning every order there. Cancellation uses lazy deletion on the heaps, same pattern as the sliding-window-median problem: decrement the price level's total size and mark the order gone in the map, but only actually pop stale prices off a heap's top when best() is called and finds that price's aggregate size has dropped to zero.",
    code: `import heapq
from collections import defaultdict

class TopOfBook:
    def __init__(self):
        self.bids: list[int] = []   # max-heap: negated prices
        self.asks: list[int] = []   # min-heap: prices
        self.orders: dict[int, tuple[str, int, int]] = {}   # id -> (side, price, size)
        self.level_size: dict[tuple[str, int], int] = defaultdict(int)   # (side, price) -> total size

    def add_order(self, order_id: int, side: str, price: int, size: int):
        self.orders[order_id] = (side, price, size)
        self.level_size[(side, price)] += size
        if side == "BUY":
            heapq.heappush(self.bids, -price)
        else:
            heapq.heappush(self.asks, price)

    def cancel(self, order_id: int):
        side, price, size = self.orders.pop(order_id)
        self.level_size[(side, price)] -= size   # lazy: heap entry stays, level total shrinks

    def best(self, side: str):
        heap = self.bids if side == "BUY" else self.asks
        while heap:
            price = -heap[0] if side == "BUY" else heap[0]
            total = self.level_size[(side, price)]
            if total > 0:
                return (price, total)
            heapq.heappop(heap)   # stale price level, fully cancelled -- discard
        return None

book = TopOfBook()
book.add_order(1, "BUY", 100, 50)
book.add_order(2, "BUY", 101, 30)
print(book.best("BUY"))    # (101, 30)
book.cancel(2)
print(book.best("BUY"))    # (100, 50)`,
    language: "python",
    complexity: { time: "O(log n) amortized per call", space: "O(n)" },
  },
];
