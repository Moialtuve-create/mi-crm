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
  MessageSquare,
  MessageSquarePlus,
  CalendarPlus,
  TrendingUp,
  Users,
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
import { formatEuro, VENTA_ESTADO_META } from "@/lib/ventas";
import { useClienteOverlay } from "@/components/providers/ClienteOverlayProvider";
import { useInteraccionOverlay } from "@/components/providers/InteraccionOverlayProvider";
import { useSeguimientoOverlay } from "@/components/providers/SeguimientoOverlayProvider";
import { useVentaOverlay } from "@/components/providers/VentaOverlayProvider";

/**
 * Ficha de cliente (MOI-36): nodo central de la app. Cabecera de datos, acciones
 * rápidas (interacción/seguimiento/venta, todas reales), seguimientos pendientes e
 * historial de interacciones + ventas.
 * TODO(MOI-38 · Fase 3/4): añadir los seguimientos completados al historial.
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

      {/* Acciones rápidas: "Anotar interacción" real (MOI-37), resto placeholder */}
      <AccionesRapidas clienteId={cliente._id} />

      {/* Seguimientos pendientes (datos reales) */}
      <SeguimientosPendientes clienteId={id} />

      {/* Historial de interacciones (MOI-38, aquí solo interacciones) */}
      <Historial clienteId={id} />
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

function AccionesRapidas({ clienteId }: { clienteId: Id<"clientes"> }) {
  const { abrirInteraccion } = useInteraccionOverlay();
  const { abrirSeguimiento } = useSeguimientoOverlay();
  const { abrirVenta } = useVentaOverlay();

  // Las tres acciones abren su overlay real (MOI-37 / MOI-39 / MOI-43), con el cliente
  // ya fijado por estar dentro de su ficha.
  const acciones: { label: string; icon: LucideIcon; onClick: () => void }[] = [
    {
      label: "Anotar interacción",
      icon: MessageSquarePlus,
      onClick: () => abrirInteraccion(clienteId),
    },
    {
      label: "Programar seguimiento",
      icon: CalendarPlus,
      onClick: () => abrirSeguimiento(clienteId),
    },
    {
      label: "Registrar venta",
      icon: TrendingUp,
      onClick: () => abrirVenta(clienteId),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {acciones.map(({ label, icon: Icon, onClick }) => (
        <button
          key={label}
          onClick={onClick}
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

const CANAL_ICONO: Record<string, LucideIcon> = {
  llamada: Phone,
  email: Mail,
  whatsapp: MessageSquare,
  en_persona: Users,
};
const CANAL_INTERACCION_LABEL: Record<string, string> = {
  llamada: "Llamada",
  email: "Email",
  whatsapp: "WhatsApp",
  en_persona: "En persona",
};

type Interaccion = FunctionReturnType<
  typeof api.interacciones.listByCliente
>[number];
type Venta = FunctionReturnType<typeof api.ventas.listByCliente>[number];

type HistItem =
  | ({ kind: "interaccion" } & Interaccion)
  | ({ kind: "venta" } & Venta);

// Historial de actividad (MOI-38). En esta entrega: interacciones + ventas.
// TODO(MOI-38 · Fase 3/4): añadir también los seguimientos completados al historial.
function Historial({ clienteId }: { clienteId: string }) {
  const interacciones = useQuery(api.interacciones.listByCliente, { clienteId });
  const ventas = useQuery(api.ventas.listByCliente, { clienteId });

  const cargando = interacciones === undefined || ventas === undefined;
  const items: HistItem[] | undefined = cargando
    ? undefined
    : [
        ...interacciones.map((i) => ({ kind: "interaccion" as const, ...i })),
        ...ventas.map((v) => ({ kind: "venta" as const, ...v })),
      ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <Card>
      <SeccionHeader titulo="Historial" contador={items?.length} />
      {items === undefined ? (
        <div className="space-y-2 p-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-2">
          <EmptyState
            icon={History}
            titulo="Sin actividad todavía"
            ayuda="Las interacciones y ventas de este cliente aparecerán aquí."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((it) =>
            it.kind === "interaccion" ? (
              <ItemHistorialInteraccion key={`i-${it._id}`} it={it} />
            ) : (
              <ItemHistorialVenta key={`v-${it._id}`} it={it} />
            ),
          )}
        </ul>
      )}
    </Card>
  );
}

function ItemHistorialInteraccion({ it }: { it: Interaccion }) {
  const Icono = CANAL_ICONO[it.tipo] ?? MessageSquare;
  const canal = CANAL_INTERACCION_LABEL[it.tipo] ?? it.tipo;
  return (
    <li className="flex gap-3 px-4 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-fg">
        <Icono size={16} strokeWidth={1.5} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-medium">{canal}</span>
          <span className="shrink-0 text-[13px] text-subtle-fg">
            {fechaRelativa(it.fecha)}
          </span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-[14px] text-fg">
          {it.texto}
        </p>
        <p className="mt-1 text-[13px] text-subtle-fg">
          Registrado por {it.autorNombre || "Sin autor"}
        </p>
      </div>
    </li>
  );
}

function ItemHistorialVenta({ it }: { it: Venta }) {
  const meta = VENTA_ESTADO_META[it.estado];
  return (
    <li className="flex gap-3 px-4 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-fg">
        <TrendingUp size={16} strokeWidth={1.5} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate text-[14px] font-medium">
            {it.concepto}
          </span>
          <span
            className={`shrink-0 font-mono text-[14px] font-semibold tabular-nums ${meta.amtClass}`}
          >
            {formatEuro(it.importe)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Badge tono={meta.tono}>{meta.label}</Badge>
          <span className="text-[13px] text-subtle-fg">
            {fechaRelativa(it.fecha)}
          </span>
        </div>
        <p className="mt-1 text-[13px] text-subtle-fg">
          Registrado por {it.autorNombre || "Sin autor"}
        </p>
      </div>
    </li>
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
