import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { rolUsuario } from "./schema";
import { EMAIL_RE, normalizaEmail } from "./passwordReset";

/**
 * Usuarios — Linear MOI-33 (gating de rol del shell) + MOI-115 (sesión real) +
 * MOI-81 (gestión de usuarios, pantalla "Equipo", solo Dueña).
 *
 * Identidad autoritativa: `getUsuarioAutenticado`, resuelta en servidor desde la sesión
 * de Convex Auth. `getByEmail` se borró en MOI-115: era pública y sin authz, y era lo
 * que hacía falsificable la sesión escribiendo en localStorage.
 */

/**
 * Exige que quien llama sea la Dueña (rol "propietaria"), resuelta desde la sesión real
 * de Convex Auth (no del cliente). Devuelve su fila de `usuarios` — la necesitan
 * `eliminar` (no auto-eliminarse) y `actualizar` (no auto-degradar a la última Dueña).
 */
async function exigirPropietaria(ctx: QueryCtx): Promise<Doc<"usuarios">> {
  const authUserId = await getAuthUserId(ctx);
  if (authUserId === null) throw new Error("No autenticado.");
  const usuario = await ctx.db
    .query("usuarios")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
  if (!usuario || usuario.rol !== "propietaria") {
    throw new Error("Solo la Dueña puede gestionar el equipo.");
  }
  return usuario;
}

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

/**
 * Listado completo para /equipo (Linear MOI-81). Devuelve `null` si quien llama no está
 * autenticado o no es la Dueña — degradado silencioso (no `throw`), porque es una query
 * de listado y el guard real de UI vive en la página; esto es defensa en profundidad
 * para que nadie que no sea propietaria pueda leer emails ajenos desde la consola.
 */
export const equipoListado = query({
  args: {},
  handler: async (ctx) => {
    const authUserId = await getAuthUserId(ctx);
    if (authUserId === null) return null;
    const yo = await ctx.db
      .query("usuarios")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
      .unique();
    if (!yo || yo.rol !== "propietaria") return null;
    const usuarios = await ctx.db.query("usuarios").collect();
    return usuarios.map((u) => ({
      _id: u._id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
    }));
  },
});

/**
 * Alta de usuario (Linear MOI-81). Solo inserta la fila de negocio — NO fija contraseña
 * (el registro es cerrado, MOI-115): al final agenda `invitarUsuario`, que aprovisiona
 * una cuenta password inutilizable y dispara el mismo código de 6 dígitos por email que
 * usa "olvidé mi contraseña", para que el invitado pueda definir la suya.
 */
export const crear = mutation({
  args: { nombre: v.string(), email: v.string(), rol: rolUsuario },
  handler: async (ctx, args) => {
    await exigirPropietaria(ctx);

    const nombre = args.nombre.trim();
    if (!nombre) throw new Error("El nombre es obligatorio");

    const email = normalizaEmail(args.email);
    if (!EMAIL_RE.test(email)) throw new Error("Email no válido");

    const existente = await ctx.db
      .query("usuarios")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existente) throw new Error("Ya existe un usuario con ese email");

    // Auditoría MOI-81 (M1, 2ª ronda): un usuario eliminado antes deja huérfana su
    // identidad técnica en `authTables.users` (Google o password, da igual el
    // provider — createOrUpdateUser la crea igual para ambos). La comprobación de
    // unicidad de arriba ya garantiza que NINGÚN `usuarios` activo tiene este email, así
    // que si `users` tiene una fila con este email, es por definición una identidad
    // huérfana: reutilizarla dejaría al invitado sin poder entrar nunca (si es password)
    // o reactivaría el acceso del titular anterior sin pasar por la invitación (si es
    // Google). Se rechaza explícitamente; limpiar/relinkear queda fuera de alcance.
    const identidadHuerfana = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (identidadHuerfana) {
      throw new Error(
        "Este email ya tuvo una cuenta en Vibe CRM y no se puede reutilizar todavía. Usa otro email o contacta con soporte.",
      );
    }

    const id = await ctx.db.insert("usuarios", { nombre, email, rol: args.rol });
    await ctx.scheduler.runAfter(0, internal.passwordReset.invitarUsuario, { email });
    return id;
  },
});

/**
 * Editar nombre y rol. El email NO es editable (auditoría MOI-81, B1): cambiarlo en
 * `usuarios` no revoca ni migra la credencial ya vinculada en `authAccounts`, que sigue
 * atada al email original — el titular anterior conservaría acceso con ese email y
 * contraseña. Si hace falta corregir un email, hay que borrar y crear de nuevo.
 */
export const actualizar = mutation({
  args: { id: v.id("usuarios"), nombre: v.string(), rol: rolUsuario },
  handler: async (ctx, args) => {
    await exigirPropietaria(ctx);

    const existente = await ctx.db.get(args.id);
    if (!existente) throw new Error("El usuario ya no existe");

    const nombre = args.nombre.trim();
    if (!nombre) throw new Error("El nombre es obligatorio");

    if (existente.rol === "propietaria" && args.rol !== "propietaria") {
      const propietarias = await ctx.db
        .query("usuarios")
        .filter((q) => q.eq(q.field("rol"), "propietaria"))
        .collect();
      if (propietarias.length <= 1) {
        throw new Error("No puedes dejar el equipo sin ninguna Dueña");
      }
    }

    await ctx.db.patch(args.id, { nombre, rol: args.rol });
  },
});

/**
 * Eliminar usuario. No toca `authAccounts`/`users` (fuera de alcance, MOI-81 decisión del
 * owner): la fila de `usuarios` desaparece, así que `getUsuarioAutenticado` del usuario
 * eliminado empezará a devolver `null` y el Guard B de `AppShell` lo expulsará en su
 * próxima carga — efecto ya cubierto por MOI-115, sin código nuevo.
 *
 * TODO(MOI-81 follow-up): clientes.autorId, seguimientos.responsableId y ventas.autorId
 * quedan apuntando a un `usuarios` que ya no existe (referencia huérfana, sin borrado en
 * cascada ni reasignación). Fuera de alcance de esta tarea.
 */
export const eliminar = mutation({
  args: { id: v.id("usuarios") },
  handler: async (ctx, args) => {
    const yo = await exigirPropietaria(ctx);

    if (args.id === yo._id) throw new Error("No puedes eliminarte a ti misma");

    const objetivo = await ctx.db.get(args.id);
    if (!objetivo) throw new Error("El usuario ya no existe");

    if (objetivo.rol === "propietaria") {
      const propietarias = await ctx.db
        .query("usuarios")
        .filter((q) => q.eq(q.field("rol"), "propietaria"))
        .collect();
      if (propietarias.length <= 1) {
        throw new Error("No puedes eliminar a la única Dueña");
      }
    }

    await ctx.db.delete(args.id);
  },
});
