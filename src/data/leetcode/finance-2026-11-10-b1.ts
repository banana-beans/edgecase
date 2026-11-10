import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-10
// Sliding-window median of the last k trade prices (two heaps
// with lazy deletion), max profit with at most k transactions
// (DP), greedy price-time-priority order matching across a
// buy/sell stream, gambler's-ruin probability an inventory walk
// hits a risk limit before returning flat (closed-form math),
// and a limit order book design with O(log n) add/cancel/best.
// ============================================================

export const financeBatch20261110: LeetCodeProblem[] = [
  {
    id: "lc-20261110-sliding-window-median-trade-price",
    title: "Sliding-Window Median of the Last K Trade Prices",
    difficulty: "hard",
    topics: ["heap"],
    problem:
      "Given a stream of trade prices and a window size k, for every window of the k most recent trades (starting once k trades have occurred) return the median price of that window, in order.",
    examples: [
      {
        input: "prices = [1,3,2,5,4], k = 3",
        output: "[2.0,3.0,4.0]",
        explanation:
          "Window [1,3,2] -> sorted [1,2,3] -> median 2. Window [3,2,5] -> sorted [2,3,5] -> median 3. Window [2,5,4] -> sorted [2,4,5] -> median 4.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "1 <= k <= prices.length"],
    approach:
      "Maintain two heaps splitting the current window at its median: 'small' (a max-heap, via negation) holds the lower half, 'large' (a min-heap) holds the upper half, kept balanced so small never has more than one extra element over large. Deleting the trade that falls out of the window can't be done in O(log k) directly from a heap's middle, so deletions are lazy -- a counter records which values are pending removal, and both heaps lazily pop their top whenever it matches a pending deletion, right before anything reads or rebalances them. Each new price is added to whichever heap its value belongs on, the heaps are rebalanced to restore the size invariant, and the median is read off the top of 'small' (odd k) or averaged with the top of 'large' (even k).",
    code: `import heapq
from collections import Counter

def sliding_window_median(prices: list[float], k: int) -> list[float]:
    small, large = [], []   # small: max-heap via negation; large: min-heap
    removed: Counter = Counter()
    small_sz = large_sz = 0

    def trim(heap: list[float], sign: int) -> None:
        while heap and removed[sign * heap[0]] > 0:
            removed[sign * heap[0]] -= 1
            heapq.heappop(heap)

    def add(x: float) -> None:
        nonlocal small_sz, large_sz
        if not small or x <= -small[0]:
            heapq.heappush(small, -x); small_sz += 1
        else:
            heapq.heappush(large, x); large_sz += 1

    def remove(x: float) -> None:
        nonlocal small_sz, large_sz
        removed[x] += 1
        if small and x <= -small[0]:
            small_sz -= 1
        else:
            large_sz -= 1
        trim(small, -1); trim(large, 1)

    def rebalance() -> None:
        nonlocal small_sz, large_sz
        if small_sz > large_sz + 1:
            heapq.heappush(large, -heapq.heappop(small)); small_sz -= 1; large_sz += 1
            trim(small, -1)
        elif large_sz > small_sz:
            heapq.heappush(small, -heapq.heappop(large)); large_sz -= 1; small_sz += 1
            trim(large, 1)

    medians: list[float] = []
    for i, price in enumerate(prices):
        add(price)
        rebalance()
        if i >= k:
            remove(prices[i - k])
            rebalance()
        if i >= k - 1:
            medians.append(-small[0] if k % 2 else (-small[0] + large[0]) / 2)
    return medians

print(sliding_window_median([1, 3, 2, 5, 4], k=3))
# [2.0, 3.0, 4.0]`,
    language: "python",
    complexity: { time: "O(n log k) amortized", space: "O(k)" },
  },
  {
    id: "lc-20261110-max-profit-at-most-k-transactions",
    title: "Max Profit From a Single Instrument With At Most K Round-Trip Transactions",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given a sequence of daily prices for one instrument and an integer k, you may complete at most k buy-then-sell round trips (you must sell before you can buy again), and you must be fully flat between trips. Return the maximum total profit.",
    examples: [
      {
        input: "prices = [3,2,6,5,0,3], k = 2",
        output: "7",
        explanation:
          "Buy at 2, sell at 6 (profit 4). Buy at 0, sell at 3 (profit 3). Total 7, using exactly 2 of the allowed transactions and no more profit is reachable with up to 2 round trips.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^4", "0 <= k <= 100", "0 <= prices[i] <= 10^4"],
    approach:
      "Track, for each transaction count t from 1 to k, two rolling values as you scan prices once: hold[t] (max profit if currently holding a position, having started the t-th buy) and cash[t] (max profit after completing the t-th sell, currently flat). Each day, hold[t] either keeps yesterday's hold or buys today funded by yesterday's cash[t-1] (one transaction earlier, still flat); cash[t] either keeps yesterday's cash[t] or sells today's hold[t]. The answer is cash[k]. If k is large enough that it can never bind (k >= n // 2, since each round trip needs at least 2 days), this degenerates to the unlimited-transactions case, which is cheaper to compute directly and avoids an unnecessarily large DP table.",
    code: `def max_profit_k_transactions(prices: list[int], k: int) -> int:
    n = len(prices)
    if n == 0 or k == 0:
        return 0

    if k >= n // 2:  # the cap can never actually bind -- unlimited transactions
        profit = 0
        for i in range(1, n):
            profit += max(0, prices[i] - prices[i - 1])
        return profit

    hold = [float("-inf")] * (k + 1)
    cash = [0] * (k + 1)
    for price in prices:
        for t in range(1, k + 1):
            hold[t] = max(hold[t], cash[t - 1] - price)  # keep holding, or buy using trip t-1's cash
            cash[t] = max(cash[t], hold[t] + price)       # keep flat, or sell today to close trip t
    return cash[k]

print(max_profit_k_transactions([3, 2, 6, 5, 0, 3], k=2))
# 7`,
    language: "python",
    complexity: { time: "O(n*k)", space: "O(k)" },
  },
  {
    id: "lc-20261110-price-time-priority-order-matching",
    title: "Price-Time Priority Order Matching Across a Buy/Sell Order Stream",
    difficulty: "medium",
    topics: ["heap", "design"],
    problem:
      "Given a stream of incoming limit orders, each (side, price, qty) in arrival order, match each new order against the resting opposite-side book using price-time priority: a BUY matches the lowest-priced resting SELL at or below its price; a SELL matches the highest-priced resting BUY at or above its price; among equal prices, the earliest-arrived resting order fills first. Any unfilled remainder rests in the book. Return the list of executed trades as (price, qty), in the order they occur, using the resting order's price for each fill.",
    examples: [
      {
        input: 'orders = [("BUY",100,10), ("SELL",99,4), ("SELL",101,5), ("BUY",101,3)]',
        output: "[(100,4),(101,3)]",
        explanation:
          "BUY 100x10 rests (nothing to match against yet). SELL 99x4 crosses the resting BUY@100 (99 <= 100) for a fill of 4 at the resting price 100, leaving BUY 100x6 resting. SELL 101x5 doesn't cross BUY@100 (101 > 100), so it rests. BUY 101x3 crosses the resting SELL@101 for a fill of 3 at 101, leaving SELL 101x2 resting.",
      },
    ],
    constraints: ["1 <= orders.length <= 10^5", "price and qty are positive"],
    approach:
      "Keep two heaps of resting orders: a max-heap of buys keyed by (-price, arrival_time) and a min-heap of sells keyed by (price, arrival_time), so each heap's top is exactly the price-time-priority best order on its side. For each incoming order, repeatedly peek the opposite heap's top while it crosses the incoming price and quantity remains, record a trade at the resting order's price for the smaller of the two quantities, decrement both sides, and push back any partially-filled resting order. Once nothing crosses (or the incoming order is fully filled), push any remaining incoming quantity onto its own side's heap to rest.",
    code: `import heapq

def match_orders(orders: list[tuple[str, float, int]]) -> list[tuple[float, int]]:
    buys: list[tuple[float, int, int]] = []   # (-price, time, qty)
    sells: list[tuple[float, int, int]] = []  # (price, time, qty)
    trades: list[tuple[float, int]] = []

    for t, (side, price, qty) in enumerate(orders):
        remaining = qty
        if side == "BUY":
            while remaining > 0 and sells and sells[0][0] <= price:
                s_price, s_time, s_qty = heapq.heappop(sells)
                fill = min(remaining, s_qty)
                trades.append((s_price, fill))
                remaining -= fill
                if s_qty - fill > 0:
                    heapq.heappush(sells, (s_price, s_time, s_qty - fill))
            if remaining > 0:
                heapq.heappush(buys, (-price, t, remaining))
        else:
            while remaining > 0 and buys and -buys[0][0] >= price:
                neg_b_price, b_time, b_qty = heapq.heappop(buys)
                fill = min(remaining, b_qty)
                trades.append((-neg_b_price, fill))
                remaining -= fill
                if b_qty - fill > 0:
                    heapq.heappush(buys, (neg_b_price, b_time, b_qty - fill))
            if remaining > 0:
                heapq.heappush(sells, (price, t, remaining))
    return trades

print(match_orders([("BUY", 100, 10), ("SELL", 99, 4), ("SELL", 101, 5), ("BUY", 101, 3)]))
# [(100, 4), (101, 3)]`,
    language: "python",
    complexity: { time: "O(n log n)", space: "O(n)" },
  },
  {
    id: "lc-20261110-gamblers-ruin-inventory-risk-limit",
    title: "Probability a Market Maker's Inventory Hits a Risk Limit Before Returning Flat",
    difficulty: "medium",
    topics: ["probability", "math"],
    problem:
      "A market maker's inventory starts at a position start, with absorbing boundaries at 0 (flat) and limit (the desk's hard risk limit), where limit > start > 0. Each tick, inventory moves +1 with probability p or -1 with probability (1-p). Return the probability inventory hits limit before it returns to 0.",
    examples: [
      {
        input: "start = 2, limit = 5, p = 0.6",
        output: "0.6398",
        explanation:
          "This is the classic gambler's-ruin setup with an asymmetric walk (p != 0.5): the closed-form absorption probability plugs directly to about 0.6398, far higher than the 2/5 = 0.4 you'd get from the symmetric-walk shortcut, because the upward drift from p > 0.5 meaningfully favors reaching the limit first.",
      },
    ],
    constraints: ["0 < start < limit", "0 < p < 1"],
    approach:
      "This is exactly the gambler's-ruin problem: a random walk with two absorbing barriers. When p == 0.5 (no drift), the probability of hitting the upper barrier first is simply start / limit, a clean linear result from the walk's symmetry. When p != 0.5, the closed-form uses the ratio r = (1-p)/p: the probability of reaching limit before 0 is (1 - r^start) / (1 - r^limit). Deriving it comes from setting up the first-step recursion P(i) = p*P(i+1) + (1-p)*P(i-1) with boundary conditions P(0)=0, P(limit)=1, and solving the resulting linear recurrence -- but the quant-interview answer is knowing the two closed forms (symmetric and asymmetric) and which one to reach for.",
    code: `def prob_hit_limit_before_flat(start: int, limit: int, p: float) -> float:
    if p == 0.5:
        return start / limit  # symmetric walk: linear in starting position

    q = 1 - p
    r = q / p
    # closed-form gambler's-ruin absorption probability at the upper barrier
    return (1 - r ** start) / (1 - r ** limit)

print(round(prob_hit_limit_before_flat(2, 5, 0.6), 4))
# 0.6398
print(round(prob_hit_limit_before_flat(3, 10, 0.5), 4))
# 0.3 -- the symmetric case reduces to start / limit`,
    language: "python",
    complexity: { time: "O(1)", space: "O(1)" },
  },
  {
    id: "lc-20261110-design-limit-order-book-best-bid-ask",
    title: "Design: Limit Order Book With O(log n) Add, Cancel, and Best Bid/Ask",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design an OrderBook supporting add_order(order_id, side, price) to rest a new limit order, cancel_order(order_id) to remove a previously added order, and best_bid() / best_ask() to return the current highest resting buy price / lowest resting sell price (or None if that side is empty). All operations should run in O(log n).",
    examples: [
      {
        input:
          'add_order(1,"BUY",100); add_order(2,"BUY",102); add_order(3,"SELL",105); cancel_order(2); best_bid(); best_ask()',
        output: "best_bid() = 100, best_ask() = 105",
        explanation:
          "After order 2 (the best bid at 102) is cancelled, the best remaining bid falls back to order 1 at 100; the best ask is unaffected at 105.",
      },
    ],
    constraints: ["order_id values are unique", "at most 10^5 total calls"],
    approach:
      "A heap can't delete an arbitrary interior element in O(log n) directly, so cancellation is handled lazily: cancel_order just flips a flag on that order's record in O(1), without touching either heap. Each heap (a max-heap of buy prices via negation, a min-heap of sell prices) may therefore have stale entries sitting at its top; best_bid()/best_ask() first pop off any entries at the top whose order has been cancelled (or superseded), which is amortized O(log n) total across the order book's lifetime because each entry is popped at most once, then return the first live price found.",
    code: `import heapq

class OrderBook:
    def __init__(self) -> None:
        self.buy_heap: list[tuple[float, int]] = []   # (-price, order_id)
        self.sell_heap: list[tuple[float, int]] = []  # (price, order_id)
        self.orders: dict[int, list] = {}              # order_id -> [side, price, active]

    def add_order(self, order_id: int, side: str, price: float) -> None:
        self.orders[order_id] = [side, price, True]
        if side == "BUY":
            heapq.heappush(self.buy_heap, (-price, order_id))
        else:
            heapq.heappush(self.sell_heap, (price, order_id))

    def cancel_order(self, order_id: int) -> None:
        if order_id in self.orders:
            self.orders[order_id][2] = False  # lazy delete -- heap cleans it up later

    def _clean(self, heap: list) -> None:
        while heap:
            _, order_id = heap[0]
            info = self.orders.get(order_id)
            if info is None or not info[2]:
                heapq.heappop(heap)
            else:
                break

    def best_bid(self) -> float | None:
        self._clean(self.buy_heap)
        return -self.buy_heap[0][0] if self.buy_heap else None

    def best_ask(self) -> float | None:
        self._clean(self.sell_heap)
        return self.sell_heap[0][0] if self.sell_heap else None

ob = OrderBook()
ob.add_order(1, "BUY", 100)
ob.add_order(2, "BUY", 102)
ob.add_order(3, "SELL", 105)
ob.cancel_order(2)
print(ob.best_bid(), ob.best_ask())
# 100 105`,
    language: "python",
    complexity: { time: "O(log n) amortized per op", space: "O(n)" },
  },
];
