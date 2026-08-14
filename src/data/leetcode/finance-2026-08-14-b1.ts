import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-14
// A two-heap lazy-deletion sliding window median, a two-pointer
// window bounded by a notional cap, a generalized-cooldown DP
// for stock trading, a random-walk return-to-origin probability,
// and an iceberg order matching engine design problem.
// ============================================================

export const financeBatch20260814: LeetCodeProblem[] = [
  {
    id: "lc-sliding-window-median-trade-size",
    title: "Sliding Window Median of Trade Sizes",
    difficulty: "hard",
    topics: ["heap", "sliding-window", "design"],
    problem:
      "Given a chronological stream of trade sizes and a window length k, return the median trade size for every window of k consecutive trades, without re-sorting each window from scratch.",
    examples: [
      {
        input: "sizes=[100,200,50,300,250,180,400], k=3",
        output: "[100, 200, 250, 250, 250]",
        explanation:
          "Window [100,200,50] sorted is [50,100,200], median 100. Window [200,50,300] sorted is [50,200,300], median 200. Each subsequent window's median is found the same way, sliding one trade at a time.",
      },
    ],
    constraints: ["1 <= k <= len(sizes) <= 10^5"],
    approach:
      "Re-sorting each window is O(k log k) per window, O(n k log k) total -- too slow at scale. Maintain two heaps, a max-heap 'lo' for the lower half of the current window and a min-heap 'hi' for the upper half, kept balanced so the median is always at one (or both, if k is even) of the two tops -- the same two-heap invariant used for the streaming-median problem. The twist here is REMOVAL: a plain heap only supports popping its own top efficiently, but a sliding window needs to remove an arbitrary element (whichever trade just fell out of the window) from the middle of a heap, which is O(n) per removal if done naively. The standard fix is lazy deletion: mark the outgoing value for removal in a counter instead of physically removing it, and only actually pop it off a heap once it happens to surface at the top, decrementing a tracked 'true size' for each half so rebalancing and the median read still use the correct counts. This keeps every operation to O(log k) amortized.",
    code: `import heapq
from collections import Counter

def median_sliding_window(sizes: list[int], k: int) -> list[float]:
    delayed = Counter()
    lo: list[int] = []   # max-heap of the lower half, stored negated
    hi: list[int] = []   # min-heap of the upper half
    lo_n = hi_n = 0        # true (post-deletion) sizes of each half

    def prune(heap: list[int], sign: int) -> None:
        while heap and delayed[sign * heap[0]] > 0:
            delayed[sign * heap[0]] -= 1
            heapq.heappop(heap)

    out: list[float] = []
    for i, x in enumerate(sizes):
        if lo and x <= -lo[0]:
            heapq.heappush(lo, -x); lo_n += 1
        else:
            heapq.heappush(hi, x); hi_n += 1

        if lo_n > hi_n + 1:
            heapq.heappush(hi, -heapq.heappop(lo)); lo_n -= 1; hi_n += 1
        elif hi_n > lo_n:
            heapq.heappush(lo, -heapq.heappop(hi)); hi_n -= 1; lo_n += 1

        if i >= k:
            leaving = sizes[i - k]
            delayed[leaving] += 1
            if leaving <= -lo[0]:
                lo_n -= 1
            else:
                hi_n -= 1
            prune(lo, -1); prune(hi, 1)
            if lo_n > hi_n + 1:
                heapq.heappush(hi, -heapq.heappop(lo)); lo_n -= 1; hi_n += 1
            elif hi_n > lo_n:
                heapq.heappush(lo, -heapq.heappop(hi)); hi_n -= 1; lo_n += 1

        if i >= k - 1:
            prune(lo, -1); prune(hi, 1)
            out.append(float(-lo[0]) if k % 2 else (-lo[0] + hi[0]) / 2.0)
    return out`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-longest-window-notional-cap",
    title: "Longest Trade Window Under a Notional Risk Cap",
    difficulty: "medium",
    topics: ["sliding-window", "two-pointers"],
    problem:
      "Given a chronological list of trade notionals (all positive) and a risk cap, find the length of the longest contiguous window of trades whose total notional does not exceed the cap.",
    examples: [
      {
        input: "notionals=[50,20,40,10,30], cap=70",
        output: "3",
        explanation:
          "The window [20,40,10] (indices 1-3) sums to 70 and has length 3, the longest window found; every longer window either exceeds the cap or isn't achievable, e.g. [50,20,40] sums to 110.",
      },
    ],
    constraints: ["1 <= len(notionals) <= 10^5", "1 <= notionals[i] <= 10^9"],
    approach:
      "Because every notional is strictly positive, the running window sum is monotonic in both directions: extending the window right only increases the sum, and shrinking from the left only decreases it. That monotonicity is exactly what makes a two-pointer sliding window valid here (it would NOT be valid if notionals could be negative, since then shrinking the window wouldn't reliably reduce the sum). Expand the right edge one trade at a time, adding to a running total; whenever the total exceeds the cap, shrink from the left until it's back under the cap. Track the best (largest) window length seen at each step. Each index enters and leaves the window at most once across the whole scan, so total work is O(n) despite the nested-looking while loop.",
    code: `def longest_window_under_cap(notionals: list[int], cap: int) -> int:
    left = 0
    running = 0
    best = 0

    for right, notional in enumerate(notionals):
        running += notional
        while running > cap:
            running -= notionals[left]
            left += 1
        best = max(best, right - left + 1)

    return best`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-profit-generalized-cooldown",
    title: "Max Profit Trading With a Configurable N-Day Cooldown",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Generalize the classic 'buy/sell stock with cooldown' problem: after selling a share, you must wait `cooldown` full days before you're allowed to buy again (cooldown=1 reproduces the classic version). You may hold at most one share at a time. Given a list of daily prices and a cooldown length, return the maximum achievable profit.",
    examples: [
      {
        input: "prices=[1,2,3,0,2], cooldown=1",
        output: "3",
        explanation:
          "Buy day 0 (price 1), sell day 1 (price 2, profit 1); cooldown of 1 day means day 2 is blocked, buy day 3 (price 0), sell day 4 (price 2, profit 2). Total 1 + 2 = 3.",
      },
      {
        input: "prices=[1,2,3,0,2], cooldown=2",
        output: "2",
        explanation:
          "With a stricter 2-day cooldown, selling on day 1 blocks buying until day 4 -- too late to sell again within the array. The best achievable is a single trade: buy day 0, sell day 2, for a profit of 2.",
      },
    ],
    constraints: ["1 <= len(prices) <= 5000", "1 <= cooldown <= len(prices)"],
    approach:
      "This is a state-machine DP with three tracks per day: hold[i] (max profit if holding a share at end of day i), sold[i] (max profit if you sold ON day i), and rest[i] (max profit if flat and eligible to buy at end of day i). hold[i] = max(hold[i-1], rest[i-1] - price[i]) -- keep holding, or buy today using yesterday's 'eligible to buy' profit. sold[i] = hold[i-1] + price[i] -- can only sell today if you held yesterday. The generalization is entirely in rest[i] = max(rest[i-1], sold[i-cooldown]) -- you only become eligible to buy again `cooldown` days after the sale that put you in cash, versus the classic version's fixed 1-day lookback. Answer is the best of rest[n-1] and sold[n-1] (you never want to end still holding for max realized profit).",
    code: `def max_profit_cooldown(prices: list[int], cooldown: int) -> int:
    n = len(prices)
    if n == 0:
        return 0
    NEG = float("-inf")
    hold = [NEG] * n     # holding a share at end of day i
    sold = [NEG] * n     # sold ON day i
    rest = [0] * n        # flat and free to buy at end of day i

    hold[0] = -prices[0]
    for i in range(1, n):
        hold[i] = max(hold[i - 1], rest[i - 1] - prices[i])
        if hold[i - 1] != NEG:
            sold[i] = hold[i - 1] + prices[i]
        # eligible to buy again once "cooldown" days have passed since the sale
        ready = sold[i - cooldown] if i - cooldown >= 0 else NEG
        rest[i] = max(rest[i - 1], ready)

    best_sold = sold[n - 1] if sold[n - 1] != NEG else 0
    return int(max(rest[n - 1], best_sold, 0))`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-random-walk-return-to-origin",
    title: "Probability a Symmetric Random Walk Returns to Zero",
    difficulty: "hard",
    topics: ["probability", "dynamic-programming"],
    problem:
      "A fair coin drives a random walk starting at 0: each step moves +1 or -1 with equal probability. Given n steps, compute the probability that the walk visits position 0 at least once at some point during steps 1 through n (touching 0 counts even if it moves away again afterward).",
    examples: [
      {
        input: "n=4",
        output: "0.625",
        explanation:
          "Of the 16 equally likely 4-step paths, 10 touch 0 at some point (e.g. +--+ reaches 0 after 2 steps and stays counted even though it moves to +1 and back to 0 again). 10/16 = 0.625.",
      },
    ],
    constraints: ["1 <= n <= 2000"],
    approach:
      "Track only the paths that have NOT yet returned to 0, since once a path touches 0 its contribution to 'at least one return' is already counted and its future steps don't matter for this question -- so it can be absorbed out of the active distribution. Maintain a dictionary mapping current position to probability mass, restricted to paths still in their first excursion away from 0. At each step, every active path splits into a +1 and -1 move with half its mass each; any mass that lands exactly on 0 gets added to a running p_return total and is NOT re-inserted into the active distribution (it's already counted, and letting it keep 'returning' would double-count). This is a direct DP with an absorbing state at 0, and it matches a known closed form -- the probability of NOT returning within the first 2n steps equals C(2n,n)/4^n, a nice check to run the DP output against for even n.",
    code: `def prob_return_to_origin(n: int) -> float:
    # active[pos] = probability mass of paths that have not yet returned to 0,
    # currently sitting at pos (starts after the mandatory first step away from 0)
    active = {1: 0.5, -1: 0.5}
    p_return = 0.0

    for _ in range(2, n + 1):
        new_active: dict[int, float] = {}
        for pos, prob in active.items():
            for step in (1, -1):
                npos, nprob = pos + step, prob * 0.5
                if npos == 0:
                    p_return += nprob   # absorbed: already counted, doesn't re-enter
                else:
                    new_active[npos] = new_active.get(npos, 0.0) + nprob
        active = new_active

    return p_return`,
    language: "python",
    complexity: { time: "O(n^2)", space: "O(n)" },
  },
  {
    id: "lc-design-iceberg-order-matcher",
    title: "Design an Iceberg Order Matching Engine",
    difficulty: "medium",
    topics: ["design", "queue"],
    problem:
      "Design a single-price-level book that supports add(order_id, side, price, total_qty, display_qty), which rests an iceberg order showing only display_qty at a time while hiding the rest, and match(side, price, qty), which fills an incoming aggressor of that size against resting opposite-side iceberg orders at that price using price-time priority. When a resting order's visible slice is fully consumed, immediately replenish it from its hidden quantity and move it to the back of the time-priority queue at that price (it loses priority, matching how real iceberg orders behave). Return the list of (order_id, price, qty) fills produced, in the order they occurred.",
    examples: [
      {
        input:
          "add('I1','sell',100,300,100); match('buy',100,150)",
        output: "[('I1', 100, 100), ('I1', 100, 50)]",
        explanation:
          "I1 rests 300 total shares showing 100 at a time. The incoming buy for 150 first consumes the full 100-share visible slice, which triggers a replenish from the 200 hidden shares (new visible slice of 100), then consumes 50 more from the replenished slice -- two separate fill events against the same order because the slice ran out mid-match.",
      },
    ],
    approach:
      "The key departure from a plain limit order book matcher is that an iceberg order's true remaining quantity is split into a visible slice and a hidden reserve, and the visible slice must be replenished from the reserve the instant it hits zero -- with the replenished slice losing its original time priority, since in a real matching engine market participants that were resting behind an iceberg get to trade ahead of its refreshed slice. Represent each price level's queue as a deque of mutable [order_id, display_qty, visible_remaining, hidden_remaining] records, front of the deque = highest time priority. Matching pops from the front, fills min(remaining aggressor qty, visible_remaining), and if the visible slice hits exactly zero, either fully removes the order (hidden also exhausted) or replenishes it and pushes it to the back of the deque -- structurally the same repeated-pop/partial-consume/push-back loop used in FIFO position tracking and HIFO tax-lot matching, just with an added replenish-and-requeue step triggered by hidden quantity.",
    code: `from collections import deque

class IcebergBook:
    def __init__(self):
        # (side, price) -> deque of [order_id, display_qty, visible, hidden]
        self.book: dict[tuple[str, float], deque] = {}

    def add(self, order_id: str, side: str, price: float,
            total_qty: int, display_qty: int) -> None:
        visible = min(display_qty, total_qty)
        hidden = total_qty - visible
        key = (side, price)
        self.book.setdefault(key, deque()).append([order_id, display_qty, visible, hidden])

    def match(self, side: str, price: float, qty: int) -> list[tuple[str, float, int]]:
        opposite = "sell" if side == "buy" else "buy"
        queue = self.book.get((opposite, price), deque())
        fills: list[tuple[str, float, int]] = []
        remaining = qty

        while remaining > 0 and queue:
            order = queue[0]
            order_id, display_qty, visible, hidden = order
            take = min(remaining, visible)
            fills.append((order_id, price, take))
            order[2] -= take
            remaining -= take
            if order[2] == 0:
                queue.popleft()
                if order[3] > 0:                     # hidden reserve remains: replenish
                    replenish = min(display_qty, order[3])
                    order[2] = replenish
                    order[3] -= replenish
                    queue.append(order)               # re-queued at the BACK: lost priority

        return fills`,
    language: "python",
    complexity: { time: "O(1) amortized per fill", space: "O(number of resting orders)" },
  },
];
