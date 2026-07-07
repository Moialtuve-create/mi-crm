"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  Plus,
  MessageSquarePlus,
  TrendingUp,
  UserPlus,
  Check,
  CalendarCheck,
  type LucideIcon,
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useClienteOverlay } from "@/components/providers/ClienteOverlayProvider";
import { ESTADO_META } from "@/lib/estados";
import {
  diasDesdeHoy,
  esAtrasado,
  fechaRelativa,
  formatEyebrowFecha,
  hoyISO,
} from "@/lib/fecha";

type Seguimiento = FunctionReturnType<typeof api.seguimientos.listHoy>[number];

// Pantalla inicial de la app tras el login (Linear MOI-40).
export default function HoyPage() {
  const { showToast } = useToast();
  const { abrirNuevo } = useClienteOverlay();
  const seguimientos = useQuery(api.seguimientos.listHoy);

  // Marcar hecho: optimista (quita el ítem al instante). Convex revierte solo si falla.
  const marcarHecho = useMutation(
    api.seguimientos.marcarHecho,
  ).withOptimisticUpdate((localStore, args) => {
    const actuales = localStore.getQuery(api.seguimientos.listHoy, {});
    if (actuales !== undefined) {
      localStore.setQuery(
        api.seguimientos.listHoy,
        {},
        actuales.filter((s) => s._id !== args.id),
      );
    }
  });
  const desmarcar = useMutation(api.seguimientos.desmarcar);

  // Evita disparar la mutation dos veces para el mismo ítem (single-flight).
  const procesando = useRef<Set<Id<"seguimientos">>>(new Set());

  async function completar(s: Seguimiento) {
    if (procesando.current.has(s._id)) return;
    procesando.current.add(s._id);
    try {
      // La fecha de completado la aporta el cliente (su día local), no el runtime UTC.
      await marcarHecho({ id: s._id, fechaHecho: hoyISO() });
      showToast({
        mensaje: "Seguimiento completado",
        accion: { label: "Deshacer", onClick: () => deshacer(s._id) },
      });
    } catch {
      showToast({ mensaje: "No se pudo completar el seguimiento" });
    } finally {
      procesando.current.delete(s._id);
    }
  }

  function deshacer(id: Id<"seguimientos">) {
    desmarcar({ id }).catch(() =>
      showToast({ mensaje: "No se pudo deshacer" }),
    );
  }

  const grupos = useMemo(() => {
    const atrasados: Seguimiento[] = [];
    const paraHoy: Seguimiento[] = [];
    const proximas: Seguimiento[] = [];
    for (const s of seguimientos ?? []) {
      const d = diasDesdeHoy(s.vence);
      if (d < 0) atrasados.push(s);
      else if (d === 0) paraHoy.push(s);
      else proximas.push(s);
    }
    return { atrasados, paraHoy, proximas };
  }, [seguimientos]);

  const total = seguimientos?.length ?? 0;
  const cargando = seguimientos === undefined;

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.06em] text-subtle-fg">
          {formatEyebrowFecha()}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">
          {cargando
            ? "Tareas del día"
            : `${total} ${
                total === 1 ? "seguimiento pendiente" : "seguimientos pendientes"
              }`}
        </h1>
      </header>

      {/* Panel de acciones rápidas */}
      <AccionesRapidas
        onNuevoCliente={abrirNuevo}
        onStub={(label) =>
          showToast({ mensaje: `${label}: disponible próximamente` })
        }
      />

      {/* Secciones o estados */}
      {cargando ? (
        <Skeletons />
      ) : total === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarCheck}
            titulo="No hay seguimientos para hoy"
            ayuda="Cuando programes seguimientos, aparecerán aquí ordenados por urgencia."
            cta={
              <Button
                variant="primary"
                onClick={() =>
                  showToast({ mensaje: "Nueva tarea: disponible próximamente" })
                }
              >
                Nueva tarea
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <Seccion
            titulo="Atrasados"
            tono="error"
            items={grupos.atrasados}
            onCompletar={completar}
            destacada
          />
          <Seccion
            titulo="Para hoy"
            tono="primary"
            items={grupos.paraHoy}
            onCompletar={completar}
          />
          <Seccion
            titulo="Próximas"
            tono="neutral"
            items={grupos.proximas}
            onCompletar={completar}
          />
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Subcomponentes ----------------------------- */

const TILES: { label: string; icon: LucideIcon; destacado?: boolean }[] = [
  { label: "Nueva tarea", icon: Plus, destacado: true },
  { label: "Anotar interacción", icon: MessageSquarePlus },
  { label: "Registrar venta", icon: TrendingUp },
  { label: "Nuevo cliente", icon: UserPlus },
];

function AccionesRapidas({
  onNuevoCliente,
  onStub,
}: {
  onNuevoCliente: () => void;
  onStub: (label: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {TILES.map(({ label, icon: Icon, destacado }) => (
        // "Nuevo cliente" abre el overlay real (MOI-34). Los otros 3 siguen como
        // stub: Nueva tarea (MOI-39), Interacción (MOI-37), Venta (MOI-43).
        <button
          key={label}
          onClick={() =>
            label === "Nuevo cliente" ? onNuevoCliente() : onStub(label)
          }
          className="focus-ring flex flex-col items-center justify-center gap-2 rounded-xl border border-line bg-surface p-4 text-center shadow-xs transition-colors hover:bg-surface-2"
        >
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              destacado
                ? "bg-primary text-on-primary"
                : "bg-primary-subtle text-primary"
            }`}
          >
            <Icon size={20} strokeWidth={1.5} />
          </span>
          <span className="text-[13px] font-medium">{label}</span>
        </button>
      ))}
    </div>
  );
}

const PUNTO_SECCION: Record<"error" | "primary" | "neutral", string> = {
  error: "bg-error",
  primary: "bg-primary",
  neutral: "bg-subtle-fg",
};

function Seccion({
  titulo,
  tono,
  items,
  onCompletar,
  destacada,
}: {
  titulo: string;
  tono: "error" | "primary" | "neutral";
  items: Seguimiento[];
  onCompletar: (s: Seguimiento) => void;
  destacada?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <Card className={destacada ? "border-error/40" : ""}>
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className={`h-2 w-2 rounded-full ${PUNTO_SECCION[tono]}`} />
        <h2 className="text-[15px] font-semibold">{titulo}</h2>
        <span className="text-[13px] text-subtle-fg">{items.length}</span>
      </header>
      <ul className="divide-y divide-line">
        {items.map((s) => (
          <ItemSeguimiento key={s._id} s={s} onCompletar={onCompletar} />
        ))}
      </ul>
    </Card>
  );
}

function ItemSeguimiento({
  s,
  onCompletar,
}: {
  s: Seguimiento;
  onCompletar: (s: Seguimiento) => void;
}) {
  const estado = s.clienteEstado ? ESTADO_META[s.clienteEstado] : null;
  const atrasado = esAtrasado(s.vence);
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={() => onCompletar(s)}
        aria-label={`Marcar "${s.accion}" como hecho`}
        className="focus-ring flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-line-strong text-transparent transition-colors hover:border-primary hover:text-primary"
      >
        <Check size={14} strokeWidth={3} />
      </button>

      <Link
        href={`/clientes/${s.clienteId}`}
        className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-md"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-medium">
              {s.clienteNombre}
            </span>
            {estado ? <Badge tono={estado.tono}>{estado.label}</Badge> : null}
          </div>
          <p className="mt-0.5 truncate text-[13px] text-muted-fg">{s.accion}</p>
        </div>
        {s.responsableNombre ? (
          <Avatar nombre={s.responsableNombre} size={26} variante="neutral" />
        ) : null}
        <span
          className={`shrink-0 text-[13px] ${
            atrasado ? "font-medium text-error" : "text-subtle-fg"
          }`}
        >
          {fechaRelativa(s.vence)}
        </span>
      </Link>
    </li>
  );
}

function Skeletons() {
  return (
    <div className="space-y-4">
      {[0, 1].map((i) => (
        <Card key={i} className="p-4">
          <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((j) => (
              <div key={j} className="h-10 animate-pulse rounded bg-surface-2" />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
