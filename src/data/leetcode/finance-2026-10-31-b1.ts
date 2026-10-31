import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-31
// K trade prints closest to a reference price (heap), shortest
// window whose volumes hit a target (sliding window), max profit
// with a mandatory settlement cooldown after selling (DP stock
// variant), the long-run fraction of time a market maker's
// inventory spends in each state (probability / Markov chain
// stationary distribution), and a price-time-priority limit
// order matching engine (design).
// ============================================================

export const financeBatch20261031: LeetCodeProblem[] = [
  {
    id: "lc-20261031-k-closest-trade-prints-heap",
    title: "K Trade Prints Closest to a Reference Price",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given an array of trade prices and a reference price target, return the k prices closest to target, sorted ascending. When two prices are equally close to target, treat the smaller price as the closer one.",
    examples: [
      {
        input: "prices = [1,2,3,4,5], target = 3, k = 2",
        output: "[2, 3]",
        explanation:
          "Price 3 has distance 0, the closest. Prices 2 and 4 both have distance 1, but 2 is the smaller of the tied pair, so it's preferred as the second closest over 4.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "1 <= k <= prices.length", "0 <= prices[i], target <= 10^9"],
    approach:
      "Maintain a max-heap (via negation) that holds the k best (distance, price) candidates seen so far, ordered lexicographically so ties in distance are broken by preferring the smaller price. For each new price, build its negated (distance, price) tuple; if the heap has fewer than k entries, push it directly. Otherwise compare it against the heap's current worst entry (the top of the max-heap) and swap it in only if the new candidate is strictly better. This keeps the heap at size k throughout, doing one O(log k) operation per price, then a final sort of just the k survivors by price for the output order.",
    code: `import heapq

def k_closest_prints(prices: list[float], target: float, k: int) -> list[float]:
    heap: list[tuple[float, float]] = []  # max-heap (via negation) of the k best (distance, price) so far
    for price in prices:
        distance = abs(price - target)
        candidate = (-distance, -price)  # negate: heap top becomes the current WORST of the k kept
        if len(heap) < k:
            heapq.heappush(heap, candidate)
        elif candidate > heap[0]:
            heapq.heapreplace(heap, candidate)  # new candidate beats the current worst -- swap it in

    closest_prices = [-price for _, price in heap]
    return sorted(closest_prices)

print(k_closest_prints([1, 2, 3, 4, 5], target=3, k=2))
# [2, 3]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-20261031-shortest-window-volume-target",
    title: "Shortest Contiguous Window Whose Trade Volumes Sum to at Least a Target",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given an array of per-minute traded volumes (non-negative integers) and an integer target, return the length of the shortest contiguous window whose volumes sum to at least target. Return 0 if no such window exists.",
    examples: [
      {
        input: "volumes = [2,3,1,2,4,3], target = 7",
        output: "2",
        explanation:
          "The window [4,3] sums to 7, which meets the target with just 2 minutes -- no shorter window of any starting point reaches 7.",
      },
    ],
    constraints: ["1 <= volumes.length <= 10^5", "0 <= volumes[i] <= 10^4", "1 <= target <= 10^9"],
    approach:
      "Since all volumes are non-negative, the running window sum only grows as the right pointer advances and only shrinks as the left pointer advances, which is exactly the monotonicity a variable sliding window needs. Expand the window by moving right and accumulating into window_sum; whenever window_sum meets or exceeds target, the current window is a valid candidate, so record its length and then greedily shrink from the left (which can only help, since any valid window strictly containing a shorter valid window is not the shortest) until the window no longer meets target. Each index enters and leaves the window at most once, giving O(n) total work.",
    code: `def shortest_window_hitting_volume(volumes: list[int], target: int) -> int:
    left = 0
    window_sum = 0
    best = float("inf")

    for right, vol in enumerate(volumes):
        window_sum += vol
        while window_sum >= target:
            best = min(best, right - left + 1)
            window_sum -= volumes[left]
            left += 1

    return 0 if best == float("inf") else best

print(shortest_window_hitting_volume([2, 3, 1, 2, 4, 3], target=7))
# 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 209,
  },
  {
    id: "lc-20261031-max-profit-settlement-cooldown",
    title: "Max Profit With a Mandatory One-Day Settlement Cooldown After Selling",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given a daily price array, you may buy and sell as many times as you like (one share at a time, must fully sell before buying again), but after selling you must wait one full day before buying again (a settlement cooldown). Return the maximum achievable profit.",
    examples: [
      {
        input: "prices = [1,2,3,0,2]",
        output: "3",
        explanation:
          "Buy at 1, sell at 3 for a profit of 2, rest the mandatory cooldown day (price 0), then buy at 2's... actually buy at 0 and sell at 2 for a profit of 2 is blocked by the cooldown from the first sale landing on day index 2; the best achievable sequence nets 3 total, beating any single round trip alone.",
      },
    ],
    constraints: ["0 <= prices.length <= 10^5", "0 <= prices[i] <= 10^5"],
    approach:
      "Track three running states day by day: held (best profit while currently holding a share), sold (best profit having just sold TODAY, which forces tomorrow to rest), and resting (best profit while flat and free to buy, either because enough time has passed since a sale or no shares were ever bought). Each day's held can extend yesterday's held or come from buying today out of yesterday's resting state; each day's sold can only come from selling today out of yesterday's held; each day's resting can extend yesterday's resting or admit yesterday's sold (one day later, the cooldown has now been served). The final answer is the better of ending sold or resting, since ending while still holding a share can never be optimal.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    held = -prices[0]      # holding a share, bought today or earlier
    sold = 0                # just sold today -- must rest tomorrow
    resting = 0              # flat and free to buy (cooldown served, or never bought)

    for price in prices[1:]:
        prev_held, prev_sold, prev_resting = held, sold, resting
        held = max(prev_held, prev_resting - price)
        sold = prev_held + price
        resting = max(prev_resting, prev_sold)

    return max(sold, resting)

print(max_profit_with_cooldown([1, 2, 3, 0, 2]))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 309,
  },
  {
    id: "lc-20261031-stationary-distribution-inventory-markov",
    title: "Long-Run Fraction of Time a Market Maker's Inventory Sits in Each State",
    difficulty: "hard",
    topics: ["probability", "markov-chain", "linear-algebra"],
    problem:
      "A market maker's inventory transitions each tick between three states, Short, Flat, and Long, according to a given row-stochastic transition matrix P, where P[i][j] is the probability of moving from state i to state j on the next tick. Assuming the chain is ergodic, return the stationary distribution pi such that pi @ P equals pi and pi sums to 1.",
    examples: [
      {
        input:
          "P = [[0.6,0.3,0.1],[0.2,0.6,0.2],[0.1,0.3,0.6]]  (rows/cols ordered Short, Flat, Long)",
        output: "[0.2857, 0.4286, 0.2857]",
        explanation:
          "Solving pi = pi @ P with pi summing to 1 gives pi1 = pi3 = 2/7 and pi2 = 3/7 by symmetry of the transition probabilities between Short and Long -- the chain spends the most long-run time Flat.",
      },
    ],
    constraints: ["P is an n x n row-stochastic matrix (rows sum to 1)", "the chain described by P is ergodic (irreducible and aperiodic)"],
    approach:
      "The stationary distribution pi is by definition a LEFT eigenvector of P with eigenvalue 1 (pi @ P = pi, i.e. P.T @ pi.T = pi.T), so transposing P turns the left-eigenvector problem into the standard right-eigenvector problem any linear algebra library solves directly. Compute the eigenvalues and eigenvectors of P.T, pick the eigenvector whose eigenvalue is closest to 1 (an ergodic chain's transition matrix is guaranteed to have exactly one such eigenvalue by the Perron-Frobenius theorem), take its real part (eigensolvers can return a tiny imaginary component from floating-point noise even for a real eigenvalue), and normalize it to sum to 1 since eigenvectors are only defined up to scale.",
    code: `import numpy as np

def stationary_distribution(P: np.ndarray) -> np.ndarray:
    # pi must satisfy pi @ P = pi, i.e. P.T @ pi.T = pi.T -- pi is a LEFT eigenvector
    # of P with eigenvalue 1, so transpose and use the standard (right) eigenvector routine
    eigenvalues, eigenvectors = np.linalg.eig(P.T)

    # pick the eigenvector whose eigenvalue is closest to 1 (ergodic chains guarantee one exists)
    idx = np.argmin(np.abs(eigenvalues - 1.0))
    pi = np.real(eigenvectors[:, idx])

    return pi / pi.sum()   # normalize so the stationary probabilities sum to 1

P = np.array([
    [0.6, 0.3, 0.1],   # from Short
    [0.2, 0.6, 0.2],   # from Flat
    [0.1, 0.3, 0.6],   # from Long
])
print(np.round(stationary_distribution(P), 4))
# [0.2857, 0.4286, 0.2857] -- long-run fraction of ticks spent Short, Flat, Long`,
    language: "python",
    complexity: { time: "O(n^3) for the eigendecomposition", space: "O(n^2)" },
  },
  {
    id: "lc-20261031-design-order-matching-engine",
    title: "Design a Price-Time-Priority Limit Order Matching Engine",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design a class OrderBook supporting add_order(side, price, qty), where side is 'buy' or 'sell'. Each new order first matches against resting orders on the opposite side at or better than its price, in price-time priority (best price first, then earliest order first), filling as much as possible; any unfilled remainder rests in the book. Return the list of fills produced by this call, each as (price, qty) at the price of the already-resting order.",
    examples: [
      {
        input: "add_order('sell', 101.0, 5); add_order('sell', 100.0, 3); add_order('buy', 101.0, 6)",
        output: "[]; []; [(100.0, 3), (101.0, 3)]",
        explanation:
          "The two sells rest with nothing to match against. The incoming buy at 101 matches the better-priced resting sell at 100 first (filling all 3), then the remaining 3 shares against the resting sell at 101, exhausting the buy order with no remainder left to rest.",
      },
    ],
    constraints: ["up to 10^5 calls to add_order", "price and qty are positive"],
    approach:
      "Keep two heaps of resting orders: sells as a min-heap on (price, sequence) so the lowest ask with the earliest timestamp surfaces first, and buys as a min-heap on (-price, sequence) so the highest bid with the earliest timestamp surfaces first -- a strictly increasing sequence counter breaks ties by time priority. An incoming buy repeatedly matches against the sell heap's top while that ask is at or below the buy's price and quantity remains, filling the minimum of the two quantities, decrementing both, and popping the resting order only once it's fully consumed (otherwise its remaining quantity stays at the heap's top, since reducing only its quantity field never changes how it compares against other entries). Any unfilled remainder is pushed onto the buy heap. An incoming sell mirrors this against the buy heap.",
    code: `import heapq
import itertools

class OrderBook:
    def __init__(self) -> None:
        self._sells: list[tuple[float, int, float]] = []   # min-heap: (price, seq, qty) -- lowest ask first
        self._buys: list[tuple[float, int, float]] = []    # min-heap: (-price, seq, qty) -- highest bid first
        self._seq = itertools.count()                        # strictly increasing -- breaks ties by time priority

    def add_order(self, side: str, price: float, qty: float) -> list[tuple[float, float]]:
        fills: list[tuple[float, float]] = []
        seq = next(self._seq)

        if side == "buy":
            while self._sells and qty > 0 and self._sells[0][0] <= price:
                ask_price, ask_seq, ask_qty = self._sells[0]
                matched = min(qty, ask_qty)
                fills.append((ask_price, matched))   # execute at the RESTING order's price
                qty -= matched
                if matched == ask_qty:
                    heapq.heappop(self._sells)
                else:
                    self._sells[0] = (ask_price, ask_seq, ask_qty - matched)
            if qty > 0:
                heapq.heappush(self._buys, (-price, seq, qty))
        else:
            while self._buys and qty > 0 and -self._buys[0][0] >= price:
                bid_price, bid_seq, bid_qty = self._buys[0]
                matched = min(qty, bid_qty)
                fills.append((-bid_price, matched))
                qty -= matched
                if matched == bid_qty:
                    heapq.heappop(self._buys)
                else:
                    self._buys[0] = (bid_price, bid_seq, bid_qty - matched)
            if qty > 0:
                heapq.heappush(self._sells, (price, seq, qty))

        return fills

book = OrderBook()
print(book.add_order("sell", 101.0, 5))   # []
print(book.add_order("sell", 100.0, 3))   # []
print(book.add_order("buy", 101.0, 6))    # [(100.0, 3), (101.0, 3)]`,
    language: "python",
    complexity: { time: "O(log n) per heap op, amortized across matches", space: "O(n) resting orders" },
  },
];
