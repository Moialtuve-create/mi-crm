import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { estadoVenta } from "./schema";
import { esFechaISOReal } from "./lib/fecha";

/**
 * Ventas y oportunidades — registrar una operación (Linear MOI-43) y leer la lista de
 * la sección Ventas + el historial del cliente (MOI-42 / MOI-38).
 *
 * PII (cliente, importes, autor) en endpoints PÚBLICOS sin auth: aceptable SOLO en esta
 * fase local/mock (deployment dev). NO-GO para producción/entorno compartido con datos
 * reales hasta que exista authz real. TODO(MOI-80): exigir ctx.auth (autor + permisos).
 */

// Orden estable de la lista de Ventas cuando dos operaciones caen el mismo día.
const ORDEN_ESTADO: Record<"abierta" | "ganada" | "perdida", number> = {
  abierta: 0,
  ganada: 1,
  perdida: 2,
};

export const crear = mutation({
  // El autor y la fecha los aporta el CLIENTE en esta fase mock (usuario en sesión y su
  // fecha local yyyy-mm-dd); Convex (UTC) no debe inventar ninguno de los dos.
  args: {
    clienteId: v.id("clientes"),
    concepto: v.string(),
    importe: v.number(),
    estado: estadoVenta,
    fecha: v.string(),
    autorId: v.id("usuarios"),
  },
  handler: async (ctx, { clienteId, concepto, importe, estado, fecha, autorId }) => {
    // TODO(MOI-80): el autor real vendrá de ctx.auth; hoy lo aporta el cliente.
    if (!esFechaISOReal(fecha)) {
      throw new Error("fecha debe ser una fecha real en formato yyyy-mm-dd");
    }
    const conceptoTrim = concepto.trim();
    if (!conceptoTrim) throw new Error("El concepto no puede estar vacío");
    // Importe en euros enteros (coherente con el parseo del cliente y con formatEuro).
    if (!Number.isInteger(importe) || importe <= 0) {
      throw new Error("El importe debe ser un entero mayor que 0");
    }

    const cliente = await ctx.db.get(clienteId);
    if (!cliente) throw new Error("El cliente ya no existe");
    const autor = await ctx.db.get(autorId);
    if (!autor) throw new Error("El autor no existe");

    return await ctx.db.insert("ventas", {
      clienteId,
      concepto: conceptoTrim,
      importe,
      estado,
      fecha,
      autorId,
    });
  },
});

export const list = query({
  // Toda la sección Ventas: métricas y filtro se calculan en el cliente sobre esta lista
  // (dataset pequeño; una sola fuente de verdad).
  args: {},
  handler: async (ctx) => {
    const ventas = await ctx.db.query("ventas").collect();

    // Orden: fecha desc; desempate por estado (abiertas primero) — espejo del prototipo.
    const ordenadas = ventas.sort(
      (a, b) =>
        b.fecha.localeCompare(a.fecha) ||
        ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado],
    );

    // Join cliente + autor: deduplicar ids + Promise.all (patrón de seguimientos.listHoy).
    const clienteIds = [...new Set(ordenadas.map((v) => v.clienteId))];
    const autorIds = [...new Set(ordenadas.map((v) => v.autorId))];
    const [clientes, autores] = await Promise.all([
      Promise.all(clienteIds.map((id) => ctx.db.get(id))),
      Promise.all(autorIds.map((id) => ctx.db.get(id))),
    ]);
    const clienteMap = new Map(
      clientes.flatMap((c) => (c ? [[c._id, c] as const] : [])),
    );
    const autorMap = new Map(
      autores.flatMap((u) => (u ? [[u._id, u] as const] : [])),
    );

    // TODO(MOI-80): exigir ctx.auth (PII del cliente e importes vía esta lista pública).
    return ordenadas.map((v) => ({
      _id: v._id,
      clienteId: v.clienteId,
      clienteNombre: clienteMap.get(v.clienteId)?.nombre ?? "Cliente eliminado",
      concepto: v.concepto,
      importe: v.importe,
      estado: v.estado,
      fecha: v.fecha,
      autorNombre: autorMap.get(v.autorId)?.nombre ?? "",
    }));
  },
});

export const listByCliente = query({
  // La ficha entrega el id como string; normalizeId → [] si es inválido (no rompe).
  args: { clienteId: v.string() },
  handler: async (ctx, { clienteId }) => {
    const cid = ctx.db.normalizeId("clientes", clienteId);
    if (!cid) return [];

    const items = await ctx.db
      .query("ventas")
      .withIndex("by_cliente", (q) => q.eq("clienteId", cid))
      .collect();

    // Historial: más reciente primero. Empate por día → el insertado más tarde arriba.
    const ordenadas = items.sort(
      (a, b) => b.fecha.localeCompare(a.fecha) || b._creationTime - a._creationTime,
    );

    // Join autores: deduplicar ids + Promise.all (patrón de interacciones.listByCliente).
    const autorIds = [...new Set(ordenadas.map((v) => v.autorId))];
    const autores = await Promise.all(autorIds.map((id) => ctx.db.get(id)));
    const autorMap = new Map(
      autores.flatMap((u) => (u ? [[u._id, u] as const] : [])),
    );

    // TODO(MOI-80): exigir ctx.auth (PII del cliente vía su historial de ventas).
    return ordenadas.map((v) => ({
      _id: v._id,
      concepto: v.concepto,
      importe: v.importe,
      estado: v.estado,
      fecha: v.fecha,
      autorNombre: autorMap.get(v.autorId)?.nombre ?? "",
    }));
  },
});
