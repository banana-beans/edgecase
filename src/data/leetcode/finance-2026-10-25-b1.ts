import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-25
// K-way merge of sorted trade feeds (heap), shortest tick window
// covering every required venue (sliding window), max profit from
// two transactions with a per-trade fee (DP), expected trades until
// a winning streak of length k (probability/Markov), and a
// price-time-priority limit order book matching engine (design).
// ============================================================

export const financeBatch20261025: LeetCodeProblem[] = [
  {
    id: "lc-20261025-merge-k-sorted-trade-feeds",
    title: "Merge K Sorted Trade Feeds Into One Timestamp-Ordered Stream",
    difficulty: "medium",
    topics: ["heap", "k-way-merge"],
    problem:
      "You receive trade prints from k separate exchange feeds, each already sorted by timestamp internally. Merge all k feeds into one list sorted by timestamp.",
    examples: [
      {
        input: "feeds = [[(1,'A'),(5,'A')], [(2,'B'),(3,'B')], [(4,'C')]]",
        output: "[(1,'A'), (2,'B'), (3,'B'), (4,'C'), (5,'A')]",
        explanation:
          "Each feed is internally sorted; merging by timestamp across all three gives one fully-ordered stream without ever re-sorting the whole thing from scratch.",
      },
    ],
    constraints: ["1 <= k <= 10^4", "total elements across all feeds <= 10^6"],
    approach:
      "This is the standard k-way merge pattern: maintain a min-heap holding at most one candidate element per feed -- the current front of that feed -- keyed by timestamp, with the feed's own index as a tiebreaker. Pop the smallest timestamp, append it to the output, then push that same feed's NEXT element (if any) back onto the heap. Since the heap never holds more than k elements at once, this runs in O(n log k) total instead of the O(n log n) a full re-sort of all n elements would cost.",
    code: `import heapq

def merge_k_trade_feeds(feeds: list[list[tuple[int, str]]]) -> list[tuple[int, str]]:
    # heap entries: (timestamp, feed_index, position_in_feed) -- feed_index breaks
    # ties deterministically and tells us where to pull this feed's next element from
    heap: list[tuple[int, int, int]] = []
    for feed_idx, feed in enumerate(feeds):
        if feed:
            ts, _ = feed[0]
            heapq.heappush(heap, (ts, feed_idx, 0))

    merged: list[tuple[int, str]] = []
    while heap:
        ts, feed_idx, pos = heapq.heappop(heap)
        merged.append(feeds[feed_idx][pos])
        if pos + 1 < len(feeds[feed_idx]):
            next_ts, _ = feeds[feed_idx][pos + 1]
            heapq.heappush(heap, (next_ts, feed_idx, pos + 1))

    return merged

feeds = [[(1, "A"), (5, "A")], [(2, "B"), (3, "B")], [(4, "C")]]
print(merge_k_trade_feeds(feeds))
# [(1, 'A'), (2, 'B'), (3, 'B'), (4, 'C'), (5, 'A')]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
    leetcodeNumber: 23,
  },
  {
    id: "lc-20261025-min-window-all-required-venues",
    title: "Smallest Window of Ticks Containing a Trade From Every Required Venue",
    difficulty: "medium",
    topics: ["sliding-window", "hash-map"],
    problem:
      "Given a chronological list of venue codes (one per tick) and a set of required venues, return the length of the shortest contiguous window that contains at least one tick from every required venue. Return -1 if no such window exists.",
    examples: [
      {
        input:
          "ticks = ['NYSE','ARCA','NYSE','BATS','ARCA'], required = {'NYSE','BATS'}",
        output: "2",
        explanation:
          "ticks[2:4] = ['NYSE','BATS'] covers both required venues in a window of length 2 -- no shorter window does.",
      },
    ],
    constraints: ["1 <= ticks.length <= 10^5", "1 <= required.size <= 20"],
    approach:
      "This is the minimum-window-substring pattern applied to venues instead of characters. Grow a right pointer, tracking how many of the required venues currently appear at least once inside the window (have). The moment have equals the number of required venues, the window is valid -- shrink from the left as far as possible while it stays valid, recording the shortest length seen, then keep advancing right. Each tick enters and leaves the window exactly once, so the whole scan is O(n) regardless of how the required venues are distributed.",
    code: `def min_window_all_venues(venues: list[str], required: set[str]) -> int:
    need = len(required)
    counts: dict[str, int] = {}
    have = 0
    left = 0
    best = float("inf")

    for right, v in enumerate(venues):
        if v in required:
            counts[v] = counts.get(v, 0) + 1
            if counts[v] == 1:
                have += 1   # this required venue just appeared in the window for the first time

        # shrink from the left while the window still covers every required venue
        while have == need:
            best = min(best, right - left + 1)
            left_v = venues[left]
            if left_v in required:
                counts[left_v] -= 1
                if counts[left_v] == 0:
                    have -= 1
            left += 1

    return -1 if best == float("inf") else best

ticks = ["NYSE", "ARCA", "NYSE", "BATS", "ARCA"]
print(min_window_all_venues(ticks, {"NYSE", "BATS"}))
# 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(required)" },
    leetcodeNumber: 76,
  },
  {
    id: "lc-20261025-max-profit-two-transactions-with-fee",
    title: "Max Profit From At Most Two Transactions With a Flat Fee Per Trade",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given a daily price array and a flat fee charged once per completed (buy, sell) pair, choose at most two non-overlapping transactions to maximize total profit after fees.",
    examples: [
      {
        input: "prices = [1,5,3,8], fee = 1",
        output: "7",
        explanation:
          "Buy at 1, sell at 5 (profit 4, minus 1 fee = 3), then buy at 3, sell at 8 (profit 5, minus 1 fee = 4). Total: 3 + 4 = 7, the best achievable with at most two trades.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= fee <= 10^4"],
    approach:
      "Track four running best-profit states across a single left-to-right pass: buy1 (best running profit after only a first buy), sell1 (after closing the first trade), buy2 (after a second buy, funded out of sell1's proceeds), sell2 (after closing the second trade). The fee is deducted exactly once per completed trade, at the sell step, never at the buy step -- deducting it twice (once per leg) or at the wrong step is the classic bug in this DP. Each state only ever needs the previous state's values, so the whole thing runs in a single O(n) pass with O(1) extra memory.",
    code: `def max_profit_two_transactions_with_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    buy1 = buy2 = -prices[0]
    sell1 = sell2 = 0

    for p in prices[1:]:
        buy1 = max(buy1, -p)             # best running cost basis for the first open position
        sell1 = max(sell1, buy1 + p - fee)   # fee charged once, at the sell
        buy2 = max(buy2, sell1 - p)       # second buy funded out of the first trade's proceeds
        sell2 = max(sell2, buy2 + p - fee)

    return sell2

print(max_profit_two_transactions_with_fee([1, 5, 3, 8], fee=1))
# 7`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 123,
  },
  {
    id: "lc-20261025-expected-trades-winning-streak-k",
    title: "Expected Number of Trades Until a Winning Streak of Length K",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "Each trade independently wins with probability p. Compute the expected number of trades needed to observe the first streak of k consecutive wins.",
    examples: [
      {
        input: "p = 0.5, k = 2",
        output: "6.0",
        explanation:
          "This is the classic 'expected number of fair coin flips to see two heads in a row' result -- the probability-weighted cost of every failed streak attempt compounds to exactly 6.",
      },
    ],
    constraints: ["0 < p < 1", "1 <= k <= 60"],
    approach:
      "Condition on how a streak attempt ends: with probability p the next trade extends the current streak, and with probability 1-p it resets entirely, wiping out all progress made so far. Working through the resulting recurrence (Feller's classic run-length result) gives a clean closed form: E = 1/p + 1/p^2 + ... + 1/p^k -- each additional required consecutive win multiplies the expected cost of eventually failing the attempt by another factor of 1/p. A short Monte Carlo simulation is worth running alongside the formula to sanity-check it, since run-length expectations are easy to get subtly wrong.",
    code: `def expected_trades_for_win_streak(p: float, k: int) -> float:
    # closed form (Feller): E = 1/p + 1/p^2 + ... + 1/p^k
    return sum((1 / p) ** i for i in range(1, k + 1))

print(round(expected_trades_for_win_streak(p=0.5, k=2), 3))
# 6.0 -- the classic "expected flips to see two heads in a row" result

import random

def simulate_expected_trades(p: float, k: int, trials: int = 20000) -> float:
    total = 0
    for _ in range(trials):
        streak = 0
        trades = 0
        while streak < k:
            trades += 1
            streak = streak + 1 if random.random() < p else 0
        total += trades
    return total / trials

print(round(simulate_expected_trades(0.5, 2), 2))   # converges toward 6.0, confirming the formula`,
    language: "python",
    complexity: { time: "O(k)", space: "O(1)" },
  },
  {
    id: "lc-20261025-design-limit-order-book-matching-engine",
    title: "Design a Price-Time-Priority Limit Order Book Matching Engine",
    difficulty: "hard",
    topics: ["design", "heap", "hash-map"],
    problem:
      "Design a class OrderBook with add_order(order_id, side, price, qty), which matches the incoming order against resting opposite-side orders that cross its price, in price-time priority, and returns the resulting fills; and cancel_order(order_id), which removes a resting order. Partial fills must preserve a resting order's original time priority.",
    examples: [
      {
        input:
          "add_order(1,'sell',101.0,100); add_order(2,'buy',100.0,50); add_order(3,'buy',102.0,30)",
        output: "first two calls return []; the third returns [(3, 1, 30, 101.0)]",
        explanation:
          "Order 2's bid of 100.0 doesn't cross order 1's ask of 101.0, so it rests. Order 3's bid of 102.0 does cross, filling 30 shares at the RESTING order's price of 101.0 (price-time priority: the resting order's price wins, not the aggressor's).",
      },
    ],
    constraints: ["up to 10^5 calls to add_order/cancel_order"],
    approach:
      "Two heaps hold resting orders: bids as a max-heap (store price negated so the lowest key is the highest price) and asks as a min-heap (store price as-is). Each heap entry also carries a monotonic sequence number so ties at the same price resolve by arrival order. On an incoming order, repeatedly peek the opposite book's best price; if it crosses the incoming price, pop it, match the smaller of the two remaining quantities, and if the resting order isn't fully filled push it back with its ORIGINAL sequence number -- preserving time priority instead of sending it to the back of the queue. A cancel just marks an order_id dead; its heap entry is skipped and dropped the next time it's peeked (lazy deletion), avoiding an O(n) scan through the heap on every cancel.",
    code: `import heapq

class OrderBook:
    def __init__(self) -> None:
        self._seq = 0
        self._bids: list[tuple[float, int, int]] = []   # (-price, seq, order_id) -- highest price first
        self._asks: list[tuple[float, int, int]] = []   # (price, seq, order_id) -- lowest price first
        self._remaining: dict[int, int] = {}
        self._canceled: set[int] = set()

    def _peek_live(self, heap: list):
        # drop canceled / already-exhausted resting orders lazily, then peek the real best
        while heap:
            key, seq, oid = heap[0]
            if oid in self._canceled or self._remaining.get(oid, 0) <= 0:
                heapq.heappop(heap)
                continue
            return key, seq, oid
        return None

    def add_order(self, order_id: int, side: str, price: float, qty: int):
        fills = []   # (buy_id, sell_id, matched_qty, fill_price)
        self._remaining[order_id] = qty
        opposite = self._asks if side == "buy" else self._bids

        while self._remaining[order_id] > 0:
            top = self._peek_live(opposite)
            if top is None:
                break
            key, seq, resting_id = top
            resting_price = key if side == "buy" else -key   # asks stored raw, bids stored negated
            crosses = resting_price <= price if side == "buy" else resting_price >= price
            if not crosses:
                break

            heapq.heappop(opposite)
            matched = min(self._remaining[order_id], self._remaining[resting_id])
            self._remaining[order_id] -= matched
            self._remaining[resting_id] -= matched
            buy_id, sell_id = (order_id, resting_id) if side == "buy" else (resting_id, order_id)
            fills.append((buy_id, sell_id, matched, resting_price))   # resting order's price wins

            if self._remaining[resting_id] > 0:
                heapq.heappush(opposite, (key, seq, resting_id))   # partial fill keeps its time priority

        if self._remaining[order_id] > 0:
            self._seq += 1
            own_book = self._bids if side == "buy" else self._asks
            key = -price if side == "buy" else price
            heapq.heappush(own_book, (key, self._seq, order_id))

        return fills

    def cancel_order(self, order_id: int) -> None:
        self._canceled.add(order_id)

book = OrderBook()
print(book.add_order(1, "sell", 101.0, 100))   # []
print(book.add_order(2, "buy", 100.0, 50))     # []
print(book.add_order(3, "buy", 102.0, 30))     # [(3, 1, 30, 101.0)]
book.cancel_order(2)
print(book.add_order(4, "sell", 99.0, 10))     # [] -- order 2 was canceled, so nothing crosses`,
    language: "python",
    complexity: {
      time: "O(log n) amortized per order (heap push/pop); a cancel is O(1) and its cleanup is lazy",
      space: "O(n) for resting orders and the remaining-quantity map",
    },
  },
];
