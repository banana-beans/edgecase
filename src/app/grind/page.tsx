"use client";

import { SnapFeed } from "@/components/common/SnapFeed";
import {
  leetcodeProblems,
  type LeetCodeProblem,
  type Difficulty,
} from "@/data/leetcode";

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  easy: "#22c55e",
  medium: "#f59e0b",
  hard: "#ef4444",
};

function renderProblem(p: LeetCodeProblem, isRevealed: boolean) {
  const accent = DIFFICULTY_COLOR[p.difficulty];
  return (
    <>
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold border"
          style={{ color: accent, background: `${accent}1a`, borderColor: `${accent}55` }}
        >
          {DIFFICULTY_LABEL[p.difficulty]}
        </span>
        {p.topics.slice(0, 3).map((t) => (
          <span key={t} className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            {t}
          </span>
        ))}
        {p.leetcodeNumber ? (
          <span className="text-[10px] text-[var(--text-muted)] ml-auto tabular-nums">
            #{p.leetcodeNumber}
          </span>
        ) : null}
      </div>

      <h2 className="text-base font-semibold text-[var(--foreground)] mb-3">{p.title}</h2>

      <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-3 whitespace-pre-wrap">
        {p.problem}
      </p>

      {p.examples.length > 0 && (
        <div className="space-y-2 mb-3">
          {p.examples.map((ex, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] p-3 text-xs font-mono"
            >
              <div className="text-[var(--text-muted)]">Input:</div>
              <div className="text-[var(--foreground)] whitespace-pre-wrap break-all">
                {ex.input}
              </div>
              <div className="text-[var(--text-muted)] mt-1">Output:</div>
              <div className="text-[var(--foreground)] whitespace-pre-wrap break-all">
                {ex.output}
              </div>
              {ex.explanation && (
                <div className="text-[var(--text-muted)] mt-1 italic">{ex.explanation}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {!isRevealed && (
        <div
          className="text-sm px-4 py-2 rounded-lg font-medium self-start"
          style={{ background: "var(--accent-blue)", color: "white" }}
        >
          Tap to reveal solution
        </div>
      )}

      {isRevealed && (
        <div className="mt-2 space-y-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            <span className="font-semibold text-[var(--foreground)]">Approach: </span>
            {p.approach}
          </p>
          <pre className="overflow-auto rounded-lg bg-[var(--background)] border border-[var(--border-subtle)] p-4 text-[13px] leading-relaxed text-[var(--foreground)] font-mono whitespace-pre">
            <code>{p.code}</code>
          </pre>
          <div className="flex gap-4 text-xs text-[var(--text-muted)] font-mono">
            <span>
              <span className="text-[var(--text-secondary)]">Time:</span> {p.complexity.time}
            </span>
            <span>
              <span className="text-[var(--text-secondary)]">Space:</span> {p.complexity.space}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

export default function GrindPage() {
  return (
    <SnapFeed<LeetCodeProblem, Difficulty>
      items={leetcodeProblems}
      getId={(p) => p.id}
      renderCard={renderProblem}
      title="Grind"
      blurb="Interview reps. Try to solve, then tap to reveal."
      filters={[
        { key: "easy", label: "Easy", color: DIFFICULTY_COLOR.easy },
        { key: "medium", label: "Medium", color: DIFFICULTY_COLOR.medium },
        { key: "hard", label: "Hard", color: DIFFICULTY_COLOR.hard },
      ]}
      passesFilter={(p, f) => p.difficulty === f}
    />
  );
}
