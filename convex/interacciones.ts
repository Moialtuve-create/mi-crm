import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { tipoInteraccion } from "./schema";

/**
 * Interacciones — anotar lo que pasó en una conversación (Linear MOI-37) y leer el
 * historial del cliente (MOI-38, aquí solo interacciones; ventas y seguimientos
 * completados se integran en sus fases).
 *
 * PII (texto de la conversación) en endpoints PÚBLICOS sin auth: aceptable SOLO en
 * esta fase local/mock. TODO(MOI-80): exigir ctx.auth (autor real + permisos).
 */

/** yyyy-mm-dd que además es una fecha de calendario real (rechaza 2026-99-99, 2026-02-30). */
function esFechaISOReal(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [y, m, d] = fecha.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export const crear = mutation({
  // El autor lo aporta el CLIENTE en esta fase mock (usuario en sesión); igual que la
  // fecha local yyyy-mm-dd, que Convex (UTC) no debe inventar.
  args: {
    clienteId: v.id("clientes"),
    tipo: tipoInteraccion,
    texto: v.string(),
    fecha: v.string(),
    autorId: v.id("usuarios"),
  },
  handler: async (ctx, { clienteId, tipo, texto, fecha, autorId }) => {
    // TODO(MOI-80): el autor real vendrá de ctx.auth; hoy lo aporta el cliente.
    if (!esFechaISOReal(fecha)) {
      throw new Error("fecha debe ser una fecha real en formato yyyy-mm-dd");
    }
    const nota = texto.trim();
    if (!nota) throw new Error("La nota no puede estar vacía");

    const cliente = await ctx.db.get(clienteId);
    if (!cliente) throw new Error("El cliente ya no existe");
    const autor = await ctx.db.get(autorId);
    if (!autor) throw new Error("El autor no existe");

    const interaccionId = await ctx.db.insert("interacciones", {
      clienteId,
      tipo,
      texto: nota,
      fecha,
      autorId,
    });

    // "Último contacto": solo avanza, nunca retrocede (registrar una interacción con
    // fecha pasada no debe pisar un contacto más reciente).
    const prev = cliente.ultimoContacto;
    if (!prev || fecha.localeCompare(prev) > 0) {
      await ctx.db.patch(clienteId, { ultimoContacto: fecha });
    }

    return interaccionId;
  },
});

export const listByCliente = query({
  // La ficha entrega el id como string; normalizeId → [] si es inválido (no rompe).
  args: { clienteId: v.string() },
  handler: async (ctx, { clienteId }) => {
    const cid = ctx.db.normalizeId("clientes", clienteId);
    if (!cid) return [];

    const items = await ctx.db
      .query("interacciones")
      .withIndex("by_cliente", (q) => q.eq("clienteId", cid))
      .collect();

    // Historial: más reciente primero. Empate por día → el insertado más tarde arriba.
    const ordenadas = items.sort(
      (a, b) => b.fecha.localeCompare(a.fecha) || b._creationTime - a._creationTime,
    );

    // Join autores: deduplicar ids + Promise.all (patrón de seguimientos.listHoy).
    const autorIds = [...new Set(ordenadas.map((i) => i.autorId))];
    const autores = await Promise.all(autorIds.map((id) => ctx.db.get(id)));
    const autorMap = new Map(
      autores.flatMap((u) => (u ? [[u._id, u] as const] : [])),
    );

    // TODO(MOI-80): exigir ctx.auth (PII del cliente vía su historial).
    return ordenadas.map((i) => ({
      _id: i._id,
      tipo: i.tipo,
      texto: i.texto,
      fecha: i.fecha,
      autorNombre: autorMap.get(i.autorId)?.nombre ?? "",
    }));
  },
});
