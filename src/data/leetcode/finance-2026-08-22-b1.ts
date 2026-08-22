import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-22
// A bounded max-heap for finding trades closest to a reference
// price, a two-deque sliding window for the longest quiet
// consolidation range, a buy-sell DP variant with a flat
// transaction fee, a gambler's-ruin probability problem with
// the p=0.5 special case, and a design problem for a lazily
// -deleted L2 price-aggregated order book.
// ============================================================

export const financeBatch20260822: LeetCodeProblem[] = [
  {
    id: "lc-k-closest-trades-heap",
    title: "K Trade Prices Closest to a Reference Price",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given a list of trade prices printed during a session, a reference price (e.g. the prior close or a fair-value estimate), and an integer k, return the k trade prices closest to the reference price -- without fully sorting the entire trade list.",
    examples: [
      {
        input: "prices=[102,94,101,105,89], ref=100, k=3",
        output: "[101, 102, 105]",
        explanation:
          "Distances from 100 are 2, 6, 1, 5, 11 respectively. The 3 smallest distances belong to 101 (1), 102 (2), and 105 (5).",
      },
    ],
    constraints: ["1 <= number of prices <= 10^5", "1 <= k <= number of prices"],
    approach:
      "Maintain a bounded max-heap of size k, keyed by distance from the reference price (Python's heapq is min-heap only, so store negated distance to keep the WORST of the current top-k at the top for O(log k) eviction). For each incoming price: if the heap has fewer than k entries, push it directly. Otherwise compare its distance to the heap's current worst distance -- if strictly smaller, evict the worst and push the new one. The heap never grows past size k, so each of the n prices costs O(log k) instead of the O(log n) a full sort would cost, which matters when k is small relative to a large trade tape (e.g. the 20 prints nearest a benchmark among millions).",
    code: `import heapq

def k_closest_trades(prices: list[float], ref: float, k: int) -> list[float]:
    heap: list[tuple[float, float]] = []   # max-heap by distance: (-distance, price)

    for p in prices:
        d = abs(p - ref)
        if len(heap) < k:
            heapq.heappush(heap, (-d, p))
        elif -heap[0][0] > d:              # current worst distance beats this price
            heapq.heapreplace(heap, (-d, p))

    # heap now holds exactly the k closest -- sort just for readable output
    return sorted((p for _, p in heap), key=lambda p: abs(p - ref))

prices = [102.0, 94.0, 101.0, 105.0, 89.0]
print(k_closest_trades(prices, ref=100.0, k=3))   # [101.0, 102.0, 105.0]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-longest-bounded-range-window",
    title: "Longest Window With a Bounded Intraday Price Range",
    difficulty: "medium",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given a sequence of intraday prices and a threshold, find the length of the longest contiguous window where the range (max minus min within the window) does not exceed the threshold -- the longest 'quiet' consolidation period a range-breakout strategy might wait for before trading.",
    examples: [
      {
        input: "prices=[10,12,11,15,13,12], threshold=3",
        output: "3",
        explanation:
          "The window [15,13,12] has range 15-12=3 (valid, length 3); [10,12,11] has range 12-10=2 (also valid, length 3). No length-4 window keeps range <= 3, since extending either one pulls in a price more than 3 away from its extremes.",
      },
    ],
    constraints: ["1 <= number of prices <= 10^5"],
    approach:
      "This is the sliding-window-maximum-and-minimum pattern applied to a range constraint. Maintain two monotonic deques of indices: one keeping prices decreasing front-to-back (so its front is always the current window's max) and one keeping prices increasing front-to-back (front is always the current min). When a new price arrives, pop from the back of each deque any indices whose price is now dominated by the new one -- those entries can never again be the extremum while the new price is in the window -- then append the new index. While the window's range (front of max deque minus front of min deque) exceeds the threshold, advance the left pointer, evicting any deque fronts that have fallen out of the window. Each index enters and leaves each deque at most once, so the whole scan is O(n) despite tracking a running max and min simultaneously.",
    code: `from collections import deque

def longest_bounded_range_window(prices: list[float], threshold: float) -> int:
    max_dq: deque[int] = deque()   # indices; prices decreasing front-to-back
    min_dq: deque[int] = deque()   # indices; prices increasing front-to-back
    left = 0
    best = 0

    for right, p in enumerate(prices):
        while max_dq and prices[max_dq[-1]] <= p:
            max_dq.pop()
        max_dq.append(right)
        while min_dq and prices[min_dq[-1]] >= p:
            min_dq.pop()
        min_dq.append(right)

        # shrink from the left while the window's range is too wide
        while prices[max_dq[0]] - prices[min_dq[0]] > threshold:
            left += 1
            if max_dq[0] < left:
                max_dq.popleft()
            if min_dq[0] < left:
                min_dq.popleft()

        best = max(best, right - left + 1)

    return best

prices = [10, 12, 11, 15, 13, 12]
print(longest_bounded_range_window(prices, threshold=3))   # 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n) worst case for the deques" },
  },
  {
    id: "lc-stock-fee-unlimited-dp",
    title: "Max Profit With Unlimited Transactions and a Flat Fee",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for one stock and a fixed transaction fee charged once per completed round trip (a buy followed by a sell), find the maximum profit achievable from an unlimited number of transactions. You must sell your current position before buying again.",
    examples: [
      {
        input: "prices=[1,3,2,8,4,9], fee=2",
        output: "8",
        explanation:
          "Buy at 1, sell at 8 (profit 7-2=5 after fee), buy at 4, sell at 9 (profit 5-2=3 after fee) -- total 8. Taking the small 1->3 move separately nets less once each round trip pays its own fee.",
      },
    ],
    constraints: ["1 <= number of days <= 5*10^4", "0 <= price <= 5*10^4", "0 <= fee <= 5*10^4"],
    approach:
      "Track two running states instead of enumerating transactions explicitly: cash (max profit while holding no position) and hold (max profit while currently holding one share, cost basis baked in). Each day, cash can either stay the same or come from selling today's holding, paying the fee once at the point of sale; hold can either stay the same or come from buying today out of yesterday's cash. Charging the fee exactly once per completed round trip -- at the sell, not the buy -- is what keeps the two states correctly comparable; charging it twice or at the wrong state double-counts it. This collapses what looks like a transaction-enumeration problem into an O(n) single pass with O(1) state, the same family as the plain and cooldown variants of the buy-sell-stock problem.",
    code: `def max_profit_with_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    cash = 0              # max profit while holding NO shares
    hold = -prices[0]     # max profit while holding one share (cost basis included)

    for price in prices[1:]:
        cash = max(cash, hold + price - fee)   # sell today; fee charged once, here
        hold = max(hold, cash - price)          # buy today, funded from cash

    return cash   # optimal to never end the day still holding a share

print(max_profit_with_fee([1, 3, 2, 8, 4, 9], fee=2))   # 8`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-gamblers-ruin-probability",
    title: "Gambler's Ruin: Probability of Hitting a Profit Target Before a Stop-Loss",
    difficulty: "hard",
    topics: ["probability", "markov-chain", "dynamic-programming"],
    problem:
      "A trader starts with i units of capital (an integer) and makes a sequence of independent unit-sized bets: each wins (+1) with probability p or loses (-1) with probability 1-p. The trader stops upon reaching N units (the profit target) or 0 units (ruin). Compute the probability of hitting the profit target before ruin, starting from i units, for an arbitrary p -- including the fair-coin case p=0.5, where the standard closed-form ratio formula becomes a 0/0 indeterminate and must be handled as a genuinely different case, not just guarded against a division error.",
    examples: [
      {
        input: "i=4, N=10, p=0.5",
        output: "0.4",
        explanation:
          "At the fair-coin boundary the classic ratio formula degenerates and the true solution is linear in the starting capital: P(i) = i / N = 4/10 = 0.4.",
      },
    ],
    constraints: ["0 <= i <= N", "1 <= N <= 10^4", "0 < p < 1"],
    approach:
      "Solving the linear difference equation P(i) = p*P(i+1) + (1-p)*P(i-1) with boundary conditions P(0)=0, P(N)=1 gives the classic gambler's-ruin closed form P(i) = (1 - (q/p)^i) / (1 - (q/p)^N) for p != 1/2, where q = 1-p. At exactly p=1/2 that expression is 0/0, and the actual limiting solution is the linear P(i) = i/N -- a real case split in the math, not a numerical edge case to paper over, and naively evaluating the ratio formula for p very close to but not exactly 0.5 is numerically unstable (catastrophic cancellation between two nearly-equal powers) even though the true function is continuous there. As an independent check, the same recursion can be solved by direct fixed-point iteration (Gauss-Seidel style DP sweeps) with the boundary values pinned every pass -- it converges to the identical answer without any special-casing, which is a useful way to verify the closed form under interview pressure.",
    code: `def ruin_probability(i: int, N: int, p: float) -> float:
    q = 1.0 - p
    if abs(p - 0.5) < 1e-12:
        return i / N                       # fair-coin case: linear, not the ratio formula
    ratio = q / p
    return (1 - ratio**i) / (1 - ratio**N)

print(ruin_probability(4, 10, 0.5))            # 0.4
print(round(ruin_probability(4, 10, 0.6), 4))  # edge toward the profit target when p > 0.5

# verification via direct DP -- solves the same recursion with no
# closed-form special case, useful to sanity-check the formula above
def ruin_probability_dp(N: int, p: float, iters: int = 2000) -> list[float]:
    q = 1.0 - p
    P = [i / N for i in range(N + 1)]      # arbitrary initial guess; endpoints fixed below
    for _ in range(iters):
        nxt = P[:]
        for i in range(1, N):
            nxt[i] = p * P[i + 1] + q * P[i - 1]
        nxt[0], nxt[N] = 0.0, 1.0
        P = nxt
    return P

dp = ruin_probability_dp(10, 0.6)
print(round(dp[4], 4))   # matches the closed-form value above`,
    language: "python",
    complexity: { time: "O(1) for the closed form, O(N*iters) for the DP check", space: "O(1) closed form, O(N) DP" },
  },
  {
    id: "lc-l2-order-book-design",
    title: "Design a Level-2 (Price-Aggregated) Order Book",
    difficulty: "hard",
    topics: ["design", "heap", "hash-map"],
    problem:
      "Design a simplified level-2 order book for one instrument supporting add_order(side, price, qty) to add resting quantity at a price level, cancel_order(side, price, qty) to remove quantity from a level, and best_bid_ask() returning the current best (highest) bid price and best (lowest) ask price, even as price levels empty out over time.",
    examples: [
      {
        input:
          'add_order("buy",100.0,50); add_order("buy",99.5,30); add_order("sell",100.5,20); best_bid_ask(); cancel_order("buy",100.0,50); best_bid_ask()',
        output: "(100.0, 100.5) then (99.5, 100.5)",
        explanation:
          "After the initial orders, best bid is 100.0 and best ask is 100.5. Cancelling all 50 units at 100.0 empties that level, so the next best_bid_ask() call must skip the now-empty 100.0 level and correctly report 99.5.",
      },
    ],
    constraints: ["1 <= number of operations <= 10^5", "price and qty > 0"],
    approach:
      "Pair a hash map with a heap per side: bid_qty and ask_qty map price to currently-resting quantity for O(1) add/cancel bookkeeping, while a max-heap of bid prices (negated, since Python's heapq is min-heap only) and a min-heap of ask prices give O(log n) access to the best price. The subtlety is cancellation: removing an arbitrary price from the middle of a heap is O(n), so cancel_order never touches the heap directly -- it only decrements the quantity map, potentially to zero or negative-canceling-more-than-resting in a stricter spec. When best_bid_ask() is called, it peeks the heap's top and checks the quantity map: if that price's resting quantity is no longer positive, the price is stale, so it is popped and discarded, and the check repeats on the new top. This is the standard heap-plus-hashmap lazy-deletion pattern for a priority structure that needs cheap arbitrary removal, and it stays efficient because each price enters a heap at most once per add_order call, so the total lazy-pop work across the whole run is bounded by the number of adds.",
    code: `import heapq

class L2OrderBook:
    def __init__(self):
        self.bid_qty: dict[float, int] = {}
        self.ask_qty: dict[float, int] = {}
        self.bid_heap: list[float] = []   # negated prices -- max-heap of bids
        self.ask_heap: list[float] = []   # plain prices -- min-heap of asks

    def add_order(self, side: str, price: float, qty: int) -> None:
        book = self.bid_qty if side == "buy" else self.ask_qty
        book[price] = book.get(price, 0) + qty
        if side == "buy":
            heapq.heappush(self.bid_heap, -price)
        else:
            heapq.heappush(self.ask_heap, price)

    def cancel_order(self, side: str, price: float, qty: int) -> None:
        book = self.bid_qty if side == "buy" else self.ask_qty
        if price in book:
            book[price] -= qty
            # the level may now be empty; the stale price stays in the heap
            # and gets lazily discarded the next time it reaches the top

    def _best(self, heap: list[float], book: dict[float, int], sign: int):
        while heap:
            price = sign * heap[0]
            if book.get(price, 0) > 0:
                return price
            heapq.heappop(heap)          # top is stale/emptied -- discard and retry
        return None

    def best_bid_ask(self):
        bid = self._best(self.bid_heap, self.bid_qty, -1)
        ask = self._best(self.ask_heap, self.ask_qty, 1)
        return (bid, ask)

book = L2OrderBook()
book.add_order("buy", 100.0, 50)
book.add_order("buy", 99.5, 30)
book.add_order("sell", 100.5, 20)
print(book.best_bid_ask())          # (100.0, 100.5)

book.cancel_order("buy", 100.0, 50)
print(book.best_bid_ask())          # (99.5, 100.5) -- stale 100.0 lazily skipped`,
    language: "python",
    complexity: { time: "O(log n) amortized per operation", space: "O(n) for levels and heaps" },
  },
];
