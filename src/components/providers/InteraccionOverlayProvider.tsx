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
import { InteraccionFormOverlay } from "@/components/interacciones/InteraccionFormOverlay";

/**
 * Provider del overlay "Registrar interacción" (MOI-37). Expone `abrirInteraccion`
 * para dispararlo desde la ficha (cliente fijo) o desde Hoy (con selector). Se monta
 * app-wide DENTRO de Convex + Session + Toast (el overlay usa useMutation/useToast).
 */

type Estado = { clienteId?: Id<"clientes"> } | null;

interface InteraccionOverlayContextValue {
  abrirInteraccion: (clienteId?: Id<"clientes">) => void;
}

const InteraccionOverlayContext =
  createContext<InteraccionOverlayContextValue | null>(null);

export function InteraccionOverlayProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [estado, setEstado] = useState<Estado>(null);
  // Se incrementa en cada apertura para remontar el formulario limpio (key).
  const [apertura, setApertura] = useState(0);

  const abrirInteraccion = useCallback((clienteId?: Id<"clientes">) => {
    setEstado({ clienteId });
    setApertura((n) => n + 1);
  }, []);
  const cerrar = useCallback(() => setEstado(null), []);

  const value = useMemo(() => ({ abrirInteraccion }), [abrirInteraccion]);

  return (
    <InteraccionOverlayContext.Provider value={value}>
      {children}
      <InteraccionFormOverlay
        key={apertura}
        open={estado !== null}
        clienteId={estado?.clienteId}
        onClose={cerrar}
      />
    </InteraccionOverlayContext.Provider>
  );
}

export function useInteraccionOverlay(): InteraccionOverlayContextValue {
  const ctx = useContext(InteraccionOverlayContext);
  if (!ctx) {
    throw new Error(
      "useInteraccionOverlay debe usarse dentro de <InteraccionOverlayProvider>",
    );
  }
  return ctx;
}
