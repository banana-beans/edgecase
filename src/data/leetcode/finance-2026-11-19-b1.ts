import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-19
// Top-K most active tickers in a sliding trade-count window
// (heap), longest streak of consecutive up-ticks before a
// reset (sliding window / Kadane-style scan), max profit
// across two non-overlapping trading windows in one price
// series (stock DP with a split point), probability that an
// order-arrival random walk ever returns to its starting
// inventory level (classic recurrence vs closed form), and a
// fixed-size circular trade-tape buffer (design).
// ============================================================

export const financeBatch20261119: LeetCodeProblem[] = [
  {
    id: "lc-20261119-top-k-active-tickers-sliding-window",
    title: "Top K Most Active Tickers in a Sliding Trade-Count Window",
    difficulty: "hard",
    topics: ["heap"],
    problem:
      "You receive a stream of trade events, each with a ticker symbol. Implement add_trade(ticker) and top_k() which returns the K tickers with the highest trade count among only the LAST W trades seen (a sliding window of fixed size W), ties broken by ticker name ascending.",
    examples: [
      {
        input: "W = 3, K = 2; trades: AAPL, AAPL, MSFT, GOOG; top_k() after each",
        output: "after 4 trades window is [AAPL, MSFT, GOOG] (counts 1,1,1) -> top_k = [AAPL, GOOG]",
        explanation:
          "The first AAPL trade fell out of the window once a 4th trade arrived, so within the last 3 trades every remaining ticker has count 1, and ties break alphabetically.",
      },
    ],
    constraints: ["1 <= W <= 10^5", "1 <= K <= W", "up to 10^5 calls to add_trade"],
    approach:
      "Keep a deque of the last W tickers seen (the sliding window's exact membership) plus a dict ticker -> count for just that window. On each add_trade, push the new ticker and increment its count; if the deque exceeds W, pop the oldest ticker from the left and decrement its count (removing the key once it hits zero so it never shows up in top_k). For top_k, since the counts dict only ever holds W entries at once, sort just those items by (-count, ticker) and take the first K -- no need for a persistent heap across calls since the window changes every add, and a full re-sort of at most W items is cheap and simple compared to maintaining a heap under decrements, which heapq cannot do in O(log n) directly.",
    code: `from collections import deque, defaultdict


class TopKActiveTickers:
    def __init__(self, window_size: int, k: int) -> None:
        self.w = window_size
        self.k = k
        self.window: deque[str] = deque()
        self.counts: dict[str, int] = defaultdict(int)

    def add_trade(self, ticker: str) -> None:
        self.window.append(ticker)
        self.counts[ticker] += 1
        if len(self.window) > self.w:
            oldest = self.window.popleft()
            self.counts[oldest] -= 1
            if self.counts[oldest] == 0:
                del self.counts[oldest]  # keep top_k's sort small and clean

    def top_k(self) -> list[str]:
        ranked = sorted(self.counts.items(), key=lambda kv: (-kv[1], kv[0]))
        return [ticker for ticker, _ in ranked[: self.k]]


feed = TopKActiveTickers(window_size=3, k=2)
for t in ["AAPL", "AAPL", "MSFT", "GOOG"]:
    feed.add_trade(t)
print(feed.top_k())
# ['AAPL', 'GOOG']`,
    language: "python",
    complexity: { time: "O(1) amortized per add, O(w log w) per top_k query", space: "O(w)" },
  },
  {
    id: "lc-20261119-longest-up-tick-streak-before-reset",
    title: "Longest Streak of Consecutive Up-Ticks Before a Down-Tick Resets It",
    difficulty: "easy",
    topics: ["sliding-window"],
    problem:
      "Given a list of consecutive trade prices, return the length of the longest run of strictly increasing consecutive prices (an 'up-tick streak'). A price equal to or lower than the previous one resets the current streak to length 1 (that price can still start a new streak).",
    examples: [
      {
        input: "prices = [5, 6, 7, 4, 5, 9, 10, 10, 11]",
        output: "3",
        explanation:
          "[5,6,7] gives a streak of 3, which resets at 4. [4,5,9,10] gives a streak of 4 before the repeated 10 resets it, and that beats the first streak -- the real answer is 4, from [4,5,9,10].",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5"],
    approach:
      "Single left-to-right scan tracking the current streak length and the best seen so far. Whenever the current price is strictly greater than the previous one, extend the current streak; otherwise reset it to 1, since a flat or down tick breaks the run but the price itself can still begin a fresh streak starting next comparison. Update the running maximum at every step rather than only at a reset, since the longest streak might run all the way to the end of the array with no final reset to trigger a check.",
    code: `def longest_up_tick_streak(prices: list[int]) -> int:
    if not prices:
        return 0

    best = 1
    current = 1
    for i in range(1, len(prices)):
        if prices[i] > prices[i - 1]:
            current += 1
        else:
            current = 1  # this price can still start a brand new streak
        best = max(best, current)

    return best


print(longest_up_tick_streak([5, 6, 7, 4, 5, 9, 10, 10, 11]))
# 4  (from [4, 5, 9, 10])`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261119-max-profit-two-disjoint-windows",
    title: "Max Profit From Two Non-Overlapping Buy-Sell Windows",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for one instrument, you may complete at most two separate buy-then-sell transactions, but the second purchase cannot happen until after the first sale (the two holding windows must not overlap). Return the maximum total profit.",
    examples: [
      {
        input: "prices = [3, 3, 5, 0, 0, 3, 1, 4]",
        output: "6",
        explanation:
          "Buy day 3 at price 0, sell day 5 at price 3 (profit 3); buy day 6 at price 1, sell day 7 at price 4 (profit 3). Total profit 3 + 3 = 6, which beats any single transaction.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^5"],
    approach:
      "Rather than literally searching every split point (which would be quadratic), run the DP as two linear passes that implicitly cover every possible split. Forward pass: best[i] = the max profit from ONE transaction using only prices[0..i]. Backward pass: combine a running max-profit-so-far-from-the-right with best[i-1] from the forward pass, tracking the best total across every possible 'first transaction ends by day i, second transaction starts at day i or later' boundary. This two-pass trick reduces an O(n^2) split search to O(n), and generalizes directly to the harder 'at most K transactions' DP by adding more interleaved passes or states.",
    code: `def max_profit_two_transactions(prices: list[int]) -> int:
    n = len(prices)
    if n < 2:
        return 0

    # forward[i] = best single-transaction profit using prices[0..i]
    forward = [0] * n
    min_so_far = prices[0]
    for i in range(1, n):
        min_so_far = min(min_so_far, prices[i])
        forward[i] = max(forward[i - 1], prices[i] - min_so_far)

    # backward sweep: combine forward[i-1] (first trade ends by i)
    # with the best SECOND trade starting at i or later
    best_total = forward[-1]
    max_so_far = prices[-1]
    second_leg_best = 0
    for i in range(n - 2, -1, -1):
        max_so_far = max(max_so_far, prices[i])
        second_leg_best = max(second_leg_best, max_so_far - prices[i])
        combined = (forward[i - 1] if i > 0 else 0) + second_leg_best
        best_total = max(best_total, combined)

    return best_total


print(max_profit_two_transactions([3, 3, 5, 0, 0, 3, 1, 4]))
# 6`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-20261119-return-to-origin-probability",
    title: "Probability an Order-Flow Random Walk Ever Returns to Its Starting Inventory",
    difficulty: "medium",
    topics: ["probability"],
    problem:
      "A desk's inventory starts at 0 and changes by +1 (probability p, a buy order fills) or -1 (probability 1-p) on each step, forever (no risk limit this time). Given p, return the probability that inventory ever returns to exactly 0 at some point after step 0.",
    examples: [
      {
        input: "p = 0.5",
        output: "1.0",
        explanation:
          "A symmetric simple random walk on the integers is recurrent -- it returns to its starting point with probability 1, even though the EXPECTED time to return is infinite.",
      },
      {
        input: "p = 0.7",
        output: "0.6",
        explanation:
          "An asymmetric walk is transient: it drifts away with positive probability and never comes back. The closed-form return probability is 1 - |2p - 1|.",
      },
    ],
    constraints: ["0 < p < 1"],
    approach:
      "This is the classic 1-D random walk recurrence result, not something you simulate. For p = 0.5 the walk is exactly recurrent, returning to the origin with probability 1 (a famous and non-obvious result, since the EXPECTED return time is still infinite -- recurrence and finite expectation are different things). For p != 0.5 the walk has a nonzero drift and is transient: the probability it ever returns to 0 has the closed form 1 - |2p - 1|, which equals 1 exactly at p = 0.5 and shrinks toward 0 as p approaches 0 or 1 (a strongly directional walk almost never wanders back). The interview point isn't deriving this from scratch under time pressure, it's recognizing the walk as this named structure and knowing which direction the formula should move as p moves away from 0.5.",
    code: `def return_to_origin_probability(p: float) -> float:
    # symmetric walk: recurrent, returns with probability 1
    # asymmetric walk: transient, closed form 1 - |2p - 1|
    return 1.0 - abs(2 * p - 1)


print(return_to_origin_probability(0.5))
# 1.0
print(round(return_to_origin_probability(0.7), 4))
# 0.6
print(round(return_to_origin_probability(0.95), 4))
# 0.1  -- a strongly directional desk almost never drifts back to flat`,
    language: "python",
    complexity: { time: "O(1)", space: "O(1)" },
  },
  {
    id: "lc-20261119-design-circular-trade-tape",
    title: "Design a Fixed-Size Circular Trade-Tape Buffer",
    difficulty: "medium",
    topics: ["design"],
    problem:
      "Design a buffer that holds the most recent N trade prints. record(price) adds a new print, evicting the oldest print once the buffer is full. recent(k) returns the last k prints in chronological order (oldest of the requested k first). All operations must run in O(1) or O(k) time, never O(N) regardless of how many trades have been recorded in total.",
    examples: [
      {
        input: "N = 3; record(10); record(20); record(30); record(40); recent(2)",
        output: "[30, 40]",
        explanation:
          "After 4 records into a size-3 buffer, the oldest print (10) has been evicted, leaving [20, 30, 40]; the last 2 of those are [30, 40].",
      },
    ],
    constraints: ["1 <= N <= 10^5", "0 <= k <= N", "up to 10^5 calls to record"],
    approach:
      "Use a fixed-length Python list of size N as the backing array plus a write-index pointer that wraps around with modulo arithmetic, instead of a deque that shifts memory or a growing list that wastes space on history nobody needs. Track a count of total prints ever recorded (capped display-wise at N) to know how many of the N slots are actually populated early on. record() writes to buf[write_index % N] and advances the pointer -- O(1), no shifting, no eviction logic beyond just overwriting the old slot in place. recent(k) reads the k slots ending at the most recent write, walking backward through the circular index, then reverses to chronological order -- O(k), independent of how many total trades have ever been recorded.",
    code: `class CircularTradeTape:
    def __init__(self, capacity: int) -> None:
        self.capacity = capacity
        self.buf: list[float | None] = [None] * capacity
        self.write_index = 0
        self.total_recorded = 0

    def record(self, price: float) -> None:
        self.buf[self.write_index % self.capacity] = price
        self.write_index += 1
        self.total_recorded += 1

    def recent(self, k: int) -> list[float]:
        k = min(k, self.capacity, self.total_recorded)
        out = []
        for i in range(1, k + 1):
            out.append(self.buf[(self.write_index - i) % self.capacity])
        out.reverse()  # walked backward, so flip to chronological order
        return out


tape = CircularTradeTape(capacity=3)
for p in (10, 20, 30, 40):
    tape.record(p)
print(tape.recent(2))
# [30, 40]`,
    language: "python",
    complexity: { time: "O(1) per record, O(k) per recent(k)", space: "O(N)" },
  },
];
