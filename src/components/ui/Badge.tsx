import type { ReactNode } from "react";

/** Tonos semánticos del design system (design.md §8). */
export type Tono =
  | "info"
  | "primary"
  | "warning"
  | "success"
  | "error"
  | "neutral";

const FONDO: Record<Tono, string> = {
  info: "bg-info-bg text-info-fg",
  primary: "bg-primary-subtle text-primary",
  warning: "bg-warning-bg text-warning-fg",
  success: "bg-success-bg text-success-fg",
  error: "bg-error-bg text-error-fg",
  neutral: "bg-surface-2 text-muted-fg",
};

const PUNTO: Record<Tono, string> = {
  info: "bg-info",
  primary: "bg-primary",
  warning: "bg-warning",
  success: "bg-success",
  error: "bg-error",
  neutral: "bg-subtle-fg",
};

/** Pill de estado con punto de color. */
export function Badge({
  tono = "neutral",
  children,
}: {
  tono?: Tono;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-medium ${FONDO[tono]}`}
    >
      <span className={`h-[7px] w-[7px] rounded-full ${PUNTO[tono]}`} />
      {children}
    </span>
  );
}
