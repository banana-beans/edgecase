import type { CppPattern } from "./index";

// ============================================================
// C++ foundations + modern idioms.
// What a senior C++ dev does differently from a junior.
// ============================================================

export const foundations: CppPattern[] = [
  {
    id: "cpp-raii",
    title: "RAII — Resource Acquisition Is Initialization",
    level: "foundations",
    signal:
      "The single most important concept in C++. Reveals whether the candidate writes exception-safe code by default.",
    code: `// RAII: every resource (memory, file, socket, lock) is owned by an
// object whose destructor releases it. Construction acquires, destruction
// releases. The compiler guarantees destructors fire on every path out
// of scope — normal return, exception unwind, early break — so resources
// don't leak.

#include <fstream>
#include <mutex>
#include <vector>

// ---- BAD: manual resource management ----
void bad_write(const char* path) {
    FILE* f = std::fopen(path, "w");
    std::fputs("hello", f);
    // If fputs throws (it doesn't, but imagine), or if we add another
    // line that does — the file handle leaks.
    std::fclose(f);
}

// ---- GOOD: RAII via std::ofstream ----
void good_write(const char* path) {
    std::ofstream f(path);          // ctor opens
    f << "hello";
    // f's dtor closes the file when this scope ends, even if an exception
    // propagates out. No close() needed.
}

// ---- The pattern generalizes to anything. Custom RAII wrapper: ----
class FileGuard {
public:
    explicit FileGuard(const char* path)
        : f_(std::fopen(path, "w")) {
        if (!f_) throw std::runtime_error("fopen failed");
    }
    ~FileGuard() {
        if (f_) std::fclose(f_);
    }

    // Copying a FILE* would create two owners — disable it.
    FileGuard(const FileGuard&) = delete;
    FileGuard& operator=(const FileGuard&) = delete;

    // Move is fine — transfer ownership, leave the source empty.
    FileGuard(FileGuard&& other) noexcept : f_(other.f_) {
        other.f_ = nullptr;
    }
    FileGuard& operator=(FileGuard&& other) noexcept {
        if (this != &other) {
            if (f_) std::fclose(f_);
            f_ = other.f_;
            other.f_ = nullptr;
        }
        return *this;
    }

    void write(const char* s) { std::fputs(s, f_); }
private:
    FILE* f_;
};

// ---- The same shape applies to scope-locked mutexes: ----
std::mutex m;
void critical_section() {
    std::lock_guard<std::mutex> g(m);   // acquires
    // ... do work ...
    // g's dtor releases the lock, even if an exception is thrown.
}`,
    whenToUse:
      "Always. Every resource you acquire — file handle, socket, mutex, memory, allocator slot, DB connection — should live inside an RAII object. The exception is the very lowest level of the standard library where these wrappers are built.",
    trap:
      "Resource-owning classes need the rule of 5 (or rule of 0): destructor, copy ctor, copy assign, move ctor, move assign. If you write any, write or =delete all five. The default copy of a FILE* would corrupt your state.",
    followUp:
      "What's the difference between std::lock_guard and std::unique_lock? When would you use std::scoped_lock?",
  },

  {
    id: "cpp-move-semantics",
    title: "Move Semantics — When to Copy, When to Move",
    level: "modern",
    signal:
      "Tests whether the candidate understands rvalue references and how to avoid unnecessary copies. Critical for hot-path code.",
    code: `#include <string>
#include <vector>
#include <utility>   // std::move

// A move "steals" the resources of an object that's about to die.
// Logically: "I'm taking your buffer; you can have my empty one."
// Cost: pointer-swap + nulls. Roughly free.
// Cost of a copy: allocate + memcpy O(n). Expensive for big containers.

struct Order {
    std::string symbol;
    std::vector<int> fills;       // potentially large
};

// ---- Pass by value, then move into member ----
class Position {
public:
    // 'sym' is a local copy of the argument (move from caller's rvalue,
    // OR copy from caller's lvalue — caller decides). Then we move it
    // into the member: one move always, one copy if caller passed lvalue.
    Position(std::string sym, std::vector<int> hist)
        : symbol_(std::move(sym)), history_(std::move(hist)) {}
private:
    std::string symbol_;
    std::vector<int> history_;
};

// ---- Returning by value: NRVO + move. Don't std::move on return. ----
std::vector<int> make_history() {
    std::vector<int> v;
    v.reserve(1000);
    for (int i = 0; i < 1000; ++i) v.push_back(i);
    return v;       // RVO/NRVO: compiler builds v directly in caller's slot.
                    // 'return std::move(v)' would DISABLE NRVO and force a
                    // move. Slower. Don't do it.
}

// ---- emplace_back: construct in place, avoid temp + move ----
void push_orders(std::vector<Order>& v) {
    Order o{"AAPL", {1, 2, 3}};
    v.push_back(std::move(o));         // ok — move
    v.push_back({"GOOG", {4, 5}});     // ok — rvalue moves
    v.emplace_back("MSFT", std::vector<int>{6, 7});  // best — constructed in place
}

// ---- Move-only types: ownership transfer ----
// std::unique_ptr is move-only. Tries to copy → compile error.
#include <memory>
void demo() {
    auto p = std::make_unique<int>(42);
    auto q = std::move(p);     // p is now nullptr; q owns the int.
    // auto r = p;             // ❌ compile error: unique_ptr is non-copyable
}`,
    whenToUse:
      "Pass large objects by value + std::move into members. Use emplace_back to skip temporaries entirely. Return by value and trust NRVO — never `return std::move(local)`.",
    trap:
      "After std::move(x), x is in a 'valid but unspecified' state. You can assign to it or destroy it, but DON'T read it. Especially treacherous for std::unique_ptr — moved-from is nullptr but the type system won't warn you.",
  },

  {
    id: "cpp-ref-vs-ptr",
    title: "References vs Pointers — Nullable vs Non-nullable",
    level: "foundations",
    signal:
      "Whether the candidate uses the right tool. Reaching for raw pointers when references suffice signals C-with-classes thinking.",
    code: `// References are non-null, non-rebindable aliases.
// Pointers are nullable and rebindable.
// Use references when you want the function/class to REQUIRE a valid
// object. Use pointers (or std::optional) when "no object" is meaningful.

#include <iostream>
#include <optional>

// Required input — reference. Caller MUST pass a valid object.
double mid_price(const Quote& q);

// Optional input — pointer. nullptr means "no data."
double safe_mid(const Quote* q) {
    if (!q) return std::nan("");
    return mid_price(*q);
}

// Even better when optional: std::optional. Type-system enforced.
double better_mid(const std::optional<Quote>& q) {
    if (!q) return std::nan("");
    return mid_price(*q);
}

// Reference members — STRONG INVARIANT that the reference outlives the
// referent. Almost always WORSE than a pointer or std::reference_wrapper
// because reference members can't be reassigned, breaking value semantics
// of the containing class (no default operator=, no easy swap).
struct BadObserver {
    const Quote& q;        // class is now non-assignable, non-default-ctor
};

// Prefer:
struct OkObserver {
    const Quote* q;        // nullable, but the class behaves normally
};

// ---- Rule of thumb ----
// In APIs:
//   const T&     for "I need to read this object, no nulls."
//   T&           for "I need to mutate this object, no nulls."
//   const T*     for "I read this object; nulls are allowed."
//   std::optional<T>  for an OWNED optional value.
//   T*           for "I mutate it; nulls allowed" OR "I observe; ownership belongs elsewhere."
//   std::unique_ptr<T>  for "I OWN this; transfer with move."
//   std::shared_ptr<T>  ONLY when ownership is genuinely shared.

struct Quote { double bid, ask; };
double mid_price(const Quote& q) { return (q.bid + q.ask) / 2; }`,
    whenToUse:
      "Default to references for non-null required arguments. Reach for pointers (or optional) only when 'no value' is a legitimate state.",
    trap:
      "Reference members make a class non-copy-assignable. If you find yourself wanting one, ask if a pointer or `std::reference_wrapper` would work better.",
  },

  {
    id: "cpp-constexpr",
    title: "constexpr — Pay at Compile Time, Not Runtime",
    level: "modern",
    signal:
      "Whether the candidate uses the compile-time evaluator to push work off the hot path.",
    code: `#include <array>

// constexpr means: usable in compile-time contexts AND at runtime.
// If all arguments are constant expressions, the result is computed
// at compile time and baked into the binary.

constexpr int factorial(int n) {
    return n <= 1 ? 1 : n * factorial(n - 1);
}

// Used at compile time — array size from a function call:
constexpr int kStrikes = factorial(5);   // baked: 120
std::array<double, kStrikes> strike_grid{};

// constexpr functions can have branches, loops, local vars in C++14+,
// and even allocate (C++20). They're real functions, just with the
// constraint that the body uses only constexpr-safe operations.
constexpr int fib(int n) {
    int a = 0, b = 1;
    for (int i = 0; i < n; ++i) {
        int t = a + b;
        a = b;
        b = t;
    }
    return a;
}

// ---- C++20: consteval forces compile-time ----
// constexpr ALLOWS compile-time eval; consteval REQUIRES it.
// Useful for compile-time validation of inputs (e.g., format strings).
consteval int must_be_constant(int n) {
    return n * 2;
}
// must_be_constant(some_runtime_int);   // ❌ compile error

// ---- Quant relevance ----
// In a pricing engine, you often have grid sizes, lookup tables, and
// constants that depend on configuration but not on per-tick inputs.
// Compute them at compile time — they end up as ROdata in the binary,
// the inner loop just reads them, no setup cost.

// Example: precompute a log table for fast log2 of small integers.
constexpr int log2_floor(unsigned int n) {
    int r = 0;
    while (n >>= 1) ++r;
    return r;
}

constexpr std::array<int, 32> make_log2_table() {
    std::array<int, 32> t{};
    for (int i = 1; i < 32; ++i) t[i] = log2_floor(i);
    return t;
}

constexpr auto kLog2Table = make_log2_table();
// kLog2Table is in .rodata. No init cost at startup. No branch in lookup.`,
    whenToUse:
      "Anything computable from constants — math, lookup tables, grid sizes, configuration that doesn't change at runtime. Move it to constexpr.",
    trap:
      "constexpr doesn't IMPLY const. A constexpr int variable IS const, but a constexpr function can be called with runtime args and return a runtime value. If you specifically need 'always compile-time,' use consteval (C++20).",
  },

  {
    id: "cpp-templates-concepts",
    title: "Templates + Concepts (C++20)",
    level: "modern",
    signal:
      "Whether the candidate writes generic code and uses concepts to constrain it. Error messages drop from 50 lines of template spew to 1 line.",
    code: `#include <concepts>
#include <vector>
#include <type_traits>

// ---- Pre-C++20: ugly SFINAE ----
// "Sum requires T to be arithmetic."
template <typename T,
          typename = std::enable_if_t<std::is_arithmetic_v<T>>>
T old_sum(const std::vector<T>& v) {
    T s = 0;
    for (auto x : v) s += x;
    return s;
}
// Error messages when used with std::string: 20+ lines of template depth.

// ---- C++20: concepts. Cleaner intent + cleaner errors. ----
template <typename T>
concept Numeric = std::is_arithmetic_v<T>;

// Function-style:
template <Numeric T>
T sum(const std::vector<T>& v) {
    T s = 0;
    for (auto x : v) s += x;
    return s;
}

// Short-hand (auto in function signature):
auto sum_short(const std::vector<Numeric auto>& v) {
    decltype(v[0]) s = 0;
    for (auto x : v) s += x;
    return s;
}

// Error message with concepts when called with std::vector<std::string>:
//   error: no matching function for call to 'sum(vector<string>&)'
//   note: candidate template ignored: constraints not satisfied
//     because 'string' does not satisfy 'Numeric'
// Two lines, readable.

// ---- Standard library concepts you'll actually use ----
//   std::integral, std::floating_point, std::arithmetic
//   std::same_as<T>, std::derived_from<Base>, std::convertible_to<T>
//   std::invocable<Args...>, std::predicate<Args...>
//   std::input_iterator, std::random_access_iterator
//   std::range, std::view

// ---- Constraining ranges ----
#include <ranges>

// Accepts anything iterable whose elements are arithmetic.
auto mean_range(std::ranges::input_range auto&& r)
  requires Numeric<std::ranges::range_value_t<decltype(r)>>
{
    using T = std::ranges::range_value_t<decltype(r)>;
    T sum = 0;
    std::size_t n = 0;
    for (auto&& x : r) { sum += x; ++n; }
    return n ? sum / static_cast<T>(n) : T{};
}`,
    whenToUse:
      "Always prefer concepts to enable_if in C++20+ code. The compile-time costs are the same; readability and error messages are dramatically better.",
    trap:
      "Concepts are checked at INSTANTIATION, not declaration. A concept that's wrong (e.g., references a typo) won't fire until someone actually tries to use the constrained template.",
    followUp:
      "Write a concept `OrderType` that requires T to have `int qty`, `double price`, and a `side() const noexcept -> Side` member function.",
  },

  {
    id: "cpp-aggregates-designated",
    title: "Aggregates + Designated Initializers",
    level: "modern",
    signal:
      "Whether the candidate writes self-documenting struct initializations. Mostly cosmetic but reveals fluency with C++20.",
    code: `#include <string>
#include <chrono>

// An aggregate has no user-declared ctor, no private/protected non-static
// members, no virtual functions, and no inheritance (in C++17+; C++20
// relaxes a bit). Aggregate initialization fills the members in order.

struct Order {
    std::string symbol;
    double price;
    int qty;
    std::chrono::nanoseconds ts;
};

// Pre-C++20: positional only. Easy to get arguments in the wrong order.
Order o1 = {"AAPL", 150.25, 100, std::chrono::nanoseconds{12345}};

// C++20: designated initializers. Self-documenting; same order required.
Order o2 = {
    .symbol = "AAPL",
    .price  = 150.25,
    .qty    = 100,
    .ts     = std::chrono::nanoseconds{12345},
};

// Why this matters: in dense quant structs with 10+ fields, positional
// init is a bug magnet. Reordering the struct silently reorders inputs.
// Designated init catches reordering at the construction site.

// You can omit members from designated init; they get value-initialized
// (zero for scalars, default ctor for class types).
Order partial = {
    .symbol = "GOOG",
    .price  = 2800.0,
    // qty and ts default to 0
};

// ---- Pitfall: aggregates can't have INITIALIZER mixed with ctors ----
struct WithCtor {
    int a;
    int b;
    WithCtor() : a(0), b(0) {}    // turns this into a non-aggregate
};
// WithCtor w{.a = 5};   // ❌ no longer aggregate

// ---- Default member initializers — what you usually want anyway ----
struct OrderV2 {
    std::string symbol;
    double price = 0.0;
    int qty = 0;
    std::chrono::nanoseconds ts{};
};

// Now OrderV2() default-constructs all fields. Designated init still works.
OrderV2 o3 = { .symbol = "TSLA" };   // price/qty/ts get their defaults`,
    whenToUse:
      "Use designated initializers for any struct with more than 2-3 fields, especially struct types you'll initialize many times in code. Cheap insurance against reordering bugs.",
    trap:
      "Designated initializers in C++20 require the SAME ORDER as the struct declaration. Out-of-order designated init is a compile error. (C allows it; C++ doesn't.)",
  },
];
