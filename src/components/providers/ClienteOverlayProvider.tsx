"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ClienteFormOverlay,
  type ClienteEditable,
} from "@/components/clientes/ClienteFormOverlay";

/**
 * Provider del overlay de alta/edición de cliente (MOI-34).
 * Expone `abrirNuevo` / `abrirEditar` para dispararlo desde cualquier pantalla
 * (Hoy, lista, ficha) sin prop-drilling. Se monta app-wide DENTRO de
 * Convex + Session + Toast (el formulario usa useMutation / useToast / useRouter).
 */

type Estado =
  | { modo: "nuevo" }
  | { modo: "editar"; inicial: ClienteEditable }
  | null;

interface ClienteOverlayContextValue {
  abrirNuevo: () => void;
  abrirEditar: (cliente: ClienteEditable) => void;
}

const ClienteOverlayContext = createContext<ClienteOverlayContextValue | null>(
  null,
);

export function ClienteOverlayProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(null);
  // Se incrementa en cada apertura para remontar el formulario limpio (key).
  const [apertura, setApertura] = useState(0);

  const abrirNuevo = useCallback(() => {
    setEstado({ modo: "nuevo" });
    setApertura((n) => n + 1);
  }, []);
  const abrirEditar = useCallback((cliente: ClienteEditable) => {
    setEstado({ modo: "editar", inicial: cliente });
    setApertura((n) => n + 1);
  }, []);
  const cerrar = useCallback(() => setEstado(null), []);

  const value = useMemo(
    () => ({ abrirNuevo, abrirEditar }),
    [abrirNuevo, abrirEditar],
  );

  return (
    <ClienteOverlayContext.Provider value={value}>
      {children}
      <ClienteFormOverlay
        key={apertura}
        open={estado !== null}
        modo={estado?.modo ?? "nuevo"}
        inicial={estado?.modo === "editar" ? estado.inicial : undefined}
        onClose={cerrar}
      />
    </ClienteOverlayContext.Provider>
  );
}

export function useClienteOverlay(): ClienteOverlayContextValue {
  const ctx = useContext(ClienteOverlayContext);
  if (!ctx) {
    throw new Error(
      "useClienteOverlay debe usarse dentro de <ClienteOverlayProvider>",
    );
  }
  return ctx;
}
