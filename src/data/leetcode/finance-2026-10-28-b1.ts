import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-28
// Kth-largest trade size in a live stream (fixed-size min-heap),
// longest window of daily returns allowing at most one down day
// (sliding window), max profit with unlimited trades under a
// minimum holding period (shift-register DP), gambler's-ruin
// probability of hitting a profit target before a stop-loss with
// an asymmetric win rate, and a FIFO-lot position tracker for
// realized P&L on partial sells (design).
// ============================================================

export const financeBatch20261028: LeetCodeProblem[] = [
  {
    id: "lc-20261028-kth-largest-streaming-trade-size",
    title: "Kth-Largest Trade Size Seen So Far, Updated After Every New Print",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given a stream of trade sizes (positive integers) arriving one at a time and an integer k, return, after each new trade, the k-th largest trade size among all trades seen so far, or -1 if fewer than k trades have arrived yet.",
    examples: [
      {
        input: "sizes = [300,100,500,200,500], k = 3",
        output: "[-1,-1,100,200,300]",
        explanation:
          "After 1 or 2 trades there aren't yet 3 prints, so -1. After {300,100,500} the 3rd largest is 100. After {300,100,500,200} the 3rd largest is 200. After {300,100,500,200,500} the 3rd largest is 300.",
      },
    ],
    constraints: ["1 <= sizes.length <= 10^5", "1 <= k <= 10^4", "1 <= sizes[i] <= 10^9"],
    approach:
      "Maintain a min-heap capped at size k holding the k LARGEST trade sizes seen so far. Push every new size in, and whenever the heap grows past k, pop its smallest element -- what survives is always exactly the k largest values, and the heap's root (its minimum) is by definition the k-th largest overall. This avoids ever re-sorting the full history: each update is O(log k) regardless of how many trades have arrived in total.",
    code: `import heapq

def kth_largest_stream(sizes: list[int], k: int) -> list[int]:
    heap: list[int] = []   # min-heap, capped at the k LARGEST sizes seen so far
    result: list[int] = []

    for size in sizes:
        heapq.heappush(heap, size)
        if len(heap) > k:
            heapq.heappop(heap)   # evict the smallest of the current top-k

        # once the heap holds exactly k elements, its root IS the k-th largest
        result.append(heap[0] if len(heap) == k else -1)

    return result

print(kth_largest_stream([300, 100, 500, 200, 500], k=3))
# [-1, -1, 100, 200, 300]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
    leetcodeNumber: 703,
  },
  {
    id: "lc-20261028-longest-window-at-most-one-down-day",
    title: "Longest Window of Daily Returns Allowing At Most One Down Day",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given an array of daily returns (each positive, zero, or negative), return the length of the longest contiguous subarray that contains at most one day with a negative return.",
    examples: [
      {
        input: "returns = [1,-1,2,3,-1,4]",
        output: "4",
        explanation:
          "[2,3,-1,4] (indices 2-5) has exactly one negative day and length 4. [1,-1,2,3] (indices 0-3) is also length 4 with one negative. No contiguous window containing both negative days (indices 1 and 4) is valid, and no single-negative window reaches length 5 here.",
      },
    ],
    constraints: ["1 <= returns.length <= 10^5"],
    approach:
      "Classic 'at most K bad elements' two-pointer window, with K fixed at 1. Expand the window by moving the right pointer and incrementing a running count of negative days; whenever that count exceeds 1, shrink from the left (decrementing the count only when the element leaving the window was itself negative) until the window is valid again. Track the best window length seen at every step of the expansion -- the window's validity is monotonic in exactly the way that makes two-pointer correct: once invalid, only shrinking from the left can fix it.",
    code: `def longest_window_one_down_day(returns: list[int]) -> int:
    left = 0
    down_days = 0
    best = 0

    for right, r in enumerate(returns):
        if r < 0:
            down_days += 1

        # shrink from the left until at most one negative day remains in the window
        while down_days > 1:
            if returns[left] < 0:
                down_days -= 1
            left += 1

        best = max(best, right - left + 1)

    return best

print(longest_window_one_down_day([1, -1, 2, 3, -1, 4]))
# 4`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 1493,
  },
  {
    id: "lc-20261028-max-profit-min-holding-period",
    title: "Max Profit With Unlimited Trades Where Every Position Must Be Held At Least M Days",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given a daily price array and an integer m, you may buy and sell an unlimited number of times, but once you buy on day i you are not allowed to sell until day i + m or later (you must hold for at least m days). Return the maximum achievable profit.",
    examples: [
      {
        input: "prices = [1,2,10], m = 2",
        output: "9",
        explanation:
          "Buy on day 0 at price 1. The earliest eligible sell day is day 0 + 2 = day 2 (price 10), since day 1 is only 1 day of holding. Selling on day 2 gives profit 10 - 1 = 9.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000", "1 <= m <= prices.length", "1 <= prices[i] <= 10^4"],
    approach:
      "Extend the usual 'cash / holding' DP with a shift-register of LOCKED states: locked[d] tracks the best profit while holding a position bought exactly d days ago, for d from 0 up to m-1, where a position only becomes sellable (UNLOCKED) once it has aged past locked[m-1]. Each day: a locked[m-1] position ages into unlocked; cash may improve by selling an unlocked position at today's price; and a brand-new locked[0] position may open by buying from cash. Every slot ages by exactly one day per step, which is what the shifted list comprehension does.",
    code: `def max_profit_min_holding(prices: list[int], m: int) -> float:
    NEG_INF = float("-inf")
    cash = 0.0
    unlocked = NEG_INF                     # holding, already eligible to sell
    locked = [NEG_INF] * m                 # locked[d]: holding, bought d days ago, not yet eligible

    for p in prices:
        # a position held locked[m-1] days as of yesterday becomes eligible TODAY
        new_unlocked = max(unlocked, locked[m - 1])
        # sell today using an unlocked position -- may use one that JUST unlocked
        new_cash = max(cash, new_unlocked + p)
        # buy today from cash (opens a brand-new locked[0] slot); every other
        # slot ages forward by one day
        new_locked = [cash - p] + locked[:-1]

        cash, unlocked, locked = new_cash, new_unlocked, new_locked

    return cash

print(max_profit_min_holding([1, 2, 10], m=2))
# 9.0`,
    language: "python",
    complexity: { time: "O(n * m)", space: "O(m)" },
  },
  {
    id: "lc-20261028-gamblers-ruin-profit-target-stop-loss",
    title:
      "Probability a Market Maker's P&L Hits a Profit Target Before a Stop-Loss, Given an Asymmetric Win Rate",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "A market maker's cumulative P&L moves in discrete one-tick steps starting from 0: up one tick with probability p, down one tick with probability 1 - p, independently each step. Given p and two positive integers a (profit target, in ticks above 0) and b (stop-loss, in ticks below 0), compute the probability the P&L reaches +a before it reaches -b.",
    examples: [
      {
        input: "p = 0.5, a = 3, b = 2",
        output: "0.4",
        explanation:
          "With a fair coin, the probability of reaching the target first is simply the distance to the OTHER boundary over the total range: b / (a + b) = 2 / 5 = 0.4.",
      },
    ],
    constraints: ["0 < p < 1", "1 <= a, b <= 10^4"],
    approach:
      "This is the classic gambler's-ruin problem in disguise: shift coordinates so the P&L becomes a position starting at b (its distance from the stop-loss boundary at 0), with an absorbing barrier at 0 (ruin) and another at a + b (target hit). Conditioning on the first step gives the linear recursion P(i) = p*P(i+1) + (1-p)*P(i-1) with P(0) = 0, P(a+b) = 1. For p != 0.5 this telescopes into a closed form using the ratio r = (1-p)/p; for the fair case p = 0.5 the recursion degenerates to a simple linear interpolation, b / (a+b), since no ratio term survives.",
    code: `def gamblers_ruin_probability(p: float, a: int, b: int) -> float:
    if abs(p - 0.5) < 1e-12:
        return b / (a + b)   # fair-coin case: linear in starting distance

    q = 1 - p
    r = q / p
    i, n = b, a + b   # shifted coordinates: start at i, ruin at 0, target at n
    return (1 - r ** i) / (1 - r ** n)

print(round(gamblers_ruin_probability(0.5, a=3, b=2), 4))
# 0.4
print(round(gamblers_ruin_probability(0.52, a=10, b=5), 4))
# above 1/3 -- a small positive edge (p > 0.5) raises the odds versus the fair-coin baseline

# sanity check via Monte Carlo simulation of the same random walk
import random

def simulate(p: float, a: int, b: int, trials: int = 20000) -> float:
    hits_target = 0
    for _ in range(trials):
        pnl = 0
        while -b < pnl < a:
            pnl += 1 if random.random() < p else -1
        if pnl >= a:
            hits_target += 1
    return hits_target / trials

print(round(simulate(0.5, 3, 2), 2))  # converges toward 0.4`,
    language: "python",
    complexity: {
      time: "O(log(a+b)) for the closed form; O(trials * expected walk length) for the simulation",
      space: "O(1)",
    },
  },
  {
    id: "lc-20261028-design-fifo-lot-position-tracker",
    title: "Design a FIFO-Lot Position Tracker for Realized P&L on Partial Sells",
    difficulty: "medium",
    topics: ["design", "queue", "hash-map"],
    problem:
      "Design a class PositionTracker supporting buy(symbol, qty, price), which opens a new lot in that symbol's FIFO queue of open lots, and sell(symbol, qty, price), which closes the sold quantity against the OLDEST open lots first, partially consuming a lot if needed, and returns the realized P&L from that sell. Assume a sell's quantity never exceeds the symbol's total currently-open quantity.",
    examples: [
      {
        input: 'buy("AAPL",100,10); buy("AAPL",50,12); sell("AAPL",120,15)',
        output: "realized_pnl = 560.0",
        explanation:
          "FIFO consumes the oldest lot first: 100 shares @10 fully (profit 100*(15-10)=500), then 20 of the 50 shares @12 (profit 20*(15-12)=60). Total 560. The remaining open lot is 30 shares @12.",
      },
    ],
    constraints: ["up to 10^5 calls to buy/sell", "price and qty are positive"],
    approach:
      "Keep a deque of [quantity, price] lots per symbol, appended on each buy so the oldest lot is always at the front. A sell repeatedly consumes from the front: take min(remaining sell quantity, front lot's quantity), accrue that consumed amount times (sell price - lot price) into realized P&L, shrink or fully pop the front lot, and continue until the sell is fully filled. This mirrors exactly how FIFO (as opposed to LIFO or average-cost) tax-lot accounting works in practice.",
    code: `from collections import deque, defaultdict

class PositionTracker:
    def __init__(self) -> None:
        self._lots: dict[str, deque] = defaultdict(deque)   # symbol -> [qty, price] lots, oldest first

    def buy(self, symbol: str, qty: int, price: float) -> None:
        self._lots[symbol].append([qty, price])

    def sell(self, symbol: str, qty: int, price: float) -> float:
        lots = self._lots[symbol]
        remaining = qty
        realized_pnl = 0.0

        while remaining > 0:
            lot_qty, lot_price = lots[0]
            consumed = min(remaining, lot_qty)
            realized_pnl += consumed * (price - lot_price)   # FIFO: always against the OLDEST lot
            remaining -= consumed

            if consumed == lot_qty:
                lots.popleft()
            else:
                lots[0][0] -= consumed

        return realized_pnl

tracker = PositionTracker()
tracker.buy("AAPL", 100, 10)
tracker.buy("AAPL", 50, 12)
print(tracker.sell("AAPL", 120, 15))
# 560.0`,
    language: "python",
    complexity: { time: "O(lots consumed) per call, amortized O(1) per lot over its lifetime", space: "O(n)" },
  },
];
