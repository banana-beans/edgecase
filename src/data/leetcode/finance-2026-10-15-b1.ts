import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-15
// Top-k active tickers from a live trade-count stream (heap),
// longest run of trades whose cumulative notional stays within
// a capital limit (sliding window), max profit with a mandatory
// one-day cooldown after selling (DP, LC309 shape), gambler's
// ruin probability of hitting a profit target before going bust
// (probability/Markov), and a position tracker with weighted
// average cost basis and realized P&L on partial closes (design).
// ============================================================

export const financeBatch20261015: LeetCodeProblem[] = [
  {
    id: "lc-20261015-kth-smallest-spread-sorted-matrix",
    title: "Kth Smallest Spread in a Row- and Column-Sorted Basis Matrix",
    difficulty: "hard",
    topics: ["heap"],
    problem:
      "You have an n x n matrix of cross-asset basis spreads where each row and each column is sorted in ascending order (a structure that falls out of a monotonic term-structure construction). Return the kth smallest spread in the matrix without materializing and sorting every entry.",
    examples: [
      {
        input: "matrix = [[1, 5, 9], [10, 11, 13], [12, 13, 15]], k = 8",
        output: "13",
        explanation:
          "Flattening and sorting every entry gives [1,5,9,10,11,12,13,13,15]; the 8th smallest (1-indexed) is 13.",
      },
    ],
    constraints: ["1 <= n <= 300", "1 <= k <= n*n", "each row and column is sorted ascending"],
    approach:
      "Exploit both sort orders at once instead of flattening the matrix: seed a min-heap with the first (leftmost) element of every row, each tagged with its row and column. Popping the heap's minimum k times gives the kth smallest overall, because at every step the heap's current minimum really is the smallest value not yet popped -- the row-sorted structure guarantees each row's unexplored elements are all at least as large as the one just popped from that row, so after popping (row, col) it's always safe (and sufficient) to push that same row's next element (row, col+1) back onto the heap. This needs only one entry per row alive in the heap at a time, giving O(k log n) instead of the O(n^2 log(n^2)) a full sort would cost.",
    code: `import heapq

def kth_smallest_spread(matrix: list[list[int]], k: int) -> int:
    n = len(matrix)
    # one entry per row to start -- each row's unexplored tail is only ever >= what's already popped
    heap = [(matrix[row][0], row, 0) for row in range(n)]
    heapq.heapify(heap)

    val = matrix[0][0]
    for _ in range(k):
        val, row, col = heapq.heappop(heap)
        if col + 1 < n:
            heapq.heappush(heap, (matrix[row][col + 1], row, col + 1))
    return val

matrix = [[1, 5, 9], [10, 11, 13], [12, 13, 15]]
print(kth_smallest_spread(matrix, 8))
# 13`,
    language: "python",
    complexity: { time: "O(k log n)", space: "O(n)" },
    leetcodeNumber: 378,
  },
  {
    id: "lc-20261015-longest-run-notional-under-limit",
    title: "Longest Run of Trades Whose Total Notional Stays Within a Capital Limit",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a sequence of trade notional values (all positive, in execution order) and a capital limit, return the length of the longest contiguous run of trades whose cumulative notional never exceeds the limit.",
    examples: [
      {
        input: "notionals = [50, 40, 10, 60, 30], limit = 100",
        output: "3",
        explanation:
          "The run [10, 60, 30] sums to exactly 100 and has length 3 -- no longer contiguous run anywhere in the sequence stays at or under the limit.",
      },
    ],
    constraints: ["1 <= notionals.length <= 10^5", "1 <= notionals[i] <= 10^9", "1 <= limit <= 10^15"],
    approach:
      "Because every notional value is strictly positive, the running window sum is monotonic in both pointers: extending the window on the right only ever increases the sum, and shrinking from the left only ever decreases it. That monotonicity is exactly what makes a two-pointer sliding window correct here -- advance right and add to a running sum, and whenever the sum exceeds the limit, advance left and subtract until it doesn't, tracking the best length seen. Each pointer only ever moves forward, so total work is O(n) despite checking a window condition at every step.",
    code: `def longest_run_within_limit(notionals: list[int], limit: int) -> int:
    left = 0
    window_sum = 0
    best = 0

    for right, notional in enumerate(notionals):
        window_sum += notional

        # shrink from the left while the running total breaks the capital limit --
        # safe because every value is positive, so the sum only ever grows or shrinks
        # monotonically as each pointer moves, never oscillates
        while window_sum > limit:
            window_sum -= notionals[left]
            left += 1

        best = max(best, right - left + 1)

    return best

print(longest_run_within_limit([50, 40, 10, 60, 30], 100))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261015-split-parent-order-min-largest-child",
    title: "Split a Parent Order Into K Child Orders to Minimize the Largest Child's Volume",
    difficulty: "hard",
    topics: ["dynamic-programming", "binary-search"],
    problem:
      "A parent order must be sliced into exactly k contiguous child orders (preserving sequence) against a series of planned trade clips. Given the clip sizes and k, return the minimum possible value for the largest child order's total volume, over all ways of grouping the clips into k contiguous child orders.",
    examples: [
      {
        input: "clips = [7, 2, 5, 10, 8], k = 2",
        output: "18",
        explanation:
          "Grouping as [7, 2, 5] and [10, 8] gives child totals 14 and 18; no other split into exactly 2 contiguous groups produces a largest child smaller than 18.",
      },
    ],
    constraints: ["1 <= clips.length <= 10^5", "0 <= clips[i] <= 10^6", "1 <= k <= clips.length"],
    approach:
      "Binary search on the ANSWER rather than enumerating splits directly: for a candidate cap on the largest child order's volume, a single greedy left-to-right pass can check feasibility in O(n) -- keep adding clips to the current child while it fits under the cap, and start a new child the moment the next clip would exceed it, counting how many children that takes. If the count stays at or under k, the cap is achievable (search lower); if it exceeds k, the cap is too tight (search higher). The search range runs from max(clips) (no child can hold less than the single largest clip) to sum(clips) (one child holding everything), and because feasibility is monotonic in the cap, binary search finds the minimum achievable cap in O(n log(sum(clips))) instead of the exponential number of ways to group clips into k pieces.",
    code: `def min_largest_child_order(clips: list[int], k: int) -> int:
    lo, hi = max(clips), sum(clips)   # a child must hold at least the single biggest clip

    def feasible(max_allowed: int) -> bool:
        children_needed = 1
        running = 0
        for clip in clips:
            if running + clip > max_allowed:
                children_needed += 1   # this clip starts a new child order
                running = clip
                if children_needed > k:
                    return False
            else:
                running += clip
        return True

    # feasibility is monotonic in max_allowed, so binary search finds the minimum cap
    while lo < hi:
        mid = (lo + hi) // 2
        if feasible(mid):
            hi = mid
        else:
            lo = mid + 1
    return lo

print(min_largest_child_order([7, 2, 5, 10, 8], 2))
# 18`,
    language: "python",
    complexity: { time: "O(n log(sum(clips)))", space: "O(1)" },
    leetcodeNumber: 410,
  },
  {
    id: "lc-20261015-expected-days-two-consecutive-up-days",
    title: "Expected Number of Trading Days Until Two Consecutive Up-Days",
    difficulty: "medium",
    topics: ["probability"],
    problem:
      "Model each trading day as closing up with probability p, independent across days. Define the first occurrence of two consecutive up-days as a momentum trigger. Return the expected number of days until that trigger first fires, as a function of p.",
    examples: [
      {
        input: "p = 0.5",
        output: "6.0",
        explanation:
          "This is the classic 'expected flips to see HH' result -- it takes 6 fair coin flips on average to see two heads in a row.",
      },
    ],
    constraints: ["0 < p <= 1"],
    approach:
      "Track expected additional days as a function of the CURRENT up-day streak length: E0 for streak 0 (no streak, or yesterday was down) and E1 for streak 1 (yesterday was up). From E0, one day passes; with probability p the streak becomes 1 (moving to E1), with probability (1-p) it stays at E0. From E1, with probability p the streak hits 2 and the trigger fires (0 additional days needed from there), with probability (1-p) it resets to E0. Writing both as linear equations in E0 and E1 and solving gives the closed form E0 = (1 + p) / p^2, which collapses to the textbook expected-flips-to-HH answer of 6 at p = 0.5. The same linear-system approach generalizes cleanly to 'k consecutive up-days' without re-deriving a new closed form by hand every time.",
    code: `def expected_days_to_two_up_days(p: float) -> float:
    # closed form from solving E0 = 1 + p*E1 + (1-p)*E0, E1 = 1 + (1-p)*E0
    return (1 + p) / p ** 2

print(expected_days_to_two_up_days(0.5))
# 6.0

# generalizes to "k consecutive up-days" by solving the linear system directly
# instead of re-deriving a closed form by hand for every new k
import numpy as np

def expected_days_to_k_up_days(p: float, k: int) -> float:
    # state i = current streak length (0..k-1); hitting streak k ends the chain
    # E_i = 1 + p*E_(i+1) + (1-p)*E_0   for i < k-1
    # E_(k-1) = 1 + (1-p)*E_0            (a success here ends the chain, 0 extra days)
    A = np.eye(k)
    b = np.ones(k)
    for i in range(k):
        A[i, 0] -= (1 - p)        # the failure branch always resets to state 0
        if i + 1 < k:
            A[i, i + 1] -= p      # the success branch advances the streak
    E = np.linalg.solve(A, b)
    return E[0]

print(round(expected_days_to_k_up_days(0.5, 2), 4))
# 6.0 -- matches the closed form for k=2`,
    language: "python",
    complexity: { time: "O(1) closed form; O(k^3) for the general linear-system version", space: "O(1) / O(k^2)" },
  },
  {
    id: "lc-20261015-design-order-book-depth-tracker",
    title: "Design an Order Book Depth Tracker From Incremental L2 Updates",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design a class OrderBookDepth that consumes incremental level-2 depth updates -- update_bid(price, size) and update_ask(price, size), where size=0 means that price level has been fully removed -- and supports best_bid() and best_ask() queries at any point, each returning the best (highest bid / lowest ask) currently resting price, or None if that side is empty.",
    examples: [
      {
        input:
          "book.update_bid(100.50,300); book.update_bid(100.45,500); book.update_ask(100.55,200); book.update_bid(100.50,0)",
        output: "best_bid() -> 100.45 (after the last update); best_ask() -> 100.55",
        explanation:
          "100.50 is removed by the size=0 update, so the best remaining bid falls back to 100.45; the ask side is untouched by any of the bid updates.",
      },
    ],
    constraints: ["up to 10^5 update calls", "up to 10^5 best_bid/best_ask queries interleaved", "prices are positive floats"],
    approach:
      "A dict mapping price to resting size gives O(1) updates and existence checks, but a plain dict has no notion of 'the best price,' and a fully sorted structure (e.g. a sorted list) would need an O(n) insert/remove on every update. Instead, pair each side's dict with a heap (max-heap via negation for bids, min-heap for asks) that may contain STALE entries -- prices that were since removed or whose heap entry is simply a duplicate of an earlier push for the same price. Every update that sets a nonzero size pushes that price onto the heap without worrying about duplicates; a size=0 update only removes the price from the dict, leaving any heap entries for it to be discovered stale later. best_bid()/best_ask() lazily pop from the top of the heap while that price is no longer a key in the dict, so the first live price surfaces correctly -- this is the standard lazy-deletion heap pattern, amortized O(log n) per operation since each stale entry is only ever popped once.",
    code: `import heapq

class OrderBookDepth:
    def __init__(self):
        self.bid_size: dict[float, int] = {}   # price -> aggregated resting size
        self.ask_size: dict[float, int] = {}
        self.bid_heap: list[float] = []        # max-heap via negation; may hold stale prices
        self.ask_heap: list[float] = []        # min-heap; may hold stale prices

    def update_bid(self, price: float, size: int) -> None:
        if size == 0:
            self.bid_size.pop(price, None)     # level removed -- stays in heap, discovered stale later
        else:
            self.bid_size[price] = size
            heapq.heappush(self.bid_heap, -price)

    def update_ask(self, price: float, size: int) -> None:
        if size == 0:
            self.ask_size.pop(price, None)
        else:
            self.ask_size[price] = size
            heapq.heappush(self.ask_heap, price)

    def best_bid(self) -> float | None:
        # lazily discard heap entries for levels that have since been removed or re-pushed
        while self.bid_heap and -self.bid_heap[0] not in self.bid_size:
            heapq.heappop(self.bid_heap)
        return -self.bid_heap[0] if self.bid_heap else None

    def best_ask(self) -> float | None:
        while self.ask_heap and self.ask_heap[0] not in self.ask_size:
            heapq.heappop(self.ask_heap)
        return self.ask_heap[0] if self.ask_heap else None

book = OrderBookDepth()
book.update_bid(100.50, 300)
book.update_bid(100.45, 500)
book.update_ask(100.55, 200)
print(book.best_bid(), book.best_ask())
# 100.5 100.55

book.update_bid(100.50, 0)   # level fully removed
print(book.best_bid())
# 100.45`,
    language: "python",
    complexity: { time: "O(log n) amortized per operation", space: "O(n)" },
  },
];
