import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-11
// Order submission cooldown scheduling for self-trade prevention
// (heap + greedy, LC621 shape), longest tick window touching at
// most k distinct venues (sliding window, LC340 shape), max
// profit with a per-trade commission fee (DP stock variant,
// LC714 shape), long-run fraction of time in each market regime
// (Markov stationary distribution via linear algebra), and a
// FIFO lot-matched position tracker with realized/unrealized P&L
// (design).
// ============================================================

export const financeBatch20261011: LeetCodeProblem[] = [
  {
    id: "lc-20261011-order-cooldown-scheduler",
    title: "Order Submission Cooldown Scheduler (Self-Trade Prevention Rate Limiter)",
    difficulty: "medium",
    topics: ["heap", "greedy"],
    problem:
      "A desk must submit a backlog of pending orders, one per time slot, drawn from several symbols. To satisfy a self-trade-prevention rule, two orders for the SAME symbol must be separated by at least `cooldown` time slots (idle slots are allowed while waiting). Given the count of pending orders per symbol and the cooldown, return the minimum number of time slots needed to submit every order.",
    examples: [
      {
        input: "counts = [3, 3], cooldown = 2",
        output: "8",
        explanation:
          "Two symbols with 3 orders each, needing a 2-slot gap between same-symbol submissions: A B idle A B idle A B is one valid 8-slot schedule, and nothing shorter satisfies the cooldown for both symbols.",
      },
    ],
    constraints: ["1 <= counts.length <= 26", "1 <= counts[i] <= 10^4", "0 <= cooldown <= 100"],
    approach:
      "Greedily submit, each slot, whichever symbol currently has the most ORDERS STILL PENDING -- a max-heap keyed on remaining count gives you that in O(log s) per slot, s = number of distinct symbols. After submitting one order for a symbol, it can't be touched again until `cooldown` slots later, so park its updated remaining count in a FIFO queue tagged with the slot it becomes eligible again, rather than leaving it in the heap where it could be picked prematurely. Each slot: pop the busiest symbol from the heap (if the heap is empty, the slot is forced to be idle -- every symbol is still cooling down), decrement its count, and if any remains, push it onto the cooldown queue; then check whether the queue's front entry has reached its eligible slot and if so move it back into the heap. The loop ends once both the heap and the queue are empty, and the slot counter at that point is the answer.",
    code: `import heapq
from collections import deque

def min_slots_with_cooldown(counts: list[int], cooldown: int) -> int:
    heap = [-c for c in counts if c > 0]   # max-heap via negation
    heapq.heapify(heap)
    queue: deque[tuple[int, int]] = deque()  # (eligible_at_slot, remaining_count)

    slots = 0
    while heap or queue:
        slots += 1
        if heap:
            remaining = -heapq.heappop(heap) - 1   # submit one order for the busiest symbol
            if remaining > 0:
                queue.append((slots + cooldown, remaining))
        # bring back any symbol whose cooldown has elapsed as of THIS slot
        if queue and queue[0][0] == slots:
            heapq.heappush(heap, -queue.popleft()[1])

    return slots

print(min_slots_with_cooldown([3, 3], 2))
# 8`,
    language: "python",
    complexity: { time: "O(n log s)", space: "O(s)" },
    leetcodeNumber: 621,
  },
  {
    id: "lc-20261011-longest-window-k-venues",
    title: "Longest Tick Window Touching At Most K Distinct Venues",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a sequence of venue IDs, one per tick (where a trade executed), return the length of the longest contiguous window of ticks that includes trades from at most k distinct venues. This bounds how much cross-venue reconciliation a rolling analytics window has to handle at once.",
    examples: [
      {
        input: "venues = [1, 2, 1, 3, 4], k = 2",
        output: "3",
        explanation:
          "The window [1,2,1] touches only {1,2}, two distinct venues, length 3. Extending either direction brings in a third venue, so 3 is the longest window with at most 2 distinct venues.",
      },
    ],
    constraints: ["1 <= venues.length <= 10^5", "1 <= k <= 26"],
    approach:
      "Classic two-pointer sliding window with a running venue-count hashmap. Advance the right pointer one tick at a time, incrementing that venue's count. Whenever the number of DISTINCT keys in the map exceeds k, shrink from the left, decrementing (and removing once zero) the leftmost venue's count, until the map is back down to at most k distinct venues. Track the best window length seen after each right-pointer advance. Both pointers only move forward over the whole scan, so the total work is O(n) despite the nested-looking shrink loop.",
    code: `from collections import defaultdict

def longest_window_k_venues(venues: list[int], k: int) -> int:
    counts: dict[int, int] = defaultdict(int)
    left = 0
    best = 0

    for right, v in enumerate(venues):
        counts[v] += 1
        # shrink from the left while MORE than k distinct venues are in view
        while len(counts) > k:
            left_v = venues[left]
            counts[left_v] -= 1
            if counts[left_v] == 0:
                del counts[left_v]
            left += 1
        best = max(best, right - left + 1)

    return best

print(longest_window_k_venues([1, 2, 1, 3, 4], 2))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(k)" },
    leetcodeNumber: 340,
  },
  {
    id: "lc-20261011-max-profit-with-commission-fee",
    title: "Maximum Profit With a Per-Trade Commission Fee",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices and a fixed commission fee charged on every completed sell, you may buy and sell as many times as you like, never holding more than one share at once. Return the maximum achievable profit after fees.",
    examples: [
      {
        input: "prices = [1, 3, 2, 8, 4, 9], fee = 2",
        output: "8",
        explanation:
          "Buy at 1, sell at 8 (profit 7 - 2 fee = 5), buy at 4, sell at 9 (profit 5 - 2 fee = 3). Total 5 + 3 = 8, which beats taking more, smaller round trips once the fee is netted out of each one.",
      },
    ],
    constraints: ["1 <= prices.length <= 5 * 10^4", "0 <= prices[i], fee <= 5 * 10^4"],
    approach:
      "Track two running values instead of a full table: cash, the best profit achievable while currently flat, and hold, the best profit achievable while currently holding one share. Each day, cash can either stay the same or come from selling the held share today (hold + price - fee); hold can either stay the same or come from buying today using the capital already banked (cash - price). Charge the fee exactly once per round trip, on the sell leg only -- charging it on the buy leg instead works arithmetically too as long as it is applied consistently on exactly one leg, but mixing the convention is the usual source of off-by-fee bugs. The two running scalars replace what would otherwise be two O(n) arrays, so the whole pass is O(1) extra space.",
    code: `def max_profit_with_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    cash = 0                 # best profit while flat
    hold = -prices[0]        # best profit while holding one share

    for price in prices[1:]:
        # the fee is charged ONCE per round trip, here on the sell leg
        cash = max(cash, hold + price - fee)
        hold = max(hold, cash - price)

    return cash

print(max_profit_with_fee([1, 3, 2, 8, 4, 9], 2))
# 8`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 714,
  },
  {
    id: "lc-20261011-markov-regime-stationary-distribution",
    title: "Long-Run Fraction of Time in Each Market Regime (Markov Stationary Distribution)",
    difficulty: "medium",
    topics: ["probability"],
    problem:
      "A simple regime model has three states -- trending, mean-reverting, choppy -- with a given daily transition probability matrix (row i, column j = probability of moving from state i to state j tomorrow). Assuming the chain runs for a very long time, return the long-run (stationary) fraction of days spent in each regime.",
    examples: [
      {
        input:
          "P = [[0.80, 0.15, 0.05], [0.20, 0.70, 0.10], [0.30, 0.30, 0.40]]  # rows: trending, mean-reverting, choppy",
        output: "[0.5263, 0.3684, 0.1053]",
        explanation:
          "The stationary vector pi satisfies pi @ P = pi with sum(pi) = 1. Solving that linear system gives roughly 52.6% of days trending, 36.8% mean-reverting, and 10.5% choppy in the long run.",
      },
    ],
    constraints: ["P is a square row-stochastic matrix (each row sums to 1)", "2 <= states <= 10"],
    approach:
      "The stationary distribution is the fixed point of pi @ P = pi, i.e. pi @ (P - I) = 0, together with the normalization constraint sum(pi) = 1. The homogeneous system alone is rank-deficient by construction (it has a whole line of solutions up to scale), so solve it by swapping out one redundant equation for the normalization constraint and solving the resulting square linear system directly with a linear-algebra solver, rather than iterating the chain forward and hoping it converges. This is exact and O(n^3) for n states, versus power-iteration's O(n^2) per step times however many steps convergence happens to need.",
    code: `import numpy as np

def stationary_distribution(P: np.ndarray) -> np.ndarray:
    n = P.shape[0]
    # pi @ P = pi  =>  pi @ (P - I) = 0, plus the normalization sum(pi) = 1.
    # The homogeneous system is rank-deficient, so replace one (redundant)
    # equation with the normalization constraint before solving directly.
    A = (P - np.eye(n)).T
    A[-1, :] = 1.0
    b = np.zeros(n)
    b[-1] = 1.0
    return np.linalg.solve(A, b)

P = np.array([
    [0.80, 0.15, 0.05],   # trending
    [0.20, 0.70, 0.10],   # mean-reverting
    [0.30, 0.30, 0.40],   # choppy
])

pi = stationary_distribution(P)
print(np.round(pi, 4))
# [0.5263 0.3684 0.1053] -- long-run fraction of days in each regime`,
    language: "python",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
  },
  {
    id: "lc-20261011-sequence-gap-replay-buffer",
    title: "Design a Market-Data Sequence-Gap Detector With an Out-of-Order Replay Buffer",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "A UDP market-data feed delivers packets tagged with a per-symbol sequence number that increases by exactly 1 each packet, but packets can arrive out of order or be dropped and retransmitted later out of band. Design a class SequenceGapBuffer with push(seq, payload), which returns, in strict order, every contiguous run of payloads that is now ready to emit (seq equals the next expected sequence number), buffering anything that arrives early until its predecessors show up, and silently discarding anything that arrives late (already emitted).",
    examples: [
      {
        input:
          "buf=SequenceGapBuffer(start_seq=1); buf.push(1,'A'); buf.push(3,'C'); buf.push(2,'B'); buf.push(4,'D')",
        output: "['A'], [], ['B','C'], ['D']",
        explanation:
          "Packet 1 arrives in order and is emitted immediately. Packet 3 arrives early (2 is still missing), so it's held with nothing emitted. Packet 2 then fills the gap, so it's emitted AND immediately drains the now-contiguous packet 3 behind it, in one call. Packet 4 arrives in order and is emitted on its own.",
      },
    ],
    constraints: [
      "sequence numbers are non-negative integers, strictly increasing by exactly 1 per true packet",
      "a given seq may be delivered more than once (retransmit) and must not be emitted twice",
      "up to 10^6 total push calls",
    ],
    approach:
      "Track next_expected, the next sequence number due for emission, plus a min-heap of (seq, payload) pairs for packets that arrived too early. On push: a seq below next_expected is a duplicate retransmit of something already emitted, so discard it; a seq above next_expected arrived early, so push it onto the heap and emit nothing yet; a seq exactly equal to next_expected is ready, so emit it, advance next_expected, and then keep popping the heap's minimum WHILE its sequence number equals the new next_expected -- each pop that matches drains one more now-contiguous packet and advances the counter again, so a single push that happens to fill a gap can emit an entire backlog at once. Each packet is pushed onto the heap at most once and popped at most once over its lifetime, so the amortized cost per push is O(log n) for whatever's sitting in the heap. A real deployment would also need a timeout on packets that NEVER arrive (genuinely lost, past the retransmission window), which this buffer alone doesn't resolve -- it would wait forever on a true, permanent gap.",
    code: `import heapq

class SequenceGapBuffer:
    def __init__(self, start_seq: int = 1):
        self.next_expected = start_seq
        self.pending: list[tuple[int, object]] = []   # min-heap of (seq, payload)

    def push(self, seq: int, payload) -> list:
        if seq < self.next_expected:
            return []   # duplicate retransmit of an already-emitted packet -- discard

        if seq > self.next_expected:
            heapq.heappush(self.pending, (seq, payload))
            return []   # arrived early -- hold until its predecessors show up

        # seq == next_expected: emit it, then drain any now-contiguous backlog
        ready = [payload]
        self.next_expected += 1
        while self.pending and self.pending[0][0] == self.next_expected:
            _, next_payload = heapq.heappop(self.pending)
            ready.append(next_payload)
            self.next_expected += 1
        return ready

buf = SequenceGapBuffer(start_seq=1)
print(buf.push(1, "A"))   # ['A']
print(buf.push(3, "C"))   # []            -- held, waiting on seq 2
print(buf.push(2, "B"))   # ['B', 'C']    -- fills the gap, drains the backlog
print(buf.push(4, "D"))   # ['D']`,
    language: "python",
    complexity: { time: "O(log n) amortized per push", space: "O(n) buffered backlog" },
  },
];
