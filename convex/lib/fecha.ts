/** Validación compartida de fechas locales (contrato yyyy-mm-dd) usadas por las mutations públicas. */

/** yyyy-mm-dd que además es una fecha de calendario real (rechaza 2026-99-99, 2026-02-30). */
export function esFechaISOReal(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [y, m, d] = fecha.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}
