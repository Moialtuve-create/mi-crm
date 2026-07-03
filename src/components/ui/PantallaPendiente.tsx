/**
 * Placeholder de pantalla aún no construida. Sustituir por la pantalla real
 * siguiendo la sección "Referencia de diseño" de su tarea en Linear.
 */
export function PantallaPendiente({
  titulo,
  tarea,
  referencia,
}: {
  titulo: string;
  tarea: string;
  referencia: string;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-xs">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      <p className="mt-2 text-sm text-muted-fg">
        Pendiente de construir — Linear {tarea}.
      </p>
      <p className="mt-1 text-sm text-subtle-fg">Diseño: {referencia}</p>
    </section>
  );
}
