import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-11
// A bounded top-k heap, a two-deque drawdown window, cooldown
// stock DP, gambler's-ruin EXPECTED DURATION (complements the
// ruin-probability problem), and an average-cost position
// tracker.
// ============================================================

export const financeBatch20260811: LeetCodeProblem[] = [
  {
    id: "lc-k-closest-trades-arrival-price",
    title: "K Closest Trades to Arrival Price",
    difficulty: "medium",
    topics: ["heap", "top-k"],
    problem:
      "Given a list of trade prices executed during a session and a reference arrivalPrice (the price your algo intended to trade at), return the k trade prices closest to arrivalPrice, in any order. Distance is the absolute difference. Do better than sorting the full list when k is much smaller than n.",
    examples: [
      {
        input: "prices=[101,95,103,99,107], arrival=100, k=3",
        output: "[101, 99, 103]",
        explanation:
          "Distances from 100 are 1, 5, 3, 1, 7 -- the three smallest belong to 101, 99, and 103.",
      },
    ],
    constraints: ["1 <= k <= len(prices) <= 10^5"],
    approach:
      "Sorting all n prices by distance is O(n log n) and wasteful when k is small. Instead keep a bounded max-heap of size k on distance, via negation since heapq is a min-heap: push the first k prices, then for every later price only replace the heap's current worst-kept entry if the new price is strictly closer. Because the heap never exceeds size k, each push/pop costs O(log k) instead of O(log n), giving O(n log k) total -- the standard bounded-heap pattern for streaming top-k selection, here applied to nearest-price instead of largest-value.",
    code: `import heapq

def k_closest_trades(prices: list[float], arrival: float, k: int) -> list[float]:
    heap = []   # max-heap via negation: (-distance, price), capped at size k
    for p in prices:
        d = abs(p - arrival)
        if len(heap) < k:
            heapq.heappush(heap, (-d, p))
        elif d < -heap[0][0]:          # closer than the current worst-kept entry
            heapq.heapreplace(heap, (-d, p))
    return [p for _, p in heap]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-longest-window-bounded-drawdown",
    title: "Longest Window With Bounded Drawdown",
    difficulty: "medium",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given daily prices and a fractional limit, find the length of the longest contiguous window such that within that window the lowest price is never below (1 - limit) times the highest price -- i.e. the peak-to-trough drawdown inside the window never exceeds limit. Return that length.",
    examples: [
      {
        input: "prices=[100,103,98,101,90], limit=0.05",
        output: "4",
        explanation:
          "The window [100,103,98,101] has max 103 and min 98; 98 is within 5% of 103 (0.95*103=97.85 <= 98). Extending to include 90 breaks the bound, since 90 sits more than 5% below every possible peak in that window.",
      },
    ],
    constraints: ["1 <= len(prices) <= 10^5", "0 < limit < 1"],
    approach:
      "Maintain two monotonic deques over a sliding window [left, right]: a max-deque (values decreasing front-to-back) and a min-deque (values increasing front-to-back), the standard technique for tracking a window's running max and min in amortized O(1) per step. As right expands, pop from the back of each deque while the incoming price breaks its monotonic order, then push. While the window's max times (1 - limit) exceeds its min -- the drawdown bound is violated -- advance left, evicting indices from the front of either deque once they fall outside the window. Track the best window length seen. This is the same two-deque skeleton as the classic bounded-difference sliding window, with a multiplicative bound in place of an additive one.",
    code: `from collections import deque

def longest_bounded_drawdown_window(prices: list[float], limit: float) -> int:
    max_dq: deque[int] = deque()   # indices, prices decreasing front-to-back
    min_dq: deque[int] = deque()   # indices, prices increasing front-to-back
    left = 0
    best = 0
    for right, p in enumerate(prices):
        while max_dq and prices[max_dq[-1]] <= p:
            max_dq.pop()
        max_dq.append(right)
        while min_dq and prices[min_dq[-1]] >= p:
            min_dq.pop()
        min_dq.append(right)

        # shrink from the left while the window's drawdown exceeds the limit
        while prices[min_dq[0]] < (1 - limit) * prices[max_dq[0]]:
            if max_dq[0] == left:
                max_dq.popleft()
            if min_dq[0] == left:
                min_dq.popleft()
            left += 1

        best = max(best, right - left + 1)
    return best`,
    language: "python",
    complexity: { time: "O(n) amortized", space: "O(n) worst case" },
  },
  {
    id: "lc-buy-sell-stock-cooldown",
    leetcodeNumber: 309,
    title: "Best Time to Buy and Sell Stock with Cooldown",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Maximize profit trading a single stock with unlimited transactions, where after selling you must wait one full day of cooldown before buying again. No transaction fee.",
    examples: [
      {
        input: "prices=[1,2,3,0,2]",
        output: "3",
        explanation:
          "Buy at 1, sell at 2 (profit 1), cooldown, buy at 0, sell at 2 (profit 2); total 3.",
      },
    ],
    approach:
      "Three rolling states per day, no array needed: hold (currently own a share), sold (sold TODAY, so tomorrow is a forced cooldown), and rest (not holding and free to buy, i.e. not in the cooldown day right after a sale). Transitions: new hold is the better of keeping the position or buying from rest; new sold is hold plus today's price; new rest is the better of staying rest or the cooldown from yesterday's sold ending. The subtle bug: rest's update must read sold's value from BEFORE this iteration overwrote it, or the code illegally lets you buy on the very cooldown day a sale just created -- snapshot the previous sold first.",
    code: `def max_profit_cooldown(prices: list[int]) -> int:
    hold = float('-inf')   # currently holding a share
    sold = 0                # sold TODAY -- tomorrow is a forced cooldown
    rest = 0                # not holding, free to buy (cooldown already elapsed)
    for p in prices:
        prev_sold = sold                       # snapshot before overwriting
        sold = hold + p                        # sell today
        hold = max(hold, rest - p)             # keep holding, or buy from rest
        rest = max(rest, prev_sold)            # stay resting, or cooldown just ended
    return max(sold, rest)`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-expected-trades-to-profit-target",
    title: "Expected Number of Trades to Reach a Profit Target",
    difficulty: "hard",
    topics: ["probability", "random-walk", "math"],
    problem:
      "A market maker's inventory P&L moves by +1 tick with probability p and -1 tick with probability 1-p on each trade, independently. Starting at P&L 0, compute the EXPECTED number of trades until the P&L first reaches either +takeProfit (take profit) or -stopLoss (stop loss). Do not simulate -- give a closed-form computation.",
    examples: [
      {
        input: "p=0.5, take_profit=3, stop_loss=3",
        output: "9.0",
        explanation:
          "A fair walk with symmetric barriers a distance of 3 on either side: the classic gambler's-ruin duration formula gives distance-to-lower times distance-to-upper, 3*3=9.",
      },
    ],
    constraints: ["0 < p < 1", "take_profit > 0, stop_loss > 0"],
    approach:
      "This is the gambler's-ruin problem's companion question -- not the probability of ruin (covered elsewhere in this bank) but the EXPECTED DURATION until absorption at either barrier. Shift coordinates so the two absorbing barriers sit at 0 (the stop-loss level) and total = takeProfit + stopLoss (the take-profit level), with the walk starting at index stopLoss. The classical closed form for expected steps to absorption, derived from solving the linear recurrence D(i) = 1 + p*D(i+1) + (1-p)*D(i-1) with D(0)=D(total)=0, is D(i) = i*(total-i) when p=0.5 (fair walk), and a ratio-of-geometric-series expression when p != 0.5. Both branches are O(1) with the closed form, versus exponential-in-range if you simulated or built a full DP table.",
    code: `def expected_trades_to_target(p: float, take_profit: int, stop_loss: int) -> float:
    # shift coordinates: absorbing barriers at 0 (== P&L -stop_loss) and
    # total (== P&L +take_profit); the walk starts at index start below.
    total = take_profit + stop_loss
    start = stop_loss
    q = 1.0 - p

    if abs(p - 0.5) < 1e-12:
        # fair walk: expected duration is distance-to-lower * distance-to-upper,
        # the martingale-based closed form (same family as the ruin-probability card)
        return float(start * (total - start))

    r = q / p
    # closed form from solving the absorption-time recurrence directly
    # (Feller's gambler's-ruin expected-duration formula)
    return start / (q - p) - (total / (q - p)) * (1 - r ** start) / (1 - r ** total)

# sanity checks against known special cases
print(round(expected_trades_to_target(0.5, 3, 3), 2))    # 9.0  -- symmetric closed form
print(round(expected_trades_to_target(0.6, 5, 5), 2))     # favorable walk reaches target faster`,
    language: "python",
    complexity: { time: "O(1) with the closed form", space: "O(1)" },
  },
  {
    id: "lc-average-cost-position-tracker",
    title: "Design an Average-Cost Position Tracker",
    difficulty: "medium",
    topics: ["design", "hash-map"],
    problem:
      "Design a tracker supporting buy(ticker, qty, price) and sell(ticker, qty, price) that maintains, per ticker, the current share count and volume-weighted average cost of the open position, and returns the REALIZED P&L generated by each sell using average-cost-basis accounting (not FIFO or LIFO lot matching). Assume sells never exceed the current position. Support position(ticker) returning (qty, avg_cost).",
    examples: [
      {
        input: "buy('AAPL',100,150); buy('AAPL',50,180); sell('AAPL',80,200)",
        output: "avg_cost=160.0 before the sell; realized=3200.0; remaining position (70, 160.0)",
        explanation:
          "Average cost after both buys is (100*150 + 50*180) / 150 = 160. A sell books realized P&L against that average cost and leaves it UNCHANGED -- only the quantity shrinks -- so realized = 80 * (200 - 160) = 3200.",
      },
    ],
    approach:
      "Maintain a dict from ticker to (qty, avg_cost). A buy is the only event that moves the average: new_avg is the quantity-weighted mean of the old position and the incoming lot, new_qty is their sum. A sell does NOT change avg_cost at all under average-cost accounting -- the remaining shares keep the same cost basis they always had -- it only realizes P&L as the traded quantity times (sale price minus the unchanged average cost) and shrinks the quantity. This is the accounting convention distinct from FIFO/LIFO, which would instead track individual lots and match sells against specific ones; average-cost collapses all lots into one blended number, trading lot-level precision for O(1) updates.",
    code: `class AvgCostTracker:
    def __init__(self):
        self.positions: dict[str, tuple[float, float]] = {}   # ticker -> (qty, avg_cost)

    def buy(self, ticker: str, qty: float, price: float) -> None:
        cur_qty, cur_avg = self.positions.get(ticker, (0.0, 0.0))
        new_qty = cur_qty + qty
        # weighted average cost basis -- ONLY buys move the average
        new_avg = (cur_qty * cur_avg + qty * price) / new_qty
        self.positions[ticker] = (new_qty, new_avg)

    def sell(self, ticker: str, qty: float, price: float) -> float:
        cur_qty, cur_avg = self.positions[ticker]
        realized = qty * (price - cur_avg)     # avg_cost is UNCHANGED by a sell
        new_qty = cur_qty - qty
        self.positions[ticker] = (new_qty, cur_avg if new_qty > 0 else 0.0)
        return realized

    def position(self, ticker: str) -> tuple[float, float]:
        return self.positions.get(ticker, (0.0, 0.0))`,
    language: "python",
    complexity: { time: "O(1) per operation", space: "O(number of tickers)" },
  },
];
