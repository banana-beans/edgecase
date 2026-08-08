"use client";

// ============================================================
// Per-feed learning progress, persisted in localStorage.
// Active recall loop: reveal -> self-grade ("got it" / "again").
// Keyed per track so every SnapFeed/OrderedFeed page gets
// resume + progress + review-queue behavior for free.
// ============================================================

import { useCallback, useEffect, useState } from "react";

export type FeedGrade = "got" | "again";
export type FeedItemState = { seen: boolean; grade?: FeedGrade };
export type FeedProgress = Record<string, FeedItemState>;

const PREFIX = "edgecase:feed:";

export function loadFeedProgress(storageKey: string): FeedProgress {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PREFIX + storageKey);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as FeedProgress) : {};
  } catch {
    return {};
  }
}

function saveFeedProgress(storageKey: string, progress: FeedProgress) {
  try {
    window.localStorage.setItem(PREFIX + storageKey, JSON.stringify(progress));
  } catch {
    // Private mode / quota — progress just won't persist. Non-fatal.
  }
}

/** Hook used by feed components. No-ops when storageKey is undefined. */
export function useFeedProgress(storageKey?: string) {
  const [progress, setProgress] = useState<FeedProgress>({});

  // Hydrate after mount (localStorage is unavailable during SSR).
  useEffect(() => {
    if (storageKey) setProgress(loadFeedProgress(storageKey));
  }, [storageKey]);

  const update = useCallback(
    (id: string, patch: Partial<FeedItemState>) => {
      if (!storageKey) return;
      setProgress((prev) => {
        const existing = prev[id];
        const next: FeedProgress = {
          ...prev,
          [id]: { ...existing, seen: existing?.seen ?? true, ...patch },
        };
        saveFeedProgress(storageKey, next);
        return next;
      });
    },
    [storageKey]
  );

  return { progress, update };
}

export function feedStats(progress: FeedProgress, ids: string[]) {
  let seen = 0;
  let got = 0;
  let again = 0;
  for (const id of ids) {
    const st = progress[id];
    if (!st?.seen) continue;
    seen++;
    if (st.grade === "got") got++;
    else if (st.grade === "again") again++;
  }
  return { total: ids.length, seen, got, again };
}
