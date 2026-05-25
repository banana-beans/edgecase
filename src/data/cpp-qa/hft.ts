import type { CppPattern } from "./index";

// ============================================================
// HFT-specific patterns. These are the questions that separate
// "good C++ dev" from "HFT C++ dev."
// ============================================================

export const hft: CppPattern[] = [
  {
    id: "cpp-soa-vs-aos",
    title: "SoA vs AoS — Data Layout for the Cache",
    level: "hft",
    signal:
      "Whether the candidate optimizes for the access pattern of their hot loop, not for OOP cleanliness.",
    code: `#include <vector>
#include <cstdint>

// AoS = Array of Structs (the natural OO layout)
// SoA = Struct of Arrays (the cache-friendly layout for column-style work)
//
// The right choice depends on which fields your hot loop ACCESSES TOGETHER.

// ---- AoS — orders stored as a vector of full structs ----
struct OrderAoS {
    std::uint64_t oid;
    std::uint32_t qty;
    double        price;
    char          symbol[8];
    std::uint64_t timestamp;
    std::uint8_t  side;      // padded by alignment
    // sizeof ~= 48 bytes (with padding)
};

std::vector<OrderAoS> orders;

// Loop that touches ONLY price and qty (e.g., risk aggregation):
double aos_total_notional() {
    double total = 0;
    for (const auto& o : orders) {
        total += o.price * o.qty;
    }
    return total;
}
// Each iteration loads 48 bytes to read 12. Cache line carries ~1 useful
// element per line. Bandwidth-bound at ~25% efficiency.

// ---- SoA — separate vectors per field ----
struct OrdersSoA {
    std::vector<std::uint64_t> oid;
    std::vector<std::uint32_t> qty;
    std::vector<double>        price;
    std::vector<std::uint64_t> timestamp;
    std::vector<std::uint8_t>  side;
};

OrdersSoA s_orders;

double soa_total_notional() {
    double total = 0;
    const auto n = s_orders.price.size();
    for (std::size_t i = 0; i < n; ++i) {
        total += s_orders.price[i] * s_orders.qty[i];
    }
    return total;
}
// Now we load only the price + qty arrays. Both are densely packed.
// ~5 elements per cache line. ~5x more useful work per byte loaded.
// Compiler also auto-vectorizes this loop into SIMD trivially.

// ---- Hybrid: hot + cold ----
// In practice, often you split your struct into HOT (touched in fast
// path) and COLD (only on slow paths). Keep hot fields contiguous;
// cold fields can be a separate parallel vector or even a hash map.
struct OrderHot {
    std::uint64_t oid;       // for matching
    std::uint32_t qty;       // for fills
    double        price;     // for matching
};

struct OrderCold {
    char     symbol[8];
    char     account[16];
    std::uint64_t timestamp;
    // ... regulatory fields ...
};

// You'd keep std::vector<OrderHot> for matching loops; OrderCold lives
// elsewhere, indexed by the same row.

// ---- Real numbers from a synthetic benchmark on a modern x86 ----
//   AoS notional sum, 1M orders:  ~12 ms
//   SoA notional sum, 1M orders:  ~3 ms (4x faster, SIMD + cache)
//
// The same effect compounds when the loop has more work — pricing,
// risk decomposition, statistical aggregation — because more values
// fit in L1 cache.`,
    whenToUse:
      "Any data structure you'll iterate millions of times where the hot loop touches a SUBSET of fields. Position books, market data tapes, risk grids.",
    trap:
      "SoA makes the code more verbose and harder to reason about for single-row operations. Don't apply universally — only where the iteration pattern justifies it. Profile before refactoring.",
    followUp:
      "How does this interact with std::ranges or numpy-style array operations? When would you reach for a true columnar database (DuckDB) vs in-process SoA?",
  },

  {
    id: "cpp-branch-hints",
    title: "Branch Hints — [[likely]] / [[unlikely]]",
    level: "hft",
    signal:
      "Knowing when and how to hint the optimizer. Mostly cosmetic but reveals familiarity with branch predictor behavior.",
    code: `// C++20 [[likely]] / [[unlikely]] attributes hint to the compiler
// (and indirectly to the CPU branch predictor via code layout) which
// branch is the common path.
//
// The compiler will:
//   - Keep the [[likely]] code in the fall-through path of the branch
//     (one fewer instruction cache miss; better prefetch).
//   - Move the [[unlikely]] code OUT-OF-LINE to a cold section, so it
//     doesn't pollute the hot path's i-cache.

#include <cstdint>

// ---- Example: input validation in a hot path ----
double process_tick(double price) {
    // 99.999% of ticks are valid. Hint accordingly.
    if (price <= 0.0) [[unlikely]] {
        // Cold code: error path, expensive log call.
        log_bad_tick(price);
        return 0.0;
    }

    // Hot code: stays in the fall-through path.
    return price * 1.0001;
}

// ---- Example: switch with a dominant case ----
int parse_msg_type(char c) {
    switch (c) {
    [[likely]] case 'T': return TRADE;
    case 'Q': return QUOTE;
    case 'X': return CANCEL;
    [[unlikely]] default:
        return UNKNOWN;
    }
}

// ---- Performance reality check ----
// Modern CPUs have very good dynamic branch predictors. They learn from
// recent history within microseconds of warmup. For branches that are
// CONSISTENTLY biased, the hardware figures it out without your hints.
//
// Where [[likely]]/[[unlikely]] matter:
// 1. COLD CODE LAYOUT. The compiler can move unlikely branches out of
//    line, improving instruction cache density on the hot path.
// 2. First-execution latency, before the predictor warms up.
// 3. Anti-patterns where the compiler's default heuristic is wrong
//    (e.g., the branch back-edge in a loop).
//
// Where they DON'T:
// - Inside loops with millions of iterations of the same branch.
//   The predictor learns; the hint is noise.

// ---- Older syntax — __builtin_expect (GCC/Clang) ----
// Pre-C++20 or when you also need to communicate likelihood to the
// optimizer in non-attribute places:
int parse_msg_type_old(char c) {
    if (__builtin_expect(c == 'T', 1)) return TRADE;
    if (__builtin_expect(c == 'Q', 1)) return QUOTE;
    return UNKNOWN;
}

// Wrapping macros are common:
#define LIKELY(x)   __builtin_expect(!!(x), 1)
#define UNLIKELY(x) __builtin_expect(!!(x), 0)

// ---- How to know if your hints help ----
// 1. perf stat -e branch-misses ./prog. Lower is better.
// 2. Look at the assembly: branched-out cold code shows up as a JMP to
//    an out-of-line block. (gcc -fdump-tree-optimized or just objdump.)
// 3. Microbenchmark with and without the hint. Don't trust intuition.

enum { TRADE, QUOTE, CANCEL, UNKNOWN };
void log_bad_tick(double);`,
    whenToUse:
      "Cold error/validation paths inside hot loops. Branches where the predictor doesn't have time to warm up. Sparingly — don't litter normal code with these.",
    trap:
      "Lying to the compiler. If you hint [[likely]] on a branch that's actually 50/50, you get WORSE performance than letting the predictor figure it out. Measure before you assume your guess is right.",
  },

  {
    id: "cpp-virtual-vs-crtp",
    title: "Virtual Dispatch vs CRTP",
    level: "hft",
    signal:
      "Whether the candidate knows compile-time polymorphism exists, and when each tool is right.",
    code: `// Virtual functions: runtime polymorphism via vtable lookup.
// Cost: indirect call (defeats inlining, costs ~5 cycles on a miss).
// Benefit: heterogeneous collections, plug-in modules, late binding.
//
// CRTP (Curiously Recurring Template Pattern): compile-time poly via
// templates. Zero overhead — the call gets inlined as if you wrote
// the derived type directly.

// ---- Virtual dispatch — the classical approach ----
class Strategy {
public:
    virtual ~Strategy() = default;
    virtual void on_tick(const Tick& t) = 0;
};

class MomentumStrategy : public Strategy {
public:
    void on_tick(const Tick& t) override {
        // ...
    }
};

void run(Strategy& s, const Tick& t) {
    s.on_tick(t);    // VIRTUAL CALL: vtable lookup, ~5 cycles, no inlining
}

// ---- CRTP — compile-time polymorphism ----
// Base templated on Derived. Derived inherits from Base<Derived>.
// Calls in Base resolve at compile time via static_cast<Derived*>(this).

template <typename Derived>
class StrategyCRTP {
public:
    void on_tick(const Tick& t) {
        // Calls the derived class's on_tick. Compiler can fully INLINE
        // this, eliminating the function call entirely.
        static_cast<Derived*>(this)->on_tick_impl(t);
    }
};

class MomentumCRTP : public StrategyCRTP<MomentumCRTP> {
public:
    void on_tick_impl(const Tick& t) {
        // Same logic as before...
    }
};

template <typename S>
void run_crtp(S& s, const Tick& t) {
    s.on_tick(t);    // INLINED at compile time. Zero overhead.
}

// ---- Trade-offs ----
//
// Use virtual when:
// - You need a heterogeneous container of strategies.
// - Strategy is loaded as a plug-in (dlopen).
// - The call rate is low enough that ~5 cycles doesn't matter.
//
// Use CRTP when:
// - Call site knows the concrete type at compile time.
// - Call rate is in the inner loop (millions/sec).
// - You'd otherwise be writing the same code for each subtype.
//
// Use neither — just use templates — when:
// - You don't need a "base interface" at all. Function templates work
//   for "any T that can be called with tick".

// ---- C++20 ALTERNATIVE: concepts + std::variant ----
// For a CLOSED set of strategies known at compile time, std::variant
// + std::visit can be as fast as CRTP and arguably cleaner.

#include <variant>

class StratA { public: void on_tick(const Tick&) {} };
class StratB { public: void on_tick(const Tick&) {} };

using AnyStrategy = std::variant<StratA, StratB>;

void run_variant(AnyStrategy& s, const Tick& t) {
    std::visit([&](auto& strat) { strat.on_tick(t); }, s);
    // std::visit + lambdas: compiler can often inline. Cost varies
    // depending on visitor implementation (some compilers use a jump
    // table, others a switch).
}

struct Tick { double price; };`,
    whenToUse:
      "Default to virtual for cleanly-separated subsystems where the call site doesn't know the concrete type. Use CRTP for hot-path interfaces. Use variant + visit when the set of types is closed and known at compile time.",
    trap:
      "CRTP makes code harder to navigate (no obvious base class to look up in your IDE). It also breaks if you need a heterogeneous container — std::vector<StrategyCRTP<...>>? — you can't (the type depends on Derived). Either use virtual or wrap with std::variant.",
    followUp:
      "How do you handle a heterogeneous collection of CRTP types? (Answer: you don't, easily — that's where std::variant or type erasure with std::function come in.)",
  },

  {
    id: "cpp-order-book-l2",
    title: "Order Book — Sorted Map vs L2 Ladder",
    level: "hft",
    signal:
      "Whether the candidate has actually built or read an order book. Reveals data structure judgment under realistic constraints.",
    code: `#include <map>
#include <unordered_map>
#include <array>
#include <list>

// Three common order book designs, in order of latency optimization:
//
// 1. std::map<Price, PriceLevel>
//    Balanced BST. O(log P) lookup. Best for low-frequency / variable
//    spread / sparse prices.
//
// 2. L2 Ladder (array indexed by ticks from the midpoint)
//    O(1) lookup, no allocation. Best for fixed tick grid and known
//    price range. Used in real HFT matching engines.
//
// 3. Hash map<Price, PriceLevel>
//    O(1) lookup average, but no sorted iteration. Useful when you
//    NEVER need the price-sorted view (rare for an order book).

// ---- L2 Ladder design ----
// Pick a TICK SIZE (smallest price increment). Pick a CENTRE PRICE.
// Pick a RANGE (how many ticks above/below to cover).
// Allocate a flat array of PriceLevel, one slot per tick.

struct PriceLevel {
    std::uint64_t total_qty = 0;
    // Doubly-linked list of orders at this level, head outward = FIFO.
    OrderNode* head = nullptr;
    OrderNode* tail = nullptr;
};

struct OrderNode {
    std::uint64_t oid;
    std::uint64_t qty;
    OrderNode* prev = nullptr;
    OrderNode* next = nullptr;
    // Optionally a Pool* back-pointer so cancellation can return the node.
};

class L2Book {
public:
    // Pre-allocates 2 * range ladders + an oid lookup map.
    L2Book(std::int64_t centre_ticks, std::size_t range)
        : centre_(centre_ticks), range_(range),
          bids_(2 * range), asks_(2 * range)
    {
        oid_to_node_.reserve(1 << 20);   // big enough for normal markets
    }

    // Side: +1 = buy, -1 = sell. price_ticks: integer tick offset from centre.
    void add(std::uint64_t oid, int side, std::int64_t price_ticks,
             std::uint64_t qty)
    {
        auto& ladder = (side > 0) ? bids_ : asks_;
        const std::size_t idx = static_cast<std::size_t>(price_ticks - centre_ + range_);
        if (idx >= ladder.size()) return;   // out of range

        auto& lvl = ladder[idx];
        // Allocate node from pool (not shown — production books use a
        // freelist to avoid malloc per add).
        auto* node = node_pool_.acquire();
        node->oid = oid;
        node->qty = qty;
        node->prev = lvl.tail;
        node->next = nullptr;

        if (lvl.tail) lvl.tail->next = node;
        else lvl.head = node;
        lvl.tail = node;
        lvl.total_qty += qty;

        oid_to_node_[oid] = {node, idx, side};
    }

    bool cancel(std::uint64_t oid) {
        auto it = oid_to_node_.find(oid);
        if (it == oid_to_node_.end()) return false;
        auto [node, idx, side] = it->second;
        auto& ladder = (side > 0) ? bids_ : asks_;
        auto& lvl = ladder[idx];

        // Unlink in O(1) thanks to prev/next + the hash-map lookup.
        if (node->prev) node->prev->next = node->next;
        else lvl.head = node->next;
        if (node->next) node->next->prev = node->prev;
        else lvl.tail = node->prev;
        lvl.total_qty -= node->qty;

        node_pool_.release(node);
        oid_to_node_.erase(it);
        return true;
    }

    // Best bid / best ask: walk the ladder from the centre outward.
    // Cache the last known best to avoid scanning every call.
    std::int64_t best_bid_ticks() const {
        for (std::size_t i = range_; i-- > 0; ) {
            if (bids_[i].total_qty > 0) return centre_ + static_cast<std::int64_t>(i) - range_;
        }
        return INT64_MIN;
    }

    std::int64_t best_ask_ticks() const {
        for (std::size_t i = range_; i < bids_.size(); ++i) {
            if (asks_[i].total_qty > 0) return centre_ + static_cast<std::int64_t>(i) - range_;
        }
        return INT64_MAX;
    }

private:
    struct NodeRef { OrderNode* node; std::size_t idx; int side; };

    std::int64_t centre_;
    std::size_t  range_;
    std::vector<PriceLevel> bids_;     // ladder
    std::vector<PriceLevel> asks_;     // ladder
    std::unordered_map<std::uint64_t, NodeRef> oid_to_node_;
    // node_pool_  — freelist of OrderNode, omitted for brevity
    struct { OrderNode* acquire(); void release(OrderNode*); } node_pool_;
};

// ---- Why the L2 ladder wins for HFT ----
//
// - add/cancel are O(1). No tree balancing, no log P.
// - Cache-friendly: a flat array of PriceLevel; consecutive levels are
//   contiguous in memory; iteration prefetches efficiently.
// - No allocation on hot path (with a node freelist).
// - Best bid/ask are a short walk from a cached "last best" index.
//
// ---- When NOT to use a ladder ----
//
// - Markets with huge price ranges (crypto with high tick variance,
//   options with sparse strikes). The ladder gets too big.
// - When the tick grid changes dynamically.
// - When you have memory pressure and the sorted-tree O(log P) cost
//   is acceptable.`,
    whenToUse:
      "Production matching engines and risk books in HFT shops. Anywhere you need O(1) order ops and have a known fixed tick grid.",
    trap:
      "Heap-allocating OrderNodes inside add() defeats the purpose. You MUST have a pre-allocated node pool / freelist on the hot path. Same for the oid → node map — pre-reserve to avoid rehash storms.",
  },

  {
    id: "cpp-hot-path-discipline",
    title: "Hot Path Discipline — A Checklist",
    level: "hft",
    signal:
      "The 'do you think about latency' question. Tests breadth and ability to reason about microarchitectural effects.",
    code: `// "What rules do you follow on the HOT PATH of a low-latency system?"
// This is less a code question and more a worldview check. Here's the
// list a quant-HFT shop expects you to be able to articulate.

// ----------------------------------------------------------------------
// 1. NO HEAP ALLOCATIONS.
//    Pre-allocate everything. Use freelists, object pools, std::pmr,
//    or stack arenas. malloc costs ~100 ns — already 1000x your budget.
//
// 2. NO SYSCALLS.
//    open, read, write, mmap — all cost microseconds. Do them at startup.
//    No printf. No regex_search (allocates). No throw (table-based
//    unwinding is fast but still pessimizes branch prediction).
//
// 3. NO LOCKS.
//    Uncontended ~30 ns; contended thousands. Use lock-free queues
//    (SPSC) or atomic data designed not to contend.
//
// 4. NO VIRTUAL CALLS IN INNER LOOPS.
//    Vtable lookup costs ~5 ns and breaks inlining. Use templates,
//    CRTP, or std::variant + std::visit instead.
//
// 5. NO INDIRECT BRANCHES YOU DON'T MEASURE.
//    Function pointers, std::function, lambdas-as-callback. All defeat
//    inlining. Profile before assuming the compiler "figured it out."
//
// 6. PIN THREADS TO CORES.
//    pthread_setaffinity_np. Otherwise the OS scheduler moves your
//    process between cores and you lose L1/L2 cache contents.
//
// 7. ISOLATE CORES YOU CARE ABOUT.
//    isolcpus=4,5 at boot, then run only your hot thread there.
//    Avoids context switches with anything else on the system.
//
// 8. ALIGN HOT DATA TO CACHE LINES.
//    alignas(64) on hot atomics. Manual padding when sharing.
//
// 9. PREFER SoA TO AoS for column-wise hot loops.
//    See cpp-soa-vs-aos.
//
// 10. USE INTEGER ARITHMETIC FOR PRICES.
//     int64_t in ticks. Float division is 10-30 cycles. Integer
//     multiplication is 3-5.
//
// 11. PROFILE WITH perf, NOT INTUITION.
//     perf record -e cycles,cache-misses,branch-misses, then perf
//     report. The bottleneck is almost never where you think.
//
// 12. CONSIDER KERNEL BYPASS.
//     For market data and order routing, DPDK / Solarflare ef_vi /
//     RDMA verbs let your process talk directly to the NIC, skipping
//     the kernel network stack. ~5x latency improvement for the wire.

// ---- Example: a hot-path function written under these rules ----
class Strategy {
public:
    // Pre-allocated, no virtual, no allocations on path.
    void on_tick(const Tick& t) noexcept {
        // Branch-free update of running statistics.
        // No malloc. No log. No std::cout. Just math.
        sum_  += t.price;
        sumsq_ += t.price * t.price;
        ++count_;

        // Triggers in ~1 in a million ticks — keep validation cold.
        if (count_ == kReportInterval) [[unlikely]] {
            emit_stats();        // cold function, possibly with syscalls
        }
    }
private:
    double sum_ = 0;
    double sumsq_ = 0;
    std::uint64_t count_ = 0;
    static constexpr std::uint64_t kReportInterval = 1'000'000;
    void emit_stats() noexcept;
};

struct Tick { double price; };`,
    whenToUse:
      "Code that's measured in nanoseconds. NOT every line of every program. Outside the hot path, write clean readable C++. The discipline is a TRADE-OFF — you give up some flexibility and readability for predictable latency.",
    trap:
      "Premature application. Most code doesn't need this. Profile first. The bottleneck is almost always I/O, locking, allocation, or algorithmic complexity — not the language features. Don't make every function noexcept; don't put alignas on every struct.",
    followUp:
      "What's the latency budget for the WHOLE round trip in a typical equities HFT setup? (Answer: sub-microsecond for tick-to-trade, with most of that on the wire. CPU budget is ~100-300 ns.)",
  },
];
