import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTE: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary font-semibold hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "bg-surface border border-line-strong text-fg font-medium hover:bg-surface-2",
  ghost: "text-muted-fg font-medium hover:bg-surface-2",
};

/** Botón del design system (48px, radio 6px, anillo de foco verde). */
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-md px-5 text-[15px] transition-colors disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-2 disabled:text-subtle-fg ${VARIANTE[variant]} ${className}`}
      {...props}
    />
  );
}
