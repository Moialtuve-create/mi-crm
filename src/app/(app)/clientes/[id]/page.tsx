import { PantallaPendiente } from "@/components/ui/PantallaPendiente";

// Ficha de cliente: nodo central de la app (push con botón atrás).
export default async function FichaClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PantallaPendiente
      titulo={`Ficha de cliente (${id})`}
      tarea="MOI-36 (ficha), MOI-37 (interacción), MOI-38 (historial), MOI-39 (seguimiento)"
      referencia='design/.../README.md → "4. Ficha de cliente"'
    />
  );
}
