"use client";

import { SnapFeed } from "@/components/common/SnapFeed";
import {
  pythonQuestions,
  type PyQuestion,
  type PyCategory,
  type PyDifficulty,
} from "@/data/python-qa";

const DIFFICULTY_COLOR: Record<PyDifficulty, string> = {
  junior: "#22c55e",
  mid: "#f59e0b",
  senior: "#ef4444",
};

const CATEGORY_LABEL: Record<PyCategory, string> = {
  language: "language",
  numpy: "numpy/pandas",
  finance: "finance",
  design: "design",
};

function renderQuestion(q: PyQuestion, isRevealed: boolean) {
  const accent = DIFFICULTY_COLOR[q.difficulty];
  return (
    <>
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />

      {/* Badges */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold border"
          style={{ color: accent, background: `${accent}1a`, borderColor: `${accent}55` }}
        >
          {q.difficulty}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
          {CATEGORY_LABEL[q.category]}
        </span>
      </div>

      {/* Title */}
      <h2 className="text-base font-semibold text-[var(--foreground)] mb-2">
        {q.title}
      </h2>

      {/* Signal */}
      <p className="text-[11px] italic text-[var(--text-muted)] mb-3">
        Signal: {q.signal}
      </p>

      {/* Question */}
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
          Question
        </p>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
          {q.question}
        </p>
      </div>

      {/* Watch-for hints (visible before reveal) */}
      {!isRevealed && q.watchFor && q.watchFor.length > 0 && (
        <details
          className="mb-3"
          onClick={(e) => e.stopPropagation()}
        >
          <summary className="text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--foreground)]">
            What to watch for
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)] list-disc list-inside">
            {q.watchFor.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
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
        <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Solution
          </p>
          <pre className="overflow-auto rounded-lg bg-[var(--background)] border border-[var(--border-subtle)] p-4 text-[12px] leading-relaxed text-[var(--foreground)] font-mono whitespace-pre">
            <code>{q.solution}</code>
          </pre>
          {q.followUp && (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Follow-up
              </p>
              <p className="text-sm text-[var(--text-secondary)] italic">
                {q.followUp}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

type FilterKey = PyDifficulty | PyCategory;

export default function PythonPage() {
  return (
    <SnapFeed<PyQuestion, FilterKey>
      items={pythonQuestions}
      getId={(q) => q.id}
      renderCard={renderQuestion}
      title="Python Q&A"
      blurb="Questions a quant dev would actually ask. Solutions heavily commented."
      filters={[
        { key: "junior", label: "Junior", color: DIFFICULTY_COLOR.junior },
        { key: "mid", label: "Mid", color: DIFFICULTY_COLOR.mid },
        { key: "senior", label: "Senior", color: DIFFICULTY_COLOR.senior },
        { key: "language", label: "Language" },
        { key: "numpy", label: "Numpy/Pandas" },
        { key: "finance", label: "Finance" },
        { key: "design", label: "Design" },
      ]}
      passesFilter={(q, f) =>
        q.difficulty === f || q.category === f
      }
      accentColor="var(--accent-blue)"
    />
  );
}
