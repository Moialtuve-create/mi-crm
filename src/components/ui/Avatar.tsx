/** Avatar de iniciales (design.md §8). Data-first: sin imágenes. */

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function Avatar({
  nombre,
  size = 40,
  variante = "primary",
}: {
  nombre: string;
  size?: number;
  variante?: "primary" | "neutral";
}) {
  const cls =
    variante === "primary"
      ? "bg-primary-subtle text-primary"
      : "bg-surface-2 text-muted-fg";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${cls}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden
    >
      {iniciales(nombre)}
    </span>
  );
}
