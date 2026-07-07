import { FichaClienteThin } from "@/components/clientes/FichaClienteThin";

// Ficha de cliente: nodo central de la app (push con botón atrás).
// Fina en esta entrega (datos + Editar); el timeline completo es MOI-36/37/38.
export default async function FichaClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FichaClienteThin id={id} />;
}
