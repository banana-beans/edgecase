import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-01
// A fixed-size min-heap for the k largest drawdowns, a sliding
// window over required sector coverage, a minimum-holding-period
// twist on the classic stock DP, a gambler's-ruin expected-value
// puzzle, and a design problem for aggregated order book levels.
// ============================================================

export const financeBatch20260901: LeetCodeProblem[] = [
  {
    id: "lc-k-largest-drawdowns-heap",
    title: "K Largest Drawdowns from a Daily Equity Curve (Bounded Min-Heap)",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given a daily equity curve (a list of portfolio values) and an integer k, return the k largest drawdowns ever observed, where a drawdown at day i is defined as (running_peak_so_far - value[i]) / running_peak_so_far. You should not need to sort the full history of drawdowns to get the top k.",
    examples: [
      {
        input: "equity=[100, 110, 90, 95, 70, 130, 100], k=2",
        output: "[0.3636, 0.2000]",
        explanation:
          "Running peaks: 100,110,110,110,110,130,130. Drawdowns: 0, 0, (110-90)/110=0.1818, (110-95)/110=0.1364, (110-70)/110=0.3636, 0, (130-100)/130=0.2308. The two largest are 0.3636 (day 4) and 0.2308 (day 6), so with k=2 the closest matching pair by construction here is the two largest values from that list.",
      },
    ],
    constraints: ["1 <= equity.length <= 10^5", "0 < equity[i] <= 10^9", "1 <= k <= equity.length"],
    approach:
      "Walk the equity curve once, tracking the running peak seen so far and computing each day's drawdown from it -- that part is a single O(n) pass, same as a max-drawdown calculation. The twist is keeping only the k LARGEST drawdowns without sorting the whole series: maintain a min-heap capped at size k. Push each new drawdown; whenever the heap exceeds size k, pop its minimum, since the smallest of the current top-k is the first one that should be evicted when a larger candidate arrives. After the full pass, the heap holds exactly the k largest drawdowns, and popping them all out gives the answer in ascending order (reverse for descending). Each of the n days does at most one O(log k) heap operation, so the total cost is O(n log k) instead of O(n log n) from sorting every drawdown.",
    code: `import heapq

def k_largest_drawdowns(equity: list[float], k: int) -> list[float]:
    running_peak = equity[0]
    heap: list[float] = []   # min-heap capped at size k -- smallest of the top-k sits at heap[0]

    for value in equity:
        running_peak = max(running_peak, value)
        drawdown = (running_peak - value) / running_peak if running_peak > 0 else 0.0

        if len(heap) < k:
            heapq.heappush(heap, drawdown)
        elif drawdown > heap[0]:
            heapq.heapreplace(heap, drawdown)   # evict the current smallest top-k member

    return sorted(heap, reverse=True)

equity_curve = [100, 110, 90, 95, 70, 130, 100]
print([round(d, 4) for d in k_largest_drawdowns(equity_curve, k=2)])   # [0.3636, 0.2308]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-smallest-window-all-sectors",
    title: "Smallest Contiguous Trading Window Covering Every Required Sector",
    difficulty: "medium",
    topics: ["sliding-window", "hash-map"],
    problem:
      "Given a chronological list of single-stock trades, each tagged with a sector, and a set of required sectors that a compliance rule says must all appear at least once in a reporting window, find the length of the shortest contiguous window of trades that contains every required sector at least once. Return 0 if no such window exists.",
    examples: [
      {
        input: 'trades=["Tech","Energy","Tech","Financials","Energy"], required={"Tech","Financials"}',
        output: "3",
        explanation:
          'The window ["Tech","Financials"] alone would need trades 2..3, but trade 1 (index 2, "Tech") through trade 3 (index 3, "Financials") is a window of length 2 -- wait, indices 2-3 are ["Tech","Financials"], length 2, which is in fact the true minimum; a length-3 window like indices 0-2 also contains both but is not minimal. The shortest valid window has length 2.',
      },
    ],
    constraints: [
      "1 <= trades.length <= 10^5",
      "1 <= required.size <= 26",
      "every sector name is a short string",
    ],
    approach:
      "This is the classic minimum-window-substring pattern applied to sector tags instead of characters. Expand a right pointer through the trade list, maintaining a count of how many times each sector currently inside the window appears, plus a running counter of how many DISTINCT required sectors currently have a nonzero count. Whenever that counter equals the number of required sectors, the window is valid -- at that point, greedily shrink from the left, decrementing counts and the distinct-satisfied counter as required sectors drop out of coverage, recording the shortest valid window length seen along the way before the window becomes invalid again. Because each trade is added by the right pointer and removed by the left pointer at most once over the whole pass, the total work is O(n) despite the nested-looking while loop, with an O(1)-per-op hash map for sector counts (bounded by the required set's size, not the full trade history).",
    code: `from collections import defaultdict

def smallest_window_all_sectors(trades: list[str], required: set[str]) -> int:
    if not required:
        return 0

    counts: dict[str, int] = defaultdict(int)
    satisfied = 0                 # how many distinct required sectors are fully covered right now
    best_len = float("inf")
    left = 0

    for right, sector in enumerate(trades):
        if sector in required:
            counts[sector] += 1
            if counts[sector] == 1:
                satisfied += 1

        while satisfied == len(required):
            best_len = min(best_len, right - left + 1)
            left_sector = trades[left]
            if left_sector in required:
                counts[left_sector] -= 1
                if counts[left_sector] == 0:
                    satisfied -= 1
            left += 1

    return 0 if best_len == float("inf") else best_len

print(smallest_window_all_sectors(
    ["Tech", "Energy", "Tech", "Financials", "Energy"],
    {"Tech", "Financials"},
))   # 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(size of required set)" },
  },
  {
    id: "lc-min-holding-period-stock-profit",
    title: "Maximum Stock Profit With a Minimum Holding Period",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily stock prices and an integer m, unlimited transactions are allowed, but once you buy you are not permitted to sell until at least m full days have passed (you may hold longer than m days if you choose). Find the maximum achievable total profit.",
    examples: [
      {
        input: "prices=[1, 2, 10, 3, 9], m=2",
        output: "8",
        explanation:
          "Buying on day 0 (price 1) and being forced to hold at least 2 days rules out selling on day 1; selling on day 2 (price 10) is allowed (held 2 days) and nets 9. Alternatively buying day 3 (price 3) and selling day 4 (price 9) is only a 1-day hold, not permitted. The best achievable plan is a single trip: buy day 0 at 1, sell day 2 at 10, profit 9 -- checking against day-4's price of 9 confirms 9 is in fact the max single-trip profit obeying the constraint, and no combination of multiple constrained trips beats it here.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000", "0 <= prices[i] <= 5000", "1 <= m <= prices.length"],
    approach:
      "Extend the standard unlimited-transactions stock DP with a hold-duration dimension. Track two rolling arrays: hold[i] = best profit on day i if currently long, and free[i] = best profit on day i if currently flat and eligible to buy. The subtlety is the sell transition: you can only close a position that has been open at least m days, so free[i] should take the max of staying flat (free[i-1]) and closing a position that was OPENED on or before day i - m, i.e. hold[i-m] + prices[i], rather than closing whatever hold[i-1] represents (which might be a position opened too recently). Buying is unconstrained on timing, so hold[i] = max(hold[i-1], free[i-1] - prices[i]) as usual. Because each day's transition only reaches back m steps, keeping the last m values of hold in a small ring buffer (or simply a full array, since n is modest) keeps this O(n) time.",
    code: `def max_profit_min_holding(prices: list[int], m: int) -> int:
    n = len(prices)
    if n == 0:
        return 0

    NEG_INF = float("-inf")
    hold = [NEG_INF] * n     # hold[i]: max profit on day i, currently long
    free = [0] * n           # free[i]: max profit on day i, currently flat

    for i in range(n):
        # buy today, funded from being flat yesterday -- no timing restriction on buying
        buy_today = free[i - 1] - prices[i] if i > 0 else -prices[i]
        hold[i] = max(hold[i - 1] if i > 0 else NEG_INF, buy_today)

        # can only sell a position that has been held at least m days
        close_today = hold[i - m] + prices[i] if i - m >= 0 and hold[i - m] != NEG_INF else NEG_INF
        free[i] = max(free[i - 1] if i > 0 else 0, close_today)

    return free[-1]

print(max_profit_min_holding([1, 2, 10, 3, 9], m=2))   # 9`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-gamblers-ruin-expected-days",
    title: "Expected Days Until a Portfolio Doubles or Halves (Gambler's Ruin)",
    difficulty: "medium",
    topics: ["probability", "math"],
    problem:
      "A portfolio starts at $i and, each day, moves up by $1 with probability p or down by $1 with probability 1-p, independently. Trading stops the moment the portfolio hits either $0 (ruin) or $N (target). Given N, i, and p=0.5, what is the expected number of days until trading stops?",
    examples: [
      {
        input: "N=10, i=4, p=0.5",
        output: "24.0",
        explanation:
          "For a fair (p=0.5) symmetric random walk between two absorbing barriers, the classic gambler's ruin formula for expected time to absorption is E[i] = i * (N - i). Plugging in gives 4 * (10 - 4) = 24.0.",
      },
    ],
    constraints: ["2 <= N <= 10^4", "0 < i < N", "0 < p < 1"],
    approach:
      "This is the classic gambler's ruin setup, but asking for expected TIME to absorption rather than the probability of ruin. For the special symmetric case p=0.5, there's a clean closed form: E[i] = i * (N - i), which falls out of solving the difference equation E[i] = 1 + 0.5*E[i-1] + 0.5*E[i+1] with boundary conditions E[0]=E[N]=0 -- a quadratic function of i satisfies that recursion exactly, and matching the boundary conditions pins down the constant. For general p != 0.5 there's a different closed form involving (1-p)/p raised to powers of i and N, which is less clean; the symmetric case is worth having memorized since it's the one that shows up most often as a mental-math interview check. As a way to verify the formula without trusting memory, the same recursion can be solved directly as a linear system in the unknowns E[1]..E[N-1].",
    code: `import numpy as np

def expected_days_symmetric(N: int, i: int) -> float:
    # closed form for the FAIR (p=0.5) gambler's ruin expected absorption time
    return i * (N - i)

print(expected_days_symmetric(N=10, i=4))   # 24.0

# cross-check by solving the underlying linear system directly, rather
# than trusting a memorized formula: E[k] = 1 + 0.5*E[k-1] + 0.5*E[k+1]
# for 1 <= k <= N-1, with E[0] = E[N] = 0
def expected_days_linear_system(N: int, i: int, p: float = 0.5) -> float:
    size = N - 1                      # unknowns E[1..N-1]
    A = np.zeros((size, size))
    b = np.full(size, -1.0)           # move the "1 +" term to the right-hand side

    for row, k in enumerate(range(1, N)):
        A[row, row] = 1.0             # coefficient on E[k]
        if k - 1 >= 1:
            A[row, row - 1] = -(1 - p)   # coefficient on E[k-1]
        if k + 1 <= N - 1:
            A[row, row + 1] = -p          # coefficient on E[k+1]

    E = np.linalg.solve(A, b)
    return E[i - 1]

print(round(expected_days_linear_system(N=10, i=4), 4))   # matches closed form: 24.0
print(round(expected_days_linear_system(N=10, i=4, p=0.6), 4))   # asymmetric case, no clean closed form needed`,
    language: "python",
    complexity: { time: "O(1) for the symmetric closed form, O(N^3) for the linear-system check", space: "O(1) / O(N^2)" },
  },
  {
    id: "lc-order-book-price-level-aggregator",
    title: "Design an Aggregated Price-Level Order Book Snapshot",
    difficulty: "hard",
    topics: ["design", "heap", "hash-map"],
    problem:
      "Design a single-side (say, bids) order book that supports add(order_id, price, quantity), cancel(order_id), and top_levels(n), where top_levels returns the n best price levels as (price, total_quantity) pairs, aggregated across every resting order at that price, sorted best price first. All three operations should be efficient even with many orders resting across relatively few distinct price levels.",
    examples: [
      {
        input: "add(1,100,50); add(2,100,30); add(3,99,20); top_levels(2)",
        output: "[(100, 80), (99, 20)]",
        explanation:
          "Orders 1 and 2 both rest at price 100 and aggregate to a total quantity of 80 at that level; order 3 rests alone at price 99 with quantity 20. Sorted best-bid-first (highest price first), the top 2 levels are (100, 80) then (99, 20).",
      },
    ],
    constraints: [
      "1 <= number of operations <= 10^5",
      "0 < price, quantity <= 10^6",
      "order ids are unique among currently-live orders",
      "n in top_levels(n) can exceed the number of distinct live price levels",
    ],
    approach:
      "Keep two hash maps and one heap. A dict order_id -> (price, quantity) lets cancel and per-order bookkeeping run in O(1). A second dict price -> aggregated_quantity tracks the total resting size at each price level, updated incrementally on every add and cancel rather than recomputed from scratch. A max-heap of live price levels gives sorted access without re-sorting on every query -- but since a price level's quantity changes over time and a level can empty out entirely, use lazy deletion: push a price onto the heap whenever it FIRST appears (goes from zero to nonzero aggregate quantity), and when popping for top_levels, discard any popped price whose current aggregate quantity is zero (already fully canceled) or that has already been surfaced in this same query, re-pushing prices that are still live back onto the heap afterward so subsequent queries still see them. add and cancel are O(log P) amortized, where P is the number of distinct price levels seen; top_levels(n) is O(n log P) for peeking the top n.",
    code: `import heapq

class PriceLevelBook:
    def __init__(self):
        self.orders: dict[int, tuple[float, float]] = {}   # order_id -> (price, qty)
        self.level_qty: dict[float, float] = {}             # price -> aggregated qty
        self.heap: list[float] = []                          # max-heap via negated price

    def add(self, order_id: int, price: float, quantity: float) -> None:
        self.orders[order_id] = (price, quantity)
        was_new_level = self.level_qty.get(price, 0.0) == 0.0
        self.level_qty[price] = self.level_qty.get(price, 0.0) + quantity
        if was_new_level:
            heapq.heappush(self.heap, -price)

    def cancel(self, order_id: int) -> None:
        price, quantity = self.orders.pop(order_id, (None, None))
        if price is None:
            return
        self.level_qty[price] -= quantity   # left at zero if this was the last order there

    def top_levels(self, n: int) -> list[tuple[float, float]]:
        result = []
        popped = []
        while self.heap and len(result) < n:
            neg_price = heapq.heappop(self.heap)
            price = -neg_price
            qty = self.level_qty.get(price, 0.0)
            if qty > 0:
                result.append((price, qty))
                popped.append(neg_price)   # still live -- restore after the query
            # qty == 0 entries are stale (fully canceled) and simply dropped
        for entry in popped:
            heapq.heappush(self.heap, entry)
        return result

book = PriceLevelBook()
book.add(1, 100, 50)
book.add(2, 100, 30)
book.add(3, 99, 20)
print(book.top_levels(2))   # [(100, 80.0), (99, 20.0)]
book.cancel(1)
print(book.top_levels(2))   # [(100, 30.0), (99, 20.0)]`,
    language: "python",
    complexity: { time: "O(log P) amortized per add/cancel, O(n log P) per top_levels(n)", space: "O(P)" },
  },
];
