import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-22
// A sliding-window max for a rolling VWAP band, a k-th largest
// order-size streaming tracker, a buy/sell-with-fee DP, a
// Markov-chain expected-steps-to-absorption problem, and a
// price-time priority order matcher design.
// ============================================================

export const financeBatch20260922: LeetCodeProblem[] = [
  {
    id: "lc-20260922-sliding-window-max-price-band",
    title: "Rolling High-Low Band Over a Sliding Window",
    difficulty: "medium",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given an array of tick prices and a window size k, return an array where each element is the (max - min) price range over the trailing k ticks ending at that index (or None for indices before the window first fills).",
    examples: [
      {
        input: "prices=[10,12,9,15,13,8], k=3",
        output: "[None, None, 3, 6, 6, 7]",
        explanation:
          "Index 2 window [10,12,9]: max-min=12-9=3. Index 3 window [12,9,15]: 15-9=6. Index 5 window [15,13,8]: 15-8=7.",
      },
    ],
    constraints: ["1 <= len(prices) <= 10^5", "1 <= k <= len(prices)"],
    approach:
      "Track a rolling max and rolling min independently, each with its own monotonic deque of indices. For the max deque, pop from the back while the incoming price is >= the price at the back's index (those entries can never again be the window's max once a bigger, more recent value has arrived), then push the new index; pop from the front whenever the front index has fallen outside the window. Mirror the same logic for the min deque with the comparison flipped. At each index once the window has filled, the range is prices[max_deque[0]] - prices[min_deque[0]]. Each index enters and leaves each deque at most once, so despite the nested-looking while loops the whole pass is O(n).",
    code: `from collections import deque

def rolling_range(prices: list[int], k: int) -> list[float | None]:
    max_dq: deque[int] = deque()   # indices, prices decreasing front-to-back
    min_dq: deque[int] = deque()   # indices, prices increasing front-to-back
    result: list[float | None] = []

    for i, price in enumerate(prices):
        while max_dq and prices[max_dq[-1]] <= price:
            max_dq.pop()
        max_dq.append(i)

        while min_dq and prices[min_dq[-1]] >= price:
            min_dq.pop()
        min_dq.append(i)

        window_start = i - k + 1
        if max_dq[0] < window_start:
            max_dq.popleft()
        if min_dq[0] < window_start:
            min_dq.popleft()

        if i < k - 1:
            result.append(None)
        else:
            result.append(prices[max_dq[0]] - prices[min_dq[0]])

    return result

print(rolling_range([10, 12, 9, 15, 13, 8], k=3))
# [None, None, 3, 6, 6, 7]`,
    language: "python",
    complexity: { time: "O(n)", space: "O(k)" },
  },
  {
    id: "lc-20260922-kth-largest-order-stream",
    title: "Kth Largest Order Size in a Live Stream",
    difficulty: "medium",
    topics: ["heap", "streaming", "design"],
    problem:
      "Design a class KthLargestOrder that is initialized with an integer k and a list of initial order sizes, and supports add(order_size), which inserts a new order size and returns the k-th largest order size seen so far.",
    examples: [
      {
        input: "k=3, initial=[4,5,8,2], add(3), add(5), add(10), add(9), add(4)",
        output: "4, 5, 5, 8, 8",
        explanation:
          "After adding 3: sorted desc [8,5,4,3,2], 3rd largest is 4. After adding 5: [8,5,5,4,3,2], 3rd is 5. Continues similarly.",
      },
    ],
    constraints: ["1 <= k <= 10^4", "at most 10^4 calls to add", "order sizes fit in a 32-bit int"],
    approach:
      "Maintain a min-heap of exactly the k largest values seen so far -- the heap's smallest element (the top) is therefore always the k-th largest overall. On each add, push the new value, and if the heap now holds more than k elements, pop the smallest (it has been displaced out of the top-k). The top of the heap after that maintenance step is the answer, read in O(1); each add is O(log k) since the heap never grows past size k regardless of how many orders have streamed through in total, which is the key advantage over re-sorting the full history on every call.",
    code: `import heapq

class KthLargestOrder:
    def __init__(self, k: int, initial: list[int]):
        self.k = k
        self.heap: list[int] = []   # min-heap, capped at size k
        for size in initial:
            self.add(size)

    def add(self, order_size: int) -> int:
        heapq.heappush(self.heap, order_size)
        if len(self.heap) > self.k:
            heapq.heappop(self.heap)   # smallest of the top-k window falls out
        return self.heap[0]            # top of a size-k min-heap = k-th largest

tracker = KthLargestOrder(3, [4, 5, 8, 2])
for size in [3, 5, 10, 9, 4]:
    print(tracker.add(size))
# 4 5 5 8 8`,
    language: "python",
    complexity: { time: "O(log k) per add", space: "O(k)" },
  },
  {
    id: "lc-20260922-buy-sell-with-transaction-fee",
    title: "Best Time to Buy and Sell Stock With a Per-Trade Fee",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices and a fixed fee charged once per completed round-trip (buy then sell), you may transact as many times as you like but must sell before buying again. Return the maximum achievable profit.",
    examples: [
      {
        input: "prices=[1,3,2,8,4,9], fee=2",
        output: "8",
        explanation:
          "Buy day0 (1), sell day3 (8): profit 7-2=5 fee-adjusted. Buy day4 (4), sell day5 (9): profit 5-2=3. Total 5+3=8.",
      },
    ],
    constraints: ["1 <= prices.length <= 5*10^4", "0 <= prices[i], fee <= 10^4"],
    approach:
      "Two-state DP tracked per day: cash (best profit while holding no position) and hold (best profit while currently holding one share). Transitions: cash today is the better of staying in cash, or selling what you held yesterday and paying the fee now (hold_yesterday + price - fee); hold today is the better of continuing to hold, or buying today from cash (cash_yesterday - price). Charging the fee on the SELL side rather than the buy side is an arbitrary but important convention choice -- charging it on both sides would double-count it, and the recurrence must apply it exactly once per round trip. The answer is cash at the end, since ending while still holding an unsold share is never optimal. Rolling two scalars forward keeps this O(1) space.",
    code: `def max_profit_with_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    cash = 0                # best profit, holding nothing
    hold = -prices[0]       # best profit, holding a share bought on day 0

    for price in prices[1:]:
        # sell today: the fee is charged exactly once, on the sell leg
        cash = max(cash, hold + price - fee)
        # buy today: only from cash, never stacking a second position
        hold = max(hold, cash - price)

    return cash   # ending while still holding is never optimal

print(max_profit_with_fee([1, 3, 2, 8, 4, 9], fee=2))   # 8`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260922-markov-expected-steps-margin-call",
    title: "Expected Days Until Margin Call (Markov Chain Absorption)",
    difficulty: "hard",
    topics: ["probability", "markov-chain", "dynamic-programming"],
    problem:
      "An account's margin cushion is one of integer states 0..N, where state 0 means a margin call has been triggered (absorbing) and state N means fully collateralized (also absorbing, since the account tops back up to N and resets from there). From any interior state i, each day the cushion moves to i-1 with probability p, to i+1 with probability q, and stays at i with probability 1-p-q. Given a starting state s (0 < s < N), return the expected number of days until the account is either margin-called (state 0) or fully tops up (state N).",
    examples: [
      {
        input: "N=4, s=2, p=0.5, q=0.3",
        output: "4.7059",
        explanation:
          "With p=0.5, q=0.3, staying-put probability 0.2, starting at state 2 of 4, solving the linear system below for expected absorption time gives about 4.7059 days -- there is no simple closed form to recite here, it comes from solving the recurrence.",
      },
    ],
    constraints: ["2 <= N <= 500", "0 < s < N", "0 <= p, q", "p + q <= 1"],
    approach:
      "Let E[i] be the expected number of days to absorption starting from state i, with boundary conditions E[0] = E[N] = 0. For each interior state, E[i] = 1 + p*E[i-1] + q*E[i+1] + (1-p-q)*E[i] -- one day always passes, plus the expected remaining time from wherever you land. This is a linear system in the unknowns E[1..N-1]; solving it directly with a tridiagonal linear solve is exact and O(N), far more reliable than Monte Carlo simulation for states near the absorbing boundaries where sample paths can take a very long time to terminate and simulation variance is high. Building the tridiagonal matrix explicitly and using a banded solver keeps this linear in N rather than the O(N^3) a generic dense solve would cost.",
    code: `import numpy as np

def expected_days_to_absorption(N: int, s: int, p: float, q: float) -> float:
    if s == 0 or s == N:
        return 0.0

    stay = 1.0 - p - q
    n_unknowns = N - 1   # states 1..N-1

    # build the tridiagonal system (I - stay*I - p*sub - q*sup) E = 1
    # rearranged from E[i] = 1 + p*E[i-1] + q*E[i+1] + stay*E[i]
    A = np.zeros((n_unknowns, n_unknowns))
    b = np.ones(n_unknowns)

    for row, i in enumerate(range(1, N)):
        A[row, row] = 1.0 - stay
        if i - 1 >= 1:
            A[row, row - 1] = -p
        # else: E[0] = 0, boundary term drops out of the RHS naturally
        if i + 1 <= N - 1:
            A[row, row + 1] = -q
        # else: E[N] = 0, same boundary reasoning

    E = np.linalg.solve(A, b)
    return float(E[s - 1])

print(round(expected_days_to_absorption(N=4, s=2, p=0.5, q=0.3), 4))`,
    language: "python",
    complexity: { time: "O(N) for the tridiagonal solve", space: "O(N)" },
  },
  {
    id: "lc-20260922-price-time-matcher",
    title: "Design a Price-Time Priority Order Matcher",
    difficulty: "hard",
    topics: ["design", "heap", "queue"],
    problem:
      "Design a class OrderMatcher that supports limit_order(order_id, side, price, size), adding a resting BUY or SELL limit order that immediately attempts to match against the opposite side's best-priced, earliest-arrived orders (price-time priority), executing partial fills as needed and resting any unfilled remainder. Return the list of (buy_order_id, sell_order_id, fill_price, fill_size) trades produced by each call.",
    examples: [
      {
        input:
          'limit_order(1,"SELL",101,10); limit_order(2,"SELL",100,5); limit_order(3,"BUY",102,8)',
        output: "[]  then  []  then  [(3, 2, 100, 5), (3, 1, 101, 3)]",
        explanation:
          "The incoming buy at 102 crosses both resting sells (both <= 102): it fills the better-priced order 2 first (5 @ 100), then the remaining 3 shares against order 1 (3 @ 101), leaving order 1 resting with 7 shares left and the buy order fully filled.",
      },
    ],
    constraints: ["up to 10^5 total calls", "prices and sizes are positive integers", "order_ids are unique"],
    approach:
      "Maintain two heaps of resting orders: sells as a min-heap keyed by (price, arrival_sequence) so the best (lowest) price with the earliest arrival sorts to the top, and buys as a max-heap keyed by (-price, arrival_sequence) for the same reason on the other side. An arriving order first tries to match against the OPPOSITE book: while the opposite book's best order crosses the incoming price (incoming buy price >= resting sell price, or incoming sell price <= resting buy price) and the incoming order still has size left, execute a trade at the RESTING order's price (price-time priority means the order that was there first sets the trade price), reduce both sizes by min(incoming_remaining, resting_remaining), and pop the resting order if it is fully consumed. Once no more crosses are possible, whatever size remains on the incoming order rests on its own side of the book. A monotonically increasing arrival counter breaks price ties in FIFO order, which is what makes this price-TIME priority rather than just price priority.",
    code: `import heapq

class OrderMatcher:
    def __init__(self):
        self.sells: list[tuple[int, int, int, int]] = []   # (price, seq, order_id, size)
        self.buys: list[tuple[int, int, int, int]] = []    # (-price, seq, order_id, size)
        self.seq = 0

    def limit_order(self, order_id: int, side: str, price: int, size: int):
        trades = []
        self.seq += 1
        remaining = size

        if side == "BUY":
            while remaining > 0 and self.sells and self.sells[0][0] <= price:
                sell_price, _, sell_id, sell_size = self.sells[0]
                fill = min(remaining, sell_size)
                trades.append((order_id, sell_id, sell_price, fill))
                remaining -= fill
                sell_size -= fill
                if sell_size == 0:
                    heapq.heappop(self.sells)
                else:
                    # size shrank but (price, seq) -- the sort key -- is unchanged,
                    # and seq is unique, so heap order is preserved without re-heapifying
                    self.sells[0] = (sell_price, self.sells[0][1], sell_id, sell_size)
            if remaining > 0:
                heapq.heappush(self.buys, (-price, self.seq, order_id, remaining))
        else:
            while remaining > 0 and self.buys and -self.buys[0][0] >= price:
                neg_buy_price, _, buy_id, buy_size = self.buys[0]
                buy_price = -neg_buy_price
                fill = min(remaining, buy_size)
                trades.append((buy_id, order_id, buy_price, fill))
                remaining -= fill
                buy_size -= fill
                if buy_size == 0:
                    heapq.heappop(self.buys)
                else:
                    self.buys[0] = (neg_buy_price, self.buys[0][1], buy_id, buy_size)
            if remaining > 0:
                heapq.heappush(self.sells, (price, self.seq, order_id, remaining))

        return trades

book = OrderMatcher()
print(book.limit_order(1, "SELL", 101, 10))   # []
print(book.limit_order(2, "SELL", 100, 5))    # []
print(book.limit_order(3, "BUY", 102, 8))     # [(3,2,100,5), (3,1,101,3)]`,
    language: "python",
    complexity: { time: "O(log n) per fill event, amortized", space: "O(n)" },
  },
];
