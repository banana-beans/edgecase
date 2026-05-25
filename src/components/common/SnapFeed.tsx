"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type Filter<T extends string> = { key: T; label: string; color?: string };

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
}: SnapFeedProps<Item, FilterKey>) {
  const [filter, setFilter] = useState<FilterKey | "all">("all");
  const [activeIdx, setActiveIdx] = useState(0);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const pool = useMemo(() => {
    if (filter === "all" || !passesFilter) return items;
    return items.filter((it) => passesFilter(it, filter as FilterKey));
  }, [items, filter, passesFilter]);

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

  function toggleReveal(id: string) {
    setRevealed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const allFilter: Filter<"all"> = { key: "all", label: "All" };
  const fullFilters = [allFilter, ...(filters ?? [])];

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{title}</h1>
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

      {/* Filters */}
      {filters && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {fullFilters.map((f) => {
            const active = filter === f.key;
            const color = f.color ?? accentColor;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as FilterKey | "all")}
                className="text-xs px-3 py-1 rounded-full border transition-colors whitespace-nowrap shrink-0"
                style={
                  active
                    ? {
                        color,
                        background: `${color === "var(--accent-blue)" ? "#4f8ef7" : color}1a`,
                        borderColor: `${color === "var(--accent-blue)" ? "#4f8ef7" : color}55`,
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
          <div className="text-4xl">🧠</div>
          <p className="text-sm text-[var(--text-muted)]">No items in this filter.</p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative overflow-y-scroll snap-y snap-mandatory h-[calc(100dvh-220px)] md:h-[calc(100dvh-180px)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
        >
          {feed.map((item, i) => {
            const id = getId(item);
            const isRevealed = !!revealed[id];
            return (
              <article
                key={id}
                data-card
                data-idx={i}
                onClick={() => toggleReveal(id)}
                className="snap-start snap-always h-full flex flex-col p-5 relative overflow-y-auto cursor-pointer"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {renderCard(item, isRevealed)}
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
