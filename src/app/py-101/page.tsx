"use client";

import { OrderedFeed } from "@/components/common/OrderedFeed";
import { py101, type Lesson, type LessonTier } from "@/data/py101";

const TRACK_COLOR = "#22c55e";

const TIER_COLOR: Record<LessonTier, string> = {
  intro: "#22c55e",
  core: "#4f8ef7",
  applied: "#a855f7",
};

function renderLesson(l: Lesson, isRevealed: boolean) {
  const accent = TIER_COLOR[l.tier];
  return (
    <>
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold border"
          style={{ color: accent, background: `${accent}1a`, borderColor: `${accent}55` }}
        >
          {l.tier}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
          #{l.order}
        </span>
      </div>

      <h2 className="text-base font-semibold text-[var(--foreground)] mb-2">{l.title}</h2>

      <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-3">
        {l.concept}
      </p>

      <pre className="overflow-auto rounded-lg bg-[var(--background)] border border-[var(--border-subtle)] p-4 text-[12px] leading-relaxed text-[var(--foreground)] font-mono whitespace-pre mb-3">
        <code>{l.code}</code>
      </pre>

      {!isRevealed && (
        <div
          className="text-sm px-4 py-2 rounded-lg font-medium self-start"
          style={{ background: TRACK_COLOR, color: "white" }}
        >
          Tap for explanation + gotcha
        </div>
      )}

      {isRevealed && (
        <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
              What's happening
            </p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
              {l.explanation}
            </p>
          </div>
          {l.gotcha && (
            <div className="rounded-lg border border-[var(--accent-orange)]/30 bg-[var(--accent-orange)]/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--accent-orange)] mb-1">
                Common gotcha
              </p>
              <p className="text-sm text-[var(--text-secondary)]">{l.gotcha}</p>
            </div>
          )}
          {l.exercise && (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Try it yourself
              </p>
              <p className="text-sm text-[var(--text-secondary)] italic">{l.exercise}</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function Py101Page() {
  return (
    <OrderedFeed<Lesson>
      items={py101}
      getId={(l) => l.id}
      renderCard={renderLesson}
      title="Python 101"
      blurb="From print() to classes. 24 lessons in order. Start at the top."
      accentColor={TRACK_COLOR}
    />
  );
}
