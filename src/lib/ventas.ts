import type { Tono } from "@/components/ui/Badge";

/** Estado de una venta/oportunidad (espejo de `estadoVenta` en convex/schema.ts). */
export type EstadoVenta = "abierta" | "ganada" | "perdida";

/**
 * Formatea un importe entero en dólares como `$21,000` (miles con coma, sin decimales,
 * símbolo delante, convención USD). No se usa `Intl` para mantener el formato exacto.
 */
export function formatUSD(n: number): string {
  return "$" + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Parsea el importe tecleado (solo dígitos) a un entero de dólares. Devuelve el número si
 * es > 0, o `null` si no hay importe válido.
 */
export function parseImporte(raw: string): number | null {
  const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Etiqueta, tono del `Badge` y color del importe por estado (design → CRM Shell.dc.html). */
export const VENTA_ESTADO_META: Record<
  EstadoVenta,
  { label: string; tono: Tono; amtClass: string }
> = {
  abierta: { label: "Oportunidad abierta", tono: "info", amtClass: "text-fg" },
  ganada: { label: "Ganada", tono: "success", amtClass: "text-success-fg" },
  perdida: { label: "Perdida", tono: "error", amtClass: "text-error-fg" },
};
