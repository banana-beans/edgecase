import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-30
// A lazy-deletion heap for top-K resting bid levels, a two
// monotonic-deque sliding window for the longest price-band
// stretch, a k-transaction stock DP, a gambler's-ruin absorption
// probability, and a FIFO position tracker with realized P&L.
// ============================================================

export const financeBatch20260830: LeetCodeProblem[] = [
  {
    id: "lc-k-best-bid-levels-stream",
    title: "K Best (Highest) Bid Price Levels from a Stream of Order Book Updates",
    difficulty: "medium",
    topics: ["heap", "hash-table"],
    problem:
      "You receive a stream of order-book updates, each either adding a resting bid of a given price (add(order_id, price)) or fully canceling a previously-added bid by its order id (cancel(order_id)). At any point, query(k) must return the k highest distinct bid price levels currently resting, sorted descending, without rescanning every resting order on each query.",
    examples: [
      {
        input: "add(1,101.5); add(2,101.5); add(3,101.0); add(4,102.0); query(2)",
        output: "[102.0, 101.5]",
        explanation:
          "Three distinct price levels are resting (102.0, 101.5, 101.0); the two highest are 102.0 and 101.5. Canceling order 4 afterward would remove the 102.0 level entirely since no other order rests there.",
      },
    ],
    constraints: [
      "1 <= number of operations <= 10^5",
      "0 < price <= 10^6",
      "order ids are unique among currently-live orders",
    ],
    approach:
      "Maintain a max-heap of price levels alongside a hash map from order id to price and a per-price live-order counter. Cancellation only decrements the counter for that price -- it does not touch the heap, since heaps don't support efficient arbitrary-element deletion. This means the heap can carry stale price levels whose live count has dropped to zero. query(k) pops from the heap, checking each popped price's live count: a price with count 0 is a stale level and is discarded permanently, while a price with count > 0 is a real answer that gets collected and pushed back onto the heap afterward so future queries can still find it. Because each price level is pushed onto the heap at most once (add only pushes a NEW price, not a duplicate), the total work across all operations stays bounded by the number of adds, giving amortized O(log n) per add and O(k log n) per query.",
    code: `import heapq
from collections import defaultdict

class OrderBookTopLevels:
    def __init__(self):
        self.order_price: dict[int, float] = {}       # order id -> price
        self.level_count: dict[float, int] = defaultdict(int)  # price -> live order count
        self.max_heap: list[float] = []                # negated prices, may go stale
        self.heap_has: set[float] = set()               # prices currently IN the heap

    def add(self, order_id: int, price: float) -> None:
        self.order_price[order_id] = price
        self.level_count[price] += 1
        if price not in self.heap_has:
            heapq.heappush(self.max_heap, -price)
            self.heap_has.add(price)

    def cancel(self, order_id: int) -> None:
        price = self.order_price.pop(order_id)
        self.level_count[price] -= 1
        # lazy deletion: the now-stale price stays in the heap until a
        # query pops past it -- cheaper than searching the heap to remove it

    def query(self, k: int) -> list[float]:
        result: list[float] = []
        popped: list[float] = []
        while self.max_heap and len(result) < k:
            price = -heapq.heappop(self.max_heap)
            self.heap_has.discard(price)
            if self.level_count.get(price, 0) > 0:
                result.append(price)
                popped.append(price)
            # else: stale level with zero live orders -- drop it for good
        for price in popped:                            # push the real answers back
            heapq.heappush(self.max_heap, -price)
            self.heap_has.add(price)
        return result

book = OrderBookTopLevels()
book.add(1, 101.5)
book.add(2, 101.5)
book.add(3, 101.0)
book.add(4, 102.0)
print(book.query(2))    # [102.0, 101.5]
book.cancel(4)
print(book.query(2))    # [101.5, 101.0]`,
    language: "python",
    complexity: { time: "O(log n) amortized per add, O(k log n) per query", space: "O(n)" },
  },
  {
    id: "lc-longest-window-price-band",
    title: "Longest Window Where Price Stays Within a Fixed Band (Two Monotonic Deques)",
    difficulty: "medium",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given a sequence of daily prices and a band width W, find the length of the longest contiguous window during which max(price) - min(price) <= W -- i.e., the longest stretch the price stayed inside a trading range of width W.",
    examples: [
      {
        input: "prices=[1,5,2,3,8,1], W=4",
        output: "4",
        explanation:
          "The window covering indices 0-3 (prices 1,5,2,3) has max 5 and min 1, a range of 4 which fits the band; extending it to include 8 breaks the band since 8-1=7 exceeds 4, and no longer valid window exists elsewhere in the array.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^6", "0 <= W <= 10^6"],
    approach:
      "Maintain two monotonic deques of INDICES: one keeping prices in decreasing order front-to-back so the front is always the current window's max, one increasing so the front is the current window's min. As the right pointer advances, pop from each deque's back any index whose price is dominated by the new price (a dominated index can never again be the extremum while the new one is in the window), then push the new index. After each push, while the window's range (front of max deque minus front of min deque) exceeds W, advance the left pointer and drop any deque-front indices that have fallen outside the window. Each index is pushed and popped from each deque at most once across the whole pass, so despite the nested-looking while loops the total work is O(n) -- this is the classic monotonic-deque sliding-window-extremum pattern.",
    code: `from collections import deque

def longest_price_band_window(prices: list[float], width: float) -> int:
    max_dq: deque[int] = deque()   # indices, prices decreasing front-to-back
    min_dq: deque[int] = deque()   # indices, prices increasing front-to-back
    left = 0
    best = 0

    for right, price in enumerate(prices):
        while max_dq and prices[max_dq[-1]] <= price:
            max_dq.pop()
        max_dq.append(right)
        while min_dq and prices[min_dq[-1]] >= price:
            min_dq.pop()
        min_dq.append(right)

        # shrink from the left while the window's range exceeds the band width
        while prices[max_dq[0]] - prices[min_dq[0]] > width:
            left += 1
            if max_dq[0] < left:
                max_dq.popleft()
            if min_dq[0] < left:
                min_dq.popleft()

        best = max(best, right - left + 1)

    return best

print(longest_price_band_window([1, 5, 2, 3, 8, 1], width=4))   # 4`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n) worst case for the deques" },
  },
  {
    id: "lc-max-profit-at-most-k-transactions",
    title: "Maximum Profit From At Most K Buy-Sell Transactions",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices and an integer k, find the maximum total profit from at most k non-overlapping buy-then-sell transactions (each buy must occur after the previous sell completes), holding at most one unit at a time.",
    examples: [
      {
        input: "prices=[3,2,6,5,0,3], k=2",
        output: "7",
        explanation:
          "Buy at 2, sell at 6 for a profit of 4; then buy at 0, sell at 3 for a profit of 3. Total profit 7, and no combination of at most 2 transactions does better.",
      },
    ],
    constraints: ["1 <= k <= 100", "1 <= prices.length <= 1000", "0 <= prices[i] <= 1000"],
    approach:
      "Track two arrays indexed by transaction count j from 1 to k: buy[j] is the best profit achievable after making the j-th buy (currently holding a position), and sell[j] is the best profit after completing j full round trips (currently flat). Scanning day by day, update buy[j] = max(buy[j], sell[j-1] - price) -- either keep the existing position or open a new one funded by the profit banked after j-1 completed round trips -- and sell[j] = max(sell[j], buy[j] + price) -- either stay flat or close the current position. The answer is sell[k]. This is O(n*k), but when k is large enough that it can never bind (k >= n/2, since each round trip needs at least 2 days), the problem collapses to the unlimited-transactions case, solvable in O(n) by summing every positive day-to-day price move -- worth checking first to avoid an unnecessary O(n*k) pass for large k.",
    code: `def max_profit_k_transactions(prices: list[int], k: int) -> int:
    n = len(prices)
    if n == 0 or k == 0:
        return 0

    # if k can never be a binding constraint, this collapses to the
    # unlimited-transactions problem: sum every positive daily move.
    # avoids an unnecessary O(n*k) pass when k is large.
    if k >= n // 2:
        return sum(max(prices[i + 1] - prices[i], 0) for i in range(n - 1))

    buy = [float("-inf")] * (k + 1)   # buy[j]: best profit after j-th buy, holding
    sell = [0] * (k + 1)              # sell[j]: best profit after j completed round trips

    for price in prices:
        for j in range(1, k + 1):
            buy[j] = max(buy[j], sell[j - 1] - price)
            sell[j] = max(sell[j], buy[j] + price)

    return sell[k]

print(max_profit_k_transactions([3, 2, 6, 5, 0, 3], k=2))   # 7`,
    language: "python",
    complexity: { time: "O(n*k), or O(n) when k >= n/2", space: "O(k)" },
  },
  {
    id: "lc-gamblers-ruin-profit-target",
    title: "Gambler's Ruin: Probability of Hitting a Profit Target Before a Stop-Loss",
    difficulty: "medium",
    topics: ["probability", "math", "dynamic-programming"],
    problem:
      "A trader's running P&L moves in discrete +1 or -1 ticks, up with probability p and down with probability 1-p each step, starting at 0. Given a stop-loss at -a (a > 0 ticks) and a profit target at +b (b > 0 ticks), compute the probability the P&L hits +b before it hits -a. Handle both p=0.5 and p != 0.5 correctly.",
    examples: [
      {
        input: "p=0.5, a=3, b=5",
        output: "0.375",
        explanation:
          "The classic symmetric gambler's ruin result: with a fair coin, the probability of reaching +b before -a starting from 0 is a / (a + b) = 3 / 8 = 0.375.",
      },
    ],
    constraints: ["0 < p < 1", "1 <= a, b <= 10^4"],
    approach:
      "Let P(i) be the probability of reaching +b before -a starting from state i, satisfying the recurrence P(i) = p*P(i+1) + (1-p)*P(i-1) with boundary conditions P(-a)=0 and P(b)=1. Solving this linear recurrence via its characteristic equation gives the closed form P(0) = (1 - r^a) / (1 - r^(a+b)) where r = (1-p)/p, for p != 0.5. At exactly p=0.5 the ratio r equals 1 and the formula has a removable 0/0 singularity, so the symmetric case is handled separately with its own well-known limit, a / (a + b). As a sanity cross-check independent of remembering the closed form, the same recurrence can be solved numerically via Gauss-Seidel iteration over the discrete states from -a to b until convergence, which should match the closed form to several decimal places.",
    code: `def prob_hit_target_before_stop(p: float, a: int, b: int) -> float:
    # gambler's ruin closed form: probability the walk starting at 0 hits
    # +b before it hits -a, stepping up w.p. p, down w.p. 1-p
    if abs(p - 0.5) < 1e-12:
        return a / (a + b)   # symmetric case: the general formula below
                              # has a removable 0/0 here

    r = (1 - p) / p
    return (1 - r ** a) / (1 - r ** (a + b))

print(round(prob_hit_target_before_stop(0.5, a=3, b=5), 4))   # 0.375
print(round(prob_hit_target_before_stop(0.6, a=3, b=5), 4))

# cross-check via the exact linear system, solved by Gauss-Seidel iteration --
# useful when you don't trust or remember the closed form
def prob_dp(p: float, a: int, b: int) -> float:
    prob = {-a: 0.0, b: 1.0}
    for i in range(-a + 1, b):
        prob[i] = 0.5
    for _ in range(2000):
        for i in range(-a + 1, b):
            prob[i] = p * prob[i + 1] + (1 - p) * prob[i - 1]
    return prob[0]

print(round(prob_dp(0.6, a=3, b=5), 4))   # matches the closed form`,
    language: "python",
    complexity: {
      time: "O(1) closed form; O(a+b) per iteration for the DP cross-check",
      space: "O(1) closed form; O(a+b) for the DP",
    },
  },
  {
    id: "lc-design-fifo-position-tracker",
    title: "Design a FIFO Position Tracker with Realized P&L",
    difficulty: "medium",
    topics: ["design", "queue"],
    problem:
      "Design a position tracker for a single instrument supporting trade(side, price, quantity) for BUY or SELL fills, position() returning the current signed quantity held, and realized_pnl() returning the cumulative P&L booked so far. Closing trades must be matched against resting lots on strict FIFO basis (oldest lot closed first), and a single trade may partially close one lot and continue into the next; a trade larger than the entire resting book flips the position and opens a new lot in the new direction.",
    examples: [
      {
        input: 'trade("BUY",100,10); trade("BUY",102,5); trade("SELL",105,12); position(); realized_pnl()',
        output: "3, 56.0",
        explanation:
          "Selling 12 closes the oldest lot first: 10 shares from the lot bought at 100 (profit (105-100)*10=50), then 2 shares from the lot bought at 102 (profit (105-102)*2=6), totaling 56.0 realized. The second lot still has 5-2=3 shares open, so the position is +3.",
      },
    ],
    constraints: [
      "1 <= quantity <= 10^6",
      "0 < price <= 10^6",
      "trading past a flat position opens a new lot; trading through the entire resting book flips the position to the opposite side",
    ],
    approach:
      "Store open lots as a deque of (quantity, price) pairs, all sharing one sign of direction (long or short) tracked separately, since the FIFO queue naturally empties and restarts fresh whenever the position flips direction. A trade in the SAME direction as the resting book (or arriving when flat) just appends a new lot. A trade in the OPPOSITE direction closes lots from the front of the deque, oldest first: for each matched quantity, a long lot being sold profits (exit price - lot price) per unit, while a short lot being bought back profits (lot price - exit price) per unit; a lot fully consumed is popped, a partially consumed lot has its remaining quantity reduced in place. If the incoming trade's quantity exceeds the entire resting book, the leftover flips the position's direction and opens a brand-new lot. Because each lot is pushed and popped from the deque at most once across its lifetime, the amortized cost per trade is O(1) plus the number of lots it actually closes.",
    code: `from collections import deque

class FIFOPositionTracker:
    def __init__(self):
        # each lot: (quantity, price), quantity always POSITIVE; direction
        # of the whole book (long vs short) tracked separately since all
        # resting lots share one sign at any given time
        self.lots: deque[tuple[float, float]] = deque()
        self.is_long = True          # meaningless while lots is empty
        self.realized = 0.0

    def position(self) -> float:
        total = sum(q for q, _ in self.lots)
        return total if self.is_long else -total

    def realized_pnl(self) -> float:
        return self.realized

    def trade(self, side: str, price: float, quantity: float) -> None:
        incoming_long = side == "BUY"

        if not self.lots or incoming_long == self.is_long:
            # same direction as the resting book (or book is flat): just open a new lot
            if not self.lots:
                self.is_long = incoming_long
            self.lots.append((quantity, price))
            return

        # opposite direction: close resting lots FIFO, oldest first
        remaining = quantity
        while remaining > 0 and self.lots:
            lot_qty, lot_price = self.lots[0]
            matched = min(remaining, lot_qty)
            # a long lot being sold profits on (exit - entry); a short
            # lot being bought back profits on (entry - exit)
            pnl_per_unit = (price - lot_price) if self.is_long else (lot_price - price)
            self.realized += pnl_per_unit * matched

            if matched == lot_qty:
                self.lots.popleft()
            else:
                self.lots[0] = (lot_qty - matched, lot_price)
            remaining -= matched

        if remaining > 0:
            # the trade was bigger than the entire resting book -- it
            # flips the position and opens a new lot in the new direction
            self.is_long = incoming_long
            self.lots.append((remaining, price))

tracker = FIFOPositionTracker()
tracker.trade("BUY", 100, 10)
tracker.trade("BUY", 102, 5)
tracker.trade("SELL", 105, 12)
print(tracker.position(), tracker.realized_pnl())   # 3.0 56.0`,
    language: "python",
    complexity: {
      time: "O(1) amortized per trade (each lot pushed/popped at most once)",
      space: "O(number of open lots)",
    },
  },
];
