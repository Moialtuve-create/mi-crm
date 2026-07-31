"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Plus, LogOut, CircleAlert, Pencil, Trash2 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Overlay } from "@/components/ui/Overlay";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useEquipoOverlay } from "@/components/providers/EquipoOverlayProvider";
import { ROL_META } from "@/lib/roles";

type UsuarioFila = NonNullable<FunctionReturnType<typeof api.usuarios.equipoListado>>[number];

// Gestión de usuarios (Linear MOI-81) — solo visible/accesible para la Dueña.
export default function EquipoPage() {
  const { abrirNuevo, abrirEditar } = useEquipoOverlay();
  const usuario = useCurrentUser();
  const esPropietaria = usuario?.rol === "propietaria";
  // Auditoría de plan MOI-81 (M2): useQuery debe llamarse en TODOS los renders — no se
  // puede hacer un `return` condicional antes (usuario es `undefined` en el primer
  // render, y el rol solo se conoce después). "skip" evita pedir el listado completo
  // (con emails) hasta confirmar que quien llama es propietaria.
  const datos = useQuery(api.usuarios.equipoListado, esPropietaria ? {} : "skip");
  const eliminar = useMutation(api.usuarios.eliminar);

  const [aEliminar, setAEliminar] = useState<{ _id: Id<"usuarios">; nombre: string } | null>(
    null,
  );
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  if (usuario === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span
          className="h-6 w-6 animate-spin rounded-full border-[3px] border-surface-2 border-t-primary"
          aria-label="Cargando"
        />
      </div>
    );
  }

  if (!esPropietaria) {
    return (
      <Card>
        <EmptyState
          icon={LogOut}
          titulo="Acceso restringido"
          ayuda="Solo la Dueña puede gestionar el equipo."
        />
      </Card>
    );
  }

  const propietarias = datos?.filter((u) => u.rol === "propietaria").length ?? 0;
  const puedeEliminar = (u: UsuarioFila) =>
    u._id !== usuario._id && !(u.rol === "propietaria" && propietarias <= 1);

  async function confirmarEliminar() {
    if (!aEliminar || eliminando) return;
    setEliminando(true);
    setErrorEliminar(null);
    try {
      await eliminar({ id: aEliminar._id });
      setAEliminar(null);
    } catch (e) {
      setErrorEliminar(
        e instanceof Error ? e.message : "No se pudo eliminar el usuario. Inténtalo de nuevo.",
      );
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-subtle-fg">
            Gestión del equipo
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Equipo</h1>
        </div>
        <Button
          variant="primary"
          className="hidden md:inline-flex"
          onClick={abrirNuevo}
        >
          <Plus size={18} strokeWidth={2} />
          Añadir usuario
        </Button>
      </header>

      {!datos ? (
        <SkeletonLista />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {datos.map((u) => (
              <li key={u._id} className="border-b border-line last:border-b-0">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <Avatar nombre={u.nombre} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{u.nombre}</p>
                    <p className="mt-0.5 truncate text-[13px] text-muted-fg">{u.email}</p>
                  </div>
                  <Badge tono={ROL_META[u.rol].tono}>{ROL_META[u.rol].label}</Badge>
                  <button
                    type="button"
                    aria-label="Editar usuario"
                    onClick={() => abrirEditar(u)}
                    className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-subtle-fg hover:bg-surface-2 hover:text-fg"
                  >
                    <Pencil size={18} strokeWidth={1.5} />
                  </button>
                  {puedeEliminar(u) ? (
                    <button
                      type="button"
                      aria-label="Eliminar usuario"
                      onClick={() => setAEliminar({ _id: u._id, nombre: u.nombre })}
                      className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-subtle-fg hover:bg-error-bg hover:text-error-fg"
                    >
                      <Trash2 size={18} strokeWidth={1.5} />
                    </button>
                  ) : (
                    <span className="h-9 w-9 shrink-0" aria-hidden />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* FAB (móvil) */}
      <button
        type="button"
        aria-label="Añadir usuario"
        onClick={abrirNuevo}
        className="focus-ring fixed bottom-[76px] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg transition-colors hover:bg-primary-hover md:hidden"
      >
        <Plus size={24} strokeWidth={2} />
      </button>

      <Overlay
        open={aEliminar !== null}
        onClose={() => {
          if (!eliminando) {
            setAEliminar(null);
            setErrorEliminar(null);
          }
        }}
        titulo="Eliminar usuario"
        footer={
          <>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setAEliminar(null)}
              disabled={eliminando}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={confirmarEliminar}
              disabled={eliminando}
            >
              {eliminando ? "Eliminando…" : "Eliminar"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[14px] text-muted-fg">
            ¿Seguro que quieres eliminar a <strong>{aEliminar?.nombre}</strong>? Perderá el acceso
            al CRM.
          </p>
          {errorEliminar ? (
            <p className="flex items-center gap-1.5 rounded-md bg-error-bg px-3 py-2 text-[13px] text-error-fg">
              <CircleAlert size={14} strokeWidth={2} />
              {errorEliminar}
            </p>
          ) : null}
        </div>
      </Overlay>
    </div>
  );
}

function SkeletonLista() {
  return (
    <Card className="overflow-hidden">
      <ul>
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-b-0"
          >
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-surface-2" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-[38%] animate-pulse rounded bg-surface-2" />
              <div className="h-3 w-[60%] animate-pulse rounded bg-surface-2" />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
