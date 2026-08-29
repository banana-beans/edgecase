import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-29
// A two-heap rolling median of order-book imbalance, a greedy
// batching problem for keeping order groups under a notional
// cap, a mandatory-minimum-holding-period stock DP, the
// classical secretary problem framed as accepting block trade
// offers, and an epsilon-greedy smart order router design.
// ============================================================

export const financeBatch20260829: LeetCodeProblem[] = [
  {
    id: "lc-two-heap-median-book-imbalance",
    title: "Rolling Median of Order Book Imbalance Ratio (Two Heaps)",
    difficulty: "medium",
    topics: ["heap", "design"],
    problem:
      "You receive a stream of order-book snapshots, each producing an imbalance ratio r = bid_size / (bid_size + ask_size) in [0, 1]. Implement a structure that supports add(r) and median() so you can track the running median imbalance ratio as the session progresses, with add() in O(log n) and median() in O(1).",
    examples: [
      {
        input: "add(0.6); add(0.3); add(0.9); add(0.4) -- median() after each add",
        output: "0.6, 0.45, 0.6, 0.5",
        explanation:
          "After [0.6]: median 0.6. After [0.3,0.6]: average of the two middles, 0.45. After [0.3,0.6,0.9]: middle value 0.6. After [0.3,0.4,0.6,0.9]: average of the two middles, (0.4+0.6)/2=0.5.",
      },
    ],
    constraints: ["1 <= number of add() calls <= 10^5", "0.0 <= r <= 1.0"],
    approach:
      "Maintain two heaps: a max-heap 'lo' holding the smaller half of values seen so far (negated, since Python's heapq is a min-heap), and a min-heap 'hi' holding the larger half, kept balanced so their sizes differ by at most 1. On each add, push into lo first, then move lo's current max into hi to preserve the invariant that every value in lo is <= every value in hi, then rebalance by moving the top of whichever heap is now larger back to the other. The median is the top of the larger heap when sizes are unequal, or the average of both tops when they're equal. Every add is O(log n) for the heap pushes/pops; median() is O(1) since it only reads the two heap tops.",
    code: `import heapq

class RollingMedianImbalance:
    def __init__(self):
        self.lo: list[float] = []   # max-heap, values negated
        self.hi: list[float] = []   # min-heap

    def add(self, r: float) -> None:
        heapq.heappush(self.lo, -r)
        # maintain invariant: every value in lo <= every value in hi
        heapq.heappush(self.hi, -heapq.heappop(self.lo))
        # rebalance so sizes differ by at most 1, keeping lo the larger (or equal) side
        if len(self.hi) > len(self.lo):
            heapq.heappush(self.lo, -heapq.heappop(self.hi))

    def median(self) -> float:
        if len(self.lo) > len(self.hi):
            return -self.lo[0]
        return (-self.lo[0] + self.hi[0]) / 2.0

tracker = RollingMedianImbalance()
for r in [0.6, 0.3, 0.9, 0.4]:
    tracker.add(r)
    print(round(tracker.median(), 3))
# 0.6, 0.45, 0.6, 0.5`,
    language: "python",
    complexity: { time: "O(log n) per add, O(1) per median", space: "O(n)" },
  },
  {
    id: "lc-min-batches-notional-cap",
    title: "Minimum Number of Order Batches to Keep Each Batch Under a Notional Cap",
    difficulty: "medium",
    topics: ["greedy", "two-pointer"],
    problem:
      "You must submit a sequence of child order notionals to the exchange in a fixed given order -- you cannot reorder them -- by grouping consecutive orders into batches. Each batch's total notional must not exceed a risk cap C. Return the minimum number of batches needed. Every individual order's notional is itself <= C.",
    examples: [
      {
        input: "notionals=[80,50,30,90,20], cap=150",
        output: "2",
        explanation:
          "Batch 1 greedily fills with 80+50=130 (adding 30 would push it to 160 > 150, so it stops there). Batch 2 takes 30+90+20=140, which fits. Two batches is also provably minimal, since the full sum 270 exceeds the 150 cap so one batch is impossible.",
      },
    ],
    constraints: ["1 <= notionals.length <= 10^5", "1 <= notionals[i] <= C <= 10^9"],
    approach:
      "Greedily accumulate into the current batch, and only start a new batch the moment adding the next order would push the running total over the cap. This greedy is optimal for this exact partition shape: given any valid partition into contiguous batches, you can always shift the group boundaries later (pack each batch as full as possible) without ever increasing the number of batches, since a later boundary only gives the next batch more room, never less -- so the greedy that fills each batch maximally before splitting is never worse than any other valid partition.",
    code: `def min_batches(notionals: list[int], cap: int) -> int:
    batches = 1
    current = 0

    for x in notionals:
        if current + x > cap:
            batches += 1     # start a new batch -- current one is as full as it can get
            current = 0
        current += x

    return batches

print(min_batches([80, 50, 30, 90, 20], cap=150))   # 2`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-buy-sell-min-holding-period",
    title: "Maximum Profit with a Mandatory Minimum Holding Period",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily closing prices and an integer d, find the maximum profit from any number of buy-then-sell transactions, holding at most one unit at a time, where a compliance rule requires holding each position for at least d days before selling -- sell day minus buy day must be >= d. You may re-buy immediately after selling, with no cooldown beyond the holding-period rule.",
    examples: [
      {
        input: "prices=[1,4,2,8,5], d=2",
        output: "7",
        explanation:
          "Buy on day 1 at price 1 and sell on day 4 at price 8 -- a 3-day hold, satisfying d=2 -- for a profit of 7. No combination of shorter, disjoint transactions that respects the minimum hold beats this single trade.",
      },
    ],
    constraints: ["1 <= prices.length <= 5000", "0 <= prices[i] <= 10^4", "1 <= d <= prices.length"],
    approach:
      "Let dp[i] be the max profit achievable using only the first i days, ending flat (free to start a new position on day i+1). A transaction selling on day i must have bought on some day j with i - j >= d, contributing price[i] - price[j] on top of dp[j-1] (profit already banked before that purchase). Naively maximizing over all valid j each day is O(n) per day, O(n^2) overall -- but the set of eligible buy days {j : j <= i - d} only grows monotonically as i increases, nothing ever leaves it, so track a running best_buy = max over eligible j of (dp[j-1] - price[j]) and fold in exactly one newly-eligible index per step, turning the whole computation into O(n).",
    code: `def max_profit_min_holding(prices: list[int], d: int) -> int:
    n = len(prices)
    dp = [0] * (n + 1)          # dp[i] = best profit using first i days, ending flat
    best_buy = float("-inf")     # running max of dp[j-1] - price[j] over eligible j

    for i in range(1, n + 1):
        # day (i - d), 1-indexed, just became an eligible buy day -- fold it in
        buy_day = i - d
        if buy_day >= 1:
            best_buy = max(best_buy, dp[buy_day - 1] - prices[buy_day - 1])

        sell_today = prices[i - 1] + best_buy if best_buy != float("-inf") else float("-inf")
        dp[i] = max(dp[i - 1], sell_today)

    return dp[n]

print(max_profit_min_holding([1, 4, 2, 8, 5], d=2))   # 7`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-optimal-stopping-block-trade-offers",
    title: "Accepting the Best Block Trade Offer Under Optimal Stopping (Secretary Problem)",
    difficulty: "hard",
    topics: ["probability", "optimal-stopping", "math"],
    problem:
      "n block trade offers arrive one at a time in a uniformly random order. You only observe each offer's rank relative to the ones already seen, not its true rank among all n, and must irrevocably accept or reject it on arrival. You want to maximize the probability of accepting the single BEST offer out of all n. Given n, find the optimal number of offers to observe-and-reject before switching to 'accept the next offer that beats everything seen so far,' and the resulting success probability.",
    examples: [
      {
        input: "n=4",
        output: "reject the first 1, success probability = 11/24 ~ 0.4583",
        explanation:
          "Observing 1 offer purely as a benchmark, then accepting the first subsequent offer that beats it, maximizes the chance of landing on the single best of the 4 -- beating the alternatives of accepting the very first offer blind, or rejecting 2 or 3 offers before switching.",
      },
    ],
    constraints: ["1 <= n <= 10^4"],
    approach:
      "This is the classical secretary problem. For a threshold r (reject the first r-1 offers as a calibration sample, then accept the first later offer that beats all of them), the probability of ending up with the single best offer overall is P(r) = (r-1)/n * sum_{k=r}^{n} 1/(k-1) for r >= 2, and P(1) = 1/n (accept the very first offer blind). Precompute the suffix sums of 1/(k-1) once in O(n), then evaluate P(r) for every r in O(n) total instead of recomputing each tail sum from scratch. As n grows, both the optimal r/n ratio and the resulting success probability converge to 1/e ~ 0.368 -- a clean asymptotic worth quoting even though the exact-n computation below is what actually answers the question for a given n.",
    code: `def optimal_stopping_threshold(n: int) -> tuple[int, float]:
    if n == 1:
        return 1, 1.0

    # suffix[r] = sum_{k=r}^{n} 1 / (k - 1), built once in O(n)
    suffix = [0.0] * (n + 2)
    for k in range(n, 1, -1):
        suffix[k] = suffix[k + 1] + 1.0 / (k - 1)

    best_r, best_p = 1, 1.0 / n   # r=1: accept the first offer blind
    for r in range(2, n + 1):
        p = (r - 1) / n * suffix[r]
        if p > best_p:
            best_r, best_p = r, p

    return best_r, best_p

r, p = optimal_stopping_threshold(4)
print(r, round(p, 4))    # 2, 0.4583 -- reject the first 1, then take the next best-so-far

# asymptotic check: for large n, both r/n and p approach 1/e = 0.3679
r_large, p_large = optimal_stopping_threshold(10_000)
print(r_large / 10_000, round(p_large, 4))`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-design-epsilon-greedy-order-router",
    title: "Design an Epsilon-Greedy Smart Order Router Across Venues",
    difficulty: "medium",
    topics: ["design", "multi-armed-bandit"],
    problem:
      "Design an order router that sends each child order to one of k execution venues and shortly after observes a binary fill outcome. Implement route(), which selects a venue to try next, and update(venue, filled), which records the outcome, so that over many orders the router increasingly favors venues with higher observed fill rates while still occasionally exploring others in case a venue's fill rate has genuinely changed.",
    examples: [
      {
        input: "router = EpsilonGreedyRouter(k=3, epsilon=0.1); repeated route()/update() calls",
        output:
          "early routing is close to uniform across the 3 venues; over time it concentrates on whichever venue has the highest empirical fill rate, with roughly 10% of routes still going to a randomly chosen venue",
        explanation:
          "Epsilon-greedy is the simplest working multi-armed-bandit policy: exploit the current best estimate most of the time, explore uniformly at random the rest of the time, so the estimate keeps adapting if venue fill rates drift.",
      },
    ],
    constraints: ["1 <= k <= 50", "0 < epsilon < 1", "fill outcomes are 0 or 1"],
    approach:
      "Track two per-venue counters: attempts and fills. route() first makes sure every venue has been tried at least once (an unvisited venue has an undefined empirical rate and should be preferred so every arm gets an initial estimate), then with probability epsilon returns a uniformly random venue (exploration), and otherwise returns the venue with the highest fills/attempts ratio seen so far (exploitation). update() just increments that venue's attempts and, if filled, its fills. Epsilon-greedy is deliberately simpler than a full UCB or Thompson-sampling bandit: it never fully stops exploring, which matters here since fill rates genuinely drift as market conditions and queue depth change, at the cost of continuing to waste a fixed epsilon fraction of routes on venues already known to be worse even after the estimates have converged.",
    code: `import random

class EpsilonGreedyRouter:
    def __init__(self, k: int, epsilon: float, seed: int = 0):
        self.k = k
        self.epsilon = epsilon
        self.attempts = [0] * k
        self.fills = [0] * k
        self.rng = random.Random(seed)

    def route(self) -> int:
        # always try an unvisited venue first so every arm gets an initial estimate
        for venue in range(self.k):
            if self.attempts[venue] == 0:
                return venue

        if self.rng.random() < self.epsilon:
            return self.rng.randrange(self.k)   # explore

        # exploit: venue with the best empirical fill rate so far
        rates = [self.fills[v] / self.attempts[v] for v in range(self.k)]
        return max(range(self.k), key=lambda v: rates[v])

    def update(self, venue: int, filled: bool) -> None:
        self.attempts[venue] += 1
        if filled:
            self.fills[venue] += 1

router = EpsilonGreedyRouter(k=3, epsilon=0.1, seed=0)
true_fill_rates = [0.5, 0.8, 0.3]   # venue 1 is genuinely the best, unknown to the router
for _ in range(2000):
    venue = router.route()
    filled = router.rng.random() < true_fill_rates[venue]
    router.update(venue, filled)

print("attempts per venue:", router.attempts)   # venue 1 gets the large majority
print("empirical fill rates:", [round(f / a, 3) for f, a in zip(router.fills, router.attempts)])`,
    language: "python",
    complexity: { time: "O(k) per route() call, O(1) per update()", space: "O(k)" },
  },
];
