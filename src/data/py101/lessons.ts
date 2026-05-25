import type { Lesson } from "./index";

// ============================================================
// 24 Python lessons, from print() to classes.
// Written for someone who has never written code.
// Every code block is runnable as-is in a fresh Python REPL.
// ============================================================

export const py101Lessons: Lesson[] = [
  {
    id: "py101-print",
    order: 1,
    title: "Your First Program — print()",
    tier: "intro",
    concept:
      "Python runs your code one line at a time. `print(...)` displays whatever's inside the parentheses on the screen.",
    code: `print("Hello, world!")
print("I'm learning Python.")
print(2 + 3)`,
    explanation:
      "Three lines, three outputs. The quotes around text make it a 'string' — a piece of text. Without quotes, Python tries to evaluate what you wrote. `2 + 3` has no quotes, so Python computes it and prints `5`.\n\nNo quotes around code = Python tries to USE it. Quotes = it's just text.",
    gotcha:
      "Smart-quote characters (“ ”) from Word or chat apps will crash Python. Always use straight quotes (\" or ').",
    exercise:
      "Predict the output: print('Hello' + ' ' + 'world'). Then try print('5' + 5) and explain the error.",
  },

  {
    id: "py101-variables",
    order: 2,
    title: "Variables — Naming Things",
    tier: "intro",
    concept:
      "A variable is a name that points to a value. You create one with `name = value`. The value can change; the name stays.",
    code: `price = 100
qty = 5
total = price * qty
print(total)        # 500

# Names can be reused — they point at whatever you last assigned.
price = 99
total = price * qty
print(total)        # 495`,
    explanation:
      "Think of `=` as 'becomes', not 'equals'. `price = 100` means: make the name `price` refer to the value 100. Reading it as 'price equals 100' is a math-class habit that will confuse you later.\n\nNaming rules: letters, digits, underscores. Can't start with a digit. Case matters (Price and price are different names).",
    gotcha:
      "`=` assigns, `==` checks for equality. `x = 5` makes x point to 5; `x == 5` asks 'is x equal to 5?' and answers True or False.",
    exercise:
      "Write 3 lines that create `a`, `b`, and `c` where `c` ends up holding 12. (One way: a=3, b=4, c=a*b.)",
  },

  {
    id: "py101-numbers",
    order: 3,
    title: "Numbers — int, float, and Math",
    tier: "intro",
    concept:
      "Python has two main number types. `int` for whole numbers (5, -3, 0), `float` for decimals (3.14, -0.5). Operators: + - * / % ** //",
    code: `print(7 + 3)        # 10
print(7 - 3)        # 4
print(7 * 3)        # 21
print(7 / 3)        # 2.3333...   division always gives a float
print(7 // 3)       # 2           floor division: drop the remainder
print(7 % 3)        # 1           modulo: just the remainder
print(7 ** 3)       # 343         exponent: 7 to the power 3

# Mixing ints and floats gives a float.
print(2 + 0.5)      # 2.5
print(type(10))     # <class 'int'>
print(type(10.0))   # <class 'float'>`,
    explanation:
      "These are the building blocks of everything quant. Floor division `//` and modulo `%` come up constantly when you want to extract digits, wrap around an array, or convert seconds-to-minutes.\n\n`**` is exponent, NOT `^` (that's bitwise XOR in Python — easy to mix up).",
    gotcha:
      "`/` always returns a float, even when the result is a whole number: `6 / 3` is `2.0`, not `2`. Use `//` if you want an integer back.",
    exercise:
      "Given `total_seconds = 3725`, print the hours, minutes, seconds. (Answer involves // and %.)",
  },

  {
    id: "py101-strings",
    order: 4,
    title: "Strings — Text",
    tier: "intro",
    concept:
      "A string is text in quotes. Either single ('hi') or double (\"hi\") quotes work, just be consistent. Strings can be combined, sliced, and formatted.",
    code: `name = "Alice"
greeting = "Hello, " + name + "!"
print(greeting)             # Hello, Alice!

# f-strings — the modern way to embed values in text.
# The 'f' before the quote enables substitution with {var}.
age = 30
print(f"{name} is {age} years old.")
print(f"{name} will be {age + 1} next year.")

# Length and indexing
print(len(name))            # 5
print(name[0])              # 'A'   first character
print(name[-1])             # 'e'   last character (negative counts from end)
print(name[1:3])            # 'li'  slice from index 1 up to but not 3

# Useful methods
print("AAPL".lower())       # 'aapl'
print("  spaces  ".strip()) # 'spaces'
print("a,b,c".split(","))   # ['a', 'b', 'c']`,
    explanation:
      "f-strings are the cleanest way to mix variables into text. They appear in every Python quant script: `f\"order {oid} filled {qty}@{price}\"`.\n\nIndexing starts at 0 — `name[0]` is the FIRST character. Slicing is `[start:end]` and `end` is EXCLUSIVE — `name[1:3]` gives positions 1 and 2.",
    gotcha:
      "Strings are immutable — you cannot do `name[0] = 'B'`. You have to build a new string. This is also true for numbers and tuples.",
    exercise:
      "Given symbol = 'NASDAQ:AAPL', print just 'AAPL' using a slice or .split().",
  },

  {
    id: "py101-booleans",
    order: 5,
    title: "Booleans and Comparisons",
    tier: "intro",
    concept:
      "True and False are the only two booleans (capitalized). Comparisons produce booleans. Logic operators: and, or, not.",
    code: `print(5 > 3)               # True
print(5 == 3)              # False    (equality test — two equals signs!)
print(5 != 3)              # True     (not equal)
print(5 >= 5)              # True

# Combining
price = 100
in_range = price > 50 and price < 200
print(in_range)            # True

# 'or' is inclusive — at least one side true
print(True or False)       # True
print(False or False)      # False

# 'not' flips a boolean
print(not True)            # False

# Truthiness — Python treats some values as 'falsy':
# 0, 0.0, "", [], {}, None all act as False.
# Everything else acts as True.
if "hello":
    print("non-empty string is truthy")`,
    explanation:
      "Booleans are the heart of any decision in code. Combine them with `and`/`or`/`not` instead of symbols like `&&` `||` (those are different operators in Python).\n\n`==` for equality is one of the most common typos — `=` is assignment, `==` is the test.",
    gotcha:
      "`True == 1` and `False == 0` evaluate to True in Python. Don't write `if x == True:` — just write `if x:`.",
    exercise:
      "Write a one-line condition that's True when `x` is between 10 and 20 INCLUSIVE.",
  },

  {
    id: "py101-conditionals",
    order: 6,
    title: "if / elif / else",
    tier: "intro",
    concept:
      "Use `if`, `elif` (else-if), and `else` to make decisions. Indentation defines what's inside each branch.",
    code: `price = 105

if price > 100:
    print("expensive")
elif price > 50:
    print("medium")
else:
    print("cheap")

# Indentation is REQUIRED. 4 spaces is the convention.
# Mixing tabs and spaces is a runtime error.

# 'in' tests membership in a list / string / dict / set.
side = "buy"
if side in ("buy", "sell"):
    print("valid side")

# You can chain conditions
qty = 100
if qty > 0 and price > 0:
    print("ok to trade")`,
    explanation:
      "Indentation in Python is part of the syntax — it's what tells the interpreter 'this line belongs inside the if'. Most editors do this automatically; just be consistent.\n\nUse `elif` (not `else if` — that's wrong syntax) when you have multiple mutually-exclusive cases.",
    gotcha:
      "Python's if doesn't use parentheses around the condition, and it ENDS with a colon. `if price > 100:` not `if (price > 100)` and don't forget the `:`.",
    exercise:
      "Write code that prints 'pos', 'neg', or 'zero' depending on the value of `x`.",
  },

  {
    id: "py101-lists",
    order: 7,
    title: "Lists — Ordered Collections",
    tier: "core",
    concept:
      "A list holds a sequence of values in square brackets. Lists are MUTABLE — you can change them in place.",
    code: `prices = [100.5, 101.2, 99.8, 102.0]

print(prices[0])         # 100.5  — first element
print(prices[-1])        # 102.0  — last element
print(len(prices))       # 4

# Slicing — same as strings
print(prices[1:3])       # [101.2, 99.8]
print(prices[:2])        # [100.5, 101.2]  (from start)
print(prices[2:])        # [99.8, 102.0]   (to end)

# Mutating
prices.append(103.5)     # add to end
prices[0] = 100.0        # change in place
prices.pop()             # remove and return last
prices.remove(99.8)      # remove first occurrence by value

# Membership
if 100.0 in prices:
    print("yes")

# Sorting
prices.sort()            # in place
asc = sorted(prices)     # returns new list

# Empty list, then build
acc = []
acc.append(1)
acc.append(2)
print(acc)               # [1, 2]`,
    explanation:
      "Lists are how you hold a series of things — prices, fills, orders, anything. Most quant code is mostly: 'I have a list of numbers — do something with each one and produce another list.'\n\nLists are heterogeneous — you can put any types together — but for performance work you usually keep them homogeneous and graduate to numpy arrays.",
    gotcha:
      "`prices[10]` on a 4-element list raises IndexError. Always check `len()` first, or use `if 0 <= i < len(prices):`.",
    exercise:
      "Given prices = [10, 20, 30, 40, 50], get the last two elements as a list slice.",
  },

  {
    id: "py101-for-loops",
    order: 8,
    title: "for Loops — Iterating",
    tier: "core",
    concept:
      "A `for` loop runs a block of code once per item in a sequence. The loop variable holds the current item.",
    code: `prices = [100, 101, 99, 102]

# Loop over each element
for p in prices:
    print(p)

# range(n) produces 0, 1, ..., n-1
for i in range(5):
    print(i)              # 0 through 4

# range(start, stop) and range(start, stop, step)
for i in range(2, 10, 2):
    print(i)              # 2, 4, 6, 8

# enumerate gives you (index, value) pairs
for i, p in enumerate(prices):
    print(f"day {i}: {p}")

# Compute a running sum
total = 0
for p in prices:
    total += p           # shorthand for total = total + p
print(total)             # 402

# zip iterates over two lists in parallel
fills = [10, 20, 5, 8]
for p, q in zip(prices, fills):
    print(p * q)`,
    explanation:
      "`for` loops are the workhorse. Whenever you say 'for each X, do Y', that's a for loop.\n\n`enumerate` and `zip` are the two most useful tools to pair with for loops. Internalize them. Quant code uses `zip` constantly for processing multiple parallel streams (price, volume, timestamp).",
    gotcha:
      "Modifying a list while iterating over it produces weird results. If you need to filter, build a NEW list, don't .remove() from the one you're looping over.",
    exercise:
      "Given prices = [10, 20, 30, 40], compute the sum of squares. Expected output: 3000.",
  },

  {
    id: "py101-while-loops",
    order: 9,
    title: "while Loops — Repeat Until",
    tier: "core",
    concept:
      "A `while` loop runs as long as a condition stays true. Use when you don't know how many iterations you need ahead of time.",
    code: `# Find the first power of 2 above 1000
n = 1
while n < 1000:
    n *= 2
print(n)                  # 1024

# break exits the loop early
i = 0
while True:               # infinite loop, but...
    if i == 5:
        break             # ... we bail out here
    i += 1
print(i)                  # 5

# continue skips to the next iteration
total = 0
for x in range(10):
    if x % 2 == 1:
        continue          # skip odd numbers
    total += x
print(total)              # 0+2+4+6+8 = 20`,
    explanation:
      "Use `while` when the stop condition is computed (find first X above Y, retry until success, etc). Use `for` when you have a known collection to iterate.\n\n`break` and `continue` are escape valves inside any loop — they work in both for and while.",
    gotcha:
      "Infinite loops happen when your condition never changes. If your terminal hangs, hit Ctrl+C. Always ask: 'what makes this loop end?'",
    exercise:
      "Use a while loop to find the smallest n where n*(n+1)/2 > 100.",
  },

  {
    id: "py101-dicts",
    order: 10,
    title: "Dictionaries — Key/Value Maps",
    tier: "core",
    concept:
      "A dict maps keys to values: `{key: value}`. Lookup by key is fast and direct. Keys can be strings, numbers, tuples — anything immutable.",
    code: `# A dict mapping ticker → price
quotes = {
    "AAPL": 175.30,
    "GOOG": 2840.10,
    "MSFT": 320.50,
}

print(quotes["AAPL"])       # 175.30
print("AAPL" in quotes)     # True

# Add or update
quotes["TSLA"] = 250.00
quotes["AAPL"] = 176.00    # overwrite

# Remove
del quotes["GOOG"]
removed = quotes.pop("MSFT")

# Safe lookup — returns None (or a default) if missing
x = quotes.get("XYZ")           # None
y = quotes.get("XYZ", 0.0)      # 0.0

# Iterate
for ticker in quotes:           # just keys by default
    print(ticker)

for ticker, price in quotes.items():
    print(f"{ticker}: {price}")

# Common pattern: count things
counts = {}
for ch in "AAPL":
    counts[ch] = counts.get(ch, 0) + 1
print(counts)                   # {'A': 2, 'P': 1, 'L': 1}`,
    explanation:
      "Dicts are the second-most-used collection after lists. Use them anytime you have a key→value relationship: ticker→price, order_id→Order, day→pnl.\n\nLookup is O(1) — basically instant regardless of how many entries. That's why dicts are EVERYWHERE in production code.",
    gotcha:
      "Looking up a missing key with `quotes['XYZ']` raises KeyError. Use `quotes.get('XYZ')` if missing is OK (returns None), or check `if 'XYZ' in quotes:` first.",
    exercise:
      "Given orders = [('AAPL', 10), ('MSFT', 5), ('AAPL', 7)], build a dict mapping ticker → total qty.",
  },

  {
    id: "py101-sets-tuples",
    order: 11,
    title: "Sets and Tuples",
    tier: "core",
    concept:
      "A set is an unordered collection of unique values. A tuple is an immutable list. Each has narrow but important uses.",
    code: `# Sets — fast membership tests, automatic de-duplication
tickers_seen = set()
tickers_seen.add("AAPL")
tickers_seen.add("MSFT")
tickers_seen.add("AAPL")           # duplicate, ignored
print(tickers_seen)                # {'AAPL', 'MSFT'}
print("AAPL" in tickers_seen)      # True — O(1)

# Convert a list to a set to dedupe
unique = set([1, 1, 2, 3, 3])      # {1, 2, 3}

# Set operations
a = {1, 2, 3}
b = {2, 3, 4}
print(a & b)                       # {2, 3}  intersection
print(a | b)                       # {1,2,3,4} union
print(a - b)                       # {1}  difference

# Tuples — like lists but immutable. Used for fixed-shape records.
point = (3.5, 4.0)
print(point[0])                    # 3.5
# point[0] = 5.0      # ❌ tuples can't change

# Tuples are the natural type for multiple return values
def stats(xs):
    return min(xs), max(xs)        # returns a tuple
lo, hi = stats([3, 1, 4, 1, 5])    # unpacking
print(lo, hi)                      # 1 5`,
    explanation:
      "Use sets when you need fast membership tests or to deduplicate. Use tuples when grouping a fixed number of related values (point, key, return values).\n\nThe unpacking syntax `lo, hi = ...` is incredibly useful — it works on any iterable of known length.",
    gotcha:
      "A one-element tuple needs a trailing comma: `(5,)` is a tuple, but `(5)` is just the number 5 in parens.",
    exercise:
      "Given two lists of tickers, find ones in BOTH using sets.",
  },

  {
    id: "py101-functions",
    order: 12,
    title: "Functions — Reusable Code",
    tier: "core",
    concept:
      "A function packages code under a name so you can call it again. Defined with `def`. Inputs are 'parameters', and you `return` a value (or None).",
    code: `def square(x):
    return x * x

print(square(5))                   # 25
print(square(3.14))                # 9.8596

# Multiple arguments
def mid_price(bid, ask):
    return (bid + ask) / 2

print(mid_price(99.5, 100.5))      # 100.0

# Default arguments — caller can omit
def greet(name, salutation="Hi"):
    return f"{salutation}, {name}"

print(greet("Alice"))              # 'Hi, Alice'
print(greet("Alice", "Hey"))       # 'Hey, Alice'

# Keyword arguments — pass by name for clarity
print(greet(salutation="Hello", name="Bob"))   # 'Hello, Bob'

# Functions can call other functions
def stats(xs):
    n = len(xs)
    total = sum(xs)
    return total / n

print(stats([1, 2, 3, 4]))         # 2.5`,
    explanation:
      "Functions are the main way to avoid repeating yourself. Whenever you find yourself copy-pasting 3 lines of code, ask if those lines should be a function.\n\nReturning nothing returns None. Returning a tuple lets you return multiple values at once.",
    gotcha:
      "A function ends as soon as `return` runs. Code after a return inside the same branch is dead code.",
    exercise:
      "Write a function `is_in_range(x, lo, hi)` that returns True if lo ≤ x ≤ hi.",
  },

  {
    id: "py101-scope",
    order: 13,
    title: "Scope — Where Names Live",
    tier: "core",
    concept:
      "Variables defined inside a function only exist inside that function. The rules are: Local → Enclosing → Global → Built-in (LEGB).",
    code: `x = 10                  # global

def show():
    x = 99              # local — different variable from the global x
    print("inside:", x)

show()                  # inside: 99
print("outside:", x)    # outside: 10  — the global is untouched

# To MODIFY a global from inside, you'd use 'global x' (rarely needed)

# Functions can READ globals without declaration
PRICE_TICK = 0.01

def normalize(price):
    return round(price / PRICE_TICK) * PRICE_TICK

print(normalize(100.123))    # 100.12

# Parameters are local
def double(n):
    n = n * 2           # this 'n' is local — doesn't affect caller
    return n

x = 5
y = double(x)
print(x, y)             # 5 10`,
    explanation:
      "Scope is one of the most common sources of beginner confusion. The rule to remember: assigning inside a function creates a LOCAL name, even if a global with the same name exists. To modify the global, you'd use `global x` — but that's a code smell. Better to pass values in and return them out.",
    gotcha:
      "If you try to read a name before assigning it inside a function, Python decides the name is local and you get an UnboundLocalError instead of seeing the global.",
    exercise:
      "After running: total = 0; def add(x): total = total + x; add(5); print(total) — what's printed? Why?",
  },

  {
    id: "py101-list-comp",
    order: 14,
    title: "List Comprehensions",
    tier: "core",
    concept:
      "A one-line expression that builds a list from another iterable. Often replaces a 3-line for-loop.",
    code: `# Without comprehension — verbose
squares = []
for x in range(10):
    squares.append(x * x)

# With comprehension — same result, one line
squares = [x * x for x in range(10)]

# With a filter
evens = [x for x in range(20) if x % 2 == 0]
print(evens)            # [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]

# Two iterables
points = [(x, y) for x in range(3) for y in range(3)]

# On a string
caps = [c.upper() for c in "hello"]
print(caps)             # ['H', 'E', 'L', 'L', 'O']

# Common in quant code — extract a field from a list of dicts
trades = [
    {"sym": "AAPL", "qty": 10},
    {"sym": "MSFT", "qty": 5},
    {"sym": "AAPL", "qty": 7},
]
aapl_qty = [t["qty"] for t in trades if t["sym"] == "AAPL"]
print(aapl_qty)         # [10, 7]

# Dict and set comprehensions exist too
sq_map = {x: x * x for x in range(5)}
print(sq_map)           # {0: 0, 1: 1, 2: 4, 3: 9, 4: 16}`,
    explanation:
      "Comprehensions are idiomatic Python. Use them when the loop body is short (one expression + an optional filter). For longer bodies, prefer a regular for loop — readability wins.\n\nMental model: `[<output> for <var> in <iterable> if <condition>]`.",
    gotcha:
      "Comprehensions are for building NEW lists. If you don't need the resulting list (just doing side effects), use a regular for loop — `[print(x) for x in xs]` 'works' but is bad style.",
    exercise:
      "Given prices = [100, 102, 98, 105, 95], produce a list of returns (each price divided by the previous, minus 1). Hint: use range or zip.",
  },

  {
    id: "py101-files",
    order: 15,
    title: "Reading and Writing Files",
    tier: "applied",
    concept:
      "Open a file with `open()`. Always use `with` so the file gets closed even if your code crashes.",
    code: `# Write to a file
with open("trades.csv", "w") as f:
    f.write("symbol,price,qty\\n")
    f.write("AAPL,175.30,100\\n")
    f.write("MSFT,320.50,50\\n")
# Auto-closed when the 'with' block ends.

# Read all content
with open("trades.csv") as f:
    content = f.read()
print(content)

# Read line by line — better for big files
with open("trades.csv") as f:
    for line in f:
        line = line.strip()    # strip trailing newline
        print(line)

# For CSV specifically, use the csv module
import csv
with open("trades.csv") as f:
    reader = csv.DictReader(f)
    for row in reader:
        print(row["symbol"], row["price"])`,
    explanation:
      "`with open(...) as f:` is the canonical pattern. It guarantees the file gets closed even if your code raises an error. You'll see this exact shape with database connections, locks, network sockets — anything that needs cleanup.\n\nMode 'r' (default) reads, 'w' overwrites, 'a' appends.",
    gotcha:
      "Without `with`, you'd have to write `f.close()` manually — and if an error fires between open and close, you leak the handle. Always use `with`.",
    exercise:
      "Read a CSV of prices and print only rows where price > 100.",
  },

  {
    id: "py101-exceptions",
    order: 16,
    title: "Exceptions — Handling Errors",
    tier: "applied",
    concept:
      "When something goes wrong, Python raises an exception. Use `try/except` to catch and handle it instead of crashing.",
    code: `# Without handling — crashes
# price = int("abc")   # ValueError: invalid literal

# With handling
try:
    price = int("abc")
except ValueError:
    print("couldn't parse price")
    price = 0

print(price)            # 0

# Multiple exception types
try:
    quotes = {"AAPL": 175}
    p = quotes["TSLA"]
except KeyError as e:
    print(f"missing key: {e}")
except Exception as e:           # catches anything else
    print(f"some other error: {e}")

# finally — runs whether or not an exception fired
try:
    f = open("data.txt")
    # ... process
finally:
    f.close()

# Raising your own exception
def get_price(quotes, sym):
    if sym not in quotes:
        raise KeyError(f"unknown symbol: {sym}")
    return quotes[sym]`,
    explanation:
      "Exceptions are how Python signals 'something went wrong.' Common ones: ValueError (bad value for a function), KeyError (dict missing key), IndexError (list out of range), TypeError (wrong type for operation).\n\nCatch SPECIFIC exceptions. Catching `except:` or `except Exception:` is a code smell — you hide bugs that way.",
    gotcha:
      "Don't catch exceptions just to make errors go away. If you don't know what to do with the failure, let it propagate — the crash is informative; silent corruption is much worse.",
    exercise:
      "Write a function safe_div(a, b) that returns 0 if b is 0, otherwise a/b. Use try/except.",
  },

  {
    id: "py101-classes-1",
    order: 17,
    title: "Classes — Defining Your Own Types",
    tier: "applied",
    concept:
      "A class is a blueprint for an object. The object holds data (attributes) and behavior (methods). `__init__` runs when you create an instance.",
    code: `class Position:
    def __init__(self, symbol, qty, avg_price):
        # 'self' refers to THIS instance. Assigning to self.X
        # creates an attribute on this object.
        self.symbol = symbol
        self.qty = qty
        self.avg_price = avg_price

    def notional(self):
        # methods take 'self' as their first argument
        return self.qty * self.avg_price

    def pnl(self, mark_price):
        return self.qty * (mark_price - self.avg_price)

# Create an instance — calls __init__ behind the scenes
p = Position("AAPL", 100, 175.30)

# Access attributes
print(p.symbol)              # AAPL
print(p.qty)                 # 100

# Call methods
print(p.notional())          # 17530.0
print(p.pnl(180.00))         # 470.0

# Create another, independent
p2 = Position("MSFT", 50, 320.50)
print(p2.symbol, p.symbol)   # MSFT AAPL`,
    explanation:
      "Classes let you bundle related data with the functions that operate on it. Use them when you have a 'thing' with state (a Position, an Order, a Strategy) that you'll create many of.\n\n`self` is just convention — Python passes the instance as the first arg of every method. You write `p.notional()`, Python rewrites that as `Position.notional(p)`.",
    gotcha:
      "If you forget `self` in a method definition, you'll get a confusing error like 'takes 0 positional arguments but 1 was given' when you try to call it.",
    exercise:
      "Add a method `add_fill(qty, price)` to Position that updates qty and avg_price as if a new trade happened.",
  },

  {
    id: "py101-classes-2",
    order: 18,
    title: "Classes — Inheritance",
    tier: "applied",
    concept:
      "A class can inherit from another, getting all its attributes and methods. Override methods by redefining them in the subclass.",
    code: `class Order:
    def __init__(self, oid, symbol, qty):
        self.oid = oid
        self.symbol = symbol
        self.qty = qty

    def describe(self):
        return f"Order {self.oid}: {self.qty} {self.symbol}"

# LimitOrder is an Order with an extra price field
class LimitOrder(Order):
    def __init__(self, oid, symbol, qty, price):
        # super() lets you call the parent's __init__
        super().__init__(oid, symbol, qty)
        self.price = price

    def describe(self):
        # Override — extends the parent's behavior
        base = super().describe()
        return f"{base} @ {self.price}"

class MarketOrder(Order):
    def describe(self):
        return f"MKT {super().describe()}"

o1 = LimitOrder(1, "AAPL", 100, 175.50)
o2 = MarketOrder(2, "GOOG", 10)

print(o1.describe())     # Order 1: 100 AAPL @ 175.5
print(o2.describe())     # MKT Order 2: 10 GOOG

# isinstance — check the type chain
print(isinstance(o1, Order))         # True
print(isinstance(o1, LimitOrder))    # True
print(isinstance(o1, MarketOrder))   # False`,
    explanation:
      "Inheritance is for 'is-a' relationships. A LimitOrder IS an Order. Both share the oid/symbol/qty machinery; LimitOrder adds price.\n\nProfessional advice: don't go crazy with inheritance hierarchies. In real codebases, deep hierarchies become hard to navigate. Composition (a class HAS an object as a field) is often cleaner than inheritance.",
    gotcha:
      "Forgetting `super().__init__()` in the child class means the parent's __init__ never runs — your object is half-initialized and you get confusing AttributeError later.",
    exercise:
      "Define a class `IOCOrder` (immediate-or-cancel) that extends LimitOrder and adds a method `can_match(book_price)`.",
  },

  {
    id: "py101-modules",
    order: 19,
    title: "Modules — Splitting Code Across Files",
    tier: "applied",
    concept:
      "An `import` statement loads code from another file (or a library). Use it to break your code into manageable pieces.",
    code: `# math is a built-in module
import math
print(math.sqrt(16))                 # 4.0
print(math.pi)                       # 3.14159...

# Import specific names — no module prefix needed
from math import sqrt, pi
print(sqrt(25))                      # 5.0
print(pi)                            # 3.14159...

# Rename on import — common for libraries with long names
import datetime as dt
print(dt.date.today())

# Your own module — say you put this in helpers.py:
#   def mid(bid, ask):
#       return (bid + ask) / 2
# Then in another file:
#   from helpers import mid
#   print(mid(100, 101))

# Third-party libraries (after 'pip install <name>')
# These are what every quant Python script imports:
#   import numpy as np
#   import pandas as pd
#   import matplotlib.pyplot as plt
#   from scipy.stats import norm`,
    explanation:
      "As your code grows past a few hundred lines, split it into multiple files. Each file is a 'module'. Import what you need.\n\n`pip install <package>` is how you get third-party libraries from PyPI. Most quant work uses numpy, pandas, scipy, matplotlib, and a few specialty libs.",
    gotcha:
      "`from module import *` (star import) is discouraged — it pollutes your namespace and makes it hard to track where names come from.",
    exercise:
      "Use math.log to compute the natural log of 2.71828. (Should be ~1.0.)",
  },

  {
    id: "py101-type-hints",
    order: 20,
    title: "Type Hints — Documenting Your Code",
    tier: "applied",
    concept:
      "Optional annotations that say what types a function expects and returns. Don't change behavior — just make code clearer and let tools catch bugs.",
    code: `def mid_price(bid: float, ask: float) -> float:
    return (bid + ask) / 2

# These hints are ignored at runtime — you can still pass strings
# and Python won't complain. But editors + type checkers (mypy, pyright)
# will flag it as a likely bug.

# Collection types
def total_qty(orders: list[int]) -> int:
    return sum(orders)

def quote_book(quotes: dict[str, float]) -> str:
    return ", ".join(f"{k}={v}" for k, v in quotes.items())

# Optional — value might be None
def find_order(orders: list, oid: int) -> dict | None:
    for o in orders:
        if o["oid"] == oid:
            return o
    return None`,
    explanation:
      "Type hints are documentation for humans AND machines. The Python runtime ignores them, but tools like mypy, pyright, and your IDE use them to spot bugs before you run the code.\n\nEvery real quant codebase uses type hints in 2024+. Adopt them early — your future self will thank you.",
    gotcha:
      "Type hints don't enforce anything at runtime. `mid_price('a', 'b')` will run and produce garbage. The hints are for tools and humans, not for the interpreter.",
    exercise:
      "Add type hints to: def avg(xs): return sum(xs) / len(xs)",
  },

  {
    id: "py101-generators",
    order: 21,
    title: "Generators — Lazy Sequences",
    tier: "applied",
    concept:
      "A generator produces values on demand instead of building a whole list. Defined with `yield`. Crucial for working with big streams.",
    code: `# Regular function — returns a list
def first_n_squares(n):
    out = []
    for i in range(n):
        out.append(i * i)
    return out

# Generator — yields one at a time, no list built
def gen_squares(n):
    for i in range(n):
        yield i * i

# A generator is an ITERATOR — you iterate it
for sq in gen_squares(5):
    print(sq)               # 0, 1, 4, 9, 16

# Or convert to a list if you really want all values
print(list(gen_squares(5)))   # [0, 1, 4, 9, 16]

# Why bother? Memory.
# This streams 10 million squares — no list ever holds them all
total = 0
for sq in gen_squares(10_000_000):
    total += sq
print(total)

# Generator expressions — like list comprehensions but with ()
gen = (x * x for x in range(10))     # not a list — lazy
print(sum(gen))                       # consume it`,
    explanation:
      "Generators are how you process huge streams without running out of memory. You'll use this exact pattern for reading 10GB of tick data: open the file, yield one parsed tick at a time, never hold them all.\n\nCompare `[x*x for x in big]` (builds list) vs `(x*x for x in big)` (lazy generator). One character difference, huge memory impact for large data.",
    gotcha:
      "A generator is single-use. Once you've iterated through it, it's exhausted — iterating again gives no values. Recreate the generator each time you need to iterate.",
    exercise:
      "Write a generator `evens_up_to(n)` that yields 0, 2, 4, ..., up to n.",
  },

  {
    id: "py101-iterators-misc",
    order: 22,
    title: "The Standard Tools — sum, min, max, sorted, any, all",
    tier: "applied",
    concept:
      "A handful of built-in functions show up everywhere. Learn them so you stop writing them by hand.",
    code: `xs = [3, 1, 4, 1, 5, 9, 2, 6]

print(sum(xs))             # 31
print(min(xs))             # 1
print(max(xs))             # 9
print(len(xs))             # 8

# sorted returns a new list; .sort() mutates in place
print(sorted(xs))          # [1, 1, 2, 3, 4, 5, 6, 9]
print(sorted(xs, reverse=True))  # [9, 6, 5, 4, 3, 2, 1, 1]

# Sort with a key function
orders = [{"sym": "AAPL", "qty": 100}, {"sym": "GOOG", "qty": 50}]
print(sorted(orders, key=lambda o: o["qty"]))

# any/all — boolean reductions
print(any([False, False, True]))   # True   — at least one
print(all([True, True, False]))    # False  — every one
print(any(x > 100 for x in xs))    # False
print(all(x > 0 for x in xs))      # True

# Counting with sum + boolean expression
n_above_3 = sum(1 for x in xs if x > 3)
print(n_above_3)           # 4

# zip + dict — a common idiom
keys = ["a", "b", "c"]
values = [1, 2, 3]
d = dict(zip(keys, values))
print(d)                   # {'a': 1, 'b': 2, 'c': 3}`,
    explanation:
      "These are the 'standard library' moves that make Python feel like a tool, not a chore. Whenever you find yourself writing a for-loop that just counts/sums/checks, look for a built-in.\n\n`sum(1 for x in xs if condition)` is the idiomatic way to count things. The 1 means 'add one per match.'",
    gotcha:
      "`min()` of an empty list raises ValueError. Default-value patterns: `min(xs, default=0)`.",
    exercise:
      "Given quotes = [{'sym':'AAPL','bid':99}, {'sym':'GOOG','bid':2800}], find the symbol with the highest bid using max + key.",
  },

  {
    id: "py101-lambda",
    order: 23,
    title: "Lambdas — Tiny Inline Functions",
    tier: "applied",
    concept:
      "A `lambda` defines a small function in one line, often as an argument to another function.",
    code: `# Equivalent definitions:
def square(x):
    return x * x

square2 = lambda x: x * x

print(square(5), square2(5))       # 25 25

# Lambdas shine when you pass a function as an ARGUMENT.
prices = [105, 100, 110, 95]
print(sorted(prices, key=lambda p: -p))   # sort descending

orders = [
    {"sym": "AAPL", "qty": 100},
    {"sym": "GOOG", "qty": 50},
    {"sym": "MSFT", "qty": 200},
]
# Find the biggest order
biggest = max(orders, key=lambda o: o["qty"])
print(biggest)

# Filter — keep only items matching a predicate
big = list(filter(lambda o: o["qty"] > 75, orders))
print(big)

# Map — transform each item
syms = list(map(lambda o: o["sym"], orders))
print(syms)             # ['AAPL', 'GOOG', 'MSFT']
# But: a list comprehension is usually cleaner than map+lambda.
syms = [o["sym"] for o in orders]    # ← prefer this`,
    explanation:
      "A lambda is just shorthand for a small `def`. Use it inline for `key=`, `filter`, `sorted`, `min`, `max`. If your lambda would need more than one expression, write a real function — lambdas can't have statements (no for, no if-as-statement, no assignments).",
    gotcha:
      "Don't ASSIGN a lambda to a name (`f = lambda x: x*2`). Just use `def`. The lambda form is for use-and-throw-away.",
    exercise:
      "Sort orders by symbol alphabetically using sorted + key.",
  },

  {
    id: "py101-next-steps",
    order: 24,
    title: "You're Ready — What to Do Next",
    tier: "applied",
    concept:
      "You now have enough Python to read and write quant code. Here's what to do over the next 1–2 weeks.",
    code: `# Practice problems — do these by hand without looking things up.

# 1. Compute the mean and standard deviation of a list (no numpy yet).
def stats(xs):
    n = len(xs)
    mean = sum(xs) / n
    var = sum((x - mean) ** 2 for x in xs) / n
    return mean, var ** 0.5

print(stats([1, 2, 3, 4, 5]))   # (3.0, 1.4142...)

# 2. Count occurrences of each word in a string.
def word_counts(s):
    counts = {}
    for w in s.split():
        counts[w] = counts.get(w, 0) + 1
    return counts

# 3. Implement a simple position tracker (no external libs).
class Position:
    def __init__(self):
        self.qty = 0
        self.avg_px = 0.0
        self.realized = 0.0

    def fill(self, qty, price):
        # New trade. Handle both opening AND closing logic.
        if self.qty == 0 or (qty > 0) == (self.qty > 0):
            # Adding to position
            new_qty = self.qty + qty
            self.avg_px = (self.avg_px * abs(self.qty) + price * abs(qty)) / abs(new_qty)
            self.qty = new_qty
        else:
            # Closing — realize P&L on the closed portion
            closing = min(abs(qty), abs(self.qty))
            sign = 1 if self.qty > 0 else -1
            self.realized += closing * (price - self.avg_px) * sign
            self.qty += qty

p = Position()
p.fill(100, 50.0)
p.fill(50, 52.0)
p.fill(-60, 55.0)
print(p.qty, p.avg_px, p.realized)`,
    explanation:
      "Once you can do these three problems without help, you're ready for the /python interview prep track.\n\n**Suggested 1-2 week plan:**\n\n1. Re-read each py-101 card once.\n2. Work through Python Tutor (pythontutor.com) — visualize your code stepping through.\n3. Solve the three problems above.\n4. Move on to /np-101 (numpy + pandas).\n5. THEN start /python (the quant interview Q&A).\n\n**Free supplementary resources** (optional):\n- pythontutor.com — visualize execution step-by-step\n- learnpython.org — interactive tutorial\n- Automate the Boring Stuff — gentle, hands-on book (free online)\n\nDon't bounce between resources. Pick one, finish it. Then start the next track.",
    exercise:
      "Without looking, write the Position class from scratch. Run your version and the one above on the same trades. They should agree.",
  },
];
