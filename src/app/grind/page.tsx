import { TrackStub } from "@/components/common/TrackStub";
import { TRACK_META } from "@/lib/routes";

const meta = TRACK_META.grind;

export default function GrindPage() {
  return (
    <TrackStub
      title={meta.title}
      blurb="LeetCode-style problems with a quant-finance twist. Tap to reveal. Snap-scroll feed."
      color={meta.color}
      topics={[
        "Streaming median",
        "K-th largest in a stream",
        "Rolling window stats (VWAP, RSI, EMA)",
        "LRU cache",
        "Top-K frequent",
        "Sliding window max",
        "Order book matching (limit + market)",
        "Backtesting harness",
        "Merge intervals (trading sessions)",
        "Two-pointer / binary search",
        "DP — best time to buy/sell stock variants",
        "Graph — currency arbitrage (Bellman-Ford)",
      ]}
      plannedFeatures={[
        { name: "TikTok-style problem feed (port from learner)", status: "now" },
        { name: "Difficulty filter + topic filter", status: "now" },
        { name: "Bookmark + 'mastered' tracking", status: "next" },
        { name: "Spaced repetition over solved problems", status: "next" },
        { name: "Mock interview mode — timed, no peeking", status: "later" },
      ]}
    />
  );
}
