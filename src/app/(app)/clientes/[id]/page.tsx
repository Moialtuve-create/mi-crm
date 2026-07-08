import { FichaCliente } from "@/components/clientes/FichaCliente";

// Ficha de cliente (MOI-36): nodo central de la app (push con botón atrás).
// El origen viaja en ?from=<hoy|clientes|ventas> y se resuelve en el servidor para
// que "Atrás" tenga un destino determinista (sin depender del historial del navegador).
export default async function FichaClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const origen = Array.isArray(from) ? from[0] : from;
  return <FichaCliente id={id} from={origen} />;
}
