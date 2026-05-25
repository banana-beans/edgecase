import Link from "next/link";
import { Card } from "@/components/common/Card";
import { TRACK_META, ROUTES, type TrackId } from "@/lib/routes";

const FOUNDATIONS_ORDER: TrackId[] = ["py101", "math101", "np101"];
const INTERVIEW_ORDER: TrackId[] = [
  "python",
  "probability",
  "grind",
  "pricing",
  "stats",
  "cpp",
  "sim",
];

const TICKER =
  "AAPL +0.42  GOOG -1.18  MSFT +0.07  NVDA +3.21  TSLA -0.55  SPY +0.14  QQQ +0.31  GLD -0.08  TLT +0.22  HYG -0.04  VIX +1.12  ";

export default function HomePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
      {/* Hero with tape */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] py-1.5 overflow-hidden">
          <div className="tape-anim text-[10px] font-mono text-[var(--text-muted)] tabular-nums">
            {TICKER.repeat(4)}
          </div>
        </div>
        <div className="p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">
            Daily Drill ·{" "}
            {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </p>
          <h1 className="text-2xl font-bold text-[var(--foreground)] leading-tight">
            Zero to hero, one drill at a time.
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
            Foundations first if you're new. Then interview prep across the four
            tracks every quant interview drills.
          </p>
        </div>
      </section>

      {/* New-here callout */}
      <Link href={ROUTES.PY101} className="block">
        <Card interactive accent="#22c55e">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-white"
              style={{ background: "#22c55e" }}
            >
              1
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-[#22c55e] font-semibold">
                New here? Start here.
              </p>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Python 101 — from print() to classes
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                24 lessons, in order. Then Math 101 → Numpy/Pandas → Interview prep.
              </p>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-muted)]">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </Card>
      </Link>

      {/* Foundations */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Foundations</h2>
          <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
            for zero-code start
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {FOUNDATIONS_ORDER.map((id, i) => {
            const meta = TRACK_META[id];
            return (
              <Link key={id} href={meta.href} className="block">
                <Card interactive accent={meta.color} className="h-full">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                      style={{ background: `${meta.color}1a`, color: meta.color }}
                    >
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                        {meta.title}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] leading-snug truncate">
                        {meta.blurb}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Interview prep */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
            Interview prep
          </h2>
          <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
            once foundations done
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {INTERVIEW_ORDER.map((id) => {
            const meta = TRACK_META[id];
            const isActive = meta.status === "active";
            return (
              <Link key={id} href={meta.href} className="block">
                <Card interactive accent={meta.color} className="h-full">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: meta.color }}
                      />
                      <span className="text-sm font-semibold text-[var(--foreground)]">
                        {meta.title}
                      </span>
                      {!isActive && (
                        <span className="ml-auto text-[9px] uppercase tracking-wider text-[var(--text-muted)] border border-[var(--border)] rounded-full px-1.5 py-0.5">
                          soon
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] leading-snug">
                      {meta.blurb}
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <p className="text-[10px] text-center text-[var(--text-muted)] pt-4">
        edgecase · v0.2 · personal quant prep
      </p>
    </div>
  );
}
