import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DatabaseWriter } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  EMAIL_RE,
  normalizaEmail,
  proveedorCodigoReset,
  validarRequisitosPassword,
  bloquearSiThrottleReset,
} from "./passwordReset";

/**
 * Acceso con Google (Linear MOI-114) + contraseña real (Linear MOI-115).
 * Registro cerrado: solo entra quien ya está provisionado en la tabla de negocio
 * `usuarios`; nadie se crea una cuenta sola. `createOrUpdateUser` es el único punto de
 * autorización — ver el orden de pasos comentado abajo, es DELIBERADO y no debe
 * reordenarse sin releer los comentarios de cada paso.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    Password({
      // Se ejecuta SÍNCRONO, antes de cualquier flow (Password.js:56), y ANTES de que
      // el flow "reset" busque la cuenta. Es el único punto que puede cerrar el registro
      // público (MOI-115 auditoría B1) y canonizar el email antes de que se use para
      // buscar la credencial (MOI-115 auditoría M1). Ver convex/passwordReset.ts.
      profile(params) {
        // B1: flow:"signUp" es invocable públicamente desde el cliente
        // (signIn("password",{flow:"signUp",...})). Sin esta guarda, cualquiera podría
        // fijar la contraseña de un email ya provisionado SIN demostrar que controla el
        // buzón → toma completa de cuenta. El único alta válida es asegurarCuentaPassword
        // (server-side, secret aleatorio inutilizable) — ver passwordReset.ts.
        if (params.flow === "signUp") {
          throw new Error("Registro cerrado: no se admite alta pública de contraseña.");
        }
        // M1: defaultProfile (Password.js:176-180) devuelve params.email SIN normalizar,
        // y ese valor es el que se usa para buscar authAccounts. Normalizar aquí, no en
        // createOrUpdateUser (llegaría tarde: la búsqueda ya habría fallado).
        if (typeof params.email !== "string") {
          throw new Error("Falta el email.");
        }
        const email = normalizaEmail(params.email);
        if (!EMAIL_RE.test(email)) throw new Error("Email no válido");
        return { email };
      },
      reset: proveedorCodigoReset,
      validatePasswordRequirements: validarRequisitosPassword,
    }),
  ],
  signIn: {
    // Cubre también flow:"reset" (login por contraseña) — 8 intentos fallidos/hora con
    // recarga continua (implementation/rateLimit.js). El typo "Attemps" es de la librería.
    maxFailedAttempsPerHour: 8,
  },
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const db = ctx.db as unknown as DatabaseWriter;

      // PASO 0 — MOI-115 auditoría B2: throttle de EMISIÓN de códigos de reset.
      //
      // DEBE ir antes del paso 1 (guarda existingUserId), o nunca se ejecuta: en el flujo
      // de reset este callback llega SIEMPRE con existingUserId ya informado (la cuenta
      // password existe desde que se llamó a asegurarCuentaPassword), así que una guarda
      // previa lo cortocircuitaría y cada llamada pública a
      // signIn("password",{flow:"reset",email}) volvería a invalidar el código vigente
      // (createVerificationCode.js borra el código anterior de la cuenta antes de crear
      // el nuevo). Este bloque SOLO LEE: no da de alta a nadie, no aplica el registro
      // cerrado, no crea usuarios ni vínculos — únicamente decide si se deja continuar.
      // Un `throw` aquí revierte la mutation ENTERA (transaccional), así que el código
      // vigente sobrevive intacto. El contador de envíos lo escribe
      // sendVerificationRequest (post-commit, en passwordReset.ts) — escribirlo aquí
      // sería inútil porque el rollback lo borraría.
      if (args.type === "email" && args.provider.id === "password-reset") {
        await bloquearSiThrottleReset(db, args.profile.email as string);
        // No hace `return`: si no bloqueó, cae al paso 1 con el flujo normal.
      }

      // PASO 0.5 — aviso de cambio de contraseña (mitigación de la decisión del owner de
      // permitir contraseña en cuentas `soloGoogle`, señalada por la auditoría de
      // seguridad de MOI-115). `type:"verification"` + provider "password" es la firma
      // exacta de un canje de código de reset que ACABA de validarse en
      // verifyCodeAndSignIn — justo antes de que Password.js reescriba el secret
      // (Password.js: primero upsertUserAndAccount, luego modifyAccountCredentials).
      // Este callback corre en una MUTATION (no puede hacer fetch), así que se agenda
      // la action vía scheduler en vez de llamarla directamente; un fallo del envío no
      // debe poder tumbar el cambio de contraseña, que en este punto ya es imparable.
      if (args.type === "verification" && args.provider.id === "password") {
        const emailAviso = args.profile.email;
        if (typeof emailAviso === "string") {
          await ctx.scheduler.runAfter(0, internal.passwordReset.notificarCambioPassword, {
            email: emailAviso,
          });
        }
      }

      // PASO 1 — reutilizar vínculo ya resuelto (re-login de Google, canje del código de
      // reset vía verifyCodeAndSignIn, y la emisión de código ya filtrada arriba).
      if (args.existingUserId) return args.existingUserId;

      // PASO 2 — resolver el email según el tipo de evento. Cualquier combinación no
      // contemplada falla cerrado.
      let email: string;
      if (args.type === "oauth" && args.provider.id === "google") {
        email = args.profile.email as string;
      } else if (args.type === "credentials" && args.provider.id === "password") {
        // Ya viene canonizado por el `profile` de Password de arriba; se vuelve a
        // normalizar por defensa en profundidad (el de Google no pasa por ese hook).
        email = args.profile.email as string;
      } else {
        throw new Error("Tipo de acceso no admitido.");
      }

      // PASO 3 — normalizar y validar formato (idempotente si ya venía canonizado).
      email = normalizaEmail(email);
      if (!EMAIL_RE.test(email)) {
        throw new Error("Email no válido.");
      }

      // PASO 4 — registro cerrado: el email debe existir YA en `usuarios`.
      const usuario = await db
        .query("usuarios")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (!usuario) {
        throw new Error("Esta cuenta no está autorizada en Vibe CRM.");
      }

      // PASO 5 — resolver authUserId con 3 niveles: ya vinculado, o ya existe una fila en
      // `users` con este email (p. ej. la creó Google y el patch de abajo no cuajó), o
      // crearla. El nivel intermedio evita duplicar `users` cuando password y Google
      // conviven en la misma cuenta (MOI-115 decisión 3 del owner).
      const authUserId =
        usuario.authUserId ??
        (
          await db
            .query("users")
            .withIndex("email", (q) => q.eq("email", email))
            .unique()
        )?._id ??
        (await db.insert("users", { email }));

      // PASO 6 — enlazar si hacía falta.
      if (usuario.authUserId !== authUserId) {
        await db.patch(usuario._id, { authUserId });
      }

      // PASO 7 — devolver la identidad técnica.
      return authUserId;
    },
  },
});
