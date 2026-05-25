import type { CppPattern } from "./index";

// ============================================================
// Concurrency: atomics, memory ordering, lock-free.
// The hardest part of C++ for most candidates.
// ============================================================

export const concurrency: CppPattern[] = [
  {
    id: "cpp-atomic-memory-order",
    title: "std::atomic + Memory Orderings",
    level: "concurrency",
    signal:
      "The deepest C++ topic an interviewer can probe. Separates senior from staff.",
    code: `#include <atomic>
#include <thread>

// Memory ordering controls how the COMPILER and CPU may reorder reads
// and writes around an atomic operation. Stronger orderings are safer
// and more expensive; weaker orderings are faster but require careful
// reasoning to be correct.
//
// The five orderings (weakest → strongest):
//   memory_order_relaxed   — no ordering guarantees beyond atomicity
//   memory_order_consume   — like acquire but deprecated; treat as acquire
//   memory_order_acquire   — pairs with release; reads after this stay after
//   memory_order_release   — pairs with acquire; writes before this stay before
//   memory_order_acq_rel   — both, for RMW (fetch_add etc.)
//   memory_order_seq_cst   — sequential consistency, default, slowest

// ---- relaxed — atomic counter, no ordering needed ----
std::atomic<long> events{0};
void on_event() {
    // Just want atomic increment. Don't care about ordering w.r.t. other
    // memory ops. ~1 cycle on x86; can be much faster on ARM.
    events.fetch_add(1, std::memory_order_relaxed);
}

// ---- acquire/release — the producer/consumer pattern ----
// "Publish a piece of data, then a flag. Consumer reads flag, then data.
//  The release on the flag and the acquire on the consumer's read create
//  a happens-before relationship that makes the data visible."

double price;        // not atomic
std::atomic<bool> ready{false};

void producer() {
    price = 100.25;                                  // (A) regular write
    ready.store(true, std::memory_order_release);    // (B) release
    // The release on (B) means: every write before (B) in program order
    // (including (A)) is visible to any thread that does an ACQUIRE on
    // the same atomic.
}

void consumer() {
    while (!ready.load(std::memory_order_acquire));  // (C) acquire
    // After the acquire on (C) returns true, the write to price (A) is
    // guaranteed visible. Reading price here is correct and not a race.
    double p = price;
    (void)p;
}

// ---- seq_cst — the default. Safe but slowest. ----
// All threads agree on a SINGLE TOTAL ORDER of all seq_cst operations.
// Costs a full memory barrier (typically MFENCE on x86, dmb sy on ARM).
//
// Use it when in doubt. Most code is not so latency-critical that the
// fence cost shows up in profiles.

// ---- Compare-and-swap: the lock-free primitive ----
std::atomic<int> value{0};

void cas_inc() {
    int expected = value.load(std::memory_order_relaxed);
    while (!value.compare_exchange_weak(
        expected,
        expected + 1,
        std::memory_order_acq_rel,    // success: full barrier
        std::memory_order_relaxed))   // failure: just relaxed load
    {
        // CAS failed — expected is now the current value. Loop and retry.
    }
}

// compare_exchange_weak can spuriously fail even when value == expected
// (a feature on platforms like ARM/POWER where the hardware can drop
// reservations under contention). compare_exchange_strong avoids spurious
// failures but is slower in retry loops. Use weak in loops, strong when
// you genuinely only want one attempt.

// ---- Common bug: thinking std::atomic is always lock-free ----
// std::atomic<T> for T larger than a machine word may use a mutex
// internally. Verify with:
//   std::atomic<MyStruct>::is_always_lock_free  (compile-time)
//   atomic_value.is_lock_free()                 (runtime)
// If false, you don't have an atomic — you have a mutex with extra steps.

#include <cassert>
static_assert(std::atomic<long>::is_always_lock_free);
struct Big { char data[128]; };
static_assert(!std::atomic<Big>::is_always_lock_free);   // probably`,
    whenToUse:
      "relaxed for counters/stats that don't synchronize anything. acquire/release for producer-consumer of single pieces of data. seq_cst by default when you're not sure. Save the more aggressive orderings for code where you can prove correctness.",
    trap:
      "Trying to reason about reordering 'just looking at the assembly.' x86 has strong default ordering so weak orderings look correct on x86 but break on ARM/POWER. ALWAYS reason about the C++ memory model, not the specific platform.",
    followUp:
      "Implement a single-producer single-consumer ring buffer using only atomic head/tail indices. Discuss why acquire/release suffices and seq_cst is overkill.",
  },

  {
    id: "cpp-spsc-ring",
    title: "Lock-free SPSC Ring Buffer",
    level: "concurrency",
    signal:
      "The canonical 'design a lock-free data structure' interview problem. Tests memory ordering, false sharing, and ABA.",
    code: `#include <atomic>
#include <new>
#include <vector>
#include <cstddef>

// Single-producer single-consumer ring buffer. One thread pushes, one
// thread pops. No locks. Only two atomics: head (consumer-owned) and
// tail (producer-owned).
//
// Properties:
// - Wait-free push/pop on the common path.
// - O(1) memory; no allocation after construction.
// - Cache-friendly: each side touches its own cache line.
// - Capacity must be a power of two (lets us use bitmask instead of %).

template <typename T>
class SpscRing {
public:
    explicit SpscRing(std::size_t capacity_pow2)
        : buf_(capacity_pow2), mask_(capacity_pow2 - 1)
    {
        // Power-of-2 check: capacity & (capacity-1) must be 0.
        if ((capacity_pow2 & mask_) != 0) {
            throw std::invalid_argument("capacity must be a power of 2");
        }
    }

    // Producer side. Returns false if full.
    bool push(const T& item) {
        const auto tail = tail_.load(std::memory_order_relaxed);
        const auto next = (tail + 1) & mask_;
        // Acquire on head so we see the consumer's latest pop position.
        if (next == head_.load(std::memory_order_acquire)) {
            return false;   // full
        }
        buf_[tail] = item;
        // Release on tail: the buf_ write above is visible to the
        // consumer when it sees this new tail value.
        tail_.store(next, std::memory_order_release);
        return true;
    }

    // Consumer side. Returns false if empty.
    bool pop(T& out) {
        const auto head = head_.load(std::memory_order_relaxed);
        // Acquire on tail so we see the producer's latest push position.
        if (head == tail_.load(std::memory_order_acquire)) {
            return false;   // empty
        }
        out = buf_[head];
        const auto next = (head + 1) & mask_;
        // Release on head: the buf_ READ above must not float past this.
        head_.store(next, std::memory_order_release);
        return true;
    }

private:
    // CRITICAL: head and tail must live on separate cache lines.
    // Otherwise every producer push invalidates the consumer's cache
    // line containing head_ (and vice versa) → false sharing crater.
    alignas(std::hardware_destructive_interference_size)
        std::atomic<std::size_t> head_{0};
    alignas(std::hardware_destructive_interference_size)
        std::atomic<std::size_t> tail_{0};

    std::vector<T> buf_;
    const std::size_t mask_;
};

// ---- Interview probes — what an interviewer will push on ----
//
// 1. Why power-of-two capacity?
//    Because (idx & mask) is faster than (idx % capacity), and the
//    compiler can't always prove the divisor is a power-of-two from
//    runtime info. The bitmask is one ALU op; division is ~30 cycles.
//
// 2. Why split head and tail across cache lines?
//    Producer writes tail; consumer writes head. If they share a line,
//    every push invalidates the consumer's line and vice versa. The
//    structure works but throughput craters.
//
// 3. Why don't we need ABA protection?
//    Because there's a SINGLE producer and SINGLE consumer. ABA hits
//    multi-producer or multi-consumer queues where the same node can
//    be enqueued, dequeued, and re-enqueued by a different thread.
//    SPSC has no such cycle.
//
// 4. What if T is expensive to copy?
//    Provide push(T&&) and an emplace variant. The version above always
//    copies; a production SPSC would have move + emplace overloads.
//
// 5. What if I want non-blocking with backpressure signaling?
//    push() already returns bool. For "wait until space," wrap with a
//    futex or condition_variable on the producer side; cost is one
//    syscall per blocked push. For ultra-low-latency, just spin (waste
//    CPU but no syscalls).
//
// 6. What's the throughput?
//    On a good x86, ~50-100M items/sec for small T on the same socket.
//    Halve that across NUMA nodes. Compare to a mutex-based queue at
//    ~5M items/sec.`,
    whenToUse:
      "Producer-consumer pipelines where exactly one thread on each side. Market data fan-in (feed handler → strategy thread), strategy → order router, logging.",
    trap:
      "Multi-producer SPSC. People sometimes copy this and run two producers — that's a use-after-free / lost-write bug factory. Need MPSC or MPMC variant (much harder, usually with hazard pointers or epoch reclamation).",
  },

  {
    id: "cpp-thread-local",
    title: "thread_local — Per-Thread State",
    level: "concurrency",
    signal:
      "Whether the candidate knows about TLS overhead and when to use it instead of locking.",
    code: `#include <thread>
#include <random>

// thread_local: each thread sees its own instance of the variable.
// Initialized on first use per thread. Destroyed when the thread exits.

// ---- Common use: per-thread random number generator ----
// Sharing a single std::mt19937 across threads requires locking. A
// thread_local mt19937 is lock-free with negligible overhead.
double random_unit() {
    thread_local std::mt19937 rng{std::random_device{}()};
    thread_local std::uniform_real_distribution<double> dist{0.0, 1.0};
    return dist(rng);
}

// ---- Common use: scratch buffers ----
// Each thread has its own scratch buffer. Reset on each call but never
// reallocated — same memory used for life of thread.
#include <string>
std::string format_tick(double price, double qty) {
    thread_local std::string scratch;
    scratch.clear();    // O(1), keeps capacity
    scratch.append("p=");
    scratch.append(std::to_string(price));
    scratch.append(" q=");
    scratch.append(std::to_string(qty));
    return scratch;     // RVO → no extra copy
}

// ---- Performance cost on x86 ----
// First access in a function: a few instructions to read the TLS slot
// pointer (FS or GS register on Linux x86_64) + offset.
// Subsequent accesses in the same function: compiler may cache the
// address in a register. Negligible cost.
//
// On Linux glibc, the cost is ~1-2 ns per access. Compare to ~30 ns for
// an uncontended mutex lock and ~300+ ns for a contended one.

// ---- Gotcha: thread_local + dynamic libraries ----
// Some toolchains (older glibc, MSVC) have slower thread_local access
// for variables declared in shared libraries vs. the main executable.
// Profile if you put thread_local in a .so/.dll on a hot path.

// ---- Gotcha: order of destruction ----
// thread_local destructors run when the thread exits, in REVERSE order
// of their first access. If your thread_local has dependencies on
// globals or other thread_locals, you can get destruction-order bugs.
// Standard mitigation: avoid thread_locals that hold owning references
// to other resources.

// ---- Gotcha: NOT initialized until first access ----
// thread_local int x = expensive_init();
// In a thread that never reads x, expensive_init() is never called.
// That's usually fine, but pay attention if expensive_init has side
// effects you rely on.`,
    whenToUse:
      "Per-thread scratch storage, random number generators, profiling counters, allocator pools. Anywhere you'd otherwise lock a shared resource for non-shared work.",
    trap:
      "Don't pass a thread_local pointer or reference to ANOTHER thread. The lifetime is the originating thread's. A common bug: posting work to a thread pool that captures a thread_local reference of the submitter.",
  },
];
