import type { PyQuestion } from "./index";

// ============================================================
// "Design a small system" questions.
// These are open-ended — they're testing CLEAN OOP under realistic
// finance constraints, not algorithmic optimization.
// ============================================================

export const designQuestions: PyQuestion[] = [
  {
    id: "py-orderbook",
    title: "Design a Limit Order Book",
    difficulty: "senior",
    category: "design",
    signal:
      "The canonical 'design a system' quant interview question. Reveals whether the candidate has thought about microstructure.",
    question:
      "Design and implement a limit order book in Python supporting: add_limit(side, price, qty, oid), cancel(oid), match against market orders. Optimize for low-latency add/cancel; matching speed matters less. Walk through the data-structure choices.",
    watchFor: [
      "Candidate uses a flat list (O(n) for everything).",
      "Candidate uses a heap (O(log n) but can't cancel cheaply).",
      "Strong signal: candidate uses sorted price levels + a doubly-linked list of orders within each level + a hash map of oid→node.",
    ],
    solution: `from dataclasses import dataclass, field
from sortedcontainers import SortedDict
from typing import Optional
import itertools

# ----------------------------------------------------------
# Design rationale — what gets accessed and how often?
# ----------------------------------------------------------
# In a real market, the most frequent operations are:
#   1. ADD a new limit order            (high frequency)
#   2. CANCEL an existing order         (very high frequency — most quotes get cancelled)
#   3. MATCH on incoming market order   (lower frequency than 1-2 in modern markets)
#
# So we optimize 1 and 2 above all. Specifically:
#   - O(log P) add (P = number of distinct price levels, usually small)
#   - O(1) cancel given an order ID
#   - O(log P + k) match for k filled orders
#
# Best-fit data structure:
#   - SortedDict[price → PriceLevel] for each side. Keys are sorted,
#     so best bid = max key, best ask = min key. O(log P) lookups.
#   - Within each PriceLevel: a doubly-linked list of orders, preserving
#     price-time priority (FIFO at the level).
#   - oid → OrderNode hash map for O(1) cancel.
#
# C++ shops would use std::map<Price, PriceLevel> + intrusive list +
# unordered_map<OID, Node*>. Same shape, faster constants.

# ----------------------------------------------------------
# Order, PriceLevel, OrderBook.
# ----------------------------------------------------------
@dataclass
class Order:
    oid:   int
    side:  str           # "B" or "S"
    price: float
    qty:   float
    prev:  Optional["Order"] = field(default=None, repr=False)
    next:  Optional["Order"] = field(default=None, repr=False)

@dataclass
class PriceLevel:
    """Doubly-linked list of orders at one price. Maintains aggregated qty
    so we can return book depth without walking the list."""
    head: Optional[Order] = None
    tail: Optional[Order] = None
    qty:  float = 0.0

    def append(self, order: Order) -> None:
        # New order goes to the BACK — price-time priority means earlier
        # orders at the same level get matched first.
        order.prev = self.tail
        order.next = None
        if self.tail is not None:
            self.tail.next = order
        else:
            self.head = order
        self.tail = order
        self.qty += order.qty

    def remove(self, order: Order) -> None:
        # O(1) thanks to the prev/next pointers.
        if order.prev is not None:
            order.prev.next = order.next
        else:
            self.head = order.next
        if order.next is not None:
            order.next.prev = order.prev
        else:
            self.tail = order.prev
        self.qty -= order.qty
        order.prev = order.next = None

    def empty(self) -> bool:
        return self.head is None


class OrderBook:
    def __init__(self):
        # Bids sorted DESCENDING — best bid is at index 0 / first key.
        # SortedDict is ascending; we negate the key. Simpler: just track
        # max separately. Here we use a SortedDict with -price for bids.
        self.bids:  SortedDict[float, PriceLevel] = SortedDict()    # neg price
        self.asks:  SortedDict[float, PriceLevel] = SortedDict()    # pos price
        # oid → Order for O(1) cancel.
        self.orders: dict[int, Order] = {}
        self._next_oid = itertools.count(1)

    def add_limit(self, side: str, price: float, qty: float) -> int:
        """Insert a new limit order, return its oid. Doesn't cross — for
        crossing logic, see match()."""
        if side not in ("B", "S"):
            raise ValueError(f"side must be 'B' or 'S', got {side!r}")
        if qty <= 0:
            raise ValueError("qty must be positive")
        oid = next(self._next_oid)
        order = Order(oid=oid, side=side, price=price, qty=qty)
        # Pick the correct book side, find/create the price level.
        levels = self.bids if side == "B" else self.asks
        key = -price if side == "B" else price
        if key not in levels:
            levels[key] = PriceLevel()
        levels[key].append(order)
        self.orders[oid] = order
        return oid

    def cancel(self, oid: int) -> bool:
        """Remove an order by ID. Returns True if it existed."""
        order = self.orders.pop(oid, None)
        if order is None:
            return False
        levels = self.bids if order.side == "B" else self.asks
        key = -order.price if order.side == "B" else order.price
        level = levels[key]
        level.remove(order)
        # Clean up empty price levels — keeps book best-* lookups fast
        # and avoids unbounded growth in markets that quote/cancel heavily.
        if level.empty():
            del levels[key]
        return True

    def best_bid(self) -> Optional[float]:
        if not self.bids:
            return None
        return -self.bids.keys()[0]      # negate back to actual price

    def best_ask(self) -> Optional[float]:
        if not self.asks:
            return None
        return self.asks.keys()[0]

    def match(self, side: str, qty: float) -> list[tuple[int, float, float]]:
        """Match a market order. Returns list of (oid_resting, price, qty_filled).

        side: side of the INCOMING order ("B" buys from asks, "S" sells to bids).
        """
        fills: list[tuple[int, float, float]] = []
        # If buying, consume from asks (best = lowest). If selling, consume
        # from bids (best = highest).
        if side == "B":
            book = self.asks
            iter_keys = list(book.keys())               # ascending = best ask first
        else:
            book = self.bids
            iter_keys = list(book.keys())               # ascending of -bid = best bid first

        remaining = qty
        for key in iter_keys:
            if remaining <= 0:
                break
            level = book[key]
            price = key if side == "B" else -key
            # Match against orders at this level FIFO (head outward).
            while level.head is not None and remaining > 0:
                resting = level.head
                fill_qty = min(resting.qty, remaining)
                fills.append((resting.oid, price, fill_qty))
                resting.qty -= fill_qty
                level.qty   -= fill_qty
                remaining   -= fill_qty
                if resting.qty == 0:
                    # Fully filled — remove the order and its hash entry.
                    level.remove(resting)
                    del self.orders[resting.oid]
            if level.empty():
                del book[key]
        return fills

# ----------------------------------------------------------
# Smoke test:
# ----------------------------------------------------------
if __name__ == "__main__":
    ob = OrderBook()
    a1 = ob.add_limit("S", 100.5, 10)
    a2 = ob.add_limit("S", 100.4, 5)
    b1 = ob.add_limit("B", 100.3, 8)
    print(f"best bid: {ob.best_bid()}, best ask: {ob.best_ask()}")  # 100.3 / 100.4

    ob.cancel(b1)
    fills = ob.match("B", 7)           # market buy of 7 — fills 5 @100.4, 2 @100.5
    print(fills)
    print(f"best ask after: {ob.best_ask()}")   # 100.5, remaining 8

# ----------------------------------------------------------
# What I deliberately skipped (and would mention in an interview):
# ----------------------------------------------------------
# - IOC / FOK / hidden order types — needs per-order semantics.
# - Self-trade prevention (don't fill your own resting order with your
#   own incoming order — most modern matching engines have this).
# - Iceberg orders — only show partial qty publicly.
# - Trading session boundaries, opening / closing auctions.
# - Multi-leg order types (spreads, butterflies).
# - Persistence + crash recovery — production engines journal every event.
#
# Performance — what a C++ HFT book would do differently:
# - Intrusive linked lists (no separate dataclass allocations).
# - Pre-allocated order pool. No malloc on the hot path.
# - Arena allocator per price level so cache lines stay hot.
# - SoA layout — instead of struct-of-struct, parallel arrays of fields.
# - Lock-free single-producer queue from feed handler to matcher.`,
    followUp:
      "Now add IOC (immediate-or-cancel) and FOK (fill-or-kill) order types. Then: how would you measure matching latency, and what would you target?",
  },

  {
    id: "py-position-tracker",
    title: "Design a Real-Time Position Tracker",
    difficulty: "senior",
    category: "design",
    signal:
      "Tests whether the candidate has thought about fills vs marks, average price, realized vs unrealized P&L. These differences cause real trading desk bugs.",
    question:
      "Design a class that tracks a long/short position across multiple fills, maintaining: net position, average entry price, realized P&L (from closed trades), and mark-to-market unrealized P&L given a current price. Be careful when positions flip sign.",
    watchFor: [
      "Candidate uses 'average price' to mean different things in different parts of the code.",
      "Candidate's logic breaks when a long position is flipped to short within a single fill.",
      "Strong signal: candidate distinguishes 'average cost' (weighted history of opens) from 'VWAP' (volume-weighted).",
    ],
    solution: `from dataclasses import dataclass, field
from typing import Literal

Side = Literal["B", "S"]

# ----------------------------------------------------------
# Convention used here:
#   net_qty > 0  → long
#   net_qty < 0  → short
#   net_qty == 0 → flat
#
# Average entry price (avg_px) only meaningfully exists when net_qty != 0.
# When net_qty crosses through zero, we 'flip' and start a new average
# on the residual qty.
#
# Realized P&L accumulates from CLOSING trades — i.e., any trade that
# reduces |net_qty|. Trades that GROW the position only change the avg_px;
# nothing is realized.
# ----------------------------------------------------------

@dataclass
class Position:
    net_qty: float = 0.0
    avg_px:  float = 0.0
    realized_pnl: float = 0.0
    fills_log: list[tuple[Side, float, float]] = field(default_factory=list)

    def on_fill(self, side: Side, qty: float, price: float) -> None:
        """Apply a fill. qty must be positive; side determines direction."""
        if qty <= 0:
            raise ValueError("qty must be positive")
        self.fills_log.append((side, qty, price))

        # Convert to signed delta: + for buys (long-ward), − for sells.
        signed_qty = qty if side == "B" else -qty

        # ----------------------------------------------------------
        # Four cases based on existing position vs incoming fill:
        # ----------------------------------------------------------
        if self.net_qty == 0:
            # 1. Flat → opening a position. avg_px = fill price.
            self.net_qty = signed_qty
            self.avg_px  = price
            return

        # Same-sign trade?  signed_qty has same sign as net_qty?
        same_sign = (signed_qty > 0) == (self.net_qty > 0)

        if same_sign:
            # 2. Adding to an existing position. Update weighted avg, no realization.
            new_qty = self.net_qty + signed_qty
            # Volume-weighted average across the two stages.
            self.avg_px = (
                self.avg_px * abs(self.net_qty) + price * abs(signed_qty)
            ) / abs(new_qty)
            self.net_qty = new_qty
            return

        # Opposite-sign trade — closing some or all of the position.
        closing_qty = min(abs(signed_qty), abs(self.net_qty))
        # P&L sign: when LONG (net_qty > 0), we profit if sell_price > avg_px.
        # When SHORT, we profit if sell happens at LOWER price than avg_px.
        # The formula works out the same when expressed with the sign of net_qty:
        #   pnl = closing_qty * (price - avg_px) * sign(net_qty)
        sign = 1 if self.net_qty > 0 else -1
        self.realized_pnl += closing_qty * (price - self.avg_px) * sign

        residual = abs(signed_qty) - closing_qty
        new_qty = self.net_qty + signed_qty

        if abs(new_qty) < 1e-12:
            # 3. Exactly closed out — back to flat.
            self.net_qty = 0.0
            self.avg_px  = 0.0
        elif residual > 0 and (new_qty > 0) != (self.net_qty > 0):
            # 4. FLIPPED. We closed the old position AND opened a new one
            #    on the opposite side. The new avg_px is the fill price
            #    (only one trade worth of opening on the new side).
            self.net_qty = new_qty
            self.avg_px  = price
        else:
            # Partially closed; same side as before. avg_px stays the same
            # (we're not opening any new exposure, just reducing).
            self.net_qty = new_qty

    def unrealized_pnl(self, mark_price: float) -> float:
        """Mark-to-market P&L on the currently OPEN position."""
        if self.net_qty == 0:
            return 0.0
        # Same formula as realized — sign of net_qty handles long vs short.
        sign = 1 if self.net_qty > 0 else -1
        return abs(self.net_qty) * (mark_price - self.avg_px) * sign

    def total_pnl(self, mark_price: float) -> float:
        return self.realized_pnl + self.unrealized_pnl(mark_price)

# ----------------------------------------------------------
# Walk-through test — long, add, partial close, flip to short, close.
# ----------------------------------------------------------
if __name__ == "__main__":
    p = Position()
    p.on_fill("B", 100, 50.0)        # +100 @50  → net 100, avg 50
    p.on_fill("B",  50, 52.0)        # +50  @52  → net 150, avg 50.667
    p.on_fill("S",  60, 55.0)        # -60  @55  → net 90, realized 60·(55-50.667)=259.98, avg unchanged
    p.on_fill("S", 200, 53.0)        # -200 @53  → closes 90 + opens 110 short
                                     #   close 90 @53: realized + 90·(53-50.667)=210.0
                                     #   opens 110 short @53
    print(f"net qty:        {p.net_qty}")        # -110
    print(f"avg px:         {p.avg_px}")         # 53.0
    print(f"realized pnl:   {p.realized_pnl:.4f}")
    print(f"unrealized @51: {p.unrealized_pnl(51.0):.4f}")    # 110·(51-53)·(-1) = +220

# ----------------------------------------------------------
# Edge cases that bite in production:
# ----------------------------------------------------------
# - Floating-point: 1e-12 threshold for 'flat' depends on instrument
#   tick size. For penny stocks, 1e-12 is fine; for crypto with 18-decimal
#   tokens, you need a different tolerance. Use Decimal in places that
#   matter (settlement).
# - Same-tick offsetting fills: if a buy and sell of the same qty arrive
#   in the same tick, order matters for fees/realized. Production code
#   typically batches and net-settles within a microsecond window.
# - Currency conversion: P&L in instrument currency vs base. FX rate at
#   fill time vs at mark time.
# - Corporate actions: splits/dividends adjust avg_px retroactively.
#   Production trackers keep a 'corporate action ledger' separate from
#   fills and replay both.`,
  },

  {
    id: "py-tick-aggregator",
    title: "Design a Tick → Bar Aggregator",
    difficulty: "mid",
    category: "design",
    signal:
      "Tests whether the candidate can write online / streaming code with state. Avoid materializing the full tick list.",
    question:
      "Implement a class that consumes a stream of (timestamp, price, volume) ticks and emits 1-minute OHLCV bars. Calls: aggregator.on_tick(ts, price, vol); aggregator.flush() to force-emit the current bar. The output should be a callback or generator.",
    watchFor: [
      "Candidate buffers all ticks then re-aggregates — defeats the purpose.",
      "Candidate's bar boundaries are off-by-one (does a tick at 09:30:00 belong to the 09:30 bar or 09:29 bar?).",
      "Strong signal: candidate handles gaps (no ticks in a minute) explicitly — emit empty bar or skip?",
    ],
    solution: `from dataclasses import dataclass
from typing import Callable, Optional

# ----------------------------------------------------------
# Bar = OHLCV over a fixed-time interval.
# ----------------------------------------------------------
@dataclass
class Bar:
    start_ts: int        # epoch seconds at the START of the bar
    open:   float
    high:   float
    low:    float
    close:  float
    volume: float
    n_ticks: int

class BarAggregator:
    """Streaming tick → bar aggregator with a callback API."""

    def __init__(self, bar_seconds: int, on_bar: Callable[[Bar], None]):
        if bar_seconds <= 0:
            raise ValueError("bar_seconds must be positive")
        self.bar_sec = bar_seconds
        self.on_bar = on_bar
        # _current is None when we haven't seen any tick yet.
        self._current: Optional[Bar] = None

    @staticmethod
    def _bar_start(ts: int, bar_sec: int) -> int:
        # Floor the timestamp to the start of its bar.
        # E.g., bar_sec=60 → floor to the start of the minute.
        return (ts // bar_sec) * bar_sec

    def on_tick(self, ts: int, price: float, vol: float) -> None:
        # Determine which bar this tick belongs to.
        bar_start = self._bar_start(ts, self.bar_sec)

        if self._current is None:
            # First tick we've ever seen — open a fresh bar.
            self._current = Bar(
                start_ts=bar_start,
                open=price, high=price, low=price, close=price,
                volume=vol, n_ticks=1,
            )
            return

        if bar_start == self._current.start_ts:
            # SAME bar. Update high/low/close and accumulate volume.
            # open stays as-is (first price of the bar).
            self._current.high   = max(self._current.high, price)
            self._current.low    = min(self._current.low,  price)
            self._current.close  = price             # last-seen tick price
            self._current.volume += vol
            self._current.n_ticks += 1
            return

        # NEW bar. Flush the old one to the callback and start fresh.
        # If there were gap minutes (no ticks in some intermediate bar),
        # we DO NOT emit empty bars by default — that's a policy choice.
        # See the "gap handling" variant below.
        self.on_bar(self._current)
        self._current = Bar(
            start_ts=bar_start,
            open=price, high=price, low=price, close=price,
            volume=vol, n_ticks=1,
        )

    def flush(self) -> None:
        """Emit the in-progress bar (if any). Call at end-of-session."""
        if self._current is not None:
            self.on_bar(self._current)
            self._current = None

# ----------------------------------------------------------
# Smoke test:
# ----------------------------------------------------------
if __name__ == "__main__":
    bars: list[Bar] = []
    agg = BarAggregator(bar_seconds=60, on_bar=bars.append)

    # Stream: a few ticks in two consecutive minutes.
    # 09:30:00 — first tick of the 09:30 bar.
    agg.on_tick(ts=1700000000, price=100.0, vol=10)
    agg.on_tick(ts=1700000010, price=100.5, vol=5)
    agg.on_tick(ts=1700000050, price=99.8,  vol=8)
    # 09:31:02 — first tick of the next bar. Triggers emission of 09:30.
    agg.on_tick(ts=1700000062, price=100.2, vol=4)
    agg.flush()

    for b in bars:
        print(b)

# ----------------------------------------------------------
# Variant — emit EMPTY bars for gaps (some analytics require this):
# ----------------------------------------------------------
class BarAggregatorWithGaps(BarAggregator):
    def on_tick(self, ts, price, vol):
        bar_start = self._bar_start(ts, self.bar_sec)
        if self._current is None:
            self._current = Bar(bar_start, price, price, price, price, vol, 1)
            return

        if bar_start == self._current.start_ts:
            self._current.high   = max(self._current.high, price)
            self._current.low    = min(self._current.low,  price)
            self._current.close  = price
            self._current.volume += vol
            self._current.n_ticks += 1
            return

        # Emit the closed bar, then walk forward filling in gap bars
        # before opening the new one.
        self.on_bar(self._current)
        # 'Carry forward' price — gap bars have no trades, so OHLC are all
        # the previous close; volume is zero.
        gap_price = self._current.close
        gap_ts = self._current.start_ts + self.bar_sec
        while gap_ts < bar_start:
            self.on_bar(Bar(gap_ts, gap_price, gap_price, gap_price, gap_price, 0.0, 0))
            gap_ts += self.bar_sec

        self._current = Bar(bar_start, price, price, price, price, vol, 1)

# ----------------------------------------------------------
# Why this question:
# ----------------------------------------------------------
# Every market data pipeline does some version of this. Junior candidates
# write something that .append()s every tick then aggregates at the end
# (works for backtests, fails for live streaming). Senior candidates
# write O(1)-per-tick code, handle gap policy, and consider:
# - What's the bar boundary convention? (Inclusive of start tick? Yes here.)
# - What happens at session boundaries? (Start a fresh bar even mid-second.)
# - What about out-of-order ticks? (Production pipelines have to handle late ticks.)
# - Should out-of-order ticks reopen a closed bar, or be dropped?
# - How do you persist partial bars across process restart?`,
  },
];
