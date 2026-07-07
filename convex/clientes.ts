import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { canalOrigen, estadoCliente } from "./schema";

/**
 * Clientes — alta / edición (MOI-34) y lista (MOI-35).
 *
 * PII básica (telefono/email/nota) en endpoints PÚBLICOS sin auth: aceptable SOLO
 * en esta fase local/mock. NO-GO para producción/entorno compartido hasta que haya
 * authz real. TODO(MOI-80): exigir ctx.auth (autor + permisos) en crear/actualizar;
 * el cambio de `estado`/pipeline queda hoy abierto a cualquier sesión.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** trim; string vacío → undefined (no se persiste whitespace ni ""). */
function limpiar(s?: string): string | undefined {
  const t = s?.trim();
  return t ? t : undefined;
}

/**
 * Normaliza y valida los campos comunes de un cliente (servidor = fuente de verdad).
 * Devuelve los valores ya limpios listos para persistir.
 */
function normalizarYValidar(input: {
  nombre: string;
  empresa?: string;
  telefono?: string;
  email?: string;
}) {
  const nombre = input.nombre.trim();
  const empresa = limpiar(input.empresa);
  const telefono = limpiar(input.telefono);
  const email = limpiar(input.email)?.toLowerCase();

  if (!nombre) throw new Error("El nombre es obligatorio");
  if (!telefono && !email) {
    throw new Error("Indica al menos un teléfono o un email");
  }
  if (email && !EMAIL_RE.test(email)) throw new Error("Email no válido");

  return { nombre, empresa, telefono, email };
}

/** Lista completa para /clientes; la búsqueda se hace en el cliente (dataset pequeño). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const clientes = await ctx.db
      .query("clientes")
      .withIndex("by_nombre")
      .collect();
    return clientes.map((c) => ({
      _id: c._id,
      nombre: c.nombre,
      empresa: c.empresa ?? null,
      telefono: c.telefono ?? null,
      email: c.email ?? null,
      estado: c.estado,
      ultimoContacto: c.ultimoContacto ?? null,
    }));
  },
});

/**
 * Ficha de un cliente. `id` llega como string desde la ruta: normalizamos para que
 * una URL inválida devuelva `null` ("Cliente no encontrado") en vez de romper la query.
 */
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const cid = ctx.db.normalizeId("clientes", id);
    if (!cid) return null;
    return await ctx.db.get(cid);
  },
});

export const crear = mutation({
  args: {
    nombre: v.string(),
    empresa: v.optional(v.string()),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    canal: v.optional(canalOrigen),
    nota: v.optional(v.string()),
    // La fecha local (yyyy-mm-dd) la aporta el CLIENTE, no el runtime UTC de Convex.
    hoy: v.string(),
  },
  handler: async (ctx, args) => {
    // TODO(MOI-80): exigir ctx.auth (autor + permisos).
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.hoy)) {
      throw new Error("hoy debe tener formato yyyy-mm-dd");
    }
    const { nombre, empresa, telefono, email } = normalizarYValidar(args);
    return await ctx.db.insert("clientes", {
      nombre,
      empresa,
      telefono,
      email,
      canal: args.canal,
      nota: limpiar(args.nota),
      estado: "nuevo_lead",
      ultimoContacto: args.hoy,
    });
  },
});

/**
 * Editar. Gestiona SOLO los campos del formulario de edición (el overlay de editar
 * no muestra Canal ni Nota). Deliberadamente NO acepta canal/nota: un
 * `patch({ campo: undefined })` en Convex BORRA el campo, así que incluirlos
 * borraría los valores existentes al guardar.
 */
export const actualizar = mutation({
  args: {
    id: v.id("clientes"),
    nombre: v.string(),
    empresa: v.optional(v.string()),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    estado: v.optional(estadoCliente),
  },
  handler: async (ctx, args) => {
    // TODO(MOI-80): exigir ctx.auth; el cambio de estado/pipeline queda hoy abierto.
    const existente = await ctx.db.get(args.id);
    if (!existente) throw new Error("El cliente ya no existe");
    const { nombre, empresa, telefono, email } = normalizarYValidar(args);
    await ctx.db.patch(args.id, {
      nombre,
      empresa,
      telefono,
      email,
      ...(args.estado ? { estado: args.estado } : {}),
    });
  },
});
