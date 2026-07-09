import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Usuarios — Linear MOI-33 (gating de rol del shell).
 *
 * Identidad autoritativa: la sesión mock (src/lib/auth.mock.ts) solo guarda el email;
 * el rol y el _id salen SIEMPRE de aquí para que no haya divergencia sesión↔datos.
 */

/** Todos los usuarios, para el selector de Responsable (Linear MOI-39). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const usuarios = await ctx.db.query("usuarios").collect();
    return usuarios.map((u) => ({ _id: u._id, nombre: u.nombre }));
  },
});

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const usuario = await ctx.db
      .query("usuarios")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!usuario) return null;
    return { _id: usuario._id, nombre: usuario.nombre, rol: usuario.rol };
  },
});
