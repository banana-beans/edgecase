import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-11-27
// Reorganizing a venue-routing schedule so no two consecutive
// slots repeat (heap/greedy), the longest run of calmly growing
// resting-order sizes (sliding window), unlimited no-fee intraday
// round trips (DP), the surprising infinite expected return time
// of a fair P&L random walk (probability), and a TWAP tracker
// with efficient range queries (design).
// ============================================================

export const financeBatch20261127: LeetCodeProblem[] = [
  {
    id: "lc-20261127-reorganize-venue-routing-schedule",
    title: "Reorganize a Child-Order Routing Schedule So No Two Consecutive Slots Hit the Same Venue",
    difficulty: "medium",
    topics: ["heap", "greedy"],
    problem:
      "You need to route a batch of child orders across execution slots, given how many orders must go to each venue as a dict of venue to count. Build a schedule -- a list of venue labels, one per slot -- so that no two consecutive slots route to the same venue, to avoid hammering any single venue's matching engine twice in a row. Return any valid schedule, or an empty list if no valid arrangement exists.",
    examples: [
      {
        input: "counts = {'ARCA': 1, 'NASDAQ': 3, 'NYSE': 3}",
        output: "one valid arrangement, e.g. ['NASDAQ', 'NYSE', 'NASDAQ', 'NYSE', 'NASDAQ', 'ARCA', 'NYSE']",
        explanation:
          "7 total slots. No venue count (3) exceeds ceil(7/2) = 4, so a valid no-repeat arrangement exists; the exact ordering returned can vary by implementation as long as no two consecutive entries match.",
      },
    ],
    constraints: ["sum of all counts is between 1 and 10^5", "every count is a positive integer"],
    approach:
      "This is the classic 'Reorganize String' pattern: push (-count, venue) for every venue onto a max-heap so the currently most-frequent remaining venue always pops first. Place the popped venue into the schedule, but hold it OUT of the heap for exactly one more iteration (in a single 'prev' slot) before pushing it back, if it still has remaining count -- that one-step delay is what guarantees it can never be placed twice in a row, since the very next slot must come from whatever else is in the heap. If the heap ever empties while a 'prev' item is still waiting to go back in and slots remain to fill, no valid arrangement exists: that only happens when one venue's count exceeds half the total slots (rounded up), which is the tight feasibility condition for this problem.",
    code: `import heapq


def reorganize_venue_schedule(counts: dict[str, int]) -> list[str]:
    n = sum(counts.values())
    heap = [(-c, venue) for venue, c in counts.items() if c > 0]
    heapq.heapify(heap)

    schedule: list[str] = []
    prev = None  # (count, venue) placed last slot, held out for one iteration

    while heap or prev:
        if not heap:
            return []  # stuck: one venue has too much remaining share to avoid repeats
        count, venue = heapq.heappop(heap)
        schedule.append(venue)
        count += 1  # counts are stored negative, so +1 uses up one occurrence

        if prev:
            heapq.heappush(heap, prev)
            prev = None
        if count < 0:
            prev = (count, venue)  # still has more left -- hold it out one more slot

    return schedule if len(schedule) == n else []


print(reorganize_venue_schedule({"ARCA": 1, "NASDAQ": 3, "NYSE": 3}))`,
    language: "python",
    complexity: { time: "O(n log v) for n total slots and v distinct venues", space: "O(v)" },
    leetcodeNumber: 767,
  },
  {
    id: "lc-20261127-longest-calm-resting-order-growth",
    title: "Longest Run of Consecutive Resting Orders With Non-Decreasing Sizes",
    difficulty: "medium",
    topics: ["sliding-window", "two-pointer"],
    problem:
      "Given the sizes of resting orders at one price level in arrival order, find the length of the longest contiguous run where each order's size is at least as large as the one before it. A long such run suggests a level that's calmly refilling or growing, rather than being chipped away by smaller and smaller replenishments.",
    examples: [
      {
        input: "sizes = [4, 4, 6, 6, 3, 8, 9, 9, 2]",
        output: "4",
        explanation:
          "The run [4, 4, 6, 6] (indices 0-3) is non-decreasing and has length 4. [3, 8, 9, 9] (indices 4-7) also reaches length 4. No run reaches length 5, so the answer is 4.",
      },
    ],
    constraints: ["1 <= sizes.length <= 10^5", "sizes[i] are positive integers"],
    approach:
      "Single forward pass tracking the current run length: if the current size is at least the previous one, extend the run; otherwise the run breaks and resets to length 1 starting at the current element. Track the best run length seen at each step. This needs only one pass and O(1) extra state, since 'does the run extend' only ever depends on the immediately preceding element, not on anything further back.",
    code: `def longest_non_decreasing_run(sizes: list[int]) -> int:
    if not sizes:
        return 0

    best = 1
    run = 1
    for i in range(1, len(sizes)):
        if sizes[i] >= sizes[i - 1]:
            run += 1
        else:
            run = 1
        best = max(best, run)

    return best


print(longest_non_decreasing_run([4, 4, 6, 6, 3, 8, 9, 9, 2]))
# 4`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-20261127-unlimited-no-fee-round-trips",
    title: "Maximum Profit From Unlimited Intraday Round Trips With No Transaction Fee",
    difficulty: "easy",
    topics: ["greedy", "dynamic-programming"],
    problem:
      "Given daily prices for a stock, you may buy and sell as many times as you like (holding at most one unit at a time, no fee per trade). Return the maximum total profit achievable.",
    examples: [
      {
        input: "prices = [7, 1, 5, 3, 6, 4]",
        output: "7",
        explanation:
          "Buy at 1, sell at 5 for profit 4; buy at 3, sell at 6 for profit 3. Total 4 + 3 = 7, which equals the sum of every positive day-to-day price change in the series.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^4"],
    approach:
      "With unlimited round trips and no fee, any profitable multi-day climb can always be captured as a sequence of single-day buy-low-sell-high trades without losing anything, since there's no cost penalizing extra trades. That collapses the whole problem to: sum up every day-to-day increase in price, and ignore every decrease (you simply wouldn't be holding through a decrease). No DP state is actually needed once you see this -- it's a one-line greedy sum, though it's worth being able to justify WHY the greedy is optimal (as opposed to just pattern-matching it from memory) before an interviewer pushes on it.",
    code: `def max_profit_unlimited_round_trips(prices: list[int]) -> int:
    # every positive day-to-day move is captured; every negative move is
    # simply not traded through -- equivalent to any sequence of single
    # climbs you could have decomposed a longer rally into
    return sum(max(0, prices[i] - prices[i - 1]) for i in range(1, len(prices)))


print(max_profit_unlimited_round_trips([7, 1, 5, 3, 6, 4]))
# 7`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
    leetcodeNumber: 122,
  },
  {
    id: "lc-20261127-expected-return-to-breakeven-infinite",
    title: "Expected Number of Trades Until Cumulative P&L First Returns to Breakeven",
    difficulty: "hard",
    topics: ["probability", "markov-chain", "math"],
    problem:
      "A strategy's P&L moves +1 tick with probability 0.5 or -1 tick with probability 0.5 on each trade -- a fair, driftless random walk with no capital limit and no stopping barrier (this is not gambler's ruin). Starting from a P&L of exactly 0, what is the expected number of trades until the cumulative P&L first returns to 0? Is that expectation even finite?",
    examples: [
      {
        input: "p = 0.5 (fair, symmetric walk), starting P&L = 0",
        output: "infinite",
        explanation:
          "The walk is certain to return to 0 eventually (it's recurrent), but the expected NUMBER OF TRADES until that first return does not converge to a finite value -- a classic result for the simple symmetric random walk.",
      },
    ],
    constraints: ["p = 0.5 exactly (the symmetric case)", "no absorbing barriers of any kind"],
    approach:
      "Resist the instinct to reuse the gambler's-ruin machinery -- there's no barrier here, so there's no q_i recursion with boundary conditions to solve. Instead, recall the known tail behavior for a simple symmetric random walk's first-return-to-origin time: the probability the first return happens at exactly step 2n decays like a constant divided by n to the power 3/2, for large n. The walk is recurrent, meaning that probability mass sums to 1 across all n, so a return is certain. But the EXPECTED return time is n times that probability, summed over all n -- and n times (constant over n^1.5) is a constant over n^0.5, whose sum over all n diverges, the same way the sum of 1 over square root of n diverges. So the expectation is infinite even though the event itself is almost certain. The broader lesson: 'happens eventually with probability 1' and 'has a finite expected waiting time' are genuinely different claims -- reasoning that certainty of return implies some large-but-finite expected wait is the classic trap here, and this walk is the standard counterexample. A natural follow-up: with a slight positive drift (p above 0.5) instead of exactly 0.5, there's now a positive probability the walk never returns to 0 at all, so the unconditional expectation isn't even the right question to ask anymore -- you'd have to condition on eventual return, which changes the problem.",
    code: `import numpy as np


def first_return_time(rng, max_steps: int = 200_000) -> int | None:
    pnl = 0
    for t in range(1, max_steps + 1):
        pnl += rng.choice([-1, 1])
        if pnl == 0:
            return t
    return None  # didn't return within the cap -- happens often enough to matter


rng = np.random.default_rng(0)
samples = [first_return_time(rng) for _ in range(2000)]
observed = [s for s in samples if s is not None]

print("fraction returned within the cap:", len(observed) / len(samples))
print("sample mean of observed first-return times:", round(np.mean(observed), 1))
# the sample mean keeps climbing and stays unstable as you grow the simulation
# or the step cap -- a symptom of a heavy, power-law tail with no finite mean,
# not a sign the simulation simply needs to run longer to "settle"`,
    language: "python",
    complexity: { time: "O(1) in closed form (the answer is infinite); simulation above is O(samples * max_steps)", space: "O(1)" },
  },
  {
    id: "lc-20261127-design-twap-tracker-range-query",
    title: "Design a Time-Weighted Average Price (TWAP) Tracker With Range Queries",
    difficulty: "hard",
    topics: ["design", "prefix-sum", "binary-search"],
    problem:
      "Design a TWAPTracker that supports add_price(timestamp, price), called with strictly increasing timestamps as new prices arrive, where each price is assumed to hold constant until the next recorded price arrives, and get_twap(start, end), returning the time-weighted average price over [start, end). Queries should run efficiently after many additions, not by rescanning the full price history each time.",
    examples: [
      {
        input: "add_price(0, 100.0); add_price(10, 102.0); add_price(20, 101.0); get_twap(5, 15)",
        output: "101.0",
        explanation:
          "From t=5 to t=10 (5 time units) the held price is 100.0, contributing 500. From t=10 to t=15 (5 time units) the held price is 102.0, contributing 510. Total 1010 over a 10-unit window averages to 101.0.",
      },
    ],
    constraints: [
      "timestamps passed to add_price are strictly increasing",
      "get_twap is only called with start < end, both within the recorded time range",
      "up to 10^5 calls to add_price and get_twap combined",
    ],
    approach:
      "Store timestamps and prices in parallel lists (already sorted, since timestamps arrive strictly increasing, so appending is O(1) amortized) alongside a running prefix-sum array of 'price times duration held' -- each time a NEW price arrives, the duration the PREVIOUS price was held becomes known, so that segment's contribution gets appended to the prefix sum. A range query then binary-searches (bisect) for which segment each of start and end falls inside, reads the prefix-sum difference between those segments, and trims the two partial segments at the edges (subtracting the bit of the start segment before 'start', adding the bit of the end segment before 'end'). This makes add_price O(1) amortized and get_twap O(log n), instead of the O(n) it would cost to recompute a time-weighted average by rescanning history on every query.",
    code: `import bisect


class TWAPTracker:
    def __init__(self) -> None:
        self.times: list[float] = []
        self.prices: list[float] = []
        self.prefix: list[float] = [0.0]  # prefix[i] = integral of price*dt up to times[i]

    def add_price(self, timestamp: float, price: float) -> None:
        if self.times:
            # the PREVIOUS price's holding duration is only known now
            duration = timestamp - self.times[-1]
            self.prefix.append(self.prefix[-1] + self.prices[-1] * duration)
        self.times.append(timestamp)
        self.prices.append(price)

    def get_twap(self, start: float, end: float) -> float:
        # binary search for the segment each boundary falls inside, instead
        # of rescanning every recorded price from the beginning
        i = max(bisect.bisect_right(self.times, start) - 1, 0)
        j = max(bisect.bisect_right(self.times, end) - 1, 0)

        total = self.prefix[j] - self.prefix[i]
        total -= self.prices[i] * (start - self.times[i])   # trim the leading partial segment
        total += self.prices[j] * (end - self.times[j])     # add the trailing partial segment
        return total / (end - start)


tracker = TWAPTracker()
tracker.add_price(0, 100.0)
tracker.add_price(10, 102.0)
tracker.add_price(20, 101.0)
print(round(tracker.get_twap(5, 15), 4))
# 101.0`,
    language: "python",
    complexity: { time: "O(1) amortized per add_price, O(log n) per get_twap", space: "O(n)" },
  },
];
