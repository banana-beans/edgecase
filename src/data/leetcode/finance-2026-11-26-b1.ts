import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-26
// Top-K signed order-flow imbalance (heap), best K-day-or-longer
// trailing return window (binary search on prefix sums), max
// profit with K round trips plus a per-trip fee (DP), gambler's
// ruin absorption probability for a market maker's inventory
// (probability / Markov), and reconciling internal fills against
// an exchange drop-copy feed (design).
// ============================================================

export const financeBatch20261126: LeetCodeProblem[] = [
  {
    id: "lc-20261126-top-k-signed-order-flow-imbalance",
    title: "Top K Tickers by Absolute Signed Order-Flow Imbalance",
    difficulty: "medium",
    topics: ["heap", "hash-map"],
    problem:
      "You receive a stream of signed trade sizes per ticker: positive for buyer-initiated (aggressive buy) volume, negative for seller-initiated (aggressive sell) volume. At any point you need the K tickers with the largest absolute running order-flow imbalance, sorted by |imbalance| descending with ties broken by ticker alphabetically. Design record_flow(ticker, signed_size) and get_top_k_imbalance(k) so recording a flow never rescans full history.",
    examples: [
      {
        input:
          "flows = [('AAPL',500),('MSFT',-200),('AAPL',-300),('GOOG',150),('MSFT',-400)], k = 2",
        output: "['MSFT', 'AAPL']",
        explanation:
          "Running signed sums: AAPL = 500 - 300 = 200, MSFT = -200 - 400 = -600, GOOG = 150. Ranked by absolute value: MSFT (600) then AAPL (200).",
      },
    ],
    constraints: ["1 <= flows.length <= 10^5", "1 <= k <= number of distinct tickers seen so far"],
    approach:
      "Maintain a running signed-sum dict, updated in O(1) per incoming flow event -- the full history is never rescanned. When get_top_k_imbalance(k) is called, rank by (-abs(imbalance), ticker) ascending with heapq.nsmallest, which is exactly descending-by-magnitude with alphabetical tie-breaking, costing O(m log k) in m, the number of distinct tickers currently tracked, not the length of the whole flow stream. The key design point: a ticker that's net heavily SOLD (a large negative sum) is just as important a signal as one that's net heavily bought, so ranking must go by magnitude, not by the signed value itself.",
    code: `import heapq
from collections import defaultdict


class OrderFlowImbalanceTracker:
    def __init__(self) -> None:
        self.flow: dict[str, float] = defaultdict(float)

    def record_flow(self, ticker: str, signed_size: float) -> None:
        # O(1) per event -- running signed sum, never rescans history
        self.flow[ticker] += signed_size

    def get_top_k_imbalance(self, k: int) -> list[str]:
        # rank by |imbalance| descending, ticker ascending on ties
        top = heapq.nsmallest(k, self.flow.items(), key=lambda kv: (-abs(kv[1]), kv[0]))
        return [ticker for ticker, _ in top]


tracker = OrderFlowImbalanceTracker()
for sym, size in [("AAPL", 500), ("MSFT", -200), ("AAPL", -300), ("GOOG", 150), ("MSFT", -400)]:
    tracker.record_flow(sym, size)
print(tracker.get_top_k_imbalance(2))
# ['MSFT', 'AAPL'] -- MSFT's |-600| outranks AAPL's |200|`,
    language: "python",
    complexity: { time: "O(1) per record_flow, O(m log k) per get_top_k_imbalance", space: "O(m)" },
  },
  {
    id: "lc-20261126-max-average-subarray-length-at-least-k",
    title: "Maximum Average Daily Return Over Any Window of Length At Least K",
    difficulty: "hard",
    topics: ["binary-search", "prefix-sum", "sliding-window"],
    problem:
      "Given a backtest's daily returns and a minimum window length K, find the maximum average daily return achievable over any contiguous window of length at least K. This answers 'what's the best K-day-or-longer stretch this backtest ever had, on a per-day basis' -- a quick sanity check on whether a headline Sharpe is being carried by one short lucky run.",
    examples: [
      {
        input: "returns = [0.01, -0.02, 0.015, 0.03, -0.01, 0.02], k = 3",
        output: "~0.0117",
        explanation:
          "The window [0.015, 0.03, -0.01, 0.02] (length 4) averages (0.015+0.03-0.01+0.02)/4 = 0.01375, which beats every other window of length >= 3.",
      },
    ],
    constraints: ["1 <= returns.length <= 10^4", "1 <= k <= returns.length", "answer within 1e-5 of the true value"],
    approach:
      "Binary search on the candidate average x. For a fixed x, checking feasibility -- does some window of length >= k have TRUE average >= x -- reduces to: subtract x from every value, take prefix sums of the shifted array, and ask whether some window of length >= k has shifted SUM >= 0. Scanning i from k to n, track the minimum prefix sum seen among prefix[0..i-k] and check prefix[i] - min_prefix >= 0 in O(1) per step, giving an O(n) feasibility check. Binary searching that check over the real-valued range [min(returns), max(returns)] to a fixed precision gives the answer in O(n log(1/epsilon)) total -- this is the standard trick (LeetCode's Maximum Average Subarray II) for turning a 'best average over variable-length windows' problem, which has no simple sliding-window solution on its own, into a feasibility check that does.",
    code: `def max_average_window_at_least_k(returns: list[float], k: int, eps: float = 1e-6) -> float:
    n = len(returns)

    def feasible(x: float) -> bool:
        # shift every value down by x; feasible if some window of length >= k
        # has non-negative SHIFTED sum, i.e. true average >= x over that window
        prefix = [0.0] * (n + 1)
        for i in range(n):
            prefix[i + 1] = prefix[i] + (returns[i] - x)

        min_prefix = prefix[0]
        for i in range(k, n + 1):
            min_prefix = min(min_prefix, prefix[i - k])
            if prefix[i] - min_prefix >= 0:
                return True
        return False

    lo, hi = min(returns), max(returns)
    while hi - lo > eps:
        mid = (lo + hi) / 2
        if feasible(mid):
            lo = mid
        else:
            hi = mid
    return lo


print(round(max_average_window_at_least_k([0.01, -0.02, 0.015, 0.03, -0.01, 0.02], k=3), 4))
# ~0.0117`,
    language: "python",
    complexity: { time: "O(n log(1/eps))", space: "O(n)" },
    leetcodeNumber: 644,
  },
  {
    id: "lc-20261126-max-profit-k-trades-with-fee",
    title: "Maximum Profit With At Most K Round Trips, Each Charged a Flat Fee",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices, you may complete at most K non-overlapping round trips (buy, later sell, hold at most one unit at a time), and each completed round trip is charged a flat transaction fee. Return the maximum achievable profit.",
    examples: [
      {
        input: "prices = [3, 2, 6, 5, 0, 3], k = 2, fee = 1",
        output: "5.0",
        explanation:
          "Buy at 2, sell at 6 for 4 - 1 fee = 3, then buy at 0, sell at 3 for 3 - 1 fee = 2. Total 3 + 2 = 5, which beats taking only one round trip (profit 3) or a worse pairing of trades.",
      },
    ],
    constraints: ["1 <= prices.length <= 1000", "0 <= k <= 50", "0 <= fee <= 10^4"],
    approach:
      "Extend the classic 'at most K transactions' DP with a fee deducted once per completed round trip. Track two arrays indexed by how many round trips have been started/finished: hold[j] is the best running profit while holding stock bought for the j-th time, and cash[j] is the best profit after completing j full round trips. Each day, update hold[j] from cash[j-1] (funding a new entry) and cash[j] from hold[j] (closing the j-th trip and paying the fee), processing j in increasing order within the same day since hold[j] depends on cash[j-1] computed on an EARLIER day, not the same day's cash[j-1]. The fee only ever gets charged on the sell side, once per completed trip, which keeps the state space at O(k) instead of needing a separate 'fee already paid' flag.",
    code: `def max_profit_k_trades_with_fee(prices: list[int], k: int, fee: float) -> float:
    if not prices or k == 0:
        return 0.0

    hold = [float("-inf")] * (k + 1)  # holding stock after the j-th buy
    cash = [0.0] * (k + 1)            # flat, having completed j round trips

    for price in prices:
        for j in range(1, k + 1):
            # buy for the j-th time, funded by cash after (j-1) completed trips
            hold[j] = max(hold[j], cash[j - 1] - price)
            # sell to complete the j-th trip, paying the fee once per round trip
            cash[j] = max(cash[j], hold[j] + price - fee)

    return max(cash)


print(max_profit_k_trades_with_fee([3, 2, 6, 5, 0, 3], k=2, fee=1))
# 5.0`,
    language: "python",
    complexity: { time: "O(n * k)", space: "O(k)" },
  },
  {
    id: "lc-20261126-probability-of-ruin-biased-walk",
    title: "Probability a Market Maker's Inventory Hits the Position Limit Before Forced Flat",
    difficulty: "hard",
    topics: ["probability", "markov-chain", "math"],
    problem:
      "A market maker's inventory moves by +1 unit with probability p or -1 unit with probability (1-p) on each trade, starting at inventory i, with absorbing barriers at 0 (forced de-risk to flat) and N (position limit reached, stop quoting). Return the probability the walk is absorbed at the UPPER barrier N rather than at 0.",
    examples: [
      {
        input: "i = 1, n = 3, p = 0.5",
        output: "0.3333",
        explanation:
          "This is the classic gambler's ruin problem. For the symmetric case p = 0.5, the probability of reaching N before 0 starting from i is simply i / n = 1/3, which can be verified by solving the three-state linear system directly.",
      },
    ],
    constraints: ["0 <= i <= n", "0 < p < 1, p given as a float", "1 <= n <= 10^6", "return the answer as a float"],
    approach:
      "Let P_i be the probability of reaching N before 0, starting from inventory i. It satisfies the recursion P_i = p*P_(i+1) + (1-p)*P_(i-1), with boundary conditions P_0 = 0 and P_N = 1. This is a linear homogeneous recurrence, and guessing a geometric solution P_i = r^i leads to the characteristic equation p*r^2 - r + (1-p) = 0, whose two roots are r = 1 and r = (1-p)/p -- so the general solution is a linear combination of 1^i and r^i. Applying both boundary conditions pins down the combination, giving the closed form (1 - r^i) / (1 - r^N) for p != 0.5, which collapses to the simpler i/N exactly at p = 0.5 where r = 1 makes the geometric term degenerate.",
    code: `def probability_hits_upper_barrier(i: int, n: int, p: float) -> float:
    if p == 0.5:
        # the geometric root r = (1-p)/p degenerates to 1 here, so the
        # closed form below is a 0/0 -- the limiting case is simply i/n
        return i / n

    r = (1 - p) / p
    return (1 - r**i) / (1 - r**n)


print(round(probability_hits_upper_barrier(i=1, n=3, p=0.5), 4))
# 0.3333
print(round(probability_hits_upper_barrier(i=5, n=10, p=0.52), 4))
# a slight structural edge (p > 0.5) raises the odds of hitting the limit first`,
    language: "python",
    complexity: { time: "O(1) with the closed form", space: "O(1)" },
  },
  {
    id: "lc-20261126-design-fill-reconciliation",
    title: "Design a Fill Reconciler Matching Internal Fills Against an Exchange Drop-Copy Feed",
    difficulty: "medium",
    topics: ["design", "hash-map"],
    problem:
      "Design a FillReconciler that ingests two independent streams describing the same trades: internal_fill(fill_id, qty, price) from your own order management system, and exchange_fill(fill_id, qty, price) from the exchange's drop-copy feed. The two streams can arrive in either order, and either side can arrive before the other or not at all yet. Support is_matched(fill_id), true once both sides have reported the same fill_id with exactly matching qty and price, and get_unmatched(side), returning every fill_id seen on that side that isn't matched yet.",
    examples: [
      {
        input:
          "internal_fill('F1', 100, 50.25); exchange_fill('F1', 100, 50.25); internal_fill('F2', 200, 10.00); is_matched('F1'); get_unmatched('internal')",
        output: "True, ['F2']",
        explanation:
          "F1 has matching qty and price on both sides, so it's matched. F2 has only arrived on the internal side so far, so it shows up as unmatched there.",
      },
    ],
    constraints: [
      "fills can arrive on either side first, in any interleaving",
      "a fill_id might never arrive on one side at all (a genuine break)",
      "qty and price must match EXACTLY for a fill_id to count as reconciled",
    ],
    approach:
      "Keep each side's reports in its own dict keyed by fill_id. Whenever either side records a fill, check whether the OTHER side already has that same id and, if so, whether qty and price agree exactly -- if they do, promote the id into a matched set. This makes the whole thing order-independent: it doesn't matter which side arrives first, the match is detected the moment the second side shows up, in O(1) work. get_unmatched(side) filters that side's dict for ids not yet in the matched set, which is exactly the signal an operations desk watches in production: a fill_id sitting unmatched past some time threshold means either a reporting lag or a genuine discrepancy that needs a human to look at.",
    code: `class FillReconciler:
    def __init__(self) -> None:
        self.internal: dict[str, tuple[float, float]] = {}
        self.exchange: dict[str, tuple[float, float]] = {}
        self.matched: set[str] = set()

    def _check_match(self, fill_id: str) -> None:
        if fill_id in self.internal and fill_id in self.exchange:
            if self.internal[fill_id] == self.exchange[fill_id]:
                self.matched.add(fill_id)

    def internal_fill(self, fill_id: str, qty: float, price: float) -> None:
        self.internal[fill_id] = (qty, price)
        self._check_match(fill_id)

    def exchange_fill(self, fill_id: str, qty: float, price: float) -> None:
        self.exchange[fill_id] = (qty, price)
        self._check_match(fill_id)

    def is_matched(self, fill_id: str) -> bool:
        return fill_id in self.matched

    def get_unmatched(self, side: str) -> list[str]:
        source = self.internal if side == "internal" else self.exchange
        return [fid for fid in source if fid not in self.matched]


reconciler = FillReconciler()
reconciler.internal_fill("F1", 100, 50.25)
reconciler.exchange_fill("F1", 100, 50.25)
reconciler.internal_fill("F2", 200, 10.00)
print(reconciler.is_matched("F1"))           # True
print(reconciler.get_unmatched("internal"))  # ['F2'] -- no drop-copy match yet`,
    language: "python",
    complexity: { time: "O(1) per fill report and is_matched, O(n) per get_unmatched", space: "O(n)" },
  },
];
