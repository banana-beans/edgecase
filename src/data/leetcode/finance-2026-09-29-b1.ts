import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-29
// A bounded max-heap top-k problem, a monotonic-deque sliding
// window maximum, the buy/sell-with-transaction-fee DP stock
// variant, a gambler's-ruin absorbing-Markov-chain probability
// problem, and a FIFO-cost-basis position tracker design.
// ============================================================

export const financeBatch20260929: LeetCodeProblem[] = [
  {
    id: "lc-20260929-k-closest-trades-to-price",
    title: "K Trades Closest to a Reference Price",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given a list of trade prices from today's tape and a reference price ref (e.g. the previous close), return the k trade prices closest to ref, in any order. Closeness is measured by absolute difference; ties broken toward the smaller price.",
    examples: [
      {
        input: "prices=[181.2, 185.0, 186.4, 184.9, 190.1], ref=185.0, k=3",
        output: "[185.0, 184.9, 186.4]",
        explanation:
          "Distances from 185.0 are 3.8, 0.0, 1.4, 0.1, 5.1 in list order, so the three smallest distances belong to 185.0 (0.0), 184.9 (0.1), and 186.4 (1.4).",
      },
    ],
    constraints: ["1 <= k <= prices.length <= 10^5", "prices are positive floats"],
    approach:
      "Maintain a bounded max-heap of size k keyed by (distance, price), where the heap's top always holds the current worst-kept candidate -- largest distance, and on a tie, largest price, since ties should be broken toward keeping the smaller price. Because Python's heapq is a min-heap, encode the key as (-distance, -price) so that the entry that is actually 'worst' (largest distance, then largest price) maps to the smallest key and therefore sits at the top, ready to be evicted. For each new price: push it while the heap has fewer than k entries; once full, compare its key against the current top and replace only if the new candidate is strictly better than the worst kept one. This keeps total work at O(n log k) instead of the O(n log n) a full sort would cost when k is much smaller than the input.",
    code: `import heapq

def k_closest_trades(prices: list[float], ref: float, k: int) -> list[float]:
    heap: list[tuple[float, float]] = []   # holds the k best-seen (key) pairs

    for price in prices:
        dist = abs(price - ref)
        # bigger distance -> smaller key; on a tie, bigger price -> smaller
        # key too, so the WORST kept candidate always sits at heap[0]
        key = (-dist, -price)
        if len(heap) < k:
            heapq.heappush(heap, key)
        elif key > heap[0]:
            heapq.heapreplace(heap, key)

    return [-neg_price for _, neg_price in heap]

print(k_closest_trades([181.2, 185.0, 186.4, 184.9, 190.1], ref=185.0, k=3))
# [185.0, 184.9, 186.4] (order not guaranteed)`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-20260929-sliding-window-max-book-depth",
    title: "Sliding Window Maximum of Best-Bid Depth",
    difficulty: "hard",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given an array depth where depth[i] is the resting size at the best bid after the i-th order-book update, and a window size w, return an array output where output[i] is the maximum depth over the window depth[i:i+w], for every valid window position.",
    examples: [
      {
        input: "depth=[8, 3, 11, 11, 6, 2, 14], w=3",
        output: "[11, 11, 11, 11, 14]",
        explanation:
          "Windows [8,3,11] -> 11, [3,11,11] -> 11, [11,11,6] -> 11, [11,6,2] -> 11, [6,2,14] -> 14.",
      },
    ],
    constraints: ["1 <= w <= depth.length <= 10^5"],
    approach:
      "Maintain a deque of INDICES into depth, kept in decreasing order of their depth values, so the front of the deque is always the index of the current window's maximum. On each new index i: pop from the back any indices whose depth value is <= depth[i], since they can never be the max again once a later, at-least-as-large value has arrived; then push i. Pop from the FRONT any index that has aged out of the window (index <= i - w). Once i reaches at least w-1, the deque's front index is the window's max, recorded before advancing. Each index is pushed and popped from the deque at most once across the whole scan, so total work is O(n) despite recomputing a max at every window position -- scanning each window fresh would be O(n*w).",
    code: `from collections import deque

def sliding_window_max_depth(depth: list[int], w: int) -> list[int]:
    dq: deque[int] = deque()   # indices, depth values decreasing front-to-back
    result: list[int] = []

    for i, d in enumerate(depth):
        # drop indices whose depth can never win again -- dominated by d
        while dq and depth[dq[-1]] <= d:
            dq.pop()
        dq.append(i)

        # drop the front index once it's aged out of the window
        if dq[0] <= i - w:
            dq.popleft()

        if i >= w - 1:
            result.append(depth[dq[0]])

    return result

print(sliding_window_max_depth([8, 3, 11, 11, 6, 2, 14], 3))
# [11, 11, 11, 11, 14]`,
    language: "python",
    complexity: { time: "O(n)", space: "O(w)" },
  },
  {
    id: "lc-20260929-buy-sell-transaction-fee",
    title: "Best Time to Buy and Sell Stock With a Transaction Fee",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices and a fixed fee charged once per completed round trip, you may complete as many transactions as you like (hold at most one share at a time, sell before buying again). Return the maximum achievable profit.",
    examples: [
      {
        input: "prices=[1, 3, 2, 8, 4, 9], fee=2",
        output: "8",
        explanation:
          "Buy at 1, sell at 8: profit 8-1-2=5. Buy at 4, sell at 9: profit 9-4-2=3. Total profit 5+3=8.",
      },
    ],
    constraints: ["0 <= prices.length <= 5000", "0 <= prices[i] <= 1000", "0 <= fee <= 1000"],
    approach:
      "Track two running states per day: cash (max profit so far if not currently holding a share) and hold (max profit so far if currently holding one). hold either keeps yesterday's held position or is entered today by buying out of yesterday's cash; cash either stays in cash or is entered today by selling today's held share, with the fee subtracted exactly once on the sell leg. The answer is cash on the final day, since ending mid-hold with an unsold share is never optimal. This is the same O(n) two-state pattern as the fee-free version of this problem, with the fee folded into the sell transition.",
    code: `def max_profit_with_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    cash = 0                # not holding, max profit so far
    hold = -prices[0]        # holding a share, max profit so far

    for price in prices[1:]:
        # sell today: pay the fee once, here, at the sell leg
        cash = max(cash, hold + price - fee)
        # buy today: spend today's price out of yesterday's cash
        hold = max(hold, cash - price)

    return cash   # ending mid-hold is never optimal -- unsold profit isn't realized

print(max_profit_with_fee([1, 3, 2, 8, 4, 9], fee=2))
# 8`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260929-gamblers-ruin-probability",
    title: "Gambler's Ruin: Probability of Reaching a Profit Target Before Going Broke",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "A trader starts with i units of capital and makes a series of independent bets, each winning one unit with probability p and losing one unit with probability 1-p. They stop when capital hits 0 (ruin) or reaches N (target). Return the probability they reach the target N before going broke, as a function of i, N, and p.",
    examples: [
      {
        input: "i=2, N=5, p=0.5",
        output: "0.4",
        explanation:
          "For the fair (p=0.5) case, the classic gambler's ruin result gives probability i/N = 2/5 = 0.4 of reaching the target before ruin.",
      },
    ],
    constraints: ["0 <= i <= N", "0 < p < 1"],
    approach:
      "This is the classic gambler's ruin absorbing Markov chain: let P_i be the probability of reaching N before 0, starting from capital i. Conditioning on the first bet gives the recurrence P_i = p*P_(i+1) + (1-p)*P_(i-1), a linear second-order recurrence with boundary conditions P_0=0 and P_N=1. Solving it: when p != 0.5, the ratio r=(1-p)/p makes P_i a geometric-ratio expression, P_i = (1 - r^i) / (1 - r^N); when p=0.5 the recurrence degenerates and the solution is the linear P_i = i/N, since a fair random walk's ruin probability is symmetric in exactly that way. Either branch evaluates in O(1) rather than solving the full (N+1)-state linear system directly.",
    code: `def prob_reach_target_before_ruin(i: int, N: int, p: float) -> float:
    if p == 0.5:
        # symmetric fair walk: degenerate closed form, linear in i
        return i / N

    r = (1 - p) / p
    # geometric-ratio closed form from the boundary-value recurrence
    return (1 - r ** i) / (1 - r ** N)

print(prob_reach_target_before_ruin(i=2, N=5, p=0.5))
# 0.4

print(round(prob_reach_target_before_ruin(i=2, N=5, p=0.45), 4))
# an unfavorable edge (p < 0.5) drags this well below the fair 0.4`,
    language: "python",
    complexity: { time: "O(1) (or O(log i + log N) computing r**i via fast exponentiation)", space: "O(1)" },
  },
  {
    id: "lc-20260929-fifo-position-tracker",
    title: "Design a FIFO Position Tracker With Realized P&L",
    difficulty: "medium",
    topics: ["design", "queue"],
    problem:
      "Design a class PositionTracker for a single symbol supporting buy(qty, price) and sell(qty, price), which realize P&L against the OLDEST open lots first (FIFO cost basis), and net_position(), which returns the current signed share count. Selling can only be called with qty <= current long position (no shorting in this version).",
    examples: [
      {
        input: "buy(100, 10.0); buy(50, 12.0); sell(120, 15.0); net_position()",
        output: "realized P&L = 560.0; net_position() = 30",
        explanation:
          "The sell of 120 consumes the full first lot (100 @ 10) and 20 shares of the second lot (@ 12) FIFO: 120*15 - (100*10 + 20*12) = 1800 - 1240 = 560. That leaves 30 shares of the second lot still open.",
      },
    ],
    constraints: ["1 <= qty <= 10^6", "price > 0", "sell qty never exceeds the current net long position"],
    approach:
      "Keep open lots in a deque of [qty, price] pairs, appended on every buy so the oldest lot is always at the front. On a sell, walk the deque from the front, consuming whole lots (or a partial slice of the front lot) until the sell quantity is exhausted, accruing realized P&L as (sell_price - lot_price) * qty_consumed for each piece consumed. A lot fully consumed is popped from the front; a lot partially consumed has its remaining quantity written back in place. Net position is a running counter updated on every buy/sell rather than resummed from the deque, so it's an O(1) read instead of an O(lots) scan.",
    code: `from collections import deque

class PositionTracker:
    def __init__(self):
        self.lots: deque[list[float]] = deque()   # [qty, price], oldest first
        self.net_qty = 0
        self.realized_pnl = 0.0

    def buy(self, qty: int, price: float) -> None:
        self.lots.append([qty, price])
        self.net_qty += qty

    def sell(self, qty: int, price: float) -> None:
        remaining = qty
        while remaining > 0:
            lot_qty, lot_price = self.lots[0]
            consumed = min(lot_qty, remaining)
            self.realized_pnl += consumed * (price - lot_price)
            remaining -= consumed
            if consumed == lot_qty:
                self.lots.popleft()          # oldest lot fully consumed
            else:
                self.lots[0][0] -= consumed   # partial: shrink lot in place
        self.net_qty -= qty

    def net_position(self) -> int:
        return self.net_qty

tracker = PositionTracker()
tracker.buy(100, 10.0)
tracker.buy(50, 12.0)
tracker.sell(120, 15.0)
print(tracker.realized_pnl, tracker.net_position())
# 560.0 30`,
    language: "python",
    complexity: { time: "O(1) amortized per buy, O(lots consumed) per sell", space: "O(open lots)" },
  },
];
