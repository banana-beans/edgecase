"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFeedProgress } from "@/lib/feed-progress";

// ============================================================
// Like SnapFeed but DOESN'T shuffle. For foundations tracks where
// lesson order matters. Shows progress ("lesson 3 of 24"), and when
// storageKey is set it remembers which lessons you've opened and
// resumes at the first unread one — commute-friendly.
// ============================================================

type OrderedFeedProps<Item> = {
  items: Item[];
  getId: (item: Item) => string;
  renderCard: (item: Item, isRevealed: boolean) => ReactNode;
  title: string;
  blurb: string;
  accentColor?: string;
  /** Persist which lessons were opened; enables resume. */
  storageKey?: string;
};

export function OrderedFeed<Item>({
  items,
  getId,
  renderCard,
  title,
  blurb,
  accentColor = "var(--accent-blue)",
  storageKey,
}: OrderedFeedProps<Item>) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const resumedRef = useRef(false);
  const { progress, update } = useFeedProgress(storageKey);

  const doneCount = items.reduce(
    (n, it) => n + (progress[getId(it)]?.seen ? 1 : 0),
    0
  );

  useEffect(() => {
    const root = containerRef.current;
    if (!root || items.length === 0) return;
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
  }, [items]);

  // Resume at the first unread lesson, once, after progress hydrates.
  useEffect(() => {
    if (!storageKey || resumedRef.current) return;
    if (Object.keys(progress).length === 0) return;
    resumedRef.current = true;
    const firstUnread = items.findIndex((it) => !progress[getId(it)]?.seen);
    if (firstUnread > 0) {
      containerRef.current
        ?.querySelector<HTMLElement>(`[data-idx="${firstUnread}"]`)
        ?.scrollIntoView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, storageKey, items]);

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = !prev[id];
      if (next) update(id, { seen: true });
      return { ...prev, [id]: next };
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-1 flex flex-col gap-3 feed-page-h">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            {title}
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{blurb}</p>
        </div>
        <span className="text-xs text-[var(--text-muted)] tabular-nums shrink-0">
          {storageKey
            ? `${doneCount}/${items.length} read`
            : `${items.length} lesson${items.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {items.map((it, i) => {
          const read = storageKey
            ? !!progress[getId(it)]?.seen
            : i <= activeIdx;
          return (
            <div
              key={i}
              className="h-1 flex-1 min-w-[6px] rounded-full transition-colors"
              style={{
                background:
                  i === activeIdx
                    ? accentColor
                    : read
                      ? `color-mix(in srgb, ${accentColor} 45%, var(--surface-3))`
                      : "var(--surface-3)",
              }}
            />
          );
        })}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center gap-3 flex-1 min-h-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6">
          <p className="text-sm text-[var(--text-muted)]">No lessons yet.</p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative overflow-y-scroll snap-y snap-mandatory flex-1 min-h-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
        >
          {items.map((item, i) => {
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

      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span className="tabular-nums">
          Lesson {activeIdx + 1} of {items.length}
        </span>
        <span className="hidden sm:inline">Tap card · swipe for next</span>
      </div>
    </div>
  );
}
