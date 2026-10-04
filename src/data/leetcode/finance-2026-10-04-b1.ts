import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-04
// A bounded max-heap for the K trade prices closest to the mid,
// a sliding window bounding distinct tickers in an order-flow
// stream, a generalized at-most-K-transactions DP stock variant,
// an expected-value Markov chain for a winning-streak target, and
// a price-time-priority limit order book matching engine design
// problem.
// ============================================================

export const financeBatch20261004: LeetCodeProblem[] = [
  {
    id: "lc-20261004-k-closest-trades-to-mid",
    title: "K Trade Prices Closest to the Current Mid Price",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given a list of trade prices trades and a mid price mid, return the k trade prices closest to mid, ordered by increasing distance from mid (ties broken by the smaller price first). Do this without fully sorting the entire list by distance.",
    examples: [
      {
        input: "trades=[101.0, 98.5, 100.2, 103.0, 99.8], mid=100.0, k=3",
        output: "[99.8, 100.2, 101.0]",
        explanation:
          "Distances from mid are 100.2->0.2, 99.8->0.2, 101.0->1.0, 98.5->1.5, 103.0->3.0. The three smallest distances are 0.2 (99.8), 0.2 (100.2), and 1.0 (101.0); the 0.2 tie breaks toward the smaller price, so 99.8 sorts before 100.2.",
      },
    ],
    constraints: ["1 <= trades.length <= 10^5", "1 <= k <= trades.length"],
    approach:
      "Maintain a bounded max-heap of size at most k, keyed by (distance, price) so the heap root is always the WORST of the k entries kept so far (largest distance, and on a distance tie, the larger price) -- exactly the entry that should be evicted first when something better arrives. Python's heapq is a min-heap, so store the negated key (-distance, -price): negation flips the ordering, meaning the entry with the lexicographically largest (distance, price) ends up with the smallest stored tuple and naturally sits at the root. For each trade, push it while the heap has room; once full, only replace the root if the new entry's negated key is strictly greater than the root's (i.e. the new entry is genuinely better than the current worst kept). Finish by sorting the k kept entries by (distance, price) ascending for the required output order -- that final sort costs O(k log k), not O(n log n).",
    code: `import heapq

def k_closest_trades(trades: list[float], mid: float, k: int) -> list[float]:
    # bounded max-heap of size k, storing negated (distance, price) so that
    # heap[0] (smallest stored tuple) is always the WORST of the k kept so far
    heap: list[tuple[float, float, float]] = []  # (-distance, -price, price)

    for price in trades:
        dist = abs(price - mid)
        key = (-dist, -price)
        if len(heap) < k:
            heapq.heappush(heap, (*key, price))
        elif key > heap[0][:2]:
            # new entry beats the current worst kept -- evict it
            heapq.heapreplace(heap, (*key, price))

    # unnegate and sort by (distance, price) ascending for the final order
    kept = sorted((-d, -p, price) for d, p, price in heap)
    return [price for _, _, price in kept]

print(k_closest_trades([101.0, 98.5, 100.2, 103.0, 99.8], mid=100.0, k=3))
# [99.8, 100.2, 101.0]`,
    language: "python",
    complexity: { time: "O(n log k) for inserts, O(k log k) for the final sort", space: "O(k)" },
  },
  {
    id: "lc-20261004-longest-window-at-most-k-distinct-tickers",
    title: "Longest Window of Order-Flow Events With At Most K Distinct Tickers",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a chronological list of ticker symbols events representing an order-flow event stream, and an integer k, return the length of the longest contiguous subarray containing at most k distinct tickers.",
    examples: [
      {
        input: 'events=["AAPL","AAPL","MSFT","MSFT","GOOG","AAPL"], k=2',
        output: "4",
        explanation:
          "The run AAPL, AAPL, MSFT, MSFT (indices 0-3) has exactly 2 distinct tickers and length 4. Extending it to include GOOG at index 4 introduces a third distinct ticker, which breaks the k=2 cap, and no other window reaches length 4 with at most 2 distinct tickers.",
      },
    ],
    constraints: ["1 <= events.length <= 10^5", "1 <= k <= events.length"],
    approach:
      "This is the classic bounded-distinct-count sliding window: expand a right pointer over the stream, tracking how many times each ticker currently appears inside the window with a hashmap. Whenever the number of distinct keys in that map exceeds k, the window is invalid, so shrink from the left -- decrementing the leftmost ticker's count and removing its key entirely once the count hits zero (it's no longer 'in view') -- until the distinct count is back at or under k. Record the window length after every expansion once it's valid. Because left only ever moves forward and each index is added and removed from the map at most once across the whole scan, the total work is O(n) despite the nested-looking loop.",
    code: `from collections import defaultdict

def longest_window_at_most_k_distinct(events: list[str], k: int) -> int:
    counts: dict[str, int] = defaultdict(int)
    left = 0
    best = 0

    for right, ticker in enumerate(events):
        counts[ticker] += 1

        # shrink from the left while there are too many distinct tickers in view
        while len(counts) > k:
            left_ticker = events[left]
            counts[left_ticker] -= 1
            if counts[left_ticker] == 0:
                del counts[left_ticker]  # fully evicted -- no longer "in view"
            left += 1

        best = max(best, right - left + 1)

    return best

print(longest_window_at_most_k_distinct(
    ["AAPL", "AAPL", "MSFT", "MSFT", "GOOG", "AAPL"], k=2
))
# 4`,
    language: "python",
    complexity: { time: "O(n)", space: "O(k)" },
  },
  {
    id: "lc-20261004-max-profit-at-most-k-transactions",
    title: "Maximum Profit With At Most K Buy/Sell Transactions",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for a stock and an integer k, return the maximum profit achievable using at most k non-overlapping transactions (never holding more than one share at a time).",
    examples: [
      {
        input: "prices=[3,2,6,5,0,3], k=2",
        output: "7",
        explanation:
          "Buy at 2, sell at 6 (profit 4), then buy at 0, sell at 3 (profit 3), for a total of 7 across exactly 2 transactions -- no choice of at most 2 transactions beats this.",
      },
    ],
    constraints: ["1 <= prices.length <= 1000", "0 <= k <= 100"],
    approach:
      "Generalize the fixed-transaction-count state machines (one slot for a single transaction, two chained slots for two) to k parallel slots: hold[i] tracks the best profit while holding a share bought as the i-th transaction, and cash[i] tracks the best profit after completing the i-th sale. Each day, for every slot i from 1 to k, cash[i] updates from hold[i] (selling closes the position), and hold[i] updates from cash[i-1] (buying the i-th share is only funded by having already realized the (i-1)-th sale's proceeds) -- that dependency chain is what enforces non-overlapping transactions without ever tracking explicit date ranges. One subtlety worth flagging: when k is large enough that it could never actually bind (k >= n/2, since you can't complete more than n/2 transactions in n days), the DP degenerates to unlimited transactions, which has a much cheaper O(n) greedy solution (sum every positive day-over-day move) -- worth special-casing to avoid needless O(n*k) work.",
    code: `def max_profit_k_transactions(prices: list[int], k: int) -> int:
    if not prices or k == 0:
        return 0
    n = len(prices)

    # k this large can never actually bind -- degenerates to unlimited transactions
    if k >= n // 2:
        return sum(max(prices[i + 1] - prices[i], 0) for i in range(n - 1))

    hold = [float("-inf")] * (k + 1)  # profit while holding, i-th buy already made
    cash = [0] * (k + 1)              # profit after completing the i-th sell

    for price in prices:
        for i in range(1, k + 1):
            cash[i] = max(cash[i], hold[i] + price)
            hold[i] = max(hold[i], cash[i - 1] - price)

    return cash[k]

print(max_profit_k_transactions([3, 2, 6, 5, 0, 3], k=2))
# 7`,
    language: "python",
    complexity: { time: "O(n*k), or O(n) when k >= n/2", space: "O(k)" },
  },
  {
    id: "lc-20261004-expected-trades-until-streak",
    title: "Expected Number of Trades Until Three Consecutive Winning Trades",
    difficulty: "medium",
    topics: ["probability", "math"],
    problem:
      "A trading strategy wins each individual trade independently with probability p. Return the expected number of trades needed to see a streak of exactly 3 consecutive wins for the first time.",
    examples: [
      {
        input: "p=0.5",
        output: "14.0",
        explanation:
          "With a fair coin, the expected number of flips to see 3 consecutive heads is the well-known result 2^(3+1) - 2 = 14, which matches the closed-form formula used in the general solution below.",
      },
    ],
    constraints: ["0 < p < 1"],
    approach:
      "Model the current winning streak as a Markov chain state i in {0, 1, 2}, with state 3 absorbing (the target reached). From state i, one more trade either extends the streak to i+1 with probability p, or resets it ALL THE WAY to state 0 with probability 1-p -- the non-obvious part is that a single loss wipes out the entire streak, not just its most recent trade, so the reset target is always 0 regardless of how long the current streak is. Writing E_i = 1 + p*E_(i+1) + (1-p)*E_0 for i = 0, 1, 2 with E_3 = 0 and solving the resulting linear system (by substitution, since every state's reset term points to the same E_0) collapses to the closed form E = (1 - p^n) / ((1-p) * p^n) for a target streak of length n. A quick Monte Carlo simulation is a good sanity check that the closed form is actually being applied correctly.",
    code: `def expected_trades_for_streak(p: float, streak: int) -> float:
    # closed form derived from E_i = 1 + p*E_(i+1) + (1-p)*E_0 across
    # streak-length states i = 0..streak-1, with E_streak = 0 (absorbing)
    q = 1 - p
    return (1 - p ** streak) / (q * p ** streak)

print(round(expected_trades_for_streak(0.5, 3), 4))
# 14.0

# sanity check against a quick Monte Carlo simulation
import random
def simulate_once(p: float, streak: int) -> int:
    trades = 0
    run = 0
    while run < streak:
        trades += 1
        run = run + 1 if random.random() < p else 0  # a single loss resets the WHOLE streak
    return trades

random.seed(0)
trials = [simulate_once(0.5, 3) for _ in range(20000)]
print(round(sum(trials) / len(trials), 2))  # lands close to 14.0`,
    language: "python",
    complexity: { time: "O(1) via the closed form", space: "O(1)" },
  },
  {
    id: "lc-20261004-price-time-priority-order-book",
    title: "Design a Price-Time-Priority Limit Order Book Matching Engine",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design a class OrderBook with add_limit_order(order_id, side, price, qty) ('buy' or 'sell') that matches the new order against the opposite side's best-priced, earliest-submitted resting orders (price-time priority), trading at the RESTING order's price, and rests any unfilled remainder on the book. Return the list of (resting_order_id, qty_filled, fill_price) fills produced. Also support best_bid() and best_ask(), each returning the best resting price on that side or None if empty.",
    examples: [
      {
        input:
          'add_limit_order("s1","sell",101.0,50); add_limit_order("s2","sell",100.5,30); add_limit_order("b1","buy",101.0,40)',
        output: '[("s2", 30, 100.5), ("s1", 10, 101.0)] ; best_ask()=101.0 ; best_bid()=None',
        explanation:
          "The incoming buy at 101.0 crosses the best (lowest) resting ask first: s2 at 100.5 fills completely for 30, then the remaining 10 of the buy fills against s1 at 101.0, leaving s1 resting with 40 left. The buy order itself is fully filled, so nothing rests on the buy side.",
      },
    ],
    constraints: ["up to 10^5 calls to add_limit_order", "price, qty > 0", "order_id values are unique"],
    approach:
      "Keep two heaps: a min-heap for sells (best ask is the smallest price) and a max-heap for buys, built the same way via negated prices so Python's min-heap still gives the best (highest) buy price at the root. Each heap entry also carries a sequence number from a monotonic counter (time priority) and a mutable one-element list holding its remaining quantity, so a resting order can be partially filled in place without the O(n) cost of removing an arbitrary element from a heap. Matching repeatedly peeks the opposite heap's root, lazily popping any entry whose remaining quantity has already hit zero, and stops the moment the incoming price no longer crosses the best opposite price. Each trade executes at the RESTING order's price (price priority: the order already on the book sets the terms) for min(incoming remaining, resting remaining); a resting order emptied by a trade is popped immediately rather than left for lazy cleanup. Any unfilled remainder of the incoming order is pushed onto its own side's heap to rest.",
    code: `import heapq
import itertools

class OrderBook:
    def __init__(self):
        self._seq = itertools.count()
        self.buys: list[tuple] = []   # max-heap via negated price: (-price, seq, id, qty_box)
        self.sells: list[tuple] = []  # min-heap: (price, seq, id, qty_box)

    def _peek_best(self, heap: list):
        while heap and heap[0][3][0] == 0:
            heapq.heappop(heap)  # lazy deletion of fully-filled resting orders
        return heap[0] if heap else None

    def add_limit_order(self, order_id: str, side: str, price: float, qty: float):
        fills = []
        remaining = qty
        opposite = self.sells if side == "buy" else self.buys

        while remaining > 0:
            best = self._peek_best(opposite)
            if best is None:
                break
            best_price = best[0] if side == "buy" else -best[0]
            crosses = price >= best_price if side == "buy" else price <= best_price
            if not crosses:
                break
            _, _, resting_id, qty_box = best
            trade_qty = min(remaining, qty_box[0])
            fills.append((resting_id, trade_qty, best_price))
            qty_box[0] -= trade_qty
            remaining -= trade_qty
            if qty_box[0] == 0:
                heapq.heappop(opposite)

        if remaining > 0:
            seq = next(self._seq)
            qty_box = [remaining]
            heap, key_price = (self.buys, -price) if side == "buy" else (self.sells, price)
            heapq.heappush(heap, (key_price, seq, order_id, qty_box))

        return fills

    def best_bid(self):
        best = self._peek_best(self.buys)
        return -best[0] if best else None

    def best_ask(self):
        best = self._peek_best(self.sells)
        return best[0] if best else None

book = OrderBook()
book.add_limit_order("s1", "sell", 101.0, 50)
book.add_limit_order("s2", "sell", 100.5, 30)
print(book.add_limit_order("b1", "buy", 101.0, 40))
# [("s2", 30, 100.5), ("s1", 10, 101.0)]
print(book.best_ask(), book.best_bid())
# 101.0 None`,
    language: "python",
    complexity: { time: "O(log n) amortized per order (each resting order pushed/popped once)", space: "O(n)" },
  },
];
