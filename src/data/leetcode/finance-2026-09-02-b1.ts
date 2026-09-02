import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-02
// A lazily-deleted max-heap leaderboard for live Sharpe ratios,
// a monotonic-deque sliding window max spread, a k-transactions
// stock DP combined with a per-trade fee, a reflecting-boundary
// random walk absorption probability, and a limit order matcher
// with self-trade prevention.
// ============================================================

export const financeBatch20260902: LeetCodeProblem[] = [
  {
    id: "lc-topk-sharpe-leaderboard-streaming",
    title: "Design a Live Top-K Sharpe Ratio Leaderboard",
    difficulty: "hard",
    topics: ["heap", "design", "hash-map"],
    problem:
      "Design a leaderboard that tracks a live Sharpe ratio for each of many trading strategies. It must support update(strategy_id, sharpe), which sets or resets a strategy's current Sharpe ratio, and top_k(k), which returns the k strategies with the highest current Sharpe ratio, best first. A strategy's Sharpe changes frequently as new data arrives, and the leaderboard must stay efficient across many updates and queries, not just a handful.",
    examples: [
      {
        input: "update('A', 1.5); update('B', 2.1); update('C', 0.8); top_k(2)",
        output: "['B', 'A']",
        explanation:
          "B has the highest current Sharpe (2.1), followed by A (1.5); C (0.8) doesn't make the top 2.",
      },
      {
        input: "update('A', 3.0); top_k(1)",
        output: "['A']",
        explanation:
          "A's Sharpe was just updated to 3.0, overtaking B -- the leaderboard reflects the latest value per strategy, not every historical update.",
      },
    ],
    constraints: [
      "1 <= number of operations <= 10^5",
      "sharpe values are floats and can be updated repeatedly for the same strategy_id",
      "1 <= k <= number of distinct strategies currently tracked",
    ],
    approach:
      "Keep a hash map strategy_id -> current Sharpe for O(1) lookups and updates, plus a max-heap of (sharpe, strategy_id, version) entries for fast top-k retrieval. Because a strategy's Sharpe can be updated many times, popping from a single heap keyed only by value would return stale entries -- solve this with lazy deletion via versioning: give each strategy a version counter that increments on every update, push new tuples without removing the old ones, and when popping for a query, discard any popped entry whose version doesn't match the strategy's current version in the hash map, since that means it's a superseded update. top_k(k) pops until it collects k valid (non-stale) entries, then pushes them all back so the heap is unchanged for the next query. Each update is O(log n) amortized, and top_k(k) costs O(k log n) plus the cost of skipping any stale entries encountered along the way.",
    code: `import heapq
from itertools import count

class SharpeLeaderboard:
    def __init__(self):
        self.current: dict[str, float] = {}       # strategy_id -> latest sharpe
        self.version: dict[str, int] = {}          # strategy_id -> latest version number
        self.heap: list[tuple[float, int, str]] = []   # max-heap via negated sharpe
        self._counter = count()

    def update(self, strategy_id: str, sharpe: float) -> None:
        v = next(self._counter)
        self.current[strategy_id] = sharpe
        self.version[strategy_id] = v
        # push a new entry rather than mutate the heap in place -- older
        # entries for this id are left behind and skipped lazily on pop
        heapq.heappush(self.heap, (-sharpe, -v, strategy_id))

    def top_k(self, k: int) -> list[str]:
        result: list[str] = []
        popped: list[tuple[float, int, str]] = []
        while self.heap and len(result) < k:
            neg_sharpe, neg_v, strategy_id = heapq.heappop(self.heap)
            if self.version.get(strategy_id) == -neg_v:   # still the current update
                result.append(strategy_id)
                popped.append((neg_sharpe, neg_v, strategy_id))
            # else: a stale, superseded update -- drop it rather than restoring it
        for entry in popped:
            heapq.heappush(self.heap, entry)
        return result

board = SharpeLeaderboard()
board.update("A", 1.5)
board.update("B", 2.1)
board.update("C", 0.8)
print(board.top_k(2))   # ['B', 'A']
board.update("A", 3.0)   # A jumps to the top
print(board.top_k(1))   # ['A']`,
    language: "python",
    complexity: {
      time: "O(log n) amortized per update, O(k log n) per top_k(k)",
      space: "O(n + pending stale entries)",
    },
  },
  {
    id: "lc-sliding-window-max-spread-deque",
    title: "Sliding Window Maximum Bid-Ask Spread (Monotonic Deque)",
    difficulty: "medium",
    topics: ["sliding-window", "monotonic-deque"],
    problem:
      "Given a sequence of bid-ask spreads observed at each tick and a window size w, return the maximum spread within every window of w consecutive ticks, for all such windows in order. You need every window's max, not just one, so it must run faster than recomputing the max from scratch for each window.",
    examples: [
      {
        input: "spreads=[0.02, 0.05, 0.01, 0.04, 0.03], w=3",
        output: "[0.05, 0.05, 0.04]",
        explanation:
          "Windows [0.02,0.05,0.01] -> 0.05, [0.05,0.01,0.04] -> 0.05, [0.01,0.04,0.03] -> 0.04.",
      },
    ],
    constraints: ["1 <= spreads.length <= 10^5", "1 <= w <= spreads.length", "0 <= spreads[i] <= 10"],
    approach:
      "This is the classic sliding-window-maximum pattern, applied to spreads instead of arbitrary numbers. Recomputing the max of each window from scratch is O(n*w); instead maintain a deque of indices whose spreads are in decreasing order. For each new tick, pop from the back of the deque while the incoming spread is greater than or equal to the spread at the back's index, since those indices can never be the max of any future window again -- the new one is both larger and more recent. Push the new index, then pop from the front whenever the front index has fallen out of the current window. The deque's front always holds the index of the current window's maximum. Each index is pushed and popped from the deque at most once across the whole pass, so total work is O(n) despite the nested-looking logic.",
    code: `from collections import deque

def max_spread_per_window(spreads: list[float], w: int) -> list[float]:
    dq: deque[int] = deque()   # indices, spreads strictly decreasing front-to-back
    result: list[float] = []

    for i, spread in enumerate(spreads):
        # evict indices whose spread can never be the max again --
        # this new, more recent spread is at least as large
        while dq and spreads[dq[-1]] <= spread:
            dq.pop()
        dq.append(i)

        if dq[0] <= i - w:   # front index has aged out of the window
            dq.popleft()

        if i >= w - 1:
            result.append(spreads[dq[0]])   # front is always the current window's max

    return result

print(max_spread_per_window([0.02, 0.05, 0.01, 0.04, 0.03], w=3))   # [0.05, 0.05, 0.04]`,
    language: "python",
    complexity: { time: "O(n)", space: "O(w)" },
  },
  {
    id: "lc-stock-k-transactions-with-fee",
    title: "Maximum Profit With At Most K Transactions and a Per-Trade Fee",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices, an integer k (the max number of buy-sell round trips allowed), and a fixed fee charged on every sell, find the maximum total profit. You can't hold more than one share at a time, and each of the k allowed round trips pays the fee once, on the sell.",
    examples: [
      {
        input: "prices=[3,2,6,5,0,3], k=2, fee=1",
        output: "5",
        explanation:
          "Buy at 2, sell at 6: profit 6-2-1=3. Buy at 0, sell at 3: profit 3-0-1=2. Total 3+2=5, using both allowed round trips.",
      },
    ],
    constraints: ["1 <= prices.length <= 1000", "0 <= k <= 50", "0 <= prices[i] <= 1000", "0 <= fee <= 1000"],
    approach:
      "Extend the bounded-k stock DP (LeetCode's 'Best Time to Buy and Sell Stock IV') by folding the fee into the sell transition, the same way the unlimited-transactions-with-fee variant does. Track two rolling arrays indexed by transaction count 1..k: hold[t] = best profit having bought your t-th share and still holding it, and free[t] = best profit having completed t full round trips and currently flat. The sell transition subtracts the fee exactly when a round trip completes: free[t] = max(free[t], hold[t] + price - fee). The buy transition starts a new round trip funded from having completed t-1 round trips: hold[t] = max(hold[t], free[t-1] - price). Charging the fee on the sell, once per completed round trip, keeps it consistent with counting a 'transaction' as one full buy-sell pair, and rolling the day dimension away keeps space to O(k).",
    code: `def max_profit_k_transactions_fee(prices: list[int], k: int, fee: int) -> int:
    if not prices or k == 0:
        return 0

    NEG_INF = float("-inf")
    hold = [NEG_INF] * (k + 1)   # hold[t]: max profit holding your t-th purchase
    free = [0] * (k + 1)          # free[t]: max profit having completed t round trips

    for price in prices:
        for t in range(1, k + 1):
            # buy: start round trip t, funded from having finished round trip t-1
            hold[t] = max(hold[t], free[t - 1] - price)
            # sell: complete round trip t, fee charged once, on the sell
            free[t] = max(free[t], hold[t] + price - fee)

    return max(free)

print(max_profit_k_transactions_fee([3, 2, 6, 5, 0, 3], k=2, fee=1))   # 5`,
    language: "python",
    complexity: { time: "O(n*k)", space: "O(k)" },
  },
  {
    id: "lc-inventory-reflecting-walk-hit-probability",
    title: "Probability an Inventory Random Walk Hits Its Risk Limit Within T Steps (Reflecting at Zero)",
    difficulty: "hard",
    topics: ["probability", "dynamic-programming"],
    problem:
      "A market maker's signed inventory starts at i and, each step, moves up by 1 with probability p or down by 1 with probability 1-p -- except at inventory 0, where a down-move is not allowed to go negative and instead reflects (the walk stays at 0). Trading is forced to stop the instant inventory reaches a hard risk limit N (an absorbing barrier). Given N, i, p, and a horizon T, compute the probability the walk is absorbed at N at or before step T.",
    examples: [
      {
        input: "N=2, i=1, p=0.5, T=3",
        output: "0.625",
        explanation:
          "From i=1 (one below the limit), the walk is absorbed with probability 0.5 on step 1 alone. The remaining probability mass bounces between 0 and 1 off the reflecting boundary, contributing another 0.125 of absorption probability by step 3, for a cumulative 0.625.",
      },
    ],
    constraints: ["2 <= N <= 100", "0 <= i < N", "0 < p < 1", "1 <= T <= 500"],
    approach:
      "This is a finite-horizon absorption probability on a Markov chain with a reflecting boundary at 0 and an absorbing boundary at N -- solve it with forward DP over time rather than a closed-form formula, since the reflecting boundary breaks the usual gambler's-ruin closed forms. Track a probability vector over states 0..N-1 (state N is absorbing and tracked separately as cumulative probability already absorbed). At each step, redistribute each state's probability mass to its neighbors: state 0 sends p to state 1 and keeps 1-p at state 0 (the reflection), state N-1 sends p to the absorbing state N and 1-p to state N-2, and every interior state splits normally. Add whatever mass reaches N this step to the running absorbed total. After T steps, the running absorbed total is the answer. Each step is an O(N) pass over the state vector, so the full computation is O(N*T).",
    code: `def prob_absorbed_by_T(N: int, i: int, p: float, T: int) -> float:
    # dist[s] = probability mass currently sitting at inventory level s (0..N-1);
    # level N is absorbing and tracked separately as cumulative probability
    dist = [0.0] * N
    dist[i] = 1.0
    absorbed = 0.0

    for _ in range(T):
        new_dist = [0.0] * N
        for s in range(N):
            mass = dist[s]
            if mass == 0.0:
                continue
            if s == 0:
                # reflecting boundary: a down-move has nowhere to go, so it
                # stays at 0 instead of leaving the state space
                new_dist[0] += mass * (1 - p)
                new_dist[1] += mass * p
            elif s == N - 1:
                # up-move here is absorbed at the hard risk limit N
                absorbed += mass * p
                new_dist[s - 1] += mass * (1 - p)
            else:
                new_dist[s - 1] += mass * (1 - p)
                new_dist[s + 1] += mass * p
        dist = new_dist

    return absorbed

print(round(prob_absorbed_by_T(N=2, i=1, p=0.5, T=3), 4))   # 0.625`,
    language: "python",
    complexity: { time: "O(N*T)", space: "O(N)" },
  },
  {
    id: "lc-self-trade-prevention-matcher",
    title: "Design a Limit Order Book Matcher With Self-Trade Prevention (STP)",
    difficulty: "medium",
    topics: ["design", "hash-map"],
    problem:
      "Extend a standard price-time-priority limit order matcher with self-trade prevention: an incoming order must never match against a resting order that belongs to the same account. Support add_order(order_id, account_id, side, price, qty), which attempts to match immediately against the opposite side (best price first, then earliest resting time), skipping over -- never trading against -- any resting order from the same account_id, and resting whatever quantity doesn't get filled. Return the list of (resting_order_id, fill_qty) trades produced.",
    examples: [
      {
        input:
          "add_order(1,'acct_A','buy',100,50); add_order(2,'acct_A','sell',100,50); add_order(3,'acct_B','sell',100,50)",
        output: "order 2 -> []; order 3 -> [(1, 50)]",
        explanation:
          "Order 2 is acct_A trying to sell at 100 while acct_A's own order 1 rests as a buy at 100 -- STP means order 2 is not allowed to trade against order 1, so it rests instead with zero fills. Order 3, from a different account, does cross with order 1 and fills 50 at 100.",
      },
    ],
    constraints: [
      "1 <= number of operations <= 10^5",
      "each order_id is unique",
      "STP policy: skip the same-account resting order and continue matching against the next eligible order, rather than rejecting the whole incoming order",
    ],
    approach:
      "Keep the standard structure: for each side, a dict price -> list of resting orders in time priority. The STP twist only touches the matching loop: when walking resting orders at the best opposite price in time-priority order, an order belonging to the same account_id as the incoming order is not eligible to trade against -- skip it and continue to the next resting order, rather than either crossing anyway or aborting the whole match. A skipped same-account order stays resting untouched, so this is not the same as canceling it. If the incoming order still has quantity left after exhausting eligible opposite-side liquidity, rest the remainder as a new resting order on its own side. This is one extra conditional inside the existing matching loop, not a new data structure, so it doesn't change the algorithm's asymptotic shape.",
    code: `from collections import defaultdict

class STPOrderBook:
    def __init__(self):
        # price -> list of [order_id, account_id, qty], oldest first (time priority)
        self.bids: dict[float, list] = defaultdict(list)
        self.asks: dict[float, list] = defaultdict(list)

    def add_order(self, order_id: int, account_id: str, side: str, price: float, qty: int) -> list:
        opposite = self.asks if side == "buy" else self.bids
        crosses = (lambda level: level <= price) if side == "buy" else (lambda level: level >= price)
        trades = []

        # best price first: ascending for a buy hitting asks, descending for a sell hitting bids
        for level in sorted(opposite, reverse=(side == "sell")):
            if qty == 0 or not crosses(level):
                continue
            resting = opposite[level]
            i = 0
            while i < len(resting) and qty > 0:
                r_id, r_account, r_qty = resting[i]
                if r_account == account_id:
                    i += 1   # STP: same account -- skip this resting order untouched
                    continue
                fill = min(qty, r_qty)
                trades.append((r_id, fill))
                qty -= fill
                resting[i][2] -= fill
                if resting[i][2] == 0:
                    resting.pop(i)   # fully filled -- next element shifts into slot i
                else:
                    i += 1
            if not resting:
                del opposite[level]

        if qty > 0:
            (self.bids if side == "buy" else self.asks)[price].append([order_id, account_id, qty])
        return trades

book = STPOrderBook()
book.add_order(1, "acct_A", "buy", 100, 50)
print(book.add_order(2, "acct_A", "sell", 100, 50))   # [] -- order 1 skipped, same account
print(book.add_order(3, "acct_B", "sell", 100, 50))   # [(1, 50)]`,
    language: "python",
    complexity: {
      time: "O(P + M) per order, P = opposite price levels touched, M = orders skipped or filled",
      space: "O(number of resting orders)",
    },
  },
];
