import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-29
// K-way merge of chronological trade-print streams from
// different venues (heap), smallest window of trades reaching a
// target traded volume (sliding window), max profit with at most
// K round-trip trades (DP), expected number of trades until K
// consecutive wins for signal confirmation (Markov chain /
// expected hitting time), and a level-2 order book supporting
// best bid/ask with lazy-deleted cancels (design).
// ============================================================

export const financeBatch20261029: LeetCodeProblem[] = [
  {
    id: "lc-20261029-k-way-merge-trade-streams",
    title: "Merge K Chronological Trade-Print Streams Into One Ordered Stream",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given k separate streams of trade prints (each already sorted by timestamp) reporting the same symbol from k different venues, each stream a list of (timestamp, price) tuples, merge all k streams into a single list sorted by timestamp.",
    examples: [
      {
        input: "streams = [[(1,10),(5,11)], [(2,10.5),(3,10.8)], [(4,10.9)]]",
        output: "[(1,10),(2,10.5),(3,10.8),(4,10.9),(5,11)]",
        explanation:
          "Each input stream is individually sorted by timestamp; the merged output interleaves all three streams into one globally timestamp-sorted sequence.",
      },
    ],
    constraints: [
      "1 <= number of streams <= 100",
      "0 <= total prints across all streams <= 10^4",
      "each individual stream is already sorted by timestamp",
    ],
    approach:
      "Maintain a min-heap holding exactly one candidate entry per currently-active stream: (timestamp, stream_index, position_in_stream). Repeatedly pop the globally smallest timestamp, append it to the output, and if that stream has a next element, push it in as the new candidate for that stream. Since the heap never holds more than k entries at once, each of the n total prints is pushed and popped exactly once, giving O(n log k) overall instead of concatenating everything and re-sorting from scratch.",
    code: `import heapq

def merge_trade_streams(streams: list[list[tuple[int, float]]]) -> list[tuple[int, float]]:
    heap: list[tuple[int, int, int]] = []   # (timestamp, stream_idx, position)
    for stream_idx, stream in enumerate(streams):
        if stream:
            heap.append((stream[0][0], stream_idx, 0))
    heapq.heapify(heap)

    merged: list[tuple[int, float]] = []
    while heap:
        ts, stream_idx, pos = heapq.heappop(heap)
        merged.append(streams[stream_idx][pos])

        next_pos = pos + 1
        if next_pos < len(streams[stream_idx]):
            next_ts = streams[stream_idx][next_pos][0]
            heapq.heappush(heap, (next_ts, stream_idx, next_pos))

    return merged

streams = [[(1, 10.0), (5, 11.0)], [(2, 10.5), (3, 10.8)], [(4, 10.9)]]
print(merge_trade_streams(streams))
# [(1, 10.0), (2, 10.5), (3, 10.8), (4, 10.9), (5, 11.0)]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-20261029-min-window-volume-target",
    title: "Smallest Contiguous Window of Trades Whose Total Volume Reaches a Target",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given an array of trade sizes (positive integers, in print order) and an integer target, return the length of the smallest contiguous window of consecutive trades whose sizes sum to at least target, or 0 if no such window exists.",
    examples: [
      {
        input: "sizes = [100,50,200,30,40], target = 210",
        output: "2",
        explanation:
          "The window [50,200] (indices 1-2) sums to 250 >= 210, and so does [200,30] (indices 2-3) at 230. No single trade reaches 210 on its own, so length 2 is the minimum.",
      },
    ],
    constraints: ["1 <= sizes.length <= 10^5", "1 <= target <= 10^9", "1 <= sizes[i] <= 10^4"],
    approach:
      "Because every size is strictly positive, the running window sum is monotonic in both directions as the pointers move, which is exactly what makes a two-pointer sliding window correct here. Expand the right pointer, accumulating a running sum; whenever that sum meets or exceeds target, record the window length and shrink from the left (subtracting as you go) until the sum drops back below target, since shrinking can only help find a smaller valid window, never a smaller sum that's still valid by accident.",
    code: `def min_window_reaching_volume(sizes: list[int], target: int) -> int:
    left = 0
    running_sum = 0
    best = float("inf")

    for right, size in enumerate(sizes):
        running_sum += size

        # shrink from the left as long as the window still meets the target --
        # every size is positive, so shrinking only ever reduces the sum
        while running_sum >= target:
            best = min(best, right - left + 1)
            running_sum -= sizes[left]
            left += 1

    return best if best != float("inf") else 0

print(min_window_reaching_volume([100, 50, 200, 30, 40], target=210))
# 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 209,
  },
  {
    id: "lc-20261029-max-profit-at-most-k-transactions",
    title: "Max Profit With At Most K Round-Trip Trades",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given a daily price array and an integer k, you may complete at most k buy-then-sell round trips (you must fully sell before buying again, and can hold at most one share at a time). Return the maximum achievable profit.",
    examples: [
      {
        input: "prices = [3,2,6,5,0,3], k = 2",
        output: "7",
        explanation:
          "Buy at 2, sell at 6, for a profit of 4. Then buy at 0, sell at 3, for a profit of 3. Total profit across the two allotted round trips is 7, which is optimal.",
      },
    ],
    constraints: ["0 <= k <= 100", "1 <= prices.length <= 1000", "0 <= prices[i] <= 1000"],
    approach:
      "Track two arrays indexed by how many round trips have started: buy[i] is the best running cash position immediately after opening your i-th position, and sell[i] is the best cash position immediately after closing your i-th position. Each day, for every i from 1 to k, buy[i] can either stay as-is or open fresh by spending from sell[i-1]'s cash; sell[i] can either stay as-is or close out buy[i]'s open position at today's price. The answer is sell[k] after processing every day. Cap k at n // 2 up front, since more round trips than that can never help on a finite price history.",
    code: `def max_profit_k_transactions(prices: list[int], k: int) -> int:
    if not prices or k == 0:
        return 0

    n = len(prices)
    k = min(k, n // 2)   # more round trips than n // 2 can't possibly help

    buy = [float("-inf")] * (k + 1)   # buy[i]: best cash position after opening the i-th position
    sell = [0] * (k + 1)              # sell[i]: best cash position after closing the i-th position

    for price in prices:
        for i in range(1, k + 1):
            buy[i] = max(buy[i], sell[i - 1] - price)
            sell[i] = max(sell[i], buy[i] + price)

    return sell[k]

print(max_profit_k_transactions([3, 2, 6, 5, 0, 3], k=2))
# 7`,
    language: "python",
    complexity: { time: "O(n * k)", space: "O(k)" },
    leetcodeNumber: 188,
  },
  {
    id: "lc-20261029-expected-trades-until-k-consecutive-wins",
    title: "Expected Number of Trades Until K Consecutive Winning Trades (Signal Confirmation)",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "Each trade independently wins with probability p (and loses with probability 1 - p). You stop the first time you observe k winning trades in a row. Return the expected number of trades needed to reach that stopping point.",
    examples: [
      {
        input: "p = 0.5, k = 2",
        output: "6.0",
        explanation:
          "This is the classic expected-waiting-time-for-a-streak result: with a fair coin, the expected number of flips to see 2 heads in a row is 6, and the same Markov-chain structure applies here with wins in place of heads.",
      },
    ],
    constraints: ["0 < p < 1", "1 <= k <= 30"],
    approach:
      "Model this as a Markov chain on states 0 through k, where state i means the current win streak has length i; state k is absorbing (the stopping condition). From state i < k, a win (probability p) advances to state i+1, and a loss (probability 1 - p) resets all the way back to state 0 -- not to i-1, since one loss breaks the streak entirely regardless of how long it was. Writing the expected-hitting-time recursion for each state and telescoping the resulting system algebraically collapses it to a closed form: the expected number of trades is the sum, for i from 1 to k, of (1/p)^i. This is worth deriving by hand once; after that it's a one-line computation, verifiable against a direct simulation of the same Markov chain.",
    code: `def expected_trades_to_k_wins(p: float, k: int) -> float:
    # closed form from the win-streak Markov chain: E = sum_{i=1}^{k} (1/p)^i
    inv_p = 1 / p
    return sum(inv_p ** i for i in range(1, k + 1))

print(round(expected_trades_to_k_wins(0.5, 2), 4))
# 6.0 -- matches the classic "expected flips for 2 heads in a row" result

print(round(expected_trades_to_k_wins(0.6, 3), 4))
# a higher per-trade win rate shortens the expected wait substantially

# Monte Carlo check: simulate the same win-streak Markov chain directly
import random

def simulate(p: float, k: int, trials: int = 20000) -> float:
    total_trades = 0
    for _ in range(trials):
        streak = 0
        trades = 0
        while streak < k:
            trades += 1
            streak = streak + 1 if random.random() < p else 0
        total_trades += trades
    return total_trades / trials

print(round(simulate(0.5, 2), 2))
# converges toward 6.0 as trials grows`,
    language: "python",
    complexity: {
      time: "O(k) for the closed form; O(trials * expected streak length) for the simulation",
      space: "O(1)",
    },
  },
  {
    id: "lc-20261029-design-level2-order-book-best-bid-ask",
    title: "Design a Level-2 Order Book Supporting Best Bid/Ask and Cancel in Amortized O(log n)",
    difficulty: "medium",
    topics: ["design", "heap", "hash-map"],
    problem:
      "Design a class OrderBook supporting add_order(order_id, side, price, qty), which adds a resting limit order on the given side ('buy' or 'sell'); cancel_order(order_id), which removes a previously added order; and best_bid() / best_ask(), which return the highest resting buy price / lowest resting sell price, or None if that side is currently empty.",
    examples: [
      {
        input: 'add_order(1,"buy",100,10); add_order(2,"buy",101,5); cancel_order(2); best_bid()',
        output: "100.0",
        explanation:
          "Order 2, the higher-priced bid at 101, is cancelled before best_bid() is called, so the correct answer falls back to order 1's price of 100, even though order 2's stale entry may still physically sit in the underlying heap.",
      },
    ],
    constraints: ["up to 10^5 calls across all methods", "price and qty are positive"],
    approach:
      "Keep a max-heap of bids (as a min-heap of negated prices) and a min-heap of asks, each entry tagged with its order_id, plus a dict mapping live order_id to (side, price). cancel_order does NOT search either heap -- it just removes the id from the live dict, an O(1) lazy delete. best_bid/best_ask peek at the top of the relevant heap: if that entry's order_id is no longer live, pop and discard it (it was cancelled) and keep peeking; the first live entry found is the answer. Each heap entry is popped at most once over its entire lifetime, so the lazy deletion costs nothing extra in the long run -- it's amortized O(log n) per operation, not O(n).",
    code: `import heapq

class OrderBook:
    def __init__(self) -> None:
        self._bids: list[tuple[float, int]] = []   # max-heap via negated price
        self._asks: list[tuple[float, int]] = []    # min-heap, natural price order
        self._live: dict[int, tuple[str, float]] = {}   # order_id -> (side, price)

    def add_order(self, order_id: int, side: str, price: float, qty: int) -> None:
        self._live[order_id] = (side, price)
        if side == "buy":
            heapq.heappush(self._bids, (-price, order_id))
        else:
            heapq.heappush(self._asks, (price, order_id))

    def cancel_order(self, order_id: int) -> None:
        self._live.pop(order_id, None)   # lazy delete -- heap entry purged later, on pop

    def best_bid(self) -> float | None:
        while self._bids:
            neg_price, order_id = self._bids[0]
            if order_id in self._live and self._live[order_id][0] == "buy":
                return -neg_price
            heapq.heappop(self._bids)   # stale (cancelled) entry -- discard and keep looking
        return None

    def best_ask(self) -> float | None:
        while self._asks:
            price, order_id = self._asks[0]
            if order_id in self._live and self._live[order_id][0] == "sell":
                return price
            heapq.heappop(self._asks)
        return None

book = OrderBook()
book.add_order(1, "buy", 100.0, 10)
book.add_order(2, "buy", 101.0, 5)
book.cancel_order(2)
print(book.best_bid())
# 100.0 -- the cancelled, higher-priced order is correctly skipped`,
    language: "python",
    complexity: {
      time: "O(log n) amortized per operation (each heap entry pushed and popped at most once)",
      space: "O(n)",
    },
  },
];
