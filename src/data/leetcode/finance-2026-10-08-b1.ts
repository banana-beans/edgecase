import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-08
// K-way merge of exchange tapes (heap), longest window with a
// bounded high-low range (sliding window via monotonic deques),
// max P&L under a mandatory post-trade compliance blackout
// (DP stock variant, House-Robber shape), expected events for a
// resting order to reach the front of the queue under random
// batch clears (probability / Markov), and a fixed-window VWAP
// tracker with O(1) updates (design).
// ============================================================

export const financeBatch20261008: LeetCodeProblem[] = [
  {
    id: "lc-20261008-merge-k-sorted-tapes",
    title: "Merge K Sorted Order-Flow Tapes Into One Time-Ordered Stream",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "You receive K separate trade tapes (one per exchange feed), each already sorted ascending by timestamp. Merge all K tapes into a single timestamp-sorted list of (timestamp, exchange_id, price) tuples.",
    examples: [
      {
        input:
          "tapes = [[(1,'A',100.0),(5,'A',101.0)], [(2,'B',99.5),(4,'B',99.8)], [(3,'C',100.2)]]",
        output:
          "[(1,'A',100.0),(2,'B',99.5),(3,'C',100.2),(4,'B',99.8),(5,'A',101.0)]",
        explanation:
          "A standard k-way merge: at every step emit whichever tape's current front event has the smallest timestamp, then advance only that tape.",
      },
    ],
    constraints: [
      "1 <= K <= 10^4 tapes",
      "each tape individually sorted ascending by timestamp",
      "total events across all tapes up to 10^6",
    ],
    approach:
      "Push the first event of each of the K tapes onto a min-heap keyed by timestamp (with the tape index as a tiebreak for determinism), then repeatedly pop the smallest, emit it, and push that same tape's next event if one remains. This is the classic k-way merge: the heap never holds more than K elements at once, so each pop/push pair costs O(log K), and the merge touches every one of the N total events exactly once, giving O(N log K) instead of the O(N log N) you'd get from dumping every event into one list and sorting from scratch -- the gain is real once K is small relative to N, as it is here with up to 10^4 feeds producing up to 10^6 total events.",
    code: `import heapq

def merge_tapes(tapes: list[list[tuple]]) -> list[tuple]:
    heap = []
    # seed the heap with the first event of every non-empty tape
    for tape_idx, tape in enumerate(tapes):
        if tape:
            ts, exch, price = tape[0]
            heapq.heappush(heap, (ts, tape_idx, 0, exch, price))

    merged = []
    while heap:
        ts, tape_idx, event_idx, exch, price = heapq.heappop(heap)
        merged.append((ts, exch, price))
        next_idx = event_idx + 1
        if next_idx < len(tapes[tape_idx]):
            next_ts, next_exch, next_price = tapes[tape_idx][next_idx]
            heapq.heappush(heap, (next_ts, tape_idx, next_idx, next_exch, next_price))

    return merged

tapes = [
    [(1, "A", 100.0), (5, "A", 101.0)],
    [(2, "B", 99.5), (4, "B", 99.8)],
    [(3, "C", 100.2)],
]
print(merge_tapes(tapes))`,
    language: "python",
    complexity: { time: "O(N log K)", space: "O(K) heap, O(N) output" },
  },
  {
    id: "lc-20261008-longest-window-bounded-range",
    title: "Longest Window Where the High-Low Price Range Stays Within a Band",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a sequence of intraday prices, find the length of the longest contiguous window where max(window) - min(window) <= band -- a volatility-band constraint used to flag calm vs choppy regimes.",
    examples: [
      {
        input: "prices=[5,6,5,4,8,3], band=2",
        output: "4",
        explanation:
          "The window [5,6,5,4] (indices 0-3) has max 6 and min 4, a range of exactly 2, so it fits the band. Extending to index 4 (price 8) pushes the range to 4, which breaks it, and no other window in the array reaches length 4 while staying within the band.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "band >= 0"],
    approach:
      "Maintain two monotonic deques alongside a standard sliding left pointer: one tracks the window's current max (front holds the max, values are kept decreasing), the other tracks the current min (front holds the min, values kept increasing). Each new right-pointer price pops any deque entries it invalidates (a max-deque entry smaller than the newcomer can never be the max again while the newcomer is in the window, and symmetrically for the min-deque) before being appended. After updating both deques, while the window's max minus min exceeds band, advance the left pointer, discarding any deque entries that have fallen out of the window from the front. Both pointers only move forward over the whole pass, and each index enters and leaves each deque at most once, so the total work is O(n) despite the nested-looking while loop -- the same amortized argument as the classic sliding-window-maximum problem, run for two deques at once.",
    code: `from collections import deque

def longest_window_bounded_range(prices: list[float], band: float) -> int:
    max_deque: deque[int] = deque()   # indices, decreasing price order (front = window max)
    min_deque: deque[int] = deque()   # indices, increasing price order (front = window min)
    left = 0
    best = 0

    for right, price in enumerate(prices):
        while max_deque and prices[max_deque[-1]] <= price:
            max_deque.pop()
        max_deque.append(right)

        while min_deque and prices[min_deque[-1]] >= price:
            min_deque.pop()
        min_deque.append(right)

        # shrink from the left while the window's range exceeds the band
        while prices[max_deque[0]] - prices[min_deque[0]] > band:
            left += 1
            if max_deque[0] < left:
                max_deque.popleft()
            if min_deque[0] < left:
                min_deque.popleft()

        best = max(best, right - left + 1)

    return best

print(longest_window_bounded_range([5, 6, 5, 4, 8, 3], 2))
# 4`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n) worst case for the deques" },
  },
  {
    id: "lc-20261008-max-pnl-compliance-blackout",
    title: "Maximum P&L With a One-Day Compliance Blackout After Every Trade",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily P&L opportunities pnl[i] (the profit available if you trade on day i, which can be negative), you may trade on any subset of days, but compliance forbids trading on two consecutive days -- trading on day i mandates a blackout on day i+1. Return the maximum total P&L achievable.",
    examples: [
      {
        input: "pnl=[3,-2,5,10,-1,4]",
        output: "17",
        explanation:
          "Trade on days 0, 3, and 5 (profits 3, 10, and 4) for a total of 17. None of those days are consecutive, so no blackout is violated, and skipping the negative-pnl days 1 and 4 entirely avoids both a loss and an unnecessary blackout.",
      },
    ],
    constraints: ["1 <= pnl.length <= 10^5", "-10^4 <= pnl[i] <= 10^4"],
    approach:
      "This is the House Robber recurrence in different clothes: dp[i] = max(dp[i-1], dp[i-2] + pnl[i]) -- either skip trading on day i entirely (inheriting yesterday's best total) or trade on day i and add it to the best achievable through two days ago, since trading on day i forces a blackout on day i+1, making day i-2 (not i-1) the relevant prior state once you commit to trading today. Because pnl[i] can be negative, the recurrence's own max() already handles 'don't trade on a bad day' for free -- nothing forces you to trade every day, only forbids trading on two CONSECUTIVE days. Track just the last two dp values instead of a full array for O(1) space; the final rolling value after the last day is the answer.",
    code: `def max_pnl_with_blackout(pnl: list[int]) -> int:
    prev2, prev1 = 0, 0   # dp[i-2], dp[i-1], rolled instead of a full array

    for day_pnl in pnl:
        # either skip today (keep prev1) or trade today (prev2 + today's pnl)
        current = max(prev1, prev2 + day_pnl)
        prev2, prev1 = prev1, current

    return prev1

print(max_pnl_with_blackout([3, -2, 5, 10, -1, 4]))
# 17 -- trade days 0, 3, 5 (3 + 10 + 4), skipping the negative-pnl days entirely`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 198,
  },
  {
    id: "lc-20261008-expected-events-queue-clear-batch",
    title:
      "Expected Events Until Your Order Reaches the Front of the Queue (Random Batch Clears)",
    difficulty: "hard",
    topics: ["probability", "dynamic-programming"],
    problem:
      "Your resting limit order sits behind q other orders in the price-time-priority queue. At each discrete queue event, the front of the queue clears by exactly 1 order with probability p, or by exactly 2 orders with probability 1-p (a single aggressive trade or cancellation can consume two resting orders at once; if fewer than 2 orders remain ahead of you, a 'clear 2' event just clears whatever is left and your order becomes the front). Given q orders ahead of you, return the expected number of events until your order is the new front of the queue.",
    examples: [
      {
        input: "q=2, p=0.5",
        output: "1.5",
        explanation:
          "Let E[k] be the expected events to clear k orders ahead. E[0]=0, E[1]=1 (clearing 1 or clearing 2 both reach the front from a queue of 1), and E[2] = 1 + 0.5*E[1] + 0.5*E[0] = 1 + 0.5*1 + 0 = 1.5.",
      },
    ],
    constraints: ["0 <= q <= 10^6", "0 <= p <= 1"],
    approach:
      "Define E[k] as the expected number of events to clear k orders ahead of you, with E[0]=0 (you're already at the front). Each event clears 1 order (probability p) or 2 (probability 1-p) -- and when fewer than 2 remain, a 'clear 2' event still just clears everything left and puts you at the front, so the resulting state is max(k-2, 0), never a negative count. That gives the recurrence E[k] = 1 + p * E[max(k-1,0)] + (1-p) * E[max(k-2,0)], which only ever looks back two steps -- structurally the same shape as the Fibonacci/climbing-stairs recurrence, just with expectations instead of counts and a weighted branch instead of an unweighted sum. Build it bottom-up with two rolling variables instead of a full array for O(1) space and O(q) time.",
    code: `def expected_events_to_front(q: int, p: float) -> float:
    if q == 0:
        return 0.0

    e_prev2, e_prev1 = 0.0, 0.0   # both represent E[0] at the start of the recurrence

    for k in range(1, q + 1):
        # clearing 2 when fewer than 2 remain still reaches the front (state floors at 0)
        e_curr = 1 + p * e_prev1 + (1 - p) * e_prev2
        e_prev2, e_prev1 = e_prev1, e_curr

    return e_prev1

print(round(expected_events_to_front(2, 0.5), 4))
# 1.5

print(round(expected_events_to_front(10, 0.3), 4))
# the batch-clear-2 branch pulls this below what a pure clear-1-only queue would need`,
    language: "python",
    complexity: { time: "O(q)", space: "O(1)" },
  },
  {
    id: "lc-20261008-design-vwap-tracker",
    title: "Design a Fixed-Window VWAP Tracker With O(1) Updates",
    difficulty: "medium",
    topics: ["design"],
    problem:
      "Design a class VWAPTracker, constructed as VWAPTracker(window_size), that supports add_trade(price, size), ingesting one trade at a time, and vwap(), returning the volume-weighted average price over the last window_size trades (a fixed COUNT window, not a time window), each in O(1) amortized time.",
    examples: [
      {
        input:
          "t=VWAPTracker(3); t.add_trade(10,100); t.add_trade(20,100); t.add_trade(30,100); t.vwap(); t.add_trade(40,100); t.vwap()",
        output: "20.0, then 30.0",
        explanation:
          "After the first three trades, vwap = (10*100+20*100+30*100)/(100+100+100) = 6000/300 = 20.0. Adding (40,100) evicts the oldest trade (10,100) from the window, leaving (20,100),(30,100),(40,100): vwap = 9000/300 = 30.0.",
      },
    ],
    constraints: [
      "1 <= window_size <= 10^5",
      "up to 10^6 calls to add_trade",
      "price, size are positive",
    ],
    approach:
      "Maintain a fixed-size deque of the last window_size (price, size) pairs alongside two running totals: sum_px (sum of price*size) and sum_size (sum of size), both computed over exactly the trades currently sitting in the deque. On add_trade, push the new trade and add its price*size and size into the two running totals; if the deque now holds more than window_size trades, pop the oldest one from the left and subtract ITS contribution from both totals before discarding it. vwap() then needs no rescan at all -- it's just sum_px / sum_size, read directly off the two running totals in O(1). This is the same running-totals-over-a-fixed-window trick used for a sliding window average, generalized to a weighted average by tracking the weighted numerator and the weight denominator as two separate running sums instead of one.",
    code: `from collections import deque

class VWAPTracker:
    def __init__(self, window_size: int):
        self.window_size = window_size
        self.trades: deque[tuple[float, float]] = deque()   # (price, size), oldest first
        self.sum_px = 0.0     # running sum of price * size over the window
        self.sum_size = 0.0   # running sum of size over the window

    def add_trade(self, price: float, size: float) -> None:
        self.trades.append((price, size))
        self.sum_px += price * size
        self.sum_size += size

        if len(self.trades) > self.window_size:
            old_price, old_size = self.trades.popleft()
            self.sum_px -= old_price * old_size   # evict the dropped trade's contribution
            self.sum_size -= old_size

    def vwap(self) -> float:
        return self.sum_px / self.sum_size   # O(1) -- no rescan of the window needed

t = VWAPTracker(3)
for price, size in [(10, 100), (20, 100), (30, 100)]:
    t.add_trade(price, size)
print(t.vwap())   # 20.0
t.add_trade(40, 100)
print(t.vwap())   # 30.0`,
    language: "python",
    complexity: {
      time: "O(1) amortized per add_trade, O(1) per vwap",
      space: "O(window_size)",
    },
  },
];
