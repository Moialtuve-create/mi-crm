"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Toast único con acción opcional (p. ej. "Deshacer") y auto-cierre ~3.8s.
 *
 * Carreras: al mostrar un toast nuevo se cancela el anterior; el auto-cierre solo
 * descarta el toast si sigue siendo el mismo (por id); la acción se ejecuta y cierra.
 */

interface ToastOpts {
  mensaje: string;
  accion?: { label: string; onClick: () => void };
  duracionMs?: number;
}

interface ToastState extends ToastOpts {
  id: number;
}

interface ToastContextValue {
  showToast: (opts: ToastOpts) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const DURACION_DEFECTO = 3800;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const limpiarTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    limpiarTimer();
    setToast(null);
  }, [limpiarTimer]);

  const showToast = useCallback(
    (opts: ToastOpts) => {
      limpiarTimer();
      const id = ++idRef.current;
      setToast({ ...opts, id });
      timer.current = setTimeout(() => {
        timer.current = null;
        setToast((actual) => (actual && actual.id === id ? null : actual));
      }, opts.duracionMs ?? DURACION_DEFECTO);
    },
    [limpiarTimer],
  );

  useEffect(() => limpiarTimer, [limpiarTimer]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? (
        <div
          className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-4 rounded-lg bg-fg px-4 py-3 text-[14px] text-surface shadow-lg">
            <span>{toast.mensaje}</span>
            {toast.accion ? (
              <button
                className="focus-ring shrink-0 font-semibold text-primary"
                onClick={() => {
                  toast.accion!.onClick();
                  dismiss();
                }}
              >
                {toast.accion.label}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de <ToastProvider>");
  }
  return ctx;
}
