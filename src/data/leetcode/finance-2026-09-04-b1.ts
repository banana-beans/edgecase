import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-04
// A k-way heap merge of sorted trade feeds, a monotonic-deque
// sliding window bounding intraday volatility, the classic
// at-most-K-transactions stock DP, gambler's ruin for a
// profit-target-vs-stop-out probability, and a two-sided
// price-time-priority limit order book matching engine.
// ============================================================

export const financeBatch20260904: LeetCodeProblem[] = [
  {
    id: "lc-merge-k-sorted-trade-streams",
    title: "Merge K Sorted Trade Print Streams by Timestamp",
    difficulty: "medium",
    topics: ["heap", "merge"],
    problem:
      "You receive trade prints from K different exchange feeds. Each feed's own list of (timestamp, price) prints is already sorted by timestamp ascending, but the feeds arrive as separate lists. Merge all K feeds into a single list of trades sorted by timestamp ascending across the whole market.",
    examples: [
      {
        input:
          "feeds = [[(1,100),(4,101)], [(2,99),(3,102),(9,103)], [(5,104)]]",
        output: "[(1,100),(2,99),(3,102),(4,101),(5,104),(9,103)]",
        explanation:
          "Each of the 3 feeds is individually sorted by timestamp; the merged output interleaves all of them into one globally sorted-by-timestamp stream.",
      },
    ],
    constraints: [
      "1 <= K <= 500",
      "0 <= trades per feed <= 10^4",
      "each feed's own timestamps are strictly increasing",
    ],
    approach:
      "This is the classic k-way merge, and a min-heap is the right structure because at any moment the next globally-earliest trade must be the earliest still-unconsumed trade from one of the K feeds -- exactly what a heap keyed on timestamp gives you in O(log K) per pop. Seed the heap with the first trade from each nonempty feed, tagged with (timestamp, feed_index, position_in_feed). Repeatedly pop the minimum, append it to the output, and if that feed has a next trade, push it in -- since each feed is internally sorted, the next element from that feed is now the only new candidate that could be globally next. This does N total pushes and pops (N = total trades across all feeds), each O(log K), for O(N log K) overall -- far better than concatenating everything and sorting, which would cost O(N log N) and ignores the free sortedness already present within each feed.",
    code: `import heapq

def merge_trade_streams(feeds: list[list[tuple[int, float]]]) -> list[tuple[int, float]]:
    heap = []  # (timestamp, feed_idx, pos_in_feed) -- price is looked up, not stored,
               # so the heap never compares two trades on price if timestamps tie
    for feed_idx, feed in enumerate(feeds):
        if feed:
            ts, price = feed[0]
            heapq.heappush(heap, (ts, feed_idx, 0))

    merged: list[tuple[int, float]] = []
    while heap:
        ts, feed_idx, pos = heapq.heappop(heap)
        merged.append((ts, feeds[feed_idx][pos][1]))

        # only this feed's NEXT trade could possibly be the new global minimum --
        # every other feed's frontier trade is already sitting in the heap
        next_pos = pos + 1
        if next_pos < len(feeds[feed_idx]):
            next_ts, _ = feeds[feed_idx][next_pos]
            heapq.heappush(heap, (next_ts, feed_idx, next_pos))

    return merged

feeds = [[(1, 100.0), (4, 101.0)], [(2, 99.0), (3, 102.0), (9, 103.0)], [(5, 104.0)]]
print(merge_trade_streams(feeds))`,
    language: "python",
    complexity: { time: "O(N log K)", space: "O(K)" },
  },
  {
    id: "lc-longest-window-volatility-range-cap",
    title: "Longest Window of Consecutive Prices With Range Under a Volatility Cap",
    difficulty: "medium",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given a chronological array of prices and a cap, return the length of the longest contiguous window where (max price in the window - min price in the window) does not exceed cap. This is a coarse proxy for 'how long can I hold a position before its intrabar range trips a volatility limit.'",
    examples: [
      {
        input: "prices=[8,2,4,7], cap=3",
        output: "2",
        explanation:
          "Window [4,7] (range 3) and [2,4] (range 2) both qualify at length 2; no length-3 window keeps its range within 3 (e.g. [2,4,7] has range 5).",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^9", "0 <= cap <= 10^9"],
    approach:
      "Track the window's current max and min with two monotonic deques instead of recomputing them from scratch on every shrink or expand. The max-deque stays strictly decreasing front-to-back (pop off any trailing entries smaller than the new price before pushing it, since they can never be the max again while the new, larger price is still in the window); the min-deque is the mirror, strictly increasing. Both deques' front element is always the current window's max (resp. min) in O(1). Expand right, pushing into both deques; whenever front-of-max minus front-of-min exceeds cap, shrink from the left, popping any deque fronts whose index has fallen out of the window. Each index enters and leaves each deque at most once, so the whole scan is O(n) despite the nested-looking while loops -- the same amortized argument as a plain sliding window, just with two deques carrying the running max/min instead of a running sum.",
    code: `from collections import deque

def longest_window_under_range_cap(prices: list[int], cap: int) -> int:
    max_dq: deque[int] = deque()  # indices, prices strictly decreasing front-to-back
    min_dq: deque[int] = deque()  # indices, prices strictly increasing front-to-back
    left = 0
    best_len = 0

    for right, price in enumerate(prices):
        while max_dq and prices[max_dq[-1]] <= price:
            max_dq.pop()
        max_dq.append(right)

        while min_dq and prices[min_dq[-1]] >= price:
            min_dq.pop()
        min_dq.append(right)

        # shrink while the window's range exceeds the cap
        while prices[max_dq[0]] - prices[min_dq[0]] > cap:
            if max_dq[0] == left:
                max_dq.popleft()
            if min_dq[0] == left:
                min_dq.popleft()
            left += 1

        best_len = max(best_len, right - left + 1)

    return best_len

print(longest_window_under_range_cap([8, 2, 4, 7], cap=3))   # 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-max-profit-k-round-trips",
    title: "Maximum Profit With At Most K Round-Trip Trades",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices and an integer K -- a hard cap on the number of round-trip (buy-then-sell) trades a risk desk allows, imposed independently of unlimited-transaction rules -- find the maximum achievable profit, never holding more than one share at a time.",
    examples: [
      {
        input: "prices=[3,2,6,5,0,3], k=2",
        output: "7",
        explanation:
          "Buy at 2, sell at 6 (profit 4), then buy at 0, sell at 3 (profit 3). Two transactions, total profit 7, and no plan using at most 2 round trips beats it.",
      },
    ],
    constraints: ["1 <= prices.length <= 1000", "0 <= k <= 100", "0 <= prices[i] <= 1000"],
    approach:
      "Track hold[j] and cash[j] for each transaction count j from 1..K, where hold[j] is the best P&L achievable having bought into the j-th position (still holding), and cash[j] is the best P&L achievable having completed exactly j round trips and currently flat. Transitions per day: hold[j] = max(hold[j], cash[j-1] - price) -- keep the j-th position, or open it today funded from having just completed the (j-1)-th round trip; cash[j] = max(cash[j], hold[j] + price) -- stay flat, or close the j-th position today. Iterating j from 1 up to K each day and initializing cash[0] = 0, hold[*] = -infinity gives an O(n*k) DP. The one edge case worth handling explicitly: if k >= n/2, there's no meaningful cap at all (you can't complete more than n/2 round trips in n days anyway), so it degenerates to the unlimited-transactions greedy of summing every positive day-over-day gain, which avoids blowing up the DP table for a large k on a short price history.",
    code: `def max_profit_k_transactions(prices: list[int], k: int) -> int:
    n = len(prices)
    if n < 2 or k == 0:
        return 0

    # k >= n // 2: capped no differently than unlimited transactions --
    # collapse to the O(n) greedy instead of an oversized DP table
    if k >= n // 2:
        return sum(max(0, prices[i] - prices[i - 1]) for i in range(1, n))

    NEG_INF = float("-inf")
    hold = [NEG_INF] * (k + 1)
    cash = [0] * (k + 1)

    for price in prices:
        for j in range(1, k + 1):
            hold[j] = max(hold[j], cash[j - 1] - price)
            cash[j] = max(cash[j], hold[j] + price)

    return cash[k]

print(max_profit_k_transactions([3, 2, 6, 5, 0, 3], k=2))   # 7`,
    language: "python",
    complexity: { time: "O(n*k)", space: "O(k)" },
  },
  {
    id: "lc-profit-target-before-stopout",
    title: "Probability of Hitting a Profit Target Before a Stop-Out",
    difficulty: "medium",
    topics: ["probability", "dynamic-programming"],
    problem:
      "A trader starts with i units of risk capital. Each independent trade wins +1 unit with probability p or loses -1 unit with probability 1-p. Trading stops the moment capital hits 0 (stopped out) or hits a target N (profit target reached). Given i, N, and p, compute the probability the trader reaches the target before being stopped out.",
    examples: [
      {
        input: "i=4, N=10, p=0.5",
        output: "0.4",
        explanation:
          "With fair odds (p=0.5), the classic gambler's ruin result reduces to the linear i/N = 4/10 = 0.4 -- capital position alone determines the odds when there's no edge either way.",
      },
    ],
    constraints: ["0 <= i <= N", "1 <= N <= 10^4", "0 < p < 1"],
    approach:
      "This is the gambler's ruin problem, and it has a closed form rather than needing a full DP at query time. Let q = 1-p. If p != 0.5, the probability of reaching N before 0 starting from i is (1 - (q/p)^i) / (1 - (q/p)^N); if p == 0.5, that formula is a 0/0 indeterminate form and the limiting result is simply i/N. The derivation comes from setting up P(i) = p*P(i+1) + q*P(i-1) with boundary conditions P(0)=0, P(N)=1, and solving the resulting linear recurrence -- worth being able to state that setup out loud even if you don't rederive the closed form live. For validation (or if p varies with capital level, breaking the closed form's assumptions), a straightforward DP solving the same linear system numerically via Gauss-Seidel-style iteration or direct linear algebra is the fallback, useful to mention even though the closed form is the answer an interviewer wants for the stated i.i.d.-p version.",
    code: `def prob_hit_target_first(i: int, N: int, p: float) -> float:
    if i <= 0:
        return 0.0
    if i >= N:
        return 1.0

    q = 1 - p
    if abs(p - 0.5) < 1e-12:
        return i / N   # the p=0.5 case is the limiting value of the general formula

    ratio = q / p
    return (1 - ratio ** i) / (1 - ratio ** N)

print(round(prob_hit_target_first(i=4, N=10, p=0.5), 4))     # 0.4
print(round(prob_hit_target_first(i=4, N=10, p=0.55), 4))    # > 0.4 -- a small edge compounds fast
print(round(prob_hit_target_first(i=4, N=10, p=0.45), 4))    # < 0.4 -- a small deficit compounds too`,
    language: "python",
    complexity: { time: "O(1) per query with the closed form", space: "O(1)" },
  },
  {
    id: "lc-design-limit-order-book-matcher",
    title: "Design a Price-Time Priority Limit Order Book Matching Engine",
    difficulty: "hard",
    topics: ["design", "heap", "order-book"],
    problem:
      "Design a single-symbol limit order book supporting add_order(side, price, qty, order_id), which attempts to match the incoming order against resting orders on the opposite side using price-time priority -- best price first, and FIFO among orders tied at the same price -- producing a list of fills, then rests any unfilled remainder in the book at its price. Also support best_bid() and best_ask(), each returning the best resting price on that side (or None if empty).",
    examples: [
      {
        input:
          "add_order('buy',100,10,'o1'); add_order('sell',99,4,'o2'); best_bid(); best_ask()",
        output: "fills=[('o2','o1',4,99)], best_bid=100, best_ask=None",
        explanation:
          "The resting buy at 100 (o1, 10 shares) crosses the incoming sell at 99, since 99 <= 100. They trade 4 shares at the resting order's price of 99 (the earlier-priority side's price is what the trade prints at). o1 has 6 shares left resting at 100; o2 is fully filled, so best_ask is now empty.",
      },
    ],
    constraints: [
      "1 <= number of calls <= 10^5",
      "0 < price, qty <= 10^9",
      "side is 'buy' or 'sell'",
    ],
    approach:
      "Keep two price->deque maps, bid_levels and ask_levels, each deque holding (order_id, remaining_qty) in arrival order for FIFO at that price -- and two heaps of active price levels for O(log n) access to the best price: a max-heap (negated) of bid prices, a min-heap of ask prices. Heaps use lazy deletion: a price only gets removed from bid_levels/ask_levels once its deque empties, and a stale heap entry is simply skipped if its level is no longer in the map when popped, rather than trying to remove it from the middle of the heap. On add_order, walk the opposite side's book while the incoming order still has quantity and the best opposite price crosses (incoming buy price >= best ask, or incoming sell price <= best bid): trade against the front of that price level's deque (FIFO), popping it once exhausted and removing the level from the heap-backed structure once its deque is empty. Any quantity left over once nothing crosses gets appended to its own side's deque at its price. This gives O(log n) amortized per matching step (heap operations dominate) and O(1) for best_bid/best_ask off the top of each heap, skipping stale entries as encountered.",
    code: `import heapq
from collections import deque, defaultdict

class OrderBook:
    def __init__(self):
        self.bid_levels: dict[float, deque] = defaultdict(deque)  # price -> [(id, qty), ...]
        self.ask_levels: dict[float, deque] = defaultdict(deque)
        self.bid_heap: list[float] = []   # negated prices -- max-heap via heapq's min-heap
        self.ask_heap: list[float] = []   # plain min-heap

    def _best_bid_price(self) -> float | None:
        while self.bid_heap and -self.bid_heap[0] not in self.bid_levels:
            heapq.heappop(self.bid_heap)   # stale entry, level already emptied out
        return -self.bid_heap[0] if self.bid_heap else None

    def _best_ask_price(self) -> float | None:
        while self.ask_heap and self.ask_heap[0] not in self.ask_levels:
            heapq.heappop(self.ask_heap)
        return self.ask_heap[0] if self.ask_heap else None

    def best_bid(self) -> float | None:
        return self._best_bid_price()

    def best_ask(self) -> float | None:
        return self._best_ask_price()

    def add_order(self, side: str, price: float, qty: float, order_id: str):
        fills = []
        if side == "buy":
            while qty > 0 and (best := self._best_ask_price()) is not None and price >= best:
                level = self.ask_levels[best]
                resting_id, resting_qty = level[0]
                traded = min(qty, resting_qty)
                fills.append((resting_id, order_id, traded, best))
                qty -= traded
                resting_qty -= traded
                if resting_qty == 0:
                    level.popleft()
                    if not level:
                        del self.ask_levels[best]
                else:
                    level[0] = (resting_id, resting_qty)
            if qty > 0:
                self.bid_levels[price].append((order_id, qty))
                heapq.heappush(self.bid_heap, -price)
        else:
            while qty > 0 and (best := self._best_bid_price()) is not None and price <= best:
                level = self.bid_levels[best]
                resting_id, resting_qty = level[0]
                traded = min(qty, resting_qty)
                fills.append((resting_id, order_id, traded, best))
                qty -= traded
                resting_qty -= traded
                if resting_qty == 0:
                    level.popleft()
                    if not level:
                        del self.bid_levels[best]
                else:
                    level[0] = (resting_id, resting_qty)
            if qty > 0:
                self.ask_levels[price].append((order_id, qty))
                heapq.heappush(self.ask_heap, price)
        return fills

book = OrderBook()
book.add_order("buy", 100, 10, "o1")
print(book.add_order("sell", 99, 4, "o2"))   # [('o2', 'o1', 4, 99)]
print(book.best_bid(), book.best_ask())      # 100 None`,
    language: "python",
    complexity: { time: "O(log n) amortized per matching step", space: "O(n)" },
  },
];
