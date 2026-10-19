import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-19
// K most frequently traded tickers (heap), shortest window of
// P&L that triggers a margin call (sliding window / monotonic
// deque), max profit with a flat per-trade fee (DP stock
// variant), expected number of ticks to absorption in a biased
// random walk (probability/Markov), and a price-time-priority
// limit order book matching engine (design).
// ============================================================

export const financeBatch20261019: LeetCodeProblem[] = [
  {
    id: "lc-20261019-k-most-frequently-traded-tickers",
    title: "K Most Frequently Traded Tickers",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given a list of trade records where each record is a ticker symbol, and an integer k, return the k tickers that appear most frequently, ordered from most to least frequent. Break ties by lexicographically smaller ticker first.",
    examples: [
      {
        input: 'trades = ["AAPL","MSFT","AAPL","GOOG","MSFT","AAPL"], k = 2',
        output: '["AAPL","MSFT"]',
        explanation:
          "AAPL appears 3 times, MSFT appears 2 times, GOOG appears 1 time -- the 2 most frequent are AAPL then MSFT.",
      },
    ],
    constraints: ["1 <= trades.length <= 10^5", "1 <= k <= number of distinct tickers"],
    approach:
      "Count occurrences of each ticker in one pass with a hashmap. Getting the k 'best' entries by a composite key (highest count, then lexicographically smallest ticker as the tiebreak) is exactly what heapq.nsmallest's key argument is built for: pass key=lambda item: (-count, ticker) so that 'smallest' under this transformed key corresponds to 'most frequent, then alphabetically first' under the real ordering, and ask for the k smallest under that key. Internally heapq.nsmallest maintains a heap of size k rather than sorting all distinct tickers, which is the O(n log k) behavior the heap tag is testing, without hand-rolling the push/pop eviction logic and its tie-break edge cases yourself.",
    code: `import heapq
from collections import Counter

def k_most_frequent_tickers(trades: list[str], k: int) -> list[str]:
    counts = Counter(trades)

    # "smallest" under this key means (highest count, then alphabetically
    # first) -- nsmallest keeps a heap of size k internally, O(n log k)
    top_k = heapq.nsmallest(k, counts.items(), key=lambda item: (-item[1], item[0]))

    return [ticker for ticker, _ in top_k]

print(k_most_frequent_tickers(["AAPL", "MSFT", "AAPL", "GOOG", "MSFT", "AAPL"], k=2))
# ['AAPL', 'MSFT']`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(n)" },
  },
  {
    id: "lc-20261019-shortest-window-margin-call-threshold",
    title: "Shortest Window of Daily P&L That Triggers a Margin Call",
    difficulty: "hard",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given an array of daily P&L values (positive or negative) and a positive margin threshold m, return the length of the shortest contiguous window of days whose total loss is at least m (i.e. the window's P&L sum is <= -m). Return -1 if no such window exists.",
    examples: [
      {
        input: "pnl = [2, -4, -3, 5, -6, 1], m = 7",
        output: "2",
        explanation:
          "The window [-4, -3] (days 1-2) sums to -7, a loss of exactly 7, achieved in just 2 days -- no shorter window reaches a loss of 7 or more.",
      },
    ],
    constraints: ["1 <= pnl.length <= 10^5", "-10^4 <= pnl[i] <= 10^4", "1 <= m <= 10^9"],
    approach:
      "A loss of at least m in some window is the same question as 'is there a window whose NEGATED values sum to at least m', so first flip the sign of every value and this becomes exactly the classic 'shortest subarray with sum at least k' problem. That's solved with prefix sums plus a monotonic deque of indices with strictly increasing prefix-sum values: for each new index j, first pop from the FRONT of the deque while the gap to the current prefix sum already satisfies the target, recording the window length each time (shortest first, since the front holds the earliest-and-smallest valid start); then pop from the BACK while the current prefix sum is less than or equal to the back's prefix sum, since a later start with an equal-or-smaller prefix sum is always at least as good a future candidate and gives a shorter window. Each index enters and leaves the deque at most once, giving O(n) time despite the nested-looking loops.",
    code: `from collections import deque

def shortest_margin_call_window(pnl: list[int], m: int) -> int:
    # flip sign: "loss of at least m" on pnl is "sum of at least m" on losses
    losses = [-x for x in pnl]
    n = len(losses)

    prefix = [0] * (n + 1)
    for i, loss in enumerate(losses):
        prefix[i + 1] = prefix[i] + loss

    best = n + 1
    # deque holds indices with strictly increasing prefix-sum values
    idx_deque: deque[int] = deque()

    for j in range(n + 1):
        # front of the deque is the earliest start whose window might qualify --
        # pop it (recording the length) as long as the target is still met
        while idx_deque and prefix[j] - prefix[idx_deque[0]] >= m:
            best = min(best, j - idx_deque.popleft())

        # a later start with an equal-or-smaller prefix sum dominates any
        # earlier one still in the deque as a future candidate -- drop it
        while idx_deque and prefix[idx_deque[-1]] >= prefix[j]:
            idx_deque.pop()

        idx_deque.append(j)

    return best if best <= n else -1

print(shortest_margin_call_window([2, -4, -3, 5, -6, 1], m=7))
# 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-20261019-max-profit-transaction-fee",
    title: "Maximum Profit With a Per-Trade Transaction Fee",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for one instrument and a flat fee charged once per completed round-trip (buy then sell), return the maximum total profit from any number of non-overlapping trades, where each completed round-trip pays the fee exactly once.",
    examples: [
      {
        input: "prices = [1, 3, 2, 8, 4, 9], fee = 2",
        output: "8",
        explanation:
          "Buy at 1, sell at 8 (profit 7, minus fee 2 = 5); buy at 4, sell at 9 (profit 5, minus fee 2 = 3). Total 5+3=8, which beats any other combination of round-trips once the fee is accounted for.",
      },
    ],
    constraints: ["1 <= prices.length <= 5*10^4", "0 <= prices[i] < 10^4", "0 <= fee < 5*10^4"],
    approach:
      "Same two-state DP as the plain buy/sell-stock-many-times problem (hold vs cash), except the fee needs to be subtracted exactly once per round-trip -- the cleanest place to do that is at the moment of SELLING, folding the fee directly into the sell transition rather than tracking it separately. Maintain cash (not holding, maximum profit so far) and hold (holding one share, maximum net worth so far including the cost basis). Each day: hold either stays as is, or comes from yesterday's cash minus today's price (buying); cash either stays as is, or comes from yesterday's hold plus today's price minus the fee (selling, fee paid here). Charging the fee on sell rather than buy gives the same total profit either way, but putting it in exactly one of the two transitions, never both, is what the state machine depends on to avoid double- or zero-counting it.",
    code: `def max_profit_with_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    # cash: not holding a position, running max profit so far
    # hold: holding one share, running max (profit so far - cost basis)
    cash, hold = 0, -prices[0]

    for price in prices[1:]:
        prev_cash, prev_hold = cash, hold
        cash = max(prev_cash, prev_hold + price - fee)   # sell today, pay fee here
        hold = max(prev_hold, prev_cash - price)          # buy today

    return cash

print(max_profit_with_fee([1, 3, 2, 8, 4, 9], fee=2))
# 8`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261019-expected-steps-random-walk-profit-target",
    title: "Expected Number of Ticks to Hit a Profit Target or Stop-Loss",
    difficulty: "hard",
    topics: ["probability", "dynamic-programming"],
    problem:
      "A position's P&L moves up by 1 tick with probability p or down by 1 tick with probability (1-p) at each step, starting at 0. Given a stop-loss at -S ticks and a take-profit at +T ticks, return the expected number of steps until the P&L is absorbed at either barrier, as a float.",
    examples: [
      {
        input: "p = 0.5, stop_loss = 3, take_profit = 5",
        output: "15.0",
        explanation:
          "For a fair (p = 0.5) random walk, the expected number of steps until absorption at either barrier is simply stop_loss * take_profit = 3 * 5 = 15.",
      },
    ],
    constraints: ["0 < p < 1", "1 <= stop_loss, take_profit <= 10^4"],
    approach:
      "This is the companion quantity to the absorption PROBABILITY from gambler's ruin: instead of 'which barrier gets hit first', it asks 'how long, on average, until something gets hit'. For the fair case (p=0.5) there's a clean closed form: the expected number of steps is simply stop_loss * take_profit, the product of the two distances to the barriers. For the biased case, the expected absorption time has its own closed form derived the same way as the absorption probability -- solving a linear difference equation in the starting position, using the drift d = 2p - 1 and the same ratio r = (1-p)/p. Both are O(1) to evaluate once you have them, versus an O(S+T) DP that solves the same linear recurrence numerically position by position; the DP is the fallback if you can't derive or recall the closed form live, but recognizing the fair-case S*T result on sight is a strong signal.",
    code: `def expected_steps_to_absorption(p: float, stop_loss: int, take_profit: int) -> float:
    # fair walk: a clean closed form -- expected duration is simply the
    # product of the two distances to the barriers
    if p == 0.5:
        return float(stop_loss * take_profit)

    d = 2 * p - 1              # drift per step
    r = (1 - p) / p

    # same closed-form technique as the absorption-probability formula,
    # applied to the first moment of the absorption time instead
    numerator = take_profit - (stop_loss + take_profit) * (1 - r ** stop_loss) / (
        1 - r ** (stop_loss + take_profit)
    )
    return numerator / d

print(expected_steps_to_absorption(p=0.5, stop_loss=3, take_profit=5))
# 15.0 -- exactly stop_loss * take_profit for a fair walk

print(round(expected_steps_to_absorption(p=0.48, stop_loss=3, take_profit=5), 3))
# noticeably different from 15.0 -- even a small per-tick edge changes how
# long the walk is expected to run before hitting either barrier`,
    language: "python",
    complexity: { time: "O(1)", space: "O(1)" },
  },
  {
    id: "lc-20261019-design-price-time-priority-order-book",
    title: "Design a Limit Order Book With Price-Time Priority Matching",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design a class OrderBook that supports add_buy_order(order_id, price, size) and add_sell_order(order_id, price, size), each of which should immediately match against resting orders on the OPPOSITE side at the best available price (price priority), breaking ties between orders at the same price by whichever arrived first (time priority), filling as much size as possible before resting any unfilled remainder on the book. Also support best_bid() and best_ask(), each returning the best resting price on that side, or None if that side is empty.",
    examples: [
      {
        input:
          "ob = OrderBook(); ob.add_sell_order(1, 101, 10); ob.add_sell_order(2, 100, 5); ob.add_buy_order(3, 101, 12)",
        output:
          "Order 3 fills 5 @ 100 against order 2, then 7 @ 101 against order 1; order 1 rests with 3 remaining size at 101; best_ask() -> 101",
        explanation:
          "Price priority means the incoming buy order matches the cheapest resting sell (100) first, even though it was quoted second, before moving on to the next-best price (101).",
      },
    ],
    constraints: ["up to 10^5 total order operations", "1 <= price, size <= 10^9"],
    approach:
      "Keep two heaps: a max-heap of resting buy orders keyed by (-price, arrival_sequence) and a min-heap of resting sell orders keyed by (price, arrival_sequence) -- price priority first, an incrementing arrival counter as the time-priority tiebreak, so each heap's top is always the most aggressive, then earliest, resting order on that side. An incoming order repeatedly peeks at the opposite side's heap top: while it still has size left AND the opposite top's price crosses (incoming buy price >= resting ask, or incoming sell price <= resting bid), fill the smaller of the two remaining sizes, decrement both, and pop the resting order once it's fully filled; stop the moment price no longer crosses or either side runs out of size, then push any unfilled remainder of the incoming order onto its own side's heap. best_bid/best_ask just peek the top of each heap.",
    code: `import heapq
import itertools

class OrderBook:
    def __init__(self):
        self._seq = itertools.count()
        self.buys: list[tuple[int, int, int, int]] = []   # (-price, seq, id, size)
        self.sells: list[tuple[int, int, int, int]] = []   # (price, seq, id, size)

    def add_buy_order(self, order_id: int, price: int, size: int) -> None:
        # cross against the cheapest resting sell while price allows and size remains
        while size > 0 and self.sells and self.sells[0][0] <= price:
            ask_price, seq, sell_id, ask_size = self.sells[0]
            fill = min(size, ask_size)
            size -= fill
            remaining_ask = ask_size - fill
            if remaining_ask == 0:
                heapq.heappop(self.sells)
            else:
                self.sells[0] = (ask_price, seq, sell_id, remaining_ask)
        if size > 0:
            heapq.heappush(self.buys, (-price, next(self._seq), order_id, size))

    def add_sell_order(self, order_id: int, price: int, size: int) -> None:
        while size > 0 and self.buys and -self.buys[0][0] >= price:
            neg_bid, seq, buy_id, bid_size = self.buys[0]
            fill = min(size, bid_size)
            size -= fill
            remaining_bid = bid_size - fill
            if remaining_bid == 0:
                heapq.heappop(self.buys)
            else:
                self.buys[0] = (neg_bid, seq, buy_id, remaining_bid)
        if size > 0:
            heapq.heappush(self.sells, (price, next(self._seq), order_id, size))

    def best_bid(self):
        return -self.buys[0][0] if self.buys else None

    def best_ask(self):
        return self.sells[0][0] if self.sells else None

ob = OrderBook()
ob.add_sell_order(1, 101, 10)
ob.add_sell_order(2, 100, 5)
ob.add_buy_order(3, 101, 12)
print(ob.best_ask(), ob.best_bid())
# 101 None -- order 1 rests with 3 shares left at 101; no buy remains`,
    language: "python",
    complexity: { time: "O(log n) per operation (amortized across matches)", space: "O(n)" },
  },
];
