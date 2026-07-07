import type { Tono } from "@/components/ui/Badge";

/** Estado del cliente (espejo de `estadoCliente` en convex/schema.ts). */
export type EstadoCliente =
  | "nuevo_lead"
  | "en_negociacion"
  | "pendiente"
  | "ganado"
  | "perdido";

/** Etiqueta y tono de cada estado (design.md §8: pares de estado). */
export const ESTADO_META: Record<EstadoCliente, { label: string; tono: Tono }> =
  {
    nuevo_lead: { label: "Nuevo lead", tono: "info" },
    en_negociacion: { label: "En negociación", tono: "primary" },
    pendiente: { label: "Pendiente", tono: "warning" },
    ganado: { label: "Ganado", tono: "success" },
    perdido: { label: "Perdido", tono: "error" },
  };
