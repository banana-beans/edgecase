"use client";

import { SnapFeed } from "@/components/common/SnapFeed";
import { cppPatterns, type CppPattern, type CppLevel } from "@/data/cpp-qa";

const LEVEL_COLOR: Record<CppLevel, string> = {
  foundations: "#22c55e",
  modern: "#4f8ef7",
  memory: "#a855f7",
  concurrency: "#f59e0b",
  hft: "#ef4444",
};

const LEVEL_LABEL: Record<CppLevel, string> = {
  foundations: "foundations",
  modern: "modern C++",
  memory: "memory",
  concurrency: "concurrency",
  hft: "HFT",
};

function renderPattern(p: CppPattern, isRevealed: boolean) {
  const accent = LEVEL_COLOR[p.level];
  return (
    <>
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold border"
          style={{ color: accent, background: `${accent}1a`, borderColor: `${accent}55` }}
        >
          {LEVEL_LABEL[p.level]}
        </span>
      </div>

      <h2 className="text-base font-semibold text-[var(--foreground)] mb-2">
        {p.title}
      </h2>

      <p className="text-[11px] italic text-[var(--text-muted)] mb-3">
        Signal: {p.signal}
      </p>

      {!isRevealed && (
        <div
          className="text-sm px-4 py-2 rounded-lg font-medium self-start"
          style={{ background: "var(--track-cpp)", color: "white" }}
        >
          Tap to reveal pattern
        </div>
      )}

      {isRevealed && (
        <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
          <pre className="overflow-auto rounded-lg bg-[var(--background)] border border-[var(--border-subtle)] p-4 text-[12px] leading-relaxed text-[var(--foreground)] font-mono whitespace-pre">
            <code>{p.code}</code>
          </pre>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
              When to use
            </p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {p.whenToUse}
            </p>
          </div>

          {p.trap && (
            <div className="rounded-lg border border-[var(--accent-orange)]/30 bg-[var(--accent-orange)]/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--accent-orange)] mb-1">
                Trap
              </p>
              <p className="text-sm text-[var(--text-secondary)]">{p.trap}</p>
            </div>
          )}

          {p.followUp && (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Interviewer follow-up
              </p>
              <p className="text-sm text-[var(--text-secondary)] italic">
                {p.followUp}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function CppPage() {
  return (
    <SnapFeed<CppPattern, CppLevel>
      items={cppPatterns}
      getId={(p) => p.id}
      renderCard={renderPattern}
      title="C++ / HFT"
      blurb="Modern C++ patterns with HFT-grade explanations."
      filters={[
        { key: "foundations", label: "Foundations", color: LEVEL_COLOR.foundations },
        { key: "modern", label: "Modern", color: LEVEL_COLOR.modern },
        { key: "memory", label: "Memory", color: LEVEL_COLOR.memory },
        { key: "concurrency", label: "Concurrency", color: LEVEL_COLOR.concurrency },
        { key: "hft", label: "HFT", color: LEVEL_COLOR.hft },
      ]}
      passesFilter={(p, f) => p.level === f}
      accentColor="var(--track-cpp)"
    />
  );
}
