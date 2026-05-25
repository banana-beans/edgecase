import { TrackStub } from "@/components/common/TrackStub";
import { TRACK_META } from "@/lib/routes";

const meta = TRACK_META.cpp;

export default function CppPage() {
  return (
    <TrackStub
      title={meta.title}
      blurb="HFT shops want C++ that runs at L1 cache speed. Modern idioms, lock-free data structures, low-latency mindset."
      color={meta.color}
      topics={[
        "Modern C++ (17/20/23) — auto, structured bindings, ranges",
        "Move semantics & RAII",
        "Templates & SFINAE / concepts",
        "Standard containers (when to use which)",
        "Cache lines, false sharing, prefetching",
        "Memory ordering (relaxed, acquire/release, seq_cst)",
        "std::atomic & lock-free queues",
        "OrderBook data structures (sorted maps vs L2 ladders)",
        "Matching engine basics",
        "Low-latency idioms (no allocations on hot path, branch hints)",
        "Network I/O (epoll, kernel bypass intro)",
        "Profiling (perf, flamegraph)",
      ]}
      plannedFeatures={[
        { name: "Snippet feed — annotated low-latency C++ idioms", status: "now" },
        { name: "OrderBook walkthrough — L2 ladder vs price-time priority", status: "next" },
        { name: "SPSC ring buffer deep-dive", status: "next" },
        { name: "WASM-compiled OrderBook playground (later)", status: "later" },
        { name: "Cache-line interactive visualizer", status: "later" },
      ]}
    />
  );
}
