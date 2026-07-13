"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Plus, TrendingUp } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useVentaOverlay } from "@/components/providers/VentaOverlayProvider";
import { formatUSD, VENTA_ESTADO_META, type EstadoVenta } from "@/lib/ventas";

type Venta = FunctionReturnType<typeof api.ventas.list>[number];
type Filtro = "todas" | EstadoVenta;

// Sección Ventas y oportunidades (Linear MOI-42).
export default function VentasPage() {
  const { abrirVenta } = useVentaOverlay();
  const ventas = useQuery(api.ventas.list);
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const cargando = ventas === undefined;

  // Métricas: suma de importes por estado + conteo (una sola fuente: la lista completa).
  const metricas = useMemo(() => {
    let enMarcha = 0;
    let ganado = 0;
    let nAbierta = 0;
    let nGanada = 0;
    for (const v of ventas ?? []) {
      if (v.estado === "abierta") {
        enMarcha += v.importe;
        nAbierta++;
      } else if (v.estado === "ganada") {
        ganado += v.importe;
        nGanada++;
      }
    }
    return { enMarcha, ganado, nAbierta, nGanada };
  }, [ventas]);

  const conteos = useMemo(() => {
    const c: Record<Filtro, number> = {
      todas: 0,
      abierta: 0,
      ganada: 0,
      perdida: 0,
    };
    for (const v of ventas ?? []) {
      c.todas++;
      c[v.estado]++;
    }
    return c;
  }, [ventas]);

  const filtradas = (ventas ?? []).filter(
    (v) => filtro === "todas" || v.estado === filtro,
  );

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-subtle-fg">
            Registro de ventas
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Ventas y oportunidades</h1>
        </div>
        <Button variant="primary" onClick={() => abrirVenta()}>
          <Plus size={18} strokeWidth={1.5} />
          Añadir venta
        </Button>
      </header>

      {cargando ? (
        <Skeletons />
      ) : (
        <>
          {/* Métricas */}
          <div className="grid grid-cols-2 gap-3">
            <Metrica
              titulo="En marcha"
              valor={formatUSD(metricas.enMarcha)}
              valorClass="text-info-fg"
              subtitulo={`${metricas.nAbierta} ${
                metricas.nAbierta === 1 ? "oportunidad" : "oportunidades"
              }`}
            />
            <Metrica
              titulo="Ganado"
              valor={formatUSD(metricas.ganado)}
              valorClass="text-success-fg"
              subtitulo={`${metricas.nGanada} ${
                metricas.nGanada === 1 ? "venta cerrada" : "ventas cerradas"
              }`}
            />
          </div>

          {/* Filtro segmentado con contadores */}
          <div className="flex flex-wrap gap-2">
            {FILTROS.map(({ value, label }) => {
              const activo = filtro === value;
              return (
                <button
                  key={value}
                  onClick={() => setFiltro(value)}
                  aria-pressed={activo}
                  className={`focus-ring rounded-md border px-3 py-2 text-[14px] font-medium whitespace-nowrap transition-colors ${
                    activo
                      ? "border-primary bg-primary-subtle text-primary"
                      : "border-line-strong bg-surface text-muted-fg hover:bg-surface-2"
                  }`}
                >
                  {label} · {conteos[value]}
                </button>
              );
            })}
          </div>

          {/* Lista o estado vacío */}
          {filtradas.length === 0 ? (
            <Card>
              <div className="px-4 py-2">
                <EmptyState
                  icon={TrendingUp}
                  titulo={VACIO_MSG[filtro]}
                  ayuda="Registra una venta u oportunidad para verla aquí."
                  cta={
                    <Button variant="secondary" onClick={() => abrirVenta()}>
                      Añadir venta
                    </Button>
                  }
                />
              </div>
            </Card>
          ) : (
            <Card>
              <ul className="divide-y divide-line">
                {filtradas.map((v) => (
                  <FilaVenta key={v._id} v={v} />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* ----------------------------- Subcomponentes ----------------------------- */

const FILTROS: { value: Filtro; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "abierta", label: "En marcha" },
  { value: "ganada", label: "Ganadas" },
  { value: "perdida", label: "Perdidas" },
];

const VACIO_MSG: Record<Filtro, string> = {
  todas: "Sin ventas registradas",
  abierta: "Sin oportunidades abiertas",
  ganada: "Sin ventas ganadas",
  perdida: "Sin ventas perdidas",
};

// Círculo del icono, coloreado por estado (clases estáticas: Tailwind no purga dinámicas).
const CIRCULO: Record<EstadoVenta, string> = {
  abierta: "bg-info-bg text-info-fg",
  ganada: "bg-success-bg text-success-fg",
  perdida: "bg-error-bg text-error-fg",
};

// Fecha absoluta corta para el registro comercial (más estable que la relativa).
function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

function Metrica({
  titulo,
  valor,
  valorClass,
  subtitulo,
}: {
  titulo: string;
  valor: string;
  valorClass: string;
  subtitulo: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-[13px] text-muted-fg">{titulo}</p>
      <p
        className={`mt-1 font-mono text-[28px] font-medium leading-none tabular-nums ${valorClass}`}
      >
        {valor}
      </p>
      <p className="mt-1.5 text-[12px] text-subtle-fg">{subtitulo}</p>
    </Card>
  );
}

function FilaVenta({ v }: { v: Venta }) {
  const meta = VENTA_ESTADO_META[v.estado];
  return (
    <li>
      <Link
        href={`/clientes/${v.clienteId}?from=ventas`}
        className="focus-ring flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${CIRCULO[v.estado]}`}
        >
          <TrendingUp size={18} strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">{v.concepto}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <Badge tono={meta.tono}>{meta.label}</Badge>
            <span className="truncate text-[13px] text-subtle-fg">
              {v.clienteNombre}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`font-mono text-[15px] font-semibold tabular-nums ${meta.amtClass}`}
          >
            {formatUSD(v.importe)}
          </p>
          <p className="text-[13px] text-subtle-fg">{fechaCorta(v.fecha)}</p>
        </div>
      </Link>
    </li>
  );
}

function Skeletons() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <Card key={i} className="p-4">
            <div className="h-4 w-20 animate-pulse rounded bg-surface-2" />
            <div className="mt-2 h-7 w-28 animate-pulse rounded bg-surface-2" />
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <div className="space-y-3">
          {[0, 1, 2].map((j) => (
            <div key={j} className="h-12 animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      </Card>
    </div>
  );
}
