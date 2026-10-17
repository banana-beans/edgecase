import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-17
// K closest resting orders to the mid-price (heap), smallest
// window of fills covering every required venue (sliding
// window), max profit from at most two round-trip trades with a
// flat fee (DP stock variant), steady-state probability of a
// volatility-regime Markov chain (probability/Markov), and a
// price-time priority limit order matching engine (design).
// ============================================================

export const financeBatch20261017: LeetCodeProblem[] = [
  {
    id: "lc-20261017-k-closest-orders-to-mid-price",
    title: "K Closest Resting Limit Orders to the Current Mid-Price",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given a list of resting limit order prices on both sides of the book and the current mid-price, return the k order prices closest to the mid-price, with ties broken by the lower price first.",
    examples: [
      {
        input: "prices = [98, 99, 101, 105, 97], mid = 100, k = 3",
        output: "[99, 101, 98]",
        explanation:
          "Distances to mid are 98->2, 99->1, 101->1, 105->5, 97->3. The 3 closest are 99 and 101 (tied at distance 1, lower price 99 first) and 98 (distance 2); 105 and 97 are farther and excluded.",
      },
    ],
    constraints: ["1 <= k <= prices.length <= 10^5", "prices are distinct", "mid and prices are positive numbers"],
    approach:
      "Maintain a heap of size k that always holds the CURRENT best k candidates, with its top exposing the worst of those k so it can be evicted cheaply. For each new price, compute its distance to mid; if the heap has fewer than k elements, push it, otherwise push it only if it's strictly better (closer, or tied-but-lower-priced) than the heap's current worst, evicting that worst entry. This keeps the heap bounded at size k throughout, giving O(n log k) instead of sorting all n prices by distance in O(n log n) -- the win matters whenever k is much smaller than the total number of resting orders, which is the common case at any real price level. The tie-break (lower price wins) has to be baked into the comparison key itself, or two equidistant prices can be kept/evicted inconsistently depending on arrival order.",
    code: `import heapq

def k_closest_to_mid(prices: list[int], mid: int, k: int) -> list[int]:
    # min-heap storing (-distance, -price): negating a lexicographic key
    # reverses its order, so the WORST kept candidate (largest distance, and on
    # a tie, the higher price) always sits at heap[0], ready to evict cheaply
    heap: list[tuple[int, int]] = []

    for price in prices:
        dist = abs(price - mid)
        key = (-dist, -price)
        if len(heap) < k:
            heapq.heappush(heap, key)
        elif key > heap[0]:
            heapq.heapreplace(heap, key)

    closest = [(-neg_dist, -neg_price) for neg_dist, neg_price in heap]
    closest.sort()   # ascending distance, tie -> ascending price
    return [price for _, price in closest]

print(k_closest_to_mid([98, 99, 101, 105, 97], mid=100, k=3))
# [99, 101, 98]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-20261017-smallest-window-all-required-venues",
    title: "Smallest Contiguous Window of Fills Covering Every Required Venue",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a sequence of fills in execution order, each tagged with the venue it executed on, and a set of required venues, return the length of the smallest contiguous window of fills containing at least one fill from every required venue. Return 0 if no such window exists.",
    examples: [
      {
        input: 'venues = ["NYSE", "NASDAQ", "NYSE", "ARCA", "NASDAQ"], required = {"NYSE", "ARCA", "NASDAQ"}',
        output: "3",
        explanation:
          "The window [NASDAQ, NYSE, ARCA] (indices 1-3) and the window [NYSE, ARCA, NASDAQ] (indices 2-4) are both length 3 and cover all three required venues; no shorter window does.",
      },
    ],
    constraints: ["1 <= venues.length <= 10^5", "1 <= required set size <= venues.length", "venue names are nonempty strings"],
    approach:
      "This is the classic minimum-window-substring pattern applied to a fill/venue sequence: a two-pointer sliding window with a counter of how many DISTINCT required venues are currently covered inside the window. Expand the right pointer, and whenever adding a fill completes coverage of one more previously-uncovered required venue, shrink from the left as far as possible while coverage stays complete, recording the window length each time it shrinks to a new valid minimum. A hashmap tracks counts of each required venue currently inside the window; a venue's count dropping to zero on a left-shrink is exactly the signal that coverage just broke and shrinking must stop. Because both pointers only ever move forward, the whole scan is O(n) despite the nested-looking expand/shrink structure.",
    code: `from collections import defaultdict

def smallest_window_all_venues(venues: list[str], required: set[str]) -> int:
    counts: dict[str, int] = defaultdict(int)
    covered = 0          # number of DISTINCT required venues currently in window
    best = float("inf")
    left = 0

    for right, venue in enumerate(venues):
        if venue in required:
            counts[venue] += 1
            if counts[venue] == 1:
                covered += 1   # this venue just became represented in the window

        # shrink from the left as long as the window still covers every venue
        while covered == len(required):
            best = min(best, right - left + 1)
            left_venue = venues[left]
            if left_venue in required:
                counts[left_venue] -= 1
                if counts[left_venue] == 0:
                    covered -= 1   # shrinking just broke coverage -- stop next loop
            left += 1

    return 0 if best == float("inf") else best

print(smallest_window_all_venues(
    ["NYSE", "NASDAQ", "NYSE", "ARCA", "NASDAQ"], {"NYSE", "ARCA", "NASDAQ"}
))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(required set size)" },
  },
  {
    id: "lc-20261017-max-profit-two-trades-with-fee",
    title: "Maximum Profit From At Most Two Round-Trip Trades, Each With a Flat Fee",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given a sequence of daily prices for one instrument and a flat fee charged per completed round-trip trade (buy then sell), return the maximum total profit achievable using at most two non-overlapping round-trip trades (you must sell before buying again).",
    examples: [
      {
        input: "prices = [1, 5, 2, 8, 1, 9], fee = 1",
        output: "12",
        explanation:
          "Buy at 2 (index 2), sell at 8 (index 3): profit 6-1=5. Buy at 1 (index 4), sell at 9 (index 5): profit 8-1=7. Total 12, which beats any other pair of non-overlapping trades or a single trade across the whole range.",
      },
    ],
    constraints: ["2 <= prices.length <= 10^5", "0 <= fee <= max(prices)", "prices[i] >= 0"],
    approach:
      "This is the DP state-machine form of the buy/sell-stock family, extended with a transaction counter and a fee. Track five running values after processing each day: cash with 0 trades done, holding-after-1st-buy, cash-after-1st-sell, holding-after-2nd-buy, cash-after-2nd-sell -- each updated as the running MAXIMUM achievable value in that state so far, not recomputed from scratch per day. The fee is charged once per completed round trip; subtracting it at the sell transition (equally valid at the buy transition) works as long as it's applied exactly once per completed trade, never twice and never zero times. Each day's states depend only on the PREVIOUS day's states, so this runs in O(n) time and O(1) space, instead of brute-forcing every (buy1, sell1, buy2, sell2) index combination directly.",
    code: `def max_profit_two_trades_with_fee(prices: list[int], fee: int) -> int:
    NEG_INF = float("-inf")
    # running best value in each state: holding after the 1st/2nd buy,
    # and cash after completing the 1st/2nd round trip
    hold1, sold1 = -prices[0], NEG_INF
    hold2, sold2 = NEG_INF, NEG_INF

    for price in prices[1:]:
        # each day's state is the BEST of "stay in this state" vs "transition into it"
        hold1 = max(hold1, -price)
        sold1 = max(sold1, hold1 + price - fee)   # fee charged once, at the sell
        hold2 = max(hold2, sold1 - price)
        sold2 = max(sold2, hold2 + price - fee)

    return max(0, sold1, sold2)

print(max_profit_two_trades_with_fee([1, 5, 2, 8, 1, 9], fee=1))
# 12`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261017-stationary-distribution-vol-regime-markov-chain",
    title: "Steady-State Probability of Each Volatility Regime in a Markov Chain",
    difficulty: "medium",
    topics: ["probability"],
    problem:
      "A volatility regime model has 3 states (low, medium, high) with a given daily transition probability matrix. Return the long-run (stationary) probability of being in each regime: the distribution pi such that pi equals pi times the transition matrix and the probabilities sum to 1.",
    examples: [
      {
        input: "transition = [[0.90, 0.08, 0.02], [0.15, 0.75, 0.10], [0.05, 0.25, 0.70]]",
        output: "[0.5435, 0.3152, 0.1413]",
        explanation:
          "Solving pi = pi @ transition with sum(pi) = 1 gives roughly 54% low-vol, 32% medium-vol, and 14% high-vol days in the long run, even though a single day is far more likely to transition into medium or high vol than this long-run split alone would suggest.",
      },
    ],
    constraints: ["transition is an n x n row-stochastic matrix (each row sums to 1)", "2 <= n <= 20", "the chain is irreducible and aperiodic"],
    approach:
      "The stationary distribution is the left eigenvector of the transition matrix with eigenvalue 1, normalized to sum to 1 -- equivalently, the fixed point of pi = pi @ P. Rather than finding it by brute-force power iteration, which works but can take many iterations to converge for a slow-mixing chain, solve it directly as a linear system: pi @ (P - I) = 0 together with the normalization constraint sum(pi) = 1. Because each row of P sums to 1, (P - I) alone is rank-deficient by exactly one, so swap in the normalization equation for one of its redundant rows and solve the resulting square linear system exactly. This gives an exact answer in O(n^3) regardless of how slowly the chain would otherwise converge under power iteration.",
    code: `import numpy as np

def stationary_distribution(transition: list[list[float]]) -> list[float]:
    P = np.array(transition)
    n = P.shape[0]

    # solve pi @ (P - I) = 0 with sum(pi) = 1 as one square linear system --
    # (P - I) alone is rank-deficient by 1 (rows of P sum to 1), so swap in
    # the normalization constraint to make the system solvable exactly
    A = (P - np.eye(n)).T
    A[-1, :] = 1.0          # replace the last (redundant) equation
    b = np.zeros(n)
    b[-1] = 1.0             # with the normalization constraint

    pi = np.linalg.solve(A, b)
    return pi.tolist()

regimes = stationary_distribution([
    [0.90, 0.08, 0.02],
    [0.15, 0.75, 0.10],
    [0.05, 0.25, 0.70],
])
print([round(p, 4) for p in regimes])
# [0.5435, 0.3152, 0.1413]`,
    language: "python",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
  },
  {
    id: "lc-20261017-design-price-time-priority-matching-engine",
    title: "Design a Price-Time Priority Limit Order Matching Engine",
    difficulty: "hard",
    topics: ["design"],
    problem:
      "Design a class MatchingEngine that processes submit(side, price, size) for a single instrument, where side is 'buy' or 'sell'. An incoming order matches against resting orders on the OPPOSITE side at the best available price (highest bid for an incoming sell, lowest ask for an incoming buy), with ties broken by time priority (earlier orders fill first). Any unmatched remainder rests in the book. Return the list of fills (price, size) produced by this order, in the order they occurred.",
    examples: [
      {
        input: 'submit("buy", 101, 10); submit("sell", 100, 4); submit("sell", 100, 10)',
        output: "[], [(101, 4)], [(101, 6)]",
        explanation:
          "The resting buy order at 101 for 10 shares sits in the book first. The first sell at 100 for 4 crosses it (100 <= 101) and fills 4 shares at the resting order's price of 101, leaving 6 resting. The second sell at 100 for 10 fills the remaining 6 shares of that same resting order at 101, then has 4 shares left with no more resting buys to match, so those 4 rest as a new sell order in the book.",
      },
    ],
    constraints: ["up to 10^5 submit calls", "prices and sizes are positive", "side is exactly 'buy' or 'sell'"],
    approach:
      "Maintain two heaps: a max-heap of resting buy orders keyed by (-price, sequence) so the best (highest) bid with the earliest timestamp pops first, and a min-heap of resting sell orders keyed by (price, sequence) so the best (lowest) ask with the earliest timestamp pops first -- a sequence number, incremented only when an order actually rests, encodes time priority as the secondary sort key. An incoming order repeatedly peeks at the best resting order on the OPPOSITE side: while that order's price crosses the incoming order's price and the incoming order still has size left, it matches at the RESTING order's price (the standard convention -- the order already in the book sets the trade price), reduces whichever side has more remaining size, and pops the resting order once it's fully filled. Whatever size is left over after no more crossing orders exist gets pushed onto the incoming order's own side of the book as a new resting order.",
    code: `import heapq
import itertools

class MatchingEngine:
    def __init__(self):
        self.bids: list[tuple[float, int, int]] = []   # max-heap: (-price, seq, size)
        self.asks: list[tuple[float, int, int]] = []   # min-heap: (price, seq, size)
        self._seq = itertools.count()

    def submit(self, side: str, price: float, size: int) -> list[tuple[float, int]]:
        fills: list[tuple[float, int]] = []
        if side == "buy":
            book, opposite = self.bids, self.asks
        else:
            book, opposite = self.asks, self.bids

        while size > 0 and opposite:
            resting_key_price, seq, resting_size = opposite[0]
            resting_price = resting_key_price if side == "buy" else -resting_key_price
            crossed = price >= resting_price if side == "buy" else price <= resting_price
            if not crossed:
                break   # best resting order on the other side no longer crosses

            matched = min(size, resting_size)
            fills.append((resting_price, matched))   # trade prints at the RESTING price
            size -= matched
            resting_size -= matched

            if resting_size == 0:
                heapq.heappop(opposite)
            else:
                # size shrank but the sort key (price, seq) is unchanged, so the
                # heap invariant still holds -- no re-heapify needed
                opposite[0] = (resting_key_price, seq, resting_size)

        if size > 0:
            key_price = -price if side == "buy" else price
            heapq.heappush(book, (key_price, next(self._seq), size))

        return fills

engine = MatchingEngine()
print(engine.submit("buy", 101, 10))   # []
print(engine.submit("sell", 100, 4))   # [(101, 4)]
print(engine.submit("sell", 100, 10))  # [(101, 6)]`,
    language: "python",
    complexity: { time: "O(log n) amortized per submit", space: "O(n) resting orders" },
  },
];
