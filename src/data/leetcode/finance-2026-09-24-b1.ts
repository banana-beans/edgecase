import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-09-24
// A max-heap "k closest to a reference price" problem, a
// variable-size sliding window over volume, a buy/sell-with-
// cooldown DP, an expected-hitting-time Markov chain problem,
// and a price-time-priority limit order book design.
// ============================================================

export const financeBatch20260924: LeetCodeProblem[] = [
  {
    id: "lc-20260924-k-closest-trades-reference-price",
    title: "K Closest Trades to a Reference Price",
    difficulty: "medium",
    topics: ["heap", "sorting"],
    problem:
      "Given an array of trade prices and a reference price, return the k trade prices closest to the reference price, in any order. If two prices are equally close, the smaller one is considered closer.",
    examples: [
      {
        input: "prices=[10, 7, 13, 9, 15], ref=10, k=2",
        output: "[9, 10]",
        explanation:
          "Distances from 10: |10-10|=0, |7-10|=3, |13-10|=3, |9-10|=1, |15-10|=5. The two closest are 10 (distance 0) and 9 (distance 1).",
      },
    ],
    constraints: ["1 <= k <= len(prices)", "prices and ref fit in a 32-bit int", "prices may contain duplicates"],
    approach:
      "Maintain a size-k max-heap of the 'worst' candidates kept so far, keyed so the top is always the entry that should be evicted first: largest distance, and on a distance tie, the larger price (since the problem prefers the smaller price on ties). Since heapq is a min-heap, store each candidate as (-distance, -price) -- the most negative entry then corresponds to the largest true distance/price, so it naturally sits at the top for eviction. For each price: push if the heap has room; otherwise compare against the current worst and swap it in only if the new candidate is strictly better. This runs in O(n log k) instead of sorting the whole array in O(n log n).",
    code: `import heapq

def k_closest_trades(prices: list[int], ref: int, k: int) -> list[int]:
    heap: list[tuple[int, int]] = []  # (-distance, -price): min-heap acts as a size-k max-heap of "worst" kept

    for p in prices:
        dist = abs(p - ref)
        entry = (-dist, -p)
        if len(heap) < k:
            heapq.heappush(heap, entry)
        elif entry > heap[0]:
            # candidate is closer (or same distance, smaller price) than
            # the current worst kept entry -- swap it in
            heapq.heapreplace(heap, entry)

    return sorted(-p for _, p in heap)

print(k_closest_trades([10, 7, 13, 9, 15], ref=10, k=2))
# [9, 10]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
  },
  {
    id: "lc-20260924-longest-window-volume-cap",
    title: "Longest Trading Window With Cumulative Volume Under a Cap",
    difficulty: "medium",
    topics: ["sliding-window", "two-pointer"],
    problem:
      "Given an array of per-minute trade volumes and a maximum volume cap, return the length of the longest contiguous window of minutes whose total volume does not exceed the cap.",
    examples: [
      {
        input: "volumes=[100, 50, 100, 50, 100], cap=250",
        output: "3",
        explanation:
          "The window [100, 50, 100] (indices 2-4) sums to 250, exactly at the cap, and is the longest such window.",
      },
    ],
    constraints: ["1 <= len(volumes) <= 10^5", "volumes[i] >= 0", "0 <= cap <= 10^9"],
    approach:
      "Because every volume is non-negative, a classic variable-size two-pointer window works: expand the right edge, adding its volume to a running sum, and whenever the sum exceeds the cap, shrink from the left, subtracting volumes until the window is valid again. Track the best window length seen. Each index enters and leaves the window at most once, so the whole scan is O(n) despite the nested-looking while loop -- this only works because volumes can't be negative, which guarantees the running sum is monotonic in window size.",
    code: `def longest_window_under_cap(volumes: list[int], cap: int) -> int:
    left = 0
    window_sum = 0
    best = 0

    for right, v in enumerate(volumes):
        window_sum += v
        # shrink from the left until the window is valid again -- safe
        # because volumes are non-negative, so window_sum only grows
        # as right advances and only shrinks as left advances
        while window_sum > cap:
            window_sum -= volumes[left]
            left += 1
        best = max(best, right - left + 1)

    return best

print(longest_window_under_cap([100, 50, 100, 50, 100], cap=250))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260924-best-time-with-cooldown",
    title: "Best Time to Buy and Sell Stock With Cooldown",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices, you may complete as many non-overlapping buy-then-sell round trips as you like, but after selling you must wait one full day (cooldown) before buying again. Return the maximum achievable profit.",
    examples: [
      {
        input: "prices=[1, 2, 3, 0, 2]",
        output: "3",
        explanation:
          "Buy day0 (1), sell day1 (2): profit 1. Cooldown day2. Buy day3 (0), sell day4 (2): profit 2. Total 1+2=3.",
      },
    ],
    constraints: ["0 <= prices.length <= 10^5", "0 <= prices[i] <= 10^5"],
    approach:
      "Track three running scalars instead of a full DP table: hold (best profit while currently holding a share), sold (best profit on a day you just sold, which triggers the cooldown for tomorrow), and rest (best profit while not holding and not on cooldown, free to buy). Each day, update using the PREVIOUS day's values: a new hold can come from staying in the position or buying from rest (not from sold, since sold triggers cooldown first); a new sold comes from hold plus today's price; a new rest comes from staying in rest or graduating out of yesterday's cooldown. The final answer is the better of sold and rest, since ending while holding is never optimal.",
    code: `def max_profit_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    hold = float("-inf")
    sold = 0
    rest = 0

    for price in prices:
        prev_sold = sold
        # order matters: sold and hold both read yesterday's rest/hold
        # before rest is updated to reflect today
        sold = hold + price
        hold = max(hold, rest - price)
        rest = max(rest, prev_sold)

    return max(sold, rest)

print(max_profit_cooldown([1, 2, 3, 0, 2]))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20260924-expected-rounds-to-absorption",
    title: "Expected Number of Rounds to Hit a Profit Target or Stop-Out",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "A trader starts with i units of capital (integer). Each round, capital increases by 1 with probability p and decreases by 1 with probability 1-p. Trading stops when capital hits 0 (stop-out) or N (profit target). Return the expected number of rounds until trading stops, given starting capital i, target N, and win probability p.",
    examples: [
      {
        input: "i=2, N=4, p=0.5",
        output: "4.0",
        explanation:
          "For a fair coin, the classic result for expected absorption time of a symmetric random walk on {0..N} is i*(N-i) = 2*(4-2) = 4.",
      },
    ],
    constraints: ["0 <= i <= N <= 10^4", "0 < p < 1"],
    approach:
      "This is a different quantity from the probability of reaching N first: here we want the expected DURATION of an absorbing random walk with boundaries at 0 and N. For the symmetric case p=0.5, the closed form is the classic E[i] = i*(N-i), since capital is a martingale and the expected time follows a parabola in i. For the asymmetric case p != 0.5, the standard closed form is E[i] = i/(q-p) - (N/(q-p)) * (1 - r^i)/(1 - r^N), where q=1-p and r=q/p -- derived by solving the second-order linear recurrence E[i] = 1 + p*E[i+1] + q*E[i-1] with boundary conditions E[0]=E[N]=0. Using the closed form avoids setting up and solving an (N-1)x(N-1) linear system directly.",
    code: `def expected_rounds_to_absorption(i: int, N: int, p: float) -> float:
    if i <= 0 or i >= N:
        return 0.0

    if abs(p - 0.5) < 1e-12:
        return float(i * (N - i))   # symmetric walk: expected time is a parabola in i

    q = 1 - p
    r = q / p
    return i / (q - p) - (N / (q - p)) * (1 - r**i) / (1 - r**N)

print(expected_rounds_to_absorption(i=2, N=4, p=0.5))
# 4.0
print(round(expected_rounds_to_absorption(i=2, N=4, p=0.4), 4))
# an asymmetric, unfavorable-odds walk hits an absorbing state faster on average`,
    language: "python",
    complexity: { time: "O(1) with the closed form", space: "O(1)" },
  },
  {
    id: "lc-20260924-limit-order-book-price-time-priority",
    title: "Design a Limit Order Book With Price-Time Priority",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design a class LimitOrderBook supporting add_order(order_id, side, price, size), which matches the incoming order against resting orders on the opposite side using price-time priority (best price first, ties broken by earliest arrival), partially or fully filling it and resting any unfilled remainder, and cancel(order_id), which removes an order's remaining resting quantity. Track all fills as (resting_order_id, incoming_order_id, price, size) tuples.",
    examples: [
      {
        input:
          'add_order(1,"SELL",101,50); add_order(2,"BUY",101,30); add_order(3,"BUY",102,40)',
        output: "fills = [(1, 2, 101, 30), (1, 3, 101, 20)]",
        explanation:
          "Order 2 fills 30 of order 1's resting 50 at 101. Order 3 then fills order 1's remaining 20 at 101 (price-time priority: the resting order fills before order 3 rests its own 20 remaining shares at 102).",
      },
    ],
    constraints: ["order_ids are unique while active", "prices and sizes are positive integers", "a BUY only matches a resting SELL priced at or below it; a SELL only matches a resting BUY priced at or above it"],
    approach:
      "Keep two heaps of resting orders: a max-heap of bids (store negated price so the highest bid sorts first) and a min-heap of asks, each ordered by (price_key, arrival_sequence, order_id) so earlier orders at the same price win ties. Track each order's remaining size in a dict. An incoming order walks the opposite heap: while it still has size left and the best resting price crosses its own limit price, fill the minimum of the two remaining sizes, record the fill, and lazily pop any resting order whose remaining size has hit zero (lazy deletion, since a heap can't cheaply remove an arbitrary interior element). Any size left after the walk rests on the order's own side. Cancellation just zeroes out the remaining size in the dict; the stale heap entry is purged the next time it's touched.",
    code: `import heapq

class LimitOrderBook:
    def __init__(self):
        self.bids: list[tuple[int, int, int]] = []   # max-heap: (-price, seq, order_id)
        self.asks: list[tuple[int, int, int]] = []    # min-heap: (price, seq, order_id)
        self.remaining: dict[int, int] = {}            # order_id -> resting shares left
        self.seq = 0
        self.fills: list[tuple[int, int, int, int]] = []  # (resting_id, incoming_id, price, size)

    def add_order(self, order_id: int, side: str, price: int, size: int):
        self.seq += 1
        self.remaining[order_id] = size
        opposite = self.asks if side == "BUY" else self.bids

        while self.remaining[order_id] > 0 and opposite:
            top_key, _, resting_id = opposite[0]
            resting_price = top_key if side == "BUY" else -top_key
            crosses = (side == "BUY" and resting_price <= price) or (side == "SELL" and resting_price >= price)
            if not crosses:
                break
            if self.remaining[resting_id] == 0:
                heapq.heappop(opposite)   # stale: already filled or cancelled -- lazy delete
                continue
            fill_size = min(self.remaining[order_id], self.remaining[resting_id])
            self.remaining[order_id] -= fill_size
            self.remaining[resting_id] -= fill_size
            self.fills.append((resting_id, order_id, resting_price, fill_size))
            if self.remaining[resting_id] == 0:
                heapq.heappop(opposite)

        if self.remaining[order_id] > 0:
            own_book = self.bids if side == "BUY" else self.asks
            key = -price if side == "BUY" else price
            heapq.heappush(own_book, (key, self.seq, order_id))

    def cancel(self, order_id: int):
        self.remaining[order_id] = 0   # lazy delete: heap entry purged on next touch

book = LimitOrderBook()
book.add_order(1, "SELL", 101, 50)
book.add_order(2, "BUY", 101, 30)
book.add_order(3, "BUY", 102, 40)
print(book.fills)
# [(1, 2, 101, 30), (1, 3, 101, 20)]`,
    language: "python",
    complexity: { time: "O(log n) amortized per call", space: "O(n)" },
  },
];
