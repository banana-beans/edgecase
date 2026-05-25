import type { PyQuestion } from "./index";

// ============================================================
// Python language questions — gotchas, idioms, internals.
// These reveal whether a candidate has actually *used* Python
// vs whether they've just read syntax tutorials.
// ============================================================

export const languageQuestions: PyQuestion[] = [
  {
    id: "py-mutable-default",
    title: "Mutable Default Arguments",
    difficulty: "junior",
    category: "language",
    signal:
      "Catches whether a candidate has been bitten by a real Python bug. Senior devs answer instantly; juniors who've only done courses won't see it.",
    question:
      "What's wrong with this function? What does it print when called three times in a row: add_item('a'), add_item('b'), add_item('c')?\n\n  def add_item(item, bucket=[]):\n      bucket.append(item)\n      return bucket",
    watchFor: [
      "Candidate says 'each call gets a fresh list' — wrong; this is the trap.",
      "Candidate spots the bug but can't explain *why* defaults are evaluated once at function-definition time.",
      "Bonus signal: candidate suggests the `None` sentinel fix unprompted.",
    ],
    solution: `# The function appends to a SINGLE list that lives on the function object.
# Default arguments are evaluated ONCE, when the def statement runs — not
# on every call. So every invocation shares the same 'bucket'.

# Calling add_item('a'), add_item('b'), add_item('c') prints:
#   ['a']
#   ['a', 'b']
#   ['a', 'b', 'c']

# Proof — peek inside the function object itself:
def add_item(item, bucket=[]):
    bucket.append(item)
    return bucket

print(add_item.__defaults__)   # ([],)  — one list, shared
add_item("a")
print(add_item.__defaults__)   # (['a'],)  — mutated!

# ----------------------------------------------------------
# The fix — use None as a sentinel and create a fresh list per call:
# ----------------------------------------------------------
def add_item(item, bucket=None):
    # \`bucket is None\` is the canonical pattern. Don't write
    # \`bucket == None\` (works for None but breaks for objects
    # that override __eq__; \`is\` checks identity, which is safe).
    if bucket is None:
        bucket = []
    bucket.append(item)
    return bucket

# Why does Python work this way at all? Because evaluating the default
# every call would be expensive, and immutable defaults (numbers, strings,
# None, tuples) make this safe in 99% of cases. The footgun only fires
# with mutable defaults — list, dict, set, custom mutables.`,
    followUp:
      "When IS it OK / useful to use a mutable default? (Answer: caching/memoization at function scope — same trick is sometimes intentional.)",
  },

  {
    id: "py-is-vs-equals",
    title: "`is` vs `==`",
    difficulty: "junior",
    category: "language",
    signal:
      "Tests whether the candidate understands the difference between identity (same object) and equality (same value).",
    question:
      "Predict and explain the output:\n\n  a = 256; b = 256\n  print(a is b)\n\n  a = 257; b = 257\n  print(a is b)\n\n  s1 = 'hello'; s2 = 'hello'\n  print(s1 is s2)\n\n  s1 = 'hello world!'; s2 = 'hello world!'\n  print(s1 is s2)",
    watchFor: [
      "Candidate confuses `is` and `==`.",
      "Candidate doesn't know about CPython's small-integer cache (range −5 to 256).",
      "Candidate uses `is` to compare values in their own code (a real-world bug).",
    ],
    solution: `# == checks VALUE equality (calls __eq__).
# is  checks IDENTITY — are these two names pointing at the exact same
#     object in memory? (compares id(a) == id(b))

# 1.  a = 256; b = 256
#     CPython pre-caches integers from −5 to 256 inclusive at startup
#     because they're so common. Every '256' literal anywhere in your
#     program refers to the same object. So:  a is b → True

# 2.  a = 257; b = 257
#     Outside the cache range. Each '257' literal creates a new int.
#     In the REPL or two separate statements, a and b are different
#     objects with the same value.  a is b → False
#
#     BUT: inside a single compiled chunk (a function body), the
#     bytecode compiler may dedupe constants, so 'a is b' might be True
#     inside a function. NEVER rely on this — it's a CPython
#     optimization detail, not a language guarantee.

# 3.  s1 = 'hello'; s2 = 'hello'
#     'hello' is a valid identifier-like string, so CPython interns it
#     automatically. Both names point to the same interned object.
#     s1 is s2 → True

# 4.  s1 = 'hello world!'; s2 = 'hello world!'
#     'hello world!' contains a space + punctuation; not auto-interned.
#     Two separate string objects with the same value.
#     s1 is s2 → False
#
#     Force interning if you really want this: sys.intern('hello world!')

# ----------------------------------------------------------
# The takeaway and the rule:
# ----------------------------------------------------------
# Use \`is\` ONLY for comparison to singletons: None, True, False,
# and your own sentinel objects. For everything else, use ==.
#
#   if x is None:           ✓  canonical
#   if x is _SENTINEL:      ✓  for module-level sentinels
#   if x is 5:              ✗  works only by accident
#   if name is "alice":     ✗  same — accident
#
# Why this trap exists in interviews: it lets the candidate volunteer
# that they know about CPython's implementation details (small-int
# cache, string interning) without you having to ask leading questions.`,
  },

  {
    id: "py-late-binding-closure",
    title: "Late Binding in Closures",
    difficulty: "mid",
    category: "language",
    signal:
      "Reveals whether the candidate has worked with callbacks, event handlers, or partial application — areas where this bug hides.",
    question:
      "Predict the output:\n\n  funcs = [lambda: i for i in range(3)]\n  print([f() for f in funcs])\n\nFix it.",
    watchFor: [
      "Candidate predicts [0, 1, 2] — wrong, that's the classic mistake.",
      "Candidate sees [2, 2, 2] but can't explain WHY.",
      "Candidate's fix uses `i=i` default-argument binding without explaining what that does.",
    ],
    solution: `# Output: [2, 2, 2]
#
# Closures in Python capture variables BY REFERENCE, not by value.
# All three lambdas refer to the SAME variable \`i\` in the enclosing
# scope. By the time we call any of them, the comprehension's loop
# has finished and i == 2. So every lambda returns 2.
#
# This is "late binding" — the lookup of \`i\` happens when the lambda
# is *called*, not when it's *created*.

# Verify the diagnosis:
funcs = [lambda: i for i in range(3)]
print(funcs[0].__closure__)  # Shows that each lambda has a cell ref
# All three cells point at the same i object.

# ----------------------------------------------------------
# Fix 1 — default argument binding (the most common idiom):
# ----------------------------------------------------------
# Default values ARE evaluated when the def/lambda is created, so this
# snapshots i at each iteration. Trade-off: ugly signature, no longer
# a zero-arg lambda from the caller's perspective.
funcs = [lambda i=i: i for i in range(3)]
print([f() for f in funcs])   # [0, 1, 2]

# ----------------------------------------------------------
# Fix 2 — functools.partial (cleaner intent):
# ----------------------------------------------------------
from functools import partial
def identity(x):
    return x
funcs = [partial(identity, i) for i in range(3)]
print([f() for f in funcs])   # [0, 1, 2]

# ----------------------------------------------------------
# Fix 3 — explicit factory function (most self-documenting):
# ----------------------------------------------------------
def make_returner(value):
    # \`value\` is a new local in each call, so each closure captures
    # a different variable. No late-binding issue.
    return lambda: value

funcs = [make_returner(i) for i in range(3)]
print([f() for f in funcs])   # [0, 1, 2]

# ----------------------------------------------------------
# Where this bug really bites in practice:
# ----------------------------------------------------------
# - Registering event handlers in a loop ("on click of button i")
# - Building dict of route handlers
# - Multi-threaded callbacks where the loop variable mutates
# - Bound method references in async pipelines`,
  },

  {
    id: "py-generators-vs-lists",
    title: "Generators vs Lists",
    difficulty: "mid",
    category: "language",
    signal:
      "Whether the candidate reaches for generators when data is streamed/infinite, and whether they understand memory implications.",
    question:
      "You're given a CSV with 10GB of stock tick data — too big to fit in RAM. Write a function that returns the average price across the file. Show your work and explain memory behavior.",
    watchFor: [
      "Candidate uses pandas.read_csv() with no chunking — out of memory.",
      "Candidate uses a list comprehension to read every row into a list.",
      "Candidate doesn't know about generator expressions / itertools / chunking.",
      "Strong signal: candidate mentions `csv.DictReader` over `pd.read_csv` for streaming + correctness.",
    ],
    solution: `# Bad: loads the entire CSV into memory.
import pandas as pd
def avg_price_bad(path: str) -> float:
    df = pd.read_csv(path)        # OOM on 10GB
    return df["price"].mean()

# Better: read in chunks. pandas pre-allocates per chunk, so peak RAM
# is bounded by chunksize, not file size.
def avg_price_chunked(path: str, chunksize: int = 1_000_000) -> float:
    total = 0.0
    count = 0
    # iterator=True returns a TextFileReader; chunksize sets rows-per-chunk
    for chunk in pd.read_csv(path, chunksize=chunksize):
        total += chunk["price"].sum()
        count += len(chunk)
    return total / count

# Best (when you don't need pandas at all): pure generator with csv module.
# This is what I'd write for "I just need a streaming aggregate" — uses
# constant memory regardless of file size, no DataFrame overhead.
import csv
def avg_price_streaming(path: str) -> float:
    # \`with\` ensures the file is closed even if an exception fires
    with open(path, newline="") as f:
        reader = csv.DictReader(f)  # parses headers on first read
        # Sum + count in a single pass. Two-variable running aggregate
        # to avoid two passes through the file. Floats may accumulate
        # rounding error — for 10GB of ticks, prefer Decimal or Welford's
        # online mean if precision matters.
        total = 0.0
        n = 0
        for row in reader:           # one row at a time — O(1) memory
            total += float(row["price"])
            n += 1
    if n == 0:
        return float("nan")          # don't divide by zero silently
    return total / n

# ----------------------------------------------------------
# Mental model — list vs generator:
# ----------------------------------------------------------
#   [x*2 for x in big_iter]    materializes the whole list  O(n) memory
#   (x*2 for x in big_iter)    lazy generator                O(1) memory
#
# Generators are iterators that produce values on demand.
# Once consumed, they're EXHAUSTED — you can't iterate twice. If the
# caller needs multiple passes, either return a list or build a factory
# that creates a fresh generator each time.

# ----------------------------------------------------------
# Numerical-stability bonus (Welford's online algorithm):
# ----------------------------------------------------------
# For 10GB of floats, naive sum accumulates error of order O(n·ε).
# Welford gives O(√n·ε) and computes variance in one pass.
def online_mean_var(path: str) -> tuple[float, float]:
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        n = 0
        mean = 0.0
        M2 = 0.0   # sum of squared deviations from the running mean
        for row in reader:
            x = float(row["price"])
            n += 1
            delta = x - mean
            mean += delta / n
            M2 += delta * (x - mean)
    var = M2 / (n - 1) if n > 1 else 0.0
    return mean, var`,
    followUp:
      "Now compute the rolling 60-second VWAP across that file. (Tests whether they can hold state across stream elements without materializing.)",
  },

  {
    id: "py-gil",
    title: "Explain the GIL",
    difficulty: "mid",
    category: "language",
    signal:
      "Tests whether the candidate knows when threading vs multiprocessing actually helps — critical for any Python code that processes market data.",
    question:
      "Explain the GIL. Given a CPU-bound function that takes 10 seconds per call, will using `threading.Thread` to run 4 calls in parallel make it faster? What about `multiprocessing.Pool` or `concurrent.futures.ProcessPoolExecutor`?",
    watchFor: [
      "Candidate says 'GIL means Python isn't multithreaded' — partially right but reductive.",
      "Candidate doesn't know threading IS useful for I/O-bound work (the GIL is released during system calls).",
      "Strong signal: candidate mentions free-threaded Python (PEP 703 — landing in 3.13+), or numpy/c-extensions releasing the GIL on heavy ops.",
    ],
    solution: `# The GIL (Global Interpreter Lock) is a mutex in CPython that ensures
# only ONE thread executes Python bytecode at a time. It exists to make
# the C-level object model (ref counts, etc.) safe without per-object locks.
#
# Consequence: pure-Python CPU-bound code does NOT scale with threads.
# 4 threads doing 10s of pure Python each will take ~40s total wall clock,
# same as serial. Slightly worse due to context-switching overhead.

# ----------------------------------------------------------
# When does threading actually help?
# ----------------------------------------------------------
# 1. I/O-bound work. The GIL is RELEASED during blocking system calls
#    (read, write, socket recv, time.sleep, etc.). 4 threads each waiting
#    on different sockets will overlap their wait time → much faster.
#
# 2. C extensions that release the GIL. numpy's BLAS-backed ops (matmul,
#    dot, large element-wise math) release the GIL while running C code.
#    So np-heavy threaded code can scale to multiple cores.
#
# 3. asyncio (technically not threading, but same idea): single thread,
#    cooperative scheduling on top of I/O multiplexing.

# ----------------------------------------------------------
# For CPU-bound pure Python: use multiprocessing.
# ----------------------------------------------------------
# Each process has its own Python interpreter and its own GIL. They run
# truly in parallel on multiple cores. Cost: every arg/return must be
# pickled across the process boundary, so don't do this for tiny tasks.

from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
import time

def cpu_bound(n: int) -> int:
    # Pure-Python loop — GIL-bound work
    total = 0
    for i in range(n):
        total += i * i
    return total

if __name__ == "__main__":
    work = [10_000_000] * 4

    # Threading: ~ same as serial for this workload
    t0 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=4) as ex:
        list(ex.map(cpu_bound, work))
    print(f"threads:    {time.perf_counter() - t0:.2f}s")

    # Multiprocessing: ~ 4x faster on a 4-core box
    t0 = time.perf_counter()
    with ProcessPoolExecutor(max_workers=4) as ex:
        list(ex.map(cpu_bound, work))
    print(f"processes:  {time.perf_counter() - t0:.2f}s")

# ----------------------------------------------------------
# The __main__ guard — why it matters for multiprocessing:
# ----------------------------------------------------------
# On Windows and macOS (post-3.8), Process workers SPAWN a fresh
# interpreter and re-import your module. Without the
# \`if __name__ == "__main__":\` guard, the import re-runs the
# pool creation → infinite recursion of pool creation → BOOM.

# ----------------------------------------------------------
# Modern note — free-threaded Python (PEP 703):
# ----------------------------------------------------------
# Python 3.13 ships an experimental --disable-gil build. The GIL becomes
# optional. CPU-bound threading will eventually be a first-class option.
# Until it's the default and ecosystem-wide stable (years away), assume
# the GIL for any production code.

# ----------------------------------------------------------
# Practical rule for quant code:
# ----------------------------------------------------------
# - Data ingestion / network / disk: threading or asyncio.
# - Number crunching that's already in numpy/pandas/torch: threading
#   can help (they release the GIL).
# - Pure-Python simulation, backtesting, custom loops: multiprocessing
#   or — better — push the hot loop into numpy/numba/Cython/C++.`,
  },

  {
    id: "py-decorator",
    title: "Write a Timer Decorator",
    difficulty: "mid",
    category: "language",
    signal:
      "Reveals whether the candidate understands functions are first-class and how to use `functools.wraps`.",
    question:
      "Write a decorator `@timed` that prints the function's name and how long it took. Make it preserve the function's docstring and name. Then make it work with `async def` functions too.",
    watchFor: [
      "Candidate writes a decorator that loses __name__/__doc__ (forgets @functools.wraps).",
      "Candidate doesn't know how to detect coroutines (asyncio.iscoroutinefunction).",
      "Bonus signal: discusses time.perf_counter() vs time.time() (the former is monotonic).",
    ],
    solution: `import functools
import time
import asyncio

# ----------------------------------------------------------
# Basic version — sync only:
# ----------------------------------------------------------
def timed(fn):
    # @functools.wraps copies __name__, __doc__, __wrapped__, etc. from
    # the wrapped function onto the wrapper. Without it, every decorated
    # function shows up as 'wrapper' in tracebacks and help() output.
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        # time.perf_counter() is MONOTONIC and HIGH-RESOLUTION — best
        # choice for measuring intervals. time.time() can go backwards
        # (NTP corrections, leap seconds) and has lower resolution.
        t0 = time.perf_counter()
        try:
            return fn(*args, **kwargs)
        finally:
            # \`finally\` ensures the timer fires even if the function
            # raises — important when you're timing potentially-failing code.
            elapsed = time.perf_counter() - t0
            print(f"{fn.__name__}: {elapsed*1000:.2f} ms")
    return wrapper

# Use it:
@timed
def slow_thing(n: int) -> int:
    """Sum of squares — pure-Python."""
    return sum(i * i for i in range(n))

slow_thing(1_000_000)          # prints "slow_thing: 78.43 ms"
print(slow_thing.__name__)     # 'slow_thing' ✓ (without @wraps it'd be 'wrapper')
print(slow_thing.__doc__)      # 'Sum of squares — pure-Python.' ✓

# ----------------------------------------------------------
# Async-aware version — handles both sync and async functions:
# ----------------------------------------------------------
def timed(fn):
    if asyncio.iscoroutinefunction(fn):
        # Coroutines must be awaited; we need an async wrapper that
        # does its own \`await fn(...)\` inside the timer.
        @functools.wraps(fn)
        async def async_wrapper(*args, **kwargs):
            t0 = time.perf_counter()
            try:
                return await fn(*args, **kwargs)
            finally:
                print(f"{fn.__name__}: {(time.perf_counter()-t0)*1000:.2f} ms")
        return async_wrapper

    @functools.wraps(fn)
    def sync_wrapper(*args, **kwargs):
        t0 = time.perf_counter()
        try:
            return fn(*args, **kwargs)
        finally:
            print(f"{fn.__name__}: {(time.perf_counter()-t0)*1000:.2f} ms")
    return sync_wrapper

# ----------------------------------------------------------
# Parameterized version — @timed(label='hot path') style:
# ----------------------------------------------------------
# A decorator with arguments is a function that RETURNS a decorator.
# The two-level structure is what trips most candidates up.
def timed(label: str | None = None):
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            t0 = time.perf_counter()
            try:
                return fn(*args, **kwargs)
            finally:
                tag = label or fn.__name__
                print(f"{tag}: {(time.perf_counter()-t0)*1000:.2f} ms")
        return wrapper
    return decorator

@timed(label="hot loop")
def calc(): ...

# ----------------------------------------------------------
# Production note:
# ----------------------------------------------------------
# In real systems, don't \`print\` — emit to a histogram (prometheus,
# statsd) so you can SLO it. Also: this decorator has measurable overhead.
# Don't decorate functions called in inner loops. Time the outer loop.`,
  },

  {
    id: "py-context-manager",
    title: "Write a Context Manager (Two Ways)",
    difficulty: "mid",
    category: "language",
    signal:
      "Tests whether the candidate can write `with` blocks that always clean up — table stakes for DB connections, file handles, position locks.",
    question:
      "Write a context manager that acquires a lock, yields, and releases on exit even if an exception fires. Do it both ways: with a class implementing `__enter__`/`__exit__`, and with `contextlib.contextmanager`.",
    watchFor: [
      "Candidate's __exit__ returns True unconditionally — silently swallows exceptions.",
      "Candidate forgets that contextmanager generators must yield exactly once.",
      "Strong signal: candidate uses `try: yield finally: ...` correctly in the generator version.",
    ],
    solution: `import threading
from contextlib import contextmanager

# ----------------------------------------------------------
# Class form — full control, more verbose.
# ----------------------------------------------------------
class LockGuard:
    def __init__(self, lock: threading.Lock):
        self.lock = lock

    def __enter__(self):
        # Called by the \`with\` statement. The return value is bound to
        # the \`as\` name: \`with LockGuard(my_lock) as guard:\`
        self.lock.acquire()
        return self.lock

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Called on \`with\` block exit — normal OR exceptional.
        # exc_type/val/tb are None on normal exit; set on exception.
        self.lock.release()
        # Return value semantics:
        #   None or False  → exception (if any) propagates  ← what we want
        #   True           → exception is SWALLOWED          ← dangerous
        # Almost always return None (implicit), not True.
        return None

# ----------------------------------------------------------
# Generator form — terser, the more Pythonic option.
# ----------------------------------------------------------
@contextmanager
def lock_guard(lock: threading.Lock):
    # contextmanager turns a generator into a context manager. The
    # function must yield exactly once. Everything BEFORE the yield is
    # __enter__. Everything AFTER (including in finally) is __exit__.
    lock.acquire()
    try:
        yield lock          # whatever you yield is bound to the \`as\` name
    finally:
        # The finally clause runs on BOTH normal exit and exception.
        # If you only do cleanup after the yield (no finally), an
        # exception inside the with-block will SKIP your cleanup.
        # Always use try/finally.
        lock.release()

# ----------------------------------------------------------
# Use them — both behave identically:
# ----------------------------------------------------------
lock = threading.Lock()

with LockGuard(lock):
    do_critical_work()

with lock_guard(lock):
    do_critical_work()

# ----------------------------------------------------------
# Real-world variation — acquire with timeout, exception-safe:
# ----------------------------------------------------------
class TimeoutLock:
    def __init__(self, lock: threading.Lock, timeout: float):
        self.lock = lock
        self.timeout = timeout
        self.acquired = False

    def __enter__(self):
        # acquire(timeout=...) returns False if it couldn't get the lock
        self.acquired = self.lock.acquire(timeout=self.timeout)
        if not self.acquired:
            raise TimeoutError(f"could not acquire lock in {self.timeout}s")
        return self.lock

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Only release if WE acquired. If __enter__ raised, we didn't.
        if self.acquired:
            self.lock.release()
        return None

# ----------------------------------------------------------
# Why interviewers ask this:
# ----------------------------------------------------------
# Every quant system has resources that MUST be released:
# - DB connections / connection pool slots
# - File handles (especially on Windows where leaks lock files open)
# - Network sockets
# - Position-tracking locks
# - Trade record sequences
# Knowing how to write a context manager that survives exceptions is
# the difference between a system that runs for years and one that
# OOMs at the worst possible moment.`,
  },
];
