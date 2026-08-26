import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-26
// A task-scheduler variant for venue-throttled order routing, a
// container-with-most-water variant for order-book notional, a
// coin-change variant for hitting an exact target position size,
// reservoir sampling for an unbounded trade stream, and a sliding-
// window design for exchange order-rate throttling.
// ============================================================

export const financeBatch20260826: LeetCodeProblem[] = [
  {
    id: "lc-venue-cooldown-order-scheduler",
    title: "Order Routing Scheduler with Per-Venue Cooldown",
    difficulty: "medium",
    topics: ["heap", "greedy"],
    problem:
      "You have a batch of child orders to route, each tagged with a destination venue. Because of exchange throttling rules, once you send an order to a given venue you must wait a cooldown of c time slots before sending another order to that SAME venue (orders to other venues are unaffected). Each time slot you may send exactly one order (or idle). Return the minimum number of time slots needed to send every order, respecting the cooldown per venue.",
    examples: [
      {
        input: 'orders = ["NYSE","NYSE","NYSE","NASDAQ","NASDAQ","NASDAQ"], cooldown = 2',
        output: "8",
        explanation:
          "One valid order is NYSE, NASDAQ, idle, NYSE, NASDAQ, idle, NYSE, NASDAQ -- the busiest venue (NYSE, sent 3 times) forces at least two idle slots between its repeats, and NASDAQ having the same count means no idle slot can be filled by it either.",
      },
    ],
    constraints: ["1 <= number of orders <= 10^4", "0 <= cooldown <= 100"],
    approach:
      "This is the classic 'task scheduler' problem: only the single MOST FREQUENT venue's repeat count actually constrains the schedule length, because the cooldown between its own repeats creates a fixed skeleton of gaps that every less-frequent venue's orders (or idle slots, if nothing else fits) get slotted into. Count how many venues tie for the maximum frequency, then the minimum slots is (max_count - 1) * (cooldown + 1) + num_venues_at_max: the '-1' because the LAST occurrence of the busiest venue needs no trailing cooldown, '(cooldown+1)' is the size of one full cooldown-plus-slot block, and 'num_venues_at_max' accounts for every venue tied for busiest getting one slot in the final block. If there are enough other distinct venues to fill every gap with real orders instead of idling, the true answer can never be shorter than simply the total order count, so the answer is the max of the two.",
    code: `from collections import Counter

def min_slots_to_route(orders: list[str], cooldown: int) -> int:
    counts = Counter(orders)
    max_count = max(counts.values())
    num_at_max = sum(1 for c in counts.values() if c == max_count)

    # skeleton built from the busiest venue's own cooldown gaps, plus one
    # slot per tied-for-busiest venue in the final block
    skeleton_slots = (max_count - 1) * (cooldown + 1) + num_at_max

    # if there are enough other orders to fill every gap, the true minimum
    # is just the total order count -- the skeleton only matters when idling
    # would otherwise be unavoidable
    return max(skeleton_slots, len(orders))

orders = ["NYSE", "NYSE", "NYSE", "NASDAQ", "NASDAQ", "NASDAQ"]
print(min_slots_to_route(orders, cooldown=2))   # 8`,
    language: "python",
    complexity: { time: "O(n)", space: "O(number of distinct venues)" },
  },
  {
    id: "lc-max-notional-between-two-levels",
    title: "Maximum Fillable Notional Between Two Price Levels (Container With Most Water variant)",
    difficulty: "medium",
    topics: ["two-pointers", "greedy"],
    problem:
      "An order book snapshot gives you the available resting size at n discrete price levels (indexed by level, not by actual price). Choose two distinct levels i and j to represent a synthetic buy-low-sell-high pair, where the notional captured between them is min(size[i], size[j]) * (j - i) -- the smaller of the two sizes (the binding constraint) times the distance between the levels. Find the maximum notional capturable over any pair of levels.",
    examples: [
      {
        input: "sizes = [1,8,6,2,5,4,8,3,7]",
        output: "49",
        explanation:
          "Levels at index 1 (size 8) and index 8 (size 7) give min(8,7) * (8-1) = 7*7 = 49, which is the maximum over all pairs.",
      },
    ],
    constraints: ["2 <= n <= 10^5", "0 <= size[i] <= 10^4"],
    approach:
      "This is the 'container with most water' pattern: start two pointers at the outer ends of the array, where the distance term is largest, and greedily move whichever pointer points at the SMALLER size inward. That greedy move is safe: the current pair's value is capped by the smaller of the two sizes, so keeping the smaller-size pointer fixed and only shrinking the width can never beat the current value with that same size as the bottleneck -- only moving the smaller-size pointer has any chance of finding a taller bottleneck to beat it. This gives an O(n) single pass instead of the O(n^2) brute force of checking every pair.",
    code: `def max_fillable_notional(sizes: list[int]) -> int:
    left, right = 0, len(sizes) - 1
    best = 0

    while left < right:
        width = right - left
        bottleneck = min(sizes[left], sizes[right])
        best = max(best, bottleneck * width)

        # only the smaller side can possibly improve the bottleneck --
        # moving the larger side can only shrink width with no upside
        if sizes[left] < sizes[right]:
            left += 1
        else:
            right -= 1

    return best

print(max_fillable_notional([1, 8, 6, 2, 5, 4, 8, 3, 7]))   # 49`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-min-trades-target-position",
    title: "Minimum Trades to Reach a Target Position Size (Coin Change variant)",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    problem:
      "A venue only accepts child orders in a fixed set of clip sizes (e.g. 100, 500, 1000 shares -- you can send as many orders of each size as you want, in any combination). Given the available clip sizes and a target position size, return the minimum number of orders needed to reach EXACTLY the target size, or -1 if it's impossible.",
    examples: [
      {
        input: "clip_sizes = [1, 100, 500], target = 1200",
        output: "4",
        explanation:
          "Two orders of 500 plus two orders of 100 reach exactly 1200 in 4 orders, which is fewer than any combination using only the size-1 clip or other mixes.",
      },
    ],
    constraints: ["1 <= number of clip sizes <= 20", "1 <= clip size <= 10^5", "1 <= target <= 10^6"],
    approach:
      "This is exactly coin change's minimum-coins formulation with clip sizes standing in for coin denominations. Build a 1D DP array best[s] = minimum orders to reach exactly position size s, seeded with best[0] = 0 (already there) and every other entry at infinity. For each achievable size s from 1 up to target, and for each available clip size c <= s, best[s] can improve via best[s - c] + 1 -- one more order on top of however you best reached s - c. Iterating sizes in increasing order guarantees best[s - c] is already finalized before it's used, since s - c < s. If best[target] is still infinity at the end, no combination reaches it exactly.",
    code: `def min_orders_to_target(clip_sizes: list[int], target: int) -> int:
    INF = float("inf")
    best = [0] + [INF] * target   # best[s] = min orders to reach size s exactly

    for s in range(1, target + 1):
        for c in clip_sizes:
            if c <= s and best[s - c] + 1 < best[s]:
                best[s] = best[s - c] + 1

    return best[target] if best[target] != INF else -1

print(min_orders_to_target([1, 100, 500], 1200))   # 4  (2x500 + 2x100)
print(min_orders_to_target([300, 700], 1000))       # 2  (300 + 700)
print(min_orders_to_target([300, 700], 200))        # -1 (no combination reaches 200)`,
    language: "python",
    complexity: { time: "O(target * number of clip sizes)", space: "O(target)" },
  },
  {
    id: "lc-reservoir-sample-trade-stream",
    title: "Reservoir Sampling a Fixed-Size Random Snapshot from an Unbounded Trade Stream",
    difficulty: "medium",
    topics: ["design", "reservoir-sampling", "randomization"],
    problem:
      "You receive an unbounded stream of trade prints one at a time (you don't know the total count in advance and can't store them all). Design a structure that, at any point, can return a uniformly random sample of exactly k trades seen so far (each trade equally likely to be among the k currently held, regardless of when the stream stops).",
    examples: [
      {
        input: "k = 2; stream: t1, t2, t3, t4, t5",
        output: "after all 5, sample() returns 2 trades, each of the 5 having been included with probability 2/5",
        explanation:
          "Reservoir sampling guarantees every trade seen so far has equal probability k/n of being in the current sample, without ever storing more than k trades or knowing n in advance.",
      },
    ],
    constraints: ["1 <= k <= 10^4", "stream length unknown in advance, up to 10^7 trades"],
    approach:
      "The naive approach -- store every trade, then pick k at random once the stream ends -- needs O(n) memory and doesn't work if sample() must answer at any intermediate point without knowing when the stream ends. Reservoir sampling (Algorithm R) keeps exactly k items at all times: fill the reservoir with the first k trades directly, then for each subsequent trade at 1-indexed position i > k, generate a random integer j uniformly in [0, i-1] and replace reservoir[j] with the new trade if and only if j < k. The correctness argument: by induction, assume every trade among the first i-1 has probability k/(i-1) of being in the reservoir before processing trade i; trade i lands in the reservoir with probability k/i by construction, and any trade already in the reservoir survives this step only if the newcomer's slot roll misses its position, which works out to exactly k/i as well -- so the invariant holds at every step with O(k) memory regardless of stream length.",
    code: `import random

class TradeReservoirSample:
    def __init__(self, k: int):
        self.k = k
        self.reservoir: list[dict] = []
        self.seen = 0   # count of trades processed so far (1-indexed conceptually)

    def add(self, trade: dict) -> None:
        self.seen += 1
        if len(self.reservoir) < self.k:
            self.reservoir.append(trade)          # fill phase: first k trades kept outright
            return

        # replace with probability k/seen -- pick a random slot in [0, seen-1],
        # only accept the newcomer if that slot happens to fall in [0, k-1]
        j = random.randint(0, self.seen - 1)
        if j < self.k:
            self.reservoir[j] = trade

    def sample(self) -> list[dict]:
        return list(self.reservoir)   # copy: caller shouldn't mutate internal state

store = TradeReservoirSample(k=2)
for i in range(1, 6):
    store.add({"trade_id": i, "price": 100 + i})
print(store.sample())   # 2 trades, each of the 5 equally likely to appear`,
    language: "python",
    complexity: { time: "O(1) per add, O(k) for sample()", space: "O(k)" },
  },
  {
    id: "lc-sliding-window-rate-limiter",
    title: "Design a Sliding-Window Order Submission Rate Limiter",
    difficulty: "medium",
    topics: ["design", "sliding-window", "queue"],
    problem:
      "An exchange enforces a hard throttle: at most N orders may be submitted in any rolling T-millisecond window (not a fixed calendar window -- any T-millisecond span, sliding continuously). Design allow(timestamp) which is called once per prospective order submission and returns whether that order is allowed to go out under the current rolling window, given the timestamps of all previously allowed submissions.",
    examples: [
      {
        input: "N=3, T=1000; calls: allow(0), allow(200), allow(500), allow(900), allow(1100)",
        output: "True, True, True, False, True",
        explanation:
          "At allow(900), the trailing 1000ms window already contains 3 allowed submissions (0, 200, 500), so it is rejected; at allow(1100), timestamp 0 has fallen out of the trailing window, leaving room for a new submission.",
      },
    ],
    constraints: ["1 <= N <= 10^4", "1 <= T <= 10^9", "timestamps arrive in non-decreasing order"],
    approach:
      "Maintain a queue of timestamps for every ALLOWED submission (not every attempt). On each call, first evict from the front of the queue any timestamp that has fallen more than T milliseconds behind the current timestamp -- since the queue is strictly increasing, all expired entries are always at the front, so this is amortized O(1) per call even though each entry is popped once, ever. After evicting, if the queue's remaining length is below N, allow the new order and push its timestamp; otherwise reject it without pushing anything, since a rejected order was never actually submitted and shouldn't count toward future windows. This 'sliding window log' approach is exact (unlike a fixed-bucket counter, which can allow up to 2x the true limit right at a bucket boundary) at the cost of O(N) worst-case memory instead of O(1).",
    code: `from collections import deque

class SlidingWindowRateLimiter:
    def __init__(self, max_orders: int, window_ms: int):
        self.max_orders = max_orders
        self.window_ms = window_ms
        self.allowed_timestamps: deque[int] = deque()   # strictly increasing

    def allow(self, timestamp_ms: int) -> bool:
        # evict everything older than the trailing window -- always at the
        # front since timestamps arrive in non-decreasing order
        cutoff = timestamp_ms - self.window_ms
        while self.allowed_timestamps and self.allowed_timestamps[0] <= cutoff:
            self.allowed_timestamps.popleft()

        if len(self.allowed_timestamps) < self.max_orders:
            self.allowed_timestamps.append(timestamp_ms)
            return True
        return False   # rejected orders are never enqueued -- they didn't happen

limiter = SlidingWindowRateLimiter(max_orders=3, window_ms=1000)
for ts in [0, 200, 500, 900, 1100]:
    print(ts, "->", limiter.allow(ts))
# True True True False True`,
    language: "python",
    complexity: { time: "O(1) amortized per call", space: "O(max_orders)" },
  },
];
