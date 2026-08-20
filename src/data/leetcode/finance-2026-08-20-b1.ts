import type { LeetCodeProblem } from "./index";

// ============================================================
// Quant-flavoured grind batch -- 2026-08-20
// A Bellman-Ford negative-cycle scan for FX triangular
// arbitrage, a Union-Find asset-clustering problem, a
// merge-sort inversion count for cross-sectional rank churn,
// a binary-search-on-the-answer capacity problem, and a 0/1
// knapsack for selecting trade ideas under a risk budget.
// ============================================================

export const financeBatch20260820: LeetCodeProblem[] = [
  {
    id: "lc-fx-arbitrage-negative-cycle",
    title: "Detecting FX Triangular Arbitrage via Negative-Cycle Detection",
    difficulty: "hard",
    topics: ["graph", "bellman-ford"],
    problem:
      "Given a list of currency pairs and their exchange rates as (from_currency, to_currency, rate) triples (rate = units of to_currency received for 1 unit of from_currency), determine whether a triangular -- or longer cyclic -- arbitrage opportunity exists: a sequence of conversions starting and ending at the same currency that yields strictly more than you started with.",
    examples: [
      {
        input: 'rates=[("USD","EUR",0.9), ("EUR","GBP",0.8), ("GBP","USD",1.4)]',
        output: "True",
        explanation:
          "1 USD -> 0.9 EUR -> 0.9*0.8=0.72 GBP -> 0.72*1.4=1.008 USD, ending with more than the 1 USD started with -- an arbitrage loop.",
      },
    ],
    constraints: ["1 <= number of currencies <= 100", "rate > 0"],
    approach:
      "Exchange rates compound multiplicatively along a conversion path, so a profitable loop is one where the PRODUCT of rates around the cycle exceeds 1. Taking negative logs turns multiplication into addition and 'product > 1' into 'sum of negative logs < 0' -- so build a graph with edge weight -log(rate) for each currency pair, and 'does an arbitrage loop exist' becomes exactly 'does this graph contain a negative-weight cycle', the textbook use case for Bellman-Ford. Unlike Dijkstra, Bellman-Ford tolerates negative edge weights and can explicitly detect negative cycles: relax every edge |V|-1 times, then run one more pass -- if any edge can still be relaxed, a negative cycle is reachable, meaning an arbitrage loop exists.",
    code: `import math

def has_arbitrage(rates: list[tuple[str, str, float]]) -> bool:
    currencies = sorted({c for frm, to, _ in rates for c in (frm, to)})
    idx = {c: i for i, c in enumerate(currencies)}
    n = len(currencies)

    # edge weight = -log(rate): a profitable conversion loop (product of
    # rates > 1) becomes a NEGATIVE-weight cycle in this transformed graph
    edges = [(idx[frm], idx[to], -math.log(rate)) for frm, to, rate in rates]

    dist = [0.0] * n   # start every node at distance 0 -- equivalent to a
                        # virtual source connected to all currencies at cost 0

    for _ in range(n - 1):
        for u, v, w in edges:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w

    # one more pass: if any edge still relaxes, a negative cycle exists
    for u, v, w in edges:
        if dist[u] + w < dist[v] - 1e-12:
            return True
    return False`,
    language: "python",
    complexity: { time: "O(V * E)", space: "O(V)" },
  },
  {
    id: "lc-cluster-assets-by-correlation",
    title: "Clustering Assets by Correlation Threshold",
    difficulty: "medium",
    topics: ["union-find"],
    problem:
      "Given pairwise asset correlations as (asset_a, asset_b, correlation) triples and a threshold, group assets into clusters such that two assets end up in the same cluster if and only if they are connected by a chain of pairs each at or above the threshold (not every pair is necessarily given). Return the resulting clusters.",
    examples: [
      {
        input:
          'pairs=[("AAPL","MSFT",0.75),("MSFT","GOOGL",0.68),("GOOGL","TSLA",0.30),("XOM","CVX",0.82)], threshold=0.6',
        output: '[{"AAPL","MSFT","GOOGL"}, {"TSLA"}, {"XOM","CVX"}]',
        explanation:
          "AAPL-MSFT (0.75) and MSFT-GOOGL (0.68) both clear the threshold, chaining all three into one cluster even though AAPL and GOOGL were never directly compared. GOOGL-TSLA at 0.30 fails the bar, so TSLA stays its own singleton. XOM-CVX (0.82) forms an independent second cluster.",
      },
    ],
    constraints: ["1 <= number of assets <= 10^4", "-1 <= correlation <= 1"],
    approach:
      "'Same cluster' is transitive through any chain of above-threshold pairs -- exactly the equivalence relation Union-Find (disjoint set union) is built to maintain incrementally. Process each pair once: if its correlation meets the threshold, union the two assets' sets; if it doesn't, skip the pair entirely, even though the two assets might still end up in the same cluster via a DIFFERENT chain. Union by rank plus path compression keeps every union or find operation effectively constant (inverse-Ackermann) amortized time, rather than recomputing connectivity from a graph traversal. Finally group every asset by its root representative to produce the clusters.",
    code: `class UnionFind:
    def __init__(self):
        self.parent: dict[str, str] = {}
        self.rank: dict[str, int] = {}

    def find(self, x: str) -> str:
        self.parent.setdefault(x, x)
        self.rank.setdefault(x, 0)
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])   # path compression
        return self.parent[x]

    def union(self, a: str, b: str) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return
        if self.rank[ra] < self.rank[rb]:
            ra, rb = rb, ra
        self.parent[rb] = ra
        if self.rank[ra] == self.rank[rb]:
            self.rank[ra] += 1

def cluster_assets(pairs: list[tuple[str, str, float]], threshold: float) -> list[set[str]]:
    uf = UnionFind()
    all_assets = {a for a, b, _ in pairs} | {b for a, b, _ in pairs}
    for a in all_assets:
        uf.find(a)   # ensure every asset registers as its own singleton root

    for a, b, corr in pairs:
        if corr >= threshold:
            uf.union(a, b)

    clusters: dict[str, set[str]] = {}
    for a in all_assets:
        root = uf.find(a)
        clusters.setdefault(root, set()).add(a)
    return list(clusters.values())`,
    language: "python",
    complexity: {
      time: "O(E * alpha(V)) for E pairs and V assets, alpha the inverse-Ackermann function",
      space: "O(V)",
    },
  },
  {
    id: "lc-count-rank-inversions",
    title: "Counting Rank Disruption Between Two Daily Signal Rankings",
    difficulty: "hard",
    topics: ["merge-sort", "divide-and-conquer"],
    problem:
      "You rank your universe of stocks by a signal each day. Given yesterday's ranking (a list of ticker indices, best to worst) and today's ranking of the SAME tickers, count the number of ticker pairs whose relative order flipped between the two days -- a proxy for how much the ranking churned. Do this faster than the O(n^2) all-pairs comparison.",
    examples: [
      {
        input: "yesterday=[0,1,2,3], today=[2,0,3,1]",
        output: "3",
        explanation:
          "Re-express today's ranking as the sequence of yesterday's rank-positions in today's order: ticker 2 was rank 2, ticker 0 was rank 0, ticker 3 was rank 3, ticker 1 was rank 1, giving [2,0,3,1]. Counting inversions in that sequence -- (2,0), (2,1), (3,1) -- gives 3, matching the pairs whose relative order flipped.",
      },
    ],
    constraints: [
      "1 <= n <= 10^5",
      "yesterday and today are permutations of the same n ticker indices",
    ],
    approach:
      "Reduce the problem to a single sequence: map each ticker to its position in yesterday's ranking, then read off those positions in TODAY's order -- an inversion in that sequence (a later element smaller than an earlier one) corresponds exactly to a pair of tickers whose relative order flipped. Counting inversions is the classic merge-sort-augmented problem: during merge sort's merge step, whenever an element from the right half is placed before a remaining element from the left half, EVERY remaining left-half element forms an inversion with it, so add that count in bulk instead of comparing pairs one at a time. This turns what looks like an O(n^2) all-pairs count into O(n log n), the same complexity as a single sort.",
    code: `def count_rank_inversions(yesterday: list[int], today: list[int]) -> int:
    rank_yesterday = {ticker: pos for pos, ticker in enumerate(yesterday)}
    sequence = [rank_yesterday[ticker] for ticker in today]

    def merge_count(arr: list[int]) -> tuple[list[int], int]:
        if len(arr) <= 1:
            return arr, 0
        mid = len(arr) // 2
        left, inv_left = merge_count(arr[:mid])
        right, inv_right = merge_count(arr[mid:])

        merged = []
        i = j = 0
        inversions = inv_left + inv_right
        while i < len(left) and j < len(right):
            if left[i] <= right[j]:
                merged.append(left[i])
                i += 1
            else:
                # every remaining element in left is out of order with right[j]
                inversions += len(left) - i
                merged.append(right[j])
                j += 1
        merged.extend(left[i:])
        merged.extend(right[j:])
        return merged, inversions

    _, total = merge_count(sequence)
    return total`,
    language: "python",
    complexity: { time: "O(n log n)", space: "O(n)" },
  },
  {
    id: "lc-max-aum-participation-cap",
    title: "Maximum Tradable AUM Under a Participation Cap",
    difficulty: "medium",
    topics: ["binary-search"],
    problem:
      "Given each name's average daily dollar volume (ADV) and the fraction of the book's capital a rebalance trades in that name (its turnover fraction), find the maximum AUM such that no single name's dollars-traded exceeds a given participation cap times its ADV.",
    examples: [
      {
        input:
          "adv=[20_000_000, 10_000_000, 50_000_000], turnover_fraction=[0.10, 0.20, 0.05], participation_cap=0.05",
        output: "2,500,000",
        explanation:
          "At AUM A, name i trades A*turnover_fraction[i] dollars, capped at participation_cap*adv[i]. The per-name bounds are 10,000,000 / 2,500,000 / 50,000,000 respectively -- name index 1 is the binding constraint at 2,500,000.",
      },
    ],
    constraints: [
      "1 <= number of names <= 10^4",
      "adv[i] > 0, 0 < turnover_fraction[i] <= 1, 0 < participation_cap <= 1",
    ],
    approach:
      "Define a monotonic feasibility predicate: feasible(A) is true when every name's dollars-traded at AUM A stays within its participation cap. Raising A can only ever push more names toward or past their cap, never pull one back into feasibility, so feasible(A) is true for all A up to some threshold and false beyond it -- exactly the shape binary search on the answer requires. Binary search over AUM values converges to that threshold in O(log(range/precision)) feasibility checks, each O(n). This linear-cap version happens to also have a closed form (each name's bound is participation_cap*adv_i/turnover_i, and the answer is the minimum across names) -- but the SAME binary-search code, unchanged except for what's inside feasible(), extends directly to more realistic non-linear cost models like square-root market impact, where summing several fractional-power terms across names has no simple closed-form inverse at all.",
    code: `def max_aum_under_participation_cap(
    adv: list[float], turnover_fraction: list[float], participation_cap: float
) -> float:
    def feasible(aum: float) -> bool:
        # every name's dollars traded at this AUM must stay within its
        # participation cap of that name's average daily volume
        return all(
            aum * tf <= participation_cap * a
            for a, tf in zip(adv, turnover_fraction)
        )

    lo, hi = 0.0, 1e12   # hi: a deliberately large upper bound on plausible AUM
    for _ in range(100):   # enough iterations for essentially exact convergence
        mid = (lo + hi) / 2
        if feasible(mid):
            lo = mid
        else:
            hi = mid
    return lo

adv = [20_000_000, 10_000_000, 50_000_000]
turnover_fraction = [0.10, 0.20, 0.05]
print(round(max_aum_under_participation_cap(adv, turnover_fraction, 0.05)))
# 2,500,000 -- name index 1 is the binding constraint: 0.05 * 10,000,000 / 0.20`,
    language: "python",
    complexity: {
      time: "O(n * log(range/precision))",
      space: "O(1)",
    },
  },
  {
    id: "lc-knapsack-trade-idea-selection",
    title: "Selecting a Bounded-Risk-Budget Subset of Trade Ideas to Maximize Expected Alpha",
    difficulty: "medium",
    topics: ["dynamic-programming", "knapsack"],
    problem:
      "You have a list of candidate trade ideas, each with an expected alpha (in basis points) and a risk cost (in units of your risk budget). You may take any subset, each idea at most once, but the total risk cost of the selected ideas must not exceed a fixed risk budget. Return the maximum total expected alpha achievable.",
    examples: [
      {
        input: "alpha=[60, 100, 120], risk_cost=[10, 20, 30], risk_budget=50",
        output: "220",
        explanation:
          "Taking ideas 1 and 2 gives alpha 100+120=220 at risk cost 20+30=50, exactly at budget -- better than all three (risk cost 60, over budget) or ideas 0 and 2 (alpha 180, risk cost 40, under budget but less alpha).",
      },
    ],
    constraints: [
      "1 <= number of ideas <= 500",
      "risk_budget and risk_cost are non-negative integers (risk measured in discrete budget units)",
    ],
    approach:
      "The classic 0/1 knapsack problem wearing a portfolio-selection costume: each trade idea is an item with a value (alpha) and a weight (risk cost), and the risk budget is the knapsack's capacity. Build a 1-D DP array where dp[b] is the maximum achievable alpha using a risk budget of up to b units, considering ideas processed so far. Process ideas one at a time, and for each idea update the dp array by iterating the budget dimension BACKWARDS from risk_budget down to that idea's risk cost -- iterating backwards enforces the 0/1 constraint (each idea used at most once), since dp[b - cost] read during idea i's update still reflects idea i not yet being included, whereas a forward iteration would let the same idea be reused multiple times within one pass (the classic unbounded-knapsack mistake). This collapses what looks like a 2^n subset-enumeration problem into O(n * risk_budget) time.",
    code: `def max_alpha_under_risk_budget(
    alpha: list[int], risk_cost: list[int], risk_budget: int
) -> int:
    dp = [0] * (risk_budget + 1)   # dp[b] = best alpha achievable within budget b

    for a, cost in zip(alpha, risk_cost):
        # iterate the budget dimension BACKWARDS -- this is what makes it
        # 0/1 (each idea used at most once) rather than unbounded knapsack
        for b in range(risk_budget, cost - 1, -1):
            dp[b] = max(dp[b], dp[b - cost] + a)

    return dp[risk_budget]

alpha = [60, 100, 120]
risk_cost = [10, 20, 30]
print(max_alpha_under_risk_budget(alpha, risk_cost, risk_budget=50))   # 220`,
    language: "python",
    complexity: { time: "O(n * risk_budget)", space: "O(risk_budget)" },
  },
];
