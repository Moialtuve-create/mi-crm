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
  UsuarioFormOverlay,
  type UsuarioEditable,
} from "@/components/equipo/UsuarioFormOverlay";

/**
 * Provider del overlay de alta/edición de usuario (MOI-81). Mismo patrón que
 * `ClienteOverlayProvider`: expone `abrirNuevo` / `abrirEditar` sin prop-drilling, y
 * remonta el formulario limpio en cada apertura vía `key={apertura}`.
 */

type Estado =
  | { modo: "nuevo" }
  | { modo: "editar"; inicial: UsuarioEditable }
  | null;

interface EquipoOverlayContextValue {
  abrirNuevo: () => void;
  abrirEditar: (usuario: UsuarioEditable) => void;
}

const EquipoOverlayContext = createContext<EquipoOverlayContextValue | null>(
  null,
);

export function EquipoOverlayProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(null);
  const [apertura, setApertura] = useState(0);

  const abrirNuevo = useCallback(() => {
    setEstado({ modo: "nuevo" });
    setApertura((n) => n + 1);
  }, []);
  const abrirEditar = useCallback((usuario: UsuarioEditable) => {
    setEstado({ modo: "editar", inicial: usuario });
    setApertura((n) => n + 1);
  }, []);
  const cerrar = useCallback(() => setEstado(null), []);

  const value = useMemo(
    () => ({ abrirNuevo, abrirEditar }),
    [abrirNuevo, abrirEditar],
  );

  return (
    <EquipoOverlayContext.Provider value={value}>
      {children}
      <UsuarioFormOverlay
        key={apertura}
        open={estado !== null}
        modo={estado?.modo ?? "nuevo"}
        inicial={estado?.modo === "editar" ? estado.inicial : undefined}
        onClose={cerrar}
      />
    </EquipoOverlayContext.Provider>
  );
}

export function useEquipoOverlay(): EquipoOverlayContextValue {
  const ctx = useContext(EquipoOverlayContext);
  if (!ctx) {
    throw new Error(
      "useEquipoOverlay debe usarse dentro de <EquipoOverlayProvider>",
    );
  }
  return ctx;
}
