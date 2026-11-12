import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-12
// K trades closest to the current mid price (heap), longest
// window tolerating at most K rejected orders (sliding window),
// max profit with a settlement cooldown after each sale (DP),
// expected number of days for a market-regime Markov chain to
// hit a risk-off absorbing state (probability / Markov chain),
// and a minimal price-time-priority limit order book matcher
// (design, heaps + FIFO price levels).
// ============================================================

export const financeBatch20261112: LeetCodeProblem[] = [
  {
    id: "lc-20261112-k-closest-trades-to-mid",
    title: "K Trades Closest to the Current Mid Price",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "Given a stream of recent trade prices and the current mid price, return the K trade prices closest to the mid. Break ties by preferring the lower price. The result does not need to preserve the original stream order, but should be sorted by closeness (then by price) for a deterministic answer.",
    examples: [
      {
        input: "trades = [98, 99, 101, 102, 97], mid = 100, k = 3",
        output: "[99, 101, 98]",
        explanation:
          "Distances from mid: 98 -> 2, 99 -> 1, 101 -> 1, 102 -> 2, 97 -> 3. The three closest are 99 and 101 (distance 1 each), then a tie between 98 and 102 at distance 2 -- the lower price, 98, wins the tie. Sorted by (distance, price): 99, 101, 98.",
      },
    ],
    constraints: ["1 <= k <= trades.length", "1 <= trades.length <= 10^5", "all prices are positive integers"],
    approach:
      "Scanning once and keeping a bounded max-heap of size k is the right tool here: sorting the whole stream and slicing is O(n log n), but a size-k heap gets it down to O(n log k), which matters when k is small relative to the tape. The subtlety is the heap's ordering key: we want to evict the single WORST entry whenever the heap overflows, where 'worst' means largest distance, and among equal distances, the higher price (since lower price wins ties). Encoding each entry as (-distance, -price) and using Python's ordinary min-heap makes the heap's top (the smallest encoded tuple) correspond exactly to that worst entry -- negating both fields simultaneously preserves the combined ordering we want to evict by, so a single heapreplace comparison handles both the primary distance criterion and the tie-break in one shot, with no special-casing.",
    code: `import heapq


def k_closest_trades_to_mid(trades: list[int], mid: int, k: int) -> list[int]:
    # heap holds at most k entries, encoded as (-distance, -price) so that
    # Python's min-heap top is always the single worst entry currently kept:
    # largest distance, or (tied) largest price, since lower price should win.
    heap: list[tuple[int, int]] = []

    for price in trades:
        distance = abs(price - mid)
        entry = (-distance, -price)
        if len(heap) < k:
            heapq.heappush(heap, entry)
        elif entry > heap[0]:
            # entry > heap[0] means entry has smaller distance, or tied
            # distance with a smaller price -- strictly better than the
            # current worst kept entry, so it displaces it.
            heapq.heapreplace(heap, entry)

    # Decode and present in a deterministic order: closest first, ties by
    # lower price -- i.e. ascending on the un-negated (distance, price).
    decoded = sorted((-neg_dist, -neg_price) for neg_dist, neg_price in heap)
    return [price for _dist, price in decoded]


print(k_closest_trades_to_mid([98, 99, 101, 102, 97], mid=100, k=3))
# [99, 101, 98]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-20261112-longest-window-at-most-k-rejects",
    title: "Longest Window Tolerating at Most K Rejected Orders",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a sequence of order outcomes, where 1 marks a rejected order and 0 marks a filled one, and an integer k, return the length of the longest contiguous window containing at most k rejections. This models the longest stretch of order flow you could safely backtest against before the venue's reject rate looks too unstable to trust.",
    examples: [
      {
        input: "outcomes = [0,1,0,1,1,0,0,1,0], k = 2",
        output: "5",
        explanation:
          "The window outcomes[4..8] = [1,0,0,1,0] has length 5 and contains exactly 2 rejections (at indices 4 and 7); no longer window stays at or under 2 rejections anywhere in the sequence.",
      },
    ],
    constraints: ["1 <= outcomes.length <= 10^5", "outcomes[i] is 0 or 1", "0 <= k <= outcomes.length"],
    approach:
      "This is the standard 'at most k ones' sliding window: grow the right pointer every step, tracking a running count of rejections (1s) inside the current window; whenever that count exceeds k, shrink from the left until it's back at or under k. Because every element removed while shrinking can only decrease the count (never increase it), the left pointer never needs to move backward once it has advanced -- each index is visited by right once and by left at most once, giving a single O(n) pass rather than recomputing the count per window. The window length is simply right - left + 1 at each step once the count is valid, and the running max over all steps is the answer.",
    code: `def longest_window_at_most_k_rejects(outcomes: list[int], k: int) -> int:
    left = 0
    reject_count = 0
    best = 0

    for right, outcome in enumerate(outcomes):
        reject_count += outcome  # outcome is 0 or 1, so this just tallies rejects

        while reject_count > k:
            reject_count -= outcomes[left]
            left += 1

        best = max(best, right - left + 1)

    return best


print(longest_window_at_most_k_rejects([0, 1, 0, 1, 1, 0, 0, 1, 0], k=2))
# 5`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261112-max-profit-with-cooldown",
    title: "Max Profit With a Settlement Cooldown After Each Sale",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for one instrument and an integer cooldown, you may buy and sell as many times as you like (never holding more than one unit at a time), but after selling you must wait cooldown full days before your proceeds are free to fund another buy. Return the maximum total profit achievable.",
    examples: [
      {
        input: "prices = [1,2,3,0,2], cooldown = 1",
        output: "3",
        explanation:
          "Buy at 1, sell at 2 (profit 1), wait out the 1-day cooldown, buy at 0, sell at 2 (profit 2). Total profit 1 + 2 = 3.",
      },
      {
        input: "prices = [1,2,3,0,2], cooldown = 2",
        output: "2",
        explanation:
          "With a longer 2-day settlement period there isn't time to clear the first sale's cooldown and still catch the second dip-and-recover, so the best achievable is a single round trip: buy at 1, sell at 3, profit 2.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= cooldown <= prices.length"],
    approach:
      "This generalizes the classic buy/sell-with-cooldown DP (which fixes cooldown = 1) to an arbitrary settlement period. Track three running arrays: hold[i] (max profit while holding a position bought on or before day i), sold[i] (max profit if you sell exactly on day i), and rest[i] (max profit while flat and with all proceeds already cleared of cooldown, i.e. free to buy). The key recurrence is how rest absorbs a past sale: proceeds from selling on day i only become spendable starting day i + cooldown, so rest[i] = max(rest[i-1], sold[i-cooldown]) once i - cooldown is a valid day -- this is the one place the generalized cooldown enters, versus the fixed-at-1 textbook version. hold[i] = max(hold[i-1], rest[i-1] - price[i]) (keep holding, or buy today funded by the cleared cash as of yesterday), and sold[i] = hold[i-1] + price[i] (sell today's holding). The final answer is the better of ending flat-with-cleared-cash or having just sold on the last day.",
    code: `def max_profit_with_cooldown(prices: list[int], cooldown: int) -> int:
    n = len(prices)
    if n == 0:
        return 0

    neg_inf = float("-inf")
    hold = [0.0] * n   # max profit while holding a position bought by day i
    sold = [neg_inf] * n  # max profit if the position is sold exactly on day i
    rest = [0.0] * n   # max profit while flat, with proceeds cleared of cooldown

    hold[0] = -prices[0]
    # sold[0] stays -inf: there is nothing to sell before ever buying.
    # rest[0] stays 0: no profit banked yet on day 0.

    for i in range(1, n):
        hold[i] = max(hold[i - 1], rest[i - 1] - prices[i])
        sold[i] = hold[i - 1] + prices[i]
        if i - cooldown >= 0:
            # the sale from cooldown days ago has now cleared and its cash
            # joins the pool of money free to redeploy.
            rest[i] = max(rest[i - 1], sold[i - cooldown])
        else:
            rest[i] = rest[i - 1]

    return int(max(rest[-1], sold[-1]))


print(max_profit_with_cooldown([1, 2, 3, 0, 2], cooldown=1))
# 3
print(max_profit_with_cooldown([1, 2, 3, 0, 2], cooldown=2))
# 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-20261112-expected-steps-regime-chain",
    title: "Expected Days Until a Market-Regime Markov Chain Hits Risk-Off",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "A market is modeled as a finite-state Markov chain over daily regimes, with one or more absorbing (terminal) states such as a risk-off crash regime. Given the transition matrix, the set of absorbing state indices, and a starting state, return the expected number of days until the chain first reaches any absorbing state.",
    examples: [
      {
        input:
          "transition = [[0.6,0.3,0.1],[0.4,0.5,0.1],[0,0,1]], absorbing = [2], start = 0  // states: 0=Trending, 1=MeanReverting, 2=RiskOff",
        output: "10.0",
        explanation:
          "Solving E0 = 1 + 0.6*E0 + 0.3*E1 and E1 = 1 + 0.4*E0 + 0.5*E1 simultaneously gives E0 = E1 = 10.0 days -- plug back in to check: 1 + 0.6*10 + 0.3*10 = 10, and 1 + 0.4*10 + 0.5*10 = 10.",
      },
    ],
    constraints: [
      "2 <= number of states <= 20",
      "each row of transition sums to 1",
      "at least one absorbing state is reachable from start",
      "start is not itself an absorbing state",
    ],
    approach:
      "This is the N-state generalization of gambler's-ruin-style expected-duration problems, which only handle two absorbing barriers on a line. For each transient (non-absorbing) state i, a first-step argument gives E[i] = 1 + sum over transient j of P(i -> j) * E[j] (transitions into an absorbing state contribute 0 extra days beyond the 1 step taken to arrive). Collecting these equations over all transient states is exactly the linear system (I - Q) * E = 1, where Q is the transition matrix restricted to transient-to-transient probabilities -- the classical 'fundamental matrix' result for absorbing Markov chains. Rather than depending on a linear-algebra library, solve that small system directly with Gaussian elimination (partial pivoting for numerical stability), which is more than fast enough for the handful of regime states a quant model like this typically has.",
    code: `def expected_steps_to_absorption(
    transition: list[list[float]], absorbing: list[int], start: int
) -> float:
    # Restrict the system to transient states only: absorbing states
    # contribute 0 additional expected steps once reached, so they drop
    # out of the unknowns entirely.
    n = len(transition)
    transient = [i for i in range(n) if i not in absorbing]
    pos = {state: k for k, state in enumerate(transient)}
    m = len(transient)

    # Build (I - Q) x = 1 restricted to transient rows/columns.
    a = [[0.0] * m for _ in range(m)]
    b = [1.0] * m
    for row, i in enumerate(transient):
        for col, j in enumerate(transient):
            identity_term = 1.0 if row == col else 0.0
            a[row][col] = identity_term - transition[i][j]

    x = _gauss_solve(a, b)
    return x[pos[start]]


def _gauss_solve(a: list[list[float]], b: list[float]) -> list[float]:
    # Solve a @ x = b with Gaussian elimination and partial pivoting.
    n = len(a)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]  # augmented matrix

    for col in range(n):
        pivot_row = max(range(col, n), key=lambda r: abs(m[r][col]))
        m[col], m[pivot_row] = m[pivot_row], m[col]
        pivot = m[col][col]
        for j in range(col, n + 1):
            m[col][j] /= pivot
        for r in range(n):
            if r != col:
                factor = m[r][col]
                for j in range(col, n + 1):
                    m[r][j] -= factor * m[col][j]

    return [m[i][n] for i in range(n)]


chain = [[0.6, 0.3, 0.1], [0.4, 0.5, 0.1], [0.0, 0.0, 1.0]]
print(expected_steps_to_absorption(chain, absorbing=[2], start=0))
# 10.0`,
    language: "python",
    complexity: { time: "O(s^3) for s transient states (Gaussian elimination)", space: "O(s^2)" },
  },
  {
    id: "lc-20261112-design-limit-order-book-matcher",
    title: "Design: Minimal Price-Time-Priority Limit Order Book",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design a LimitOrderBook supporting add_limit_order(order_id, side, price, size), where side is 'buy' or 'sell'. An incoming order matches against the opposite side at prices that cross (a buy matches asks at or below its price; a sell matches bids at or above its price), filling against the best-priced resting order first and, within a price level, the earliest-added resting order first (FIFO). Any unfilled remainder rests in the book. Return the list of fills produced, each as (resting_order_id, incoming_order_id, fill_price, fill_size).",
    examples: [
      {
        input:
          "add(1,'sell',101,50); add(2,'sell',100,30); add(3,'buy',102,40)",
        output: "[], [], [(2,3,100,30), (1,3,101,10)]",
        explanation:
          "Order 1 and order 2 rest as asks with no bids to cross. Order 3 (buy at 102, size 40) crosses: it first fills fully against the better-priced ask (order 2 at 100) for 30 units, then fills 10 more units against order 1 at 101, leaving order 1 resting with 40 units remaining and order 3 fully filled.",
      },
    ],
    constraints: [
      "order_id values are unique across the book's lifetime",
      "price and size are positive",
      "at most 10^5 add_limit_order calls",
    ],
    approach:
      "Price-time priority needs fast access to the best price on each side plus FIFO order within a price level. Use a dict from price to a deque of [order_id, size] for each side (the deque gives O(1) FIFO pops and in-place size mutation for partial fills), and a heap of price levels per side for O(log levels) access to the best price -- a max-heap (via negation) for bids, a min-heap for asks. Price levels are only ever lazily removed from the heap: when a level's deque empties, the stale price is simply skipped and popped off the heap the next time it surfaces at the top, rather than doing an eager removal that a plain binary heap doesn't support efficiently. Matching an incoming order is a loop: while it still has size left and the best opposing price is willing to cross, consume from the front of that price level's deque (partially, if the incoming order is smaller than the resting order), recording a fill each time; once no more crossing is possible, any remaining size rests at its own price level.",
    code: `import heapq
from collections import defaultdict, deque


class LimitOrderBook:
    def __init__(self) -> None:
        self.bid_levels: dict[float, deque] = defaultdict(deque)  # price -> FIFO [order_id, size]
        self.ask_levels: dict[float, deque] = defaultdict(deque)
        self.bid_prices: list[float] = []  # max-heap of bid price levels, via negation
        self.ask_prices: list[float] = []  # min-heap of ask price levels

    def _best_bid(self) -> float | None:
        while self.bid_prices and not self.bid_levels[-self.bid_prices[0]]:
            heapq.heappop(self.bid_prices)  # drop stale, now-empty price levels
        return -self.bid_prices[0] if self.bid_prices else None

    def _best_ask(self) -> float | None:
        while self.ask_prices and not self.ask_levels[self.ask_prices[0]]:
            heapq.heappop(self.ask_prices)
        return self.ask_prices[0] if self.ask_prices else None

    def add_limit_order(self, order_id: int, side: str, price: float, size: int) -> list[tuple]:
        fills: list[tuple] = []

        if side == "buy":
            while size > 0:
                best_ask = self._best_ask()
                if best_ask is None or best_ask > price:
                    break  # nothing left willing to cross at an acceptable price
                level = self.ask_levels[best_ask]
                resting_id, resting_size = level[0]
                trade_size = min(size, resting_size)
                fills.append((resting_id, order_id, best_ask, trade_size))
                size -= trade_size
                resting_size -= trade_size
                if resting_size == 0:
                    level.popleft()
                else:
                    level[0][1] = resting_size
            if size > 0:
                self.bid_levels[price].append([order_id, size])
                heapq.heappush(self.bid_prices, -price)
        else:
            while size > 0:
                best_bid = self._best_bid()
                if best_bid is None or best_bid < price:
                    break
                level = self.bid_levels[best_bid]
                resting_id, resting_size = level[0]
                trade_size = min(size, resting_size)
                fills.append((resting_id, order_id, best_bid, trade_size))
                size -= trade_size
                resting_size -= trade_size
                if resting_size == 0:
                    level.popleft()
                else:
                    level[0][1] = resting_size
            if size > 0:
                self.ask_levels[price].append([order_id, size])
                heapq.heappush(self.ask_prices, price)

        return fills


book = LimitOrderBook()
print(book.add_limit_order(1, "sell", 101, 50))  # []
print(book.add_limit_order(2, "sell", 100, 30))  # []
print(book.add_limit_order(3, "buy", 102, 40))   # [(2,3,100,30), (1,3,101,10)]`,
    language: "python",
    complexity: {
      time: "O(log L) amortized per matched price level, L = distinct price levels on that side",
      space: "O(number of resting orders)",
    },
  },
];
