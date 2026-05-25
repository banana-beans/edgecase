"use client";

import type { ChangeEvent } from "react";

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  accentColor = "var(--accent-blue)",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  format?: (v: number) => string;
  accentColor?: string;
}) {
  const display = format ? format(value) : value.toFixed(2);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </label>
        <span
          className="text-sm font-mono font-semibold tabular-nums"
          style={{ color: accentColor }}
        >
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-[var(--surface-3)] rounded-full appearance-none cursor-pointer accent-[var(--accent-blue)]"
        style={{ accentColor }}
      />
    </div>
  );
}
