import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-10
// K trade prices closest to a reference price (bounded max-heap),
// longest tick window where the bid-ask spread stays under a
// threshold (two-monotonic-deque sliding window, LC1438 shape),
// max profit under a hard cap on round-trip transactions (DP,
// LC188 shape), expected number of trades until two consecutive
// wins (Markov/probability), and a price-time priority limit
// order matching engine (design, lazy-deleted heaps per side).
// ============================================================

export const financeBatch20261010: LeetCodeProblem[] = [
  {
    id: "lc-20261010-k-closest-trades-to-reference-price",
    title: "K Trade Prices Closest to a Reference Price (Bounded Max-Heap)",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given a list of executed trade prices and a reference price (e.g. the arrival price for a slippage study), return the k trade prices whose distance from the reference is smallest. Order of the output doesn't matter.",
    examples: [
      {
        input: "trades = [10, 2, 14, 4, 7, 6], ref = 5, k = 3",
        output: "[4, 6, 7] (any order)",
        explanation:
          "Distances from 5: 10->5, 2->3, 14->9, 4->1, 7->2, 6->1. The three smallest distances belong to 4 (1), 6 (1), and 7 (2).",
      },
    ],
    constraints: ["1 <= k <= trades.length <= 10^5", "trades and ref are floats"],
    approach:
      "Rather than sorting all n trades by distance (O(n log n)) just to keep k of them, maintain a max-heap bounded to size k: push each trade's (distance, price) pair, and whenever the heap grows past k, pop the current FARTHEST entry. Because heapq is a min-heap, negating the distance before pushing makes its smallest key correspond to the largest actual distance, so a plain heappop evicts the farthest trade seen so far. After one pass, whatever remains in the heap is exactly the k closest trades -- the heap never holds more than k+1 elements at once, so each push/pop is O(log k) instead of paying for a full sort.",
    code: `import heapq

def k_closest_to_reference(trades: list[float], ref: float, k: int) -> list[float]:
    heap: list[tuple[float, float]] = []   # entries: (-distance, price)
    for price in trades:
        dist = abs(price - ref)
        # negate distance so heapq's min-heap behaves like a MAX-heap on distance
        heapq.heappush(heap, (-dist, price))
        if len(heap) > k:
            heapq.heappop(heap)   # evicts the currently farthest trade
    return [price for _, price in heap]

print(sorted(k_closest_to_reference([10, 2, 14, 4, 7, 6], ref=5, k=3)))
# [4, 6, 7]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-20261010-longest-window-spread-below-threshold",
    title: "Longest Tick Window Where the Bid-Ask Spread Stays Below a Threshold",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a tick-by-tick sequence of quoted spreads (ask minus bid), find the length of the longest contiguous window in which the difference between the largest and smallest spread observed is at most a given limit.",
    examples: [
      {
        input: "spreads = [8, 2, 4, 7], limit = 4",
        output: "2",
        explanation:
          "The window [2,4] has max-min = 2 (ok, length 2); [4,7] has max-min = 3 (ok, length 2). Any 3-tick window includes 8 paired with 2 or 4, giving a spread range above 4.",
      },
    ],
    constraints: ["1 <= spreads.length <= 10^5", "0 <= spreads[i] <= 10^4"],
    approach:
      "Track the window's current max and min WITHOUT rescanning them on every move by keeping two monotonic deques: one decreasing (its front is always the window's current max) and one increasing (its front is always the window's current min). Advance the right pointer one tick at a time, popping from the back of each deque any value that the new tick makes obsolete for that deque's ordering, then push the new tick onto both. Whenever front(maxDeque) - front(minDeque) exceeds the limit, the window is invalid, so advance the left pointer -- popping from the FRONT of either deque if its index falls out of the window -- until the gap is back within limit. Because both pointers only move forward and each index enters and leaves each deque at most once, the whole scan is O(n) despite looking like a nested loop.",
    code: `from collections import deque

def longest_window_spread_below(spreads: list[int], limit: int) -> int:
    max_dq: deque[int] = deque()   # indices, spreads[...] strictly decreasing
    min_dq: deque[int] = deque()   # indices, spreads[...] strictly increasing
    left = 0
    best = 0

    for right, s in enumerate(spreads):
        while max_dq and spreads[max_dq[-1]] <= s:
            max_dq.pop()
        max_dq.append(right)
        while min_dq and spreads[min_dq[-1]] >= s:
            min_dq.pop()
        min_dq.append(right)

        # shrink from the left while the window's range exceeds the limit
        while spreads[max_dq[0]] - spreads[min_dq[0]] > limit:
            left += 1
            if max_dq[0] < left:
                max_dq.popleft()
            if min_dq[0] < left:
                min_dq.popleft()

        best = max(best, right - left + 1)

    return best

print(longest_window_spread_below([8, 2, 4, 7], 4))
# 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
    leetcodeNumber: 1438,
  },
  {
    id: "lc-20261010-max-profit-k-transactions",
    title: "Maximum Profit With At Most K Buy-Sell Transactions",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices and an integer k, you may complete at most k buy-then-sell round trips (never holding more than one share at once, and a sell must happen before the next buy). Return the maximum achievable profit.",
    examples: [
      {
        input: "k = 2, prices = [3, 2, 6, 5, 0, 3]",
        output: "7",
        explanation:
          "Buy at 2, sell at 6 (profit 4); buy at 0, sell at 3 (profit 3). Two transactions, total profit 4 + 3 = 7 -- the best achievable with at most 2 round trips.",
      },
    ],
    constraints: ["0 <= k <= 100", "0 <= prices.length <= 1000"],
    approach:
      "Track two DP arrays indexed by how many round trips have been STARTED so far, 1..k: hold[t] is the best profit while currently holding a share, having started the t-th buy; cash[t] is the best profit while flat, having completed the t-th sell. Process prices left to right, and for each day update every t from 1 to k: hold[t] = max(hold[t], cash[t-1] - price) (keep holding, or start transaction t today using the capital freed by finishing transaction t-1); cash[t] = max(cash[t], hold[t] + price) (stay flat, or close out transaction t today). cash[0] is fixed at 0 (no transactions, no profit) and anchors the recursion. The answer is cash[k], the best profit using at most k completed round trips. This runs in O(n*k) time with O(k) space if you roll the day dimension away, which matters because prices.length can be up to 1000 and k up to 100.",
    code: `def max_profit_k_transactions(k: int, prices: list[int]) -> int:
    if not prices or k == 0:
        return 0

    # hold[t]: best profit while holding a share, on the t-th round trip
    # cash[t]: best profit while flat, having completed t round trips
    hold = [float("-inf")] * (k + 1)
    cash = [0] * (k + 1)

    for price in prices:
        for t in range(1, k + 1):
            hold[t] = max(hold[t], cash[t - 1] - price)
            cash[t] = max(cash[t], hold[t] + price)

    return cash[k]

print(max_profit_k_transactions(2, [3, 2, 6, 5, 0, 3]))
# 7`,
    language: "python",
    complexity: { time: "O(n * k)", space: "O(k)" },
    leetcodeNumber: 188,
  },
  {
    id: "lc-20261010-expected-trades-until-two-consecutive-wins",
    title: "Expected Number of Trades Until Two Consecutive Profitable Trades",
    difficulty: "medium",
    topics: ["probability"],
    problem:
      "A trading strategy wins each trade independently with probability p (and loses with probability 1-p). Return the expected number of trades needed to see two profitable trades IN A ROW for the first time.",
    examples: [
      {
        input: "p = 0.5",
        output: "6.0",
        explanation:
          "This is the classic expected-flips-to-get-two-heads-in-a-row result: E = (1 + p) / p^2 = 1.5 / 0.25 = 6.0.",
      },
    ],
    constraints: ["0 < p <= 1"],
    approach:
      "Model this with two states instead of trying to reason about the whole sequence at once: state S0 ('no active win streak') and state S1 ('last trade was a win, one away from the target'). Let E0 and E1 be the expected number of ADDITIONAL trades needed from each state. From S0, one more trade is always spent, then with probability p you land in S1 and with probability 1-p you stay in S0: E0 = 1 + p*E1 + (1-p)*E0. From S1, one more trade is spent, then with probability p you're DONE (0 more needed) and with probability 1-p a loss sends you back to S0: E1 = 1 + (1-p)*E0. Substituting the second equation into the first and solving the resulting linear equation for E0 gives the closed form E0 = (1 + p) / p^2 -- no simulation needed, just two linear equations in two unknowns.",
    code: `def expected_trades_for_two_wins(p: float) -> float:
    # closed form from solving:
    #   E0 = 1 + p*E1 + (1-p)*E0
    #   E1 = 1 + (1-p)*E0
    return (1 + p) / (p ** 2)

print(expected_trades_for_two_wins(0.5))
# 6.0

# sanity check via simulation
import random

def simulate(p: float, trials: int = 200_000) -> float:
    total = 0
    for _ in range(trials):
        streak = 0
        trades = 0
        while streak < 2:
            trades += 1
            if random.random() < p:
                streak += 1
            else:
                streak = 0
        total += trades
    return total / trials

print(round(simulate(0.5), 2))
# close to 6.0`,
    language: "python",
    complexity: { time: "O(1) closed form", space: "O(1)" },
  },
  {
    id: "lc-20261010-design-order-matching-engine",
    title: "Design a Price-Time Priority Limit Order Matching Engine",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design a class MatchingEngine with add_order(side, price, size, order_id), which immediately crosses the new order against resting orders on the opposite side at the RESTING order's price (price-time priority), partially filling as needed and resting any unfilled remainder; it returns the list of fills generated. Also support cancel_order(order_id).",
    examples: [
      {
        input:
          "e=MatchingEngine(); e.add_order('buy',100.0,10,1); e.add_order('sell',99.0,4,2)",
        output: "[], then [(1, 2, 100.0, 4)]",
        explanation:
          "Order 1 rests (nothing to cross). Order 2 is willing to sell at 99 or better; it crosses resting bid 1, trading at the RESTING order's price of 100.0 for the overlapping size of 4, leaving order 1 resting with size 6.",
      },
    ],
    constraints: ["up to 10^6 total calls across all methods", "order_id values are unique"],
    approach:
      "Keep one max-heap for bids (via negated price) and one min-heap for asks, same structure as a standard top-of-book, plus a dict mapping order_id to its live remaining size so cancellation and partial fills are O(1) writes instead of O(n) heap surgery. On add_order, repeatedly peek the best price on the OPPOSITE side -- lazily popping any heap entry whose live size has hit zero (filled or cancelled) -- and as long as it crosses (a buy's price >= the best resting ask, or a sell's price <= the best resting bid), generate a fill for min(incoming remaining size, resting remaining size) AT THE RESTING ORDER'S PRICE, decrement both sides' live sizes, and keep going. Once nothing crosses and size remains, push the leftover onto the incoming order's own side. cancel_order just zeroes out live_size, so a cancelled order is silently skipped the next time it would surface at the top of its heap.",
    code: `import heapq

class MatchingEngine:
    def __init__(self):
        self.bids: list[tuple[float, int]] = []   # max-heap via negated price: (-price, order_id)
        self.asks: list[tuple[float, int]] = []   # min-heap: (price, order_id)
        self.live_size: dict[int, int] = {}        # order_id -> remaining size (0 = dead)

    def _best(self, heap: list[tuple[float, int]]):
        # lazily discard entries whose order has been fully filled or cancelled
        while heap and self.live_size.get(heap[0][1], 0) <= 0:
            heapq.heappop(heap)
        return heap[0] if heap else None

    def add_order(self, side: str, price: float, size: int, order_id: int) -> list[tuple]:
        self.live_size[order_id] = size
        fills: list[tuple] = []
        opp, mine, better = (self.asks, self.bids, lambda ap: ap <= price) \\
            if side == "buy" else (self.bids, self.asks, lambda bp: -bp >= price)

        while size > 0:
            best = self._best(opp)
            if best is None or not better(best[0]):
                break
            resting_price = best[0] if side == "buy" else -best[0]
            resting_id = best[1]
            trade_size = min(size, self.live_size[resting_id])
            buyer, seller = (order_id, resting_id) if side == "buy" else (resting_id, order_id)
            fills.append((buyer, seller, resting_price, trade_size))
            size -= trade_size
            self.live_size[resting_id] -= trade_size
            self.live_size[order_id] = size

        if size > 0:
            heapq.heappush(mine, (-price if side == "buy" else price, order_id))
        return fills

    def cancel_order(self, order_id: int) -> None:
        self.live_size[order_id] = 0   # lazy cancel -- skipped next time it's at the top

e = MatchingEngine()
print(e.add_order("buy", 100.0, 10, 1))    # []
print(e.add_order("sell", 99.0, 4, 2))     # [(1, 2, 100.0, 4)] -- trades at the RESTING price`,
    language: "python",
    complexity: { time: "O(log n) amortized per call", space: "O(n)" },
  },
];
