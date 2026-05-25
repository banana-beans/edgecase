import type { MathLesson } from "./index";

// ============================================================
// 22 math lessons in order:
// 1-12: probability (counting → distributions → CLT)
// 13-17: calculus (derivatives → integrals)
// 18-22: linear algebra (vectors → matmul → eigenvalues)
// ============================================================

export const math101Lessons: MathLesson[] = [
  // ---------- PROBABILITY ----------
  {
    id: "math-counting",
    order: 1,
    title: "Counting — Permutations vs Combinations",
    tier: "prob",
    concept:
      "Permutation = order matters. Combination = order doesn't. P(n,k) = n!/(n-k)!. C(n,k) = n!/(k!(n-k)!).",
    code: `from math import factorial, comb, perm

# 5! = 120
print(factorial(5))

# How many ways to seat 3 people in 5 chairs?  (order matters)
print(perm(5, 3))        # 60 = 5*4*3

# How many ways to choose 3 of 5 people for a committee?  (order ignored)
print(comb(5, 3))        # 10`,
    explanation:
      "Almost every probability problem starts with counting. 'How many outcomes are there?' is the question; permutations and combinations are the tools.\n\nMnemonic: in a permutation, ABC and BCA are DIFFERENT. In a combination, they're the SAME (same set of people).",
    exercise:
      "How many 5-card poker hands are there? (Answer: comb(52, 5) = 2,598,960.)",
  },

  {
    id: "math-prob-axioms",
    order: 2,
    title: "Probability — The Three Axioms",
    tier: "prob",
    concept:
      "A probability is a number in [0, 1] assigned to an event. The whole sample space has probability 1. Probabilities of MUTUALLY EXCLUSIVE events add.",
    code: `# Roll one fair die. Sample space S = {1, 2, 3, 4, 5, 6}.
# Each outcome has probability 1/6.

# P(even) = P(2) + P(4) + P(6) = 3/6 = 1/2
print(3 / 6)

# P(even OR > 3) — careful, not mutually exclusive (4 and 6 are both)
# Inclusion-exclusion: P(A or B) = P(A) + P(B) - P(A and B)
P_even = 3 / 6
P_gt3 = 3 / 6
P_both = 2 / 6      # {4, 6}
print(P_even + P_gt3 - P_both)   # 4/6`,
    explanation:
      "These three rules are the entire foundation of probability. Most mistakes come from forgetting inclusion-exclusion (adding P(A) + P(B) when A and B aren't disjoint).\n\nThe sample space (all possible outcomes) must add up to exactly 1. Probability is just measure on a set.",
    exercise:
      "P(roll a 1 OR a prime number)? Primes from a die: 2, 3, 5. Use inclusion-exclusion.",
  },

  {
    id: "math-conditional",
    order: 3,
    title: "Conditional Probability",
    tier: "prob",
    concept:
      "P(A | B) = 'probability of A GIVEN that B happened' = P(A and B) / P(B). Conditioning shrinks the sample space.",
    code: `# Roll a die. What's P(die is 1 GIVEN that it's odd)?
# Sample space restricted to odd rolls: {1, 3, 5}
# Of those, only one is "1". So P(1 | odd) = 1/3.

# Formal way: P(1 and odd) / P(odd) = (1/6) / (3/6) = 1/3
print((1/6) / (3/6))

# Independence: A and B are independent iff P(A|B) = P(A).
# Equivalently, P(A and B) = P(A) * P(B).
# Coin flips are independent: P(HH) = P(H)*P(H) = 1/2 * 1/2 = 1/4`,
    explanation:
      "Conditioning is the most powerful tool in probability. 'Given X, what's the chance of Y?' restructures the problem to a smaller sample space where you can think more clearly.\n\nIndependence is a SPECIAL CASE where conditioning doesn't change anything. Most quant questions test whether you can identify what's NOT independent (e.g., consecutive returns in a trending market).",
    exercise:
      "Draw two cards without replacement. P(2nd is an ace | 1st is an ace)? Answer: 3/51.",
  },

  {
    id: "math-bayes",
    order: 4,
    title: "Bayes' Theorem",
    tier: "prob",
    concept:
      "Bayes flips conditional probabilities: P(A|B) = P(B|A)·P(A) / P(B). It's how you UPDATE beliefs given new evidence.",
    code: `# Disease test: 1% prevalence, 99% sensitivity, 99% specificity.
# You test positive. What's P(actually sick)?

prevalence  = 0.01      # P(sick)
sensitivity = 0.99      # P(positive | sick)
specificity = 0.99      # P(negative | healthy)

P_sick     = prevalence
P_healthy  = 1 - prevalence
P_pos_sick    = sensitivity
P_pos_healthy = 1 - specificity     # false-positive rate
P_pos = P_sick * P_pos_sick + P_healthy * P_pos_healthy

P_sick_given_pos = (P_pos_sick * P_sick) / P_pos
print(P_sick_given_pos)        # 0.5  — only 50% chance you're sick!`,
    explanation:
      "Bayes is THE quant interview question. It tests whether you can update beliefs in a numerically rigorous way.\n\nThe surprising answer (50%, not 99%) is the 'base rate fallacy' — a rare condition + an imperfect test produces lots of false positives in absolute terms. Verbalize it: 'Even with a 99% test, when the disease is rare, most positives are false.'",
    exercise:
      "Same test, 0.1% prevalence. P(sick | positive)? (Should be much lower than 50%.)",
  },

  {
    id: "math-rv",
    order: 5,
    title: "Random Variables",
    tier: "prob",
    concept:
      "A random variable (RV) assigns a NUMBER to each outcome. Roll of a die: X = 1, 2, ..., 6. Sum of two dice: X = 2..12.",
    code: `# Random variable X = result of one die roll
# Distribution: P(X=k) = 1/6 for k in 1..6

# Simulate
import random
rolls = [random.randint(1, 6) for _ in range(10_000)]
mean_empirical = sum(rolls) / len(rolls)
print(mean_empirical)          # ≈ 3.5

# Discrete vs continuous:
# Discrete RV — countable values (dice, coin flips).
# Continuous RV — values in an interval (price, time, distance).`,
    explanation:
      "Random variables let us do MATH with random outcomes. Instead of describing events ('the die shows 6'), we describe numbers ('X = 6'). Once we have numbers, we can compute means, variances, do regression, etc.\n\nLowercase 'x' is a specific value; capital 'X' is the random variable. P(X = x) is a function of x called the probability mass function (discrete) or density function (continuous).",
    exercise:
      "X = sum of two dice. List P(X=k) for k = 2, 3, ..., 12. (Hint: most common sum is 7.)",
  },

  {
    id: "math-ev",
    order: 6,
    title: "Expected Value",
    tier: "prob",
    concept:
      "E[X] = the WEIGHTED AVERAGE of X's values, weighted by their probabilities. E[X] = Σ x · P(X=x).",
    code: `# Fair die: E[X] = 1*(1/6) + 2*(1/6) + ... + 6*(1/6) = 3.5
ev = sum(k * (1/6) for k in range(1, 7))
print(ev)               # 3.5

# A bet: win $100 with prob 0.4, lose $30 with prob 0.6
# E[payoff] = 100 * 0.4 + (-30) * 0.6 = 40 - 18 = 22
ev_bet = 100 * 0.4 + (-30) * 0.6
print(ev_bet)           # 22.0 — positive EV, take it`,
    explanation:
      "Expected value is the SINGLE most important concept in quantitative finance. Every trading decision boils down to 'is this positive EV?'.\n\nNote: EV is what you'd average over many repetitions. A single play can wildly miss the EV. Variance / risk is the other half of the story.",
    exercise:
      "You pay $1 to play a game where you win $10 with prob 0.05, else $0. EV?",
  },

  {
    id: "math-variance",
    order: 7,
    title: "Variance and Standard Deviation",
    tier: "prob",
    concept:
      "Var(X) = E[(X − E[X])²] = average squared deviation from the mean. Standard deviation σ = √Var(X) — same units as X.",
    code: `# For a die roll
ev = 3.5
var = sum((k - ev) ** 2 * (1/6) for k in range(1, 7))
print(var)              # 2.9166...
print(var ** 0.5)       # 1.707...  std dev

# Useful identity:
# Var(X) = E[X²] - E[X]²
ex2 = sum(k * k * (1/6) for k in range(1, 7))
print(ex2 - ev * ev)    # same answer, often easier to compute`,
    explanation:
      "Variance measures DISPERSION. Two distributions can have the same mean but very different variance — one always near the mean, the other often far away. In finance, variance of returns = risk.\n\nThe square is annoying but mathematically convenient (makes derivatives nice, leads to Pythagorean-like identities). σ is what you usually report because it's in the original units (dollars, returns, etc.).",
    exercise:
      "A coin flip pays $1 for heads, $0 for tails. E[X]? Var[X]?",
  },

  {
    id: "math-linearity",
    order: 8,
    title: "Linearity of Expectation",
    tier: "prob",
    concept:
      "E[X + Y] = E[X] + E[Y] ALWAYS — even when X and Y are dependent. This is the most useful fact in probability.",
    code: `# Roll 100 dice. E[sum] = ?
# Each die has E[X_i] = 3.5. So E[sum] = 100 * 3.5 = 350.
# Doesn't matter that the dice are independent — linearity is unconditional.

# Counterexample candidate: cards. Draw 2 from a deck.
# E[number of aces drawn]?
# Use indicator variables. Let Y_i = 1 if card i is an ace, else 0.
# E[Y_i] = 4/52 (each card is uniformly random over 52 cards).
# E[Y_1 + Y_2] = 4/52 + 4/52 = 2/13.
# Even though Y_1 and Y_2 are NOT independent (drawing without replacement), linearity holds.

import random
n_aces = 0
trials = 100_000
for _ in range(trials):
    deck = list(range(52))
    random.shuffle(deck)
    n_aces += sum(1 for c in deck[:2] if c < 4)
print(n_aces / trials)      # ≈ 2/13 = 0.1538`,
    explanation:
      "Linearity is a hammer. Whenever you're computing E[something], try to decompose 'something' into a SUM of indicator variables. Each indicator's expectation is easy. The total is just the sum.\n\nThis solves: hat-check problem, coupon collector, expected matches in shuffled decks, etc. Trick: decompose by indicators.",
    exercise:
      "100 letters in 100 envelopes, randomly placed. E[number of letters in their right envelope]? Use linearity.",
  },

  {
    id: "math-bernoulli-binomial",
    order: 9,
    title: "Bernoulli and Binomial",
    tier: "prob",
    concept:
      "Bernoulli(p) = single trial, 1 with prob p, 0 with prob 1−p. Binomial(n, p) = sum of n independent Bernoullis. Mean np, variance np(1−p).",
    code: `from math import comb

# Binomial: P(k successes in n trials with success prob p)
def binom(n, k, p):
    return comb(n, k) * (p ** k) * ((1 - p) ** (n - k))

# Flip a fair coin 10 times. P(exactly 5 heads)?
print(binom(10, 5, 0.5))     # 0.246  — about 1/4

# At least 8 heads in 10 flips?
print(sum(binom(10, k, 0.5) for k in range(8, 11)))   # 0.055

# Mean and variance of Binomial(n, p):
n, p = 100, 0.3
mean = n * p              # 30
var  = n * p * (1 - p)    # 21`,
    explanation:
      "Binomial pops up wherever you have repeated independent yes/no trials. # of fills out of n orders sent, # of winning trades out of n attempts, # of head-counts in coin flip games.\n\nMean = np makes intuitive sense (n trials each with average p successes). Variance scales linearly with n — adding more trials lets the mean grow faster than the standard deviation (which is √n·√(p(1-p))). This is why averages converge.",
    exercise:
      "100 trades, each with 55% win rate. Mean wins? Std dev? (Should be 55 ± ~5.)",
  },

  {
    id: "math-normal",
    order: 10,
    title: "The Normal Distribution",
    tier: "prob",
    concept:
      "The bell curve. Parameterized by mean μ and std σ. P(X is within μ ± 1σ) ≈ 68%. ±2σ ≈ 95%. ±3σ ≈ 99.7%.",
    code: `from scipy.stats import norm

# Standard normal: μ=0, σ=1. Total area under the curve = 1.
# CDF: probability X ≤ x.
print(norm.cdf(0))         # 0.5  — half the curve is below 0
print(norm.cdf(1))         # 0.8413
print(norm.cdf(1.96))      # 0.975  — famous 95% one-sided
print(norm.cdf(-1))        # 0.1587

# Two-tailed: P(|X| > 1.96) ≈ 5%. This is where the "p < 0.05" rule comes from.
print(2 * (1 - norm.cdf(1.96)))    # ≈ 0.05

# Inverse CDF — quantile / "inverse" lookup
print(norm.ppf(0.975))     # 1.96`,
    explanation:
      "The normal distribution is at the heart of statistics and finance. Returns are often APPROXIMATELY normal (with caveats — fat tails are real). Hypothesis tests, confidence intervals, Black-Scholes — all built on the normal.\n\nThe 68/95/99.7 rule is a quick mental check. If you tell someone 'this signal has 3σ significance,' they should hear 'rarer than 1 in 300.'",
    exercise:
      "A stock's daily return is normal with mean 0.0005 and σ = 0.01. P(loses more than 2% in a day)?",
  },

  {
    id: "math-clt",
    order: 11,
    title: "Central Limit Theorem",
    tier: "prob",
    concept:
      "Sums of many independent RVs are approximately NORMAL, regardless of the original distribution. Why averages cluster around a bell curve.",
    code: `import random

# Roll 100 dice. Sum has mean 350 (= 100 * 3.5) and variance 291.67.
# Despite a die being uniform (not bell-shaped), the SUM is bell-shaped.

import math
sums = []
for _ in range(10_000):
    sums.append(sum(random.randint(1, 6) for _ in range(100)))

# Approximate mean and std
mean = sum(sums) / len(sums)
var = sum((s - mean) ** 2 for s in sums) / len(sums)
print(mean, math.sqrt(var))     # ≈ 350, ≈ 17

# Plot would show a normal curve centered at 350.`,
    explanation:
      "Why is the normal distribution so ubiquitous? Because of the CLT. Pick almost ANY distribution (with finite variance), sample n times, take the average — for large n that average is approximately normal.\n\nThis is why a stock's daily return (a sum of many tiny independent shocks throughout the day) is roughly normal — even if individual shocks aren't. It's also why estimators behave well: standard errors are normal-ish.",
    exercise:
      "Roll one die 10 times and take the mean. Repeat 10,000 times. Histogram should look normal-ish, centered at 3.5.",
  },

  {
    id: "math-independence",
    order: 12,
    title: "Independence and Covariance",
    tier: "prob",
    concept:
      "Two RVs are independent if knowing one tells you nothing about the other. Cov(X,Y) = E[(X−μX)(Y−μY)] measures HOW MUCH they move together.",
    code: `# Independence: P(X=x and Y=y) = P(X=x) * P(Y=y) for all x, y
# Equivalently: E[XY] = E[X] * E[Y]
# Independent → uncorrelated (Cov=0), but Cov=0 does NOT imply independent.

# Correlation = Cov(X,Y) / (σ_X σ_Y), bounded in [-1, 1]

import statistics

# Two trading strategies, correlated returns
import random
random.seed(0)
shocks = [random.gauss(0, 0.01) for _ in range(1000)]
common = [random.gauss(0, 0.005) for _ in range(1000)]

r1 = [s + c for s, c in zip(shocks, common)]
r2 = [random.gauss(0, 0.01) + c for c in common]

mean1, mean2 = statistics.mean(r1), statistics.mean(r2)
n = len(r1)
cov = sum((r1[i] - mean1) * (r2[i] - mean2) for i in range(n)) / n
print(cov)
# Standardize → correlation
corr = cov / (statistics.stdev(r1) * statistics.stdev(r2))
print(corr)        # should be positive (shared "common" component)`,
    explanation:
      "Correlation is THE most-used summary statistic in trading. 'These two assets have correlation 0.8' is the language of risk.\n\nVariance of a sum: Var(X+Y) = Var(X) + Var(Y) + 2·Cov(X,Y). For UNcorrelated X,Y, the cross term vanishes and 'risks add in quadrature.' This is the basis of diversification.",
    exercise:
      "Two stocks have σ = 20% and corr = 0.5. Variance of equal-weight portfolio?",
  },

  // ---------- CALCULUS ----------
  {
    id: "math-derivative",
    order: 13,
    title: "Derivatives — Instantaneous Slope",
    tier: "calc",
    concept:
      "The derivative f'(x) measures how fast f is changing at x — its slope. Computed as a limit of (f(x+h) − f(x)) / h as h → 0.",
    code: `# Derivative of f(x) = x² is f'(x) = 2x
# At x = 3, slope is 6.

# Numerical check
def f(x): return x * x

def deriv(f, x, h=1e-6):
    return (f(x + h) - f(x - h)) / (2 * h)   # symmetric, more accurate

print(deriv(f, 3))        # ≈ 6.0
print(deriv(f, 5))        # ≈ 10.0

# Power rule: d/dx[x^n] = n * x^(n-1)
# Sum rule: derivative of a sum is the sum of derivatives
# Chain rule: d/dx[f(g(x))] = f'(g(x)) * g'(x)`,
    explanation:
      "Derivatives are HOW we optimize. To find the minimum of a function, set derivative to zero. The Greeks in options are all derivatives — delta is dPrice/dSpot, theta is dPrice/dTime, etc.\n\nThe three rules above (power, sum, chain) cover ~90% of derivatives you'll see. Memorize them.",
    exercise:
      "Derivative of f(x) = x³ + 2x at x = 4? (Use the power and sum rules.)",
  },

  {
    id: "math-integral",
    order: 14,
    title: "Integration — Area Under the Curve",
    tier: "calc",
    concept:
      "The integral ∫f(x)dx is the area under f's graph. Fundamental theorem: integration and differentiation are inverses.",
    code: `# Integral of f(x) = x from 0 to 1 = area of triangle = 1/2

# Numerical integration — trapezoidal rule
def integrate(f, a, b, n=1000):
    h = (b - a) / n
    return h * (0.5 * f(a) + 0.5 * f(b) + sum(f(a + i*h) for i in range(1, n)))

print(integrate(lambda x: x, 0, 1))        # 0.5
print(integrate(lambda x: x * x, 0, 1))    # ≈ 0.333  (= 1/3)
print(integrate(lambda x: 1 / x, 1, 2))    # ≈ 0.693  (= ln 2)

# Probability densities integrate to 1
import math
def normal_pdf(x): return (1 / math.sqrt(2 * math.pi)) * math.exp(-x*x/2)
print(integrate(normal_pdf, -10, 10))      # ≈ 1.0`,
    explanation:
      "Continuous probability density functions are integrated to give probabilities: P(a ≤ X ≤ b) = ∫_a^b f(x)dx. Discrete sums become continuous integrals.\n\nIn pricing: expected payoff = ∫ payoff(S) · density(S) dS. The Black-Scholes formula is just this integral worked out for a normal density and call payoff.",
    exercise:
      "What's the area under f(x) = sin(x) from 0 to π? (Should be 2.)",
  },

  {
    id: "math-partial-derivs",
    order: 15,
    title: "Partial Derivatives",
    tier: "calc",
    concept:
      "When a function depends on MULTIPLE variables, the partial derivative ∂f/∂x is the slope w.r.t. x with all OTHER variables held constant.",
    code: `# f(x, y) = x²y. Partial derivatives:
#   ∂f/∂x = 2xy        (treat y as constant)
#   ∂f/∂y = x²         (treat x as constant)

# Numerical
def f(x, y): return x * x * y

def partial_x(f, x, y, h=1e-6):
    return (f(x + h, y) - f(x - h, y)) / (2 * h)

def partial_y(f, x, y, h=1e-6):
    return (f(x, y + h) - f(x, y - h)) / (2 * h)

print(partial_x(f, 3, 5))    # ≈ 30   (= 2*3*5)
print(partial_y(f, 3, 5))    # ≈ 9    (= 3²)`,
    explanation:
      "Greeks in options pricing are partial derivatives: delta = ∂Price/∂Spot, vega = ∂Price/∂Vol, etc. All the OTHER inputs are held constant.\n\nGradient = vector of all partial derivatives. Used in optimization (gradient descent: move in the direction the gradient points to find a min).",
    exercise:
      "f(x, y) = e^(xy). What's ∂f/∂x at (1, 2)? (Hint: chain rule.)",
  },

  {
    id: "math-log-exp",
    order: 16,
    title: "Log and Exp",
    tier: "calc",
    concept:
      "Inverses of each other. e^x grows continuously; ln(x) = log base e. d/dx[e^x] = e^x. d/dx[ln(x)] = 1/x.",
    code: `import math

print(math.exp(0))        # 1
print(math.exp(1))        # e ≈ 2.71828
print(math.log(math.e))   # 1

# Continuous compounding: $1 at rate r grows to e^(rT) in time T
r = 0.05    # 5% per year
T = 1       # 1 year
print(math.exp(r * T))    # 1.0513 — ~5.13% effective rate

# Log returns
import math
p0, p1 = 100, 105
log_return = math.log(p1 / p0)
print(log_return)         # 0.0488

# Why log returns? They're ADDITIVE across time.
# A 5% return then a 5% return gives total log return 2*0.0488 = 0.0976
# Equivalent to (1.05)^2 - 1 = 0.1025 simple return.
# For small returns they're nearly equal.`,
    explanation:
      "Log and exp are EVERYWHERE in finance. Continuous compounding uses e^(rT). Stock prices are modeled as exp(random walk) so they stay positive. Log returns are additive across time, which makes statistical analysis tractable.\n\nThe identity log(a·b) = log(a) + log(b) is why log returns sum (turning multiplicative growth into additive).",
    exercise:
      "A stock has a 10% log return. What's the simple return? (Hint: e^0.1 - 1.)",
  },

  {
    id: "math-optimization",
    order: 17,
    title: "Optimization — Find the Max/Min",
    tier: "calc",
    concept:
      "To find the maximum or minimum of f(x), set f'(x) = 0 and solve. Check second derivative for max vs min.",
    code: `# Find x that maximizes p · (1 - p) for p in [0, 1]
# Derivative: 1 - 2p = 0  →  p = 1/2
# That's the variance of a fair coin — maximum at p = 1/2.

# Numerical version — gradient ascent
def f(p): return p * (1 - p)
def fp(p): return 1 - 2 * p

p = 0.1
lr = 0.1
for _ in range(50):
    p = p + lr * fp(p)
print(p)              # converges to 0.5

# Multi-variable: gradient = zero vector at critical points
# Constrained optimization: Lagrange multipliers (Markowitz portfolio theory!)`,
    explanation:
      "Optimization underpins quant finance: maximize expected return for a risk constraint (Markowitz), maximize log-utility (Kelly criterion), minimize residuals (OLS).\n\nGradient descent: take small steps in the direction of -gradient. The workhorse of all of machine learning.",
    exercise:
      "Maximize f(x) = -x² + 4x + 1. (Use the derivative — should be x = 2, max = 5.)",
  },

  // ---------- LINEAR ALGEBRA ----------
  {
    id: "math-vectors",
    order: 18,
    title: "Vectors — Lists of Numbers",
    tier: "linalg",
    concept:
      "A vector is an ordered list of numbers. Add by elements, scale by multiplication. Magnitude (length) = √(sum of squares).",
    code: `import numpy as np

v = np.array([3, 4])
w = np.array([1, 2])

print(v + w)              # [4, 6]
print(2 * v)              # [6, 8]
print(np.linalg.norm(v))  # 5.0  — length of (3, 4) is 5

# Geometric interpretation:
# Vectors are arrows from the origin to a point.
# Adding vectors = head-to-tail composition.
# Scaling = stretching or shrinking.

# In quant work:
# - A weight vector is a portfolio allocation.
# - A return vector is one row of a returns matrix.
# - A feature vector is one row of design matrix X.`,
    explanation:
      "Once you start treating data as vectors, a lot of operations get cleaner. Portfolio with weights w and returns r? Portfolio return is the DOT PRODUCT w · r (next lesson).\n\nNumpy arrays ARE the data structure for vectors in Python.",
    exercise:
      "What's the length of the vector (1, 1, 1)? (Should be √3 ≈ 1.732.)",
  },

  {
    id: "math-dot-product",
    order: 19,
    title: "Dot Product",
    tier: "linalg",
    concept:
      "Dot product: u · v = Σ u_i v_i. A SINGLE NUMBER measuring how aligned two vectors are. Zero ↔ perpendicular.",
    code: `import numpy as np

# Portfolio return = weights · asset returns
weights = np.array([0.3, 0.5, 0.2])
returns = np.array([0.02, -0.01, 0.03])
portfolio_return = weights @ returns       # dot product
print(portfolio_return)                    # 0.007 = 0.7%

# Geometric interpretation
# u · v = |u| · |v| · cos(angle)
# So:
#   parallel:  u · v = |u| · |v|
#   perpendicular:  u · v = 0
#   opposite:  u · v = -|u| · |v|

# Cosine similarity = (u · v) / (|u| |v|)  ∈ [-1, 1]
# Used everywhere: document similarity, factor exposures, correlation`,
    explanation:
      "Dot product is the SINGLE most useful operation in quant. Portfolio return, factor exposure, correlation, regression — all dot products in disguise.\n\nNumpy's @ operator is matrix multiplication; for two 1D vectors it's the dot product. `np.dot(u, v)` also works.",
    exercise:
      "Compute the dot product of (1, 0, 0) and (0, 1, 0). What angle is between them?",
  },

  {
    id: "math-matrices",
    order: 20,
    title: "Matrices — 2D Arrays of Numbers",
    tier: "linalg",
    concept:
      "A matrix is a rectangular array of numbers. Rows × columns. Most quant data is in matrix form: rows = observations, columns = features.",
    code: `import numpy as np

# 3 days, 2 stocks. Rows = days, columns = stocks.
returns = np.array([
    [0.01, -0.005],   # day 1
    [0.02,  0.015],   # day 2
    [-0.01, 0.005],   # day 3
])

print(returns.shape)       # (3, 2)
print(returns[0])          # day 1: [0.01, -0.005]
print(returns[:, 0])       # all days, first stock: [0.01, 0.02, -0.01]

# Mean of each stock (column-wise)
print(returns.mean(axis=0))      # axis=0 means "collapse rows"

# Mean of each day (row-wise)
print(returns.mean(axis=1))      # axis=1 means "collapse columns"

# Identity matrix — like the number 1 for matrices
I = np.eye(3)
print(I)`,
    explanation:
      "Matrices are how you organize multi-dimensional data. Most quant code consists of matrix operations: select rows/cols, take means along axes, multiply.\n\nKnow the rule: `axis=0` collapses ROWS (gives one number per column). `axis=1` collapses COLUMNS (gives one number per row).",
    exercise:
      "Given a matrix of shape (1000, 50) — 1000 days × 50 stocks — what's the shape after `.mean(axis=0)`? After `.mean(axis=1)`?",
  },

  {
    id: "math-matmul",
    order: 21,
    title: "Matrix Multiplication",
    tier: "linalg",
    concept:
      "(AB)_ij = sum over k of A_ik · B_kj. Inner dimensions must match: (m×n) @ (n×p) → (m×p). Each cell is a dot product.",
    code: `import numpy as np

A = np.array([[1, 2], [3, 4]])           # 2x2
B = np.array([[5, 6], [7, 8]])           # 2x2

# Element [0,0] of A@B is dot product of A's row 0 with B's column 0.
# = 1*5 + 2*7 = 19
print(A @ B)
# [[19, 22],
#  [43, 50]]

# 3 days x 2 stocks  matmul  2 stocks x 1 weight  →  3 days x 1 portfolio return
returns = np.array([[0.01, -0.005], [0.02, 0.015], [-0.01, 0.005]])  # 3x2
w = np.array([[0.6], [0.4]])                                           # 2x1
port = returns @ w                                                     # 3x1
print(port)

# Matrix mult is NOT commutative: A@B != B@A in general.
# Order matters!`,
    explanation:
      "Matrix multiplication is just 'do dot products for every row-column pair.' Conceptually it composes two linear maps. In practice it's HOW you compute portfolio returns, run regressions, project features.\n\nThe shape rule (m×n) @ (n×p) → (m×p) is THE only thing to remember. The 'n's must match and they 'cancel'.",
    exercise:
      "If returns is (1000, 50) and weights is (50,) — what shape is returns @ weights?",
  },

  {
    id: "math-eigen",
    order: 22,
    title: "Eigenvalues and Eigenvectors (intro)",
    tier: "linalg",
    concept:
      "For a matrix A, an eigenvector v satisfies A·v = λ·v — the matrix stretches v by λ but doesn't rotate it. λ is the eigenvalue.",
    code: `import numpy as np

A = np.array([[3, 1],
              [0, 2]])

# Compute eigenvalues + eigenvectors
vals, vecs = np.linalg.eig(A)
print(vals)          # [3, 2]
print(vecs)
# Each COLUMN of vecs is an eigenvector

# Check: A @ v == lambda * v
v0 = vecs[:, 0]
print(A @ v0)
print(vals[0] * v0)   # should match

# Why eigenvalues matter in quant:
# - Principal Component Analysis (PCA): eigenvectors of the covariance
#   matrix tell you the principal directions of variation in your data.
# - Markowitz portfolios: eigenvectors of the cov matrix give you the
#   "principal portfolios" — orthogonal risk factors.
# - Stability: a transition matrix whose largest eigenvalue is < 1 means
#   the dynamics decay to zero (stationary AR processes).`,
    explanation:
      "Eigenvalues are the long-run scaling factors of a linear system. In a stationary AR(1) process, the eigenvalue of the transition is φ — the persistence parameter.\n\nPCA is the most direct quant application: you decompose a covariance matrix into orthogonal modes, each with an eigenvalue indicating how much variance that mode explains.\n\nDon't sweat the linear algebra theory too much for interviews. The key intuition: 'eigenvectors are the special directions where a transformation just stretches without rotating, and the eigenvalue is the stretch factor.'",
    exercise:
      "For A = [[2, 0], [0, 3]] (a diagonal matrix), what are the eigenvalues and eigenvectors? (Almost trivially.)",
  },
];
