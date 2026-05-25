# edgecase — quant interview prep

## Vision

Personal quant interview prep. The premise: quant interviews drill four things — **probability, pricing, stats, code** — and you get good by doing reps with feedback. edgecase is the reps + the feedback.

Not a SaaS, not a course. One user (me). No auth, no sync, no marketing copy. Optimize ruthlessly for personal use.

## Origin

Spun off from [`learner`](https://github.com/bwu/learner) on 2026-05-24 after a failed financial-engineering interview on 2026-05-19. The quant content that landed in learner (cpp snippets, python-finance, /grind page) is the seed — but quant prep deserves its own home, its own URL, and its own content model.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next 16 | App Router, RSC for content, API routes for any future server bits |
| UI | React 19 + Tailwind 4 | Same as learner; mobile-first |
| State | Zustand 5 + persist | localStorage; no backend |
| Language | TypeScript 5 strict | Type safety for content schemas |
| Python | Pyodide (WASM) | Run quant Python (numpy, scipy) in-browser |
| Animations | Framer Motion | Bottom nav indicator, card transitions |
| Port | 8900 | Convention: 8500=stonks, 8600=strucky, 8700=learner (8800 was squatted) |

Reach goals (not v1):
- KaTeX for math typesetting (Black-Scholes, regression equations)
- `lightweight-charts` or Observable Plot for finance charts
- Emscripten for an in-browser C++ orderbook playground

## Curriculum spine — "zero to hero"

Each track has roughly the same arc: foundations → core → applied → interview-level.

### Probability (the #1 thing interviews drill)
1. **Foundations** — counting, set operations, axioms
2. **Conditional & Bayes** — diagnostic problems, base rate fallacy
3. **Expected value** — linearity, indicator method, expected value puzzles
4. **Distributions** — Bernoulli, Binomial, Poisson, Normal (CLT)
5. **Random walks** — symmetric, biased, hitting times
6. **Markov chains** — transition matrices, steady state, absorption
7. **Martingales (intro)** — optional stopping
8. **Classic brainteasers** — 100 prisoners, balls-in-urns, gambler's ruin, Monty Hall, broken stick

### Pricing
1. **Time value of money** — PV, FV, continuous compounding
2. **Forwards & futures** — no-arbitrage, cost of carry
3. **Put-call parity** — the most important pricing identity
4. **Binomial tree** — risk-neutral measure derivation
5. **Black-Scholes** — assumptions, formula, intuition for each Greek
6. **Greeks** — delta, gamma, vega, theta, rho (curves + interactions)
7. **Implied vol** — solving for IV, smile/skew, term structure
8. **Exotics (intro)** — barrier, Asian, lookback, digital
9. **Bonds & duration** — yield, convexity, immunization

### Stats
1. **Descriptive** — moments, robust stats
2. **Sampling & estimation** — bias, consistency, MSE
3. **Hypothesis testing** — Type I/II, power, p-value intuition
4. **OLS regression** — derivation, assumptions, geometry
5. **Multiple regression** — multicollinearity, FWL theorem
6. **Heteroskedasticity / autocorrelation** — White, Newey-West
7. **Time series basics** — stationarity, ACF, PACF
8. **AR / MA / ARMA / ARIMA** — model selection, forecasting
9. **Cointegration** — pairs trading, ADF/Johansen
10. **GARCH** — conditional vol, vol clustering

### C++ / HFT
1. **Modern C++** — C++17/20/23 idioms, RAII, move semantics
2. **Templates** — concepts, SFINAE, CRTP
3. **Containers** — when to use which, custom allocators
4. **Memory model** — atomics, ordering, fences
5. **Lock-free** — SPSC/MPMC ring buffers, hazard pointers
6. **Cache mechanics** — false sharing, prefetching, alignment
7. **OrderBook data structures** — L2 ladder, price-time priority
8. **Matching engine** — limit/market/IOC/FOK order types
9. **Low-latency idioms** — no allocations on hot path, branch hints, [[likely]]
10. **Profiling** — perf, flamegraph, microbenchmarks

### Grind (cross-cutting)
LeetCode-style code reps with a finance bent. Streaming median, k-th largest, rolling window stats, LRU cache, top-k frequent, sliding window max, simple matching engine, currency arbitrage, etc.

### Sim (the differentiator)
A browser-native orderbook + market-making simulator. You write a quoting function, watch it run against synthetic flow, see your P&L and inventory. The other tracks teach the math; sim teaches the *feel*.

## Directory structure

```
edgecase/
├── public/
│   └── manifest.json          # PWA
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout, dark theme, mobile-first
│   │   ├── page.tsx           # Dashboard with track tiles
│   │   ├── globals.css
│   │   ├── probability/page.tsx
│   │   ├── pricing/page.tsx
│   │   ├── stats/page.tsx
│   │   ├── cpp/page.tsx
│   │   ├── grind/page.tsx
│   │   ├── sim/page.tsx
│   │   └── profile/page.tsx
│   ├── components/
│   │   ├── common/            # Card, Button, TrackStub
│   │   └── layout/            # BottomNav
│   ├── data/
│   │   ├── problems/          # Code grind bank
│   │   ├── puzzles/           # Probability brainteasers
│   │   └── formulas/          # Pricing / stats reference
│   └── lib/
│       └── routes.ts          # Single source of truth for nav + track meta
├── ARCHITECTURE.md
├── AGENTS.md / CLAUDE.md      # AI assistant instructions
├── FOLLOWUPS.md
├── README.md
├── next.config.ts
├── package.json               # `dev` runs on port 8800
├── tsconfig.json
└── vercel.json
```

## Build phases

### Phase 1 — Scaffold (today, 2026-05-24)
- Repo + Next 16 + Tailwind boots
- Dashboard with track tiles
- 6 track stubs (probability/pricing/stats/cpp/grind/sim)
- Bottom nav, mobile-first layout
- PWA manifest + icons

### Phase 2 — Content seed (week 1, by 2026-05-31)
- /grind: port LC-finance feed from learner (≈30 problems)
- /probability: 30 brainteasers, tap-to-reveal
- /pricing: Greeks playground v1 (interactive BS)
- Deploy to Vercel + custom domain

### Phase 3 — Differentiators (week 2, by 2026-06-07)
- /stats: regression playground
- /cpp: snippet feed (port from learner cpp.ts)
- /sim: orderbook v1 with one MM strategy

### Phase 4 — Content scaling (post-MVP)
- Scheduled snippet agent (mirror learner pattern) seeds nightly
- KaTeX for math
- Spaced repetition over solved problems
- Mock interview mode

## Out of scope (v1)

- Auth / multi-user
- Backend database
- Mobile native app (PWA only)
- Live market data
- Realistic trading sim (we're not building QuantConnect)
- Course-like linear progress paths (this is a reference + reps tool, not a textbook)
