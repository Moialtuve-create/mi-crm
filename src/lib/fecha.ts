/**
 * Utilidades de fecha (fecha local yyyy-mm-dd, sin horas).
 * Los seguimientos usan `vence` como yyyy-mm-dd; la agrupación y las etiquetas
 * relativas se calculan siempre con la fecha LOCAL del usuario.
 */

const MS_DIA = 86_400_000;

function isoFecha(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Hoy en local, yyyy-mm-dd. */
export function hoyISO(): string {
  return isoFecha(new Date());
}

/** Días enteros desde hoy hasta `iso` (negativo = pasado, 0 = hoy, positivo = futuro). */
export function diasDesdeHoy(iso: string): number {
  const hoy = parseISO(hoyISO());
  const objetivo = parseISO(iso);
  return Math.round((objetivo.getTime() - hoy.getTime()) / MS_DIA);
}

/** Un seguimiento está atrasado si su vencimiento es anterior a hoy. */
export function esAtrasado(vence: string): boolean {
  return diasDesdeHoy(vence) < 0;
}

/** Etiqueta relativa breve para la fecha de vencimiento. */
export function fechaRelativa(iso: string): string {
  const d = diasDesdeHoy(iso);
  if (d === 0) return "Hoy";
  if (d === -1) return "Ayer";
  if (d === 1) return "Mañana";
  if (d < 0) return `Hace ${-d} días`;
  if (d <= 7) return `En ${d} días`;
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
  }).format(parseISO(iso));
}

/** Eyebrow de la cabecera de Hoy, en mayúsculas: "LUNES, 6 DE JULIO". */
export function formatEyebrowFecha(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(date)
    .toUpperCase();
}
