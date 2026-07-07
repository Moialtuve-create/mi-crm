import type { ComponentType, ReactNode } from "react";

type IconoLucide = ComponentType<{
  size?: number | string;
  strokeWidth?: number | string;
  className?: string;
}>;

/** Estado vacío: icono en cuadro + título + ayuda + CTA (design.md §8). */
export function EmptyState({
  icon: Icon,
  titulo,
  ayuda,
  cta,
}: {
  icon: IconoLucide;
  titulo: string;
  ayuda?: string;
  cta?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-2 text-muted-fg">
        <Icon size={24} strokeWidth={1.5} />
      </span>
      <div className="space-y-1">
        <p className="text-[15px] font-semibold">{titulo}</p>
        {ayuda ? <p className="text-[13px] text-muted-fg">{ayuda}</p> : null}
      </div>
      {cta}
    </div>
  );
}
