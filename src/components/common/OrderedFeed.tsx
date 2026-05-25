"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// ============================================================
// Like SnapFeed but DOESN'T shuffle. For foundations tracks where
// lesson order matters. Also shows progress (e.g. "lesson 3 of 24").
// ============================================================

type OrderedFeedProps<Item> = {
  items: Item[];
  getId: (item: Item) => string;
  renderCard: (item: Item, isRevealed: boolean) => ReactNode;
  title: string;
  blurb: string;
  accentColor?: string;
};

export function OrderedFeed<Item>({
  items,
  getId,
  renderCard,
  title,
  blurb,
  accentColor = "var(--accent-blue)",
}: OrderedFeedProps<Item>) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);

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

  function toggleReveal(id: string) {
    setRevealed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{title}</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{blurb}</p>
        </div>
        <span className="text-xs text-[var(--text-muted)] tabular-nums">
          {items.length} lesson{items.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {items.map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 min-w-[6px] rounded-full transition-colors"
            style={{
              background: i <= activeIdx ? accentColor : "var(--surface-3)",
            }}
          />
        ))}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center gap-3 h-[calc(100dvh-220px)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6">
          <p className="text-sm text-[var(--text-muted)]">No lessons yet.</p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative overflow-y-scroll snap-y snap-mandatory h-[calc(100dvh-220px)] md:h-[calc(100dvh-180px)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
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
