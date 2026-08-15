import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-15
// A bounded max-heap for k-closest trade prices, a variable-size
// sliding window covering required tickers, a k-transaction stock
// DP with a large-k optimization, gambler's ruin probability, and
// a FIFO tax-lot position tracker with realized P&L.
// ============================================================

export const financeBatch20260815: LeetCodeProblem[] = [
  {
    id: "lc-k-closest-trades-to-price",
    title: "K Closest Trade Prices to a Reference Price",
    difficulty: "medium",
    topics: ["heap", "sorting"],
    problem:
      "Given a list of executed trade prices and a reference price target, return the k trade prices closest to target, ordered from closest to farthest. Ties (equal distance) break toward the lower price.",
    examples: [
      {
        input: "prices=[100.0, 102.5, 99.0, 101.0, 98.0], target=100.5, k=3",
        output: "[100.0, 101.0, 99.0]",
        explanation:
          "Distances to target: 100.0->0.5, 101.0->0.5, 99.0->1.5, 102.5->2.0, 98.0->2.5. The two closest are 100.0 and 101.0, tied at distance 0.5; the tie-break sends the lower price (100.0) first. Third closest is 99.0.",
      },
    ],
    constraints: ["1 <= k <= len(prices) <= 10^5"],
    approach:
      "Sorting all n prices by distance is O(n log n), wasteful when k is much smaller than n. The right tool is a bounded max-heap of size k: walk the prices once, push each one on, and whenever the heap exceeds size k, pop the worst (farthest, or farthest-with-highest-price on a tie) candidate -- this keeps only the k best seen so far at every point, in O(n log k) total. Python's heapq.nsmallest is exactly this bounded-heap algorithm under the hood once n and k make a full sort wasteful, and its key argument lets the tie-break ride along for free: keying each price by (abs(price - target), price) makes a smaller key both 'closer' and, on a distance tie, 'lower priced', which is precisely the ordering the problem wants, and nsmallest already returns results in ascending-key order so no extra sort is needed after.",
    code: `import heapq

def k_closest_trades(prices: list[float], target: float, k: int) -> list[float]:
    # nsmallest maintains a bounded max-heap of size k internally when k << n
    # (falls back to a full sort when k is close to n) -- O(n log k) either way.
    # key = (distance, price) makes lower price win ties at equal distance,
    # and nsmallest already returns results in ascending-key (closest-first) order.
    return heapq.nsmallest(k, prices, key=lambda p: (abs(p - target), p))`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-min-window-all-tickers",
    title: "Minimum Window Containing All Required Tickers",
    difficulty: "hard",
    topics: ["sliding-window", "hash-map"],
    problem:
      "Given a chronological list of ticker symbols representing a trade tape, and a set of required tickers, find the shortest contiguous window (by index) of the tape that contains at least one trade for every required ticker. Return the window as (start, end) indices (end exclusive), or None if no such window exists.",
    examples: [
      {
        input:
          'tape=["AAPL","MSFT","AAPL","GOOG","MSFT","AAPL"], required={"AAPL","GOOG","MSFT"}',
        output: "(1, 5)",
        explanation:
          'tape[1:5] = ["MSFT","AAPL","GOOG","MSFT"] contains all three required tickers and has length 4, the shortest such window -- no length-3 window covers AAPL, GOOG, and MSFT simultaneously.',
      },
    ],
    constraints: ["1 <= len(tape) <= 10^5", "1 <= len(required) <= len(tape)"],
    approach:
      "This is the classic variable-size sliding window pattern (same shape as 'minimum window substring'), adapted to tickers instead of characters. Track a Counter of how many more occurrences of each required ticker are still needed to satisfy the window, plus a running count of how many DISTINCT required tickers are currently fully satisfied. Expand the right edge one trade at a time, decrementing the need for that ticker; once every required ticker is satisfied, greedily shrink from the left as far as possible while the window stays fully covering, recording the window whenever it beats the current best. Each index enters and leaves the window boundary at most once across the whole scan, so despite the nested-looking while loop the total work is O(n).",
    code: `from collections import Counter

def min_window_covering(tape: list[str], required: set[str]) -> tuple[int, int] | None:
    if not required:
        return None
    need = Counter(required)    # remaining count needed per required ticker
    missing = len(need)          # distinct required tickers not yet satisfied
    best: tuple[int, int] | None = None
    left = 0

    for right, sym in enumerate(tape):
        if sym in need:
            need[sym] -= 1
            if need[sym] == 0:
                missing -= 1

        # window [left, right] fully covers required -- shrink from the left
        while missing == 0:
            if best is None or (right + 1 - left) < (best[1] - best[0]):
                best = (left, right + 1)
            left_sym = tape[left]
            if left_sym in need:
                need[left_sym] += 1
                if need[left_sym] == 1:   # this ticker just became unsatisfied again
                    missing += 1
            left += 1

    return best`,
    language: "python",
    complexity: { time: "O(n)", space: "O(len(required))" },
  },
  {
    id: "lc-max-profit-k-transactions",
    title: "Max Profit With At Most K Round-Trip Trades",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices and a limit of at most k buy-sell round trips (no overlapping holdings -- must sell before buying again), return the maximum achievable profit.",
    examples: [
      {
        input: "prices=[3,2,6,5,0,3], k=2",
        output: "7",
        explanation:
          "Buy at 2, sell at 6 for a profit of 4; buy at 0, sell at 3 for a profit of 3. Total profit 7, using exactly 2 of the allowed transactions.",
      },
    ],
    constraints: ["0 <= len(prices) <= 10^5", "0 <= k <= 100"],
    approach:
      "State-machine DP with two tracks per allowed transaction count j: hold[j] (max profit holding a share, currently on the j-th transaction) and cash[j] (max profit flat, having completed j full transactions). Transition per day: hold[j] = max(hold[j], cash[j-1] - price) (keep holding, or buy today funded by having completed j-1 trades already); cash[j] = max(cash[j], hold[j] + price) (stay flat, or sell today to complete the j-th trade). This is O(n*k), fine for small k, but the important optimization -- the kind an interviewer wants to see you catch -- is that once k >= n/2, capacity can never actually bind (you can't complete more than n/2 round trips in n days anyway), so the problem degenerates to the unlimited-transactions version, solvable greedily in O(n) by summing every positive day-over-day price move.",
    code: `def max_profit_k_transactions(prices: list[int], k: int) -> int:
    n = len(prices)
    if n == 0 or k == 0:
        return 0
    if k >= n // 2:
        # capacity no longer binds -- degenerates to the unlimited-transaction
        # problem, solved greedily by summing every positive daily move
        return sum(max(0, prices[i] - prices[i - 1]) for i in range(1, n))

    hold = [float("-inf")] * (k + 1)   # hold[j]: max profit, holding, on trade j
    cash = [0] * (k + 1)               # cash[j]: max profit, flat, j trades done
    for price in prices:
        for j in range(1, k + 1):
            hold[j] = max(hold[j], cash[j - 1] - price)
            cash[j] = max(cash[j], hold[j] + price)
    return cash[k]`,
    language: "python",
    complexity: { time: "O(n * min(k, n))", space: "O(k)" },
  },
  {
    id: "lc-gamblers-ruin-probability",
    title: "Gambler's Ruin: Probability of Reaching a Profit Target Before Going Bust",
    difficulty: "medium",
    topics: ["probability", "dynamic-programming"],
    problem:
      "A trader starts with i units of capital and makes repeated unit-sized bets; each bet wins (+1) with probability p and loses (-1) with probability 1-p, independent across bets. The trader stops upon reaching capital N (target) or capital 0 (ruin). Given i, N, and p, return the probability the trader reaches N before going bust.",
    examples: [
      {
        input: "i=2, N=5, p=0.5",
        output: "0.4",
        explanation:
          "With a fair game (p=0.5) the classic gambler's ruin closed form reduces to i/N: 2/5 = 0.4.",
      },
      {
        input: "i=2, N=5, p=0.4",
        output: "~0.1896",
        explanation:
          "With a losing edge (p<0.5) ruin probability rises sharply versus the fair case: using r=(1-p)/p=1.5, the closed form gives (1 - r^2) / (1 - r^5) = (1 - 2.25) / (1 - 7.59375) = 0.1896.",
      },
    ],
    constraints: ["0 <= i <= N <= 10^4", "0 < p < 1"],
    approach:
      "Let P(i) be the probability of reaching N before 0, starting from capital i. Conditioning on the first bet gives the recursive relation P(i) = p*P(i+1) + (1-p)*P(i-1), with boundary conditions P(0)=0 and P(N)=1 -- this is a linear recurrence with constant coefficients, solvable in closed form. For a fair game (p=0.5) the recurrence collapses to P(i) being linear in i, giving the clean P(i)=i/N. For p != 0.5, writing r = (1-p)/p, the general solution is P(i) = (1 - r^i) / (1 - r^N). A DP that fills a table of size N+1 bottom-up from the boundary conditions is the fallback if you don't trust deriving the closed form live, and is also more numerically robust for large N with r far from 1, where r^N can under/overflow in floating point -- computing in log-space or clamping is the practical fix there.",
    code: `def gamblers_ruin_probability(i: int, N: int, p: float) -> float:
    if i <= 0:
        return 0.0
    if i >= N:
        return 1.0
    if p == 0.5:
        return i / N   # fair game: probability is simply the capital share

    q = 1 - p
    r = q / p
    # closed form solving P(i) = p*P(i+1) + q*P(i-1), P(0)=0, P(N)=1
    return (1 - r ** i) / (1 - r ** N)`,
    language: "python",
    complexity: { time: "O(1) closed form (O(N) for the DP table alternative)", space: "O(1)" },
  },
  {
    id: "lc-design-fifo-position-tracker",
    title: "Design a FIFO Position Tracker With Realized P&L",
    difficulty: "medium",
    topics: ["design", "queue"],
    problem:
      "Design a class tracking a single instrument's position that supports trade(qty, price), where qty is positive for a buy and negative for a sell. Buys and sells open cost-basis lots on their own side; an offsetting trade consumes the OLDEST opposite-side lots first (FIFO), realizing P&L against each lot's price as it's consumed, and any leftover trade quantity after all opposite-side lots are exhausted opens a new lot on the trade's own side. Support current_position() (net signed quantity) and realized_pnl() (cumulative realized P&L across all trades so far).",
    examples: [
      {
        input: "trade(100,10.0); trade(50,12.0); trade(-120,15.0); current_position(); realized_pnl()",
        output: "30, 560.0",
        explanation:
          "Buy 100@10 and buy 50@12 create two FIFO lots. Selling 120 consumes lot 1 (100 shares@10) entirely for 100*(15-10)=500 realized, then 20 shares from lot 2 (@12) for 20*(15-12)=60 realized, leaving 30 shares of lot 2 as the remaining long position. Net position = 30, cumulative realized P&L = 500 + 60 = 560.",
      },
    ],
    approach:
      "Model the position as a deque of [qty, price] lots all on the same side, consumed from the front (oldest) on any offsetting trade -- the FIFO tax-lot convention, as opposed to LIFO or average-cost. An incoming trade first offsets existing OPPOSITE-side lots one at a time from the front: for each matched lot, realized P&L is side * (trade_price - lot_price) * matched_qty, where side is the sign of the lots being consumed (+1 for long lots being sold, -1 for short lots being covered), which naturally gives the right sign in both directions. This continues until either the trade quantity is fully absorbed or the opposite-side lots run out; any leftover quantity then opens (or adds to) a lot on the trade's own side, correctly handling a trade that flips the position through flat in one call. This is the same repeated pop-front/partially-consume/push-back deque pattern used elsewhere for sliding-window medians and iceberg order replenishment.",
    code: `from collections import deque

class FifoPositionTracker:
    def __init__(self):
        self.lots: deque = deque()   # [qty, price] lots, all same side
        self.side = 0                 # +1 long, -1 short, 0 flat
        self.realized = 0.0

    def trade(self, qty: float, price: float) -> None:
        trade_side = 1 if qty > 0 else -1
        remaining = abs(qty)

        # offset existing opposite-side lots first, FIFO (oldest lot first)
        while remaining > 0 and self.lots and self.side == -trade_side:
            lot_qty, lot_price = self.lots[0]
            matched = min(remaining, lot_qty)
            # self.side (not trade_side) gives the correct sign for both a
            # long lot being sold and a short lot being covered
            self.realized += self.side * (price - lot_price) * matched
            remaining -= matched
            if matched == lot_qty:
                self.lots.popleft()
            else:
                self.lots[0][0] -= matched

        if remaining > 0:
            # opposite side exhausted (or none existed): open/add a lot on
            # the trade's own side -- handles flipping through flat cleanly
            self.side = trade_side
            self.lots.append([remaining, price])
        if not self.lots:
            self.side = 0

    def current_position(self) -> float:
        return self.side * sum(q for q, _ in self.lots)

    def realized_pnl(self) -> float:
        return self.realized`,
    language: "python",
    complexity: { time: "O(1) amortized per unit matched", space: "O(number of open lots)" },
  },
];
