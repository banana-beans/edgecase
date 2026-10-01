import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-01
// A k-way heap merge of multi-venue trade streams, a minimum-
// window sliding-window problem over required venues, the
// at-most-K-transactions DP stock variant, an expected-waiting-
// time Markov/probability problem for an up-day streak, and a
// price-time-priority limit order book matching engine design.
// ============================================================

export const financeBatch20261001: LeetCodeProblem[] = [
  {
    id: "lc-20261001-merge-k-venue-tapes",
    title: "Merge K Sorted Trade-Print Streams Into One Consolidated Tape",
    difficulty: "medium",
    topics: ["heap", "design"],
    problem:
      "You receive trade timestamps from k different exchange feeds, each individually sorted ascending but arriving as separate streams. Merge all k streams into one fully sorted list of timestamps representing the consolidated tape.",
    examples: [
      {
        input: "streams=[[1,4,7],[2,3,8],[5,6]]",
        output: "[1,2,3,4,5,6,7,8]",
        explanation:
          "Each input stream is already sorted on its own; the merged output interleaves all three into one globally sorted sequence.",
      },
    ],
    constraints: ["1 <= k <= 500", "0 <= total elements across all streams <= 10^5"],
    approach:
      "Push the first element of each of the k streams onto a min-heap, keyed by (value, stream_index, position_in_stream) so ties break deterministically. Repeatedly pop the smallest entry, append its value to the result, and if that stream has a next element, push it onto the heap. The heap never holds more than k entries at once -- one per stream still in play -- so each of the n total elements costs one push and one pop against a heap of size at most k, giving O(n log k) instead of the O(n log n) a full concatenate-and-sort would cost when k is much smaller than n.",
    code: `import heapq

def merge_k_streams(streams: list[list[int]]) -> list[int]:
    heap: list[tuple[int, int, int]] = []  # (value, stream_idx, position)

    for i, s in enumerate(streams):
        if s:
            heapq.heappush(heap, (s[0], i, 0))

    result: list[int] = []
    while heap:
        value, stream_idx, pos = heapq.heappop(heap)
        result.append(value)
        if pos + 1 < len(streams[stream_idx]):
            next_val = streams[stream_idx][pos + 1]
            heapq.heappush(heap, (next_val, stream_idx, pos + 1))

    return result

print(merge_k_streams([[1, 4, 7], [2, 3, 8], [5, 6]]))
# [1, 2, 3, 4, 5, 6, 7, 8]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-20261001-min-window-all-venues",
    title: "Smallest Window of Prints Containing All Required Venues",
    difficulty: "medium",
    topics: ["sliding-window", "hash-map"],
    problem:
      "Given a time-ordered list venues of venue names for consecutive trade prints, and a set required of venue names, return the length of the shortest contiguous window of prints that contains at least one print from every venue in required. Return 0 if no such window exists.",
    examples: [
      {
        input: 'venues=["NYSE","ARCA","NYSE","BATS","ARCA","NYSE"], required={"NYSE","ARCA","BATS"}',
        output: "3",
        explanation:
          'The window at indices 1..3 ("ARCA","NYSE","BATS") has length 3 and contains all three required venues. No shorter window does.',
      },
    ],
    constraints: ["1 <= venues.length <= 10^5", "1 <= required.length <= venues distinct values"],
    approach:
      "This is the minimum-window-substring pattern applied to venue names instead of characters: expand a right pointer, tracking a count per required venue seen inside the current window and a running tally of how many distinct required venues currently have a nonzero count. Once every required venue is present (the tally hits the full required count), the window is valid -- record its length, then greedily shrink from the left for as long as it stays valid, since a smaller valid window is always at least as good. Each index enters and leaves the window at most once, so the whole scan is O(n) regardless of how many times a valid window is found.",
    code: `def min_window_all_venues(venues: list[str], required: set[str]) -> int:
    need = set(required)
    counts: dict[str, int] = {}
    satisfied = 0
    best = float("inf")
    left = 0

    for right, v in enumerate(venues):
        if v in need:
            counts[v] = counts.get(v, 0) + 1
            if counts[v] == 1:
                satisfied += 1

        # shrink greedily while every required venue is still covered
        while satisfied == len(need):
            best = min(best, right - left + 1)
            left_v = venues[left]
            if left_v in need:
                counts[left_v] -= 1
                if counts[left_v] == 0:
                    satisfied -= 1
            left += 1

    return 0 if best == float("inf") else best

print(min_window_all_venues(
    ["NYSE", "ARCA", "NYSE", "BATS", "ARCA", "NYSE"],
    {"NYSE", "ARCA", "BATS"},
))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(required)" },
  },
  {
    id: "lc-20261001-max-profit-k-transactions",
    title: "Maximum Profit With At Most K Buy/Sell Transactions",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for a single stock and an integer k, you may complete at most k buy-then-sell transactions (you must sell before buying again -- no overlapping positions). Return the maximum total profit achievable.",
    examples: [
      {
        input: "prices=[3,2,6,5,0,3], k=2",
        output: "7",
        explanation:
          "Buy at 2, sell at 6 for a profit of 4. Buy at 0, sell at 3 for a profit of 3. Total: 7, achieved with exactly 2 transactions.",
      },
    ],
    constraints: ["0 <= k <= 100", "1 <= prices.length <= 1000"],
    approach:
      "If k is large enough to exceed half the number of trading days, the transaction-count limit never actually binds -- you can take every profitable up-move independently, which reduces to the unlimited-transactions variant (sum every positive day-over-day difference). Otherwise, build dp[t][i] = best profit using at most t transactions through day i, with the recurrence dp[t][i] = max(dp[t][i-1], prices[i] + max_diff), where max_diff tracks the best value of (dp[t-1][j] - prices[j]) seen so far for j < i -- effectively 'the most profit from t-1 earlier transactions, net of what today's buy-in would cost if you bought back on day j.' Rolling max_diff forward as i increases keeps each transaction layer O(n), for O(n*k) total instead of a naive O(n^2*k).",
    code: `def max_profit_k_transactions(prices: list[int], k: int) -> int:
    n = len(prices)
    if n < 2 or k == 0:
        return 0

    if k >= n // 2:
        # transaction limit no longer binds -- same as unlimited transactions
        return sum(max(prices[i] - prices[i - 1], 0) for i in range(1, n))

    dp = [[0] * n for _ in range(k + 1)]
    for t in range(1, k + 1):
        max_diff = -prices[0]   # best (dp[t-1][j] - prices[j]) seen so far
        for i in range(1, n):
            dp[t][i] = max(dp[t][i - 1], prices[i] + max_diff)
            max_diff = max(max_diff, dp[t - 1][i] - prices[i])

    return dp[k][n - 1]

print(max_profit_k_transactions([3, 2, 6, 5, 0, 3], k=2))
# 7`,
    language: "python",
    complexity: { time: "O(n*k)", space: "O(n*k)" },
  },
  {
    id: "lc-20261001-expected-days-until-up-streak",
    title: "Expected Number of Trading Days Until an L-Day Up-Streak",
    difficulty: "hard",
    topics: ["probability", "math"],
    problem:
      "A stock closes up on any given day with independent probability p, and down otherwise. Return the expected number of trading days until you first observe L consecutive up-days in a row.",
    examples: [
      {
        input: "p=0.6, L=3",
        output: "9.0741",
        explanation:
          "Plugging p=0.6 and L=3 into the closed-form expectation gives (1 - 0.6^3) / (0.4 * 0.6^3) = 0.784 / 0.0864 ~= 9.0741 days.",
      },
    ],
    constraints: ["0 < p < 1", "1 <= L <= 50"],
    approach:
      "Condition on the current streak length. Let E_k be the expected number of ADDITIONAL days needed given you're currently sitting on a streak of exactly k up-days (0 <= k < L), with E_L = 0. Each day either extends the streak (probability p, moving to state k+1) or breaks it entirely back to a streak of 0 (probability 1-p) -- note a break always resets all the way to zero, not to k-1, since any down-day kills the whole run. That gives E_k = 1 + p*E_{k+1} + (1-p)*E_0 for k < L. Solving this recursion backward from E_L=0 up to E_0 (substitute repeatedly and collect terms) yields the closed form E_0 = (1 - p^L) / ((1-p) * p^L) -- the non-obvious part is that a streak-breaking Markov chain like this always has a clean closed form because every 'failure' transition points to the SAME state (0), which is what makes the backward substitution telescope instead of requiring a full k-state linear solve.",
    code: `def expected_days_until_streak(p: float, L: int) -> float:
    # closed form from conditioning on streak length, derived by noting
    # every down-day resets the chain to the SAME state (streak 0),
    # which lets the per-state recursion telescope into one expression
    return (1 - p ** L) / ((1 - p) * p ** L)

print(round(expected_days_until_streak(0.6, 3), 4))
# 9.0741

# sanity check against the well-known L=1 case: expected days to the
# FIRST up-day at all is just the geometric-distribution mean, 1/p
print(round(expected_days_until_streak(0.6, 1), 4))
# 1.6667  ==  round(1 / 0.6, 4)`,
    language: "python",
    complexity: { time: "O(log L) for p**L via exponentiation", space: "O(1)" },
  },
  {
    id: "lc-20261001-price-time-priority-matching-engine",
    title: "Design a Price-Time-Priority Limit Order Book Matching Engine",
    difficulty: "hard",
    topics: ["design", "heap", "order-book"],
    problem:
      "Design a class OrderBook with add_limit_order(order_id, side, price, qty) that rests a limit order ('buy' or 'sell') in the book, and match_market_order(side, qty) that fills an incoming market order against the OPPOSITE side's resting orders using price-time priority: best price first, and for equal prices, the order that was added earliest. match_market_order should return the list of (order_id, filled_qty, price) fills, plus any quantity left unfilled if the book runs dry.",
    examples: [
      {
        input:
          'add_limit_order("A1","sell",101.0,100); add_limit_order("A2","sell",100.5,50); add_limit_order("A3","sell",100.5,30); match_market_order("buy", 70)',
        output: 'fills=[("A2",50,100.5),("A3",20,100.5)], unfilled=0',
        explanation:
          "A2 and A3 both rest at the best ask price 100.5, so price-time priority fills A2 first (added earlier) for its full 50, then A3 for the remaining 20 needed -- A1's worse price at 101.0 is never touched.",
      },
    ],
    constraints: ["order_id values are unique", "price, qty > 0"],
    approach:
      "Keep one min-heap for resting asks keyed by (price, insertion_sequence) and one max-heap for resting bids keyed by (-price, insertion_sequence) -- negating price turns Python's min-heap into a max-heap for the bid side. The sequence number is a monotonically increasing counter assigned at insertion, so for equal prices the heap naturally orders by time priority too. A market buy walks the ask heap from the top (best, i.e. lowest, price first); a market sell walks the bid heap from the top (best, i.e. highest, price first). Use LAZY deletion: track each order's remaining quantity in a dict, and when popping the heap's top, skip (and discard) any entry whose order is already fully filled rather than trying to remove it from the middle of the heap, which heaps don't support efficiently.",
    code: `import heapq

class OrderBook:
    def __init__(self):
        self.asks: list[tuple[float, int, str]] = []  # (price, seq, order_id)
        self.bids: list[tuple[float, int, str]] = []  # (-price, seq, order_id)
        self.remaining: dict[str, float] = {}
        self.seq = 0

    def add_limit_order(self, order_id: str, side: str, price: float, qty: float) -> None:
        self.remaining[order_id] = qty
        self.seq += 1
        if side == "buy":
            heapq.heappush(self.bids, (-price, self.seq, order_id))
        else:
            heapq.heappush(self.asks, (price, self.seq, order_id))

    def match_market_order(self, side: str, qty: float):
        book = self.asks if side == "buy" else self.bids
        fills: list[tuple[str, float, float]] = []

        while qty > 0 and book:
            price_key, seq, order_id = book[0]
            # lazy deletion: this order already has nothing left -- discard
            if self.remaining.get(order_id, 0) <= 0:
                heapq.heappop(book)
                continue

            price = price_key if side == "buy" else -price_key
            avail = self.remaining[order_id]
            trade_qty = min(qty, avail)
            fills.append((order_id, trade_qty, price))
            self.remaining[order_id] -= trade_qty
            qty -= trade_qty
            if self.remaining[order_id] == 0:
                heapq.heappop(book)

        return fills, qty  # qty here is whatever's left unfilled

book = OrderBook()
book.add_limit_order("A1", "sell", 101.0, 100)
book.add_limit_order("A2", "sell", 100.5, 50)
book.add_limit_order("A3", "sell", 100.5, 30)
print(book.match_market_order("buy", 70))
# ([('A2', 50, 100.5), ('A3', 20, 100.5)], 0)`,
    language: "python",
    complexity: { time: "O(log n) per operation, amortized over lazy deletions", space: "O(n)" },
  },
];
