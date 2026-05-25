"use client";

import { motion } from "framer-motion";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[var(--accent-blue)] text-white hover:brightness-110 active:brightness-90 shadow-md shadow-[var(--accent-blue)]/20",
  secondary:
    "bg-[var(--surface-3)] text-[var(--foreground)] border border-[var(--border)] hover:border-[var(--accent-blue)] hover:bg-[var(--surface-2)]",
  ghost:
    "bg-transparent text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]",
  danger:
    "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 hover:text-red-300",
  success:
    "bg-[var(--accent-green)]/20 text-green-400 border border-[var(--accent-green)]/30 hover:bg-[var(--accent-green)]/30",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      whileTap={{ scale: isDisabled ? 1 : 0.97 }}
      className={[
        "inline-flex items-center justify-center font-medium rounded-lg",
        "transition-all duration-150 cursor-pointer select-none",
        "focus-visible:outline-2 focus-visible:outline-[var(--accent-blue)] focus-visible:outline-offset-2",
        variantClasses[variant],
        sizeClasses[size],
        isDisabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
        className,
      ].join(" ")}
      disabled={isDisabled}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : null}
      {children}
    </motion.button>
  );
}
