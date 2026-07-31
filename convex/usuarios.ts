import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

/**
 * Usuarios — Linear MOI-33 (gating de rol del shell) + MOI-115 (sesión real).
 *
 * Identidad autoritativa: `getUsuarioAutenticado`, resuelta en servidor desde la sesión
 * de Convex Auth. `getByEmail` se borró en MOI-115: era pública y sin authz, y era lo
 * que hacía falsificable la sesión escribiendo en localStorage.
 */

/** Todos los usuarios, para el selector de Responsable (Linear MOI-39). Requiere sesión. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    if ((await getAuthUserId(ctx)) === null) return [];
    const usuarios = await ctx.db.query("usuarios").collect();
    return usuarios.map((u) => ({ _id: u._id, nombre: u.nombre }));
  },
});

/**
 * Identidad de negocio verificada en SERVIDOR (Linear MOI-114): a diferencia de
 * `getByEmail` (borrada en MOI-115), no recibe nada del cliente — resuelve el usuario
 * desde el JWT que Convex Auth validó. No es falsificable escribiendo en localStorage.
 * Es la única fuente de identidad de `useCurrentUser` y de los guards de `AppShell`.
 * `soloGoogle` ya NO restringe nada aquí (MOI-115, decisión del owner): una cuenta
 * puede tener Google + contraseña a la vez. Ver convex/passwordReset.ts.
 *
 * Se resuelve por `authUserId`, NO por email: el JWT de Convex Auth solo lleva los
 * claims `sub` (`"<userId>|<sessionId>"`), `iss`, `aud`, `iat` y `exp` — no incluye
 * `email` (ver node_modules/@convex-dev/auth/.../implementation/tokens.js). Buscar por
 * `identity.email` devolvía siempre `null`. `getAuthUserId()` extrae el `Id<"users">`
 * del `sub`, y `usuarios.authUserId` es el vínculo que planta `createOrUpdateUser`
 * (convex/auth.ts) al validar que la cuenta está provisionada.
 */
export const getUsuarioAutenticado = query({
  args: {},
  handler: async (ctx) => {
    const authUserId = await getAuthUserId(ctx);
    if (authUserId === null) return null;
    const usuario = await ctx.db
      .query("usuarios")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
      .unique();
    return usuario
      ? { _id: usuario._id, nombre: usuario.nombre, rol: usuario.rol, email: usuario.email }
      : null;
  },
});
