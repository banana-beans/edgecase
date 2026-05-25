# edgecase

Quant interview prep — built for one user (me). Zero to hero across the four tracks every quant interview drills:

| Track | What it covers |
|---|---|
| **Probability** | EV, Bayes, Markov, brainteasers |
| **Pricing** | Black-Scholes, Greeks, binomial, vol |
| **Stats** | OLS, time series, cointegration, GARCH |
| **C++ / HFT** | OrderBook, lock-free, low-latency idioms |
| **Grind** | LC-finance code reps (TikTok-style feed) |
| **Sim** | Orderbook + market-making playground |

## Stack

Same as `learner`: Next 16 App Router + React 19 + Tailwind 4 + Zustand + Pyodide-for-Python. Deployed to Vercel via GitHub push.

## Dev

```bash
npm install
npm run dev   # http://localhost:8900
```

Ports: `8500=stonks · 8600=strucky · 8700=learner · 8900=edgecase · 3000=moosoo`. (8800 was squatted, hence 8900.)

## Status

v0.1 — scaffold + track stubs. See `ARCHITECTURE.md` for the curriculum spine and `FOLLOWUPS.md` for the active backlog.
