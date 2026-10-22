import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-10-22
// Kth largest trade size (heap), longest run of trades with no
// repeated counterparty (sliding window), max profit allowing
// short selling (DP stock variant), expected trades until K
// consecutive wins (probability/Markov), and a trade blotter
// supporting insert plus timestamp range queries (design).
// ============================================================

export const financeBatch20261022: LeetCodeProblem[] = [
  {
    id: "lc-20261022-kth-largest-trade-size-stream",
    title: "Kth Largest Trade Size in a Streaming Order Flow",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "You receive trade sizes one at a time from a live feed. Implement a class that supports add(size) and returns the kth largest trade size seen so far after every addition, for a fixed k decided at construction time.",
    examples: [
      {
        input: "k = 3; add(4); add(5); add(8); add(2); add(10)",
        output: "None, None, 4, 4, 5",
        explanation:
          "The 3rd largest only exists once 3 trades have arrived. After [4,5,8] it's 4. Adding 2 doesn't change it (still 4). Adding 10 makes the top three [10,8,5], so the 3rd largest becomes 5.",
      },
    ],
    constraints: ["1 <= k <= 10^4", "up to 10^5 calls to add"],
    approach:
      "Keep a min-heap capped at size k holding the k largest sizes seen so far -- the heap's root (the smallest of those k) is exactly the kth largest overall. On each add, push the new size, and if the heap now exceeds size k, pop the smallest off, restoring the invariant in O(log k). Once the heap has fewer than k elements there is no kth largest yet, so return None.",
    code: `import heapq

class KthLargest:
    def __init__(self, k: int):
        self.k = k
        self.heap: list[float] = []   # min-heap of the k largest sizes seen so far

    def add(self, size: float) -> float | None:
        heapq.heappush(self.heap, size)
        if len(self.heap) > self.k:
            heapq.heappop(self.heap)   # evict the smallest of the current top-k
        if len(self.heap) < self.k:
            return None                # fewer than k trades have arrived yet
        return self.heap[0]            # root of a size-k min-heap is the kth largest

tracker = KthLargest(k=3)
for size in [4, 5, 8, 2, 10]:
    print(tracker.add(size))
# None, None, 4, 4, 5`,
    language: "python",
    complexity: { time: "O(log k) per add", space: "O(k)" },
  },
  {
    id: "lc-20261022-longest-run-no-repeated-counterparty",
    title: "Longest Contiguous Run of Trades With No Repeated Counterparty",
    difficulty: "medium",
    topics: ["sliding-window"],
    problem:
      "Given a list of counterparty IDs for trades in execution order, return the length of the longest contiguous run of trades in which no counterparty appears more than once (a settlement-risk limit: you don't want too much exposure concentrated in one name within a short window).",
    examples: [
      {
        input: 'counterparties = ["A", "B", "C", "A", "D"]',
        output: "4",
        explanation:
          'The window ["B", "C", "A", "D"] has length 4 with every counterparty appearing once; the first "A" has to drop out of the window once a second "A" shows up.',
      },
    ],
    constraints: ["1 <= counterparties.length <= 10^5"],
    approach:
      "This is the classic longest-substring-without-repeats pattern applied to counterparty IDs instead of characters. Keep a hashmap of each counterparty's most recent index and a left pointer marking the start of the current valid window. For each right index, if the current counterparty was last seen at or after left, jump left to just past that previous occurrence -- collapsing the window just enough to drop the repeat, not further. Track the best right-left+1 seen. Each counterparty's last-seen index only ever gets looked up and updated once per visit, so the whole scan is O(n).",
    code: `def longest_run_no_repeat_counterparty(counterparties: list[str]) -> int:
    last_seen: dict[str, int] = {}
    left = 0
    best = 0

    for right, cp in enumerate(counterparties):
        if cp in last_seen and last_seen[cp] >= left:
            # jump left just past the previous occurrence of this counterparty
            left = last_seen[cp] + 1
        last_seen[cp] = right
        best = max(best, right - left + 1)

    return best

print(longest_run_no_repeat_counterparty(["A", "B", "C", "A", "D"]))
# 4`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-20261022-max-profit-with-shorting-allowed",
    title: "Maximum Profit With Unlimited Transactions, Short Selling Allowed",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for one instrument, you may hold at most one unit of exposure at any time, but that exposure can be long (+1), short (-1), or flat (0), and you may flip position as many times as you like at the day's price with no fees. Return the maximum achievable profit.",
    examples: [
      {
        input: "prices = [5, 3, 8, 2, 9]",
        output: "20",
        explanation:
          "Flip position every day to always be on the right side of the next move: short 5->3 (+2), long 3->8 (+5), short 8->2 (+6), long 2->9 (+7). Total 2+5+6+7=20 -- exactly the sum of each day's absolute price move, since a free, instant flip lets you capture every single one.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5"],
    approach:
      "Track three running states day by day: flat_profit (holding nothing), long_profit (holding a long unit), and short_profit (holding a short unit). Each day, first update flat_profit from yesterday's long or short by closing out at today's price; then -- using that SAME day's just-updated flat_profit, not yesterday's -- update long_profit and short_profit by opening a fresh position at today's price. Reusing today's flat_profit rather than yesterday's is what allows a sell-then-immediately-buy (or cover-then-immediately-short) round trip on the very same day, which is exactly what a free, instant flip requires; using yesterday's flat_profit instead would silently impose a one-day cooldown between flips.",
    code: `def max_profit_with_shorting(prices: list[int]) -> int:
    flat = 0
    long_pos = float("-inf")    # profit so far if currently holding long
    short_pos = float("-inf")   # profit so far if currently holding short

    for price in prices:
        prev_long, prev_short = long_pos, short_pos
        # close out yesterday's long or short at today's price
        flat = max(flat, prev_long + price, prev_short - price)
        # open a fresh position using TODAY's flat (not yesterday's) -- this
        # same-day reuse is what allows a free flip every single day
        long_pos = max(prev_long, flat - price)
        short_pos = max(prev_short, flat + price)

    return int(flat)

print(max_profit_with_shorting([5, 3, 8, 2, 9]))
# 20`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261022-expected-trades-until-k-consecutive-wins",
    title: "Expected Number of Trades Until K Consecutive Winning Trades",
    difficulty: "hard",
    topics: ["probability"],
    problem:
      "Each trade independently wins with probability p. Given a target streak length k, return the expected number of trades needed until you observe k wins in a row for the first time.",
    examples: [
      {
        input: "p = 0.5, k = 2",
        output: "6.0",
        explanation:
          "The classic 'expected flips until two heads in a row' result for a fair coin is 6.",
      },
    ],
    constraints: ["0 < p < 1", "1 <= k <= 40"],
    approach:
      "Model this as a Markov chain on the current win-streak length, states 0 through k-1, with state k absorbing. Let E_i be the expected additional trades needed from streak state i. From state i, one trade either extends the streak to i+1 with probability p, or resets the streak to 0 with probability 1-p: E_i = 1 + p*E_(i+1) + (1-p)*E_0, with E_k = 0. Solving this system in closed form for the k=2 case gives E_0 = 1/p + 1/p^2, and it generalizes cleanly: E_0 = sum_{i=1}^{k} (1/p)^i, a geometric-style sum reflecting that each additional required consecutive win multiplies the expected wait by roughly another factor of 1/p, since a longer streak is disproportionately harder to sustain all the way to the end, not just marginally harder.",
    code: `def expected_trades_until_k_wins(p: float, k: int) -> float:
    # closed form: E_0 = sum_{i=1}^{k} (1/p)^i, generalizing the two-state
    # (k=2) case E_0 = 1/p + 1/p^2 to an arbitrary target streak length
    inv_p = 1 / p
    return sum(inv_p ** i for i in range(1, k + 1))

print(expected_trades_until_k_wins(0.5, k=2))
# 6.0

print(round(expected_trades_until_k_wins(0.5, k=3), 2))
# requiring one more consecutive win roughly doubles the expected wait at p=0.5,
# since each extra required win in the streak multiplies the tail by about 1/p`,
    language: "python",
    complexity: { time: "O(k)", space: "O(1)" },
  },
  {
    id: "lc-20261022-design-trade-blotter-range-query",
    title: "Design a Trade Blotter Supporting Insert and Timestamp Range Queries",
    difficulty: "medium",
    topics: ["design"],
    problem:
      "Design a class TradeBlotter supporting record(timestamp, trade_id) where timestamps arrive out of order, and trades_between(start, end) returning the list of trade_ids with a timestamp in [start, end], in timestamp order.",
    examples: [
      {
        input:
          "record(100,'t1'); record(50,'t2'); record(150,'t3'); trades_between(60,120)",
        output: "['t1']",
        explanation:
          "Only t1's timestamp (100) falls within [60, 120]; t2 (50) is too early and t3 (150) is too late.",
      },
    ],
    constraints: ["up to 10^5 total operations"],
    approach:
      "Keep a single list of (timestamp, trade_id) pairs maintained in sorted order by timestamp, using the bisect module to find the correct insertion point for each new record in O(log n) and insert it there in O(n) due to the underlying list shift -- acceptable for a blotter where inserts are far less frequent than range-query reads in practice. A range query then does two binary searches (bisect_left for start, bisect_right for end) to find the slice boundaries directly, returning that slice in O(log n + m) where m is the number of matching trades, with no linear scan of the whole blotter required.",
    code: `import bisect

class TradeBlotter:
    def __init__(self):
        self.timestamps: list[int] = []
        self.trade_ids: list[str] = []

    def record(self, timestamp: int, trade_id: str) -> None:
        # find the sorted insertion point, then insert into both parallel lists
        idx = bisect.bisect_left(self.timestamps, timestamp)
        self.timestamps.insert(idx, timestamp)
        self.trade_ids.insert(idx, trade_id)

    def trades_between(self, start: int, end: int) -> list[str]:
        lo = bisect.bisect_left(self.timestamps, start)
        hi = bisect.bisect_right(self.timestamps, end)
        return self.trade_ids[lo:hi]

blotter = TradeBlotter()
blotter.record(100, "t1")
blotter.record(50, "t2")
blotter.record(150, "t3")
print(blotter.trades_between(60, 120))
# ['t1']`,
    language: "python",
    complexity: { time: "O(log n) query, O(n) insert", space: "O(n)" },
  },
];
