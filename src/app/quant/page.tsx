"use client";

import { SnapFeed } from "@/components/common/SnapFeed";
import {
  quantResearchQuestions,
  QR_MODULE_META,
  type QRQuestion,
  type QRModuleId,
  type QRDifficulty,
} from "@/data/quant-research";

const DIFFICULTY_COLOR: Record<QRDifficulty, string> = {
  warmup: "#22c55e",
  core: "#f59e0b",
  hard: "#ef4444",
};

const MODULE_IDS = Object.keys(QR_MODULE_META) as QRModuleId[];

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
        {label}
      </p>
      {children}
    </div>
  );
}

function renderQuestion(q: QRQuestion, isRevealed: boolean) {
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
          {QR_MODULE_META[q.module].label}
        </span>
      </div>

      {/* Title */}
      <h2 className="text-base font-semibold text-[var(--foreground)] mb-2">{q.title}</h2>

      {/* Question */}
      <div className="mb-3">
        <Section label="Question">
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
            {q.question}
          </p>
        </Section>
      </div>

      {!isRevealed && (
        <div
          className="text-sm px-4 py-2 rounded-lg font-medium self-start mt-auto mb-2"
          style={{ background: "var(--track-quant)", color: "white" }}
        >
          Think first, then tap
        </div>
      )}

      {isRevealed && (
        <div className="space-y-4 pb-2" onClick={(e) => e.stopPropagation()}>
          <Section label="How a quant thinks">
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
              {q.thinking}
            </p>
          </Section>

          <Section label="Answer">
            <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">
              {q.answer}
            </p>
          </Section>

          {q.python && (
            <Section label="Python">
              <pre className="overflow-auto rounded-lg bg-[var(--background)] border border-[var(--border-subtle)] p-4 text-[12px] leading-relaxed text-[var(--foreground)] font-mono whitespace-pre">
                <code>{q.python}</code>
              </pre>
            </Section>
          )}

          {q.trap && (
            <div className="rounded-lg border border-[#ef444455] bg-[#ef44441a] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#ef4444] mb-1">Trap</p>
              <p className="text-sm text-[var(--text-secondary)]">{q.trap}</p>
            </div>
          )}

          {q.followUp && (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Follow-up
              </p>
              <p className="text-sm text-[var(--text-secondary)] italic">{q.followUp}</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

type FilterKey = QRDifficulty | QRModuleId;

export default function QuantResearchPage() {
  return (
    <SnapFeed<QRQuestion, FilterKey>
      items={quantResearchQuestions}
      getId={(q) => q.id}
      renderCard={renderQuestion}
      title="Quant Research"
      blurb="The research workflow, end to end. Reason it out loud before you reveal."
      filters={[
        { key: "warmup", label: "Warmup", color: DIFFICULTY_COLOR.warmup },
        { key: "core", label: "Core", color: DIFFICULTY_COLOR.core },
        { key: "hard", label: "Hard", color: DIFFICULTY_COLOR.hard },
        ...MODULE_IDS.map((m) => ({ key: m, label: QR_MODULE_META[m].short })),
      ]}
      passesFilter={(q, f) => q.difficulty === f || q.module === f}
      accentColor="var(--track-quant)"
      storageKey="quant"
    />
  );
}
