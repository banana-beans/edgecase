import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-10
// A running-median heap pair, a minimum-window sliding-window
// sum, a transaction-fee stock DP, a gambler's-ruin probability
// problem, and a limit-order-book matching engine design.
// ============================================================

export const financeBatch20260810: LeetCodeProblem[] = [
  {
    id: "lc-streaming-median-trade-price",
    leetcodeNumber: 295,
    title: "Streaming Median Trade Price",
    difficulty: "hard",
    topics: ["heap", "streaming", "design"],
    problem:
      "Design a tracker that ingests a live stream of trade prices via add(price) and answers median() at any point -- the median of all prices seen so far. Both operations must be fast; add() should not re-sort the whole history on every call.",
    examples: [
      {
        input: "add(10); add(20); median(); add(30); median()",
        output: "15.0, 20.0",
        explanation:
          "After [10,20] the median is the average of both middle values. After [10,20,30] the median is the single middle value, 20.",
      },
    ],
    constraints: ["up to 10^6 trades in the stream"],
    approach:
      "Maintain two heaps that split the stream at the median: a max-heap (via negation) lo holding the smaller half, and a min-heap hi holding the larger half, kept balanced so their sizes differ by at most one. On add(), push into lo, then push lo's max over into hi to maintain the max(lo) <= min(hi) invariant, then rebalance sizes by moving the top of whichever heap has grown too large back to the other -- this two-step push-then-rebalance keeps the invariant correct even when the new value belongs on the far side. median() is then O(1): if the heaps are equal size, average their two tops; otherwise return the top of whichever heap is larger. This is the standard two-heap running-median pattern applied directly to a price stream instead of an abstract integer stream.",
    code: `import heapq

class MedianPriceTracker:
    def __init__(self):
        self.lo: list[float] = []   # max-heap (negated): smaller half of prices
        self.hi: list[float] = []   # min-heap: larger half of prices

    def add(self, price: float) -> None:
        heapq.heappush(self.lo, -price)
        # move lo's max into hi so max(lo) <= min(hi) always holds
        heapq.heappush(self.hi, -heapq.heappop(self.lo))
        # rebalance: sizes may differ by at most 1, lo can hold the extra
        if len(self.hi) > len(self.lo):
            heapq.heappush(self.lo, -heapq.heappop(self.hi))

    def median(self) -> float:
        if len(self.lo) > len(self.hi):
            return -self.lo[0]
        return (-self.lo[0] + self.hi[0]) / 2.0`,
    language: "python",
    complexity: { time: "O(log n) per add(); O(1) per median()", space: "O(n)" },
  },
  {
    id: "lc-min-window-notional-target",
    title: "Minimum Window Reaching a Notional Target",
    difficulty: "medium",
    topics: ["sliding-window", "two-pointer"],
    problem:
      "Given a day's sequence of trade notionals (all positive), find the length of the shortest contiguous run of trades whose total notional is at least target. Return 0 if no such run exists. Do it in O(n).",
    examples: [
      {
        input: "notionals=[2,1,5,2,3,2], target=7",
        output: "2",
        explanation:
          "The window [5,2] sums to 7 in just 2 trades -- shorter than any other qualifying run.",
      },
    ],
    constraints: ["1 <= len(notionals) <= 10^5", "all notionals > 0"],
    approach:
      "Because every notional is strictly positive, the running window sum is monotonic in both endpoints: growing the window (moving right) only increases the sum, and shrinking it (moving left) only decreases it -- exactly the property that makes a two-pointer sweep valid instead of needing a full O(n^2) scan of all windows. Expand right, adding to a running sum; whenever the sum meets target, record the window length and then greedily shrink from the left for as long as the sum still meets target, since a smaller window at the same or higher sum is always at least as good. Each index enters and leaves the window at most once, so the whole sweep is O(n) despite the nested-looking while loop.",
    code: `def min_window_notional(notionals: list[int], target: int) -> int:
    left = 0
    total = 0
    best = len(notionals) + 1   # sentinel: "not found yet"
    for right, x in enumerate(notionals):
        total += x
        # shrink from the left greedily while the window still qualifies --
        # valid only because every notional is positive (sum is monotonic)
        while total >= target:
            best = min(best, right - left + 1)
            total -= notionals[left]
            left += 1
    return best if best <= len(notionals) else 0`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-buy-sell-transaction-fee",
    leetcodeNumber: 714,
    title: "Best Time to Buy and Sell Stock with Transaction Fee",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Maximize profit trading a single stock with unlimited transactions, where every completed round trip (one buy plus one sell) costs a fixed fee. Unlike the cooldown variant, there is no waiting period between a sell and the next buy.",
    examples: [
      {
        input: "prices=[1,3,2,8,4,9], fee=2",
        output: "8",
        explanation:
          "Buy at 1, sell at 8 (profit 7 - 2 fee = 5); buy at 4, sell at 9 (profit 5 - 2 fee = 3); total 8. Cheaper to hold through the dip at 2 than pay a second fee immediately.",
      },
    ],
    approach:
      "Two rolling states per day, no array needed: cash (no position held, all value realized as cash) and hold (currently own one share). Charge the fee once, at the moment of selling, folded directly into the cash transition: new cash is the better of staying in cash or selling today (hold + price - fee), and new hold is the better of keeping the position or buying today (cash - price). Charging the fee on sell rather than buy is an arbitrary but clean convention -- it must be charged exactly once per round trip, not on both legs. No cooldown constraint means hold can transition back to cash and immediately to hold again on a later day with no gap, unlike LC 309.",
    code: `def max_profit_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0
    cash = 0                 # no position, everything realized as cash
    hold = float('-inf')     # currently holding one share
    for p in prices:
        cash = max(cash, hold + p - fee)   # sell today, fee charged once here
        hold = max(hold, cash - p)          # buy today from cash
    return cash`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-gamblers-ruin-probability",
    title: "Probability of Ruin in a Biased Random Walk",
    difficulty: "medium",
    topics: ["probability", "random-walk", "math"],
    problem:
      "A trader starts with i units of capital and repeatedly makes a bet that wins 1 unit with probability p and loses 1 unit with probability 1-p, stopping either at 0 (ruin) or at a target N. Given i, N, and p, compute the probability of eventually being ruined (hitting 0 before N), without simulating the walk.",
    examples: [
      {
        input: "i=1, N=3, p=0.4",
        output: "0.771",
        explanation:
          "A disadvantageous walk (p < 0.5): ruin probability is high even starting closer to the middle than to 0.",
      },
    ],
    constraints: ["0 < i < N", "0 < p < 1"],
    approach:
      "This is the classical gambler's ruin problem, solved by setting up a recurrence on the ruin probability q(i) (probability of hitting 0 before N, starting from i) and recognizing it has a known closed form rather than needing simulation or even a DP table. Let r = (1-p)/p. If p != 0.5, q(i) = (r^i - r^N) / (1 - r^N) -- derived from the fact that the walk's ruin probability satisfies a linear second-order recurrence whose characteristic roots are 1 and r. If p == 0.5 (fair walk), the formula degenerates (r=1) and the closed form is instead the linear q(i) = 1 - i/N, the martingale-based fair-walk result. Both branches are O(1) -- exponential in the walk's length only if you simulate, never if you use the formula.",
    code: `def ruin_probability(i: int, N: int, p: float) -> float:
    if p == 0.5:
        # fair walk: ruin probability is linear in starting position --
        # follows directly from the walk being a martingale
        return 1.0 - i / N
    r = (1.0 - p) / p
    # closed form from the characteristic-root solution of the ruin
    # recurrence q(i) = p*q(i+1) + (1-p)*q(i-1), q(0)=1, q(N)=0
    return (r ** i - r ** N) / (1.0 - r ** N)

# sanity checks against known special cases
print(round(ruin_probability(1, 3, 0.4), 3))   # 0.771 -- unfavorable walk
print(round(ruin_probability(50, 100, 0.5), 3))  # 0.5 -- fair walk, symmetric start`,
    language: "python",
    complexity: { time: "O(1) with the closed form", space: "O(1)" },
  },
  {
    id: "lc-limit-order-book-matcher",
    title: "Design a Price-Time Priority Limit Order Book",
    difficulty: "hard",
    topics: ["design", "heap", "order-book"],
    problem:
      "Design a simplified limit order matching engine supporting add_order(side, price, size) for BUY or SELL limit orders. On arrival, an order matches against the best resting orders on the opposite side while price is favorable (buy price >= resting ask, or sell price <= resting bid), executing at the RESTING order's price, in time priority among orders at the same price level. Any unfilled remainder rests in the book. Return the list of fills produced by each new order.",
    examples: [
      {
        input:
          "add_order(SELL,100,10); add_order(SELL,100,5); add_order(BUY,101,12)",
        output: "[(100, 10), (100, 5), 3 unfilled resting as a BUY at 101]",
        explanation:
          "The incoming buy at 101 crosses both resting sells at 100 (better than its limit), filling the earlier-arrived 10 lots first (time priority), then 5 more of the requested 12, leaving 3 lots resting as a new bid.",
      },
    ],
    approach:
      "Keep two sides of the book, each a dict from price level to a deque of (order_id, remaining_size) in arrival order -- the deque enforces time priority within a price level for free (FIFO). Track the best bid as a max-heap of prices and the best ask as a min-heap of prices, both lazily cleaned (a price is popped and skipped if its level's deque has since emptied, rather than eagerly removed from the heap on every fill -- the same lazy-deletion idea used for a changing-key heap elsewhere in this bank). On a new order, repeatedly peek the best opposing price; while it crosses (marketable) and the incoming order still has size, match against the front of that level's deque, generate a fill at the RESTING order's price, decrement both sizes, and pop the resting order once exhausted. When the price no longer crosses or the incoming order is fully filled, rest any remainder on the incoming order's own side.",
    code: `import heapq
from collections import deque, defaultdict

BUY, SELL = "BUY", "SELL"

class OrderBook:
    def __init__(self):
        self.bids: dict[float, deque] = defaultdict(deque)   # price -> FIFO orders
        self.asks: dict[float, deque] = defaultdict(deque)
        self.bid_heap: list[float] = []    # max-heap via negation: best bid on top
        self.ask_heap: list[float] = []    # min-heap: best ask on top
        self.next_id = 0

    def _best_ask(self):
        while self.ask_heap:
            p = self.ask_heap[0]
            if self.asks[p]:            # lazy deletion: skip emptied levels
                return p
            heapq.heappop(self.ask_heap)
        return None

    def _best_bid(self):
        while self.bid_heap:
            p = -self.bid_heap[0]
            if self.bids[p]:
                return p
            heapq.heappop(self.bid_heap)
        return None

    def add_order(self, side: str, price: float, size: int):
        fills = []
        book, heap, best = (
            (self.asks, self.ask_heap, self._best_ask) if side == BUY
            else (self.bids, self.bid_heap, self._best_bid)
        )
        while size > 0:
            top = best()
            crosses = top is not None and (
                (side == BUY and price >= top) or (side == SELL and price <= top)
            )
            if not crosses:
                break
            resting = book[top]
            rid, rsize = resting[0]
            traded = min(size, rsize)
            fills.append((top, traded))          # fill price is the RESTING order's price
            size -= traded
            rsize -= traded
            if rsize == 0:
                resting.popleft()
            else:
                resting[0] = (rid, rsize)
        if size > 0:                              # rest the remainder on our own side
            own_book, own_heap = (self.bids, self.bid_heap) if side == BUY else (self.asks, self.ask_heap)
            self.next_id += 1
            own_book[price].append((self.next_id, size))
            heapq.heappush(own_heap, -price if side == BUY else price)
        return fills`,
    language: "python",
    complexity: { time: "O(log n) per crossing price level touched", space: "O(number of resting orders)" },
  },
];
