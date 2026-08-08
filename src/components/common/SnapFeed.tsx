"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFeedProgress, feedStats } from "@/lib/feed-progress";

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type Filter<T extends string> = { key: T; label: string; color?: string };

/** Built-in progress filters, available whenever storageKey is set. */
type ProgressFilter = "unseen" | "review";

type SnapFeedProps<Item, FilterKey extends string> = {
  /** All items in the bank */
  items: Item[];
  /** Stable key per item */
  getId: (item: Item) => string;
  /** How to render a single card body. `isRevealed` toggled by user tap. */
  renderCard: (item: Item, isRevealed: boolean) => ReactNode;
  /** Title for the page header */
  title: string;
  /** One-line description under title */
  blurb: string;
  /** Active filter set (e.g. difficulty, topic) */
  filters?: Filter<FilterKey>[];
  /** Returns true if item passes current filter; called only when filter !== "all" */
  passesFilter?: (item: Item, filter: FilterKey) => boolean;
  /** Color accent (CSS var) */
  accentColor?: string;
  /** Persist seen/self-grade state in localStorage under this key.
   *  Enables the "Got it / Again" loop, progress bar, and the
   *  built-in Unseen + Review filters. */
  storageKey?: string;
};

export function SnapFeed<Item, FilterKey extends string>({
  items,
  getId,
  renderCard,
  title,
  blurb,
  filters,
  passesFilter,
  accentColor = "var(--accent-blue)",
  storageKey,
}: SnapFeedProps<Item, FilterKey>) {
  const [filter, setFilter] = useState<FilterKey | ProgressFilter | "all">("all");
  const [activeIdx, setActiveIdx] = useState(0);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { progress, update } = useFeedProgress(storageKey);

  const stats = useMemo(
    () => feedStats(progress, items.map(getId)),
    [progress, items, getId]
  );

  const pool = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unseen") return items.filter((it) => !progress[getId(it)]?.seen);
    if (filter === "review")
      return items.filter((it) => progress[getId(it)]?.grade === "again");
    if (!passesFilter) return items;
    return items.filter((it) => passesFilter(it, filter as FilterKey));
    // progress intentionally NOT a dep for unseen/review: freezing the pool
    // while grading stops cards vanishing mid-swipe. Re-picking the filter
    // or shuffling recomputes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filter, passesFilter, shuffleSeed]);

  const feed = useMemo(() => {
    return shuffle(pool);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, shuffleSeed]);

  useEffect(() => {
    setActiveIdx(0);
    containerRef.current?.scrollTo({ top: 0 });
  }, [feed]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || feed.length === 0) return;
    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-card]"));
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || e.intersectionRatio < 0.6) continue;
          const idx = Number((e.target as HTMLElement).dataset.idx);
          setActiveIdx(idx);
        }
      },
      { root, threshold: [0.6] }
    );
    cards.forEach((c) => obs.observe(c));
    return () => obs.disconnect();
  }, [feed]);

  function reveal(id: string) {
    setRevealed((prev) => {
      const next = !prev[id];
      if (next) update(id, { seen: true });
      return { ...prev, [id]: next };
    });
  }

  function grade(id: string, g: "got" | "again", idx: number) {
    update(id, { grade: g });
    // Advance to the next card — keeps the loop moving, one thumb.
    const nextCard = containerRef.current?.querySelector<HTMLElement>(
      `[data-idx="${idx + 1}"]`
    );
    nextCard?.scrollIntoView({ behavior: "smooth" });
  }

  const allFilter: Filter<"all"> = { key: "all", label: "All" };
  const progressFilters: Filter<ProgressFilter>[] = storageKey
    ? [
        { key: "unseen", label: "Unseen" },
        { key: "review", label: `Review${stats.again > 0 ? ` (${stats.again})` : ""}`, color: "#f59e0b" },
      ]
    : [];
  const fullFilters = [allFilter, ...progressFilters, ...(filters ?? [])];

  const pct = stats.total > 0 ? Math.round((stats.got / stats.total) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            {title}
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{blurb}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            {pool.length} item{pool.length === 1 ? "" : "s"}
          </span>
          <button
            onClick={() => setShuffleSeed((s) => s + 1)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Shuffle
          </button>
        </div>
      </div>

      {/* Mastery bar — only when this feed tracks progress */}
      {storageKey && stats.total > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${pct}%`, background: accentColor }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[var(--text-muted)] tabular-nums">
            <span>
              {stats.got} of {stats.total} mastered
            </span>
            <span>
              {stats.again > 0 ? `${stats.again} to review` : `${stats.total - stats.seen} unseen`}
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      {fullFilters.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {fullFilters.map((f) => {
            const active = filter === f.key;
            const color = f.color ?? accentColor;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as FilterKey | ProgressFilter | "all")}
                className="text-xs px-3 py-1 rounded-full border transition-colors whitespace-nowrap shrink-0"
                style={
                  active
                    ? {
                        color,
                        background: `${color.startsWith("var(") ? "#4f8ef7" : color}1a`,
                        borderColor: `${color.startsWith("var(") ? "#4f8ef7" : color}55`,
                      }
                    : {
                        color: "var(--text-muted)",
                        borderColor: "var(--border)",
                      }
                }
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Feed */}
      {feed.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center gap-3 h-[calc(100dvh-220px)] md:h-[calc(100dvh-180px)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6">
          <div className="text-4xl">{filter === "review" ? "🎯" : "🧠"}</div>
          <p className="text-sm text-[var(--text-muted)]">
            {filter === "review"
              ? "Review queue is empty. Nothing marked Again."
              : filter === "unseen"
                ? "You have seen every card here. Switch to Review or All."
                : "No items in this filter."}
          </p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative overflow-y-scroll snap-y snap-mandatory h-[calc(100dvh-220px)] md:h-[calc(100dvh-180px)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
        >
          {feed.map((item, i) => {
            const id = getId(item);
            const isRevealed = !!revealed[id];
            const itemGrade = progress[id]?.grade;
            return (
              <article
                key={id}
                data-card
                data-idx={i}
                onClick={() => reveal(id)}
                className="snap-start snap-always h-full flex flex-col p-5 relative overflow-y-auto cursor-pointer"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {renderCard(item, isRevealed)}

                {/* Self-grade loop — active recall is the whole point */}
                {isRevealed && storageKey && (
                  <div
                    className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => grade(id, "again", i)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors"
                      style={{
                        color: "#f59e0b",
                        borderColor: itemGrade === "again" ? "#f59e0b" : "#f59e0b55",
                        background: "#f59e0b14",
                      }}
                    >
                      Again ↻
                    </button>
                    <button
                      onClick={() => grade(id, "got", i)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors"
                      style={{
                        color: "#22c55e",
                        borderColor: itemGrade === "got" ? "#22c55e" : "#22c55e55",
                        background: "#22c55e14",
                      }}
                    >
                      Got it ✓
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span className="tabular-nums">
          {feed.length === 0 ? "0" : `#${activeIdx + 1} of ${feed.length}`}
        </span>
        <span className="hidden sm:inline">Tap card to reveal · swipe for next</span>
      </div>
    </div>
  );
}
