import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-05
// Top-K most active tickers in a sliding time window (heap +
// sliding window), shortest subarray of signed trade quantities
// meeting a target (monotonic-deque prefix sum), max profit with
// at most two transactions plus a fixed per-trade commission (DP
// stock variant), the classic gambler's-ruin HIT PROBABILITY for
// a market maker's inventory walk (probability, distinct from
// prior batches' expected-time version), and a FIFO position
// tracker with average cost basis and realized P&L on partial
// closes (design).
// ============================================================

export const financeBatch20261105: LeetCodeProblem[] = [
  {
    id: "lc-20261105-top-k-active-tickers-sliding-window",
    title: "Top K Most Active Tickers in a Sliding Time Window",
    difficulty: "medium",
    topics: ["heap", "sliding-window"],
    problem:
      "Given a chronological stream of (ticker, timestamp) trade events and a window size of w consecutive events, return the top k tickers by trade count within the current window, for every window as it slides one event at a time from the start of the stream to the end. Ties break by ticker name ascending.",
    examples: [
      {
        input:
          'events = ["AAPL","MSFT","AAPL","GOOG","AAPL","MSFT","GOOG"], w = 4, k = 2',
        output: '[["AAPL","MSFT"], ["AAPL","GOOG"], ["AAPL","GOOG"]]',
        explanation:
          "Windows are events[0:4], events[1:5], events[2:6]: window 1 has AAPL=2, MSFT=1, GOOG=1 -> top 2 is [AAPL, MSFT]. Window 2 drops the first AAPL and adds a second AAPL, giving AAPL=2, GOOG=1, MSFT=1 -> top 2 is [AAPL, GOOG] (GOOG beats MSFT alphabetically on the count-1 tie). Window 3 is similar.",
      },
    ],
    constraints: ["1 <= w <= events.length <= 10^5", "1 <= k <= 26"],
    approach:
      "Maintain a running count map for the current window, updating it incrementally as the window slides: increment the entering ticker's count, decrement (and evict at zero) the leaving ticker's count. Re-deriving the top k from scratch every slide with a full sort would cost O(n log n) per step; instead maintain a max-heap of (count, ticker) lazily -- push an updated entry whenever a count changes, and when popping for the top-k answer, skip any popped entry whose heap-stored count is now stale (smaller than the count map's current truth) rather than deleting it from the middle of the heap, since heaps don't support efficient arbitrary deletion. This lazy-staleness pattern is the same idea used for heap-based sliding-window median or top-k problems where membership changes faster than a heap can be kept perfectly in sync.",
    code: `import heapq
from collections import defaultdict

def top_k_active_tickers(events: list[str], w: int, k: int) -> list[list[str]]:
    counts: dict[str, int] = defaultdict(int)
    heap: list[tuple[int, str]] = []   # max-heap via negated counts
    results: list[list[str]] = []

    def push(ticker: str) -> None:
        heapq.heappush(heap, (-counts[ticker], ticker))

    for i, ticker in enumerate(events):
        counts[ticker] += 1
        push(ticker)
        if i >= w:
            leaving = events[i - w]
            counts[leaving] -= 1
            # no need to touch the heap here -- the stale entry is skipped on read

        if i >= w - 1:
            top: list[str] = []
            seen: set[str] = set()
            scratch: list[tuple[int, str]] = []
            while heap and len(top) < k:
                neg_count, ticker_name = heapq.heappop(heap)
                scratch.append((neg_count, ticker_name))
                if ticker_name in seen:
                    continue
                if -neg_count != counts[ticker_name]:
                    continue   # stale heap entry -- the real count has since changed
                top.append(ticker_name)
                seen.add(ticker_name)
            for entry in scratch:
                heapq.heappush(heap, entry)   # restore the heap for the next slide
            results.append(sorted(top))

    return results

print(top_k_active_tickers(
    ["AAPL", "MSFT", "AAPL", "GOOG", "AAPL", "MSFT", "GOOG"], w=4, k=2
))`,
    language: "python",
    complexity: {
      time: "O(n log n) amortized across all slides with the lazy-staleness heap",
      space: "O(number of distinct tickers)",
    },
  },
  {
    id: "lc-20261105-shortest-subarray-signed-quantity-target",
    title: "Shortest Subarray of Signed Trade Quantities Reaching a Target Net Position",
    difficulty: "hard",
    topics: ["sliding-window"],
    problem:
      "Given an array of signed trade quantities (positive for buys, negative for sells) and an integer target, return the length of the shortest contiguous subarray whose sum is at least target. Return -1 if no such subarray exists. Quantities may be any sign, so a plain non-negative sliding window does not directly apply.",
    examples: [
      {
        input: "quantities = [3, -1, 5, -2, 7], target = 9",
        output: "3",
        explanation:
          "Subarray [5, -2, 7] (indices 2..4) sums to 10, which meets the target 9 over length 3. The only other subarray meeting the target is the full suffix [-1, 5, -2, 7] (indices 1..4), summing to 9 but over length 4, and the whole array sums to 12 over length 5 -- both longer. No length-1 or length-2 subarray reaches 9, so 3 is the shortest.",
      },
    ],
    constraints: ["1 <= quantities.length <= 10^5", "-10^4 <= quantities[i] <= 10^4", "-10^9 <= target <= 10^9"],
    approach:
      "Because elements can be negative, a plain two-pointer window (which relies on 'adding an element never decreases the sum' to safely shrink from the left) does not work directly. Instead compute prefix sums and reduce the problem to: for each right endpoint j, find the SMALLEST prefix index i < j such that prefix[j] - prefix[i] >= target, minimizing j - i. Maintain a monotonically increasing deque of prefix-sum indices: before processing index j, pop any index off the FRONT whose prefix sum already satisfies the target against prefix[j] (recording the window length, since later j's would only make that same front index less optimal, never more) and pop any index off the BACK whose prefix sum is >= prefix[j] (since a larger-or-equal prefix sum at an earlier, closer position can never be useful once a smaller prefix sum at a closer position exists) before pushing j itself.",
    code: `from collections import deque

def shortest_subarray_reaching_target(quantities: list[int], target: int) -> int:
    n = len(quantities)
    prefix = [0] * (n + 1)
    for i, q in enumerate(quantities):
        prefix[i + 1] = prefix[i] + q

    best = n + 1
    monotonic_idx: deque[int] = deque()   # indices with strictly increasing prefix sums

    for j in range(n + 1):
        # the front of the deque holds the best (smallest-sum, earliest) candidate --
        # keep satisfying the target and shrinking the window from the front
        while monotonic_idx and prefix[j] - prefix[monotonic_idx[0]] >= target:
            best = min(best, j - monotonic_idx.popleft())

        # drop any back entries whose prefix sum is dominated by prefix[j]: they're
        # both farther away AND no smaller, so they can never win over index j later
        while monotonic_idx and prefix[monotonic_idx[-1]] >= prefix[j]:
            monotonic_idx.pop()

        monotonic_idx.append(j)

    return best if best <= n else -1

print(shortest_subarray_reaching_target([3, -1, 5, -2, 7], target=9))`,
    language: "python",
    complexity: { time: "O(n) -- each index enters and leaves the deque at most once", space: "O(n)" },
  },
  {
    id: "lc-20261105-max-profit-two-transactions-fixed-commission",
    title: "Max Profit With At Most Two Transactions and a Fixed Commission Per Trade",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given an array of daily prices, a flat commission charged once per completed round-trip transaction (not separately on the buy and the sell), and the constraint that you may complete at most two non-overlapping buy-sell transactions, return the maximum achievable profit net of commission.",
    examples: [
      {
        input: "prices = [3, 8, 1, 9, 2, 10], commission = 2",
        output: "12",
        explanation:
          "Buy at 1 (index 2), sell at 9 (index 3): net profit 9 - 1 - 2 = 6, using the first transaction slot. Buy at 2 (index 4), sell at 10 (index 5): net profit 10 - 2 - 2 = 6, using the second slot. Total net profit across both transactions: 12 -- better than any pairing that uses the day-0 price of 3 as an entry.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i], commission <= 10^4"],
    approach:
      "Extend the standard 'at most k transactions' DP with the commission charged at the moment of buying (equivalent to charging it at selling, just a bookkeeping choice -- charging it on buy keeps the recurrence simplest). Track hold[i] (best profit holding a share as part of transaction i, having already paid that transaction's buy-side commission) and cash[i] (best profit holding no share, having completed at most i transactions). Each day: hold[i] = max(hold[i] staying put, cash[i-1] - price - commission, buying now using slot i), and cash[i] = max(cash[i] staying put, hold[i] + price, selling now to complete transaction i). Because this problem fixes k=2, two explicit state pairs are enough without a general loop over k.",
    code: `def max_profit_two_transactions_commission(prices: list[int], commission: int) -> int:
    NEG_INF = float("-inf")
    hold1 = hold2 = NEG_INF
    cash0 = 0
    cash1 = cash2 = NEG_INF

    for price in prices:
        # update in an order that never reads an already-updated value THIS iteration
        new_hold1 = max(hold1, cash0 - price - commission)
        new_cash1 = max(cash1, hold1 + price)
        new_hold2 = max(hold2, cash1 - price - commission)
        new_cash2 = max(cash2, hold2 + price)
        hold1, cash1, hold2, cash2 = new_hold1, new_cash1, new_hold2, new_cash2

    return max(0, cash1, cash2)

print(max_profit_two_transactions_commission([3, 8, 1, 9, 2, 10], commission=2))
# 12 -- buy@1 sell@9 nets 6, buy@2 sell@10 nets 6, for a 12 total using both slots`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261105-gamblers-ruin-hit-probability-inventory-walk",
    title: "Gambler's Ruin: Probability a Market Maker's Inventory Hits the Upper Limit First",
    difficulty: "medium",
    topics: ["probability"],
    problem:
      "A market maker's inventory starts at i shares (integer) and moves by +1 on each incoming buy fill (probability p) or -1 on each incoming sell fill (probability 1 - p), one fill at a time, independently. The desk has a hard inventory band [0, N]: inventory is forced flat and the walk stops the moment it hits either 0 or N. Given i, N, and p, compute the probability the walk hits N (the upper limit) before it hits 0.",
    examples: [
      {
        input: "i = 3, N = 10, p = 0.5",
        output: "0.3",
        explanation:
          "With p = 0.5 (a fair, symmetric walk), the classic gambler's ruin formula reduces to the simple linear case: probability of hitting N first equals i / N = 3 / 10 = 0.3, regardless of the step-size details, because a symmetric random walk's hitting probability is exactly proportional to starting position.",
      },
    ],
    constraints: ["0 < i < N <= 10^4", "0 < p < 1"],
    approach:
      "This is the classic gambler's ruin absorption-probability problem, distinct from the EXPECTED NUMBER OF STEPS version: let q(i) be the probability of reaching N before 0 starting from i. For p != 0.5, the closed form is q(i) = (1 - (r^i)) / (1 - (r^N)), where r = (1-p)/p; for the symmetric case p = 0.5, it collapses to the simple linear q(i) = i/N (the r != 1 formula has a removable singularity exactly at p=0.5, so it must be special-cased numerically rather than evaluated directly, which would divide by zero). Deriving it: q satisfies the recurrence q(i) = p*q(i+1) + (1-p)*q(i-1) with boundary conditions q(0)=0, q(N)=1 -- a linear second-order recurrence whose characteristic equation has roots 1 and r, giving the general solution q(i) = A + B*r^i, and the boundary conditions pin down A and B.",
    code: `def prob_hit_upper_first(i: int, N: int, p: float) -> float:
    if abs(p - 0.5) < 1e-12:
        # symmetric walk: hitting probability is exactly linear in starting position
        return i / N

    r = (1 - p) / p
    # q(i) = (1 - r^i) / (1 - r^N), derived from the gambler's-ruin recurrence
    return (1 - r ** i) / (1 - r ** N)

print(round(prob_hit_upper_first(3, 10, 0.5), 4))    # 0.3 -- symmetric case
print(round(prob_hit_upper_first(3, 10, 0.55), 4))   # a slight buy-skew pulls this above 0.3
print(round(prob_hit_upper_first(3, 10, 0.45), 4))   # a slight sell-skew pulls this below 0.3`,
    language: "python",
    complexity: { time: "O(1) with the closed form (O(N) if you solve the recurrence by DP instead)", space: "O(1)" },
  },
  {
    id: "lc-20261105-fifo-position-tracker-realized-pnl",
    title: "Design a FIFO Position Tracker With Average Cost Basis and Realized P&L on Partial Closes",
    difficulty: "medium",
    topics: ["design"],
    problem:
      "Design a class PositionTracker supporting buy(ticker, price, qty) and sell(ticker, price, qty), maintaining each ticker's open lots in FIFO order (oldest shares are closed first), and get_position(ticker) returning the current net quantity held and the average cost basis of the REMAINING open lots. sell() should also return the realized P&L generated by that specific sell call, computed against the FIFO-matched lots it closes.",
    examples: [
      {
        input:
          'buy("AAPL", 100.0, 10); buy("AAPL", 110.0, 10); sell("AAPL", 130.0, 15); get_position("AAPL")',
        output: "realized P&L from sell: 400.0; remaining position: (qty=5, avg_cost=110.0)",
        explanation:
          "The sell of 15 shares closes the first lot entirely (10 shares bought at 100, profit (130-100)*10 = 300) then closes 5 shares from the second lot (bought at 110, profit (130-110)*5 = 100), for total realized P&L 400.0. The remaining open position is 5 shares still carrying the second lot's 110.0 cost basis, since FIFO always exhausts the oldest lot before touching a newer one.",
      },
    ],
    constraints: ["up to 10^5 combined calls to buy/sell/get_position", "sell qty never exceeds the current net position"],
    approach:
      "Maintain a deque of (price, qty) lots per ticker, appended on buy() (new lots always join the back, preserving arrival order) and consumed from the FRONT on sell() (oldest lot first, the FIFO rule). On each sell, walk the deque from the front: close as much of the front lot's quantity as needed (fully, if the front lot's remaining qty is <= the amount still left to sell, partially otherwise), accumulating realized P&L as (sell_price - lot_price) * qty_closed for each lot touched, and popping any lot that's fully exhausted. get_position sums remaining quantity and computes a quantity-weighted average cost directly from whatever lots are still left in the deque, which naturally reflects FIFO's effect on which cost basis survives.",
    code: `from collections import deque

class PositionTracker:
    def __init__(self) -> None:
        self._lots: dict[str, deque[list[float]]] = {}   # ticker -> deque of [price, qty]

    def buy(self, ticker: str, price: float, qty: float) -> None:
        self._lots.setdefault(ticker, deque()).append([price, qty])

    def sell(self, ticker: str, price: float, qty: float) -> float:
        lots = self._lots.get(ticker, deque())
        remaining_to_sell = qty
        realized_pnl = 0.0

        while remaining_to_sell > 0 and lots:
            lot_price, lot_qty = lots[0]
            closed_qty = min(lot_qty, remaining_to_sell)
            realized_pnl += (price - lot_price) * closed_qty
            remaining_to_sell -= closed_qty
            if closed_qty == lot_qty:
                lots.popleft()               # the oldest lot is fully exhausted
            else:
                lots[0][1] -= closed_qty     # partially close the oldest lot in place

        return realized_pnl

    def get_position(self, ticker: str) -> tuple[float, float]:
        lots = self._lots.get(ticker, deque())
        total_qty = sum(lot_qty for _, lot_qty in lots)
        if total_qty == 0:
            return 0.0, 0.0
        weighted_cost = sum(lot_price * lot_qty for lot_price, lot_qty in lots)
        return total_qty, weighted_cost / total_qty

tracker = PositionTracker()
tracker.buy("AAPL", 100.0, 10)
tracker.buy("AAPL", 110.0, 10)
realized = tracker.sell("AAPL", 130.0, 15)
print(realized)                           # 400.0
print(tracker.get_position("AAPL"))       # (5.0, 110.0)`,
    language: "python",
    complexity: { time: "O(1) amortized per call (each lot is created once, closed once)", space: "O(number of open lots)" },
  },
];
