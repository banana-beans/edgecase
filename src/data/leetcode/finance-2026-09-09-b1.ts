import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-09
// A bounded max-heap for k trades closest to a reference price,
// a segment-tree sliding window for max drawdown, bounded-k-
// transaction stock DP, gambler's ruin probability, and a FIFO
// position tracker with average cost basis and realized P&L.
// ============================================================

export const financeBatch20260909: LeetCodeProblem[] = [
  {
    id: "lc-20260909-k-closest-trades-to-reference-price",
    title: "K Closest Trades to a Reference Price",
    difficulty: "medium",
    topics: ["heap", "sorting"],
    problem:
      "Given an array of executed trade prices and a reference price, return the k trade prices closest to the reference price, in any order. Distance is measured as absolute difference; on a tie, prefer the smaller price.",
    examples: [
      {
        input: "prices=[9.8,10.2,10.0,11.5,9.5], ref=10.0, k=3",
        output: "[9.8, 10.0, 10.2]",
        explanation:
          "Distances from 10.0 are 0.2, 0.2, 0, 1.5, 0.5. The three smallest distances belong to 10.0, 9.8, and 10.2.",
      },
    ],
    constraints: ["1 <= k <= prices.length <= 10^5", "0 < prices[i] < 10^6", "0 < ref < 10^6"],
    approach:
      "Maintain a bounded max-heap of size k keyed on (distance, price), where the heap's top is always the CURRENT worst candidate: largest distance, and among equal distances the largest price (so it gets evicted first, leaving the smaller price on ties, as required). Push every candidate, and whenever the heap grows past size k, pop the top. After one O(n) pass over all prices with O(log k) work per push/pop, the heap holds exactly the k closest. This beats sorting all n prices by distance (O(n log n)) whenever k is much smaller than n, since the heap never needs to hold more than k elements at once.",
    code: `import heapq

def k_closest_trades(prices: list[float], ref: float, k: int) -> list[float]:
    # max-heap on (distance, price) -- popped "largest" first, so ties on
    # distance are broken by evicting the LARGER price, keeping the smaller
    heap: list[tuple[float, float]] = []
    for p in prices:
        dist = abs(p - ref)
        heapq.heappush(heap, (-dist, -p))
        if len(heap) > k:
            heapq.heappop(heap)   # evict current worst (largest dist, then largest price)
    return [-p for _, p in heap]

print(sorted(k_closest_trades([9.8, 10.2, 10.0, 11.5, 9.5], ref=10.0, k=3)))
# [9.8, 10.0, 10.2]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-20260909-max-drawdown-sliding-window",
    title: "Maximum Drawdown Within Every Fixed-Length Window",
    difficulty: "hard",
    topics: ["sliding-window", "segment-tree"],
    problem:
      "Given a price series and a window length k, for every contiguous window of k consecutive prices, return the maximum drawdown within that window: the largest drop from a peak to a later trough inside the window (a non-negative number, 0 if the window never falls below its running peak).",
    examples: [
      {
        input: "prices=[10,8,7,12,9,15,6], k=4",
        output: "[3, 3, 3, 9]",
        explanation:
          "Window [10,8,7,12]: peak 10, worst later trough 7, drawdown 3. Window [15,6] appears in the last window [12,9,15,6]: peak 15 then trough 6, drawdown 9.",
      },
    ],
    constraints: ["1 <= k <= prices.length <= 10^5", "0 < prices[i] < 10^6"],
    approach:
      "A window's max drawdown isn't something a monotonic deque can track directly, because the answer depends on the ORDER of a peak-then-trough pair, not just the window's max or min in isolation. Build a segment tree where each node stores (max, min, max_drawdown) for its range; the merge of a left and right child is max(left.mdd, right.mdd, left.max - right.min) -- the drawdown either lives entirely in one half, or spans the boundary with the peak in the left half and the trough in the right half, and taking the best of all three covers every case. Each of the n-k+1 window queries then costs O(log n) against the prebuilt tree (O(n) to build), for O(n log n) total instead of the O(n*k) brute force of rescanning every window from scratch.",
    code: `def max_drawdown_sliding_window(prices: list[float], k: int) -> list[float]:
    n = len(prices)
    size = 1
    while size < n:
        size *= 2
    NEG, POS = float("-inf"), float("inf")
    seg_max = [NEG] * (2 * size)
    seg_min = [POS] * (2 * size)
    seg_mdd = [0.0] * (2 * size)

    for i, p in enumerate(prices):
        seg_max[size + i] = seg_min[size + i] = p

    def combine(a, b):
        # a is the LEFT range, b is the RIGHT range, in temporal order --
        # the cross term a.max - b.min is the "peak in a, trough in b" case
        return (max(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2], a[0] - b[1]))

    for i in range(size - 1, 0, -1):
        l, r = 2 * i, 2 * i + 1
        seg_max[i], seg_min[i], seg_mdd[i] = combine(
            (seg_max[l], seg_min[l], seg_mdd[l]), (seg_max[r], seg_min[r], seg_mdd[r])
        )

    def query(lo: int, hi: int):
        lo, hi = lo + size, hi + size + 1
        left_nodes, right_nodes = [], []
        while lo < hi:
            if lo & 1:
                left_nodes.append(lo); lo += 1
            if hi & 1:
                hi -= 1; right_nodes.append(hi)
            lo //= 2; hi //= 2
        nodes = left_nodes + right_nodes[::-1]   # restore left-to-right temporal order
        acc = (seg_max[nodes[0]], seg_min[nodes[0]], seg_mdd[nodes[0]])
        for node in nodes[1:]:
            acc = combine(acc, (seg_max[node], seg_min[node], seg_mdd[node]))
        return acc

    return [query(i, i + k - 1)[2] for i in range(n - k + 1)]

print(max_drawdown_sliding_window([10, 8, 7, 12, 9, 15, 6], 4))   # [3, 3, 3, 9]`,
    language: "python",
    complexity: { time: "O(n log n)", space: "O(n)" },
  },
  {
    id: "lc-20260909-max-profit-k-transactions",
    title: "Max Profit With At Most K Transactions",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for a stock and an integer k, you may complete at most k buy-then-sell transactions (never overlapping -- must sell before buying again). Return the maximum achievable profit.",
    examples: [
      {
        input: "prices=[3,2,6,5,0,3], k=2",
        output: "7",
        explanation:
          "Buy at 2, sell at 6 (profit 4); buy at 0, sell at 3 (profit 3). Total 7, using both allowed transactions.",
      },
    ],
    constraints: ["1 <= prices.length <= 1000", "0 <= k <= 100", "0 <= prices[i] <= 10^4"],
    approach:
      "Track, for each transaction count t from 1..k, two rolling scalars: hold[t] (best profit so far while holding a share, having started the t-th buy) and cash[t] (best profit so far while flat, having completed t sells). Each day's hold[t] either carries over or opens fresh by buying today off of cash[t-1] (profit banked from the PREVIOUS transaction, before spending on this one); cash[t] either carries over or closes today by selling off of hold[t]. This is O(n*k) instead of a naive O(n*k) with full 2D arrays wasting space -- more importantly, when k is at least n/2, no transaction limit is actually binding (you can capture every single up-move independently), so short-circuit to the simple 'sum of all positive day-over-day changes' greedy in O(n) rather than running the DP at all.",
    code: `def max_profit_k_transactions(prices: list[int], k: int) -> int:
    n = len(prices)
    if n == 0 or k == 0:
        return 0

    # k >= n // 2 means the transaction cap can never actually bind --
    # capture every positive daily move independently, no DP needed
    if k >= n // 2:
        return sum(max(0, prices[i + 1] - prices[i]) for i in range(n - 1))

    hold = [float("-inf")] * (k + 1)   # hold[t]: holding a share, t-th buy made
    cash = [0] * (k + 1)               # cash[t]: flat, t sells completed

    for price in prices:
        for t in range(1, k + 1):
            hold[t] = max(hold[t], cash[t - 1] - price)
            cash[t] = max(cash[t], hold[t] + price)

    return cash[k]

print(max_profit_k_transactions([3, 2, 6, 5, 0, 3], k=2))   # 7`,
    language: "python",
    complexity: { time: "O(n*k)", space: "O(k)" },
  },
  {
    id: "lc-20260909-gamblers-ruin-profit-target",
    title: "Gambler's Ruin: Probability of Reaching a Profit Target Before Going Bust",
    difficulty: "medium",
    topics: ["probability", "dynamic-programming"],
    problem:
      "A trader starts with capital `start` and makes a sequence of unit-size bets, winning +1 with probability p and losing -1 with probability (1-p), stopping either at capital `target` (success) or capital `bust` (ruin). Return the probability of reaching `target` before `bust`.",
    examples: [
      {
        input: "start=5, target=10, bust=0, p=0.4",
        output: "0.1215",
        explanation:
          "With an unfavorable coin (p < 0.5), the probability of climbing from 5 to 10 before falling to 0 is well below the naive 5/10 = 0.5 you'd guess for a fair coin.",
      },
    ],
    constraints: ["bust < start < target", "0 < p < 1"],
    approach:
      "This is the classical gambler's ruin random walk. Let r = (1-p)/p. For a FAIR coin (p=0.5) the win probability from wealth w is linear in position: (w - bust) / (target - bust), by symmetry. For a BIASED coin, the win probability follows a geometric-series formula in r: P(win from w) = (sum of r^i for i in 0..w-bust-1) / (sum of r^i for i in 0..target-bust-1) -- derived by solving the linear recurrence P(w) = p*P(w+1) + (1-p)*P(w-1) with boundary conditions P(bust)=0 and P(target)=1. Note how fast this collapses for an unfavorable edge: even starting halfway between bust and target, a small negative edge makes reaching the target far less likely than the halfway intuition suggests, which is exactly why a persistent negative-edge (cost-laden) strategy is dramatically more likely to blow up than break even.",
    code: `def prob_reach_target(start: int, target: int, bust: int, p: float) -> float:
    if p == 0.5:
        # symmetric case: win probability is linear in starting position
        return (start - bust) / (target - bust)

    r = (1 - p) / p   # ratio of losing to winning odds per step
    # P(win from w) = (sum_{i=0}^{w-bust-1} r^i) / (sum_{i=0}^{target-bust-1} r^i)
    numerator = sum(r ** i for i in range(start - bust))
    denominator = sum(r ** i for i in range(target - bust))
    return numerator / denominator

print(round(prob_reach_target(5, 10, 0, 0.4), 4))   # 0.1215
print(round(prob_reach_target(5, 10, 0, 0.5), 4))   # 0.5 -- fair coin, halfway odds`,
    language: "python",
    complexity: { time: "O(target - bust)", space: "O(1)" },
  },
  {
    id: "lc-20260909-design-fifo-position-tracker",
    title: "Design a FIFO Position Tracker With Average Cost Basis and Realized P&L",
    difficulty: "medium",
    topics: ["design", "queue"],
    problem:
      "Design a class supporting buy(quantity, price), which opens a new cost-basis lot, and sell(quantity, price), which closes existing lots on a FIFO basis (oldest lot first) and returns the realized profit or loss from that sale. Also support avg_cost(), the quantity-weighted average price across all currently open lots.",
    examples: [
      {
        input: "buy(10,100); buy(5,110); avg_cost(); sell(12,120)",
        output: "avg_cost() = 103.33, sell(...) = 220.0",
        explanation:
          "avg_cost blends both lots: (10*100 + 5*110)/15 = 103.33. Selling 12 consumes all 10 shares from the first lot (profit 10*20=200) then 2 shares from the second lot (profit 2*10=20), for 220 total; 3 shares remain in the second lot.",
      },
    ],
    constraints: ["up to 10^5 total operations", "a sell never exceeds total open quantity", "quantities and prices are positive"],
    approach:
      "Model open lots as a FIFO queue of [quantity, cost_price] pairs, using a deque so the oldest lot is always at the front. buy() simply appends a new lot in O(1). sell() repeatedly consumes from the front lot: it fills as much of the sell as that lot has left, accumulates the realized profit as filled_quantity * (sell_price - lot_cost_price), and either shrinks the front lot in place (partial fill) or pops it entirely (fully consumed) before moving to the next lot -- amortized O(1) per unit of quantity actually removed, since each lot is popped at most once over the object's whole lifetime. avg_cost() is a simple weighted average over whatever lots remain open.",
    code: `from collections import deque

class PositionTracker:
    def __init__(self):
        self.lots: deque[list[float]] = deque()   # FIFO: [quantity, cost_price]
        self.realized_pnl = 0.0

    def buy(self, quantity: int, price: float) -> None:
        self.lots.append([quantity, price])

    def sell(self, quantity: int, price: float) -> float:
        pnl = 0.0
        remaining = quantity
        while remaining > 0:
            lot_qty, lot_price = self.lots[0]
            filled = min(lot_qty, remaining)
            pnl += filled * (price - lot_price)   # realized gain/loss on this slice
            remaining -= filled
            if filled == lot_qty:
                self.lots.popleft()          # oldest lot fully consumed
            else:
                self.lots[0][0] -= filled    # oldest lot partially consumed
        self.realized_pnl += pnl
        return pnl

    def avg_cost(self) -> float | None:
        total_qty = sum(q for q, _ in self.lots)
        if total_qty == 0:
            return None
        return sum(q * p for q, p in self.lots) / total_qty

tracker = PositionTracker()
tracker.buy(10, 100.0)
tracker.buy(5, 110.0)
print(round(tracker.avg_cost(), 2))   # 103.33
print(tracker.sell(12, 120.0))        # 220.0
print(round(tracker.avg_cost(), 2))   # 110.0 -- 3 shares left in the second lot`,
    language: "python",
    complexity: { time: "O(1) amortized per unit filled for buy/sell, O(L) for avg_cost", space: "O(L) for L open lots" },
  },
];
