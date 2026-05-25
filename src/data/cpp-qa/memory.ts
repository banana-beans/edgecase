import type { CppPattern } from "./index";

// ============================================================
// Memory: cache lines, alignment, allocations, smart pointers.
// The most common interview line of questioning at HFT shops.
// ============================================================

export const memory: CppPattern[] = [
  {
    id: "cpp-cache-line",
    title: "Cache Lines & False Sharing",
    level: "memory",
    signal:
      "Whether the candidate knows why two atomics in the same struct can destroy performance even when they're never touched together.",
    code: `#include <atomic>
#include <thread>
#include <new>      // std::hardware_destructive_interference_size

// CPU memory is read in 64-byte chunks (cache lines). Two variables in
// the same cache line are physically inseparable from the CPU's view:
// writes by one core invalidate the line in all other cores' caches
// — a "false sharing" event.

// ---- BAD: two atomic counters in the same cache line. ----
struct BadCounters {
    std::atomic<long> reads{0};
    std::atomic<long> writes{0};
    // 8 bytes + 8 bytes — fits in one 64-byte line.
};

// Thread A increments reads continuously; thread B increments writes.
// They never touch the same atomic, but every increment invalidates the
// other thread's cache line. Throughput on modern hardware can drop 10x
// vs the independent case.

// ---- GOOD: pad to put each counter on its own cache line. ----
struct alignas(64) AlignedCounter {
    std::atomic<long> value{0};
    // Padding to fill 64 bytes (atomic is 8) — many compilers will warn
    // if you don't include the explicit padding; the alignas alone
    // ensures address alignment but the COMPILER may pack the next
    // member tightly.
    char pad[64 - sizeof(std::atomic<long>)];
};

struct GoodCounters {
    AlignedCounter reads;
    AlignedCounter writes;
};

// ---- Or use the standard's helper constants ----
// std::hardware_destructive_interference_size: distance to avoid
//   false sharing (typically 64 on x86-64).
// std::hardware_constructive_interference_size: distance to KEEP TOGETHER
//   for cache locality (often the same value).
struct ModernCounters {
    alignas(std::hardware_destructive_interference_size)
        std::atomic<long> reads{0};
    alignas(std::hardware_destructive_interference_size)
        std::atomic<long> writes{0};
};

// ---- Verification ----
// You can measure false sharing's impact with a microbenchmark + perf:
//   perf stat -e cache-misses,cache-references ./your_program
// Look for elevated cache-miss rate in the false-sharing version.

// ---- Subtle case — the same problem at object granularity ----
// std::vector<std::atomic<int>> with size 10 puts all 10 atomics into
// ~80 bytes — 2 cache lines. If 10 threads each increment "their"
// element, you're false-sharing across the array.
//
// Fix: each thread gets a padded slot, like Vector<AlignedCounter>.`,
    whenToUse:
      "Any time you have data per-thread that's logically independent but stored adjacently. Counters, accumulators, per-thread allocator pools.",
    trap:
      "Padding affects sizeof. If your struct is part of a wire format or persisted to disk, you need padding-aware serialization or you'll write 64 bytes for 8 bytes of data.",
    followUp:
      "When IS false sharing a feature? (Answer: when you WANT writes to propagate across cores — but that's basically never. The real point is that constructive interference distance can be useful for read-heavy shared state.)",
  },

  {
    id: "cpp-smart-pointers",
    title: "Smart Pointers — unique_ptr vs shared_ptr",
    level: "memory",
    signal:
      "Tests whether the candidate defaults to unique_ptr (correct) or shared_ptr (overused).",
    code: `#include <memory>
#include <vector>

// ---- The hierarchy of ownership in modern C++ ----
//
// raw pointer (T*):
//   non-owning observer. "I look at this; someone else cleans up."
//
// std::unique_ptr<T>:
//   sole owner. Move-only. Zero-overhead. Default choice for "this
//   object's lifetime is mine."
//
// std::shared_ptr<T>:
//   shared ownership via reference count. Atomic ref-count ops on every
//   copy/destroy. Use ONLY when ownership is genuinely shared.
//
// std::weak_ptr<T>:
//   non-owning observer of a shared_ptr. Used to break cycles.

// ---- unique_ptr — the default ----
class OrderRouter {
public:
    void send(std::unique_ptr<Order> o) {
        // Receive ownership. After this returns, the order's lifetime
        // is bounded by what we do here.
        queue_.push_back(std::move(o));
    }
private:
    std::vector<std::unique_ptr<Order>> queue_;
};

// std::make_unique<T>(args...) — preferred allocation site. Exception-
// safe (vs separate new + ctor call), and reads cleanly.
auto o = std::make_unique<Order>("AAPL", 150.0, 100);

// Transfer ownership via std::move:
router.send(std::move(o));   // o is now nullptr

// ---- shared_ptr — for SHARED ownership ----
// Each copy bumps an atomic ref-count. Last destruction triggers delete.
// Cost: 2 atomic ops per copy, and an extra heap allocation for the
// control block (unless you use std::make_shared).
//
// Use case: an order that's referenced from multiple places — a position
// book, a routing log, a risk engine — none of which "primarily own" it.

auto shared_order = std::make_shared<Order>("GOOG", 2800.0, 50);
auto copy = shared_order;   // ref-count goes from 1 to 2

// ---- shared_ptr ANTI-patterns commonly seen in juniors' code ----
// 1. shared_ptr by default. unique_ptr is almost always right.
// 2. shared_ptr to a stack value's address (sentinel for crash).
// 3. Creating two shared_ptrs from the same raw new (double free).
//    auto* p = new Order(...);
//    std::shared_ptr<Order> a(p);
//    std::shared_ptr<Order> b(p);   // ❌ two control blocks, double delete
//    Use std::make_shared instead.
// 4. Passing shared_ptr by VALUE everywhere — pays 2 atomic ops per call.
//    Pass by const reference if you're not transferring ownership.

// ---- Cycles + weak_ptr ----
// shared_ptr can't break cycles. A graph where A holds shared_ptr<B> and
// B holds shared_ptr<A> leaks both forever. Use weak_ptr to model "I
// reference this but don't keep it alive":

struct Node {
    std::vector<std::shared_ptr<Node>> children;
    std::weak_ptr<Node> parent;        // doesn't keep parent alive
};

// To use a weak_ptr, .lock() it to get a temporary shared_ptr (or
// nullptr if the target is already destroyed).
void visit_parent(const Node& n) {
    if (auto p = n.parent.lock()) {
        // p is a shared_ptr<Node>, valid for this scope.
        // use *p ...
    }
}

struct Order { const char* sym; double px; int qty; };`,
    whenToUse:
      "Default to unique_ptr. Reach for shared_ptr only when ownership is truly shared across components with non-overlapping lifetimes. Use weak_ptr to break cycles.",
    trap:
      "shared_ptr is not thread-safe in the sense that you might think. The control block (ref count) IS atomic and safe across threads. But the pointed-to OBJECT is NOT — concurrent mutating access to *sp still needs a mutex.",
  },

  {
    id: "cpp-no-alloc-hot-path",
    title: "No Allocations on the Hot Path",
    level: "memory",
    signal:
      "Whether the candidate knows allocations cost orders of magnitude more than ALU ops, and how to write code without them.",
    code: `#include <vector>
#include <string>
#include <string_view>

// Heap allocation in malloc-land costs ~100 ns on a typical x86 server.
// Cache-line load costs ~5 ns. A naive code path that allocates per
// tick can spend 10x more time in malloc than in your actual logic.
//
// HFT rule of thumb: zero allocations in the hot loop. All buffers are
// PRE-ALLOCATED with a capacity bound up front; the hot path only
// indexes into them.

// ---- BAD: builds a new string per tick ----
void on_tick_bad(const Tick& t) {
    std::string log = "Tick: " + t.symbol + " @" + std::to_string(t.price);
    publish(log);
}

// ---- GOOD 1: reserve once, reuse ----
class Logger {
    std::string scratch_;
public:
    Logger() { scratch_.reserve(256); }
    void on_tick(const Tick& t) {
        scratch_.clear();    // O(1), doesn't deallocate
        scratch_.append("Tick: ");
        scratch_.append(t.symbol);
        scratch_.append(" @");
        // Even to_string can allocate. Use std::to_chars (since C++17)
        // for allocation-free numeric → string conversion.
        char buf[32];
        auto [end, ec] = std::to_chars(buf, buf + 32, t.price);
        scratch_.append(buf, end);
        publish(scratch_);
    }
};

// ---- GOOD 2: std::string_view for read-only string params ----
// string_view = pointer + length. No allocation. No copy.
// Pass instead of const string& when you don't need ownership.
void route(std::string_view symbol) {
    // 'symbol' is a non-owning view. Don't store it past the call —
    // it could become dangling.
    if (symbol.starts_with("AAPL")) { /* ... */ }
}

// ---- GOOD 3: small_vector-style fixed-capacity containers ----
// std::vector grows on the heap by default. For known-small bounded
// collections, embed storage in the object — no heap touch unless you
// exceed the bound. boost::container::small_vector / absl::InlinedVector
// have this pattern. Or hand-roll:

template <typename T, size_t N>
class StaticVec {
    alignas(T) std::byte storage_[sizeof(T) * N];
    T* data() { return reinterpret_cast<T*>(storage_); }
    size_t n_ = 0;
public:
    template <typename... Args>
    void emplace_back(Args&&... args) {
        if (n_ >= N) throw std::length_error("StaticVec full");
        ::new (data() + n_) T(std::forward<Args>(args)...);
        ++n_;
    }
    // ... operator[], size, dtor that calls T::~T() for each element ...
};

// ---- GOOD 4: PMR (polymorphic allocators, C++17) ----
// std::pmr::vector lets you swap allocators without changing the type.
// Pair with a monotonic_buffer_resource for "stack-allocated" vectors:
#include <memory_resource>
void msg_handler() {
    // 4 KB on the stack — only spills to heap if we exceed it.
    std::byte buf[4096];
    std::pmr::monotonic_buffer_resource pool{buf, sizeof(buf)};
    std::pmr::vector<int> v{&pool};
    for (int i = 0; i < 100; ++i) v.push_back(i);   // probably no heap touch
}   // monotonic resource releases everything at once

// ---- How to verify there are no allocations ----
// 1. Override global new and abort (or count). Run your hot path. If
//    new is called, you have a bug.
// 2. Use a custom allocator that logs.
// 3. Profile with heaptrack or massif.

struct Tick { std::string symbol; double price; };
void publish(const std::string&);`,
    whenToUse:
      "Hot paths in HFT, low-latency networking, real-time systems. Anywhere a 100 ns malloc would be a regression.",
    trap:
      "string_view is a non-owning view. If you store a string_view that refers to a temporary string, you have a dangling reference. Same trap as a reference into a vector you then push_back into.",
  },

  {
    id: "cpp-pimpl",
    title: "PIMPL — Pointer to Implementation",
    level: "memory",
    signal:
      "Tests whether the candidate knows how to control compile times and ABI stability in large codebases.",
    code: `// PIMPL: the header declares an opaque pointer to the implementation
// type, defined in the .cpp file. Benefits:
// 1. Header is small — doesn't drag in implementation dependencies.
// 2. Changes to the impl don't trigger rebuilds of callers.
// 3. ABI stays stable — you can add/remove private members without
//    breaking binary compatibility for clients.
//
// Cost: one extra heap allocation per object + one pointer indirection
// on every member access. Don't do this for tiny value types.

// ---- header: order_router.hpp ----
#include <memory>

class OrderRouter {
public:
    OrderRouter();
    ~OrderRouter();
    // Important: ctor/dtor declared here but DEFINED in .cpp, so the
    // compiler can see the complete Impl type at the point where
    // unique_ptr<Impl>::~unique_ptr is instantiated.

    OrderRouter(OrderRouter&&) noexcept;
    OrderRouter& operator=(OrderRouter&&) noexcept;

    void send_order(const Order& o);
    void cancel(int oid);

private:
    struct Impl;        // forward declaration only
    std::unique_ptr<Impl> p_;
};

// ---- .cpp ----
struct OrderRouter::Impl {
    // ALL the private state and dependencies live here.
    std::vector<int> open_oids;
    std::unique_ptr<Connection> conn;
    // ... etc ...
};

OrderRouter::OrderRouter() : p_(std::make_unique<Impl>()) {}
OrderRouter::~OrderRouter() = default;
OrderRouter::OrderRouter(OrderRouter&&) noexcept = default;
OrderRouter& OrderRouter::operator=(OrderRouter&&) noexcept = default;

void OrderRouter::send_order(const Order& o) {
    p_->open_oids.push_back(o.oid);
    p_->conn->write(o);
}

// ---- Why dtor MUST be in the .cpp ----
// If you let the compiler default the dtor in the header, it gets
// instantiated wherever the header is included — but at THOSE
// locations, Impl is still incomplete, and unique_ptr<Impl> can't
// destruct an incomplete type. Compile error.
//
// Same for move ctor/move assign — they implicitly destroy the old
// state, which needs the complete type.

// ---- Variations ----
// 1. "Cheshire cat" — only impl pointer, no other state. Class is the
//    pimpl wrapper.
// 2. "Stable ABI" libraries (Qt, ICU) use pimpl extensively to add
//    features without bumping their major version.
// 3. For perf-critical types (e.g., a Price struct) — DON'T pimpl.
//    The extra indirection kills you in hot loops.

struct Order { int oid; };
struct Connection { void write(const Order&); };`,
    whenToUse:
      "Library/API types where you want to hide implementation details, keep header includes minimal, or maintain ABI stability. NOT for value types in performance-critical paths.",
    trap:
      "Forgetting to define the destructor in the .cpp file. Default destructors in headers can't destruct incomplete types — compile error with a confusing message about std::unique_ptr<Impl>.",
  },
];
