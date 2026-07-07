"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowLeft, Pencil, UserX } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ESTADO_META } from "@/lib/estados";
import { fechaRelativa } from "@/lib/fecha";
import { useClienteOverlay } from "@/components/providers/ClienteOverlayProvider";

/**
 * Ficha "fina" de cliente: datos núcleo + botón Editar (habilita el flujo
 * guardar→ficha y el disparador de edición de MOI-34).
 * TODO(MOI-36/37/38): timeline de interacciones, seguimientos, ventas y cambios de etapa.
 */

const CANAL_LABEL: Record<string, string> = {
  web: "Web",
  redes: "Redes",
  email: "Email",
  whatsapp: "WhatsApp",
};

function fechaLarga(ms: number): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

export function FichaClienteThin({ id }: { id: string }) {
  const { abrirEditar } = useClienteOverlay();
  const cliente = useQuery(api.clientes.get, { id });

  if (cliente === undefined) return <FichaSkeleton />;

  if (cliente === null) {
    return (
      <div className="space-y-4">
        <VolverAClientes />
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
      <VolverAClientes />

      <Card className="p-5">
        <div className="flex items-start gap-4">
          <Avatar nombre={cliente.nombre} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold">{cliente.nombre}</h1>
            <div className="mt-1.5">
              <Badge tono={meta.tono}>{meta.label}</Badge>
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

        <dl className="mt-5">
          {cliente.empresa ? (
            <Dato label="Empresa">{cliente.empresa}</Dato>
          ) : null}
          {cliente.telefono ? (
            <Dato label="Teléfono">
              <a
                href={`tel:${cliente.telefono.replace(/\s+/g, "")}`}
                className="focus-ring rounded text-primary"
              >
                {cliente.telefono}
              </a>
            </Dato>
          ) : null}
          {cliente.email ? (
            <Dato label="Email">
              <a
                href={`mailto:${cliente.email}`}
                className="focus-ring rounded text-primary"
              >
                {cliente.email}
              </a>
            </Dato>
          ) : null}
          {cliente.canal ? (
            <Dato label="Canal de origen">
              {CANAL_LABEL[cliente.canal] ?? cliente.canal}
            </Dato>
          ) : null}
          <Dato label="Último contacto">
            {cliente.ultimoContacto ? fechaRelativa(cliente.ultimoContacto) : "—"}
          </Dato>
          <Dato label="Registrado">{fechaLarga(cliente._creationTime)}</Dato>
          {cliente.nota ? (
            <Dato label="Nota">
              <span className="whitespace-pre-wrap">{cliente.nota}</span>
            </Dato>
          ) : null}
        </dl>
      </Card>
    </div>
  );
}

function VolverAClientes() {
  return (
    <Link
      href="/clientes"
      className="focus-ring inline-flex items-center gap-1.5 rounded text-[14px] font-medium text-muted-fg hover:text-fg"
    >
      <ArrowLeft size={16} strokeWidth={1.5} />
      Clientes
    </Link>
  );
}

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-b-0">
      <dt className="shrink-0 text-[13px] text-muted-fg">{label}</dt>
      <dd className="text-right text-[15px]">{children}</dd>
    </div>
  );
}

function FichaSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-20 animate-pulse rounded bg-surface-2" />
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 animate-pulse rounded-full bg-surface-2" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-1/2 animate-pulse rounded bg-surface-2" />
            <div className="h-5 w-24 animate-pulse rounded-full bg-surface-2" />
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      </Card>
    </div>
  );
}
