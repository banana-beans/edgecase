# Follow-ups

Open items to pick up in future sessions. Add new items at the top; mark done with `~~strikethrough~~` and date.

---

## Open

### Wire up GitHub + Vercel deploy

**Discovered:** 2026-05-24.

The repo is initialized locally but not pushed anywhere. Before content can land in front of you on phone, need:

- Create GitHub repo (private or public — TBD)
- `git remote add origin` + first push
- Vercel project linked to the repo (auto-deploy on push to main)
- Pick a custom domain (edgecase.dev? edgecase.app? edge-case.io?)

---

### Port LeetCode-finance feed from learner

**Discovered:** 2026-05-24.

Learner has `src/data/leetcode/{seed,finance,index}.ts` and `src/app/grind/page.tsx` that already implement a tap-to-reveal TikTok feed. Port them, then start growing the problem bank to ~50 unique items.

**Action.** Copy `src/data/leetcode/` and `src/app/grind/page.tsx` from learner. Adapt types if needed. Replace the current `grind/page.tsx` stub.

---

### Probability puzzle deck — seed 30

**Discovered:** 2026-05-24.

The biggest content lever for week 1. Need a schema (problem / solution / hint / category) and a tap-to-reveal UI similar to /grind. Seed with 30 actually-asked interview puzzles.

**Action.** Define `src/data/puzzles/types.ts`, write 30 puzzles in `src/data/puzzles/probability.ts`, implement feed UI at `src/app/probability/page.tsx`.

---

### Greeks playground v1

**Discovered:** 2026-05-24.

The pricing track needs at least one interactive piece in v1 — the killer differentiator vs reading a textbook. Black-Scholes calculator with sliders for spot/strike/vol/time, showing price + all five Greeks live.

**Action.** Implement BS formula in `src/lib/black-scholes.ts`, build slider UI at `src/app/pricing/page.tsx`. Stretch: small charts for delta-vs-spot, gamma-vs-spot.

---

### Set up scheduled content agent

**Discovered:** 2026-05-24.

Mirror the pattern from learner (see `[[project_snippet_agent_bugs]]` memory there). A nightly scheduled remote agent that appends new puzzles / problems / snippets to the data banks. Watch for the same template-literal escaping pitfalls learner hit.
