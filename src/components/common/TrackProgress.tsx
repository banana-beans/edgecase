"use client";

import { useEffect, useState } from "react";
import { loadFeedProgress } from "@/lib/feed-progress";

// Thin progress bar for the homepage track cards. Reads localStorage
// after mount (SSR-safe) so the static homepage stays static.

type Props = {
  storageKey: string;
  total: number;
  color: string;
  /** "grade": mastered = self-graded "got" (SnapFeed tracks).
   *  "seen": read = opened at least once (OrderedFeed tracks). */
  mode?: "grade" | "seen";
};

export function TrackProgress({ storageKey, total, color, mode = "grade" }: Props) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const progress = loadFeedProgress(storageKey);
    let n = 0;
    for (const id in progress) {
      const st = progress[id];
      if (mode === "grade" ? st?.grade === "got" : st?.seen) n++;
    }
    setCount(Math.min(n, total));
  }, [storageKey, total, mode]);

  const pct = count !== null && total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="h-1 flex-1 rounded-full bg-[var(--surface-3)] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[9px] text-[var(--text-muted)] tabular-nums shrink-0">
        {count ?? 0}/{total}
      </span>
    </div>
  );
}
