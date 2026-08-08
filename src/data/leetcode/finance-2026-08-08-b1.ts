import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-08
// Heaps, sliding window, stock DP, probability/Markov, and two
// system-design problems (matching engine + position tracker).
// ============================================================

export const financeBatch20260808: LeetCodeProblem[] = [
  {
    id: "lc-merge-k-price-feeds",
    title: "Merge K Sorted Price Feeds",
    difficulty: "medium",
    topics: ["heap", "merge-k-sorted"],
    problem:
      "You receive K price feeds for the same symbol from K different venues. Each feed is a list of (timestamp, price) ticks already sorted by timestamp within itself, but the feeds interleave arbitrarily against each other. Merge all K feeds into a single stream sorted by timestamp.",
    examples: [
      {
        input: "feeds = [[(1,100.0),(4,101.5)], [(2,99.5),(3,102.0)]]",
        output: "[(1,100.0),(2,99.5),(3,102.0),(4,101.5)]",
        explanation: "Pull the globally-earliest unread tick across all feeds each step.",
      },
    ],
    constraints: ["1 <= K <= 10^3", "total ticks across all feeds <= 10^6"],
    approach:
      "Seed a min-heap with the first tick of each feed, keyed by (timestamp, feed_index). Pop the smallest, emit it, and push that feed's next tick if one exists. Each tick enters and leaves the heap exactly once, so total work is O(N log K) for N ticks across K feeds -- far better than concatenating and sorting at O(N log N) once K is small relative to N. (heapq.merge does this exact algorithm as a one-liner if the feeds are plain iterables.)",
    code: `import heapq

def merge_price_feeds(feeds: list[list[tuple[int, float]]]) -> list[tuple[int, float]]:
    heap = []  # (timestamp, feed_idx, tick_idx) -- tick_idx breaks ties deterministically
    for i, feed in enumerate(feeds):
        if feed:
            ts, _ = feed[0]
            heapq.heappush(heap, (ts, i, 0))

    merged: list[tuple[int, float]] = []
    while heap:
        ts, feed_i, tick_i = heapq.heappop(heap)
        merged.append((ts, feeds[feed_i][tick_i][1]))
        nxt = tick_i + 1
        if nxt < len(feeds[feed_i]):
            heapq.heappush(heap, (feeds[feed_i][nxt][0], feed_i, nxt))
    return merged`,
    language: "python",
    complexity: { time: "O(N log K)", space: "O(K)" },
  },
  {
    id: "lc-trailing-stop-window-max",
    title: "Trailing Stop Trigger (Sliding Window Maximum)",
    difficulty: "medium",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given daily closing prices, a lookback window W, and a stop percentage pct, determine for each day whether a trailing stop fires: price[i] <= (max price in the trailing W-day window ending at i) * (1 - pct). Return the indices where it fires. Do it in O(n) total, not O(n*W).",
    examples: [
      {
        input: "prices=[10,12,11,9,8,13], window=3, pct=0.2",
        output: "[3]",
        explanation:
          "At i=3 the trailing window is [12,11,9]; window high 12, stop level 9.6; price 9 <= 9.6 fires. Day 4 (price 8) does not re-fire under this rule since only the crossing day is reported.",
      },
    ],
    approach:
      "Naive re-scanning the last W prices for the max on every day costs O(n*W). Instead keep a monotonic decreasing deque of indices: before processing day i, evict indices that fell out of the window from the front, then evict indices from the back whose price is <= the current price (they can never be the max again once a bigger, more recent price exists). The front of the deque is always the window's max. Push i, read the front, compare against price[i]. Every index enters and leaves the deque at most once, so the whole pass is O(n).",
    code: `from collections import deque

def trailing_stop_triggers(prices: list[float], window: int, pct: float) -> list[int]:
    dq: deque[int] = deque()   # indices, prices strictly decreasing front-to-back
    triggers = []
    for i, p in enumerate(prices):
        while dq and dq[0] <= i - window:
            dq.popleft()                 # drop indices that fell out of the window
        while dq and prices[dq[-1]] <= p:
            dq.pop()                     # a smaller, older price can never be the max again
        dq.append(i)
        window_high = prices[dq[0]]      # front of deque = current window max
        if p <= window_high * (1 - pct):
            triggers.append(i)
    return triggers`,
    language: "python",
    complexity: { time: "O(n) amortized", space: "O(window)" },
  },
  {
    id: "lc-buy-sell-stock-iii",
    leetcodeNumber: 123,
    title: "Best Time to Buy and Sell Stock III (At Most Two Transactions)",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Complete at most two transactions to maximize profit. You must sell before buying again -- no overlapping positions.",
    examples: [
      {
        input: "prices = [3,3,5,0,0,3,1,4]",
        output: "6",
        explanation: "Buy at 0, sell at 3 (profit 3); buy at 1, sell at 4 (profit 3); total 6.",
      },
    ],
    approach:
      "Four running scalars instead of a 2D DP table: buy1 (best -cost after one buy), sell1 (best profit after closing txn 1), buy2 (best net position after reinvesting txn-1 profit into a second buy), sell2 (best profit after closing txn 2). Each is a max over its own history, updated in a single left-to-right pass -- the dependency chain (buy1 -> sell1 -> buy2 -> sell2) is exactly why it can collapse from O(n) space to O(1).",
    code: `def max_profit_two_txns(prices: list[int]) -> int:
    buy1 = buy2 = float('-inf')
    sell1 = sell2 = 0
    for p in prices:
        buy1 = max(buy1, -p)          # cheapest entry seen so far for txn 1
        sell1 = max(sell1, buy1 + p)  # best profit after closing txn 1 today
        buy2 = max(buy2, sell1 - p)   # reinvest txn-1's profit into a txn-2 entry
        sell2 = max(sell2, buy2 + p)  # best total profit after closing txn 2 today
    return sell2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-gamblers-ruin",
    title: "Gambler's Ruin: Probability of Hitting a Target Bankroll",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "A trader starts with i units of capital, 0 < i < N, and repeatedly makes unit bets: wins with probability p (capital +1) or loses with probability q = 1-p (capital -1). Betting stops at 0 (ruin) or N (target reached). Give the probability of reaching N before 0, as a function of p, i, N -- and describe how you'd sanity-check the formula.",
    examples: [
      {
        input: "p=0.5, i=50, N=100",
        output: "0.5",
        explanation: "Fair game: the symmetric random walk gives P(reach N) = i / N.",
      },
      {
        input: "p=0.47, i=50, N=100",
        output: "~0.018",
        explanation: "A tiny house edge compounds brutally over a long walk -- the classic reason 'just play longer to even out variance' is backwards with a negative edge.",
      },
    ],
    approach:
      "Set P(i) = probability of reaching N before 0 starting from i. It satisfies the recurrence P(i) = p*P(i+1) + q*P(i-1) with boundary P(0)=0, P(N)=1 -- a first-step Markov argument. For p != q the solution is P(i) = (1 - (q/p)^i) / (1 - (q/p)^N); for p = q = 0.5 the recurrence degenerates and P(i) = i/N (linear, by symmetry). The interview point is less the algebra and more the intuition: with any edge against you, ruin probability grows exponentially in the ratio (q/p), which is why a small negative edge compounded over a long random walk is far more dangerous than it looks from a single bet. Verify the closed form against Monte Carlo before trusting it in an interview.",
    code: `import random

def ruin_probability(p: float, i: int, N: int) -> float:
    q = 1 - p
    if p == 0.5:
        return i / N                     # symmetric walk: linear in starting position
    r = q / p
    return (1 - r ** i) / (1 - r ** N)   # closed-form gambler's ruin

def simulate_ruin(p: float, i: int, N: int, trials: int = 20000) -> float:
    reached_target = 0
    for _ in range(trials):
        pos = i
        while 0 < pos < N:
            pos += 1 if random.random() < p else -1
        reached_target += (pos == N)
    return reached_target / trials       # should converge to ruin_probability(p, i, N)`,
    language: "python",
    complexity: { time: "O(1) closed form / O(trials * path length) simulation", space: "O(1)" },
  },
  {
    id: "lc-order-book-matching",
    title: "Limit Order Book Matching Engine (Price-Time Priority)",
    difficulty: "hard",
    topics: ["design", "heap", "order-book"],
    problem:
      "Design an order book supporting add_order(side, price, qty). Incoming buy orders match against resting sell orders priced at or below the limit, best price first; incoming sell orders match against resting buys priced at or above the limit, best price first. Within a price level, earlier orders fill first (time priority). Any unmatched quantity rests in the book. Return the list of fills produced by the new order.",
    examples: [
      {
        input: "sell 10@101, sell 5@100, then buy 8@101",
        output: "fills: 5@100, 3@101; 7 shares rest resting on the 101 ask",
        explanation: "The buy crosses the better (lower) ask price first, then the next-best price, price-time priority throughout.",
      },
    ],
    approach:
      "Two heaps: a min-heap of resting asks keyed by price (best = lowest), and a max-heap of resting bids keyed by negated price (best = highest); each heap entry also carries a monotonically increasing sequence number so ties at the same price resolve to the earlier order (time priority) for free via tuple comparison. A separate dict tracks each resting order's remaining quantity so partial fills can be applied in place instead of mutating heap entries directly; when a heap's top order's tracked quantity has hit zero, pop and skip it (lazy deletion) rather than searching the heap for it. Walk the opposing heap while the incoming order still has quantity and the best opposing price still crosses the limit, filling min(incoming, resting) at a time; whatever quantity remains after the opposing side stops crossing gets pushed onto the incoming side's own heap to rest.",
    code: `import heapq, itertools

class OrderBook:
    def __init__(self):
        self.asks: list[tuple[float, int]] = []   # min-heap: (price, seq)
        self.bids: list[tuple[float, int]] = []   # max-heap via negation: (-price, seq)
        self.qty: dict[int, int] = {}
        self._seq = itertools.count()

    def add_order(self, side: str, price: float, qty: int) -> list[tuple[int, float, int]]:
        fills = []  # (resting_seq, fill_price, fill_qty)
        book, opp = (self.bids, self.asks) if side == "buy" else (self.asks, self.bids)
        crosses = (lambda resting: resting <= price) if side == "buy" else (lambda resting: resting >= price)

        while qty > 0 and opp:
            top_key, top_seq = opp[0]
            resting_price = -top_key if side == "buy" else top_key
            if self.qty.get(top_seq, 0) == 0:
                heapq.heappop(opp)          # lazy delete: this resting order already filled
                continue
            if not crosses(resting_price):
                break                       # best opposing price no longer crosses the limit
            fill_qty = min(qty, self.qty[top_seq])
            self.qty[top_seq] -= fill_qty
            qty -= fill_qty
            fills.append((top_seq, resting_price, fill_qty))
            if self.qty[top_seq] == 0:
                heapq.heappop(opp)

        if qty > 0:                         # remainder rests in the book
            seq = next(self._seq)
            self.qty[seq] = qty
            heapq.heappush(book, (-price if side == "buy" else price, seq))
        return fills`,
    language: "python",
    complexity: { time: "O(log n) per matched or resting order", space: "O(n) resting orders" },
  },
  {
    id: "lc-position-tracker-fifo",
    title: "Position Tracker with FIFO Cost Basis",
    difficulty: "medium",
    topics: ["design", "queue", "simulation"],
    problem:
      "Design a PositionTracker for one symbol. trade(qty, price) records a fill -- positive qty is a buy, negative is a sell -- and returns the realized P&L from that fill, matching against the oldest open lots first (FIFO), including flipping from long to short or vice versa. Also support net_position() and unrealized_pnl(mark_price).",
    examples: [
      {
        input: "trade(100, 10.0); trade(50, 12.0); trade(-120, 15.0)",
        output: "realized: 0, 0, 560.0; net_position() -> 30",
        explanation: "The sell of 120 closes the 100-share @10 lot (100*(15-10)=500) then 20 of the 50-share @12 lot (20*(15-12)=60); 30 shares remain at cost basis 12.",
      },
    ],
    approach:
      "Keep a deque of open lots [qty, price], where a lot's sign gives its direction (positive = long, negative = short). A new trade first matches FIFO against lots of the OPPOSITE sign -- each match closes part of the oldest opposing lot and books realized P&L as (exit price - lot price) signed by which side is closing. Once opposing lots are exhausted (or there were none), any leftover quantity opens a new lot in the trade's own direction -- this is what lets a trade cross through a flat position and flip the net side in one call, since the loop naturally stops matching once the deque's front lot shares the trade's sign.",
    code: `from collections import deque

class PositionTracker:
    def __init__(self):
        self.lots: deque[list[float]] = deque()   # [qty, price]; sign = long(+) / short(-)

    def trade(self, qty: float, price: float) -> float:
        realized = 0.0
        remaining = qty
        while remaining != 0 and self.lots and (self.lots[0][0] > 0) != (remaining > 0):
            lot = self.lots[0]
            matched = min(abs(lot[0]), abs(remaining)) * (1 if remaining > 0 else -1)
            # closing part of an opposing lot: PnL is signed by the LOT's side, not the trade's
            realized += (-matched if lot[0] > 0 else matched) * (price - lot[1])
            lot[0] += matched
            remaining -= matched
            if lot[0] == 0:
                self.lots.popleft()
        if remaining != 0:
            self.lots.append([remaining, price])   # opens (or extends) a same-direction lot
        return realized

    def net_position(self) -> float:
        return sum(lot[0] for lot in self.lots)

    def unrealized_pnl(self, mark_price: float) -> float:
        return sum(lot[0] * (mark_price - lot[1]) for lot in self.lots)`,
    language: "python",
    complexity: { time: "O(1) amortized per trade", space: "O(open lots)" },
  },
];
