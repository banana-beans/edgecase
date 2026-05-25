# Agent instructions

## This is NOT the Next.js you know

This version of Next is 16.x. APIs, conventions, and file structure may differ from training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Project shape

- Personal quant interview prep, one user (the repo owner). See `ARCHITECTURE.md`.
- Spun off from sibling repo `learner` on 2026-05-24 — same stack, narrower focus.
- Six tracks: probability, pricing, stats, cpp (HFT), grind (code reps), sim (orderbook MM).

## Conventions

- Port `8800` for `npm run dev`.
- Routes are declared in `src/lib/routes.ts` — add new pages there first, then `src/app/<route>/page.tsx`.
- Track metadata (title/blurb/color) lives in `TRACK_META` in `src/lib/routes.ts`.
- Stub pages use the shared `TrackStub` component until they have real content.
- Tailwind 4 + CSS variables for theming. Track colors are CSS vars `--track-prob`, `--track-pricing`, etc.

## When asked to add content

Prefer **data files over hardcoded JSX**. Bank structure:

- `src/data/problems/` — code reps (mirror learner's `leetcode/` shape)
- `src/data/puzzles/` — probability brainteasers
- `src/data/formulas/` — pricing/stats reference

Each bank should export a typed array; the page reads from it.

## When generating quant content

Target genuinely interview-level — not undergrad textbook material. Reference: HRT, Jane Street, Citadel, SIG, Two Sigma, Optiver, IMC, Akuna. Don't include obvious puzzles (Monty Hall yes once for completeness, then nothing similar).

For probability puzzles: include the trick / non-obvious insight, not just the answer.

For pricing: emphasize intuition over derivation. The interviewer wants to see if you understand *why* delta of an ATM call is ~0.5, not if you can recite BS.

For C++: modern (C++17+), correct, and idiomatically what an HFT shop would write — not textbook examples.
