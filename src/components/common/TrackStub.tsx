import type { ReactNode } from "react";
import { Card } from "@/components/common/Card";

export function TrackStub({
  title,
  blurb,
  color,
  topics,
  plannedFeatures,
  rightAccessory,
}: {
  title: string;
  blurb: string;
  color: string;
  topics: string[];
  plannedFeatures: Array<{ name: string; status: "now" | "next" | "later" }>;
  rightAccessory?: ReactNode;
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: color }}
            />
            <span
              className="text-[10px] uppercase tracking-[0.2em] font-semibold"
              style={{ color }}
            >
              track
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] leading-tight">
            {title}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
            {blurb}
          </p>
        </div>
        {rightAccessory}
      </header>

      <Card accent={color}>
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">
          Topics
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {topics.map((t) => (
            <li
              key={t}
              className="text-xs px-2.5 py-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)]"
            >
              {t}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-3">
          Roadmap
        </p>
        <ul className="space-y-2.5">
          {plannedFeatures.map((f) => (
            <li key={f.name} className="flex items-center gap-3 text-sm">
              <span
                className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold border shrink-0 w-14 text-center"
                style={{
                  color:
                    f.status === "now"
                      ? color
                      : f.status === "next"
                      ? "var(--text-secondary)"
                      : "var(--text-muted)",
                  background:
                    f.status === "now" ? `${color}1a` : "transparent",
                  borderColor:
                    f.status === "now"
                      ? `${color}55`
                      : "var(--border)",
                }}
              >
                {f.status}
              </span>
              <span className="text-[var(--foreground)]">{f.name}</span>
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-[10px] text-center text-[var(--text-muted)]">
        v0.1 scaffold · content loading soon
      </p>
    </div>
  );
}
