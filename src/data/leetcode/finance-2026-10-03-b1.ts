import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-03
// A min-heap top-K tracker for the largest single-day PnL losses,
// a variable-size sliding window bounding realized volatility, a
// two-transaction-plus-fee DP stock variant, a stationary-distribution
// computation for a market-regime Markov chain, and a token-bucket
// rate limiter design problem for throttling outbound orders.
// ============================================================

export const financeBatch20261003: LeetCodeProblem[] = [
  {
    id: "lc-20261003-topk-largest-daily-losses",
    title: "Top-K Largest Single-Day Losses From a Streaming PnL Series",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given a stream of daily PnL values arriving one at a time via add_pnl(value), maintain and return the K largest LOSSES seen so far (the K most negative values, reported as positive magnitudes in descending order) at any point via get_top_losses(), without re-sorting the entire history on every call.",
    examples: [
      {
        input: "add_pnl(-5); add_pnl(3); add_pnl(-12); add_pnl(-1); get_top_losses() with k=2",
        output: "[12, 5]",
        explanation:
          "The two largest-magnitude losses seen so far are -12 and -5, reported as positive magnitudes in descending order. The gain of 3 and the small loss of 1 never enter the top-2.",
      },
    ],
    constraints: ["up to 10^5 calls to add_pnl", "k fixed at construction, 1 <= k <= 100"],
    approach:
      "Maintain a min-heap of size at most k holding the magnitudes of the largest losses seen so far -- only negative PnL values are candidates, since gains never belong in a losses tracker. On every new loss, push its magnitude onto the heap, then if the heap exceeds size k, pop the smallest magnitude off. The trick is that a MIN-heap is the right structure for tracking the K LARGEST values: the smallest element currently in your top-k is exactly the one at risk of eviction when something bigger arrives, and a min-heap gives O(log k) access to precisely that element. get_top_losses just reads the heap's contents sorted descending, which costs O(k log k) only at query time, never on each insert.",
    code: `import heapq

class TopLossesTracker:
    def __init__(self, k: int):
        self.k = k
        self.heap: list[float] = []  # min-heap of loss MAGNITUDES, size <= k

    def add_pnl(self, value: float) -> None:
        if value >= 0:
            return  # gains are never candidates for a losses tracker
        magnitude = -value
        if len(self.heap) < self.k:
            heapq.heappush(self.heap, magnitude)
        elif magnitude > self.heap[0]:
            # bigger than our current smallest top-k loss -- it displaces it
            heapq.heapreplace(self.heap, magnitude)

    def get_top_losses(self) -> list[float]:
        return sorted(self.heap, reverse=True)

tracker = TopLossesTracker(k=2)
for pnl in [-5, 3, -12, -1]:
    tracker.add_pnl(pnl)
print(tracker.get_top_losses())  # [12, 5]`,
    language: "python",
    complexity: { time: "O(log k) per insert, O(k log k) per query", space: "O(k)" },
  },
  {
    id: "lc-20261003-longest-window-vol-under-threshold",
    title: "Longest Window Where Realized Volatility Stays Under a Threshold",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a list of daily returns rets and a volatility cap max_vol, return the length of the longest contiguous run of days whose realized volatility (population standard deviation of the returns in that run) is at most max_vol. The window must have at least 2 days.",
    examples: [
      {
        input: "rets=[0.01,-0.01,0.02,-0.015,0.10,-0.08,0.01], max_vol=0.02",
        output: "4",
        explanation:
          "The first four days [0.01,-0.01,0.02,-0.015] have a population std of about 0.0132, under the 0.02 cap. Extending to include the 0.10 and -0.08 shock days pushes std well past the cap, so the longest qualifying run has length 4.",
      },
    ],
    constraints: ["2 <= rets.length <= 10^4", "max_vol > 0"],
    approach:
      "Unlike sum-based sliding-window problems, variance doesn't move monotonically as the window grows or shrinks from one side, because it depends on the mean, which itself shifts as elements enter or leave. The way to make this tractable with a true two-pointer window is to maintain running sum and running sum-of-squares incrementally as O(1) updates on each expand/contract step, computing variance from them via the identity variance = mean(x^2) - mean(x)^2 rather than recomputing from scratch -- that identity turns an O(n) per-window recomputation into an O(1) incremental update. Expand the right pointer; whenever the window's std exceeds the cap, shrink from the left (removing the leftmost element's contribution to both running sums) until it's back under the cap or too short to measure, tracking the best valid length throughout.",
    code: `def longest_window_under_vol(rets: list[float], max_vol: float) -> int:
    def std(n: int, s: float, sq: float) -> float:
        mean = s / n
        var = sq / n - mean * mean
        return var ** 0.5 if var > 0 else 0.0

    left = 0
    running_sum = 0.0
    running_sumsq = 0.0
    best = 0

    for right, r in enumerate(rets):
        running_sum += r
        running_sumsq += r * r

        # shrink from the left while the window is too volatile (or too short to measure)
        while (right - left + 1) >= 2 and std(right - left + 1, running_sum, running_sumsq) > max_vol:
            running_sum -= rets[left]
            running_sumsq -= rets[left] * rets[left]
            left += 1

        if (right - left + 1) >= 2:
            best = max(best, right - left + 1)

    return best

print(longest_window_under_vol([0.01, -0.01, 0.02, -0.015, 0.10, -0.08, 0.01], max_vol=0.02))
# 4`,
    language: "python",
    complexity: { time: "O(n) amortized", space: "O(1)" },
  },
  {
    id: "lc-20261003-two-transactions-fee",
    title: "Best Time to Buy and Sell Stock With At Most Two Transactions and a Per-Trade Fee",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for a stock and a flat per-trade fee, where a 'trade' is one full buy-then-sell round trip, return the maximum profit achievable using at most two non-overlapping transactions (never holding more than one share at a time), where each completed transaction's profit is reduced by the fee.",
    examples: [
      {
        input: "prices=[1,5,3,8], fee=1",
        output: "7",
        explanation:
          "Two transactions: buy at 1, sell at 5 (profit 4, net 3 after the fee), then buy at 3, sell at 8 (profit 5, net 4 after the fee), for a total net profit of 7 -- better than one single transaction buying at 1 and selling at 8 (profit 7, net 6 after just one fee).",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= fee <= 10^4"],
    approach:
      "Extend the classic one-transaction-with-fee state machine (hold vs cash, where entering a hold costs the price and leaving it nets the price minus the fee) to two transaction 'slots' tracked in parallel, since 'at most two transactions' is really two sequential rounds of the same buy/sell decision sharing one pass over the data. Track four running values per day: hold1 (holding via transaction 1), cash1 (cashed out of transaction 1, fee already deducted), hold2 (holding via transaction 2, funded from cash1), and cash2 (cashed out of transaction 2 too). The fee is charged once per completed sell, so it's subtracted exactly where cash1 and cash2 are computed, never on a buy. Because hold2's buy draws from cash1 rather than from scratch, the second transaction is automatically constrained to start only after the first is realized, enforcing non-overlap without an explicit index split. All four states update in O(1) per day.",
    code: `def max_profit_two_tx_with_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    hold1 = -prices[0]  # bought using transaction 1
    cash1 = 0           # sold transaction 1, fee already paid
    hold2 = -prices[0]  # bought transaction 2, funded from cash1
    cash2 = 0           # sold transaction 2, fee already paid

    for price in prices[1:]:
        # order matters: compute later states from values not yet updated this iteration
        cash2 = max(cash2, hold2 + price - fee)
        hold2 = max(hold2, cash1 - price)  # buying tx2 draws from tx1's realized cash
        cash1 = max(cash1, hold1 + price - fee)
        hold1 = max(hold1, -price)

    return max(cash1, cash2, 0)  # using zero or one transaction may beat using two

print(max_profit_two_tx_with_fee([1, 5, 3, 8], fee=1))
# 7`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261003-regime-markov-stationary-distribution",
    title: "Stationary Distribution of a Market Regime Markov Chain",
    difficulty: "medium",
    topics: ["probability", "math"],
    problem:
      "A simplified market-regime model has three states: Bull, Chop, Bear, with a given daily transition probability matrix P (P[i][j] is the probability of moving from state i to state j tomorrow). Given P, compute the stationary distribution: the long-run fraction of days spent in each regime, assuming the chain is irreducible and aperiodic.",
    examples: [
      {
        input: "P=[[0.90,0.08,0.02],[0.20,0.60,0.20],[0.05,0.25,0.70]] (rows/cols ordered Bull, Chop, Bear)",
        output: "[0.619, 0.195, 0.186] (approximately)",
        explanation:
          "Solving pi*P=pi with pi summing to 1 gives the long-run regime frequencies. Bull dominates here because it has the highest self-transition probability (0.90, the 'stickiest' state).",
      },
    ],
    constraints: ["3x3 row-stochastic matrix (each row sums to 1)", "chain is irreducible and aperiodic"],
    approach:
      "The stationary distribution pi is the probability row-vector satisfying pi*P=pi (unchanged by one more step of the chain), plus the normalization that its entries sum to 1 -- pi is a LEFT eigenvector of P with eigenvalue exactly 1, which every row-stochastic matrix is guaranteed to have. Rather than hand-deriving the eigenvector, the robust numerical approach rewrites pi*P=pi as pi*(P-I)=0, so pi lies in the left null space of (P-I); stack the normalization constraint as an extra equation and solve the resulting linear system directly. That avoids the numerical fragility of iterating P many times and sidesteps manually picking the eigenvalue-1 eigenvector out of a generic eigendecomposition. For well-behaved chains, repeated left-multiplication of any starting distribution by P converges to the same pi, since the chain is irreducible and aperiodic.",
    code: `import numpy as np

def stationary_distribution(P: np.ndarray) -> np.ndarray:
    n = P.shape[0]
    # pi @ P = pi  <=>  pi @ (P - I) = 0, so pi is in the left null space of (P - I)
    # stack the normalization constraint (entries sum to 1) to pin down the solution
    A = np.vstack([P.T - np.eye(n), np.ones(n)])
    b = np.zeros(n + 1)
    b[-1] = 1.0
    pi, *_ = np.linalg.lstsq(A, b, rcond=None)  # handles the rank-deficient system cleanly
    return pi

P = np.array([
    [0.90, 0.08, 0.02],  # Bull
    [0.20, 0.60, 0.20],  # Chop
    [0.05, 0.25, 0.70],  # Bear
])

pi = stationary_distribution(P)
print(np.round(pi, 3))       # [0.619, 0.195, 0.186] approximately
print(np.round(pi @ P, 3))   # sanity check: pi @ P reproduces pi itself`,
    language: "python",
    complexity: { time: "O(1) for fixed 3x3 (O(n^3) in general for an n-state chain)", space: "O(n^2)" },
  },
  {
    id: "lc-20261003-token-bucket-order-rate-limiter",
    title: "Design a Token Bucket Rate Limiter for Outbound Orders",
    difficulty: "medium",
    topics: ["design"],
    problem:
      "Design a class OrderRateLimiter that enforces an exchange's throttle: at most capacity orders may be sent in any rolling window, refilling at refill_rate tokens per second, via try_send(timestamp) which returns True (consume a token, order allowed) or False (reject, would exceed the exchange's rate limit) given the current timestamp in seconds.",
    examples: [
      {
        input: "capacity=3, refill_rate=1.0; try_send(0.0) x3, then try_send(0.5), then try_send(1.2)",
        output: "True, True, True, False, True",
        explanation:
          "Starting with a full bucket of 3 tokens, three immediate sends at t=0 drain it to empty. A send at t=0.5 has only refilled 0.5 tokens, not enough for a full token, so it's rejected. By t=1.2, enough additional time has passed to refill at least one token, so that send succeeds.",
      },
    ],
    constraints: ["capacity >= 1", "refill_rate > 0", "timestamps arrive non-decreasing"],
    approach:
      "The token bucket algorithm models the rate limit as a bucket holding up to capacity tokens that refills continuously at refill_rate tokens per second; every allowed send consumes exactly one token, and a send is rejected if the bucket holds less than one. The key implementation trick is to avoid a background timer or per-tick update: instead, lazily compute how many tokens would have accumulated since the last check, based purely on the elapsed wall-clock time passed into try_send, cap the result at capacity (the bucket can't overflow), and only then decide whether a token is available. This makes every call O(1) regardless of how much real time elapses between calls, which matters for an order-sending hot path where a per-millisecond background refill thread isn't an option.",
    code: `class OrderRateLimiter:
    def __init__(self, capacity: float, refill_rate: float):
        self.capacity = capacity
        self.refill_rate = refill_rate  # tokens added per second
        self.tokens = capacity          # start with a full bucket
        self.last_check = 0.0           # timestamp of the last refill computation

    def try_send(self, timestamp: float) -> bool:
        elapsed = timestamp - self.last_check
        # lazily refill based on elapsed time -- no background thread needed
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_check = timestamp

        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True
        return False

limiter = OrderRateLimiter(capacity=3, refill_rate=1.0)
results = [
    limiter.try_send(0.0),
    limiter.try_send(0.0),
    limiter.try_send(0.0),
    limiter.try_send(0.5),
    limiter.try_send(1.2),
]
print(results)  # [True, True, True, False, True]`,
    language: "python",
    complexity: { time: "O(1) per try_send", space: "O(1)" },
  },
];
