import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-25
// A top-k frequency heap problem, a minimum-window notional
// two-pointer problem, an at-most-K-transactions DP, a
// gambler's-ruin absorption-probability problem, and a FIFO
// position/P&L tracker design.
// ============================================================

export const financeBatch20260925: LeetCodeProblem[] = [
  {
    id: "lc-20260925-top-k-frequent-symbols",
    title: "Top K Most Traded Symbols",
    difficulty: "medium",
    topics: ["heap", "hash-map"],
    problem:
      "Given an array of ticker symbols representing one trade log (one entry per fill), and an integer k, return the k symbols with the highest trade COUNT, ordered from most to least frequent. Break ties alphabetically (the symbol that sorts first wins the tie).",
    examples: [
      {
        input: 'symbols=["AAPL","MSFT","AAPL","GOOG","MSFT","AAPL"], k=2',
        output: '["AAPL", "MSFT"]',
        explanation: "AAPL appears 3 times, MSFT 2 times, GOOG 1 time -- the two most frequent are AAPL then MSFT.",
      },
    ],
    constraints: ["1 <= len(symbols) <= 10^5", "1 <= k <= number of distinct symbols"],
    approach:
      "Count occurrences with a hash map in one pass, then select the top k by count without fully sorting every distinct symbol. Encode the ordering rule -- higher count wins, alphabetically earlier symbol wins a tie -- as a single sort key of (-count, symbol): sorting that key ASCENDING puts the highest count first, and on equal counts puts the alphabetically earlier symbol first, so heapq.nsmallest with that key does exactly the right selection while still using a size-k heap internally rather than sorting every one of the m distinct symbols.",
    code: `import heapq
from collections import Counter

def top_k_traded_symbols(symbols: list[str], k: int) -> list[str]:
    counts = Counter(symbols)   # one pass: symbol -> trade count

    # sort key (-count, symbol) ascending puts the highest count first,
    # and on a count tie puts the alphabetically earlier symbol first --
    # nsmallest does this selection with a size-k heap, not a full sort
    ranked = heapq.nsmallest(k, counts.items(), key=lambda item: (-item[1], item[0]))

    return [symbol for symbol, _ in ranked]

print(top_k_traded_symbols(["AAPL", "MSFT", "AAPL", "GOOG", "MSFT", "AAPL"], k=2))
# ['AAPL', 'MSFT']`,
    language: "python",
    complexity: { time: "O(n + m log k) where m is the number of distinct symbols", space: "O(m)" },
  },
  {
    id: "lc-20260925-min-window-target-notional",
    title: "Minimum Window Reaching a Target Notional",
    difficulty: "medium",
    topics: ["sliding-window", "two-pointer"],
    problem:
      "Given an array of per-minute traded notional (price times volume, always non-negative) and a target notional, return the length of the SHORTEST contiguous window of minutes whose summed notional is at least the target. Return 0 if no window reaches the target even using the entire array.",
    examples: [
      {
        input: "notional=[100, 50, 200, 30, 40], target=280",
        output: "3",
        explanation:
          "The window [50, 200, 30] (indices 1-3) sums to 280, meeting the target in 3 minutes -- no shorter window reaches 280.",
      },
    ],
    constraints: ["1 <= len(notional) <= 10^5", "notional[i] >= 0", "1 <= target <= 10^9"],
    approach:
      "Because every value is non-negative, a variable-size two-pointer window works in the OPPOSITE direction from the classic 'longest window under a cap' problem: expand the right edge accumulating a running sum, and each time the sum reaches or exceeds the target, greedily shrink from the left as far as possible while staying at or above the target, recording the shortest valid length seen at each such point before continuing to expand. Non-negativity is what makes shrinking-while-valid safe: removing the leftmost element can only decrease the sum, so the moment it drops below target, shrinking must stop for that position of the right edge. Each index enters and leaves the window once, so the whole scan is O(n) despite the nested loop shape.",
    code: `def min_window_for_target_notional(notional: list[int], target: int) -> int:
    left = 0
    window_sum = 0
    best = len(notional) + 1   # sentinel: larger than any real answer

    for right, v in enumerate(notional):
        window_sum += v
        # once the window is valid, shrink from the left as far as possible --
        # safe because notional is non-negative, so shrinking only ever
        # decreases the sum, and we stop the instant it would drop below target
        while window_sum >= target:
            best = min(best, right - left + 1)
            window_sum -= notional[left]
            left += 1

    return best if best <= len(notional) else 0

print(min_window_for_target_notional([100, 50, 200, 30, 40], target=280))
# 3
print(min_window_for_target_notional([1, 1, 1], target=10))
# 0 -- entire array never reaches the target`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260925-buy-sell-at-most-k-transactions",
    title: "Best Time to Buy and Sell Stock With At Most K Transactions",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices and an integer k, you may complete at most k non-overlapping buy-then-sell round trips (you must sell before buying again, and cannot hold more than one share at a time). Return the maximum achievable profit.",
    examples: [
      {
        input: "prices=[3,2,6,5,0,3], k=2",
        output: "7",
        explanation:
          "Buy day1 (2), sell day2 (6): profit 4. Buy day4 (0), sell day5 (3): profit 3. Total 4+3=7, using both allowed transactions.",
      },
    ],
    constraints: ["0 <= k <= 100", "0 <= prices.length <= 1000", "0 <= prices[i] <= 1000"],
    approach:
      "The naive DP is dp[t][i] = best profit using at most t transactions through day i, with the transition dp[t][i] = max(dp[t][i-1], prices[i] + max over j<i of (dp[t-1][j] - prices[j])) -- an O(n^2 k) triple loop from the inner max. Collapse the inner max into a single running variable carried forward as i advances: since dp[t-1][j] - prices[j] only ever needs its best value seen SO FAR at each step, track it as max_diff and update it incrementally each iteration, dropping the whole DP to O(nk). One more edge case matters: once k is at least n/2, there is no benefit to limiting transactions at all (you can never profitably transact more than n/2 times on n days), so that regime collapses to the familiar unlimited-transactions greedy sum of positive day-over-day differences, which also avoids allocating an O(nk) table unnecessarily for large k.",
    code: `def max_profit_k_transactions(k: int, prices: list[int]) -> int:
    n = len(prices)
    if n == 0 or k == 0:
        return 0

    # unlimited-transactions regime: k this large can never bind
    if k >= n // 2:
        return sum(max(prices[i + 1] - prices[i], 0) for i in range(n - 1))

    # dp[t][i]: best profit using AT MOST t transactions through day i
    dp = [[0] * n for _ in range(k + 1)]

    for t in range(1, k + 1):
        max_diff = -prices[0]   # running max of dp[t-1][j] - prices[j] for j < i
        for i in range(1, n):
            dp[t][i] = max(dp[t][i - 1], prices[i] + max_diff)
            max_diff = max(max_diff, dp[t - 1][i] - prices[i])

    return dp[k][n - 1]

print(max_profit_k_transactions(k=2, prices=[3, 2, 6, 5, 0, 3]))
# 7`,
    language: "python",
    complexity: { time: "O(n*k), or O(n) when k >= n/2", space: "O(n*k)" },
  },
  {
    id: "lc-20260925-gamblers-ruin-target-probability",
    title: "Probability of Hitting a Profit Target Before a Stop-Out",
    difficulty: "medium",
    topics: ["probability", "markov-chain", "math"],
    problem:
      "A trader's capital moves on an integer grid from 0 to N. Starting at integer capital i (0 < i < N), each round capital increases by 1 with probability p and decreases by 1 with probability 1-p. Trading stops the instant capital reaches 0 (stop-out) or N (profit target). Return the probability of reaching the profit target N before the stop-out.",
    examples: [
      {
        input: "i=4, N=10, p=0.5",
        output: "0.4",
        explanation:
          "For a fair coin (p=0.5), the classic gambler's-ruin result is simply i/N = 4/10 = 0.4 -- capital is a martingale, so the hitting probability is exactly linear in the starting point.",
      },
    ],
    constraints: ["0 <= i <= N <= 10^4", "0 < p < 1"],
    approach:
      "This is the classic gambler's ruin problem, and it has a closed form rather than needing simulation or a linear solve. Let P(i) be the probability of reaching N before 0, starting at i, with boundary conditions P(0)=0, P(N)=1, satisfying the recurrence P(i) = p*P(i+1) + (1-p)*P(i-1). For p != 0.5, substituting r = (1-p)/p gives P(i) = (1 - r^i) / (1 - r^N). For the symmetric case p = 0.5, the recurrence degenerates (r=1 makes the formula 0/0), and the direct solution is the linear P(i) = i/N, which also falls out as the limit of the general formula as r approaches 1. Using the closed form is O(1) versus solving an (N-1)x(N-1) linear system or running a Monte Carlo simulation, both of which are unnecessary here.",
    code: `def prob_reach_target_first(i: int, N: int, p: float) -> float:
    if i <= 0:
        return 0.0
    if i >= N:
        return 1.0

    if abs(p - 0.5) < 1e-12:
        return i / N   # symmetric walk: hitting probability is linear in i

    r = (1.0 - p) / p
    return (1.0 - r**i) / (1.0 - r**N)

print(prob_reach_target_first(i=4, N=10, p=0.5))
# 0.4
print(round(prob_reach_target_first(i=4, N=10, p=0.45), 4))
# a slight edge AGAINST the trader (p<0.5) drags the hitting probability
# below the naive linear guess of 0.4`,
    language: "python",
    complexity: { time: "O(1) with the closed form", space: "O(1)" },
  },
  {
    id: "lc-20260925-fifo-position-pnl-tracker",
    title: "Design a FIFO Position and Realized/Unrealized P&L Tracker",
    difficulty: "medium",
    topics: ["design", "queue"],
    problem:
      "Design a class PositionTracker supporting trade(side, price, size), recording a BUY or SELL fill and updating realized P&L using FIFO lot accounting (the oldest open lot on the opposite side is closed first), and unrealized_pnl(mark_price), returning the mark-to-market P&L of whatever position remains open at the given mark price. You may assume a single trade never flips the net position from long to short or vice versa (a trade that would close the entire existing position exactly zeroes it out at most).",
    examples: [
      {
        input:
          'trade("BUY", 100, 10); trade("BUY", 105, 5); trade("SELL", 110, 8); unrealized_pnl(108)',
        output: "realized_pnl = 80.0, unrealized_pnl(108) = 31.0",
        explanation:
          "Buy 10@100, buy 5@105 (two open long lots). Sell 8 consumes FIFO: all 8 from the first lot (100), realized = (110-100)*8 = 80. Remaining open lots: 2@100, 5@105. Unrealized at mark 108: (108-100)*2 + (108-105)*5 = 16+15 = 31.",
      },
    ],
    constraints: ["prices and sizes are positive numbers", "at most 10^5 calls total", "a single trade never crosses net position through zero and out the other side"],
    approach:
      "Track open lots in a deque of [price, signed_size] entries, where a positive signed_size is an open long lot and a negative one is an open short lot -- all lots in the deque share the same sign at any moment, since the no-flip assumption guarantees the position never crosses zero mid-trade. A trade whose direction matches the existing position (or opens a flat position) simply appends a new lot. A trade whose direction is OPPOSITE the existing position consumes lots from the FRONT of the deque (oldest first, hence FIFO) up to the trade's size: for each unit consumed from a long lot, realized P&L accrues (trade_price - lot_price); for a short lot, (lot_price - trade_price). A partially-consumed lot at the front has its remaining size reduced in place rather than being popped. unrealized_pnl simply marks every remaining open lot against the given price using the same per-unit formula, summed.",
    code: `from collections import deque

class PositionTracker:
    def __init__(self):
        self.lots: deque[list[float]] = deque()   # [price, signed_size], all lots share one sign
        self.realized_pnl = 0.0

    def _position(self) -> float:
        return sum(size for _, size in self.lots)

    def trade(self, side: str, price: float, size: float) -> None:
        signed = size if side == "BUY" else -size
        pos = self._position()

        if pos == 0 or (pos > 0) == (signed > 0):
            # opening or adding to a position in the same direction: new lot
            self.lots.append([price, signed])
            return

        # opposite direction: close existing lots FIFO, oldest first
        remaining = size
        while remaining > 0 and self.lots:
            lot_price, lot_size = self.lots[0]
            lot_abs = abs(lot_size)
            consumed = min(lot_abs, remaining)
            if lot_size > 0:       # closing a long lot via a sell
                self.realized_pnl += (price - lot_price) * consumed
            else:                  # closing a short lot via a buy
                self.realized_pnl += (lot_price - price) * consumed
            remaining -= consumed
            if consumed == lot_abs:
                self.lots.popleft()
            else:
                self.lots[0][1] = lot_size - consumed if lot_size > 0 else lot_size + consumed

    def unrealized_pnl(self, mark_price: float) -> float:
        total = 0.0
        for lot_price, lot_size in self.lots:
            if lot_size > 0:
                total += (mark_price - lot_price) * lot_size
            else:
                total += (lot_price - mark_price) * abs(lot_size)
        return total

tracker = PositionTracker()
tracker.trade("BUY", 100, 10)
tracker.trade("BUY", 105, 5)
tracker.trade("SELL", 110, 8)
print(tracker.realized_pnl)             # 80.0  -- (110-100)*8, all from the first lot
print(tracker.unrealized_pnl(108))      # (108-100)*2 + (108-105)*5 = 16 + 15 = 31.0`,
    language: "python",
    complexity: { time: "O(1) amortized per trade call", space: "O(number of open lots)" },
  },
];
