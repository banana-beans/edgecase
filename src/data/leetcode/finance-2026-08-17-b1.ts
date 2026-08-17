import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-17
// A sliding-window median for a rolling volatility gauge, a
// max-profit-with-cooldown stock DP, an absorbing-state Markov
// chain for expected time to liquidation, an order-book price
// matcher design problem, and a min-heap task scheduler for
// staggered rebalance orders.
// ============================================================

export const financeBatch20260817: LeetCodeProblem[] = [
  {
    id: "lc-sliding-window-median-volatility",
    title: "Rolling Median Price for a Robust Volatility Gauge",
    difficulty: "hard",
    topics: ["heap", "sliding-window"],
    problem:
      "Given a stream of prices and a fixed window size k, return the median of each window of k consecutive prices as the window slides one price at a time across the full series.",
    examples: [
      {
        input: "prices=[1,3,-1,-3,5,3,6,7], k=3",
        output: "[1,-1,-1,3,5,6]",
        explanation:
          "Window [1,3,-1] sorted is [-1,1,3], median 1. Window [3,-1,-3] sorted is [-3,-1,3], median -1. Each subsequent window drops the oldest price and admits the newest one before the median is read off again.",
      },
    ],
    constraints: ["1 <= k <= len(prices) <= 10^5"],
    approach:
      "Sorting each window from scratch is O(k log k) per window, O(n k log k) total -- too slow for a rolling diagnostic meant to run over a full tick history. The standard fix is two heaps: a max-heap holding the smaller half of the current window and a min-heap holding the larger half, kept balanced in size so the median sits at the top of one (odd k) or is the average of both tops (even k). Every step pushes the new price into whichever heap it belongs against the current tops, then rebalances by moving a top element across if one heap has grown more than one larger than the other. The wrinkle specific to a SLIDING window (versus a running median over an ever-growing stream) is removal: the price aging out of the window must be deleted from whichever heap holds it, and neither heap supports efficient arbitrary deletion -- so this uses lazy deletion, marking a value as stale in a counter and skipping over stale tops whenever a heap's top is read, rather than physically removing it from the middle of the heap.",
    code: `import heapq
from collections import defaultdict

def median_sliding_window(prices: list[float], k: int) -> list[float]:
    small: list[float] = []   # max-heap (negated), smaller half
    large: list[float] = []   # min-heap, larger half
    stale: defaultdict = defaultdict(int)   # value -> pending-removal count
    small_size = large_size = 0
    results: list[float] = []

    def prune(heap: list[float], sign: int) -> None:
        while heap and stale[sign * heap[0]] > 0:
            stale[sign * heap[0]] -= 1
            heapq.heappop(heap)

    def rebalance() -> None:
        nonlocal small_size, large_size
        if small_size > large_size + 1:
            val = -heapq.heappop(small)
            heapq.heappush(large, val)
            small_size -= 1
            large_size += 1
        elif large_size > small_size:
            val = heapq.heappop(large)
            heapq.heappush(small, -val)
            large_size -= 1
            small_size += 1

    for i, price in enumerate(prices):
        if not small or price <= -small[0]:
            heapq.heappush(small, -price)
            small_size += 1
        else:
            heapq.heappush(large, price)
            large_size += 1
        rebalance()

        if i >= k:
            old = prices[i - k]
            stale[old] += 1
            if old <= -small[0]:
                small_size -= 1
            else:
                large_size -= 1
            rebalance()
        prune(small, -1)
        prune(large, 1)

        if i >= k - 1:
            if k % 2:
                results.append(float(-small[0]))
            else:
                results.append((-small[0] + large[0]) / 2.0)

    return results`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-max-profit-cooldown",
    title: "Max Profit With a Mandatory One-Day Cooldown After Selling",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices, unlimited transactions are allowed (buy then sell, no overlapping holdings), but after selling you cannot buy again the very next day (a one-day cooldown). Return the maximum achievable profit.",
    examples: [
      {
        input: "prices=[1,2,3,0,2]",
        output: "3",
        explanation:
          "Buy at 1, sell at 2 (profit 1), sit out the next day as cooldown, then buy at 0, sell at 2 (profit 2). Total profit 1 + 2 = 3. Holding through to sell at 3 instead looks tempting but its mandatory cooldown blocks the cheap re-entry at 0, netting only 2 overall -- worse than splitting the trade.",
      },
    ],
    constraints: ["1 <= len(prices) <= 5000"],
    approach:
      "This extends the standard hold/cash state machine with a third state to model the cooldown: 'hold' (currently holding a position), 'cash_cooldown' (just sold today, cannot buy tomorrow), and 'cash_ready' (flat and free to buy). The key transition is that 'hold' can only be entered from 'cash_ready' of the PREVIOUS day, never from 'cash_cooldown' of the previous day -- that's exactly what encodes the one-day-after-selling restriction, since 'cash_cooldown' only feeds into 'cash_ready' one day later, never directly into 'hold'. Each day's three states update purely off the PREVIOUS day's three values, so this runs in O(1) space with three rolling variables, no explicit DP table needed, and the recurrence generalizes the no-cooldown unlimited-transaction problem by literally just adding this one extra state and blocking one transition.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0
    hold = -prices[0]        # holding a position
    cash_cooldown = 0        # sold today, must sit out tomorrow
    cash_ready = 0           # flat and free to buy today

    for price in prices[1:]:
        prev_hold, prev_cooldown, prev_ready = hold, cash_cooldown, cash_ready
        # can only buy from cash_ready (not from cash_cooldown) -- this is
        # the one line that encodes the whole cooldown rule
        hold = max(prev_hold, prev_ready - price)
        cash_cooldown = prev_hold + price          # sell today
        cash_ready = max(prev_ready, prev_cooldown)  # cooldown clears

    return max(cash_cooldown, cash_ready)`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-expected-time-to-liquidation",
    title: "Expected Days Until a Margin Account Hits Liquidation",
    difficulty: "hard",
    topics: ["probability", "markov-chain", "linear-algebra"],
    problem:
      "A margin account's health state moves each day among states 0..n (0 = liquidated, an absorbing state; n = fully healthy) according to a given one-day transition matrix. Starting from a given healthy state, return the expected number of days until the account first reaches state 0.",
    examples: [
      {
        input:
          "P (3 states: 0=liquidated, 1=warning, 2=healthy) = [[1,0,0],[0.3,0.5,0.2],[0.05,0.25,0.7]], start=2",
        output: "7.5",
        explanation:
          "Solving (I - Q) e = 1 over the two transient states (warning, healthy) gives expected absorption times of 5 days from warning and 7.5 days from healthy -- healthy takes longer in expectation to REACH liquidation, which is the expected direction, even though it also has its own small 0.05 direct-to-liquidation chance each day.",
      },
    ],
    constraints: ["2 <= number of states <= 50"],
    approach:
      "Expected time to absorption in a Markov chain is a classic linear-algebra result, not a simulation problem: for each transient state i, let e_i be the expected number of steps to absorption. Conditioning on one step forward gives e_i = 1 + sum over transient j of P[i,j] * e_j, since with probability P[i, absorbing] the chain absorbs immediately (contributing just the 1) and otherwise it takes one step to some other transient state j and then needs e_j more steps in expectation. Stacking this over every transient state gives a linear system (I - Q) e = 1, where Q is the transition matrix restricted to transient states only (dropping the absorbing row/column) -- solving that system directly with a linear solver gives every state's expected absorption time in one shot, exact and O(s^3), versus Monte Carlo simulation which only converges to an approximate answer and needs many trials to control variance, especially in the tail where absorption is rare.",
    code: `import numpy as np

def expected_days_to_liquidation(transition: np.ndarray, start_idx: int,
                                   absorbing_idx: int = 0) -> float:
    n = transition.shape[0]
    transient = [i for i in range(n) if i != absorbing_idx]
    # Q: transition matrix restricted to transient states only
    Q = transition[np.ix_(transient, transient)]
    I = np.eye(len(transient))

    # (I - Q) e = 1  -->  e = (I - Q)^-1 @ 1, the fundamental-matrix solution
    e = np.linalg.solve(I - Q, np.ones(len(transient)))

    return float(e[transient.index(start_idx)])

P = np.array([
    [1.00, 0.00, 0.00],
    [0.30, 0.50, 0.20],
    [0.05, 0.25, 0.70],
])
days = expected_days_to_liquidation(P, start_idx=2)`,
    language: "python",
    complexity: { time: "O(s^3) for the linear solve", space: "O(s^2)" },
  },
  {
    id: "lc-design-limit-order-matcher",
    title: "Design a Price-Time Priority Limit Order Matcher",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design a class supporting add_order(side, price, qty, order_id), which adds a buy or sell limit order and immediately matches it against resting opposite-side orders at or better than its price, in strict price-then-arrival-time priority, filling as much as possible and resting any unfilled remainder in the book. Return the list of (order_id, counterparty_id, fill_qty, fill_price) fills produced.",
    examples: [
      {
        input:
          "add_order('sell',100,50,'S1'); add_order('sell',99,30,'S2'); add_order('buy',101,60,'B1')",
        output:
          "fills for B1: [('B1','S2',30,99), ('B1','S1',20,100)]; B1 has 10 qty resting unfilled at 101",
      },
    ],
    approach:
      "Price-time priority means the book needs, per side, a structure that always yields the best available price and, among equal prices, the earliest-arrived order -- exactly what a heap keyed on (price direction, arrival sequence number) gives in O(log n) per operation. Use a min-heap for resting sell orders keyed by (price, seq) so the lowest ask sits on top, and a max-heap (negated price) for resting buys keyed by (-price, seq) so the highest bid sits on top; the shared monotonically increasing seq counter breaks price ties in arrival order. On a new order, repeatedly peek the opposite book's best resting order: while it exists and crosses the incoming order's limit price (a buy crosses any ask <= its price, a sell crosses any bid >= its price), match at the RESTING order's price (the resting side that's already in the book sets the trade price, standard price-time priority convention, not the aggressor's price) for min(remaining qty, resting qty), popping the resting order if fully consumed or decrementing it in place otherwise. Whatever quantity remains unmatched on the incoming order gets pushed onto its own side's heap to rest.",
    code: `import heapq
import itertools

class OrderMatcher:
    def __init__(self):
        self.seq = itertools.count()
        self.sells: list = []   # (price, seq, qty, order_id) min-heap
        self.buys: list = []    # (-price, seq, qty, order_id) max-heap-by-price

    def add_order(self, side: str, price: float, qty: int, order_id: str):
        fills = []
        book = self.sells if side == "buy" else self.buys
        # crosses: buy vs lowest ask, sell vs highest bid
        crosses = (lambda p: p <= price) if side == "buy" else (lambda p: -p >= price)

        while qty > 0 and book and crosses(book[0][0] if side == "buy" else -book[0][0]):
            rest_price, rest_seq, rest_qty, rest_id = book[0]
            trade_price = rest_price if side == "buy" else -rest_price
            trade_qty = min(qty, rest_qty)
            fills.append((order_id, rest_id, trade_qty, trade_price))
            qty -= trade_qty
            if trade_qty == rest_qty:
                heapq.heappop(book)
            else:
                book[0] = (rest_price, rest_seq, rest_qty - trade_qty, rest_id)

        if qty > 0:
            resting = self.sells if side == "sell" else self.buys
            key_price = price if side == "sell" else -price
            heapq.heappush(resting, (key_price, next(self.seq), qty, order_id))

        return fills`,
    language: "python",
    complexity: {
      time: "O(log n) amortized per matched or resting order",
      space: "O(n) for resting orders",
    },
  },
  {
    id: "lc-staggered-rebalance-scheduler",
    title: "Scheduling Staggered Rebalance Orders Across a Cooldown Window",
    difficulty: "medium",
    topics: ["heap", "greedy"],
    problem:
      "Given a list of rebalance tasks, each needing exactly one unit of execution time on a single trading desk, and a fixed cooldown of c time-units required between two executions of the SAME task type (to avoid overtrading the same name), return the minimum total time-units needed to execute all tasks, idling the desk if nothing is eligible.",
    examples: [
      {
        input: "tasks=['A','A','A','B','B','B'], cooldown=2",
        output: "8",
        explanation:
          "One valid schedule: A B idle A B idle A B, taking 8 slots. Each repeat of A or B must wait cooldown=2 slots after its previous execution; with two task types this thin, the desk cannot avoid idling.",
      },
    ],
    constraints: ["1 <= len(tasks) <= 10^4", "0 <= cooldown <= 100"],
    approach:
      "This is the classic task-scheduler greedy: always execute the currently-eligible task type with the LARGEST remaining count first, since the type with the most outstanding work is the one most likely to become the bottleneck if it's deferred -- a max-heap of remaining counts drives that choice in O(log k) per slot for k task types. After running a task, it can't run again for `cooldown` slots, so it's pushed into a cooldown queue tagged with the time-unit it becomes eligible again; each slot, first release anything from the cooldown queue whose wait has elapsed back into the heap, then pop and run the current largest-count type if the heap is non-empty, else the desk idles for that slot. This greedy-with-cooldown-queue runs in O(n log k) and handles the frequency-count reasoning directly, rather than the closed-form idle-slot-counting formula which is faster to derive by hand but easy to get subtly wrong on edge cases like more task types than the cooldown allows to ever go idle.",
    code: `import heapq
from collections import Counter, deque

def min_schedule_time(tasks: list[str], cooldown: int) -> int:
    counts = Counter(tasks)
    heap = [-c for c in counts.values()]   # max-heap via negation
    heapq.heapify(heap)
    waiting: deque = deque()   # (available_time, -remaining_count)
    time = 0

    while heap or waiting:
        time += 1
        # release any task type whose cooldown has elapsed back into the heap
        if waiting and waiting[0][0] == time:
            heapq.heappush(heap, waiting.popleft()[1])

        if heap:
            remaining = -heapq.heappop(heap)
            remaining -= 1
            if remaining > 0:
                waiting.append((time + cooldown + 1, -remaining))
        # else: desk idles this slot, nothing eligible yet

    return time`,
    language: "python",
    complexity: { time: "O(n log k) for k distinct task types", space: "O(k)" },
  },
];
