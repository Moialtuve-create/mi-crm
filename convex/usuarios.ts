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
    return {
      _id: usuario._id,
      nombre: usuario.nombre,
      rol: usuario.rol,
      soloGoogle: usuario.soloGoogle ?? false,
    };
  },
});

/**
 * Identidad de negocio verificada en SERVIDOR (Linear MOI-114): a diferencia de
 * `getByEmail`, no recibe el email del cliente — lo obtiene del JWT que Convex Auth
 * validó tras el login con Google (`ctx.auth.getUserIdentity()`). No es falsificable
 * escribiendo en localStorage; la usa el guard de cuentas `soloGoogle` en AppShell.
 */
export const getUsuarioAutenticado = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) return null;
    const usuario = await ctx.db
      .query("usuarios")
      .withIndex("by_email", (q) => q.eq("email", identity.email as string))
      .unique();
    return usuario
      ? { _id: usuario._id, nombre: usuario.nombre, rol: usuario.rol, email: usuario.email }
      : null;
  },
});
