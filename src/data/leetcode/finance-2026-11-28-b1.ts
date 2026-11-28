import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-28
// The k-th largest fill size in a live stream (heap), the longest
// window where rolling VWAP stays inside a band around a reference
// price despite non-monotonic swings (sliding window/prefix-sum),
// unlimited round trips with a flat per-trade fee (DP), the expected
// number of fills until a smart order router has touched every venue
// at least once (probability/coupon collector), and a sliding-window
// rate throttle for an exchange gateway (design).
// ============================================================

export const financeBatch20261128: LeetCodeProblem[] = [
  {
    id: "lc-20261128-kth-largest-streaming-fill-size",
    title: "Kth Largest Fill Size in a Streaming Fill Feed",
    difficulty: "medium",
    topics: ["heap"],
    problem:
      "You receive a live stream of fill sizes (one positive integer per call) for a single symbol throughout the trading day. Design a KthLargestFillSize class that, given a fixed k, supports add(size), which records the new fill and returns the k-th largest fill size seen so far, or None if fewer than k fills have arrived yet -- all without re-sorting the whole history on each call.",
    examples: [
      {
        input: "k = 3; calls: add(50), add(10), add(200), add(75), add(120)",
        output: "None, None, 10, 50, 75",
        explanation:
          "After 1 or 2 fills, fewer than k=3 values exist, so the result is None. After add(200) there are 3 fills [50, 10, 200]; the 3rd largest is 10. After add(75): [200, 75, 50, 10], 3rd largest is 50. After add(120): [200, 120, 75, 50, 10], 3rd largest is 75.",
      },
    ],
    constraints: ["1 <= k <= 10^4", "add is called up to 10^5 times", "0 <= size <= 10^6"],
    approach:
      "Maintain a min-heap capped at size k: push every new size, and whenever the heap grows past k elements, pop the smallest, discarding anything that has fallen out of the top-k largest seen so far. Once the heap holds exactly k elements, its root (the smallest value currently in the heap) is, by construction, the k-th largest value among everything seen so far -- the heap holds exactly the k largest values, and the smallest of those k is precisely the k-th largest overall. This runs in O(log k) per call, versus O(n log n) to re-sort the entire history on every single call.",
    code: `import heapq


class KthLargestFillSize:
    def __init__(self, k: int) -> None:
        self.k = k
        self.heap: list[int] = []  # min-heap, capped at size k

    def add(self, size: int) -> int | None:
        heapq.heappush(self.heap, size)
        if len(self.heap) > self.k:
            heapq.heappop(self.heap)  # discard -- it's outside the top-k largest

        # until k fills have arrived, the k-th largest isn't defined yet
        return self.heap[0] if len(self.heap) == self.k else None


tracker = KthLargestFillSize(3)
for size in [50, 10, 200, 75, 120]:
    print(tracker.add(size))
# None, None, 10, 50, 75`,
    language: "python",
    complexity: { time: "O(log k) per add call", space: "O(k)" },
    leetcodeNumber: 703,
  },
  {
    id: "lc-20261128-longest-window-vwap-within-band",
    title: "Longest Window Where Rolling VWAP Stays Within a Band of a Reference Price",
    difficulty: "medium",
    topics: ["sliding-window", "prefix-sum"],
    problem:
      "Given parallel arrays prices and volumes for n consecutive minute bars, a reference_price, and a tolerance tol, find the length of the longest contiguous window of bars whose VWAP (volume-weighted average price, sum(price*volume) divided by sum(volume) over the window) lies within tol of reference_price.",
    examples: [
      {
        input: "prices = [100, 100, 300, 100, 100], volumes = [10, 10, 5, 10, 1000], reference_price = 100, tol = 5",
        output: "5",
        explanation:
          "The 1-bar and 2-bar prefixes are within [95, 105] (VWAP exactly 100). Adding the 300-priced bar pushes the 3-bar and 4-bar VWAPs to about 140 and 128.6, both outside the band -- so validity is NOT monotonic as the window grows. But the massive-volume final bar pulls the full 5-bar VWAP back down to about 100.97, inside the band again, so the whole array qualifies.",
      },
    ],
    constraints: ["2 <= n <= 2000", "0 <= prices[i] <= 10^6", "1 <= volumes[i] <= 10^6", "tol > 0"],
    approach:
      "Precompute prefix sums of price*volume and of volume so any window's total weighted price and total volume -- and therefore its VWAP -- can be read off in O(1). The tempting shortcut is a two-pointer sliding window that shrinks from the left whenever the current window's VWAP falls outside the band, but that technique only gives the correct answer when validity is monotonic in the left pointer for a fixed right pointer -- and VWAP-within-a-band is NOT monotonic in general: a window can be valid, become invalid once extended by an extreme-priced low-volume bar, and become valid again once a later huge-volume bar dilutes that extreme price back toward the reference, exactly as in the example above. So the safe approach is to check every window directly (O(n^2) total, O(1) per window via the prefix sums) rather than assume a sliding-window invariant that doesn't actually hold for this predicate.",
    code: `def longest_window_vwap_in_band(
    prices: list[int],
    volumes: list[int],
    reference_price: float,
    tol: float,
) -> int:
    n = len(prices)
    cum_pv = [0.0] * (n + 1)   # prefix sum of price * volume
    cum_vol = [0.0] * (n + 1)  # prefix sum of volume
    for i in range(n):
        cum_pv[i + 1] = cum_pv[i] + prices[i] * volumes[i]
        cum_vol[i + 1] = cum_vol[i] + volumes[i]

    best = 0
    for left in range(n):
        for right in range(left, n):
            window_vol = cum_vol[right + 1] - cum_vol[left]
            window_pv = cum_pv[right + 1] - cum_pv[left]
            vwap = window_pv / window_vol
            # VWAP-in-band is NOT monotonic as the window grows (see approach),
            # so every window must be checked -- no safe early break here
            if abs(vwap - reference_price) <= tol:
                best = max(best, right - left + 1)

    return best


prices = [100, 100, 300, 100, 100]
volumes = [10, 10, 5, 10, 1000]
print(longest_window_vwap_in_band(prices, volumes, reference_price=100, tol=5))
# 5`,
    language: "python",
    complexity: { time: "O(n^2) worst case (O(1) per window via prefix sums)", space: "O(n)" },
  },
  {
    id: "lc-20261128-max-profit-unlimited-transactions-fee",
    title: "Maximum Profit With Unlimited Round Trips and a Flat Fee Per Trade",
    difficulty: "medium",
    topics: ["dynamic-programming", "greedy"],
    problem:
      "Given daily prices for a stock and a flat transaction fee charged once per completed round trip (buy then sell), with unlimited round trips allowed (holding at most one unit at a time), return the maximum total profit achievable.",
    examples: [
      {
        input: "prices = [1, 3, 2, 8, 4, 9], fee = 2",
        output: "8",
        explanation:
          "Buy at 1, sell at 8: profit 7 minus fee 2 = 5. Buy at 4, sell at 9: profit 5 minus fee 2 = 3. Total 5 + 3 = 8, better than any other combination of round trips once the fee is accounted for.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i], fee <= 10^4"],
    approach:
      "Track two running states day by day instead of a 2D table: cash (max profit if currently holding nothing) and hold (max profit if currently holding one unit, net of what was paid for it). Each day, cash either stays the same or comes from selling what's held today (hold + price - fee); hold either stays the same or comes from buying today (cash - price). Charging the fee on the SELL transition, rather than the buy, keeps it simple and avoids double-charging across the round trip. This runs in O(n) time and O(1) extra space -- the same shape as every other max-profit-with-a-constraint variant in this family, just with a different per-transition adjustment.",
    code: `def max_profit_with_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    cash = 0              # profit so far, holding nothing
    hold = -prices[0]     # profit so far, holding one unit bought on day 0

    for price in prices[1:]:
        cash = max(cash, hold + price - fee)   # sell today, pay the fee once
        hold = max(hold, cash - price)         # buy today

    return cash


print(max_profit_with_fee([1, 3, 2, 8, 4, 9], fee=2))
# 8`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 714,
  },
  {
    id: "lc-20261128-expected-fills-coupon-collector-venues",
    title: "Expected Number of Fills Until a Smart Order Router Has Touched Every Venue",
    difficulty: "hard",
    topics: ["probability", "math"],
    problem:
      "A smart order router sends each child order to one of n venues, chosen uniformly at random and independently each time (with replacement), until every venue has received at least one fill. Given n, return the expected number of fills needed until all n venues have been touched at least once, as a float.",
    examples: [
      {
        input: "n = 4",
        output: "8.3333",
        explanation:
          "This is the coupon collector's problem: expected time = n times the n-th harmonic number H_n. For n=4, H_4 = 1 + 1/2 + 1/3 + 1/4 = 25/12, so expected fills = 4 * 25/12 = 25/3, about 8.3333.",
      },
    ],
    constraints: ["1 <= n <= 10^5"],
    approach:
      "This is the coupon collector's problem in a trading disguise. Decompose the waiting time into n stages: stage k is the time spent after exactly k-1 distinct venues have already been touched, waiting for a NEW venue (one of the remaining n-k+1 untouched venues) to be hit. Each fill in stage k lands on a new venue with probability (n-k+1)/n, so the stage length is geometrically distributed with that success probability, giving expectation n/(n-k+1). Summing over k from 1 to n gives n times the sum of 1/j for j from 1 to n -- n times the n-th harmonic number. The harmonic number has no simple closed form but is cheap to sum directly for these input sizes; for very large n you'd reach for the ln(n) plus Euler-Mascheroni-constant approximation instead of summing term by term.",
    code: `def expected_fills_to_touch_every_venue(n: int) -> float:
    if n <= 0:
        return 0.0

    # harmonic number H_n = sum of 1/k for k = 1..n
    harmonic = sum(1.0 / k for k in range(1, n + 1))
    return n * harmonic


print(round(expected_fills_to_touch_every_venue(4), 4))
# 8.3333`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261128-design-sliding-window-rate-throttle",
    title: "Design a Sliding-Window Order-Rate Throttle for an Exchange Gateway",
    difficulty: "medium",
    topics: ["design", "queue", "sliding-window"],
    problem:
      "Design an OrderRateThrottle that enforces a limit of at most max_orders new orders in any trailing window_ms millisecond window, to stay under an exchange gateway's rate limit. Implement allow(timestamp_ms), called with non-decreasing timestamps, which returns True and records the order if sending it would NOT push the trailing window over the limit, or returns False (without recording it) otherwise.",
    examples: [
      {
        input: "max_orders=3, window_ms=1000; calls: allow(0), allow(200), allow(500), allow(900), allow(1100)",
        output: "True, True, True, False, True",
        explanation:
          "The first 3 calls (t=0,200,500) are all accepted, reaching the limit of 3. At t=900, accepting would mean 4 orders (0,200,500,900) inside the trailing 1000ms window, so it's rejected and not recorded. At t=1100, the order at t=0 has aged out of the trailing window, leaving only 200 and 500 recorded, so a new order fits under the limit of 3 and is accepted.",
      },
    ],
    constraints: [
      "timestamps passed to allow are non-decreasing",
      "1 <= max_orders <= 10^4",
      "1 <= window_ms <= 10^5",
      "up to 10^5 calls to allow",
    ],
    approach:
      "Keep a deque of the timestamps of previously ACCEPTED orders, oldest first. On each call, first evict from the front of the deque every timestamp that has aged out of the trailing window (at or before timestamp_ms - window_ms); since timestamps only increase and the deque stays sorted, that's a simple while-loop from the front with no need to rescan everything. After evicting, if the deque's remaining length has already reached max_orders, the new order would push the window over the limit, so reject it without adding it to the deque. Otherwise accept it and append its timestamp. Because eviction only removes from the front and the deque grows by at most one per accepted call, this runs in O(1) amortized per call rather than O(window size) per call from rescanning a fixed buffer every time.",
    code: `from collections import deque


class OrderRateThrottle:
    def __init__(self, max_orders: int, window_ms: int) -> None:
        self.max_orders = max_orders
        self.window_ms = window_ms
        self.accepted: deque[int] = deque()  # timestamps of accepted orders, sorted

    def allow(self, timestamp_ms: int) -> bool:
        cutoff = timestamp_ms - self.window_ms
        # evict everything that's aged out of the trailing window
        while self.accepted and self.accepted[0] <= cutoff:
            self.accepted.popleft()

        if len(self.accepted) >= self.max_orders:
            return False  # sending now would exceed the rate limit

        self.accepted.append(timestamp_ms)
        return True


throttle = OrderRateThrottle(max_orders=3, window_ms=1000)
for t in [0, 200, 500, 900, 1100]:
    print(throttle.allow(t))
# True, True, True, False, True`,
    language: "python",
    complexity: { time: "O(1) amortized per call", space: "O(max_orders)" },
  },
];
