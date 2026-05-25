import type { Puzzle } from "./index";

// ============================================================
// Probability puzzles asked at real quant shops.
// Difficulty tiers calibrated to interview signal, not textbook.
// ============================================================

export const probabilityPuzzles: Puzzle[] = [
  // ----------------------------------------------------------
  // EV / linearity of expectation
  // ----------------------------------------------------------
  {
    id: "p-coupon-collector",
    title: "Coupon Collector",
    difficulty: "medium",
    category: "expected-value",
    asked: ["Jane Street", "HRT", "SIG"],
    problem:
      "A cereal box contains one of n different toys, uniformly at random. You buy boxes one at a time. What is the expected number of boxes you must buy to collect all n toys?",
    hint: "Decompose the journey into phases: time to get the next NEW toy.",
    answer: "n · H_n  ≈  n · (ln n + γ)   (γ ≈ 0.5772)",
    solution:
      "After you already have k distinct toys, the chance the next box gives you a new one is (n-k)/n. So the expected number of boxes to go from k to k+1 distinct is n/(n-k) — a geometric random variable.\n\nBy linearity, total expected boxes is the sum from k=0 to n-1 of n/(n-k), which equals n · (1 + 1/2 + 1/3 + ... + 1/n) = n · H_n.\n\nThe nth harmonic number grows like ln n, so for n = 365 days you'd expect about 2364 days to collect every birthday. Useful intuition: the LAST coupon is the hard one — n/1 = n trials in expectation.",
    simulation: `import random

def coupon_collector(n: int) -> int:
    seen = set()
    count = 0
    while len(seen) < n:
        seen.add(random.randrange(n))
        count += 1
    return count

n = 50
trials = 100_000
avg = sum(coupon_collector(n) for _ in range(trials)) / trials
print(f"empirical: {avg:.2f}")
print(f"theory:    {n * sum(1/k for k in range(1, n+1)):.2f}")`,
  },

  {
    id: "p-hh-vs-ht",
    title: "Coin: Expected Flips to HH vs HT",
    difficulty: "medium",
    category: "expected-value",
    asked: ["SIG", "Jane Street", "Optiver"],
    problem:
      "You flip a fair coin until you see HH (two heads in a row). What is the expected number of flips? What about until HT?",
    hint: "After a single H, what happens on the next flip determines very different outcomes. Set up states and solve.",
    answer: "E[HH] = 6,   E[HT] = 4",
    solution:
      "**HT case (easier):** Wait for the first H — takes 2 flips in expectation. Then keep flipping; if T you're done, if H you stay in the 'just saw H' state. So E[HT] = 2 + 2 = 4.\n\n**HH case:** Set states. Let E = expected from start, E_H = expected once you have one H. From E, one flip then either go to E_H (prob 1/2) or restart (prob 1/2): E = 1 + (1/2)E_H + (1/2)E. From E_H, one flip and either done (prob 1/2) or back to E (prob 1/2): E_H = 1 + (1/2)·0 + (1/2)E. Solve: E_H = 1 + E/2; substitute: E = 1 + (1+E/2)/2 + E/2 → E = 6.\n\n**Why different?** When trying for HH and you fail (T after H), you have to start over completely. When trying for HT and you fail (H after H), you're still in the 'have an H' state — no progress lost. The asymmetry of restart cost makes HH harder by 2 flips.",
    simulation: `import random

def trials_until(target: str, n: int = 100_000) -> float:
    total = 0
    for _ in range(n):
        last = ""
        flips = 0
        while True:
            c = "H" if random.random() < 0.5 else "T"
            flips += 1
            if last + c == target:
                break
            last = c
        total += flips
    return total / n

print(f"HH: {trials_until('HH'):.2f} (theory 6)")
print(f"HT: {trials_until('HT'):.2f} (theory 4)")`,
  },

  {
    id: "p-broken-stick",
    title: "Broken Stick Triangle",
    difficulty: "medium",
    category: "expected-value",
    asked: ["SIG", "Optiver", "Citadel"],
    problem:
      "A stick of length 1 is broken at two points chosen uniformly at random. What is the probability the three pieces form a triangle?",
    hint: "Triangle inequality: no piece can be ≥ 1/2.",
    answer: "1/4",
    solution:
      "Let the two break points be X and Y, uniform on [0,1]. WLOG assume X < Y (multiply final by 2 if needed, but the symmetry handles it). Pieces have lengths X, Y-X, 1-Y. Triangle requires every piece < 1/2.\n\nThree constraints: X < 1/2, Y-X < 1/2, 1-Y < 1/2. The third is Y > 1/2.\n\nPlot (X,Y) in the unit square. The valid region (with X < Y) is bounded by X < 1/2, Y > 1/2, Y < X + 1/2. This is a triangle with vertices (0,1/2), (1/2,1/2), (1/2,1) — area 1/8. The X<Y half has area 1/2. So conditional probability = (1/8)/(1/2) = 1/4. The full square gives the same answer by symmetry.\n\n**Gotcha:** Some versions break the stick at one random point, then break the longer piece. The answer differs.",
    simulation: `import random

def is_triangle(a: float, b: float, c: float) -> bool:
    s = a + b + c
    return max(a, b, c) < s / 2

hits = 0
trials = 1_000_000
for _ in range(trials):
    x, y = sorted([random.random(), random.random()])
    if is_triangle(x, y - x, 1 - y):
        hits += 1
print(f"empirical: {hits/trials:.4f}  (theory 0.2500)")`,
  },

  {
    id: "p-100-prisoners",
    title: "100 Prisoners and Boxes",
    difficulty: "hard",
    category: "brainteaser",
    asked: ["Jane Street", "Optiver"],
    problem:
      "100 prisoners are numbered 1–100. A room contains 100 boxes, each holding a slip with a unique number 1–100 in random order. Each prisoner enters alone, may open at most 50 boxes, looks at the slips, then leaves without communicating. All prisoners must find their own number; if any fails, all are executed. They can agree on a strategy beforehand. What strategy gives the best survival probability — and what is it?",
    hint: "Random opening gives (1/2)^100, basically zero. Use the *permutation structure* of the slip placement.",
    answer: "~30.7%  (≈ 1 - ln 2)",
    solution:
      "**Strategy:** Prisoner k opens box k first. Then opens the box numbered as the slip they just saw. Repeat — they follow a chain through the permutation.\n\n**Why it works:** The placement is a random permutation of 1..100. The chain prisoner k follows is the cycle containing k. They find their slip iff their cycle has length ≤ 50.\n\nAll prisoners succeed iff EVERY cycle of the permutation has length ≤ 50. Equivalently: no cycle is longer than 50. For a random permutation of n=100, the probability of having a cycle longer than n/2 = 50 is exactly:\n\n  P(longest cycle > 50) = sum_{k=51}^{100} 1/k ≈ ln(100) - ln(50) = ln 2\n\nSo P(success) = 1 - ln 2 ≈ 0.307.\n\n**Why this is beautiful:** Random opening is independent across prisoners, so failures compound. The chain strategy makes their fates *correlated* — they all win or many lose together. This trades off catastrophic outcomes for higher expected survival.",
    simulation: `import random

def simulate(n: int = 100, k: int = 50) -> bool:
    perm = list(range(n))
    random.shuffle(perm)
    for start in range(n):
        idx = start
        for _ in range(k):
            if perm[idx] == start:
                break
            idx = perm[idx]
        else:
            return False
    return True

trials = 100_000
wins = sum(simulate() for _ in range(trials))
print(f"survival: {wins/trials:.4f}  (theory ≈ 0.3069)")`,
  },

  {
    id: "p-monty-hall",
    title: "Monty Hall",
    difficulty: "easy",
    category: "conditional",
    asked: ["everywhere — but they're testing you can explain *why*"],
    problem:
      "Three doors hide one car and two goats. You pick a door. The host (who knows what's behind each door) opens a different door revealing a goat, then offers you the option to switch. Should you switch?",
    hint: "Condition on where the car actually is. The host's action is not independent of that.",
    answer: "Switch. P(win | switch) = 2/3.",
    solution:
      "Your initial pick has a 1/3 chance of being the car. The other two doors collectively have 2/3 chance. When the host opens a goat door, they *concentrate* that 2/3 probability onto the single remaining unopened door.\n\nFormal way: condition on the location of the car (uniform 1/3 each). If you stick, P(win) = 1/3. If you switch:\n- Car behind your door (P=1/3): switching loses.\n- Car behind one of the other doors (P=2/3): the host is forced to reveal the goat, leaving the car as the switch option. Switching wins.\n\nSo P(win | switch) = 2/3.\n\n**Why people get this wrong:** They treat the two unopened doors as symmetric. They're not — one was *chosen* uninformedly, the other *survived* the host's filter.\n\n**Interview gotcha:** If the host doesn't know where the car is and randomly opens a goat (a 'Monty Fall' variant), switching gives 1/2.",
    simulation: `import random

def play(switch: bool) -> bool:
    doors = [0, 0, 1]
    random.shuffle(doors)
    pick = random.randrange(3)
    # Host opens a goat door that isn't pick
    options = [i for i in range(3) if i != pick and doors[i] == 0]
    reveal = random.choice(options)
    if switch:
        pick = next(i for i in range(3) if i != pick and i != reveal)
    return doors[pick] == 1

trials = 100_000
print(f"stay:   {sum(play(False) for _ in range(trials))/trials:.4f}")
print(f"switch: {sum(play(True)  for _ in range(trials))/trials:.4f}")`,
  },

  {
    id: "p-bayes-diagnostic",
    title: "Bayes: The Diagnostic Test",
    difficulty: "easy",
    category: "conditional",
    asked: ["everywhere — it's the test of whether you've internalized Bayes"],
    problem:
      "A disease has 1% prevalence in the population. A test has 99% sensitivity (P[positive | sick] = 0.99) and 99% specificity (P[negative | healthy] = 0.99). You test positive. What is the probability you have the disease?",
    hint: "Imagine a population of 10,000.",
    answer: "~50%",
    solution:
      "Imagine 10,000 people. ~100 have the disease, ~9,900 don't.\n\n- Sick & positive:    100 × 0.99 = 99\n- Healthy & positive: 9,900 × 0.01 = 99\n\nOf the 198 positive tests, only 99 are actually sick. So P(sick | positive) = 99/198 = 0.5.\n\nFormally: P(D|+) = P(+|D)·P(D) / P(+) = (0.99 · 0.01) / (0.99·0.01 + 0.01·0.99) = 1/2.\n\n**Why this matters:** A rare condition + a good (but not perfect) test still produces mostly false positives in absolute terms. This is the base rate fallacy. Doctors get it wrong constantly. Quant version: if your signal is rare and your detector has any false-positive rate, most alerts are noise.",
  },

  {
    id: "p-ants-rod",
    title: "Ants on a Rod",
    difficulty: "medium",
    category: "brainteaser",
    asked: ["Jane Street", "SIG"],
    problem:
      "N ants are placed on a meter-long rod at distinct random positions. Each ant faces left or right (independently 50/50) and walks at 1 m/s. When two ants collide they instantly reverse direction. When an ant reaches an end, it falls off. What is the expected time until the rod is empty?",
    hint: "Two ants colliding is equivalent to two ants passing through each other (relabel them).",
    answer: "Expected time depends on placement, but worst case is 1 second. With random placements, expected is < 1.",
    solution:
      "**The trick:** Two ants colliding and reversing is observationally identical to two indistinguishable ants passing through each other. If you don't track ant *identities* and just count ants, the system is just N independent ants walking straight without interaction.\n\nEach ant walks straight at 1 m/s and falls off in at most 1 second (the length of the rod). So the rod is empty in at most 1 second regardless of N.\n\n**The interview follow-up:** What is the expected time? Each individual ant's exit time is its remaining distance to the edge it's heading toward. The full-system exit time is the *maximum* over all ants of their exit times. For uniform placements with random directions, this max time has a closed form (depends on N) but the answer is always ≤ 1 second.\n\n**Lesson:** Reframing the problem so that 'particles pass through' makes a hard correlated dynamics question into N trivial independent ones.",
  },

  {
    id: "p-bertrand-box",
    title: "Bertrand Box Paradox",
    difficulty: "medium",
    category: "conditional",
    asked: ["SIG"],
    problem:
      "Three boxes: one contains two gold coins, one contains two silver coins, one contains one of each. You pick a box uniformly at random, then a coin uniformly at random from that box. The coin is gold. What is the probability the other coin in the same box is also gold?",
    hint: "Count gold coins, not boxes.",
    answer: "2/3",
    solution:
      "Naive wrong answer: 1/2 (since the box is either GG or GS).\n\nThe trap is conditioning on *boxes* instead of *gold coins*. There are 3 gold coins in total. Two of them are in the GG box; one is in the GS box. Given you saw a gold coin, each of the 3 was equally likely to be the one you picked. Two of the three live with a gold sibling. So P = 2/3.\n\nFormally: P(GG | gold) = P(gold | GG)·P(GG) / P(gold) = (1)(1/3) / (1/2) = 2/3.\n\n**Why interviewers love it:** It catches people who *think* they understand Bayes but reach for a wrong frame. The key skill is: when conditioning on an observation, count *observations*, not *containers*.",
  },

  {
    id: "p-two-children",
    title: "Two-Children Problem",
    difficulty: "medium",
    category: "conditional",
    asked: ["Jane Street", "SIG"],
    problem:
      "A man has two children. (a) Given that at least one is a boy, what is the probability both are boys? (b) Given that the eldest is a boy, what is the probability both are boys?",
    hint: "The information you're given is different in (a) vs (b). Enumerate the sample space.",
    answer: "(a) 1/3,   (b) 1/2",
    solution:
      "Sample space: BB, BG, GB, GG, each prior 1/4.\n\n**(a) 'At least one boy.'** This eliminates GG. Remaining: BB, BG, GB — equally likely. Only BB has two boys. P = 1/3.\n\n**(b) 'Eldest is a boy.'** This eliminates GB and GG. Remaining: BB, BG. P(BB) = 1/2.\n\n**The lesson:** 'At least one' aggregates over two outcomes (BG and GB), making BB relatively rarer (1 out of 3). 'Eldest is X' picks out only one of those two, making BB equiprobable with its sibling case.\n\n**Tuesday gotcha:** Famously: 'I have two children, at least one is a boy born on a Tuesday.' Probability both are boys? Not 1/3 — it's 13/27. The day-of-week specifier reweights the sample space. (Worth verifying yourself; it teaches that specificity affects conditioning.)",
  },

  {
    id: "p-circle-points-60",
    title: "Two Random Points on a Circle",
    difficulty: "medium",
    category: "distributions",
    asked: ["Jane Street", "Citadel"],
    problem:
      "Two points are chosen uniformly at random on the circumference of a circle. What is the probability the arc between them (the shorter one) is less than 60°?",
    hint: "Fix one point WLOG; the answer depends only on the other point's relative position.",
    answer: "1/3",
    solution:
      "By rotational symmetry, fix the first point at angle 0. The second point is uniform on [0°, 360°).\n\nThe shorter arc is < 60° iff the second point is within 60° of the first — i.e., in [0°, 60°) ∪ (300°, 360°). That's a measure of 120° out of 360°. So P = 120/360 = 1/3.\n\n**Bertrand's paradox generalization:** 'Random chord' problems are sneaky because there are multiple natural uniform distributions (random endpoints, random midpoint, random radius). They give different answers. Here we picked random endpoints, which is the most natural for 'two random points.' Other versions of Bertrand's question give 1/4 or 1/2.",
    simulation: `import random, math

trials = 1_000_000
hits = 0
for _ in range(trials):
    a, b = random.random() * 2 * math.pi, random.random() * 2 * math.pi
    arc = min(abs(a - b), 2 * math.pi - abs(a - b))
    if arc < math.pi / 3:
        hits += 1
print(f"empirical: {hits/trials:.4f}  (theory 0.3333)")`,
  },

  {
    id: "p-russian-roulette",
    title: "Russian Roulette: Spin or Not?",
    difficulty: "medium",
    category: "conditional",
    asked: ["HRT", "Optiver"],
    problem:
      "A revolver has 6 chambers, 2 of which (adjacent) hold bullets. The cylinder is spun once. You're forced to play and the first trigger pull is a click (empty). Before the second trigger pull, you're offered: spin again or just pull. What do you do?",
    hint: "Condition on which of the 4 empty chambers was the one you survived.",
    answer: "Don't spin. P(survive next | no spin) = 3/4 vs 4/6 = 2/3 with a spin.",
    solution:
      "**With re-spin:** 4 of 6 chambers are empty, so survival is 4/6 = 2/3.\n\n**Without re-spin:** You know you're at an empty chamber. Where? The 6 chambers are E E E E B B (in some order, with the two B's adjacent). There are 6 ways to rotate this layout into 'chamber 1 position' — 4 of which put an empty chamber there.\n\nGiven you're at an empty chamber, what's the probability the *next* chamber is empty? Of the 4 empty positions you could be at, only 1 has a bullet immediately after (the one right before the two bullets). The other 3 have an empty chamber after. So P(next is empty | this is empty) = 3/4.\n\n3/4 > 2/3 → don't spin.\n\n**Why interviewers ask:** It tests whether you can reason about *adjacency structure* under conditioning, not just count chambers naively.",
  },

  {
    id: "p-st-petersburg",
    title: "St. Petersburg Paradox",
    difficulty: "medium",
    category: "expected-value",
    asked: ["Jane Street"],
    problem:
      "A casino offers a game: flip a fair coin until tails. If tails appears on the k-th flip, you win 2^k dollars. How much would you pay to play?",
    hint: "Compute the expected payout. Then notice what utility theory says about the gap.",
    answer:
      "E[payout] = infinity, but most people will only pay $5–$20. The gap is the paradox.",
    solution:
      "Probability of exactly k flips is (1/2)^k. Payout is 2^k. Expected payout per realization: sum over k of (1/2)^k · 2^k = sum of 1 = infinity.\n\nBut no one will pay even $1000 to play, let alone infinity. Why?\n\nResolutions:\n1. **Log utility (Bernoulli).** If utility is log(wealth), E[log payout] is finite. A person with finite wealth caps the realistic upside. This gives the modern foundation of expected utility theory.\n2. **Finite bankroll.** The casino can't actually pay 2^100. If the cap is C, E[payout] ≈ log_2(C). At C = $1M, fair price ≈ $20.\n3. **Variance.** The variance is infinite. By the law of large numbers, *average* payout over n plays diverges as n → ∞ — but slowly. You'd need an unrealistic number of trials.\n\n**Quant relevance:** Trades with thin-tailed but heavy positive payoffs (deep OTM options, lottery tickets) look like St Petersburg slices. Theoretical EV doesn't tell you how to size them. Kelly criterion does.",
  },

  {
    id: "p-secretary-problem",
    title: "The Secretary Problem (Optimal Stopping)",
    difficulty: "hard",
    category: "stopping",
    asked: ["Jane Street", "SIG"],
    problem:
      "You interview n candidates one at a time, in random order. After each you must accept (and stop) or reject (forever). You can rank candidates only relative to those already seen. What strategy maximizes the probability of hiring the best, and what is that probability?",
    hint: "Sample-then-leap: reject the first k as a calibration, then hire the next one better than all of them.",
    answer: "Reject n/e ≈ 37%; success probability → 1/e ≈ 36.8%.",
    solution:
      "**Strategy:** Reject the first k candidates outright. Then accept the next one who is better than all of those.\n\n**Optimal k:** Let P(success | reject first k) = sum over positions i > k of P(i is best AND none in (k, i-1) is better than the best of first k).\n\nWorking through the sum: P(k) = (k/n) · sum_{i=k+1}^{n} 1/(i-1).\n\nDifferentiate and you get k* ≈ n/e. Substituting back: P(success) → 1/e ≈ 0.368 as n → ∞.\n\n**Intuition:** Without a sample phase you have no idea what 'good' looks like. With too long a sample, you've probably already passed the best. The trade-off optimizes at the inverse of Euler's number.\n\n**Why it matters in finance:** This is the prototype 'optimal stopping' problem. Same math governs when to exercise an American option, when to take a trade with deteriorating signal, when to fire a bad strategy.",
    simulation: `import random

def secretary(n: int, k: int) -> bool:
    perm = list(range(n))
    random.shuffle(perm)
    threshold = max(perm[:k]) if k > 0 else -1
    for x in perm[k:]:
        if x > threshold:
            return x == n - 1
    return False

n = 100
trials = 100_000
k = round(n / 2.718281828)
wins = sum(secretary(n, k) for _ in range(trials))
print(f"k = n/e = {k}: success = {wins/trials:.4f}  (theory ≈ 0.368)")`,
  },

  {
    id: "p-random-uniform-sum",
    title: "Sum of Uniforms Until Exceeding 1",
    difficulty: "medium",
    category: "expected-value",
    asked: ["Jane Street", "Citadel"],
    problem:
      "You draw uniform [0,1] random variables one at a time and add them. What is the expected number drawn until the cumulative sum first exceeds 1?",
    hint: "Use the volume / geometric argument: P(N > k) = P(sum of k uniforms ≤ 1) = 1/k!.",
    answer: "e ≈ 2.7183",
    solution:
      "Let N be the number of draws needed for the sum to exceed 1.\n\nP(N > k) = P(U_1 + U_2 + ... + U_k ≤ 1).\n\nThe joint distribution of k i.i.d. uniforms is uniform on the unit cube; the region where their sum ≤ 1 is a simplex of volume 1/k!.\n\nE[N] = sum_{k=0}^{∞} P(N > k) = sum_{k=0}^{∞} 1/k! = e.\n\n**Elegance:** The expected count to overflow 1 is exactly Euler's number, by the simplex-volume formula. This is one of the canonical 'beautiful' results that quant interviewers love because it pops out of recognizing the connection between probability and geometry.",
    simulation: `import random

def draws_to_exceed_one() -> int:
    s = 0.0
    n = 0
    while s <= 1:
        s += random.random()
        n += 1
    return n

trials = 1_000_000
print(f"empirical: {sum(draws_to_exceed_one() for _ in range(trials))/trials:.4f}  (theory e ≈ 2.7183)")`,
  },

  {
    id: "p-drunkard-1d",
    title: "Drunkard's Walk Returns to Origin",
    difficulty: "hard",
    category: "random-walk",
    asked: ["Citadel", "HRT"],
    problem:
      "A drunkard starts at 0 on the integer line. Each step they go +1 or -1 with equal probability. Will they almost surely return to the origin? What about in 2D? 3D?",
    hint: "Pólya's theorem. The answer depends on dimension.",
    answer: "1D, 2D: yes (recurrent). 3D and higher: no (transient).",
    solution:
      "**1D:** P(return) = 1. The walk is recurrent. Expected return time is INFINITE — the walk returns but very slowly.\n\n**2D:** Also recurrent. P(return) = 1. Slower than 1D.\n\n**3D and up:** TRANSIENT. There's a positive probability the walk never returns. For 3D, P(return) ≈ 0.3405.\n\n**Pólya's intuition:** Time spent near the origin is governed by the local return probability per step, which scales as ~1/√t in 1D, ~1/t in 2D, ~1/t^{3/2} in 3D. The sum diverges in 1D/2D (so cumulative time near origin is infinite — must return) and converges in 3D+ (so the walk escapes with positive probability).\n\n**Quant relevance:** Mean reversion vs trend. A pair of cointegrated stocks behaves like a 1D walk in spread space — recurrent, so the spread returns. A multi-factor portfolio in high dimension can drift without bound. Dimensionality determines whether you're trading mean reversion or a one-way bet.",
  },

  {
    id: "p-gamblers-ruin",
    title: "Gambler's Ruin",
    difficulty: "medium",
    category: "random-walk",
    asked: ["Jane Street", "SIG"],
    problem:
      "You start with $k and bet $1 at a time on a fair coin (50/50). You stop when you hit $0 (ruined) or $n (target). What is the probability you reach $n before $0?",
    hint: "It's a harmonic / linear / discrete-Laplace equation. Solution is linear in k.",
    answer: "P(reach n) = k/n",
    solution:
      "Let p(k) = P(reach n starting from k). Boundary: p(0) = 0, p(n) = 1. Recurrence: p(k) = (1/2)·p(k-1) + (1/2)·p(k+1) for 0 < k < n.\n\nThe recurrence says p is harmonic (zero discrete Laplacian), with linear boundary on a 1D interval — so the solution is linear: p(k) = k/n.\n\n**Biased version:** If P(win) = p ≠ 1/2 and q = 1 - p, then p(k) = (1 - (q/p)^k) / (1 - (q/p)^n). At small edge, you can grow your bankroll, but ruin is still positive.\n\n**Practical lesson:** Even with a fair game, if you keep playing against a much larger opponent, you go broke with high probability. P(reach 2k before 0 starting from k) = 1/2. P(reach 1000 before 0 starting from 1) = 1/1000. This is the math behind 'the house always wins' even when the house has no edge — it has more capital.",
  },

  {
    id: "p-buffon-needle",
    title: "Buffon's Needle",
    difficulty: "hard",
    category: "distributions",
    asked: ["Jane Street"],
    problem:
      "Floor has parallel lines spaced 1 apart. Drop a needle of length 1 at random orientation and position. What is the probability the needle crosses a line?",
    hint: "Two random variables: angle θ uniform on [0, π/2] and center distance d uniform on [0, 1/2]. Crossing iff d ≤ (1/2)·sin θ.",
    answer: "2/π",
    solution:
      "Let θ be the acute angle between the needle and the lines (uniform on [0, π/2]). Let d be the distance from the needle's *center* to the nearest line (uniform on [0, 1/2]).\n\nThe needle crosses iff (1/2)·sin θ ≥ d, where the LHS is the vertical extent of the half-needle.\n\nP(cross) = ∫∫ over the region (1/2)sin θ ≥ d. The joint density is 4/π on [0, π/2] × [0, 1/2].\n\nP = (4/π) ∫_0^{π/2} (1/2)·sin θ dθ = (4/π) · (1/2) · [-cos θ]_0^{π/2} = (4/π)·(1/2)·1 = 2/π.\n\n**The kicker:** This gives an experimental way to estimate π. Drop n needles, count k crossings, then π ≈ 2n/k. Convergence is slow (~1/√n) but it works. Was reportedly used by Lazzarini in 1901 (claiming a suspiciously good answer with 3408 throws).",
    simulation: `import random, math

trials = 1_000_000
crossings = 0
for _ in range(trials):
    theta = random.uniform(0, math.pi / 2)
    d = random.uniform(0, 0.5)
    if d <= 0.5 * math.sin(theta):
        crossings += 1
print(f"empirical: {crossings/trials:.4f}  (theory 2/π ≈ {2/math.pi:.4f})")
print(f"pi estimate: {2 * trials / crossings:.5f}")`,
  },

  {
    id: "p-dice-max-three",
    title: "Expected Maximum of Three Dice",
    difficulty: "medium",
    category: "distributions",
    asked: ["SIG", "Optiver"],
    problem:
      "Roll three independent fair six-sided dice. What is the expected value of the maximum?",
    hint: "Use the tail-sum formula: E[X] = sum_{k=1}^{6} P(X ≥ k).",
    answer: "119/24 ≈ 4.958",
    solution:
      "**Tail-sum formula:** For non-negative integer X, E[X] = sum_{k=1}^{∞} P(X ≥ k).\n\nP(max ≥ k) = 1 - P(all < k) = 1 - ((k-1)/6)^3.\n\nE[max] = sum_{k=1}^{6} [1 - ((k-1)/6)^3] = 6 - (1/216)(0^3 + 1^3 + 2^3 + 3^3 + 4^3 + 5^3) = 6 - 225/216 = 6 - 25/24 = 119/24 ≈ 4.958.\n\n**General trick:** E[max of n dice with k faces] = sum_{i=1}^{k} [1 - ((i-1)/k)^n]. Generalizes to any iid samples — order statistics.\n\n**Why interviewers like it:** Tests whether you know the tail-sum identity. Most candidates try direct enumeration (compute P(max = k) for each k separately), which works but is messier. The tail-sum is one-line.",
  },

  {
    id: "p-dice-sum-100",
    title: "Expected Rolls to Exceed 100",
    difficulty: "medium",
    category: "expected-value",
    asked: ["SIG"],
    problem:
      "Roll a fair six-sided die repeatedly, summing the results. What is the expected number of rolls until the running sum exceeds 100?",
    hint: "Asymptotically, the sum grows by 3.5 per roll. Renewal theory.",
    answer: "≈ 100/3.5 + 0.5 ≈ 29.07 (with edge correction)",
    solution:
      "**Crude answer:** Each roll adds 3.5 on average. So you need about 100/3.5 ≈ 28.57 rolls.\n\n**Why the actual answer is higher:** The overshoot. When you cross 100, you overshoot by some random amount with expectation > 0 (you don't land exactly on 100). The renewal-reward theorem says the expected overshoot is E[X^2] / (2·E[X]) where X is the per-roll increment. For a fair d6, E[X] = 3.5, E[X^2] = (1+4+9+16+25+36)/6 = 91/6. So expected overshoot ≈ (91/6) / 7 = 91/42 ≈ 2.17.\n\n**Refined estimate:** Total expected sum at stop ≈ 100 + 2.17 = 102.17. Expected number of rolls ≈ 102.17 / 3.5 ≈ 29.19.\n\nClose to the true answer (~29.05 by exact recursion). The exact value can be computed via a backward DP on states 95..100 (since each roll lands at most 6 above), but the renewal argument captures the right intuition.\n\n**Lesson:** Naive 'divide by mean' is *biased low* when you have an overshoot. This matters in resampling, in stopping rules, and in any 'first crossing time' calculation.",
  },

  {
    id: "p-hat-derangement",
    title: "The Hat Check Problem",
    difficulty: "medium",
    category: "expected-value",
    asked: ["HRT"],
    problem:
      "N people leave their hats at a coatroom. The attendant returns the hats uniformly at random. What is the expected number of people who get their own hat back?",
    hint: "Linearity of expectation. Don't compute the full derangement count.",
    answer: "1, regardless of n.",
    solution:
      "Let X_i = indicator that person i gets their own hat. E[X_i] = 1/n (uniform random match).\n\nE[total] = E[sum X_i] = sum E[X_i] = n · (1/n) = 1.\n\n**Beauty:** The variables X_i are NOT independent (knowing person 1 got their hat back changes person 2's chances). But linearity of expectation doesn't care about independence. The answer is exactly 1, independent of n.\n\n**Follow-up:** What's the probability NO ONE gets their hat back? Answer: ≈ 1/e ≈ 0.368, the derangement probability. As n grows, this stabilizes at 1/e and so does P(exactly k matches) → e^{-1}/k! — the number of matches converges to Poisson(1).\n\n**Lesson:** Linearity beats independence. When asked for expected COUNTS, define indicators and sum.",
  },

  {
    id: "p-ballot",
    title: "Ballot Problem (Catalan)",
    difficulty: "hard",
    category: "counting",
    asked: ["Jane Street", "Two Sigma"],
    problem:
      "In an election, candidate A receives a votes and candidate B receives b votes, with a > b. If votes are counted in a uniformly random order, what is the probability A is strictly ahead at every step?",
    hint: "Reflection principle. Or recognize this is a Catalan-flavored random walk.",
    answer: "(a - b) / (a + b)",
    solution:
      "Use the reflection principle. A vote sequence is a path on the integer lattice — each A vote is +1, each B vote is -1. Final position is a - b. A is strictly ahead iff the path stays positive after the first step.\n\nTotal paths: C(a+b, a).\n\n**Bad paths** (those that touch 0 at some point after start): reflect them across the line y=0 starting from the first hit. This bijects bad paths with all paths starting at -1 — which is C(a+b, b-1) of them by the same step-count argument.\n\nGood paths: C(a+b, a) - C(a+b, b-1) - (paths where the first step is B, which can never satisfy 'A strictly ahead from step 1'). Simplifying:\n\nP = (a - b) / (a + b).\n\n**Notable special case:** a = b is impossible by assumption, but the limit gives the ballot problem for ties — P(stay non-negative) is the Catalan number divided by C(2a, a).\n\n**Quant relevance:** Reflection is THE technique for first-passage problems. Used in pricing barrier options under Brownian motion (geometric Brownian → use reflection in log-prices).",
  },

  {
    id: "p-friendship",
    title: "Friendship Paradox",
    difficulty: "medium",
    category: "brainteaser",
    asked: ["Two Sigma"],
    problem:
      "In a social network, your friends have more friends than you do, on average. Why?",
    hint: "Sampling bias: popular nodes appear in more friend-lists.",
    answer:
      "Because high-degree nodes are over-represented in random samples taken across the friend relation.",
    solution:
      "Pick a person uniformly at random and ask about their friend's degree. You're not sampling friends uniformly — you're sampling them weighted by edges. High-degree people show up in many friend lists; low-degree people show up in few.\n\nFormally: E[degree of a random person] = mean degree m. E[degree of a random friend of a random person] = E[deg^2] / E[deg] = m + Var(deg)/m ≥ m, with equality iff degree is constant.\n\nThe larger the variance in degrees (heavy-tailed networks like Twitter, scale-free), the bigger the gap.\n\n**Quant relevance:** Similar bias hits trading P&L: 'On average, the strategies you've heard of had great returns' (survivorship + popularity bias). Sampling matters more than the underlying distribution. The Friendship Paradox is a clean instance of size-biased sampling.",
  },

  {
    id: "p-three-coins",
    title: "Three Coins, One Biased",
    difficulty: "medium",
    category: "conditional",
    asked: ["SIG"],
    problem:
      "Three coins. Coin A is fair. Coin B comes up heads with probability 1/4. Coin C with probability 3/4. You pick one uniformly at random and flip it twice — both heads. What is the probability you picked coin C?",
    hint: "Bayes. The likelihoods differ by a factor of (3/4)^2 / (1/4)^2 = 9.",
    answer: "9/14 ≈ 0.643",
    solution:
      "P(C | HH) = P(HH | C) · P(C) / P(HH).\n\nLikelihoods: P(HH|A) = 1/4, P(HH|B) = 1/16, P(HH|C) = 9/16. Priors all 1/3.\n\nP(HH) = (1/3)(1/4 + 1/16 + 9/16) = (1/3)(4/16 + 1/16 + 9/16) = (1/3)(14/16) = 14/48 = 7/24.\n\nP(C | HH) = (1/3)(9/16) / (7/24) = (9/48) · (24/7) = 9/14.\n\n**Interview signal:** They're checking you can carry through Bayes with three hypotheses, not just two. Common error: forgetting one term in the denominator. Always verify P(H_i | E) sums to 1 over all hypotheses.",
  },

  {
    id: "p-cards-pairs",
    title: "Two Shuffled Decks — Expected Matches",
    difficulty: "medium",
    category: "expected-value",
    asked: ["Jane Street"],
    problem:
      "Two standard 52-card decks are shuffled independently. You turn over cards one at a time from both decks in sync. What is the expected number of positions where the two decks show the same card?",
    hint: "Linearity. For each position, compute P(match) and sum.",
    answer: "1",
    solution:
      "For each position i ∈ {1, ..., 52}, let X_i = 1 if the two decks match at position i. P(X_i = 1) = 1/52 (deck 2's card at position i is uniform over 52, must match deck 1's specific card).\n\nE[total matches] = 52 · (1/52) = 1.\n\n**Generalization:** With decks of size n, expected matches = 1. Independent of n!\n\nAs in the hat problem, the distribution of the count converges to Poisson(1) for large n, so P(zero matches) → 1/e. Many independent-looking 'derangement' problems have this structure.",
  },

  {
    id: "p-two-envelopes",
    title: "Two-Envelope Paradox",
    difficulty: "hard",
    category: "expected-value",
    asked: ["HRT"],
    problem:
      "Two envelopes are presented. One contains twice the amount of money the other does. You pick one; it contains X. The 'naive' EV argument: the other envelope has 2X with prob 1/2 and X/2 with prob 1/2, so its EV is 5X/4 — always switch. But by symmetry, both envelopes look the same. Where's the error?",
    hint: "The unconditional prior on the smaller amount matters. The '1/2 / 1/2' framing is implicitly conditional on X.",
    answer:
      "The argument assumes a uniform prior over amounts, which can't exist over an unbounded range. With any proper prior, the naive EV is wrong.",
    solution:
      "Let the smaller amount be Y. Then the envelopes contain Y and 2Y. If you open X = Y, the other has 2Y. If you open X = 2Y, the other has Y.\n\nThe naive switch-EV computation treats P(other = 2X | X) = 1/2 unconditionally — but that's only true if your prior over Y is flat. There is no proper distribution that makes this true for all X. Under any well-defined prior, observing X tells you something about Y, and the conditional probability P(other = 2X | X) shifts away from 1/2 as X grows.\n\n**Correct calculation:** If Y has prior π, then\nP(other = 2X | X) = π(X) / (π(X) + π(X/2))\nFor any normalizable prior, this is ≠ 1/2 except in special cases.\n\n**Takeaway:** Improper priors break expected utility. Real quant version: any 'expected return' computation that doesn't account for the distribution of opportunity cost is suspect.",
  },

  {
    id: "p-light-switches",
    title: "100 Light Switches",
    difficulty: "medium",
    category: "counting",
    asked: ["Jane Street"],
    problem:
      "100 light bulbs labeled 1..100 are off. 100 people walk through. Person k flips every k-th switch (the bulb's state toggles for every divisor of its number). At the end, which bulbs are on?",
    hint: "A bulb is on iff it was toggled an odd number of times. Count divisors.",
    answer:
      "Perfect squares: 1, 4, 9, 16, 25, 36, 49, 64, 81, 100. So 10 bulbs are on.",
    solution:
      "Bulb n is toggled once for each divisor of n. A divisor pair (d, n/d) usually contributes two toggles — except when d = n/d, i.e., when d = sqrt(n), which only happens for perfect squares.\n\nSo bulb n is toggled an *odd* number of times iff n is a perfect square. Those bulbs end up on.\n\n**Why interviewers love it:** Tests recognizing that a problem about parity reduces to a number-theory observation about divisors. The flip in framing (from 'simulate the process' to 'count divisors') is the insight.",
  },

  {
    id: "p-balls-jar",
    title: "Polya's Urn",
    difficulty: "hard",
    category: "distributions",
    asked: ["Two Sigma"],
    problem:
      "An urn contains 1 red and 1 blue ball. You draw one, observe its color, then put it back along with another ball of the same color. Repeat. After many draws, what is the distribution of the fraction of red balls?",
    hint: "It feels like it should converge to 1/2, but draws aren't independent — they reinforce each other.",
    answer:
      "The fraction of red balls converges (a.s.) to a Uniform(0, 1) random variable.",
    solution:
      "Each draw reinforces the majority — but the system never reaches a deterministic limit. Surprisingly, the limit fraction is uniformly distributed on [0,1].\n\n**Why uniform?** Polya's urn has a beautiful symmetry — every sequence of d red draws followed by n - d blue draws (in any specific order) is equally likely. So after n draws total, P(d reds) is uniform over d = 0, ..., n. As n → ∞, the limit fraction is uniform on [0,1].\n\n**Quant relevance:** This is the canonical example of preferential attachment. Markets exhibit it: a stock that goes up attracts buyers, attracts more buyers. Polya's urn is the cleanest mathematical model of momentum / herding dynamics. The Beta(a, b) distribution generalizes when you start with a reds and b blues — the limit fraction is Beta-distributed.",
    simulation: `import random
import collections

def polya(n: int) -> float:
    red, blue = 1, 1
    for _ in range(n):
        if random.random() < red / (red + blue):
            red += 1
        else:
            blue += 1
    return red / (red + blue)

trials = 10_000
limits = [polya(2000) for _ in range(trials)]
buckets = collections.Counter(int(x * 10) for x in limits)
for i in range(10):
    print(f"  [{i/10:.1f}, {(i+1)/10:.1f}): {buckets[i]/trials*100:.1f}%")
print("→ flat-ish histogram → Uniform(0,1) limit")`,
  },

  {
    id: "p-coin-three-states",
    title: "Coin Pattern Race: HHH vs THH",
    difficulty: "hard",
    category: "markov",
    asked: ["Jane Street", "Optiver"],
    problem:
      "Two players bet on coin patterns. Player A wins if HHH appears first; player B wins if THH appears first. Both watch the same sequence of fair flips. Who has the edge?",
    hint: "Set up the Markov chain. Or notice: any HHH start was preceded by something — almost always T.",
    answer: "B wins with probability 7/8.",
    solution:
      "**Intuitive argument:** For HHH to appear, the run of H's needs to start somewhere. Unless the very first three flips are H, the H-run is preceded by a T — and that T-HH-... pattern *is* THH already. So B almost always wins.\n\nMore precisely: P(A wins) = P(first three flips are HHH) = 1/8. Otherwise B wins. P(B wins) = 7/8.\n\n**Penney's game:** This is one of the simplest examples of an intransitive game. For any 3-letter pattern, there's another that beats it more than half the time. The full rule: to beat pattern XYZ, choose ¬Z–X–Y. So HHH < THH < TTH < HTT < HHT < THH ... wait, let's check: to beat HHH, ¬H–H–H = THH ✓. The interview version is to derive this from first principles for one specific pair.\n\n**Why it's surprising:** People assume pattern-matching is transitive, like 'rock < paper < scissors but at least linear.' Markov chains over pattern states make this intransitive. Same trap appears in betting strategies and arbitrage cycles.",
    simulation: `import random

def race(a: str, b: str, trials: int = 100_000) -> tuple[float, float]:
    wa = wb = 0
    for _ in range(trials):
        seq = ""
        while True:
            seq += "H" if random.random() < 0.5 else "T"
            if seq.endswith(a):
                wa += 1; break
            if seq.endswith(b):
                wb += 1; break
    return wa / trials, wb / trials

print("HHH vs THH:", race("HHH", "THH"))  # (~0.125, ~0.875)`,
  },

  {
    id: "p-birthday",
    title: "Birthday Paradox",
    difficulty: "easy",
    category: "counting",
    asked: ["everywhere"],
    problem:
      "How many people do you need in a room before the probability of a shared birthday exceeds 1/2? (Ignore leap years.)",
    hint: "Compute P(all different) and take the complement.",
    answer: "23 people.",
    solution:
      "P(all different) = 365/365 · 364/365 · 363/365 · ... · (366-n)/365.\n\nNumerically:\n- n=20: P(match) ≈ 41.1%\n- n=22: ≈ 47.6%\n- n=23: ≈ 50.7%  ← first to cross 50%\n- n=30: ≈ 70.6%\n- n=50: ≈ 97.0%\n\n**Why it feels paradoxical:** People intuit 'how many until *MY* birthday matches someone else?' — that's a *linear* problem (≈ 365/2). But 'any pair matches' grows as C(n, 2) ~ n^2 — *quadratically*. With n = 23 people, there are 253 pairs, and each has 1/365 chance of matching.\n\n**Cryptography relevance:** A hash function with 2^k possible outputs starts seeing collisions at ~2^{k/2} inputs. That's why SHA-1's 80-bit collision resistance fell — you don't need 2^160 inputs, you need 2^80.",
  },

  {
    id: "p-streak-coin",
    title: "Longest Streak of Heads in N Flips",
    difficulty: "hard",
    category: "expected-value",
    asked: ["Two Sigma", "SIG"],
    problem:
      "What is the expected length of the longest streak of consecutive heads in n flips of a fair coin?",
    hint: "Approximately log_2(n). Get the leading constant; the rest is a small additive term.",
    answer: "E[longest streak] ≈ log_2(n) − 2/3 + small bounded oscillation. For n=100, ≈ 5.99.",
    solution:
      "**Heuristic:** Number of length-k streaks in n flips ≈ n · (1/2)^k. The longest streak is the largest k for which this is ~1, giving k ≈ log_2(n).\n\nMore precisely, the longest run length L_n satisfies P(L_n < k) ≈ exp(-n · 2^{-k}). For n = 100, this transitions sharply around k ≈ 6.\n\nE[L_n] = log_2(n · ln 2) + small periodic oscillation. The small constant is γ/ln 2 − 1/2 ≈ −0.667.\n\n**For n = 100:** Theory says E[L_100] ≈ log_2(100) - 0.667 ≈ 5.97. Simulation confirms.\n\n**Quant relevance:** People are bad at this. They expect '100 flips, longest streak of ~3.' Real expectation is ~6. This is why apparent 'hot hand' streaks in trading or sports often aren't statistically significant — they're consistent with random.",
  },

  {
    id: "p-poisson-process",
    title: "Poisson Process Arrival Time",
    difficulty: "medium",
    category: "distributions",
    asked: ["HRT", "SIG"],
    problem:
      "Buses arrive at a stop according to a Poisson process with rate 1 per 10 minutes. You arrive at the stop at a random time. What is the expected time until the next bus?",
    hint: "Don't say 5 minutes. Think about the 'inspection paradox.'",
    answer: "10 minutes.",
    solution:
      "Wrong intuition: if buses come every 10 minutes on average, and I arrive halfway through an interval, I'll wait 5 minutes.\n\n**Why wrong:** I'm more likely to arrive during a LONG inter-arrival interval than a SHORT one (because long intervals cover more time). Size-biased sampling makes the inter-arrival I'm 'inside' bigger than average.\n\n**Correct answer:** For a Poisson process, inter-arrival times are i.i.d. Exponential(rate). The memoryless property says: the wait time from any point until the next arrival is itself Exponential(rate). So E[wait] = 1/rate = 10 minutes.\n\nThis means BOTH the time since the last bus AND the time until the next bus are 10 min in expectation. So the *interval you're inside* has expected length 20 min — twice the average! This is the inspection paradox.\n\n**Quant relevance:** Same phenomenon governs queue lengths, network latency, time-between-events for trading signals. Always think about whether you're sampling unconditionally or conditional on being inside an interval.",
    simulation: `import random

# Generate arrivals over a long horizon, then sample inspection points
rate = 1 / 10  # per minute
T = 100_000
arrivals = []
t = 0
while t < T:
    t += random.expovariate(rate)
    if t < T:
        arrivals.append(t)

wait_times = []
for _ in range(10_000):
    inspect_t = random.uniform(0, T)
    # Find first arrival after inspect_t
    import bisect
    idx = bisect.bisect_right(arrivals, inspect_t)
    if idx < len(arrivals):
        wait_times.append(arrivals[idx] - inspect_t)

print(f"E[wait] ≈ {sum(wait_times)/len(wait_times):.2f} min  (theory 10)")`,
  },

  {
    id: "p-wallet-game",
    title: "The Wallet Game",
    difficulty: "medium",
    category: "expected-value",
    asked: ["Jane Street"],
    problem:
      "Two players each put their wallets on the table. Whoever's wallet has less money wins both wallets. From your perspective, the EV of playing is positive (you either win your opponent's wallet plus your own = 2x your amount, or you lose your amount). Same logic applies to your opponent. How can it be a positive-EV game for both?",
    hint: "Same issue as the two-envelope paradox.",
    answer:
      "It can't. The 'positive EV' reasoning hides an improper prior over opponent's wallet contents.",
    solution:
      "The argument 'I have at least as much chance of winning as losing, but I win MORE than I lose, so it's positive EV' assumes a uniform prior over your opponent's wallet amounts — which can't exist over an unbounded support.\n\nWith any proper prior, conditioning on your own wallet amount changes your beliefs about the opponent. If you have a large amount, you're more likely to have the larger wallet, and your winning probability < 1/2.\n\nFormal: let X = your amount, Y = opponent's amount drawn i.i.d. E[payoff | X = x] = -x · P(Y < x) + E[Y · 1{Y > x}] · 1 (you win their wallet, return Y; you lose, lose x). By symmetry, the *unconditional* expected payoff is 0 — there's no edge. The conditional EV given X is positive for small X and negative for large X.\n\n**Lesson:** Whenever an EV argument feels like a free lunch, the prior is doing hidden work. This is the same trap as the two-envelope paradox (p-two-envelopes).",
  },

  {
    id: "p-frog-jumping",
    title: "Frog Jumping on N Stones",
    difficulty: "hard",
    category: "expected-value",
    asked: ["SIG"],
    problem:
      "A frog at stone 0 wants to reach stone n. From stone k it jumps uniformly to a random stone in {k+1, k+2, ..., n}. What is the expected number of jumps to reach n?",
    hint: "Let f(k) = expected jumps from k to n. Set up the recursion.",
    answer: "H_n = 1 + 1/2 + 1/3 + ... + 1/n   ≈ ln n + γ",
    solution:
      "Let f(k) = expected jumps from position k. Boundary: f(n) = 0.\n\nFrom k, the frog jumps to one of n - k stones uniformly. So:\nf(k) = 1 + (1/(n-k)) · (f(k+1) + f(k+2) + ... + f(n))\n\nWork backward. f(n-1) = 1. Try f(k) = 1/(n-k) + 1/(n-k-1) + ... + 1/1 = H_{n-k}.\n\n**Verify:** f(k) = 1 + (1/(n-k)) · sum_{j=k+1}^{n} f(j) = 1 + (1/(n-k))·(H_{n-k-1} + H_{n-k-2} + ... + H_0) — and by induction, this equals H_{n-k}. The frog at stone 0 takes expected H_n jumps.\n\n**Connection:** This is the same harmonic sum as the coupon collector! The structures are isomorphic — at each step, you're choosing uniformly which 'phase boundary' to cross.",
  },

  {
    id: "p-two-points-square",
    title: "Distance Between Two Random Points in a Unit Square",
    difficulty: "hard",
    category: "distributions",
    asked: ["Citadel"],
    problem:
      "Two points are chosen uniformly at random in the unit square [0,1]². What is the expected Euclidean distance between them?",
    hint:
      "Decompose into x and y components. E[(X_1 - X_2)^2] is easy; E[|X_1 - X_2|] is easier than the full integral.",
    answer:
      "(2 + sqrt(2) + 5·sinh^{-1}(1)) / 15  ≈ 0.5214",
    solution:
      "Direct: E[d] = ∫∫∫∫ sqrt((x1-x2)^2 + (y1-y2)^2) dx1 dx2 dy1 dy2 over [0,1]^4.\n\nThe nice intermediate quantities:\n- E[(X1 - X2)^2] = 1/6 (since Var(X1 - X2) = 2/12 = 1/6, mean 0)\n- E[|X1 - X2|] = 1/3 (compute the 1D version directly)\n\nThe joint integral for distance doesn't factor. The closed form is:\nE[d] = (2 + sqrt(2) + 5·ln(1+sqrt(2))) / 15 ≈ 0.5214.\n\n**Interview pivot:** They usually want you to set up the integral correctly, then either get the answer numerically or recognize this is 'Robbins' constant'. Bonus: same kind of problem in 3D gives a different constant (~0.66). Higher dimensions converge to sqrt(d/6) — informally, 'high-dim random points are about sqrt(d) apart.'",
    simulation: `import random, math

trials = 1_000_000
total = sum(
    math.hypot(random.random() - random.random(),
               random.random() - random.random())
    for _ in range(trials)
)
print(f"empirical: {total/trials:.4f}  (theory ≈ 0.5214)")`,
  },

  {
    id: "p-100-doors",
    title: "Boys and Girls Country",
    difficulty: "medium",
    category: "expected-value",
    asked: ["Jane Street", "HRT"],
    problem:
      "In a country, every couple keeps having children until they have a boy, then stops. (Genders are 50/50 i.i.d.) What is the expected ratio of boys to girls in the country?",
    hint: "Linearity. Boys are tied to families; girls are accumulated before a boy arrives.",
    answer: "1:1.",
    solution:
      "Every family has exactly 1 boy. The number of girls per family is geometrically distributed: P(k girls) = (1/2)^{k+1}, with E[girls] = 1.\n\nSo each family contributes (1, 1) (boy, girl-mean). Across the country, expected boy count = expected girl count.\n\n**Why this is counter-intuitive:** The stopping rule (keep going until a boy) feels biased toward boys. But for each child *individually*, the 50/50 prior holds — the parents' stopping rule doesn't change biology. The country's gender ratio is always 50/50.\n\n**Quant relevance:** This is a clean example of how stopping rules don't affect frequencies of the underlying process. Same logic disproves naive 'I'll bet until I win then stop' edge claims. Stopping rules can change risk and bankroll dynamics, but not the fair game's expectation.",
  },

  {
    id: "p-cards-streak",
    title: "First Heart in a Shuffled Deck",
    difficulty: "medium",
    category: "expected-value",
    asked: ["Jane Street"],
    problem:
      "Cards are turned over one at a time from a shuffled standard 52-card deck. What is the expected position of the first heart?",
    hint: "Think of the 13 hearts as dividers among the 39 non-hearts. By symmetry, expected gaps are equal.",
    answer: "53/14 ≈ 3.786",
    solution:
      "The 13 hearts divide the deck into 14 'gaps' (before the 1st heart, between hearts, after the last heart). The 39 non-hearts are distributed among these gaps. By symmetry, each gap has 39/14 non-hearts in expectation.\n\nExpected number of non-hearts before the first heart = 39/14. So the first heart's position = 39/14 + 1 = 53/14 ≈ 3.786.\n\n**Generalization:** For m 'targets' in n total cards, expected position of first target = (n + 1) / (m + 1).\n\n**Lesson:** Symmetry-by-gaps is a clean technique for expected positional statistics. Beats writing out the full sum.",
  },

  {
    id: "p-coin-bias-estimate",
    title: "Estimating a Biased Coin from k Flips",
    difficulty: "medium",
    category: "distributions",
    asked: ["HRT", "Citadel"],
    problem:
      "A coin has unknown bias p, uniform prior on [0, 1]. You flip it n times and see k heads. What is the posterior distribution and the Bayes estimate of p?",
    hint: "Beta-Bernoulli conjugacy.",
    answer: "Posterior is Beta(k+1, n-k+1). Bayes estimate (posterior mean) is (k+1)/(n+2).",
    solution:
      "Beta(α, β) prior + Bernoulli(p) likelihood → posterior Beta(α + k, β + n - k).\n\nUniform = Beta(1, 1). So posterior is Beta(k+1, n-k+1). Mean of Beta(a, b) is a/(a+b), so posterior mean = (k+1)/(n+2).\n\n**Laplace's rule of succession:** If you've seen the sun rise n times and never seen it not rise, P(it rises tomorrow) under uniform prior is (n+1)/(n+2). Famously used to debate inductive reasoning in the 1700s.\n\n**Why this matters:** Conjugate priors give closed-form Bayesian updates, which makes them the cleanest tool for online learning. Same machinery powers Thompson sampling for multi-armed bandit problems — i.e., adaptive trading strategy evaluation.",
  },

  {
    id: "p-snake-charmer",
    title: "Two Snakes Approach Each Other",
    difficulty: "hard",
    category: "random-walk",
    asked: ["Two Sigma"],
    problem:
      "Two snakes start at positions 0 and L on the integer line. Each second, each snake independently moves +1 or -1 (50/50). What is the probability they ever meet?",
    hint: "Difference of two independent random walks is itself a random walk with double the step size. Reduce to a single random walk hitting 0.",
    answer: "1 (they meet with probability 1 in 1D).",
    solution:
      "Let D_t = X_t - Y_t be the gap. Each step, D changes by +2, 0, -2, or 0 with probabilities 1/4, 1/4, 1/4, 1/4 → equivalently +1, 0, -1 with probabilities 1/4, 1/2, 1/4 (after dividing by 2).\n\nD_t is a symmetric (lazy) random walk on the integers, starting from L. By Pólya's recurrence theorem, any symmetric 1D random walk is recurrent — D_t hits 0 with probability 1.\n\n**But expected meeting time is infinite.** Same as the drunkard's return to origin: certain, but slow.\n\n**Generalization:** In 2D, two random walkers will meet with probability 1 (also recurrent). In 3D+, they meet with positive probability < 1 (transient).\n\n**Lesson:** Dimensionality determines whether random objects in 'opposing motion' eventually collide. Trading desks, electric charges, predator-prey models — they all have this geometry baked in.",
  },
];
