"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/common/Card";
import { Slider } from "@/components/common/Slider";
import { ar1, autocorr, makeRng, ols, randNormal } from "@/lib/stats";

const TRACK_COLOR = "var(--track-stats)";

const CONTENT = [
  {
    title: "OLS — what it actually optimizes",
    body: "β̂ minimizes the SUM OF SQUARED RESIDUALS. Geometrically it projects y onto the column space of X. The normal equations β̂ = (X'X)⁻¹X'y come from setting the gradient of the SSR to zero. Squared loss isn't a moral position — it's just convenient (smooth, gives the conditional mean under Gaussian noise).",
  },
  {
    title: "Why R² lies — adjusted R² fixes it",
    body: "R² always rises (never falls) when you add a regressor, even pure noise. Adjusted R² = 1 − (1 − R²)·(n − 1)/(n − k − 1) penalizes you for spending degrees of freedom. Production research code reports both; the gap reveals over-fitting.",
  },
  {
    title: "Stationarity — the time-series prerequisite",
    body: "A series is (weakly) stationary if mean and autocovariance don't depend on absolute time. Non-stationary series (random walks, trending prices) can give SPURIOUS regression results — two unrelated random walks regressed against each other show 'significance' a third of the time. The fix: first-difference, or test for cointegration explicitly.",
  },
  {
    title: "Autocorrelation breaks OLS standard errors",
    body: "Standard OLS assumes errors are i.i.d. If residuals are autocorrelated (very common in financial time series), your standard errors are too small and t-stats too big — you see significance where there is none. Newey-West (HAC) standard errors are the standard fix.",
  },
  {
    title: "AR(1) — the simplest model of mean reversion",
    body: "x_t = φ·x_{t-1} + ε_t. |φ| < 1: stationary, mean-reverts to 0. φ = 1: random walk, non-stationary, no reversion. φ slightly less than 1: 'almost-random-walk' — looks like a trend over short windows but reverts over long. Most equity spreads in pairs trading fit this regime.",
  },
  {
    title: "Cointegration in 30 seconds",
    body: "Two non-stationary series can have a LINEAR COMBINATION that IS stationary. If price_A and price_B are random walks but (price_A − β·price_B) mean-reverts, they're cointegrated — that's the canonical pairs-trade setup. Tests: Engle-Granger (two-step), Johansen (multi-asset).",
  },
];

export default function StatsPage() {
  // Regression playground state
  const [trueBeta, setTrueBeta] = useState(1.0);
  const [trueAlpha, setTrueAlpha] = useState(0.0);
  const [noiseSd, setNoiseSd] = useState(1.0);
  const [n, setN] = useState(50);
  const [seed, setSeed] = useState(42);

  const regData = useMemo(() => {
    const rng = makeRng(seed);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = -5 + 10 * (i / (n - 1)) + 0.4 * (rng() + 0.5);
      const y = trueAlpha + trueBeta * x + noiseSd * randNormal(rng);
      xs.push(x);
      ys.push(y);
    }
    const fit = ols(xs, ys);
    return { xs, ys, fit };
  }, [trueAlpha, trueBeta, noiseSd, n, seed]);

  // AR(1) playground
  const [phi, setPhi] = useState(0.8);
  const [arSeed, setArSeed] = useState(123);
  const arData = useMemo(() => {
    const rng = makeRng(arSeed);
    return ar1(200, phi, 1, rng);
  }, [phi, arSeed]);

  const ac1 = autocorr(arData, 1);
  const ac5 = autocorr(arData, 5);
  const ac10 = autocorr(arData, 10);

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
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Stats</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          OLS and time-series intuition. Watch the estimators converge as you change inputs.
        </p>
      </header>

      {/* OLS playground */}
      <Card accent={TRACK_COLOR}>
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            OLS — true vs estimated
          </p>
          <button
            onClick={() => setSeed((s) => s + 1)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--foreground)]"
          >
            Re-sample
          </button>
        </div>
        <ScatterFit data={regData} trueAlpha={trueAlpha} trueBeta={trueBeta} accent={TRACK_COLOR} />
        <div className="grid grid-cols-3 gap-3 mt-3 text-center">
          <Stat label="β̂" value={regData.fit.b.toFixed(3)} hint={`true ${trueBeta.toFixed(2)}`} />
          <Stat label="α̂" value={regData.fit.a.toFixed(3)} hint={`true ${trueAlpha.toFixed(2)}`} />
          <Stat label="R²" value={regData.fit.r2.toFixed(3)} />
        </div>
      </Card>

      <Card>
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-3">
          Regression inputs
        </p>
        <div className="space-y-4">
          <Slider label="True β (slope)" value={trueBeta} min={-3} max={3} step={0.05}
            onChange={setTrueBeta} format={(v) => v.toFixed(2)} accentColor={TRACK_COLOR} />
          <Slider label="True α (intercept)" value={trueAlpha} min={-5} max={5} step={0.1}
            onChange={setTrueAlpha} format={(v) => v.toFixed(2)} accentColor={TRACK_COLOR} />
          <Slider label="Noise σ" value={noiseSd} min={0.1} max={5} step={0.1}
            onChange={setNoiseSd} format={(v) => v.toFixed(2)} accentColor={TRACK_COLOR} />
          <Slider label="Sample size (n)" value={n} min={10} max={500} step={5}
            onChange={setN} format={(v) => v.toFixed(0)} accentColor={TRACK_COLOR} />
        </div>
      </Card>

      {/* AR(1) playground */}
      <Card accent={TRACK_COLOR}>
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            AR(1) process · x_t = φ·x_(t-1) + ε
          </p>
          <button
            onClick={() => setArSeed((s) => s + 1)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--foreground)]"
          >
            Re-sample
          </button>
        </div>
        <TimeSeriesChart data={arData} accent={TRACK_COLOR} />
        <div className="grid grid-cols-3 gap-3 mt-3 text-center">
          <Stat label="ACF(1)" value={ac1.toFixed(3)} hint={`true ${phi.toFixed(2)}`} />
          <Stat label="ACF(5)" value={ac5.toFixed(3)} hint={`true ${Math.pow(phi, 5).toFixed(2)}`} />
          <Stat label="ACF(10)" value={ac10.toFixed(3)} hint={`true ${Math.pow(phi, 10).toFixed(2)}`} />
        </div>
        <div className="mt-4">
          <Slider label="φ (persistence)" value={phi} min={-0.95} max={0.99} step={0.01}
            onChange={setPhi} format={(v) => v.toFixed(2)} accentColor={TRACK_COLOR} />
        </div>
        <p className="text-xs italic text-[var(--text-muted)] mt-3">
          φ → 1: random walk (no mean reversion). φ ≈ 0: white noise. Negative φ: oscillating.
        </p>
      </Card>

      {/* Written content */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] pl-1">
          What an interviewer expects you to know
        </p>
        {CONTENT.map((c) => (
          <Card key={c.title}>
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">{c.title}</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{c.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <p className="text-base font-mono font-bold tabular-nums mt-0.5 text-[var(--foreground)]">{value}</p>
      {hint && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{hint}</p>}
    </div>
  );
}

function ScatterFit({
  data,
  trueAlpha,
  trueBeta,
  accent,
}: {
  data: { xs: number[]; ys: number[]; fit: { a: number; b: number; r2: number } };
  trueAlpha: number;
  trueBeta: number;
  accent: string;
}) {
  const width = 600;
  const height = 240;
  const pad = { top: 10, right: 10, bottom: 25, left: 30 };

  const allY = data.ys;
  const minX = Math.min(...data.xs);
  const maxX = Math.max(...data.xs);
  const yMin = Math.min(...allY);
  const yMax = Math.max(...allY);
  const margin = (yMax - yMin) * 0.1 || 1;

  const xS = (x: number) => pad.left + ((x - minX) / (maxX - minX)) * (width - pad.left - pad.right);
  const yS = (y: number) =>
    height - pad.bottom -
    ((y - (yMin - margin)) / (yMax - yMin + 2 * margin)) * (height - pad.top - pad.bottom);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* axes */}
      <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke="var(--border)" />
      <line x1={pad.left} x2={pad.left} y1={pad.top} y2={height - pad.bottom} stroke="var(--border)" />
      {/* true line */}
      <line
        x1={xS(minX)}
        x2={xS(maxX)}
        y1={yS(trueAlpha + trueBeta * minX)}
        y2={yS(trueAlpha + trueBeta * maxX)}
        stroke="var(--text-muted)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      {/* OLS line */}
      <line
        x1={xS(minX)}
        x2={xS(maxX)}
        y1={yS(data.fit.a + data.fit.b * minX)}
        y2={yS(data.fit.a + data.fit.b * maxX)}
        stroke={accent}
        strokeWidth={1.5}
      />
      {/* points */}
      {data.xs.map((x, i) => (
        <circle key={i} cx={xS(x)} cy={yS(data.ys[i])} r={2} fill="var(--foreground)" opacity={0.7} />
      ))}
      {/* legend */}
      <g transform={`translate(${pad.left + 5}, ${pad.top + 12})`}>
        <line x1={0} x2={14} y1={0} y2={0} stroke="var(--text-muted)" strokeDasharray="3 3" />
        <text x={20} y={3} fontSize="10" fill="var(--text-muted)">true</text>
        <line x1={60} x2={74} y1={0} y2={0} stroke={accent} strokeWidth={1.5} />
        <text x={80} y={3} fontSize="10" fill={accent}>OLS fit</text>
      </g>
    </svg>
  );
}

function TimeSeriesChart({ data, accent }: { data: number[]; accent: string }) {
  const width = 600;
  const height = 180;
  const pad = { top: 10, right: 10, bottom: 20, left: 30 };
  const minV = Math.min(...data);
  const maxV = Math.max(...data);
  const margin = (maxV - minV) * 0.1 || 1;

  const xS = (i: number) => pad.left + (i / (data.length - 1)) * (width - pad.left - pad.right);
  const yS = (v: number) =>
    height - pad.bottom -
    ((v - (minV - margin)) / (maxV - minV + 2 * margin)) * (height - pad.top - pad.bottom);

  const path = data.map((v, i) => `${i === 0 ? "M" : "L"} ${xS(i).toFixed(1)} ${yS(v).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <line x1={pad.left} x2={width - pad.right} y1={yS(0)} y2={yS(0)}
        stroke="var(--text-muted)" strokeWidth={0.5} strokeDasharray="2 4" />
      <path d={path} fill="none" stroke={accent} strokeWidth={1.2} />
    </svg>
  );
}
