"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Search, X, Plus, Users } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ESTADO_META } from "@/lib/estados";
import { fechaRelativa } from "@/lib/fecha";
import { useClienteOverlay } from "@/components/providers/ClienteOverlayProvider";

type Cliente = FunctionReturnType<typeof api.clientes.list>[number];

// Lista de clientes con buscador (Linear MOI-35).
export default function ClientesPage() {
  const { abrirNuevo } = useClienteOverlay();
  const datos = useQuery(api.clientes.list);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const qDigits = q.replace(/[^0-9]/g, "");
  const hasQuery = q !== "";

  // Búsqueda en vivo: nombre/email con cualquier longitud; teléfono solo con ≥2
  // dígitos (evita falsos positivos masivos), normalizando espacios y símbolos.
  const filtrados = useMemo(() => {
    if (!datos) return [];
    if (!hasQuery) return datos;
    return datos.filter((c) => {
      if (c.nombre.toLowerCase().includes(q)) return true;
      if (c.email && c.email.toLowerCase().includes(q)) return true;
      if (
        qDigits.length >= 2 &&
        c.telefono &&
        c.telefono.replace(/[^0-9]/g, "").includes(qDigits)
      ) {
        return true;
      }
      return false;
    });
  }, [datos, hasQuery, q, qDigits]);

  const cargando = datos === undefined;
  const n = hasQuery ? filtrados.length : (datos?.length ?? 0);
  const eyebrow = hasQuery
    ? `${n} ${n === 1 ? "resultado" : "resultados"}`
    : `${n} ${n === 1 ? "cliente" : "clientes"}`;

  const sinClientes = !cargando && (datos?.length ?? 0) === 0;
  const sinResultados = !cargando && !sinClientes && filtrados.length === 0;

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-subtle-fg">
            {cargando ? "Clientes" : eyebrow}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Clientes</h1>
        </div>
        <Button
          variant="primary"
          className="hidden md:inline-flex"
          onClick={abrirNuevo}
        >
          <Plus size={18} strokeWidth={2} />
          Nuevo cliente
        </Button>
      </header>

      <Input
        icon={Search}
        placeholder="Buscar por nombre, teléfono o email"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Buscar clientes"
        trailing={
          hasQuery ? (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => setQuery("")}
              className="focus-ring flex h-9 w-9 items-center justify-center rounded-md text-muted-fg hover:bg-surface-2"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          ) : undefined
        }
      />

      {cargando ? (
        <SkeletonLista />
      ) : sinClientes ? (
        <Card>
          <EmptyState
            icon={Users}
            titulo="Sin clientes todavía"
            ayuda="Añade tu primer cliente para empezar a vender."
            cta={
              <Button variant="primary" onClick={abrirNuevo}>
                Añadir cliente
              </Button>
            }
          />
        </Card>
      ) : sinResultados ? (
        <Card>
          <EmptyState
            icon={Search}
            titulo="Sin resultados"
            ayuda="No hay clientes que coincidan con tu búsqueda."
            cta={
              <Button variant="secondary" onClick={() => setQuery("")}>
                Limpiar búsqueda
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {filtrados.map((c) => (
              <ClienteRow key={c._id} c={c} />
            ))}
          </ul>
        </Card>
      )}

      {/* FAB (móvil): despeja la tab bar inferior fija. */}
      <button
        type="button"
        aria-label="Nuevo cliente"
        onClick={abrirNuevo}
        className="focus-ring fixed bottom-[76px] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg transition-colors hover:bg-primary-hover md:hidden"
      >
        <Plus size={24} strokeWidth={2} />
      </button>
    </div>
  );
}

function ClienteRow({ c }: { c: Cliente }) {
  const meta = ESTADO_META[c.estado];
  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        href={`/clientes/${c._id}?from=clientes`}
        className="focus-ring flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2"
      >
        <Avatar nombre={c.nombre} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">{c.nombre}</p>
          <p className="mt-0.5 truncate text-[13px] text-muted-fg">
            Último contacto:{" "}
            {c.ultimoContacto ? fechaRelativa(c.ultimoContacto) : "—"}
          </p>
        </div>
        <Badge tono={meta.tono}>{meta.label}</Badge>
      </Link>
    </li>
  );
}

function SkeletonLista() {
  return (
    <Card className="overflow-hidden">
      <ul>
        {Array.from({ length: 6 }).map((_, i) => (
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
