import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import type { DatabaseWriter } from "./_generated/server";

/**
 * Acceso con Google (Linear MOI-114) — Convex Auth se usa como verificador criptográfico
 * de identidad de Google, no como sistema de sesión de la app (esa sigue siendo
 * `vibecrm_session`, ver src/lib/auth.mock.ts). Registro cerrado: solo entra quien ya
 * está provisionado en la tabla de negocio `usuarios`; nadie se crea una cuenta sola.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      // Ya vinculado en un login anterior: reutilizar tal cual.
      if (args.existingUserId) return args.existingUserId;

      if (args.type !== "oauth" || args.provider.id !== "google") {
        throw new Error("Solo se admite iniciar sesión con Google");
      }
      const email = args.profile.email;
      if (!email || typeof email !== "string") {
        throw new Error("Google no devolvió un email válido");
      }

      // El callback de la librería recibe un ctx con DataModel genérico (no conoce
      // nuestros índices); lo tipamos con nuestro propio `DatabaseWriter` generado.
      const db = ctx.db as unknown as DatabaseWriter;

      // Registro cerrado: el email debe existir YA en la tabla de negocio `usuarios`.
      const usuario = await db
        .query("usuarios")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (!usuario) {
        throw new Error("Esta cuenta de Google no está autorizada en Vibe CRM.");
      }

      // Crea (o reutiliza) la identidad técnica de Convex Auth y la enlaza a `usuarios`.
      const authUserId = usuario.authUserId ?? (await db.insert("users", { email }));
      if (!usuario.authUserId) {
        await db.patch(usuario._id, { authUserId });
      }
      return authUserId;
    },
  },
});
