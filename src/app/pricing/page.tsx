"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/common/Card";
import { Slider } from "@/components/common/Slider";
import { callGreeks, putGreeks } from "@/lib/black-scholes";

type OptionType = "call" | "put";

const TRACK_COLOR = "var(--track-pricing)";

const CONTENT = [
  {
    title: "Put-call parity",
    body: "C − P = S − K·e^(−rT). Memorize this; it underlies everything. If parity breaks, there's arbitrage: short the expensive side, buy the cheap side + protective component, lock in the spread. Interview test: 'Given a call price, the strike, the spot, T, and r, what's the put price?' should be 5 seconds.",
  },
  {
    title: "Why ATM delta > 0.5 for a call",
    body: "Under risk-neutral GBM, the median terminal price is higher than today's spot (because the drift r·T > 0 in log-space, even after the −σ²/2·T martingale correction shifts things). So an at-the-money call is in-the-money MORE than half the time, and N(d1) > 0.5. Push r → 0 and delta_ATM → 0.5.",
  },
  {
    title: "Gamma peaks at the strike",
    body: "Gamma = N'(d1) / (S·σ·√T). The numerator N'(d1) maxes out where d1 = 0 — i.e., where log(S/K) ≈ −(r − σ²/2)T, near ATM. Practical consequence: short gamma positions hurt most when the market sits at your strike and oscillates. This is why market-makers hedge ATM options more aggressively.",
  },
  {
    title: "Vega is highest at ATM, longest dated",
    body: "Vega = S·N'(d1)·√T. Two implications: ATM options have the most vol sensitivity, and long-dated options have MORE vega than short-dated. A trader who's short vol via short-dated options has limited vega exposure; one with long-dated has lots. Vol shocks hit the back-end first.",
  },
  {
    title: "Theta and vega have opposite signs (mostly)",
    body: "Long options bleed theta (negative) and have positive vega. You're paying to own optionality; in return, you make money if vol rises. Short options are the reverse — collect theta, lose if vol spikes. The market-maker game is to delta-hedge and net these two.",
  },
  {
    title: "When BS breaks down",
    body: "Black-Scholes assumes: GBM (lognormal returns), constant vol, no dividends, frictionless trading. Each assumption fails in practice. Vol skew is the empirical signature — OTM puts trade RICH because crashes are real (heavy-left-tailed returns). Production prices use BS as a quoting convention with σ varying by strike (the smile).",
  },
];

export default function PricingPage() {
  const [type, setType] = useState<OptionType>("call");
  const [S, setS] = useState(100);
  const [K, setK] = useState(100);
  const [T, setT] = useState(0.5);
  const [r, setR] = useState(0.05);
  const [sigma, setSigma] = useState(0.2);

  const greeks = useMemo(() => {
    const inp = { S, K, T, r, sigma };
    return type === "call" ? callGreeks(inp) : putGreeks(inp);
  }, [type, S, K, T, r, sigma]);

  // Build a payoff curve at expiry + current value curve across spots.
  // 60 sample spots from 0.5×K to 1.5×K.
  const curveData = useMemo(() => {
    const n = 60;
    const lo = 0.5 * K;
    const hi = 1.5 * K;
    const out: Array<{ spot: number; payoff: number; value: number }> = [];
    for (let i = 0; i < n; i++) {
      const spot = lo + ((hi - lo) * i) / (n - 1);
      const payoff =
        type === "call" ? Math.max(spot - K, 0) : Math.max(K - spot, 0);
      const inp = { S: spot, K, T, r, sigma };
      const v = type === "call" ? callGreeks(inp).price : putGreeks(inp).price;
      out.push({ spot, payoff, value: v });
    }
    return out;
  }, [type, K, T, r, sigma]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
      {/* Header */}
      <header>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TRACK_COLOR }} />
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: TRACK_COLOR }}>
            track
          </span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Pricing</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Black-Scholes intuition. Drag the sliders. The Greeks update live.
        </p>
      </header>

      {/* Call / Put toggle */}
      <div className="flex gap-1.5">
        {(["call", "put"] as OptionType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className="text-sm px-4 py-1.5 rounded-lg font-medium transition-colors"
            style={
              type === t
                ? { background: TRACK_COLOR, color: "white" }
                : { background: "var(--surface-2)", color: "var(--text-secondary)" }
            }
          >
            {t === "call" ? "Call" : "Put"}
          </button>
        ))}
      </div>

      {/* Price + Greeks */}
      <Card accent={TRACK_COLOR}>
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">
          {type === "call" ? "Call" : "Put"} value & Greeks
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: "Price", value: greeks.price, color: TRACK_COLOR, decimals: 4 },
            { label: "Delta", value: greeks.delta, decimals: 4 },
            { label: "Gamma", value: greeks.gamma, decimals: 5 },
            { label: "Vega (/100)", value: greeks.vega / 100, decimals: 4 },
            { label: "Theta (/day)", value: greeks.theta / 365, decimals: 4 },
            { label: "Rho (/100)", value: greeks.rho / 100, decimals: 4 },
          ].map((g) => (
            <div key={g.label}>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                {g.label}
              </p>
              <p
                className="text-base font-mono font-bold tabular-nums mt-0.5"
                style={{ color: g.color ?? "var(--foreground)" }}
              >
                {g.value.toFixed(g.decimals)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Payoff & value curve */}
      <Card>
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">
          Value vs spot (current = white) · payoff at expiry (orange)
        </p>
        <PayoffChart data={curveData} K={K} currentS={S} accent={TRACK_COLOR} />
      </Card>

      {/* Inputs */}
      <Card>
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-3">
          Inputs
        </p>
        <div className="space-y-4">
          <Slider
            label="Spot (S)"
            value={S} min={1} max={300} step={0.5}
            onChange={setS}
            format={(v) => `$${v.toFixed(2)}`}
            accentColor={TRACK_COLOR}
          />
          <Slider
            label="Strike (K)"
            value={K} min={1} max={300} step={0.5}
            onChange={setK}
            format={(v) => `$${v.toFixed(2)}`}
            accentColor={TRACK_COLOR}
          />
          <Slider
            label="Time to expiry (T, years)"
            value={T} min={0.01} max={3} step={0.01}
            onChange={setT}
            format={(v) => `${v.toFixed(2)}y (${Math.round(v * 365)}d)`}
            accentColor={TRACK_COLOR}
          />
          <Slider
            label="Vol (σ)"
            value={sigma} min={0.01} max={1.5} step={0.01}
            onChange={setSigma}
            format={(v) => `${(v * 100).toFixed(0)}%`}
            accentColor={TRACK_COLOR}
          />
          <Slider
            label="Risk-free rate (r)"
            value={r} min={-0.05} max={0.20} step={0.005}
            onChange={setR}
            format={(v) => `${(v * 100).toFixed(1)}%`}
            accentColor={TRACK_COLOR}
          />
        </div>
      </Card>

      {/* Written content */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] pl-1">
          What an interviewer expects you to know
        </p>
        {CONTENT.map((c) => (
          <Card key={c.title}>
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">
              {c.title}
            </h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {c.body}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------
// Inline SVG payoff/value chart. No chart library — keeps bundle small.
// ----------------------------------------------------------

function PayoffChart({
  data,
  K,
  currentS,
  accent,
}: {
  data: Array<{ spot: number; payoff: number; value: number }>;
  K: number;
  currentS: number;
  accent: string;
}) {
  const width = 600;
  const height = 220;
  const padding = { top: 10, right: 10, bottom: 25, left: 38 };

  const xs = data.map((d) => d.spot);
  const ys = data.flatMap((d) => [d.payoff, d.value]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys, 1);
  const minY = 0;

  const xScale = (x: number) =>
    padding.left + ((x - minX) / (maxX - minX)) * (width - padding.left - padding.right);
  const yScale = (y: number) =>
    height - padding.bottom - ((y - minY) / (maxY - minY)) * (height - padding.top - padding.bottom);

  const payoffPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(d.spot).toFixed(1)} ${yScale(d.payoff).toFixed(1)}`)
    .join(" ");
  const valuePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(d.spot).toFixed(1)} ${yScale(d.value).toFixed(1)}`)
    .join(" ");

  // x-axis tick positions: 5 evenly spaced
  const xTicks = Array.from({ length: 5 }, (_, i) =>
    minX + ((maxX - minX) * i) / 4
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Strike vertical line */}
      <line
        x1={xScale(K)}
        x2={xScale(K)}
        y1={padding.top}
        y2={height - padding.bottom}
        stroke="var(--text-muted)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      {/* Current spot vertical line */}
      <line
        x1={xScale(currentS)}
        x2={xScale(currentS)}
        y1={padding.top}
        y2={height - padding.bottom}
        stroke="var(--foreground)"
        strokeWidth={1}
        opacity={0.4}
      />
      {/* Payoff at expiry */}
      <path d={payoffPath} fill="none" stroke="#f97316" strokeWidth={1.5} opacity={0.7} />
      {/* Current value */}
      <path d={valuePath} fill="none" stroke="var(--foreground)" strokeWidth={1.5} />
      {/* x-axis */}
      <line
        x1={padding.left}
        x2={width - padding.right}
        y1={height - padding.bottom}
        y2={height - padding.bottom}
        stroke="var(--border)"
      />
      {/* y-axis */}
      <line
        x1={padding.left}
        x2={padding.left}
        y1={padding.top}
        y2={height - padding.bottom}
        stroke="var(--border)"
      />
      {/* x ticks */}
      {xTicks.map((t) => (
        <g key={t}>
          <line
            x1={xScale(t)}
            x2={xScale(t)}
            y1={height - padding.bottom}
            y2={height - padding.bottom + 4}
            stroke="var(--text-muted)"
          />
          <text
            x={xScale(t)}
            y={height - padding.bottom + 16}
            fontSize="10"
            fill="var(--text-muted)"
            textAnchor="middle"
            fontFamily="monospace"
          >
            {t.toFixed(0)}
          </text>
        </g>
      ))}
      {/* y axis label "spot" */}
      <text
        x={width / 2}
        y={height - 4}
        fontSize="9"
        fill="var(--text-muted)"
        textAnchor="middle"
      >
        spot
      </text>
      {/* y max label */}
      <text x={4} y={padding.top + 4} fontSize="10" fill="var(--text-muted)" fontFamily="monospace">
        {maxY.toFixed(1)}
      </text>
      {/* "K" label */}
      <text
        x={xScale(K)}
        y={padding.top - 1}
        fontSize="10"
        fill="var(--text-muted)"
        textAnchor="middle"
      >
        K
      </text>
    </svg>
  );
}
