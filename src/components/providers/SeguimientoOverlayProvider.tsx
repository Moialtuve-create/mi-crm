"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { SeguimientoFormOverlay } from "@/components/seguimientos/SeguimientoFormOverlay";

/**
 * Provider del overlay "Programar seguimiento" / "Nueva tarea" (MOI-39). Expone
 * `abrirSeguimiento` para dispararlo desde la ficha (cliente fijo) o desde Hoy (con
 * selector). Se monta app-wide DENTRO de Convex + Session + Toast.
 */

type Estado = { clienteId?: Id<"clientes"> } | null;

interface SeguimientoOverlayContextValue {
  abrirSeguimiento: (clienteId?: Id<"clientes">) => void;
}

const SeguimientoOverlayContext =
  createContext<SeguimientoOverlayContextValue | null>(null);

export function SeguimientoOverlayProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [estado, setEstado] = useState<Estado>(null);
  // Se incrementa en cada apertura para remontar el formulario limpio (key).
  const [apertura, setApertura] = useState(0);

  const abrirSeguimiento = useCallback((clienteId?: Id<"clientes">) => {
    setEstado({ clienteId });
    setApertura((n) => n + 1);
  }, []);
  const cerrar = useCallback(() => setEstado(null), []);

  const value = useMemo(() => ({ abrirSeguimiento }), [abrirSeguimiento]);

  return (
    <SeguimientoOverlayContext.Provider value={value}>
      {children}
      <SeguimientoFormOverlay
        key={apertura}
        open={estado !== null}
        clienteId={estado?.clienteId}
        onClose={cerrar}
      />
    </SeguimientoOverlayContext.Provider>
  );
}

export function useSeguimientoOverlay(): SeguimientoOverlayContextValue {
  const ctx = useContext(SeguimientoOverlayContext);
  if (!ctx) {
    throw new Error(
      "useSeguimientoOverlay debe usarse dentro de <SeguimientoOverlayProvider>",
    );
  }
  return ctx;
}
