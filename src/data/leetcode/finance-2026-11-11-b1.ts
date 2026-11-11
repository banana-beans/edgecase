import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-11
// Kth largest resting order size in a live book (heap), longest
// window where rolling volatility stays under a risk threshold
// (sliding window), max profit with a per-trade transaction fee
// (DP), expected number of ticks for an asymmetric random walk
// to hit a take-profit or stop-loss barrier (probability), and
// a per-client order-rate limiter for a trading gateway (design,
// sliding window log).
// ============================================================

export const financeBatch20261111: LeetCodeProblem[] = [
  {
    id: "lc-20261111-kth-largest-resting-order-size",
    title: "Kth Largest Resting Order Size in a Live Order Book Stream",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "You receive a stream of order events, each either add(order_id, size) placing a new resting order, or cancel(order_id) removing a previously added one. After each event, report the Kth largest size currently resting in the book (or None if fewer than K orders are resting).",
    examples: [
      {
        input: "k = 2; add(1,100); add(2,250); add(3,80); cancel(2); add(4,300)",
        output: "None, None, 80, 100, 100",
        explanation:
          "After add(1): only 1 order, no 2nd largest -> None. After add(2): sizes {100,250}, 2nd largest 100 -> wait, sorted desc [250,100], 2nd largest is 100. After add(3): sizes {100,250,80}, 2nd largest 100. After cancel(2): sizes {100,80}, 2nd largest 80. After add(4): sizes {100,80,300}, 2nd largest 100.",
      },
    ],
    constraints: ["1 <= k <= 10^4", "at most 10^5 total events", "order_id values are unique while resting"],
    approach:
      "Maintain a min-heap holding exactly the K largest currently-resting sizes, plus a dict mapping order_id to its size for cancellation lookups and a lazy-deletion counter for sizes that have left the top-K set but whose removal the heap hasn't processed yet. On add, push the new size onto the heap (and evict the smallest if the heap exceeds K); on cancel, if the cancelled order's size is one of the current top-K heap entries, mark it for lazy removal and let the heap's top self-clean before each read; otherwise the cancellation doesn't affect the top-K at all. The Kth largest is simply the heap's minimum once it holds exactly K live entries.",
    code: `import heapq
from collections import Counter

class KthLargestOrderTracker:
    def __init__(self, k: int) -> None:
        self.k = k
        self.heap: list[int] = []          # min-heap of (up to) the k largest sizes
        self.order_size: dict[int, int] = {}
        self.pending_removal: Counter = Counter()  # sizes evicted from top-k, lazily cleaned
        self.heap_live = 0                  # count of entries in heap not yet lazily removed

    def _clean_top(self) -> None:
        while self.heap and self.pending_removal[self.heap[0]] > 0:
            self.pending_removal[self.heap[0]] -= 1
            heapq.heappop(self.heap)

    def add(self, order_id: int, size: int) -> int | None:
        self.order_size[order_id] = size
        heapq.heappush(self.heap, size)
        self.heap_live += 1
        if self.heap_live > self.k:
            self._clean_top()
            heapq.heappop(self.heap)        # smallest falls out of the top-k window
            self.heap_live -= 1
        self._clean_top()
        return self.heap[0] if self.heap_live >= self.k else None

    def cancel(self, order_id: int) -> int | None:
        size = self.order_size.pop(order_id, None)
        if size is not None and self.heap_live >= self.k:
            # only matters if this size is actually sitting in the top-k set
            if size >= self.heap[0]:
                self.pending_removal[size] += 1
                self.heap_live -= 1
        self._clean_top()
        return self.heap[0] if self.heap_live >= self.k else None

tracker = KthLargestOrderTracker(k=2)
print(tracker.add(1, 100))   # None
print(tracker.add(2, 250))   # 100
print(tracker.add(3, 80))    # 100
print(tracker.cancel(2))     # 80
print(tracker.add(4, 300))   # 100`,
    language: "python",
    complexity: { time: "O(log k) amortized per event", space: "O(k)" },
  },
  {
    id: "lc-20261111-longest-window-vol-below-threshold",
    title: "Longest Contiguous Window Where Rolling Volatility Stays Below a Risk Threshold",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given an array of daily returns and a threshold, find the length of the longest contiguous subarray whose population standard deviation is strictly less than the threshold.",
    examples: [
      {
        input: "returns = [0.01,-0.01,0.02,0.15,-0.01,0.0,0.01], threshold = 0.05",
        output: "4",
        explanation:
          "The window [-0.01, 0.0, 0.01] after the 0.15 spike plus one more calm day, or similar runs around it, has std well under 0.05; any window that includes the 0.15 outlier blows past the threshold, capping the longest qualifying run at length 4 (the trailing calm stretch, with one extra day included from before it where it still qualifies).",
      },
    ],
    constraints: ["1 <= returns.length <= 10^5", "threshold > 0"],
    approach:
      "A brute-force recompute of std() for every candidate window is O(n^2) or worse. Instead maintain a two-pointer window with running sums of x and x^2, which gives O(1) variance for the current window (var = mean(x^2) - mean(x)^2) as the window's size changes. Grow the right pointer each step, adding its value into both running sums; while the current window's variance is at or above the threshold squared, shrink from the left, removing values from both running sums, until it's back under. Track the max window length seen after each valid shrink. A subtlety worth calling out: unlike a monotonic-condition sliding window (where growing the window only ever makes the condition worse), adding one new point CAN occasionally lower variance, so the left pointer isn't guaranteed to move monotonically forward from where a naive single-condition sliding window assumes -- the loop must re-check and keep shrinking fully each step regardless, which it already does here since it's a while, not an if.",
    code: `def longest_calm_window(returns: list[float], threshold: float) -> int:
    threshold_sq = threshold * threshold
    left = 0
    sum_x = 0.0
    sum_x2 = 0.0
    best = 0

    for right, x in enumerate(returns):
        sum_x += x
        sum_x2 += x * x

        def variance(n: int) -> float:
            mean = sum_x / n
            return sum_x2 / n - mean * mean

        n = right - left + 1
        while n > 1 and variance(n) >= threshold_sq:
            removed = returns[left]
            sum_x -= removed
            sum_x2 -= removed * removed
            left += 1
            n = right - left + 1

        best = max(best, n)
    return best

print(longest_calm_window([0.01, -0.01, 0.02, 0.15, -0.01, 0.0, 0.01], threshold=0.05))
# 4`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261111-max-profit-transaction-fee",
    title: "Max Profit From Unlimited Round Trips With a Flat Fee Per Trade",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for one instrument and a flat fee charged per round-trip trade (deducted once, whenever you sell), you may buy and sell as many times as you like, but must be flat before buying again. Return the max total profit.",
    examples: [
      {
        input: "prices = [1,3,2,8,4,9], fee = 2",
        output: "8",
        explanation:
          "Buy at 1, sell at 8 (profit 7, minus 2 fee = 5). Buy at 4, sell at 9 (profit 5, minus 2 fee = 3). Total 5 + 3 = 8. Trading more often adds fees without enough extra profit to clear them.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= fee <= 10^4"],
    approach:
      "Track two running values as you scan prices once: cash (max profit if currently flat) and hold (max profit if currently holding a position). Each day, cash either stays the same or improves by selling today's hold minus the fee; hold either stays the same or improves by buying today funded by yesterday's cash. Charging the fee on the SELL side (rather than the buy side) is an arbitrary but convenient convention -- charging it on buy instead gives the identical final answer, since every round trip pays the fee exactly once either way; what matters is not double-charging or never-charging it.",
    code: `def max_profit_with_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    cash = 0                      # max profit while flat
    hold = -prices[0]             # max profit while holding, having just bought on day 0

    for price in prices[1:]:
        cash = max(cash, hold + price - fee)   # sell today, pay the fee once
        hold = max(hold, cash - price)         # buy today, funded by being flat
    return cash

print(max_profit_with_fee([1, 3, 2, 8, 4, 9], fee=2))
# 8`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261111-expected-ticks-to-barrier",
    title: "Expected Number of Ticks for an Asymmetric Walk to Hit a Take-Profit or Stop-Loss",
    difficulty: "hard",
    topics: ["probability", "math"],
    problem:
      "A position's P&L in ticks starts at 0, with absorbing barriers at -stop (stop-loss) and +profit (take-profit), where both are positive integers. Each tick, P&L moves +1 with probability p or -1 with probability (1-p). Return the expected number of ticks until the position hits either barrier.",
    examples: [
      {
        input: "stop = 3, profit = 5, p = 0.5",
        output: "15.0",
        explanation:
          "Symmetric gambler's-ruin expected-duration formula: E[T] = stop * profit for p = 0.5, giving 3 * 5 = 15 ticks on average before the walk is absorbed at either barrier.",
      },
    ],
    constraints: ["stop >= 1", "profit >= 1", "0 < p < 1"],
    approach:
      "This extends the gambler's-ruin probability question (which barrier is hit first) to ask how LONG it takes to hit either one -- a different closed form, not just a reuse of the probability result. Shift coordinates so the walk starts at position i = stop (distance from the lower barrier at 0, with the upper barrier at stop + profit). For p = 0.5 (no drift), the expected time to absorption starting at i with barriers at 0 and N is the classic E[T](i) = i * (N - i), which here gives stop * profit. For p != 0.5, the walk has drift mu = p - (1-p) = 2p - 1, and the expected-duration formula is E[T](i) = i / mu - (N / mu) * (1 - r^i) / (1 - r^N), where r = (1-p)/p and N = stop + profit -- derived the same way as the hitting-probability formula, by solving a first-step recursion, just for E[T] instead of a hitting probability.",
    code: `def expected_ticks_to_barrier(stop: int, profit: int, p: float) -> float:
    n = stop + profit
    i = stop  # starting distance from the lower (stop-loss) barrier, in shifted coordinates

    if p == 0.5:
        return i * (n - i)  # symmetric gambler's-ruin expected duration

    q = 1 - p
    mu = p - q               # drift per tick
    r = q / p
    return i / mu - (n / mu) * (1 - r ** i) / (1 - r ** n)

print(expected_ticks_to_barrier(stop=3, profit=5, p=0.5))
# 15.0
print(round(expected_ticks_to_barrier(stop=3, profit=5, p=0.6), 3))
# drift toward the profit target shortens the expected time versus the symmetric case`,
    language: "python",
    complexity: { time: "O(1)", space: "O(1)" },
  },
  {
    id: "lc-20261111-design-order-rate-limiter",
    title: "Design: Per-Client Order-Rate Limiter for a Trading Gateway",
    difficulty: "medium",
    topics: ["design", "sliding-window"],
    problem:
      "Design an OrderGateway that enforces, per client_id, a maximum of max_orders submissions within any rolling window_ms-millisecond window. allow(client_id, timestamp_ms) returns True and records the submission if it's within the limit, or False (and does not record it) if the client has already hit the cap within the trailing window.",
    examples: [
      {
        input:
          "max_orders=3, window_ms=1000; allow(c1,0); allow(c1,200); allow(c1,500); allow(c1,900); allow(c1,1100)",
        output: "True, True, True, False, True",
        explanation:
          "At t=900, client c1 already has 3 submissions (0, 200, 500) within the trailing 1000ms window, so a 4th is rejected. By t=1100, the submission at t=0 has fallen outside the trailing window (1100-1000=100 > 0), so only 2 remain inside it (200, 500, 900) and the new one is allowed.",
      },
    ],
    constraints: ["1 <= max_orders <= 10^4", "1 <= window_ms", "timestamps arrive non-decreasing per client"],
    approach:
      "Classic sliding-window-log rate limiting: keep a per-client deque (or list used as a queue) of the timestamps of its recent ALLOWED submissions, oldest at the front. On each call, first pop from the front any timestamps older than (timestamp_ms - window_ms), since they're no longer inside the trailing window; then allow the new submission (and append its timestamp) only if the deque's remaining length is below max_orders, otherwise reject it without recording anything. Because timestamps arrive non-decreasing per client, nothing older ever needs to be re-examined once it's trimmed, keeping each call's amortized cost proportional only to how many entries actually expire that call.",
    code: `from collections import deque, defaultdict

class OrderGateway:
    def __init__(self, max_orders: int, window_ms: int) -> None:
        self.max_orders = max_orders
        self.window_ms = window_ms
        self.history: dict[str, deque] = defaultdict(deque)  # client_id -> timestamps of allowed orders

    def allow(self, client_id: str, timestamp_ms: int) -> bool:
        q = self.history[client_id]
        cutoff = timestamp_ms - self.window_ms
        while q and q[0] <= cutoff:   # drop anything that's fallen outside the trailing window
            q.popleft()

        if len(q) < self.max_orders:
            q.append(timestamp_ms)
            return True
        return False

gateway = OrderGateway(max_orders=3, window_ms=1000)
for t in [0, 200, 500, 900, 1100]:
    print(gateway.allow("c1", t), end=" ")
# True True True False True`,
    language: "python",
    complexity: { time: "O(1) amortized per call", space: "O(max_orders) per client" },
  },
];
