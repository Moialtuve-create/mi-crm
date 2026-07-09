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
import { VentaFormOverlay } from "@/components/ventas/VentaFormOverlay";

/**
 * Provider del overlay "Registrar venta" (MOI-43). Expone `abrirVenta` para dispararlo
 * desde la ficha (cliente fijo) o desde Hoy / la sección Ventas (con selector). Se monta
 * app-wide DENTRO de Convex + Session + Toast (el overlay usa useMutation/useToast).
 */

type Estado = { clienteId?: Id<"clientes"> } | null;

interface VentaOverlayContextValue {
  abrirVenta: (clienteId?: Id<"clientes">) => void;
}

const VentaOverlayContext = createContext<VentaOverlayContextValue | null>(null);

export function VentaOverlayProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(null);
  // Se incrementa en cada apertura para remontar el formulario limpio (key).
  const [apertura, setApertura] = useState(0);

  const abrirVenta = useCallback((clienteId?: Id<"clientes">) => {
    setEstado({ clienteId });
    setApertura((n) => n + 1);
  }, []);
  const cerrar = useCallback(() => setEstado(null), []);

  const value = useMemo(() => ({ abrirVenta }), [abrirVenta]);

  return (
    <VentaOverlayContext.Provider value={value}>
      {children}
      <VentaFormOverlay
        key={apertura}
        open={estado !== null}
        clienteId={estado?.clienteId}
        onClose={cerrar}
      />
    </VentaOverlayContext.Provider>
  );
}

export function useVentaOverlay(): VentaOverlayContextValue {
  const ctx = useContext(VentaOverlayContext);
  if (!ctx) {
    throw new Error(
      "useVentaOverlay debe usarse dentro de <VentaOverlayProvider>",
    );
  }
  return ctx;
}
