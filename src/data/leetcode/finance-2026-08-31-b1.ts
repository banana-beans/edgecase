import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-31
// A two-heap running median for a live trade tape, a two-pointer
// sliding window bounded by realized variance, a combined
// cooldown-plus-fee stock DP, a Markov-chain expected-trials
// probability puzzle, and a price-time-priority limit order book.
// ============================================================

export const financeBatch20260831: LeetCodeProblem[] = [
  {
    id: "lc-running-median-trade-price",
    title: "Running Median Trade Price from a Live Tape (Two Heaps)",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "You receive a live stream of trade prices for one instrument. After each new trade, report the current running median price across all trades seen so far, without re-sorting the full history on every update.",
    examples: [
      {
        input: "add(5); add(15); add(1); add(3)",
        output: "5, 10.0, 5, 4.0",
        explanation:
          "After [5]: median 5. After [5,15]: even count, median is the average of the two middle values, (5+15)/2=10.0. After [5,15,1]: sorted [1,5,15], median 5. After [5,15,1,3]: sorted [1,3,5,15], median (3+5)/2=4.0.",
      },
    ],
    constraints: ["1 <= number of trades <= 10^5", "0 < price <= 10^6"],
    approach:
      "Split the running history into two heaps: a max-heap holding the lower half (implemented as a min-heap of negated prices, since Python's heapq is min-heap only) and a min-heap holding the upper half. On insert, push into whichever heap keeps the value on its correct side, then rebalance so the two heap sizes never differ by more than one -- if the lower half grows too large, pop its max and push it into the upper half, and symmetrically the other way. The median is then either the max of the lower half (when it holds one more element) or the average of both heaps' tops (when sizes are equal). Each insert touches at most a couple of heap operations, so the whole thing is O(log n) per update and O(1) per median query, instead of O(n log n) from re-sorting.",
    code: `import heapq

class RunningMedian:
    def __init__(self):
        self.lower: list[float] = []   # max-heap via negation: holds the SMALLER half
        self.upper: list[float] = []   # min-heap: holds the LARGER half

    def add(self, price: float) -> float:
        if not self.lower or price <= -self.lower[0]:
            heapq.heappush(self.lower, -price)
        else:
            heapq.heappush(self.upper, price)

        # rebalance so sizes never differ by more than one
        if len(self.lower) > len(self.upper) + 1:
            heapq.heappush(self.upper, -heapq.heappop(self.lower))
        elif len(self.upper) > len(self.lower):
            heapq.heappush(self.lower, -heapq.heappop(self.upper))

        if len(self.lower) == len(self.upper):
            return (-self.lower[0] + self.upper[0]) / 2
        return -self.lower[0]   # lower half always holds the odd element out

rm = RunningMedian()
for price in [5, 15, 1, 3]:
    print(rm.add(price))   # 5, 10.0, 5, 4.0`,
    language: "python",
    complexity: { time: "O(log n) per update, O(1) per query", space: "O(n)" },
  },
  {
    id: "lc-longest-window-bounded-realized-variance",
    title: "Longest Window Whose Realized Variance Stays Under a Budget",
    difficulty: "medium",
    topics: ["sliding-window", "two-pointer"],
    problem:
      "Given a sequence of daily returns and a variance budget V, find the length of the longest contiguous window whose sum of squared returns (a proxy for realized variance over the window) does not exceed V.",
    examples: [
      {
        input: "returns=[0.1, 0.1, 0.1, 0.1], V=0.03",
        output: "3",
        explanation:
          "Each squared return is 0.01. Any 3 consecutive days sum to 0.03, right at the budget, which is allowed; any 4 consecutive days sum to 0.04, over budget. The longest valid window has length 3.",
      },
    ],
    constraints: ["1 <= returns.length <= 10^5", "0 <= V <= 10^6", "returns[i] can be any float"],
    approach:
      "Since every squared return is non-negative, the sum over a window only grows as the window widens and only shrinks as it narrows -- exactly the monotonicity a two-pointer sliding window needs. Advance the right pointer one step at a time, adding that day's squared return to a running total; whenever the running total exceeds V, shrink from the left, subtracting squared returns back out, until it's back within budget. Track the best (right - left + 1) seen after each step. Every index enters and leaves the running total at most once across the whole pass, so the total work is O(n) despite the nested-looking loop.",
    code: `def longest_window_bounded_variance(returns: list[float], budget: float) -> int:
    left = 0
    running_sq_sum = 0.0
    best = 0

    for right, r in enumerate(returns):
        running_sq_sum += r * r
        while running_sq_sum > budget:
            running_sq_sum -= returns[left] ** 2
            left += 1
        best = max(best, right - left + 1)

    return best

print(longest_window_bounded_variance([0.1, 0.1, 0.1, 0.1], budget=0.03))   # 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-max-profit-cooldown-and-fee",
    title: "Maximum Stock Profit with Both a Cooldown and a Transaction Fee",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily stock prices, unlimited transactions are allowed, but after selling you must wait one full day before buying again (cooldown), and every completed round trip costs a fixed transaction fee. Find the maximum achievable total profit.",
    examples: [
      {
        input: "prices=[1,4,2,9], fee=1",
        output: "7",
        explanation:
          "Buying on day 0 at 1 and holding all the way to sell on day 3 at 9 nets 9 - 1 - 1 (fee) = 7. Trying to also trade the dip on day 2 doesn't help: selling on day 1 at 4 triggers the cooldown, blocking a buy on day 2, and any alternative combination nets less than holding through to 9.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000", "0 <= prices[i], fee <= 5000"],
    approach:
      "Track three running states per day: hold (currently long), sold (just sold today, entering cooldown), and rest (flat and eligible to buy). Transitions: hold[i] = max(hold[i-1], rest[i-1] - price[i]) -- keep the existing position, or buy today funded from being rested; sold[i] = hold[i-1] + price[i] - fee -- close today's position and pay the fee once, on the completed trip; rest[i] = max(rest[i-1], sold[i-1]) -- stay flat, or roll out of yesterday's cooldown into being eligible to buy again today. This is the standard cooldown state machine (LeetCode 309) with the fee subtracted exactly once at the sell transition (LeetCode 714's trick), combined into one DP. The answer is max(sold, rest) on the last day, since ending mid-hold can never beat having sold.",
    code: `def max_profit_cooldown_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    hold = -prices[0]     # bought on day 0
    sold = float("-inf")  # can't have sold with zero days of history
    rest = 0

    for price in prices[1:]:
        prev_hold, prev_sold, prev_rest = hold, sold, rest
        hold = max(prev_hold, prev_rest - price)
        sold = prev_hold + price - fee
        rest = max(prev_rest, prev_sold)

    return max(sold, rest)

print(max_profit_cooldown_fee([1, 4, 2, 9], fee=1))   # 7`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-expected-trades-two-consecutive-wins",
    title: "Expected Number of Trades Until Two Consecutive Wins",
    difficulty: "medium",
    topics: ["probability", "math"],
    problem:
      "Each trade wins independently with probability p. What is the expected number of trades until you first observe two consecutive winning trades?",
    examples: [
      {
        input: "p=0.5",
        output: "6.0",
        explanation:
          "The classic result for expected trials until a run of 2 successes with a fair coin is 6. More generally the closed form is (1 + p) / p^2, which gives (1 + 0.5) / 0.25 = 6.0.",
      },
    ],
    constraints: ["0 < p <= 1"],
    approach:
      "Model it as a 3-state Markov chain: state S0 (no active win streak), state S1 (last trade was a win), and absorbing state S2 (two wins in a row just happened). Let E0 and E1 be the expected additional trades needed from S0 and S1 respectively. From S0, one trade is taken, then with probability p you move to S1 and with probability 1-p you stay at S0: E0 = 1 + p*E1 + (1-p)*E0. From S1, one trade is taken, then with probability p you're done (0 more needed) and with probability 1-p you fall back to S0: E1 = 1 + (1-p)*E0. Solving this pair of linear equations gives the closed form E0 = (1 + p) / p^2. As a sanity check independent of remembering the formula, the same two equations can be solved directly as a 2x2 linear system.",
    code: `def expected_trades_two_wins(p: float) -> float:
    # closed form from the 2-state Markov chain: E0 = 1/p + E1, E1 = 1 + (1-p)*E0
    return (1 + p) / (p ** 2)

print(expected_trades_two_wins(0.5))    # 6.0
print(round(expected_trades_two_wins(0.6), 4))

# cross-check by solving the 2x2 linear system directly, rather than
# trusting a memorized closed form
import numpy as np

def expected_trades_linear_system(p: float) -> float:
    # unknowns [E0, E1]; equations rearranged to A @ [E0,E1] = b
    A = np.array([[p, -p], [-(1 - p), 1]])
    b = np.array([1.0, 1.0])
    E0, E1 = np.linalg.solve(A, b)
    return E0

print(round(expected_trades_linear_system(0.6), 4))   # matches the closed form`,
    language: "python",
    complexity: { time: "O(1) closed form", space: "O(1)" },
  },
  {
    id: "lc-design-limit-order-book-matching",
    title: "Design a Price-Time-Priority Limit Order Book",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design a single-instrument limit order book supporting add_order(order_id, side, price, quantity), which matches the incoming order against resting opposing orders using strict price-time priority (best price first, ties broken by earliest arrival), partially filling as needed and resting any unfilled remainder; and cancel(order_id), which removes a resting order. add_order returns the list of fills it produced, each as (resting_order_id, incoming_order_id, price, quantity).",
    examples: [
      {
        input:
          'add_order(1,"BUY",100,10); add_order(2,"SELL",99,4); add_order(3,"SELL",101,5)',
        output: "[], [(1,2,100,4)], []",
        explanation:
          "Order 1 rests as a bid at 100 (nothing to match against). Order 2 crosses (sell limit 99 <= resting bid 100) and fills 4 against order 1 at the RESTING order's price of 100, leaving order 1 with 6 left resting. Order 3's limit of 101 doesn't cross the remaining bid of 100, so it rests as a new ask.",
      },
    ],
    constraints: [
      "1 <= number of operations <= 10^5",
      "0 < price, quantity <= 10^6",
      "order ids are unique among currently-live orders",
    ],
    approach:
      "Keep two heaps of (priority_key, sequence_number, order_id): a max-heap for resting bids (store negated price so the best -- highest -- bid sorts first) and a min-heap for resting asks (best -- lowest -- ask sorts first); the sequence number breaks price ties in arrival order, giving strict price-time priority. A separate dict maps order_id to its live mutable state, which doubles as lazy-deletion bookkeeping for the heaps -- filled or canceled orders are simply removed from the dict, and a heap pop that finds no matching live entry is silently discarded rather than searched for and removed in place. add_order repeatedly peeks the best resting order on the opposing book: while it exists, is still live, and its price crosses the incoming order, match the smaller of the two remaining quantities at the RESTING order's price (the standard maker-price convention), decrement both sides, and pop/delete any side that hits zero. Once nothing left crosses, any unfilled remainder of the incoming order is pushed onto its own side's heap. Because each order is pushed and popped from its heap at most once over its lifetime, the amortized cost is O(log n) per add plus the number of fills it actually produces.",
    code: `import heapq
import itertools

class OrderBook:
    def __init__(self):
        self.bids: list[tuple[float, int, int]] = []   # (-price, seq, order_id), best bid first
        self.asks: list[tuple[float, int, int]] = []   # (price, seq, order_id), best ask first
        self.live: dict[int, list] = {}                # order_id -> [side, price, qty_remaining]
        self._seq = itertools.count()

    def add_order(self, order_id: int, side: str, price: float, quantity: float):
        self.live[order_id] = [side, price, quantity]
        opposing = self.asks if side == "BUY" else self.bids
        fills = []

        while self.live[order_id][2] > 0 and opposing:
            resting_id = opposing[0][2]
            resting = self.live.get(resting_id)
            if resting is None:
                heapq.heappop(opposing)      # stale entry (already filled/canceled)
                continue
            resting_price = resting[1]
            crosses = (side == "BUY" and price >= resting_price) or (
                side == "SELL" and price <= resting_price
            )
            if not crosses:
                break
            matched = min(self.live[order_id][2], resting[2])
            fills.append((resting_id, order_id, resting_price, matched))
            self.live[order_id][2] -= matched
            resting[2] -= matched
            if resting[2] == 0:
                heapq.heappop(opposing)
                del self.live[resting_id]

        if self.live[order_id][2] > 0:
            seq = next(self._seq)
            own_book = self.bids if side == "BUY" else self.asks
            key = (-price, seq, order_id) if side == "BUY" else (price, seq, order_id)
            heapq.heappush(own_book, key)
        else:
            del self.live[order_id]
        return fills

    def cancel(self, order_id: int) -> None:
        self.live.pop(order_id, None)   # heap entries become stale, dropped lazily on next scan

book = OrderBook()
print(book.add_order(1, "BUY", 100, 10))    # []
print(book.add_order(2, "SELL", 99, 4))     # [(1, 2, 100, 4)]
print(book.add_order(3, "SELL", 101, 5))    # []`,
    language: "python",
    complexity: {
      time: "O(log n) amortized per add, plus O(log n) per fill produced",
      space: "O(n)",
    },
  },
];
