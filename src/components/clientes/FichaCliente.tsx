"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowLeft,
  Pencil,
  UserX,
  Phone,
  Mail,
  MessageSquarePlus,
  CalendarPlus,
  TrendingUp,
  Check,
  History,
  type LucideIcon,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ESTADO_META } from "@/lib/estados";
import { esAtrasado, fechaRelativa, hoyISO } from "@/lib/fecha";
import { useClienteOverlay } from "@/components/providers/ClienteOverlayProvider";

/**
 * Ficha de cliente (MOI-36): nodo central de la app. Cabecera de datos, acciones
 * rápidas (placeholders hasta sus fases) y seguimientos pendientes con datos reales.
 * TODO(MOI-37/38 · Fase 2): historial de interacciones/ventas/seguimientos completados.
 */

const CANAL_LABEL: Record<string, string> = {
  web: "Web",
  redes: "Redes",
  email: "Email",
  whatsapp: "WhatsApp",
};

// El origen viaja en la URL (?from=…). Allowlist server-safe: destino conocido y
// determinista, nunca depende del historial del navegador ni saca al usuario del CRM.
const ORIGENES: Record<string, { href: string; label: string }> = {
  hoy: { href: "/hoy", label: "Hoy" },
  clientes: { href: "/clientes", label: "Clientes" },
  ventas: { href: "/ventas", label: "Ventas" },
};
function resolverOrigen(from?: string) {
  return ORIGENES[from ?? ""] ?? ORIGENES.clientes;
}

function fechaLarga(ms: number): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

export function FichaCliente({ id, from }: { id: string; from?: string }) {
  const { abrirEditar } = useClienteOverlay();
  const cliente = useQuery(api.clientes.get, { id });
  const origen = resolverOrigen(from);

  if (cliente === undefined) return <FichaSkeleton origen={origen} />;

  if (cliente === null) {
    return (
      <div className="space-y-4">
        <Volver origen={origen} />
        <Card>
          <EmptyState
            icon={UserX}
            titulo="Cliente no encontrado"
            ayuda="Puede que se haya eliminado o que el enlace no sea válido."
            cta={
              <Link href="/clientes">
                <Button variant="secondary">Ver clientes</Button>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const meta = ESTADO_META[cliente.estado];

  return (
    <div className="space-y-4">
      <Volver origen={origen} />

      {/* Cabecera */}
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <Avatar nombre={cliente.nombre} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold">{cliente.nombre}</h1>
            {cliente.empresa ? (
              <p className="truncate text-[14px] text-muted-fg">
                {cliente.empresa}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tono={meta.tono}>{meta.label}</Badge>
              {cliente.canal ? (
                <Badge tono="neutral">
                  Origen: {CANAL_LABEL[cliente.canal] ?? cliente.canal}
                </Badge>
              ) : null}
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() =>
              abrirEditar({
                _id: cliente._id,
                nombre: cliente.nombre,
                empresa: cliente.empresa ?? null,
                telefono: cliente.telefono ?? null,
                email: cliente.email ?? null,
                estado: cliente.estado,
              })
            }
          >
            <Pencil size={16} strokeWidth={1.5} />
            Editar
          </Button>
        </div>

        {/* Filas de contacto tappables */}
        {cliente.telefono || cliente.email ? (
          <div className="mt-4 divide-y divide-line border-t border-line">
            {cliente.telefono ? (
              <ContactoRow
                icon={Phone}
                href={`tel:${cliente.telefono.replace(/\s+/g, "")}`}
              >
                {cliente.telefono}
              </ContactoRow>
            ) : null}
            {cliente.email ? (
              <ContactoRow icon={Mail} href={`mailto:${cliente.email}`}>
                {cliente.email}
              </ContactoRow>
            ) : null}
          </div>
        ) : null}

        {cliente.nota ? (
          <p className="mt-4 whitespace-pre-wrap rounded-md bg-surface-2 px-3 py-2.5 text-[14px] text-muted-fg">
            {cliente.nota}
          </p>
        ) : null}

        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-subtle-fg">
          <div className="flex gap-1.5">
            <dt>Último contacto:</dt>
            <dd className="text-muted-fg">
              {cliente.ultimoContacto
                ? fechaRelativa(cliente.ultimoContacto)
                : "—"}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Registrado:</dt>
            <dd className="text-muted-fg">
              {fechaLarga(cliente._creationTime)}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Acciones rápidas (placeholders hasta sus fases) */}
      <AccionesRapidas />

      {/* Seguimientos pendientes (datos reales) */}
      <SeguimientosPendientes clienteId={id} />

      {/* Historial (Fase 2) */}
      <Card>
        <SeccionHeader titulo="Historial" />
        <div className="px-4 py-2">
          <EmptyState
            icon={History}
            titulo="Sin actividad todavía"
            ayuda="Las interacciones, ventas y seguimientos completados aparecerán aquí."
          />
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------- Subcomponentes ----------------------------- */

function Volver({ origen }: { origen: { href: string; label: string } }) {
  return (
    <Link
      href={origen.href}
      className="focus-ring inline-flex items-center gap-1.5 rounded text-[14px] font-medium text-muted-fg hover:text-fg"
    >
      <ArrowLeft size={16} strokeWidth={1.5} />
      {origen.label}
    </Link>
  );
}

function ContactoRow({
  icon: Icon,
  href,
  children,
}: {
  icon: LucideIcon;
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className="focus-ring flex items-center gap-3 rounded-md py-3 text-[15px] text-primary"
    >
      <Icon size={18} strokeWidth={1.5} className="shrink-0 text-muted-fg" />
      <span className="truncate">{children}</span>
    </a>
  );
}

const ACCIONES: { label: string; icon: LucideIcon }[] = [
  { label: "Anotar interacción", icon: MessageSquarePlus },
  { label: "Programar seguimiento", icon: CalendarPlus },
  { label: "Registrar venta", icon: TrendingUp },
];

function AccionesRapidas() {
  const { showToast } = useToast();
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {ACCIONES.map(({ label, icon: Icon }) => (
        // Placeholders: los overlays llegan en MOI-37 (F2) / MOI-39 (F3) / MOI-43 (F4).
        <button
          key={label}
          onClick={() =>
            showToast({ mensaje: `${label}: disponible próximamente` })
          }
          className="focus-ring flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 text-left shadow-xs transition-colors hover:bg-surface-2"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
            <Icon size={20} strokeWidth={1.5} />
          </span>
          <span className="text-[14px] font-medium">{label}</span>
        </button>
      ))}
    </div>
  );
}

type Pendiente = FunctionReturnType<
  typeof api.seguimientos.listByCliente
>[number];

function SeguimientosPendientes({ clienteId }: { clienteId: string }) {
  const { showToast } = useToast();
  const pendientes = useQuery(api.seguimientos.listByCliente, { clienteId });

  const marcarHecho = useMutation(
    api.seguimientos.marcarHecho,
  ).withOptimisticUpdate((localStore, args) => {
    const actuales = localStore.getQuery(api.seguimientos.listByCliente, {
      clienteId,
    });
    if (actuales !== undefined) {
      localStore.setQuery(
        api.seguimientos.listByCliente,
        { clienteId },
        actuales.filter((s) => s._id !== args.id),
      );
    }
  });
  const desmarcar = useMutation(api.seguimientos.desmarcar);

  // Single-flight: evita disparar la mutation dos veces para el mismo ítem.
  const procesando = useRef<Set<Id<"seguimientos">>>(new Set());

  async function completar(s: Pendiente) {
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

  return (
    <Card>
      <SeccionHeader
        titulo="Seguimientos pendientes"
        contador={pendientes?.length}
      />
      {pendientes === undefined ? (
        <div className="space-y-2 p-4">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded bg-surface-2"
            />
          ))}
        </div>
      ) : pendientes.length === 0 ? (
        <p className="px-4 py-6 text-center text-[14px] text-subtle-fg">
          Sin seguimientos pendientes
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {pendientes.map((s) => (
            <ItemPendiente key={s._id} s={s} onCompletar={completar} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ItemPendiente({
  s,
  onCompletar,
}: {
  s: Pendiente;
  onCompletar: (s: Pendiente) => void;
}) {
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

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{s.accion}</p>
        <p
          className={`mt-0.5 text-[13px] ${
            atrasado ? "font-medium text-error" : "text-subtle-fg"
          }`}
        >
          {fechaRelativa(s.vence)}
        </p>
      </div>

      <Badge tono={atrasado ? "error" : "neutral"}>
        {atrasado ? "Atrasado" : "Pendiente"}
      </Badge>
      {s.responsableNombre ? (
        <Avatar nombre={s.responsableNombre} size={26} variante="neutral" />
      ) : null}
    </li>
  );
}

function SeccionHeader({
  titulo,
  contador,
}: {
  titulo: string;
  contador?: number;
}) {
  return (
    <header className="flex items-center gap-2 border-b border-line px-4 py-3">
      <h2 className="text-[15px] font-semibold">{titulo}</h2>
      {contador !== undefined ? (
        <span className="text-[13px] text-subtle-fg">{contador}</span>
      ) : null}
    </header>
  );
}

function FichaSkeleton({
  origen,
}: {
  origen: { href: string; label: string };
}) {
  return (
    <div className="space-y-4">
      <Volver origen={origen} />
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 animate-pulse rounded-full bg-surface-2" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-1/2 animate-pulse rounded bg-surface-2" />
            <div className="h-5 w-24 animate-pulse rounded-full bg-surface-2" />
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      </Card>
    </div>
  );
}
