import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-19
// A heap-based k-nearest-price lookup, a monotonic-deque sliding
// window bounding price range, a three-state DP for buy/sell with
// a flat per-trade fee, an absorbing-barrier expected-hitting-time
// random walk, and a price-time priority limit order matcher.
// ============================================================

export const financeBatch20260919: LeetCodeProblem[] = [
  {
    id: "lc-20260919-k-closest-trade-prices",
    title: "K Closest Trade Prices to a Reference Price",
    difficulty: "easy",
    topics: ["heap", "sorting"],
    problem:
      "Given a list of trade prices and a reference price target, return the k trade prices closest to target, ordered by distance ascending. Break ties between equally-close prices by preferring the lower price.",
    examples: [
      {
        input: "prices=[10,7,15,12,9], target=11, k=3",
        output: "[10,12,9]",
        explanation:
          "Distances to 11: 10->1, 12->1, 9->2, 7->4, 15->4. The three closest are 10 and 12 (tied at distance 1, lower price 10 first) then 9 (distance 2).",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "1 <= k <= prices.length"],
    approach:
      "This is a partial-selection problem, not a full sort: you only need the k smallest values under a custom key, so reach for heapq.nsmallest with key=(distance, price) rather than sorting all n prices and slicing. nsmallest maintains an internal heap of size k while scanning every price once, giving O(n log k) instead of O(n log n) -- the tuple key handles the tie-break for free, since Python compares tuples lexicographically and a lower price sorts first when distances are equal.",
    code: `import heapq

def k_closest_trade_prices(prices: list[int], target: int, k: int) -> list[int]:
    # nsmallest scans all n prices with an internal size-k heap: O(n log k),
    # far cheaper than sorted(prices, key=...)[:k] which is O(n log n)
    return heapq.nsmallest(k, prices, key=lambda p: (abs(p - target), p))

print(k_closest_trade_prices([10, 7, 15, 12, 9], 11, 3))   # [10, 12, 9]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-20260919-longest-window-within-band",
    title: "Longest Window Where Price Range Stays Within a Band",
    difficulty: "medium",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given a list of daily closing prices and an integer band, return the length of the longest contiguous window whose price range (max price in the window minus min price in the window) is at most band.",
    examples: [
      {
        input: "prices=[8,2,4,7], band=5",
        output: "3",
        explanation:
          'The window [2,4,7] (indices 1..3) has range 7-2=5, which is <= band. No length-4 window works: the full array has range 8-2=6 > 5.',
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= band"],
    approach:
      "Track the window's running max and min with two monotonic deques instead of recomputing them over the whole window on every step. The max-deque holds indices with strictly decreasing prices so its front is always the current window's max; the min-deque mirrors that for the min. Expanding right pops from the back of each deque anything the new price dominates, keeping each deque monotonic. Whenever the window's range (front of max-deque minus front of min-deque) exceeds band, shrink from the left, retiring any deque entries that fall out of the window. Every index enters and leaves each deque at most once across the whole scan, so despite the nested-looking shrink loop the total work is O(n).",
    code: `from collections import deque

def longest_window_within_band(prices: list[int], band: int) -> int:
    max_deque: deque[int] = deque()   # indices, prices decreasing -- front is window max
    min_deque: deque[int] = deque()   # indices, prices increasing -- front is window min
    left = 0
    best = 0

    for right, price in enumerate(prices):
        while max_deque and prices[max_deque[-1]] <= price:
            max_deque.pop()
        max_deque.append(right)

        while min_deque and prices[min_deque[-1]] >= price:
            min_deque.pop()
        min_deque.append(right)

        # shrink from the left while the window's range exceeds the band
        while prices[max_deque[0]] - prices[min_deque[0]] > band:
            if max_deque[0] == left:
                max_deque.popleft()
            if min_deque[0] == left:
                min_deque.popleft()
            left += 1

        best = max(best, right - left + 1)

    return best

print(longest_window_within_band([8, 2, 4, 7], 5))   # 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-20260919-stock-transaction-fee",
    title: "Maximum Profit With Unlimited Transactions and a Flat Fee Per Trade",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices and a flat fee charged once per completed round trip, you may hold at most one share at a time with unlimited transactions. Return the maximum achievable profit.",
    examples: [
      {
        input: "prices=[1,3,2,8,4,9], fee=2",
        output: "8",
        explanation:
          "Buy at 1, sell at 8 (profit 7 minus fee 2 = 5), then buy at 4, sell at 9 (profit 5 minus fee 2 = 3). Total 5+3=8, better than any other split of trades.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i], fee <= 10^4"],
    approach:
      "Track two running states day by day instead of an explicit table: cash (max profit while not currently holding a share) and hold (max profit while holding one). Each transition only references the PREVIOUS day's two values: cash stays the same or comes from selling out of yesterday's hold state, with the fee charged exactly once on that sale; hold stays the same or comes from buying out of yesterday's cash state. Charging the fee on the buy leg instead would work identically as long as it's charged exactly once per round trip -- the common bug is charging it on both legs, which double-counts the cost and understates profit.",
    code: `def max_profit_with_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    cash = 0                 # max profit, not currently holding
    hold = -prices[0]        # max profit, currently holding a share

    for price in prices[1:]:
        # sell today: pay the fee once, on the completed round trip
        cash = max(cash, hold + price - fee)
        # buy today, funded out of yesterday's cash state
        hold = max(hold, cash - price)

    return cash   # end of period, best result requires not holding

print(max_profit_with_fee([1, 3, 2, 8, 4, 9], 2))   # 8`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260919-expected-ticks-to-barrier",
    title: "Expected Number of Ticks Until a Random Walk Hits Target or Stop",
    difficulty: "hard",
    topics: ["probability", "math", "dynamic-programming"],
    problem:
      "A price moves in integer ticks from a starting level of 0: up one tick with probability p, down one tick with probability q=1-p, independently each tick. Given a profit target T ticks above and a stop loss S ticks below, return the expected number of ticks until the price first reaches +T or -S.",
    examples: [
      {
        input: "p=0.5, T=2, S=2",
        output: "4.0",
        explanation:
          "For a symmetric random walk between two absorbing barriers, the expected hitting time starting midway is S times T, here 2*2=4.",
      },
    ],
    constraints: ["1 <= T, S <= 200", "0 < p < 1"],
    approach:
      "This is expected hitting time for a biased random walk with two absorbing barriers -- the same family of problem as gambler's ruin, but solving for expected TIME rather than probability of ruin. Let E(i) be the expected remaining ticks starting from level i, with boundary conditions E(T)=0 and E(-S)=0, and the interior recurrence E(i) = 1 + p*E(i+1) + q*E(i-1) for -S < i < T (the +1 accounts for the tick you're about to take). Rather than deriving the closed form from memory -- which has a different shape for p=0.5 versus p != 0.5, easy to misremember under interview pressure -- solve the boundary-value system directly as a small linear system, the same technique you'd use for the ruin-probability version of this problem.",
    code: `import numpy as np

def expected_ticks_to_barrier(p: float, T: int, S: int) -> float:
    q = 1 - p
    states = list(range(-S, T + 1))     # -S .. T inclusive
    n = len(states)
    idx = {s: k for k, s in enumerate(states)}

    A = np.zeros((n, n))
    b = np.zeros(n)

    # absorbing boundaries: expected remaining time is 0 once you're there
    A[idx[-S], idx[-S]] = 1.0
    b[idx[-S]] = 0.0
    A[idx[T], idx[T]] = 1.0
    b[idx[T]] = 0.0

    # interior: E(i) = 1 + p*E(i+1) + q*E(i-1)
    for s in states[1:-1]:
        k = idx[s]
        A[k, k] = 1.0
        A[k, idx[s + 1]] = -p
        A[k, idx[s - 1]] = -q
        b[k] = 1.0

    E = np.linalg.solve(A, b)
    return float(E[idx[0]])

print(round(expected_ticks_to_barrier(0.5, 2, 2), 4))   # 4.0 -- symmetric case: S * T
print(round(expected_ticks_to_barrier(0.6, 2, 2), 4))   # < 4.0 -- upward drift reaches +T faster`,
    language: "python",
    complexity: { time: "O(n) states solved via a tridiagonal system (the dense solve above is O(n^3))", space: "O(n)" },
  },
  {
    id: "lc-20260919-price-time-order-matcher",
    title: "Design a Price-Time Priority Limit Order Matcher",
    difficulty: "hard",
    topics: ["design", "heap", "hash-table"],
    problem:
      "Design a limit order book matcher for a single instrument supporting add_buy(order_id, price, qty), add_sell(order_id, price, qty), and cancel(order_id). An incoming order matches immediately against resting orders on the opposite side that it crosses, in price-time priority (best price first, then earliest arrival among ties), partially filling as needed; any unfilled remainder rests in the book. Each add_* call returns the list of fills it produced, as (resting_order_id, incoming_order_id, trade_price, trade_qty) tuples.",
    examples: [
      {
        input: 'add_sell(1,101.0,50); add_sell(2,100.5,30); add_buy(3,101.0,60)',
        output: "[(2,3,100.5,30), (1,3,101.0,30)]",
        explanation:
          "The incoming buy at 101.0 crosses both resting sells. Best price first: order 2 (100.5) fills completely for 30, then the remaining 30 shares fill against order 1 at its own resting price of 101.0.",
      },
    ],
    constraints: ["prices and quantities positive", "order_id values unique while resting"],
    approach:
      "Maintain two heaps of resting orders: a max-heap for buys keyed by (-price, arrival_seq) and a min-heap for sells keyed by (price, arrival_seq), so the best-priced, earliest-arrived order is always at the top -- that ordering key IS price-time priority. Track remaining quantity per order_id in a hash map so cancel() is O(1): mark the order's remaining quantity as zero and let it be lazily skipped whenever it later surfaces at the top of a heap, rather than scanning the heap to remove it. To fill an incoming order, repeatedly peek the best resting order on the opposite side; while one exists, is still live, and its price crosses the incoming price, trade the min of the two remaining quantities AT THE RESTING ORDER'S PRICE -- price-time priority means the order that arrived first sets the trade price, not the aggressor. Any incoming quantity left over after the opposite book is exhausted or stops crossing becomes a new resting order on its own side.",
    code: `import heapq

class OrderBook:
    def __init__(self):
        self.buys: list[tuple] = []    # max-heap: (-price, seq, order_id)
        self.sells: list[tuple] = []   # min-heap: (price, seq, order_id)
        self.remaining: dict[int, int] = {}   # order_id -> remaining qty; 0 = dead
        self._seq = 0

    def _next_seq(self) -> int:
        self._seq += 1
        return self._seq

    def _pop_valid(self, heap: list[tuple]):
        # lazy deletion: skip entries for orders already filled or cancelled
        while heap:
            top = heap[0]
            if self.remaining.get(top[2], 0) > 0:
                return top
            heapq.heappop(heap)
        return None

    def cancel(self, order_id: int) -> None:
        self.remaining[order_id] = 0   # heap entry is skipped once it surfaces

    def add_buy(self, order_id: int, price: float, qty: int):
        return self._add(order_id, price, qty, is_buy=True)

    def add_sell(self, order_id: int, price: float, qty: int):
        return self._add(order_id, price, qty, is_buy=False)

    def _add(self, order_id: int, price: float, qty: int, is_buy: bool):
        fills = []
        self.remaining[order_id] = qty
        opposite = self.sells if is_buy else self.buys

        while self.remaining[order_id] > 0:
            best = self._pop_valid(opposite)
            if best is None:
                break
            resting_price = best[0] if not is_buy else -best[0]
            crosses = price >= resting_price if is_buy else price <= resting_price
            if not crosses:
                break

            resting_id = best[2]
            trade_qty = min(self.remaining[order_id], self.remaining[resting_id])
            # price-time priority: the RESTING order, having arrived first,
            # sets the trade price -- the incoming order takes that price
            fills.append((resting_id, order_id, resting_price, trade_qty))

            self.remaining[order_id] -= trade_qty
            self.remaining[resting_id] -= trade_qty
            if self.remaining[resting_id] == 0:
                heapq.heappop(opposite)

        if self.remaining[order_id] > 0:
            own_side = self.buys if is_buy else self.sells
            key = -price if is_buy else price
            heapq.heappush(own_side, (key, self._next_seq(), order_id))

        return fills

book = OrderBook()
book.add_sell(1, 101.0, 50)
book.add_sell(2, 100.5, 30)
print(book.add_buy(3, 101.0, 60))
# [(2, 3, 100.5, 30), (1, 3, 101.0, 30)]`,
    language: "python",
    complexity: { time: "O(log n) amortized per add or cancel", space: "O(n)" },
  },
];
