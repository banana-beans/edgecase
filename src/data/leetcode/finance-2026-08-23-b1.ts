import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-23
// A min-heap interval-scheduling problem for sizing matching
// engine capacity, a counter-based sliding window for tolerable
// order-reject rates, a buy-sell DP variant combining cooldown
// AND a flat fee in one state machine, an expected-waiting-time
// probability problem for a run of consecutive up-ticks, and a
// design problem for a token-bucket order-gateway rate limiter.
// ============================================================

export const financeBatch20260823: LeetCodeProblem[] = [
  {
    id: "lc-min-engines-order-lifetimes",
    title: "Minimum Matching Engines to Cover Overlapping Order Lifetimes",
    difficulty: "medium",
    topics: ["heap", "greedy", "intervals"],
    problem:
      "Given the lifetime of each resting order as [submit_time, cancel_or_fill_time), find the minimum number of matching-engine slots needed so that no slot ever has to process two orders whose lifetimes overlap -- equivalently, the peak number of orders open in the book at any single instant.",
    examples: [
      {
        input: "intervals=[[0,5],[2,7],[4,6],[8,9]]",
        output: "3",
        explanation:
          "At time 4, orders [0,5], [2,7], and [4,6] are all simultaneously resting -- three engines are needed at that instant, and no time has four orders open at once.",
      },
    ],
    constraints: ["1 <= number of orders <= 10^5", "0 <= submit_time < cancel_or_fill_time"],
    approach:
      "Sort orders by submit time and sweep left to right while maintaining a min-heap of the cancel/fill times of orders currently occupying an engine. For each new order, check the heap's smallest end time: if it is already less than or equal to the new order's start time, that engine has freed up and can be reused (pop the old end time, push the new one via heapreplace); otherwise no existing engine is free, so a brand new one is needed (push without popping). The heap's final size after processing every order is the peak concurrent count -- this is the classic 'minimum meeting rooms' pattern, and it works because greedily reusing the earliest-freeing engine is always at least as good as opening a new one.",
    code: `import heapq

def min_engines_needed(intervals: list[tuple[int, int]]) -> int:
    if not intervals:
        return 0

    intervals = sorted(intervals, key=lambda iv: iv[0])
    heap: list[int] = []   # end (cancel/fill) times of orders occupying an engine

    for start, end in intervals:
        if heap and heap[0] <= start:
            # the engine that frees earliest is already free by "start" -- reuse it
            heapq.heapreplace(heap, end)
        else:
            # no free engine yet -- open a new one
            heapq.heappush(heap, end)

    return len(heap)   # heap size = peak concurrent orders = engines required

orders = [(0, 5), (2, 7), (4, 6), (8, 9)]
print(min_engines_needed(orders))   # 3`,
    language: "python",
    complexity: { time: "O(n log n)", space: "O(n)" },
  },
  {
    id: "lc-longest-window-k-rejects",
    title: "Longest Order-Flow Window With At Most K Rejects",
    difficulty: "medium",
    topics: ["sliding-window", "two-pointer"],
    problem:
      "Given a sequence of order outcomes for a session, encoded as 0 (accepted) or 1 (rejected by a pre-trade risk check), and an integer k, find the length of the longest contiguous stretch of orders containing at most k rejects.",
    examples: [
      {
        input: "outcomes=[0,0,1,0,1,0,0,1], k=1",
        output: "4",
        explanation:
          "The window [0,1,0,0] (indices 3-6) contains exactly one reject and has length 4; no window containing at most one reject is longer.",
      },
    ],
    constraints: ["1 <= number of outcomes <= 10^5", "0 <= k <= number of outcomes"],
    approach:
      "This is the 'longest subarray with at most k zeros/ones' pattern applied to a reject budget instead of a generic flag. Maintain a sliding window [left, right] and a running count of rejects inside it. Expand right by one order at a time, adding its outcome to the reject count; whenever the count exceeds k, shrink from the left (removing outcomes[left] from the count and advancing left) until the window is valid again. Because left only ever moves forward and never resets, both pointers traverse the array at most once each, giving a single O(n) pass instead of checking every window explicitly.",
    code: `def longest_window_k_rejects(outcomes: list[int], k: int) -> int:
    left = 0
    rejects = 0
    best = 0

    for right, outcome in enumerate(outcomes):
        rejects += outcome
        while rejects > k:
            rejects -= outcomes[left]
            left += 1
        best = max(best, right - left + 1)

    return best

outcomes = [0, 0, 1, 0, 1, 0, 0, 1]
print(longest_window_k_rejects(outcomes, k=1))   # 4`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-stock-cooldown-fee-dp",
    title: "Max Profit With Both a Cooldown and a Per-Trade Fee",
    difficulty: "hard",
    topics: ["dynamic-programming"],
    problem:
      "Given daily prices for one stock, a fixed transaction fee charged once per completed round trip, and a one-day cooldown required after selling before you may buy again, find the maximum achievable profit from an unlimited number of transactions under both constraints simultaneously.",
    examples: [
      {
        input: "prices=[1,3,2,8,4,9], fee=2",
        output: "6",
        explanation:
          "Buying at 8 and selling at 4 is impossible (that's a loss), so the two visually tempting mid-sequence trades don't combine into anything profitable once the cooldown blocks re-entering right after a sale. The best achievable path is a single round trip: buy at 1, sell at 9, netting 9-1-2=6 -- more than the fee-only variant would extract from any two-trade split of this same sequence once the one-day cooldown is enforced.",
      },
    ],
    constraints: ["1 <= number of days <= 5*10^4", "0 <= price <= 5*10^4", "0 <= fee <= 5*10^4"],
    approach:
      "Extend the standard three-state cooldown machine (held, just-sold, resting) with the fee charged at the moment of sale, same as the fee-only variant. 'held' tracks max profit while currently long; 'just_sold' tracks max profit on the day a sale just happened (blocked from buying tomorrow); 'resting' tracks max profit while free to buy, having cooled down. Each day: held can persist or come from buying out of yesterday's resting state; just_sold can persist... actually just_sold's value is fully determined each day (you either sold today or you didn't matter for buying purposes) as yesterday's held plus today's price minus the fee; resting can persist or become yesterday's just_sold (the cooldown day has passed). Charging the fee exactly once, at the just_sold transition, keeps every state comparable and collapses two constraints into one O(n) single pass with O(1) state, the same family as the plain, fee-only, and cooldown-only variants.",
    code: `def max_profit_cooldown_and_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    held = -prices[0]        # max profit while holding a share
    just_sold = float("-inf")  # max profit on the day a sale just occurred
    resting = 0               # max profit while free to buy (cooldown elapsed)

    for price in prices[1:]:
        prev_held = held
        held = max(held, resting - price)         # buy today, funded from resting cash
        resting = max(resting, just_sold)          # cooldown day has passed
        just_sold = prev_held + price - fee        # sell today; fee charged once, here

    return max(resting, just_sold)   # never optimal to end the day still holding

print(max_profit_cooldown_and_fee([1, 3, 2, 8, 4, 9], fee=2))   # 6`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-expected-ticks-k-consecutive-upticks",
    title: "Expected Number of Ticks Until K Consecutive Up-Ticks",
    difficulty: "hard",
    topics: ["probability", "markov-chain"],
    problem:
      "Each price tick moves up with probability p, independent of prior ticks. Compute the expected number of ticks needed to observe a run of k consecutive up-ticks in a row (a simple momentum-confirmation trigger some strategies wait for before entering).",
    examples: [
      {
        input: "p=0.5, k=3",
        output: "14.0",
        explanation:
          "With a fair coin, the expected number of flips to see 3 heads in a row is the classic result sum(2^i for i=1..3) = 2+4+8 = 14.",
      },
    ],
    constraints: ["0 < p < 1", "1 <= k <= 40"],
    approach:
      "Model the process as a Markov chain over 'current up-tick streak length', states 0..k, where state k is absorbing (the target is hit). This is exactly the classic waiting-time-for-a-run problem, and it has a clean closed form: the expected number of trials to see k consecutive successes at success probability p equals the sum, for i from 1 to k, of (1/p)^i -- each term reflects the geometrically increasing expected cost of extending an already-achieved streak by one more success without a failure resetting it. As a sanity check under interview pressure, the same expectation can be recovered by solving the underlying linear system directly: let e_j be the expected remaining ticks from streak length j, with e_k=0 and e_j = 1 + p*e_(j+1) + (1-p)*e_0 for j < k (a failure at any streak length resets you all the way to state 0, tying every equation back to the same unknown e_0) -- solving that k-equation linear system with a linear-algebra solver reproduces the closed form exactly.",
    code: `import numpy as np

def expected_ticks_closed_form(p: float, k: int) -> float:
    # E = sum_{i=1}^{k} (1/p)^i -- classic expected waiting time for a run
    return sum((1 / p) ** i for i in range(1, k + 1))

print(expected_ticks_closed_form(0.5, 3))   # 14.0

def expected_ticks_linear_system(p: float, k: int) -> float:
    # e_j = 1 + p*e_(j+1) + (1-p)*e_0 for j = 0..k-1, with e_k = 0 known.
    # Rearranged into A @ e = b for e = [e_0, ..., e_(k-1)]:
    #   e_j - p*e_(j+1) - (1-p)*e_0 = 1   (e_k term dropped when j = k-1, since e_k = 0)
    A = np.eye(k)
    b = np.ones(k)
    for j in range(k):
        A[j, 0] -= (1 - p)          # every equation ties back to e_0
        if j + 1 < k:
            A[j, j + 1] -= p        # only wire in e_(j+1) if it's an unknown (j+1 < k)
    e = np.linalg.solve(A, b)
    return e[0]

print(round(expected_ticks_linear_system(0.5, 3), 4))   # matches 14.0
print(round(expected_ticks_closed_form(0.55, 5), 4))    # a momentum-biased tape, p > 0.5`,
    language: "python",
    complexity: { time: "O(k) closed form, O(k^3) linear solve", space: "O(1) closed form, O(k^2) linear solve" },
  },
  {
    id: "lc-token-bucket-rate-limiter",
    title: "Design a Token-Bucket Rate Limiter for an Order-Entry Gateway",
    difficulty: "medium",
    topics: ["design", "rate-limiting"],
    problem:
      "Design a rate limiter for an exchange order-entry gateway: allow(timestamp) should return True and consume one token if a token is available, or False if the client has exceeded its allowed order rate. Tokens refill continuously at a fixed rate up to a maximum bucket capacity, matching how real exchange gateways throttle message rates to prevent order-flood incidents.",
    examples: [
      {
        input: "capacity=3, refill_rate=1 token/sec; allow(0), allow(0), allow(0), allow(0), allow(1.0)",
        output: "True, True, True, False, True",
        explanation:
          "The bucket starts full with 3 tokens; the first three calls at t=0 each consume one, emptying it, so the fourth call at t=0 is rejected. By t=1.0, one second has passed and the bucket refills by 1 token (rate 1/sec), so the fifth call succeeds.",
      },
    ],
    constraints: ["capacity >= 1", "refill_rate > 0", "timestamps are non-decreasing across calls"],
    approach:
      "Track a continuous (not integer) token count and the timestamp of the last update, rather than a discrete per-second counter -- this avoids the classic 'fixed window' rate limiter's boundary-burst flaw, where a client could send capacity orders right at the end of one window and capacity more right at the start of the next, doubling the intended rate over a short span. On every allow() call, first refill: add elapsed_time times refill_rate tokens to the bucket, capped at capacity, then advance the last-update timestamp to now. Then check if at least one token is available; if so, subtract one and allow the order, otherwise reject it without consuming anything. Continuous refill makes the achievable long-run rate exactly refill_rate regardless of how a client clusters its calls, which is the property a real gateway throttle needs.",
    code: `class TokenBucketRateLimiter:
    def __init__(self, capacity: float, refill_rate: float):
        self.capacity = capacity
        self.refill_rate = refill_rate   # tokens added per second
        self.tokens = capacity           # bucket starts full
        self.last_update = 0.0

    def allow(self, timestamp: float) -> bool:
        elapsed = timestamp - self.last_update
        # continuous refill, capped at capacity -- no fixed-window boundary burst
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_update = timestamp

        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True
        return False

limiter = TokenBucketRateLimiter(capacity=3, refill_rate=1.0)
print(limiter.allow(0.0))   # True  -- bucket full, 2 tokens left
print(limiter.allow(0.0))   # True  -- 1 token left
print(limiter.allow(0.0))   # True  -- 0 tokens left
print(limiter.allow(0.0))   # False -- no tokens available yet
print(limiter.allow(1.0))   # True  -- 1 second elapsed, refilled by 1 token`,
    language: "python",
    complexity: { time: "O(1) per allow() call", space: "O(1) per client bucket" },
  },
];
