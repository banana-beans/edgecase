"use client";

import { SnapFeed } from "@/components/common/SnapFeed";
import { puzzles, type Puzzle, type PuzzleDifficulty } from "@/data/puzzles";

const DIFFICULTY_COLOR: Record<PuzzleDifficulty, string> = {
  easy: "#22c55e",
  medium: "#f59e0b",
  hard: "#ef4444",
};

const CATEGORY_LABEL: Record<string, string> = {
  counting: "counting",
  conditional: "bayes",
  "expected-value": "EV",
  distributions: "dist",
  "random-walk": "rand walk",
  markov: "markov",
  brainteaser: "teaser",
  stopping: "stopping",
};

function renderPuzzle(p: Puzzle, isRevealed: boolean) {
  const accent = DIFFICULTY_COLOR[p.difficulty];
  return (
    <>
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />

      {/* Badges */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold border"
          style={{ color: accent, background: `${accent}1a`, borderColor: `${accent}55` }}
        >
          {p.difficulty}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
          {CATEGORY_LABEL[p.category] ?? p.category}
        </span>
        {p.asked && p.asked.length > 0 && (
          <span className="text-[10px] text-[var(--text-muted)] ml-auto italic truncate max-w-[40%]">
            asked: {p.asked.join(", ")}
          </span>
        )}
      </div>

      {/* Title */}
      <h2 className="text-base font-semibold text-[var(--foreground)] mb-3">{p.title}</h2>

      {/* Problem */}
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-3 whitespace-pre-wrap">
        {p.problem}
      </p>

      {/* Hint (always visible when not revealed) */}
      {!isRevealed && (
        <>
          <details
            className="mb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <summary className="text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--foreground)] transition-colors">
              Show hint
            </summary>
            <p className="mt-2 text-xs italic text-[var(--text-secondary)]">{p.hint}</p>
          </details>
          <div
            className="text-sm px-4 py-2 rounded-lg font-medium self-start"
            style={{ background: "var(--track-prob)", color: "white" }}
          >
            Tap to reveal solution
          </div>
        </>
      )}

      {/* Solution */}
      {isRevealed && (
        <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Answer
            </p>
            <p className="text-sm font-mono text-[var(--foreground)] bg-[var(--surface-2)] rounded-md px-3 py-2 inline-block">
              {p.answer}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Solution
            </p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
              {p.solution}
            </p>
          </div>
          {p.simulation && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Verify in Python
              </p>
              <pre className="overflow-auto rounded-lg bg-[var(--background)] border border-[var(--border-subtle)] p-4 text-[12px] leading-relaxed text-[var(--foreground)] font-mono whitespace-pre">
                <code>{p.simulation}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function ProbabilityPage() {
  return (
    <SnapFeed<Puzzle, PuzzleDifficulty>
      items={puzzles}
      getId={(p) => p.id}
      renderCard={renderPuzzle}
      title="Probability"
      blurb="Quant brainteasers. Try it, peek at the hint, then reveal."
      filters={[
        { key: "easy", label: "Easy", color: DIFFICULTY_COLOR.easy },
        { key: "medium", label: "Medium", color: DIFFICULTY_COLOR.medium },
        { key: "hard", label: "Hard", color: DIFFICULTY_COLOR.hard },
      ]}
      passesFilter={(p, f) => p.difficulty === f}
      accentColor="var(--track-prob)"
    />
  );
}
