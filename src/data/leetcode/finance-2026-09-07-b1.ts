import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-07
// A bounded top-K heap tracker over a trade-volume stream, a
// minimum-window-substring variant for covering required hedge
// legs, a multi-transaction stock DP with a per-trade fee, the
// expected-duration cousin of the gambler's-ruin inventory walk,
// and a FIFO lot-matched position tracker design problem.
// ============================================================

export const financeBatch20260907: LeetCodeProblem[] = [
  {
    id: "lc-20260907-topk-active-tickers-heap",
    title: "Maintain the Top-K Highest-Volume Tickers Across a Stream of Trade Updates",
    difficulty: "medium",
    topics: ["heap", "hash-map"],
    problem:
      "You receive a stream of trade updates, each (ticker, volume_traded), where the same ticker can appear multiple times and its cumulative volume keeps growing. After each update, you need to be able to report the current top-K tickers by cumulative volume. Design update(ticker, volume_traded) and get_top_k() methods.",
    examples: [
      {
        input: "k=2; update('AAPL',100); update('MSFT',50); update('AAPL',80); get_top_k()",
        output: "['AAPL','MSFT']",
        explanation:
          "AAPL's cumulative volume is 180, MSFT's is 50 -- both are in the top 2 trivially since there are only 2 tickers seen so far.",
      },
    ],
    constraints: [
      "1 <= k <= 10^4",
      "up to 10^6 update calls",
      "volume_traded > 0",
    ],
    approach:
      "Keep a hash map ticker -> cumulative volume for O(1) updates, and build the top-k only when get_top_k() is called rather than maintaining a heap on every single update -- with up to 10^6 updates but get_top_k() likely called far less often, doing heap maintenance on every update would waste work compared to using heapq.nlargest(k, ...) at query time, which runs in O(n log k) over the hash map's current state (n = distinct tickers seen). This sidesteps the classic difficulty with a persistently-maintained bounded heap for this exact problem: a heap doesn't support an efficient decrease/increase-key operation, so keeping a live top-k heap through repeated updates to the SAME ticker's volume would otherwise require either a full rebuild or a lazy-deletion scheme with stale entries filtered against the authoritative hash map -- real complexity that a query-time nlargest avoids entirely by construction.",
    code: `import heapq

class TopKActiveTickers:
    def __init__(self, k: int):
        self.k = k
        self.volumes: dict[str, int] = {}   # ticker -> authoritative cumulative volume

    def update(self, ticker: str, volume_traded: int) -> None:
        self.volumes[ticker] = self.volumes.get(ticker, 0) + volume_traded

    def get_top_k(self) -> list[str]:
        # lazy top-k at query time: O(n log k) using nlargest, correct by
        # construction since self.volumes is always the authoritative state --
        # no stale-heap-entry bookkeeping needed at all
        top = heapq.nlargest(self.k, self.volumes.items(), key=lambda item: item[1])
        return [ticker for ticker, _ in top]

tracker = TopKActiveTickers(k=2)
tracker.update("AAPL", 100)
tracker.update("MSFT", 50)
tracker.update("AAPL", 80)
print(tracker.get_top_k())   # ['AAPL', 'MSFT']
tracker.update("GOOG", 500)
print(tracker.get_top_k())   # ['GOOG', 'AAPL']`,
    language: "python",
    complexity: {
      time: "O(1) amortized per update, O(n log k) per get_top_k query, n = distinct tickers seen",
      space: "O(n)",
    },
  },
  {
    id: "lc-20260907-min-window-hedge-legs",
    title: "Minimum Window Containing At Least One Trade From Each Required Hedge Leg",
    difficulty: "hard",
    topics: ["sliding-window", "hash-map"],
    problem:
      "Given a chronological array of trade tickers and a set of required hedge legs (tickers that must all appear at least once), find the length of the shortest contiguous window of trades that contains at least one trade from every required leg. Return -1 if no such window exists.",
    examples: [
      {
        input: "trades=['AAPL','MSFT','AAPL','GOOG','MSFT','AAPL'], required={'MSFT','GOOG'}",
        output: "2",
        explanation:
          "The window ['GOOG','MSFT'] (indices 3-4) contains one trade from each required leg (GOOG, MSFT) and has length 2 -- the shortest possible since both legs must appear at all.",
      },
    ],
    constraints: [
      "1 <= trades.length <= 10^5",
      "1 <= required legs count <= trades length",
      "every required ticker appears somewhere in trades (else return -1)",
    ],
    approach:
      "This is the minimum-window-substring pattern (the classic 'smallest window containing all characters of T'), relabeled onto trade tickers. Expand a right pointer across the trades, maintaining a count of how many required tickers are currently satisfied (present in the window with count >= 1) via a hash map of required-ticker -> current window count. Once all required tickers are satisfied, shrink from the left as far as possible while staying fully satisfied, recording the window length each time it's still valid, then continue expanding right after the window breaks. The key subtlety versus a naive at-most-K-distinct window is that here EVERY required ticker (not just any K of them) must be present, so the 'satisfied' count only increments when a required ticker's count moves from 0 to 1, and only decrements on shrink when it would drop from 1 to 0 -- an already-satisfied ticker occurring again in the window doesn't help or hurt the satisfied count. Each trade enters and leaves the window at most once, so despite the nested shrink loop the whole scan is O(n).",
    code: `def min_window_all_legs(trades: list[str], required: set[str]) -> int:
    if not required:
        return 0

    need: dict[str, int] = {t: 0 for t in required}   # required ticker -> count still needed
    missing = len(required)   # how many required tickers are NOT yet satisfied
    left = 0
    best = float("inf")

    for right, ticker in enumerate(trades):
        if ticker in need:
            if need[ticker] == 0:
                missing -= 1   # this required ticker just became satisfied
            need[ticker] += 1

        # window is fully satisfied -- shrink from the left as far as possible
        while missing == 0:
            best = min(best, right - left + 1)
            left_ticker = trades[left]
            if left_ticker in need:
                need[left_ticker] -= 1
                if need[left_ticker] == 0:
                    missing += 1   # shrinking past this trade breaks the required leg
            left += 1

    return -1 if best == float("inf") else best

print(min_window_all_legs(
    ["AAPL", "MSFT", "AAPL", "GOOG", "MSFT", "AAPL"], required={"MSFT", "GOOG"}
))   # 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(number of required legs)" },
  },
  {
    id: "lc-20260907-max-profit-k-trades-fee",
    title: "Maximum Profit From At Most K Round Trips With a Per-Trade Fee",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given a single instrument's daily prices, a fixed per-transaction fee charged on every sell, and a maximum of K completed round trips (buy then later sell) allowed, with at most one open position at a time, find the maximum achievable profit.",
    examples: [
      {
        input: "prices=[3,2,6,5,0,3], k=2, fee=1",
        output: "5",
        explanation:
          "Buy at 2, sell at 6 (profit 4-1=3 after fee); buy at 0, sell at 3 (profit 3-1=2 after fee); total 5, using 2 of the allowed 2 round trips.",
      },
    ],
    constraints: [
      "1 <= prices.length <= 1000",
      "1 <= k <= 100",
      "0 <= fee <= 1000",
      "0 <= prices[i] <= 10^4",
    ],
    approach:
      "Classic 'Best Time to Buy and Sell Stock IV' generalized with a transaction fee, solved with a DP tracking two states per completed-sell count j: hold[j] = best profit so far having completed at most j sells and currently holding a share, and cash[j] = best profit so far having completed at most j sells and currently holding nothing. Transitions each day: hold[j] = max(hold[j] from yesterday (do nothing), cash[j-1] from yesterday minus today's price (buy today)); cash[j] = max(cash[j] from yesterday (do nothing), hold[j] from yesterday plus today's price minus the fee (sell today, completing round trip j)). The fee is charged once per completed round trip, so it's cleanest applied on the sell transition rather than split across buy and sell. Rolling the day dimension down to O(k) space -- updating cash[j] before hold[j] each day, in decreasing j order, so neither read uses an already-updated same-day value -- turns an O(n*k) time, O(n*k) space DP into O(n*k) time, O(k) space.",
    code: `def max_profit_k_trades_with_fee(prices: list[int], k: int, fee: int) -> int:
    if not prices or k == 0:
        return 0

    NEG_INF = float("-inf")
    # hold[j]: best profit so far, having completed <= j sells, currently holding
    # cash[j]: best profit so far, having completed <= j sells, currently flat
    hold = [NEG_INF] * (k + 1)
    cash = [0] * (k + 1)

    for price in prices:
        # process j from high to low so hold[j] and cash[j] both read
        # YESTERDAY's cash[j-1]/hold[j], not a value already updated today
        for j in range(k, 0, -1):
            cash[j] = max(cash[j], hold[j] + price - fee)   # sell today, completes round trip j
            hold[j] = max(hold[j], cash[j - 1] - price)      # buy today, starts round trip j

    return max(cash)   # best profit using AT MOST k completed round trips

print(max_profit_k_trades_with_fee([3, 2, 6, 5, 0, 3], k=2, fee=1))   # 5`,
    language: "python",
    complexity: { time: "O(n*k)", space: "O(k)" },
  },
  {
    id: "lc-20260907-expected-ticks-inventory-absorption",
    title: "Expected Number of Ticks Until a Market Maker's Inventory Hits Flat or the Risk Limit",
    difficulty: "medium",
    topics: ["probability", "math"],
    problem:
      "Same setup as the classic gambler's-ruin inventory walk: inventory starts at i shares, 0 < i < N, each tick moves +1 (probability p) or -1 (probability 1-p), and trading halts the instant inventory hits 0 or N. Compute the expected number of ticks until trading halts, given N, i, and p.",
    examples: [
      {
        input: "N=10, i=4, p=0.5",
        output: "24.0",
        explanation:
          "For a fair (p=0.5) walk, expected ticks to absorption reduces to the closed form i*(N-i) = 4*6 = 24.",
      },
    ],
    constraints: ["2 <= N <= 10^5", "0 < i < N", "0 < p < 1"],
    approach:
      "This is the expected-DURATION cousin of the absorption-probability gambler's-ruin problem (which asks WHICH boundary is hit first, not how long it takes). Let e(k) be the expected number of ticks to absorption starting from inventory k. The recursion e(k) = 1 + p*e(k+1) + (1-p)*e(k-1), with boundary conditions e(0) = e(N) = 0, has a known closed form that again splits into a fair and biased case. For p = 0.5 (unbiased), e(i) = i * (N - i) -- a clean product, largest at the midpoint and zero at either boundary, matching the intuition that starting exactly between two absorbing barriers takes the longest to resolve either way. For p != 0.5 (biased), the formula involves the same r = (1-p)/p ratio as the absorption-probability version: e(i) = i/(1-2p) - (N/(1-2p)) * (1 - r^i)/(1 - r^N). Both cases require guarding p = 0.5 as an explicit special case, since the biased formula divides by (1 - 2p), which is exactly zero there -- the same kind of 0/0 degeneracy as the absorption-probability formula's r = 1 case, just showing up in a different denominator.",
    code: `def expected_ticks_to_absorption(N: int, i: int, p: float) -> float:
    if p == 0.5:
        # (1 - 2p) = 0 here -- the general formula is 0/0, and the true
        # limiting case is this clean closed form instead
        return float(i * (N - i))

    r = (1 - p) / p
    return i / (1 - 2 * p) - (N / (1 - 2 * p)) * (1 - r ** i) / (1 - r ** N)

print(round(expected_ticks_to_absorption(N=10, i=4, p=0.5), 2))    # 24.0 -- fair walk
print(round(expected_ticks_to_absorption(N=10, i=4, p=0.55), 2))   # shorter -- mild bias resolves faster
print(round(expected_ticks_to_absorption(N=10, i=4, p=0.45), 2))   # shorter -- mild bias resolves faster`,
    language: "python",
    complexity: { time: "O(log i + log N) for the power operations", space: "O(1)" },
  },
  {
    id: "lc-20260907-design-fifo-lot-position-tracker",
    title: "Design a FIFO Lot-Matched Position Tracker With Realized P&L",
    difficulty: "medium",
    topics: ["design", "queue"],
    problem:
      "Design a class tracking a single instrument's position using FIFO (first-in-first-out) lot matching: buy(quantity, price) adds a new lot; sell(quantity, price) closes quantity against the OLDEST open lots first, and returns the realized P&L from that sell (splitting a lot if the sell quantity doesn't align exactly with a lot's remaining size). Also support net_position() returning the current share count.",
    examples: [
      {
        input: "buy(100, 10.0); buy(50, 12.0); sell(120, 15.0)",
        output: "sell returns 560.0",
        explanation:
          "The sell of 120 shares closes the full first lot (100 @ 10.0, profit 100*(15-10)=500) plus 20 of the second lot (20 @ 12.0, profit 20*(15-12)=60) -- FIFO uses the oldest lot first and only touches the second lot for the remaining 20 shares -- for a total realized P&L of 500+60=560.",
        },
    ],
    constraints: [
      "quantities and prices are positive",
      "a sell never exceeds the current net position",
      "up to 10^5 buy/sell calls",
    ],
    approach:
      "Use a deque of lots, each a mutable [quantity, price] entry, appended on buy() (added to the back) and consumed from the front (oldest first) on sell(). On sell(), repeatedly inspect the front of the deque: if the front lot's quantity is <= the remaining sell quantity, consume it entirely (add its full profit contribution, popleft it, and reduce the remaining sell quantity by its size); if the front lot's quantity is greater than the remaining sell quantity, consume only PART of it (add the partial profit, decrement the lot's own quantity in place, and set the remaining sell quantity to 0, ending the loop without popping the lot, since it still has shares left). A deque is the right structure specifically because FIFO consumption only ever touches the front, giving O(1) amortized access per lot fully consumed, and it naturally represents 'the oldest lot' as whichever entry currently sits at index 0 without needing to search.",
    code: `from collections import deque

class FIFOPositionTracker:
    def __init__(self):
        self.lots = deque()   # each entry: [quantity, price], oldest lot at the front

    def buy(self, quantity: int, price: float) -> None:
        self.lots.append([quantity, price])   # new lot goes to the back -- FIFO order

    def sell(self, quantity: int, price: float) -> float:
        remaining = quantity
        realized_pnl = 0.0

        while remaining > 0:
            lot_qty, lot_price = self.lots[0]   # always close the OLDEST lot first

            if lot_qty <= remaining:
                # this whole lot is consumed by the sell
                realized_pnl += lot_qty * (price - lot_price)
                remaining -= lot_qty
                self.lots.popleft()
            else:
                # sell only closes PART of this lot -- it stays at the front
                realized_pnl += remaining * (price - lot_price)
                self.lots[0][0] -= remaining
                remaining = 0

        return realized_pnl

    def net_position(self) -> int:
        return sum(qty for qty, _ in self.lots)

tracker = FIFOPositionTracker()
tracker.buy(100, 10.0)
tracker.buy(50, 12.0)
print(tracker.sell(120, 15.0))   # 560.0 -- 100 @ (15-10) + 20 @ (15-12)
print(tracker.net_position())    # 30 -- the remaining 30 shares of the second lot`,
    language: "python",
    complexity: {
      time: "O(1) amortized per unit of quantity touched across buy/sell (each lot fully consumed at most once)",
      space: "O(number of open lots)",
    },
  },
];
