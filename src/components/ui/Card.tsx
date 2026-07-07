import type { ReactNode } from "react";

/** Tarjeta: superficie blanca + borde 1px + sombra sutil (design.md §8). */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-line bg-surface shadow-xs ${className}`}
    >
      {children}
    </section>
  );
}
