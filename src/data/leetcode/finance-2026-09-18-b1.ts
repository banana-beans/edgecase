import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-18
// A heap-based top-K tracker for trade activity, a variable-size
// sliding window for a minimum required-ticker basket, a
// three-state DP for buy/sell with a cooldown, a boundary-value
// linear system for gambler's-ruin-style inventory risk, and an
// average-cost position tracker with realized P&L.
// ============================================================

export const financeBatch20260918: LeetCodeProblem[] = [
  {
    id: "lc-20260918-top-k-active-tickers",
    title: "Top K Most Active Tickers by Trade Count",
    difficulty: "easy",
    topics: ["heap", "hash-table"],
    problem:
      "Given a stream of trade events as (ticker, quantity) pairs and an integer k, return the k tickers with the highest total traded quantity, as a list of (ticker, total_quantity) pairs sorted by quantity descending. top_k(k) should be callable repeatedly as more trades keep arriving, without re-sorting the entire ticker universe from scratch each time being the only option.",
    examples: [
      {
        input: 'add_trade("AAPL",100); add_trade("MSFT",50); add_trade("AAPL",30); add_trade("GOOG",80); top_k(2)',
        output: "[('AAPL', 130), ('GOOG', 80)]",
        explanation:
          "AAPL's total is 100+30=130, the highest. GOOG's single trade of 80 is the second highest, ahead of MSFT's 50.",
      },
    ],
    constraints: ["up to 10^5 trades", "1 <= k <= number of distinct tickers seen"],
    approach:
      "Maintain a running total quantity per ticker in a hash map as trades arrive, an O(1) amortized update per trade. For top_k(k), use heapq.nlargest, which scans all n distinct tickers once while maintaining an internal heap of size k, giving O(n log k) rather than a full O(n log n) sort of every ticker. This avoids maintaining a persistent top-k heap structure across updates, which would need decrease-key/increase-key support that Python's heapq does not provide, in exchange for a straightforward O(n log k) per query -- a good tradeoff when top_k is called far less often than add_trade.",
    code: `import heapq
from collections import defaultdict

class TopActiveTickers:
    def __init__(self):
        self.totals: dict[str, int] = defaultdict(int)

    def add_trade(self, ticker: str, qty: int) -> None:
        self.totals[ticker] += qty   # O(1) amortized

    def top_k(self, k: int) -> list[tuple[str, int]]:
        # nlargest scans all n tickers with a size-k internal heap: O(n log k),
        # no full sort, and no persistent heap needing decrease-key support
        return heapq.nlargest(k, self.totals.items(), key=lambda kv: kv[1])

tracker = TopActiveTickers()
for ticker, qty in [("AAPL", 100), ("MSFT", 50), ("AAPL", 30), ("GOOG", 80)]:
    tracker.add_trade(ticker, qty)
print(tracker.top_k(2))   # [('AAPL', 130), ('GOOG', 80)]`,
    language: "python",
    complexity: { time: "O(1) amortized per add_trade, O(n log k) per top_k", space: "O(n)" },
  },
  {
    id: "lc-20260918-min-window-basket",
    title: "Minimum Window Containing a Full Basket of Required Tickers",
    difficulty: "medium",
    topics: ["sliding-window", "hash-table"],
    problem:
      "Given a chronological list of trade tickers (one ticker per trade, in time order) and a required basket of distinct tickers, return the length of the shortest contiguous run of trades that contains every ticker in the basket at least once. Return -1 if no such window exists.",
    examples: [
      {
        input: 'trades=["AAPL","MSFT","AAPL","GOOG","MSFT"], basket={"AAPL","GOOG"}',
        output: "2",
        explanation:
          "The window [trades[2], trades[3]] = [\"AAPL\", \"GOOG\"] contains both required tickers and has length 2, shorter than the window starting at index 0.",
      },
    ],
    constraints: ["1 <= trades.length <= 10^5", "1 <= basket.length <= trades.length"],
    approach:
      "This is the minimum-window-substring pattern applied to tickers instead of characters: expand a right pointer over the trade sequence, tracking how many of each required ticker are currently in the window and a single 'missing' counter for how many distinct basket tickers are still absent. Once missing reaches zero the window is valid, so greedily shrink from the left, recording the best length at each valid state, until shrinking further would drop a required ticker's count back to zero. Each index enters and leaves the window at most once across the whole scan, so despite the nested-looking shrink loop the total work is O(n).",
    code: `from collections import defaultdict

def min_window_basket(trades: list[str], basket: set[str]) -> int:
    if not basket:
        return 0

    need = {t: 1 for t in basket}   # each ticker just needs to appear at least once
    window_count = defaultdict(int)
    missing = len(basket)            # distinct basket tickers not yet in the window
    left = 0
    best = float("inf")

    for right, ticker in enumerate(trades):
        if ticker in need:
            if window_count[ticker] == 0:
                missing -= 1
            window_count[ticker] += 1

        # window satisfies the whole basket -- shrink from the left greedily
        while missing == 0:
            best = min(best, right - left + 1)
            left_ticker = trades[left]
            if left_ticker in need:
                window_count[left_ticker] -= 1
                if window_count[left_ticker] == 0:
                    missing += 1
            left += 1

    return best if best != float("inf") else -1

print(min_window_basket(["AAPL", "MSFT", "AAPL", "GOOG", "MSFT"], {"AAPL", "GOOG"}))   # 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(basket size)" },
  },
  {
    id: "lc-20260918-stock-cooldown",
    title: "Best Time to Buy and Sell Stock With Cooldown",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices, you may hold at most one share at a time and make unlimited transactions, but after selling you must wait one full day (a cooldown) before you may buy again. Return the maximum achievable profit.",
    examples: [
      {
        input: "prices=[1,2,3,0,2]",
        output: "3",
        explanation:
          "Buy at 1, sell at 2 (profit 1), cooldown one day, buy at 0, sell at 2 (profit 2). Total profit 1+2=3, better than any single round trip alone.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^4"],
    approach:
      "Track three running states day by day instead of an explicit table: hold (currently holding a share), sold (sold today, so tomorrow is a forced cooldown), and rest (not holding and free to buy). Each day's transitions only reference the PREVIOUS day's three values: hold stays the same or comes from buying out of yesterday's rest state; sold comes from selling out of yesterday's hold state; rest stays the same or comes from yesterday's sold state, since a cooldown day always transitions into being free to trade again. Three scalars replace an O(n)-sized DP table, so the whole thing runs in O(1) space.",
    code: `def max_profit_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    hold = -prices[0]   # holding a share
    sold = 0             # sold today -- tomorrow is a forced cooldown
    rest = 0             # not holding, free to buy today

    for price in prices[1:]:
        prev_hold, prev_sold, prev_rest = hold, sold, rest
        hold = max(prev_hold, prev_rest - price)   # keep holding, or buy from rest
        sold = prev_hold + price                    # sell today
        rest = max(prev_rest, prev_sold)             # stay resting, or cooldown day ends

    return max(sold, rest)   # end of period, best result requires not holding

print(max_profit_cooldown([1, 2, 3, 0, 2]))   # 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260918-gamblers-ruin",
    title: "Probability of Ruin for a Market Maker's Biased Inventory Walk",
    difficulty: "hard",
    topics: ["probability", "math"],
    problem:
      "A market maker's inventory does a random walk on integer lots 0..N. From any interior state i, inventory moves to i+1 with probability p (a buy fill) or to i-1 with probability q=1-p (a sell fill). The maker is 'ruined' if inventory hits 0 before it ever hits the risk limit N, forcing them to flatten. Given N, a starting inventory i, and p, return the probability of ruin.",
    examples: [
      {
        input: "N=4, i=2, p=0.5",
        output: "0.5",
        explanation:
          "A symmetric (fair) random walk starting exactly halfway between the two absorbing boundaries has probability of ruin equal to (N-i)/N, which is 2/4=0.5 here.",
      },
    ],
    constraints: ["1 <= N <= 200", "0 <= i <= N", "0 < p < 1"],
    approach:
      "This is the classical Gambler's Ruin problem: let P(i) be the probability of hitting 0 before N starting from state i, with boundary conditions P(0)=1 and P(N)=0, and the interior recurrence P(i) = p*P(i+1) + q*P(i-1) for 0 < i < N. Rather than deriving the geometric closed form for p != q from memory under interview time pressure (it divides by zero at p=q=0.5, where the answer degenerates to the linear (N-i)/N instead), solve the boundary-value system directly: it's N-1 interior linear equations in N-1 unknowns, plus the two boundary values, which any linear solver handles without needing the closed form at all.",
    code: `import numpy as np

def ruin_probability(N: int, i: int, p: float) -> float:
    if i <= 0:
        return 1.0
    if i >= N:
        return 0.0

    q = 1 - p
    # fast-path for the symmetric case: the geometric closed form for p != q
    # divides by zero here, and the true answer degenerates to a straight line
    if abs(p - q) < 1e-12:
        return (N - i) / N

    # general case: solve the boundary-value recurrence directly instead of
    # deriving the geometric closed form -- P(0)=1, P(N)=0, interior:
    # P(k) - p*P(k+1) - q*P(k-1) = 0
    A = np.zeros((N + 1, N + 1))
    b = np.zeros(N + 1)
    A[0, 0], b[0] = 1.0, 1.0
    A[N, N], b[N] = 1.0, 0.0
    for k in range(1, N):
        A[k, k] = 1.0
        A[k, k - 1] = -q
        A[k, k + 1] = -p

    P = np.linalg.solve(A, b)
    return float(P[i])

print(round(ruin_probability(4, 2, 0.5), 4))   # 0.5
print(round(ruin_probability(4, 2, 0.6), 4))   # < 0.5 -- a buy-side bias makes ruin at 0 less likely`,
    language: "python",
    complexity: { time: "O(N) unknowns solved via a tridiagonal system (the dense solve above is O(N^3))", space: "O(N)" },
  },
  {
    id: "lc-20260918-avg-cost-position-tracker",
    title: "Design an Average-Cost Position Tracker with Realized P&L",
    difficulty: "medium",
    topics: ["design", "hash-table"],
    problem:
      "Design a class tracking a trader's position in a single instrument using average-cost accounting. buy(qty, price) adds shares and updates the running average cost basis. sell(qty, price) reduces the position and realizes P&L as (sell_price - current_avg_cost) * qty, without changing the average cost of the shares that remain. avg_cost() returns the current average cost basis, and realized_pnl() returns cumulative realized P&L. Selling more than the current position should raise, since going short is out of scope.",
    examples: [
      {
        input: "buy(100,10.0); buy(100,12.0); sell(50,15.0)",
        output: "avg_cost() -> 11.0, realized_pnl() -> 200.0, shares -> 150",
        explanation:
          "The two buys blend to an average cost of (100*10+100*12)/200=11.0. Selling 50 shares at 15.0 realizes (15-11)*50=200 against that blended cost, and the average cost of the 150 remaining shares stays 11.0.",
      },
    ],
    constraints: ["quantities and prices are positive", "cannot sell more shares than currently held"],
    approach:
      "Average-cost accounting only needs two running numbers, not a list of individual lots: total shares held and total cost basis dollars invested. On a buy, both grow by the trade's own qty and qty times price -- a plain weighted-average update. On a sell, the defining fact of average-cost (as opposed to FIFO or LIFO lot matching) is that P&L realizes against the CURRENT blended average cost rather than any specific historical lot, so realized P&L is simply (sell_price - avg_cost) * qty, and the average cost of the remaining shares is left unchanged -- only total shares and the proportional cost basis shrink.",
    code: `class AvgCostPositionTracker:
    def __init__(self):
        self.shares = 0
        self.cost_basis = 0.0     # total dollars invested in the current position
        self.realized_pnl = 0.0

    def buy(self, qty: int, price: float) -> None:
        self.shares += qty
        self.cost_basis += qty * price   # weighted-average update, O(1)

    def sell(self, qty: int, price: float) -> None:
        if qty > self.shares:
            raise ValueError("cannot sell more than current position")

        avg = self.avg_cost()
        # realize against the CURRENT blended avg cost, not a specific lot --
        # this is what makes it average-cost accounting, not FIFO/LIFO
        self.realized_pnl += (price - avg) * qty
        self.shares -= qty
        self.cost_basis -= avg * qty   # remaining shares keep the SAME avg cost

    def avg_cost(self) -> float:
        return self.cost_basis / self.shares if self.shares else 0.0

tracker = AvgCostPositionTracker()
tracker.buy(100, 10.0)
tracker.buy(100, 12.0)
print(tracker.avg_cost(), tracker.shares)        # 11.0 200
tracker.sell(50, 15.0)
print(tracker.realized_pnl, tracker.avg_cost())  # 200.0 11.0 -- avg cost unchanged by the sell`,
    language: "python",
    complexity: { time: "O(1) per operation", space: "O(1)" },
  },
];
