import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-03
// K closest trade prices to a reference (heap), shortest window
// to accumulate target volume (sliding window), max profit with
// a one-day cooldown (DP stock variant), expected number of ticks
// until a bounded inventory walk is absorbed (probability/Markov,
// the companion to absorption PROBABILITY from a prior batch), and
// a price-time priority limit order book matcher (design).
// ============================================================

export const financeBatch20261103: LeetCodeProblem[] = [
  {
    id: "lc-20261103-k-closest-trade-prices",
    title: "K Closest Trade Prices To A Reference Price",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given an array of trade prices and a reference price target, along with an integer k, return the k trade prices closest to target. If two prices are equally close, the smaller price comes first. You do not need to return them sorted by original order.",
    examples: [
      {
        input: "prices = [4.0, 1.0, 9.0, 3.0, 5.0], target = 4.5, k = 3",
        output: "[4.0, 5.0, 3.0]",
        explanation:
          "Distances from 4.5 are 0.5 (4.0), 3.5 (1.0), 4.5 (9.0), 1.5 (3.0), 0.5 (5.0). The 3 closest are 4.0 and 5.0 (tied at 0.5, smaller price first) then 3.0 (1.5).",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "1 <= k <= prices.length"],
    approach:
      "Maintain a size-k heap keyed so its top is always the CURRENT WORST (farthest, tie-broken toward the larger price) candidate kept so far; push every price, and whenever a new candidate is strictly better than that worst-kept entry, swap it in. This runs in O(n log k) instead of sorting the whole array in O(n log n), which matters when k is much smaller than n (finding the 10 trades closest to a reference price out of millions of ticks). Encoding the tie-break cleanly is the subtle part: storing (-distance, -price) in a plain min-heap makes 'larger tuple is better' line up exactly with 'smaller distance, then smaller price wins', so a single tuple comparison does both jobs at once.",
    code: `import heapq

def k_closest_prices(prices: list[float], target: float, k: int) -> list[float]:
    # min-heap of (-distance, -price); the heap's top is always the CURRENT WORST
    # (farthest, tie-broken toward the larger price) among the k kept so far
    heap: list[tuple[float, float]] = []
    for price in prices:
        distance = abs(price - target)
        candidate = (-distance, -price)
        if len(heap) < k:
            heapq.heappush(heap, candidate)
        elif candidate > heap[0]:
            # strictly better than the current worst kept -- swap it in
            heapq.heapreplace(heap, candidate)

    # unpack and sort for a clean, deterministic output order
    closest = [(-neg_dist, -neg_price) for neg_dist, neg_price in heap]
    closest.sort(key=lambda dp: (dp[0], dp[1]))
    return [price for _, price in closest]

prices = [4.0, 1.0, 9.0, 3.0, 5.0]
print(k_closest_prices(prices, target=4.5, k=3))
# [4.0, 5.0, 3.0]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-20261103-shortest-window-target-volume",
    title: "Shortest Window of Trades To Reach a Target Cumulative Volume",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given an array of trade volumes for one trading session and an integer target, return the length of the shortest contiguous window of trades whose volumes sum to at least target. If no such window exists, return -1. (This corresponds to finding the minimum number of consecutive prints needed to accumulate enough volume for a reliable VWAP slice.)",
    examples: [
      {
        input: "volumes = [100, 50, 200, 150, 80], target = 280",
        output: "2",
        explanation:
          "The window [200, 150] sums to 350 >= 280 with length 2. No single trade reaches 280, so length 2 is the shortest.",
      },
    ],
    constraints: ["1 <= volumes.length <= 10^5", "1 <= volumes[i] <= 10^6", "1 <= target <= 10^11"],
    approach:
      "Because every volume is non-negative, the running window sum only increases as the right pointer advances and only decreases as the left pointer advances -- that monotonicity is exactly what makes the classic two-pointer shrink-while-valid pattern correct here (it would NOT be valid if volumes could be negative, since removing a negative element from the window would increase the sum, breaking the greedy shrink logic). Expand the right pointer, adding each volume to a running sum; whenever the running sum reaches or exceeds target, greedily shrink from the left for as long as the window remains valid, recording the smallest valid window length seen. Each element enters and leaves the window at most once, giving O(n) total work despite the nested-looking loop.",
    code: `def shortest_window_for_volume(volumes: list[int], target: int) -> int:
    left = 0
    running_sum = 0
    best = float("inf")

    for right, vol in enumerate(volumes):
        running_sum += vol
        # shrink from the left while the window still meets the target --
        # valid only because every volume is non-negative, so shrinking never INCREASES the sum
        while running_sum >= target:
            best = min(best, right - left + 1)
            running_sum -= volumes[left]
            left += 1

    return best if best != float("inf") else -1

print(shortest_window_for_volume([100, 50, 200, 150, 80], target=280))
# 2 -- the window [200, 150]`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 209,
  },
  {
    id: "lc-20261103-max-profit-cooldown",
    title: "Max Profit With a One-Day Cooldown After Selling",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given a daily price array, you may buy and sell unlimited times, holding at most one share at a time, but after selling you must wait one full day before buying again (a one-day cooldown, modeling a compliance-style restriction). Return the maximum achievable profit.",
    examples: [
      {
        input: "prices = [1, 2, 3, 0, 2]",
        output: "3",
        explanation:
          "Buy at 1, sell at 2 (profit 1), cooldown, buy at 0, sell at 2 (profit 2), for a total of 3. Buying at 1 and selling at 3 instead leaves no time to re-enter profitably before the array ends.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000", "0 <= prices[i] <= 1000"],
    approach:
      "Define three DP states per day: hold (holding a share, best profit so far), sold (just sold today, in cooldown tomorrow), and rest (not holding, free to buy tomorrow). Transitions: hold_today = max(hold_yesterday, rest_yesterday - price) (keep holding, or buy today from a rest state); sold_today = hold_yesterday + price (sell today); rest_today = max(rest_yesterday, sold_yesterday) (stay in rest, or roll out of yesterday's cooldown into rest). The cooldown is enforced structurally by the state machine itself: you can only reach hold (buy) from rest, never directly from sold, so a sale always forces at least one day in sold before you're eligible to buy again through rest. The answer is the max of sold and rest on the final day, since ending while still holding a share can never beat having sold it.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    hold = float("-inf")   # holding a share
    sold = 0.0             # just sold today (in cooldown tomorrow)
    rest = 0.0             # free to buy (not in cooldown)

    for price in prices:
        prev_hold, prev_sold, prev_rest = hold, sold, rest
        hold = max(prev_hold, prev_rest - price)   # keep holding, or buy from a rest state
        sold = prev_hold + price                    # sell today
        rest = max(prev_rest, prev_sold)             # stay resting, or roll out of cooldown

    return max(sold, rest)

print(max_profit_with_cooldown([1, 2, 3, 0, 2]))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 309,
  },
  {
    id: "lc-20261103-expected-absorption-time",
    title: "Expected Number of Ticks Until a Bounded Inventory Walk Gets Absorbed",
    difficulty: "hard",
    topics: ["probability", "markov-chain", "linear-algebra"],
    problem:
      "A market maker's inventory moves by +1 with probability p and -1 with probability 1-p each tick, starting at some inventory strictly between -N and N, with absorbing bounds at -N and +N (either limit breach halts trading). Given N, p, and a starting inventory, return the expected number of ticks until the walk is absorbed at EITHER bound.",
    examples: [
      {
        input: "N = 3, p = 0.5, start = 0",
        output: "9.0",
        explanation:
          "For a symmetric simple random walk with absorbing barriers at -N and +N, the expected absorption time starting from the center is the classic result N^2 -- here 3^2 = 9.",
      },
    ],
    constraints: ["1 <= N <= 500", "0 < p < 1", "-N < start < N"],
    approach:
      "Let E[i] be the expected number of remaining ticks to absorption starting from inventory i. Boundary conditions: E[N] = 0 and E[-N] = 0 (already absorbed, no ticks remain). For every interior state, one tick elapses no matter what, then the walk moves to i+1 or i-1, giving the recurrence E[i] = 1 + p*E[i+1] + (1-p)*E[i-1]. This is the same tridiagonal linear system structure as the absorption-PROBABILITY problem, but with a constant '+1' term on the right-hand side instead of 0/1 boundary values, because this equation accumulates a COUNT of ticks rather than tracking which boundary gets hit -- solve the resulting linear system exactly rather than estimating by simulation, which would need many trials to converge precisely.",
    code: `import numpy as np

def expected_absorption_time(N: int, p: float, start: int) -> float:
    q = 1 - p
    states = list(range(-N + 1, N))      # interior states; -N and N are absorbing (E=0)
    index = {s: i for i, s in enumerate(states)}
    n = len(states)

    A = np.zeros((n, n))
    b = np.ones(n)   # the "+1 tick elapses" term on the right-hand side
    for i, s in enumerate(states):
        A[i, i] = 1.0
        up, down = s + 1, s - 1
        if up in index:
            A[i, index[up]] -= p
        # else: E[N] = 0, contributes nothing extra to b
        if down in index:
            A[i, index[down]] -= q
        # else: E[-N] = 0, contributes nothing extra to b

    E = np.linalg.solve(A, b)
    return E[index[start]]

print(round(expected_absorption_time(N=3, p=0.5, start=0), 4))
# 9.0 -- matches the classic symmetric-walk result of N^2 ticks from the center

print(round(expected_absorption_time(N=3, p=0.6, start=0), 4))
# lower than 9 -- upward drift reaches a boundary faster on average`,
    language: "python",
    complexity: { time: "O(N^3) for the dense linear solve (tridiagonal-aware solvers do O(N))", space: "O(N^2)" },
  },
  {
    id: "lc-20261103-design-order-book-matcher",
    title: "Design a Price-Time Priority Limit Order Book Matcher",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design a class OrderBook supporting add_order(order_id, side, price, qty) where side is 'buy' or 'sell', which attempts to match the new order against the opposite side's best-priced resting orders using price-time priority (best price first, earliest arrival among ties), executing trades and resting whatever quantity remains unfilled; and cancel(order_id), which removes a resting order if it hasn't fully filled yet. add_order should return a list of (resting_order_id, traded_qty, traded_price) execution tuples.",
    examples: [
      {
        input: "add_order(1, 'buy', 100.0, 10); add_order(2, 'sell', 99.0, 4)",
        output: "[]  then  [(1, 4, 100.0)]",
        explanation:
          "Order 1 rests fully (no asks exist yet). Order 2 crosses the book: it fills 4 shares against resting order 1 at order 1's price of 100.0, since the resting order was there first and sets the execution price.",
      },
    ],
    constraints: ["up to 10^5 calls to add_order and cancel combined", "all prices and quantities are positive"],
    approach:
      "Maintain two heaps: a max-heap of resting buy orders keyed by (-price, arrival sequence) so the best (highest) bid with the earliest arrival pops first, and a min-heap of resting sell orders keyed by (price, arrival sequence) so the best (lowest) ask pops first -- the standard price-time priority structure, giving O(log n) access to the current best quote on each side. A new order matches against the opposite heap's top while a cross exists (incoming buy price >= best ask, or incoming sell price <= best bid), filling against the resting order's PRICE, partially consuming either side and popping a resting order only once it's fully filled. Any unfilled remainder of the incoming order is pushed onto its own side's heap to rest. Cancellation needs a side table tracking each order's live remaining quantity, since a heap has no O(1) delete-by-key -- mark a cancelled order's tracked quantity as zero and skip-and-discard it lazily the next time it would otherwise be popped, rather than removing it from the heap's interior directly.",
    code: `import heapq
import itertools

class OrderBook:
    def __init__(self) -> None:
        self._seq = itertools.count()          # tiebreaker: strictly increasing arrival order
        self._buys: list[tuple[float, int, int]] = []    # max-heap via (-price, seq, order_id)
        self._sells: list[tuple[float, int, int]] = []   # min-heap via (price, seq, order_id)
        self._remaining: dict[int, int] = {}              # order_id -> live qty (0 = filled/cancelled)
        self._price_of: dict[int, float] = {}

    def cancel(self, order_id: int) -> None:
        self._remaining[order_id] = 0   # lazily skipped when it would next be popped

    def add_order(self, order_id: int, side: str, price: float, qty: int) -> list[tuple[int, int, float]]:
        seq = next(self._seq)
        self._remaining[order_id] = qty
        self._price_of[order_id] = price
        fills: list[tuple[int, int, float]] = []
        opposite = self._sells if side == "buy" else self._buys

        while self._remaining[order_id] > 0 and opposite:
            top_key, _, top_id = opposite[0]
            if self._remaining[top_id] == 0:
                heapq.heappop(opposite)        # a cancelled/filled resting order -- discard lazily
                continue
            best_price = top_key if side == "buy" else -top_key   # undo the buys heap's negation
            crosses = price >= best_price if side == "buy" else price <= best_price
            if not crosses:
                break

            traded_qty = min(self._remaining[order_id], self._remaining[top_id])
            self._remaining[order_id] -= traded_qty
            self._remaining[top_id] -= traded_qty
            fills.append((top_id, traded_qty, self._price_of[top_id]))   # resting order sets the price
            if self._remaining[top_id] == 0:
                heapq.heappop(opposite)

        if self._remaining[order_id] > 0:
            own_side = self._buys if side == "buy" else self._sells
            key_price = -price if side == "buy" else price
            heapq.heappush(own_side, (key_price, seq, order_id))

        return fills

book = OrderBook()
print(book.add_order(1, "buy", 100.0, 10))    # [] -- no asks yet, rests fully
print(book.add_order(2, "sell", 99.0, 4))     # [(1, 4, 100.0)] -- crosses, fills at the RESTING price`,
    language: "python",
    complexity: { time: "O(log n) amortized per match, O(k log n) for k fills from one order", space: "O(n)" },
  },
];
