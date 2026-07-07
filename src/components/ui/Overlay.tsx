"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Shell de diálogo compartido (infra para todos los formularios overlay).
 * Hoja inferior en móvil (slide-up + grabber) / modal centrado en escritorio (pop-in).
 * Accesible: role="dialog" aria-modal, foco al primer campo, foco atrapado (Tab/Shift+Tab),
 * cierre con Esc / scrim / botón, bloqueo de scroll del body y restauración de foco.
 */
export function Overlay({
  open,
  onClose,
  titulo,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  titulo: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previoRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Guardar el foco previo y bloquear el scroll del body (evita scroll detrás en móvil).
    previoRef.current = document.activeElement as HTMLElement | null;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Foco al primer campo tras el frame de animación.
    const t = window.setTimeout(() => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      const primero = sheet.querySelector<HTMLElement>(
        "input, textarea, select",
      );
      (primero ?? sheet).focus();
    }, 60);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const focusables = sheet.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      const activo = document.activeElement;
      if (e.shiftKey && activo === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflowPrevio;
      previoRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="vibe-scrim fixed inset-0 z-[1000] flex items-end justify-center bg-[rgba(16,24,32,0.45)] md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="vibe-sheet flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-lg outline-none md:max-h-[90vh] md:w-[480px] md:rounded-xl"
      >
        {/* Grabber: solo móvil */}
        <div className="flex justify-center pt-2.5 md:hidden">
          <span className="h-1 w-9 rounded-full bg-line-strong" />
        </div>

        <header className="flex items-center justify-between px-5 pb-1 pt-3">
          <h3 className="text-[18px] font-semibold tracking-[-0.011em]">
            {titulo}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="focus-ring -mr-1.5 flex h-9 w-9 items-center justify-center rounded-md text-muted-fg hover:bg-surface-2"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pb-2 pt-2">{children}</div>

        {footer ? (
          <div className="flex gap-3 border-t border-line px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
