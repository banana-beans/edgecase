import Link from "next/link";
import { Card } from "@/components/common/Card";
import { TRACK_META, type TrackId } from "@/lib/routes";

const TRACK_ORDER: TrackId[] = [
  "probability",
  "pricing",
  "stats",
  "cpp",
  "grind",
  "sim",
];

const TICKER = "AAPL +0.42  GOOG -1.18  MSFT +0.07  NVDA +3.21  TSLA -0.55  SPY +0.14  QQQ +0.31  GLD -0.08  TLT +0.22  HYG -0.04  VIX +1.12  ";

export default function HomePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
      {/* Hero */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        {/* Tape */}
        <div className="border-b border-[var(--border-subtle)] py-1.5 overflow-hidden">
          <div className="tape-anim text-[10px] font-mono text-[var(--text-muted)] tabular-nums">
            {TICKER.repeat(4)}
          </div>
        </div>

        <div className="p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">
            Daily Drill · {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </p>
          <h1 className="text-2xl font-bold text-[var(--foreground)] leading-tight">
            Zero to hero, one drill at a time.
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
            Quant interviews drill four things: probability puzzles, pricing
            intuition, stats, and code. Pick a track and start grinding.
          </p>
        </div>
      </section>

      {/* Tracks */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Tracks</h2>
          <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
            {TRACK_ORDER.length} active
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {TRACK_ORDER.map((id) => {
            const meta = TRACK_META[id];
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

      {/* Footer note */}
      <p className="text-[10px] text-center text-[var(--text-muted)] pt-4">
        edgecase · v0.1 · personal quant prep
      </p>
    </div>
  );
}
