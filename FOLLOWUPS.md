# Follow-ups

Open items to pick up in future sessions. Add new items at the top; mark done with `~~strikethrough~~` and date.

---

## Done

### ~~Wire up GitHub + Vercel deploy~~ (2026-05-25)

- GitHub: https://github.com/banana-beans/edgecase (public, matches learner pattern)
- Vercel: imported from GitHub via dashboard. Auto-deploys on push to main.
- Custom domain: still pending.

### ~~Port LeetCode-finance feed from learner~~ (2026-05-24)

Ported `src/data/leetcode/{seed,finance,index}.ts` and built a unified `SnapFeed` component that drives /grind, /probability, /python, /cpp.

### ~~Probability puzzle deck~~ (2026-05-24)

35 puzzles in `src/data/puzzles/probability.ts`.

### ~~Greeks playground v1~~ (2026-05-24)

`src/lib/black-scholes.ts` + interactive `/pricing` page with live Greeks and payoff chart.

---

## Open

### Pick a custom domain

**Discovered:** 2026-05-25.

Vercel gives you a `*.vercel.app` URL automatically. For a polished personal site, register a domain:
- `edgecase.dev` / `edgecase.app` / `edgecase.io` / `edge-case.dev`

Action: register at Namecheap/Cloudflare/Porkbun, then add it as a domain in the Vercel project settings.

---

### Set up scheduled content agent

**Discovered:** 2026-05-24.

Mirror the pattern from learner (see `[[project_snippet_agent_bugs]]` memory there). A nightly scheduled remote agent that appends new puzzles / problems / snippets to the data banks. Watch for the same template-literal escaping pitfalls learner hit.

---

### Build /sim — orderbook + market-making

**Discovered:** 2026-05-24.

The differentiator track. Browser-native orderbook with a strategy editor + P&L/inventory chart. Multi-week project. Defer until foundations are stable.

---

### Verify on real iPhone

**Discovered:** 2026-05-25.

After Vercel deploy, walk through on iOS Safari:
- Add to Home Screen → standalone launch
- Bottom nav respects home indicator (safe-area-inset-bottom)
- Code blocks horizontal-scroll without breaking layout
- Sliders on /pricing work with touch
- Tap-to-reveal cards work consistently
