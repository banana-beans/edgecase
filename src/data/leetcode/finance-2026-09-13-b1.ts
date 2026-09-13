import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-13
// A two-heap running median over a streaming mid-price feed, a
// monotonic-deque rolling max over resting bid size, a DP for
// at-most-K trades with a per-trade fee, a closed-form gambler's-
// ruin expected duration, and a lazy-deletion order book
// supporting cancel and priority-losing price amendment.
// ============================================================

export const financeBatch20260913: LeetCodeProblem[] = [
  {
    id: "lc-20260913-streaming-median-midprice",
    title: "Running Median of a Streaming Mid-Price Feed",
    difficulty: "medium",
    topics: ["heap", "design"],
    problem:
      "You receive a live stream of mid-price ticks for an instrument, one at a time. Design a class exposing add(price), which ingests one more tick, and median(), which returns the median of every tick seen so far.",
    examples: [
      {
        input: "add(101.0); add(103.0); add(100.0); add(105.0)",
        output: "101.0, 102.0, 101.0, 102.0",
        explanation:
          "After each add the sorted history is [101], [101,103], [100,101,103], [100,101,103,105], with medians 101.0, 102.0 (avg of 101/103), 101.0, and 102.0 (avg of 101/103) respectively.",
      },
    ],
    constraints: ["up to 10^6 total add calls", "median() may be called after any add()", "prices are positive floats"],
    approach:
      "Maintain two heaps that always differ in size by at most one: a max-heap 'lo' holding the lower half of the data (negated, since heapq is min-heap only) and a min-heap 'hi' holding the upper half. Route each new price to whichever half it belongs with relative to lo's current max, then rebalance by moving one element across if a half has grown more than one larger than the other. The median is then either the top of whichever half is larger, or the average of both tops when the halves are equal in size -- each add is O(log n) for the heap operations, and median() is an O(1) read of the top(s).",
    code: `import heapq

class RunningMedian:
    def __init__(self):
        self.lo: list[float] = []   # max-heap (negated), lower half
        self.hi: list[float] = []   # min-heap, upper half

    def add(self, price: float) -> None:
        # route the new price to whichever half it belongs to, then
        # rebalance so the two halves differ in size by at most one
        if self.lo and price > -self.lo[0]:
            heapq.heappush(self.hi, price)
        else:
            heapq.heappush(self.lo, -price)

        if len(self.lo) > len(self.hi) + 1:
            heapq.heappush(self.hi, -heapq.heappop(self.lo))
        elif len(self.hi) > len(self.lo):
            heapq.heappush(self.lo, -heapq.heappop(self.hi))

    def median(self) -> float:
        if len(self.lo) > len(self.hi):
            return -self.lo[0]
        return (-self.lo[0] + self.hi[0]) / 2

rm = RunningMedian()
for p in [101.0, 103.0, 100.0, 105.0]:
    rm.add(p)
    print(rm.median())
# 101.0, 102.0, 101.0, 102.0`,
    language: "python",
    complexity: { time: "O(log n) per add, O(1) per median", space: "O(n)" },
  },
  {
    id: "lc-20260913-rolling-max-bid-size",
    title: "Rolling Maximum Resting Bid Size Over a Sliding Time Window",
    difficulty: "medium",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given an array of the best-bid resting size observed once per second, and a window length w seconds, return an array of the maximum resting size within each trailing w-second window as the window slides one second at a time across the array.",
    examples: [
      {
        input: "sizes=[5,3,8,8,2,9,1], w=3",
        output: "[8,8,8,9,9]",
        explanation:
          "Windows [5,3,8], [3,8,8], [8,8,2], [8,2,9], [2,9,1] have maxima 8, 8, 8, 9, 9 respectively.",
      },
    ],
    constraints: ["1 <= w <= sizes.length <= 10^5", "0 <= sizes[i] <= 10^9"],
    approach:
      "Classic monotonic-deque sliding window maximum. Keep a deque of indices whose corresponding sizes are strictly decreasing front to back. On each new index, pop from the back any index whose size is less than or equal to the incoming one -- those indices can never again be the window maximum once a bigger-or-equal size has arrived after them, so discarding them is safe and permanent, not just deferred. Pop from the front when the front index has aged out of the current window. The front of the deque is always the current window's maximum, giving one O(1)-amortized pass over the whole array instead of an O(n*w) brute-force scan of every window.",
    code: `from collections import deque

def rolling_max_bid_size(sizes: list[int], w: int) -> list[int]:
    dq: deque[int] = deque()   # indices, sizes kept strictly decreasing
    result: list[int] = []

    for i, size in enumerate(sizes):
        # any earlier index with a smaller-or-equal resting size can
        # never be the max again once this bigger size has arrived
        while dq and sizes[dq[-1]] <= size:
            dq.pop()
        dq.append(i)

        if dq[0] <= i - w:            # front has aged out of the window
            dq.popleft()
        if i >= w - 1:
            result.append(sizes[dq[0]])

    return result

print(rolling_max_bid_size([5, 3, 8, 8, 2, 9, 1], 3))   # [8, 8, 8, 9, 9]`,
    language: "python",
    complexity: { time: "O(n) amortized", space: "O(w)" },
  },
  {
    id: "lc-20260913-k-trades-with-fee",
    title: "Maximum Profit With At Most K Trades and a Fixed Fee Per Trade",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for one instrument, a maximum number of trades K (one trade = one buy followed by a later sell), and a fixed dollar fee charged per COMPLETED trade, return the maximum total profit achievable using at most K trades.",
    examples: [
      {
        input: "prices=[1,5,2,8,4,9], k=2, fee=1",
        output: "10",
        explanation:
          "Buy at 1, sell at 8 (profit 8-1-1=6), then buy at 4, sell at 9 (profit 9-4-1=4): total 10 using both trades. Selling at the local peak of 5 first is a trap -- holding through the dip to 2 and selling at 8 instead captures more with the same trade budget.",
      },
    ],
    constraints: ["1 <= prices.length <= 1000", "1 <= k <= 50", "0 <= fee <= 10^4"],
    approach:
      "Track two rolling arrays indexed by how many trades have been used: buy[j] is the best cumulative profit after BUYING into the j-th trade (still holding), and sell[j] is the best cumulative profit after COMPLETING the j-th trade. Each day, for j from 1 to K: buy[j] is either yesterday's buy[j], or today's price subtracted from the profit already banked after completing trade j-1 (sell[j-1]); sell[j] is either yesterday's sell[j], or today's price added to buy[j], minus the fee, since the fee is charged once per completed trade rather than per share-day. The answer is the best value across all sell[j]. This runs in O(n*k) time and O(k) space, versus an exponential blowup from trying to enumerate actual trade combinations.",
    code: `def max_profit_k_trades_with_fee(prices: list[float], k: int, fee: float) -> float:
    n = len(prices)
    if n == 0 or k == 0:
        return 0.0

    NEG_INF = float("-inf")
    # buy[j]: best profit after BUYING the j-th stock (still holding it)
    # sell[j]: best profit after COMPLETING the j-th sell
    buy = [NEG_INF] * (k + 1)
    sell = [0.0] * (k + 1)

    for price in prices:
        for j in range(1, k + 1):
            # either keep holding from before, or buy today funded by
            # the profit already banked after completing trade j-1
            buy[j] = max(buy[j], sell[j - 1] - price)
            # either keep resting, or sell today's holding, paying the
            # fixed fee once per COMPLETED trade, not per day held
            sell[j] = max(sell[j], buy[j] + price - fee)

    return max(sell)

print(max_profit_k_trades_with_fee([1, 5, 2, 8, 4, 9], 2, 1))   # 10`,
    language: "python",
    complexity: { time: "O(n * k)", space: "O(k)" },
  },
  {
    id: "lc-20260913-expected-ticks-to-barrier",
    title: "Expected Number of Ticks Until a Position Hits Either Barrier",
    difficulty: "medium",
    topics: ["probability", "markov-chain", "math"],
    problem:
      "A position's mark-to-market P&L moves in discrete unit ticks: up one tick with probability p, down one tick with probability 1-p, independently each tick. Starting at P&L 0, the position is closed the instant P&L first hits either +a (take-profit) or -b (stop-loss). Compute, in closed form -- no simulation -- the EXPECTED NUMBER OF TICKS until the position closes.",
    examples: [
      {
        input: "a=3, b=2, p=0.5",
        output: "6.0",
        explanation: "For a fair walk the symmetric gambler's-ruin expected-duration formula reduces to i*(N-i) with N=a+b=5 and i=b=2, giving 2*3=6.0.",
      },
      {
        input: "a=3, b=2, p=0.7",
        output: "5.35",
        explanation: "With upward drift the walk tends to reach a barrier faster than the fair-coin case; the general asymmetric closed form gives about 5.35 expected ticks.",
      },
    ],
    constraints: ["1 <= a, b <= 10^6", "0 < p < 1"],
    approach:
      "This is the classic gambler's-ruin EXPECTED DURATION problem (distinct from the ruin PROBABILITY problem): a random walk absorbed at two barriers, where you want E[number of steps] rather than which barrier is hit first. Shift coordinates so the walk starts at position i=b out of a total range N=a+b. First-step analysis on E[T_i] = 1 + p*E[T_(i+1)] + q*E[T_(i-1)], with boundary conditions E[T_0]=E[T_N]=0, solves (for p != q) to E[T_i] = i/(q-p) - (N/(q-p)) * (1-(q/p)^i)/(1-(q/p)^N). The symmetric case p=q=0.5 is again a removable 0/0 singularity, with limiting value the simple closed form i*(N-i) -- computable directly with no limit-taking required in code.",
    code: `def expected_ticks_to_barrier(a: int, b: int, p: float) -> float:
    n = a + b     # total distance between the two barriers
    i = b         # start position, measured from the stop-loss barrier

    if abs(p - 0.5) < 1e-12:
        # symmetric random walk: the well-known closed form for the
        # symmetric gambler's-ruin expected duration
        return i * (n - i)

    q = 1 - p
    ratio = q / p
    # asymmetric gambler's-ruin expected duration (Feller), from
    # first-step analysis on the boundary-value difference equation
    return i / (q - p) - (n / (q - p)) * (1 - ratio ** i) / (1 - ratio ** n)

print(round(expected_ticks_to_barrier(3, 2, 0.5), 2))   # 6.0
print(round(expected_ticks_to_barrier(3, 2, 0.7), 2))   # 5.35`,
    language: "python",
    complexity: { time: "O(log(a+b)) for the power operations", space: "O(1)" },
  },
  {
    id: "lc-20260913-order-book-cancel-amend",
    title: "Design a Limit Order Book Supporting Cancel and Priority-Losing Price Amendment",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design a price-time-priority limit order book for one instrument supporting add_buy(order_id, price, qty) and add_sell(order_id, price, qty) (each crossing immediately against the opposite side), cancel(order_id) (removes a still-resting order), and amend_price(order_id, new_price) (re-quotes a resting order at a new price). A call to amend_price must NOT preserve the order's original time priority -- it re-enters at the back of the queue at its new price, exactly like a real exchange treats any price change as forfeiting queue position.",
    examples: [
      {
        input: "add_sell(1,101.0,100); add_sell(2,101.0,50); amend_price(1,101.0); add_buy(3,101.0,120)",
        output: "[(2,101.0,50), (1,101.0,70)]",
        explanation:
          "Order 1 re-quotes and loses its place in the queue even though the price is unchanged, so order 2 -- never amended -- now has priority and fills first for its full 50 shares, with order 1 filling the remaining 70.",
      },
    ],
    constraints: ["up to 10^5 total operations", "prices and quantities are positive"],
    approach:
      "A binary heap has no efficient way to remove or reprioritize an arbitrary element, so use lazy deletion instead. Every resting order carries a monotonically increasing sequence number that IS its current time priority; cancel() and amend_price() simply issue a new (or invalidated) sequence number in O(1), without touching the heap at all. A heap entry is stale exactly when its stored sequence number no longer matches the order's live sequence number in the tracking dict -- stale entries are silently discarded the next time they reach the top of the heap during matching, which is where the O(log n) cleanup cost is actually paid, amortized across future calls. amend_price is implemented as cancel-then-re-add at the new price, which naturally issues a fresh sequence number and sends the order to the back of the new price level's queue.",
    code: `import heapq
import itertools

class OrderBook:
    def __init__(self):
        self.sells: list[tuple[float, int, int]] = []   # min-heap: (price, seq, order_id)
        self.buys: list[tuple[float, int, int]] = []     # max-heap: (-price, seq, order_id)
        self.qty: dict[int, int] = {}
        self.side: dict[int, str] = {}
        self.seq: dict[int, int] = {}       # order_id -> CURRENT valid sequence number
        self._counter = itertools.count()

    def _fresh(self, order_id: int, seq: int) -> bool:
        # a heap entry is only valid if its seq matches the order's
        # CURRENT seq -- cancel/amend bump the seq, orphaning any
        # stale heap entries left behind (lazy deletion)
        return self.seq.get(order_id) == seq and self.qty.get(order_id, 0) > 0

    def cancel(self, order_id: int) -> None:
        self.qty[order_id] = 0
        self.seq[order_id] = -1   # invalidates every heap entry for this id

    def amend_price(self, order_id: int, new_price: float) -> list[tuple[int, float, int]]:
        side, qty = self.side[order_id], self.qty[order_id]
        self.cancel(order_id)
        if side == "buy":
            return self.add_buy(order_id, new_price, qty)
        return self.add_sell(order_id, new_price, qty)

    def add_buy(self, order_id: int, price: float, qty: int) -> list[tuple[int, float, int]]:
        fills, rem = [], qty
        while rem > 0 and self.sells and self.sells[0][0] <= price:
            sp, sseq, sid = heapq.heappop(self.sells)
            if not self._fresh(sid, sseq):
                continue   # stale entry from a cancelled/amended order
            traded = min(rem, self.qty[sid])
            fills.append((sid, sp, traded))
            rem, self.qty[sid] = rem - traded, self.qty[sid] - traded
            if self.qty[sid] > 0:
                heapq.heappush(self.sells, (sp, sseq, sid))
        if rem > 0:
            self._rest(order_id, "buy", price, rem)
        return fills

    def add_sell(self, order_id: int, price: float, qty: int) -> list[tuple[int, float, int]]:
        fills, rem = [], qty
        while rem > 0 and self.buys and -self.buys[0][0] >= price:
            bneg, bseq, bid = heapq.heappop(self.buys)
            if not self._fresh(bid, bseq):
                continue
            traded = min(rem, self.qty[bid])
            fills.append((bid, -bneg, traded))
            rem, self.qty[bid] = rem - traded, self.qty[bid] - traded
            if self.qty[bid] > 0:
                heapq.heappush(self.buys, (bneg, bseq, bid))
        if rem > 0:
            self._rest(order_id, "sell", price, rem)
        return fills

    def _rest(self, order_id: int, side: str, price: float, qty: int) -> None:
        seq = next(self._counter)   # a NEW seq -> back of the queue at this price
        self.side[order_id], self.qty[order_id], self.seq[order_id] = side, qty, seq
        heap = self.buys if side == "buy" else self.sells
        key = -price if side == "buy" else price
        heapq.heappush(heap, (key, seq, order_id))

book = OrderBook()
book.add_sell(1, 101.0, 100)
book.add_sell(2, 101.0, 50)
book.amend_price(1, 101.0)           # re-quotes, loses priority even at the SAME price
print(book.add_buy(3, 101.0, 120))   # [(2, 101.0, 50), (1, 101.0, 70)]`,
    language: "python",
    complexity: { time: "O(log n) amortized per operation", space: "O(n) resting orders" },
  },
];
