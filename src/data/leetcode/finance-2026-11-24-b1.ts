import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-24
// K closest fills to a mid-price (heap), longest window with at
// most K thin-liquidity days (sliding window), buy/sell with a
// mandatory cooldown (DP), gambler's ruin for a market maker's
// capital (probability / Markov), and a price-time-priority order
// book matching engine (design).
// ============================================================

export const financeBatch20261124: LeetCodeProblem[] = [
  {
    id: "lc-20261124-k-closest-fills-to-mid-price",
    title: "K Closest Fill Prices to the Current Mid-Price",
    difficulty: "medium",
    topics: ["heap", "sorting"],
    problem:
      "Given a list of this session's fill prices (not necessarily sorted) and the current mid-price M, return the k fill prices closest to M, sorted by increasing distance from M (ties broken by the smaller price). This is used to build a quick 'recent fills near the touch' panel without re-sorting the whole fill list on every refresh.",
    examples: [
      {
        input: "fills = [101, 98, 100, 105, 99], mid = 100, k = 3",
        output: "[100, 99, 101]",
        explanation:
          "Distances from 100 are: 101->1, 98->2, 100->0, 105->5, 99->1. The three smallest distances belong to 100 (0), then a tie at distance 1 between 99 and 101, broken by the smaller price (99 before 101).",
      },
    ],
    constraints: ["1 <= fills.length <= 10^5", "1 <= k <= fills.length", "all prices are positive integers (ticks)"],
    approach:
      "Maintain a max-heap of size k keyed by (distance from mid, negative price so smaller price sorts as 'larger' for tie-breaking in a max-heap). Push each fill; whenever the heap exceeds size k, pop the worst (largest distance, or largest price on a distance tie). After one pass over all fills, the heap holds exactly the k closest. Sort those k by (distance, price) for the final ordered output. This is O(n log k) instead of sorting all n fills by distance in O(n log n), which matters once n is much larger than k.",
    code: `import heapq


def k_closest_fills(fills: list[int], mid: float, k: int) -> list[int]:
    heap = []  # max-heap via negation: (-distance, -price) so heappop removes the worst
    for price in fills:
        distance = abs(price - mid)
        entry = (-distance, -price)
        if len(heap) < k:
            heapq.heappush(heap, entry)
        elif entry > heap[0]:
            # this fill is closer (or same distance, smaller price) than our current worst
            heapq.heapreplace(heap, entry)

    # unpack and sort ascending by (distance, price) for the final panel
    closest = [(-neg_dist, -neg_price) for neg_dist, neg_price in heap]
    closest.sort()
    return [price for _, price in closest]


print(k_closest_fills([101, 98, 100, 105, 99], mid=100, k=3))
# [100, 99, 101]`,
    language: "python",
    complexity: { time: "O(n log k)", space: "O(k)" },
    leetcodeNumber: 658,
  },
  {
    id: "lc-20261124-longest-window-at-most-k-thin-liquidity-days",
    title: "Longest Window of Trading Days With At Most K Thin-Liquidity Days",
    difficulty: "medium",
    topics: ["sliding-window", "two-pointer"],
    problem:
      "Given a boolean array where True marks a trading day flagged as thin-liquidity (average daily volume below a threshold), find the length of the longest contiguous window of trading days that contains at most K thin-liquidity days. This window is used as the maximum lookback you can trust for a liquidity-sensitive feature without the result being dominated by illiquid days.",
    examples: [
      {
        input: "flags = [F, T, F, F, T, T, F], K = 1",
        output: "4",
        explanation:
          "The window [index 1..4] = [T, F, F, T] has two thin-liquidity days, too many. The window [index 1..3] = [T, F, F] has one and length 3. The best is [index 2..5] = [F, F, T, T]? That has two, too many. Actually the best valid window is indices 0..3 = [F, T, F, F], one thin-liquidity day, length 4.",
      },
    ],
    constraints: ["1 <= flags.length <= 10^5", "0 <= K <= flags.length"],
    approach:
      "Classic 'longest subarray with at most K of a flagged value' two-pointer: expand the right pointer, incrementing a running count whenever a thin-liquidity day enters the window; whenever that count exceeds K, advance the left pointer (decrementing the count as thin-liquidity days leave) until the window is valid again. Track the max window length seen at each step. Each index enters and leaves the window at most once, giving O(n) instead of checking every window boundary pair directly.",
    code: `def longest_window_at_most_k_thin_days(flags: list[bool], k: int) -> int:
    left = 0
    thin_count = 0
    best = 0

    for right, is_thin in enumerate(flags):
        if is_thin:
            thin_count += 1
        # shrink from the left while there are too many thin-liquidity days inside
        while thin_count > k:
            if flags[left]:
                thin_count -= 1
            left += 1
        best = max(best, right - left + 1)

    return best


flags = [False, True, False, False, True, True, False]
print(longest_window_at_most_k_thin_days(flags, k=1))
# 4`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261124-buy-sell-with-mandatory-cooldown",
    title: "Maximum Profit With a Mandatory Cooldown After Closing a Position",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for a stock, you may hold at most one unit at a time, and after selling you must wait exactly one full trading day before buying again (a cooldown, modeling a compliance restriction against immediately re-entering). Return the maximum achievable profit.",
    examples: [
      {
        input: "prices = [1, 2, 3, 0, 2]",
        output: "3",
        explanation:
          "Buy at index 0 (price 1), sell at index 2 (price 3) for profit 2. The cooldown blocks buying again on index 3, the day right after that sale, but index 4 (price 2) is fine to buy -- except there's no day left to sell it. The alternative of buying at index 3 (price 0) and selling at index 4 (price 2) for profit 2 is blocked outright, since index 3 is the mandatory cooldown day after selling at index 2. The best cooldown-respecting result is the single trade buy@0/sell@2, but the DP actually finds 3 by instead taking buy@0/sell@1 (profit 1) then, after a one-day cooldown's worth of spacing, buy@3/sell@4 (profit 2), for a total of 3.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000", "0 <= prices[i] <= 1000"],
    approach:
      "Track three running states per day: held (max profit if currently holding a share), sold (max profit if we just sold today, which triggers tomorrow's cooldown), and rest (max profit if holding nothing and free to buy, i.e. not in a cooldown). Transitions: held_today = max(held_yesterday, rest_yesterday - price); sold_today = held_yesterday + price; rest_today = max(rest_yesterday, sold_yesterday) (the cooldown means you can only become free-to-buy the day AFTER a sell, not the same day). The answer is max(sold, rest) on the last day, since ending while holding is never optimal. One pass, O(n) time, O(1) state.",
    code: `def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    held = float("-inf")  # max profit while holding a share
    sold = 0               # max profit on a day we just sold (triggers cooldown tomorrow)
    rest = 0                # max profit while free to buy (no cooldown active)

    for price in prices:
        prev_sold = sold
        sold = held + price                       # sell today's share
        held = max(held, rest - price)             # keep holding, or buy today
        rest = max(rest, prev_sold)                 # cooldown clears one day after a sale

    return max(sold, rest)


print(max_profit_with_cooldown([1, 2, 3, 0, 2]))
# 3`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 309,
  },
  {
    id: "lc-20261124-market-maker-gamblers-ruin",
    title: "Probability a Market Maker's Capital Hits Zero Before Reaching a Target",
    difficulty: "hard",
    topics: ["probability", "markov-chain", "math"],
    problem:
      "A market maker's capital moves by +1 unit with probability p or -1 unit with probability (1-p) on each trade, starting at capital i, with two absorbing barriers: capital 0 (ruin) and capital N (target reached, they stop trading). Return the probability of hitting 0 before N.",
    examples: [
      {
        input: "i = 5, n = 10, p = 0.5",
        output: "0.5",
        explanation:
          "This is the classic symmetric gambler's ruin problem. With p = 0.5 the walk is a fair martingale, so the ruin probability is exactly (N - i) / N = (10 - 5) / 10 = 0.5, regardless of how large N is, purely from the starting fraction of the way to the target.",
      },
    ],
    constraints: ["0 <= i <= n", "0 < p < 1, p given as a float", "1 <= n <= 10^6", "return the answer as a float"],
    approach:
      "This is the gambler's ruin problem, which has a clean closed form derived from the fact that ruin probability q_i (starting from capital i) satisfies the same type of recursion as the Markov expected-value problems above: q_i = p * q_(i+1) + (1-p) * q_(i-1), with boundary conditions q_0 = 1 (already ruined) and q_N = 0 (already at target). For p != 0.5, the solution is q_i = (r^i - r^n) / (1 - r^n) where r = (1-p)/p; for the symmetric case p = 0.5, it simplifies to q_i = (n - i) / n. Rather than memorizing the formula under pressure, derive it by recognizing the recursion is linear with constant coefficients, which is solved by a geometric ansatz q_i = r^i, same technique as solving any linear difference equation.",
    code: `def ruin_probability(i: int, n: int, p: float) -> float:
    if p == 0.5:
        # symmetric case: ruin probability is just the starting fraction to go
        return (n - i) / n

    r = (1 - p) / p
    # closed form from solving q_i = p*q_(i+1) + (1-p)*q_(i-1), q_0=1, q_n=0
    return (r**i - r**n) / (1 - r**n)


print(round(ruin_probability(i=5, n=10, p=0.5), 4))
# 0.5
print(round(ruin_probability(i=5, n=10, p=0.52), 4))
# a market maker with a slight structural edge (p > 0.5) has a lower ruin probability`,
    language: "python",
    complexity: { time: "O(1) with the closed form", space: "O(1)" },
  },
  {
    id: "lc-20261124-design-price-time-priority-order-book",
    title: "Design a Price-Time-Priority Limit Order Book Matching Engine",
    difficulty: "hard",
    topics: ["design", "heap"],
    problem:
      "Design a simplified single-instrument limit order book that supports add_order(side, price, size) -- adding a resting buy or sell limit order, matching immediately against the opposite side at crossing prices under price-then-time priority (best price first, ties broken by earlier arrival) and resting any unfilled remainder -- and best_bid_ask() -- returning the current best bid and best ask prices (or None if that side is empty).",
    examples: [
      {
        input:
          "add_order('buy', 100, 10); add_order('sell', 99, 4); add_order('sell', 101, 5); best_bid_ask()",
        output: "trades=[(100, 4)], best_bid_ask() -> (bid=100, ask=101)",
        explanation:
          "The resting buy at 100 crosses the incoming sell at 99, since 99 <= 100, so they trade. Trades execute at the RESTING order's price by convention, so this fills 4 units at 100, leaving the buy order with 6 units still resting at 100. The sell at 101 doesn't cross anything (100 < 101) and rests instead. Best bid is now 100 (6 units remaining), best ask is 101.",
      },
    ],
    constraints: [
      "up to 10^5 calls to add_order",
      "prices and sizes are positive integers",
      "side is 'buy' or 'sell'",
    ],
    approach:
      "Use two heaps: a max-heap for resting buy orders keyed by (-price, arrival_sequence) so the best (highest) price with the earliest arrival pops first, and a min-heap for resting sell orders keyed by (price, arrival_sequence) so the best (lowest) price with the earliest arrival pops first. On an incoming order, repeatedly peek the opposite heap's best resting order: while it exists and crosses (incoming buy price >= resting sell price, or incoming sell price <= resting buy price), trade the smaller of the two remaining sizes at the RESTING order's price (standard convention -- the order that was already there sets the trade price), reduce both sizes, and pop the resting order if it's now fully filled. Once nothing crosses, push any remaining incoming size onto its own side's heap. best_bid_ask() just peeks both heaps' tops (skipping any stale, fully-filled entries left at the top). Every order is pushed and popped from its heap at most once, so this is O(log n) per call amortized.",
    code: `import heapq
import itertools


class OrderBook:
    def __init__(self) -> None:
        self._seq = itertools.count()
        self.bids: list[tuple[int, int, int]] = []  # (-price, seq, size), max-heap via negation
        self.asks: list[tuple[int, int, int]] = []   # (price, seq, size), natural min-heap

    def add_order(self, side: str, price: int, size: int) -> list[tuple[int, int]]:
        trades: list[tuple[int, int]] = []  # (trade_price, trade_size)
        opposite = self.asks if side == "buy" else self.bids

        while size > 0 and opposite:
            top_price_key, top_seq, top_size = opposite[0]
            resting_price = top_price_key if side == "buy" else -top_price_key
            crosses = price >= resting_price if side == "buy" else price <= resting_price
            if not crosses:
                break

            fill = min(size, top_size)
            trades.append((resting_price, fill))  # trade happens at the RESTING price
            size -= fill
            remaining = top_size - fill
            heapq.heappop(opposite)
            if remaining > 0:
                heapq.heappush(opposite, (top_price_key, top_seq, remaining))

        if size > 0:
            seq = next(self._seq)
            if side == "buy":
                heapq.heappush(self.bids, (-price, seq, size))
            else:
                heapq.heappush(self.asks, (price, seq, size))

        return trades

    def best_bid_ask(self) -> tuple[int | None, int | None]:
        best_bid = -self.bids[0][0] if self.bids else None
        best_ask = self.asks[0][0] if self.asks else None
        return best_bid, best_ask


book = OrderBook()
book.add_order("buy", 100, 10)
print(book.add_order("sell", 99, 4))    # [(100, 4)] -- trades at the resting buy's price
print(book.add_order("sell", 101, 5))   # [] -- doesn't cross, rests instead
print(book.best_bid_ask())
# (100, 101)`,
    language: "python",
    complexity: { time: "O(log n) amortized per call", space: "O(n)" },
  },
];
