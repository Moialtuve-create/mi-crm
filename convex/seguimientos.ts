import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Seguimientos — pantalla "Tareas del día" (Linear MOI-40).
 *
 * Visibilidad: "Hoy" es GLOBAL (decidido con el usuario) → sin filtro por responsable.
 * La agrupación Atrasados/Para hoy/Próximas se calcula en el cliente con su fecha local.
 */

// Solo traemos pendientes cuyo vencimiento cae dentro de esta ventana (evita arrastrar
// todo el futuro). Los atrasados se muestran completos porque son accionables.
const HORIZONTE_DIAS = 30;

// yyyy-mm-dd del runtime (UTC en Convex). SOLO para el corte grueso del horizonte
// (tolerante a ±1 día). NO usar para escribir fechas "locales" del usuario: esas las
// aporta el cliente, que sí conoce su zona horaria (contrato: fecha local yyyy-mm-dd).
function isoFecha(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sumarDias(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export const listHoy = query({
  args: {},
  handler: async (ctx) => {
    const horizonte = isoFecha(sumarDias(new Date(), HORIZONTE_DIAS));

    // Índice by_hecho_vence: pendientes ordenados por vence asc, acotados por el horizonte.
    const pendientes = await ctx.db
      .query("seguimientos")
      .withIndex("by_hecho_vence", (q) =>
        q.eq("hecho", false).lte("vence", horizonte),
      )
      .collect();

    // Join sin "batch" real: deduplicar ids y resolver con Promise.all.
    const clienteIds = [...new Set(pendientes.map((s) => s.clienteId))];
    const responsableIds = [...new Set(pendientes.map((s) => s.responsableId))];
    const [clientes, responsables] = await Promise.all([
      Promise.all(clienteIds.map((id) => ctx.db.get(id))),
      Promise.all(responsableIds.map((id) => ctx.db.get(id))),
    ]);
    const clienteMap = new Map(
      clientes.flatMap((c) => (c ? [[c._id, c] as const] : [])),
    );
    const responsableMap = new Map(
      responsables.flatMap((u) => (u ? [[u._id, u] as const] : [])),
    );

    return pendientes.map((s) => {
      const cliente = clienteMap.get(s.clienteId);
      const responsable = responsableMap.get(s.responsableId);
      return {
        _id: s._id,
        accion: s.accion,
        vence: s.vence,
        clienteId: s.clienteId,
        clienteNombre: cliente?.nombre ?? "Cliente eliminado",
        clienteEstado: cliente?.estado ?? null,
        responsableNombre: responsable?.nombre ?? "",
      };
    });
  },
});

export const marcarHecho = mutation({
  // `fechaHecho` la aporta el CLIENTE (su fecha local yyyy-mm-dd), no el runtime UTC.
  args: { id: v.id("seguimientos"), fechaHecho: v.string() },
  handler: async (ctx, { id, fechaHecho }) => {
    // La mutation es pública en esta fase mock: validar el formato de la fecha local.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaHecho)) {
      throw new Error("fechaHecho debe tener formato yyyy-mm-dd");
    }
    const seguimiento = await ctx.db.get(id);
    if (!seguimiento) throw new Error("El seguimiento ya no existe");
    // "Hoy global": cualquiera del equipo puede completar cualquier seguimiento.
    // TODO(MOI-80): registrar el autor de la acción vía ctx.auth (auditoría), no para restringir.
    await ctx.db.patch(id, { hecho: true, fechaHecho });
  },
});

export const desmarcar = mutation({
  args: { id: v.id("seguimientos") },
  handler: async (ctx, { id }) => {
    const seguimiento = await ctx.db.get(id);
    if (!seguimiento) throw new Error("El seguimiento ya no existe");
    await ctx.db.patch(id, { hecho: false, fechaHecho: undefined });
  },
});
