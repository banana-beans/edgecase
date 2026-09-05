import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-05
// A top-K heap over rolling factor exposures, a sliding-window
// cap on cumulative traded notional, the buy-with-cooldown stock
// DP, an absorbing Markov chain for margin-call probability, and
// a design problem for a rolling VWAP tracker with expiring ticks.
// ============================================================

export const financeBatch20260905: LeetCodeProblem[] = [
  {
    id: "lc-20260905-top-k-factor-exposure-heap",
    title: "Top K Names by Absolute Factor Exposure, Streaming Daily",
    difficulty: "medium",
    topics: ["heap", "design"],
    problem:
      "You receive a daily stream of (ticker, factor_exposure) updates -- each update replaces that ticker's current exposure (tickers can repeat across days). After each update, report the K tickers with the largest absolute factor exposure, in descending order of |exposure|.",
    examples: [
      {
        input:
          "k=2; updates=[('AAPL',0.8),('MSFT',-1.2),('GOOG',0.5),('AAPL',-2.0)]",
        output:
          "[['AAPL'], ['MSFT','AAPL'], ['MSFT','AAPL'], ['AAPL','MSFT']]",
        explanation:
          "After update 4, AAPL's exposure was overwritten from 0.8 to -2.0, so |AAPL| becomes the largest, ahead of MSFT's |-1.2|.",
      },
    ],
    constraints: [
      "1 <= k <= 10^4",
      "1 <= number of updates <= 10^5",
      "the same ticker can be updated repeatedly, overwriting its prior exposure",
    ],
    approach:
      "The trap is that a plain heap doesn't support 'update a ticker's key' -- pushing every update means stale entries pile up. Keep a dict mapping ticker -> current exposure as the single source of truth, and a max-heap keyed on |exposure| that allows lazy deletion: when popping for the top-K query, skip any heap entry whose exposure doesn't match the dict's current value for that ticker (it's stale, superseded by a later update). Every update pushes one new heap entry (never mutates in place, since heapq can't do that in O(log n)); querying top-K pops off stale entries until K live ones are found, then pushes them back so they remain available for the next query. Each ticker can accumulate multiple stale heap entries over time but each is only ever popped once, so total heap operations stay O(U log U) across all updates and queries combined, where U is the total number of updates -- amortized fine even though a single query can occasionally do more than O(K) work.",
    code: `import heapq

class TopKExposureTracker:
    def __init__(self, k: int):
        self.k = k
        self.current: dict[str, float] = {}          # ticker -> live exposure
        self.heap: list[tuple[float, str]] = []       # (-|exposure|, ticker), lazy-deleted

    def update(self, ticker: str, exposure: float) -> list[str]:
        self.current[ticker] = exposure
        heapq.heappush(self.heap, (-abs(exposure), ticker))
        return self._top_k()

    def _top_k(self) -> list[str]:
        result: list[str] = []
        popped: list[tuple[float, str]] = []

        while self.heap and len(result) < self.k:
            neg_abs_exp, ticker = heapq.heappop(self.heap)
            popped.append((neg_abs_exp, ticker))
            # only count it if this heap entry still matches the ticker's live exposure --
            # otherwise it's a stale entry from a since-overwritten update
            if -neg_abs_exp == abs(self.current.get(ticker, float("nan"))):
                if ticker not in result:
                    result.append(ticker)

        for entry in popped:
            heapq.heappush(self.heap, entry)   # push everything back for future queries
        return result

tracker = TopKExposureTracker(k=2)
print(tracker.update("AAPL", 0.8))    # ['AAPL']
print(tracker.update("MSFT", -1.2))   # ['MSFT', 'AAPL']
print(tracker.update("GOOG", 0.5))    # ['MSFT', 'AAPL']
print(tracker.update("AAPL", -2.0))   # ['AAPL', 'MSFT']`,
    language: "python",
    complexity: { time: "O(log U) amortized per update, O(K log U) per query", space: "O(U)" },
  },
  {
    id: "lc-20260905-sliding-window-notional-budget",
    title: "Longest Trading Window Under a Rolling Notional Budget",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a chronological array of trade notionals (can include negative values for sells) and a max_gross budget, find the length of the longest contiguous window of trades where the sum of absolute notionals traded in that window never exceeds max_gross at any point while the window is open.",
    examples: [
      {
        input: "notionals=[50,-30,20,-80,10], max_gross=100",
        output: "3",
        explanation:
          "Window [50,-30,20] has running |sum of abs values| = 50, 80, 100 -- fits exactly. Extending to include -80 pushes cumulative gross to 180, over budget, so the window must shrink from the left first.",
      },
    ],
    constraints: [
      "1 <= notionals.length <= 10^5",
      "-10^9 <= notionals[i] <= 10^9",
      "0 <= max_gross <= 10^18",
    ],
    approach:
      "This reduces to the standard variable-size sliding window pattern, but the running quantity is sum of |notional| over the window rather than a sum of the raw values, so it only ever grows as the window expands and only ever shrinks as the window contracts from the left -- exactly the monotonic property a two-pointer window needs to be correct. Expand the right pointer, adding |notionals[right]| to a running total; whenever the running total exceeds max_gross, shrink from the left, subtracting |notionals[left]| and advancing left, until the window is back within budget. Track the best (right - left + 1) seen after each expansion. Because each index is added to the running total exactly once and removed at most once, the whole scan is O(n) despite the nested-looking while loop, the same amortized argument as any sliding-window-with-shrink problem.",
    code: `def longest_window_under_gross_budget(notionals: list[int], max_gross: int) -> int:
    left = 0
    running_gross = 0
    best_len = 0

    for right, notional in enumerate(notionals):
        running_gross += abs(notional)

        # shrink from the left while over budget -- running_gross only
        # decreases as we remove elements, so this terminates cleanly
        while running_gross > max_gross:
            running_gross -= abs(notionals[left])
            left += 1

        best_len = max(best_len, right - left + 1)

    return best_len

print(longest_window_under_gross_budget([50, -30, 20, -80, 10], max_gross=100))   # 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260905-max-profit-cooldown-transaction-cap",
    title: "Max Profit With a Cooldown Day AND a Cap of At Most K Trades",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices, an integer K capping the number of round-trip trades, and a rule that after selling you must wait one full day before buying again (cooldown), find the maximum achievable profit, holding at most one share at a time.",
    examples: [
      {
        input: "prices=[1,2,3,0,2], k=2",
        output: "3",
        explanation:
          "Buy at 1, sell at 2 (profit 1, day-of-price-3 becomes the cooldown day), then buy at 0, sell at 2 (profit 2). Two round trips totalling profit 3, respecting the one-day cooldown after each sell; no combination using at most 2 round trips beats it.",
      },
    ],
    constraints: ["1 <= prices.length <= 1000", "0 <= k <= 100", "0 <= prices[i] <= 1000"],
    approach:
      "Extend the at-most-K-transactions DP (hold[j] / cash[j] per transaction count j) with a third state per j to model the one-day cooldown: cooldown[j], meaning 'just sold to complete the j-th round trip today, not yet eligible to buy again.' Transitions per day, for each j from 1..K, computed from the PREVIOUS day's values: hold[j] = max(hold[j], cash[j-1] - price) -- buy funded only from a state that has already cleared any cooldown, never directly from yesterday's cooldown[j-1] itself, which is exactly what enforces the one-day wait; cooldown[j] = hold[j] + price -- selling today to complete the j-th round trip, entering the one-day cooldown; cash[j] = max(cash[j], cooldown[j]) -- becoming flat-and-eligible-to-buy the day after a cooldown state was reached. The discipline that makes this correct (and differs from the naive version) is that a new buy is never funded straight out of the same-timestep cooldown state -- only out of cash, which by construction already reflects a cooldown that finished at least one day earlier.",
    code: `def max_profit_k_trades_with_cooldown(prices: list[int], k: int) -> int:
    n = len(prices)
    if n < 2 or k == 0:
        return 0

    NEG_INF = float("-inf")
    hold = [NEG_INF] * (k + 1)       # holding a share, j-th position open
    cash = [0] * (k + 1)             # flat, cooldown already cleared, j round trips done
    cooldown = [NEG_INF] * (k + 1)   # just sold today to finish the j-th round trip

    for price in prices:
        new_hold = hold[:]
        new_cash = cash[:]
        new_cooldown = cooldown[:]

        for j in range(1, k + 1):
            # buy today: funded ONLY from cash[j-1], a state that already cleared
            # cooldown at least one day ago -- never from cooldown[j-1] directly,
            # which would let a sell and the next buy happen on consecutive days
            new_hold[j] = max(hold[j], cash[j - 1] - price)
            # sell today: completes the j-th round trip, enters cooldown
            new_cooldown[j] = hold[j] + price
            # stay flat: cooldown reached on some earlier day has now cleared
            new_cash[j] = max(cash[j], cooldown[j])

        hold, cash, cooldown = new_hold, new_cash, new_cooldown

    return max(cash[k], cooldown[k])

print(max_profit_k_trades_with_cooldown([1, 2, 3, 0, 2], k=2))   # 3
print(max_profit_k_trades_with_cooldown([1, 2, 3, 0, 2], k=1))   # 2`,
    language: "python",
    complexity: { time: "O(n*k)", space: "O(k)" },
  },
  {
    id: "lc-20260905-margin-call-absorbing-markov",
    title: "Probability of a Margin Call Before Recovery in an Absorbing Markov Chain",
    difficulty: "medium",
    topics: ["probability", "markov-chain"],
    problem:
      "A position's collateral level moves between discrete states 0..N each day, transitioning according to a given N+1 by N+1 transition matrix. State 0 is 'margin called' (absorbing) and state N is 'fully recovered / desk closes the watch' (absorbing). Given the matrix and a starting state s, compute the probability of eventually being margin-called (hitting state 0) rather than recovering (hitting state N).",
    examples: [
      {
        input:
          "N=3, P=[[1,0,0,0],[0.3,0.2,0.4,0.1],[0.1,0.3,0.2,0.4],[0,0,0,1]], s=1",
        output: "approximately 0.538",
        explanation:
          "States 0 and 3 are absorbing; states 1 and 2 are transient. Starting in state 1, solve the linear system for absorption probabilities into state 0.",
      },
    ],
    constraints: [
      "2 <= N+1 <= 200",
      "each row of P sums to 1",
      "state 0 and state N are absorbing (P[0][0]=1, P[N][N]=1)",
    ],
    approach:
      "This is the standard absorbing Markov chain setup: let h(i) be the probability of eventual absorption into state 0 starting from state i. For the two absorbing states, h(0)=1 and h(N)=0 by definition. For every transient state i, h(i) = sum over all states j of P[i][j] * h(j), which is just the law of total probability conditioning on the next step -- giving a linear system in the unknown h values for the transient states. Rearranging into (I - Q) h_transient = b, where Q is the transition sub-matrix restricted to transient states and b collects the P[i][0] terms (direct one-step absorption probability into state 0 from each transient state), solves the whole system in one linear-algebra call rather than iterating. This is exactly the fundamental-matrix approach from absorbing Markov chain theory -- solving a linear system beats simulating millions of random walks both for exactness and for speed.",
    code: `import numpy as np

def prob_absorbed_at_zero(P: list[list[float]], start: int) -> float:
    n = len(P)
    P = np.array(P, dtype=float)

    # state 0 and state n-1 are the two absorbing states; everything else is transient
    transient = [i for i in range(1, n - 1)]
    if start == 0:
        return 1.0
    if start == n - 1:
        return 0.0

    idx = {state: k for k, state in enumerate(transient)}
    m = len(transient)

    Q = np.zeros((m, m))     # transition probabilities among transient states only
    b = np.zeros(m)          # direct one-step probability of hitting state 0

    for i, si in enumerate(transient):
        b[i] = P[si, 0]
        for j, sj in enumerate(transient):
            Q[i, j] = P[si, sj]

    # (I - Q) h = b  -- the absorbing-chain linear system for hitting probabilities
    h_transient = np.linalg.solve(np.eye(m) - Q, b)
    return h_transient[idx[start]]

P = [
    [1.0, 0.0, 0.0, 0.0],
    [0.3, 0.2, 0.4, 0.1],
    [0.1, 0.3, 0.2, 0.4],
    [0.0, 0.0, 0.0, 1.0],
]
print(round(prob_absorbed_at_zero(P, start=1), 3))   # ~0.538
print(round(prob_absorbed_at_zero(P, start=2), 3))   # lower -- closer to the recovery state`,
    language: "python",
    complexity: { time: "O(m^3) for the linear solve, m = number of transient states", space: "O(m^2)" },
  },
  {
    id: "lc-20260905-design-rolling-vwap-expiring-ticks",
    title: "Design a Rolling VWAP Tracker Over a Fixed Trailing Time Window",
    difficulty: "medium",
    topics: ["design", "sliding-window"],
    problem:
      "Design a class that ingests trade ticks add_trade(timestamp, price, volume) in non-decreasing timestamp order, and supports vwap(now) returning the volume-weighted average price over only the trades in the trailing window_seconds up to now, automatically expiring older trades. Assume vwap() is always called with a now >= the last added timestamp.",
    examples: [
      {
        input:
          "window_seconds=10; add_trade(1,100,50); add_trade(5,102,30); add_trade(12,101,20); vwap(12)",
        output: "101.6",
        explanation:
          "At time 12 with a 10-second window, the trade at t=1 (12-1=11 > 10) has expired; only t=5 (price 102, vol 30) and t=12 (price 101, vol 20) remain, giving VWAP = (102*30 + 101*20) / (30+20) = 101.6.",
      },
    ],
    constraints: [
      "1 <= number of calls <= 10^5",
      "timestamps are non-decreasing across add_trade calls",
      "0 < volume, price",
    ],
    approach:
      "Use a deque of (timestamp, price, volume) holding only trades currently inside the window, plus two running accumulators: sum_pv (sum of price*volume) and sum_v (sum of volume) for exactly the trades in the deque -- this avoids recomputing the weighted sum from scratch on every call. On add_trade, append to the deque and add its price*volume and volume into the running sums. On vwap(now), first expire from the left: while the deque's front timestamp is older than now - window_seconds, pop it and subtract its contribution from both running sums, then return sum_pv / sum_v (or a defined value like None/0 if the deque is empty). Because add_trade only ever appends and expiry only ever pops from the front, and each trade is popped at most once over its lifetime, total work across all calls is O(total trades) despite vwap() looking like it could rescan the whole window every time.",
    code: `from collections import deque

class RollingVWAP:
    def __init__(self, window_seconds: float):
        self.window = window_seconds
        self.trades: deque[tuple[float, float, float]] = deque()  # (ts, price, volume)
        self.sum_pv = 0.0
        self.sum_v = 0.0

    def add_trade(self, timestamp: float, price: float, volume: float) -> None:
        self.trades.append((timestamp, price, volume))
        self.sum_pv += price * volume
        self.sum_v += volume

    def _expire(self, now: float) -> None:
        cutoff = now - self.window
        # only the front of the deque can be stale, since timestamps are
        # non-decreasing and trades expire strictly in arrival order
        while self.trades and self.trades[0][0] < cutoff:
            ts, price, volume = self.trades.popleft()
            self.sum_pv -= price * volume
            self.sum_v -= volume

    def vwap(self, now: float) -> float | None:
        self._expire(now)
        if self.sum_v == 0:
            return None
        return self.sum_pv / self.sum_v

tracker = RollingVWAP(window_seconds=10)
tracker.add_trade(1, 100, 50)
tracker.add_trade(5, 102, 30)
tracker.add_trade(12, 101, 20)
print(round(tracker.vwap(12), 3))   # 101.6 -- the t=1 trade has expired out of the window`,
    language: "python",
    complexity: { time: "O(1) amortized per call", space: "O(trades in window)" },
  },
];
