import { v } from "convex/values";
import { Email } from "@convex-dev/auth/providers/Email";
import { createAccount } from "@convex-dev/auth/server";
import type { EmailConfig, GenericActionCtxWithAuthConfig } from "@convex-dev/auth/server";
import type { DataModel } from "./_generated/dataModel";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase, encodeBase64url } from "@oslojs/encoding";
import { action, mutation, internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { DatabaseWriter } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * MOI-115 — Contraseñas reales y recuperación por código de email.
 *
 * Este módulo es donde vive toda la lógica que la auditoría revisó en detalle
 * (B1/M1/M2/B2/S1). No reordenar ni "simplificar" sin releer los comentarios: cada
 * pieza está donde está por una razón verificada contra el código de
 * @convex-dev/auth@0.0.94, no por preferencia de estilo.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizaEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Mismo umbral que el default de la librería (Password.js), en español. */
export function validarRequisitosPassword(password: string): void {
  if (!password || password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }
}

// ---------------------------------------------------------------------------
// Generación de código: 6 dígitos, sin sesgo de módulo.
// ---------------------------------------------------------------------------

const CODIGO_DIGITOS = 6;
const CODIGO_MODULO = 10 ** CODIGO_DIGITOS; // 1_000_000
// Rechazo de muestras: descarta el resto de 2^32 que no es múltiplo exacto de
// CODIGO_MODULO, para que cada uno de los 10^6 valores tenga la misma probabilidad.
const LIMITE_SIN_SESGO = Math.floor(0x100000000 / CODIGO_MODULO) * CODIGO_MODULO;

function generarCodigo6Digitos(): string {
  const buf = new Uint32Array(1);
  let n: number;
  do {
    crypto.getRandomValues(buf);
    n = buf[0];
  } while (n >= LIMITE_SIN_SESGO);
  return String(n % CODIGO_MODULO).padStart(CODIGO_DIGITOS, "0");
}

function hashCodigo(codigo: string): string {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(codigo)));
}

function generarSecretoAleatorio(): string {
  const bytes = new Uint8Array(32); // 256 bits
  crypto.getRandomValues(bytes);
  return encodeBase64url(bytes);
}

// ---------------------------------------------------------------------------
// Parámetros de tiempo / límites.
// ---------------------------------------------------------------------------

const MAX_AGE_RESET_S = 15 * 60; // 15 min
const COOLDOWN_ENVIO_MS = 60 * 1000; // 60 s entre envíos
const LIMITE_ENVIOS_HORA = 5;
const VENTANA_ENVIOS_MS = 60 * 60 * 1000; // 1 h
const LIMITE_INTENTOS_VENTANA = 6;
const VENTANA_INTENTOS_MS = 15 * 60 * 1000; // 15 min

// ---------------------------------------------------------------------------
// Paso 0 de convex/auth.ts: throttle de EMISIÓN — solo lectura (auditoría B2 + S1).
//
// Se invoca DENTRO de la mutation transaccional de createOrUpdateUser, antes de que
// createVerificationCode borre el código anterior de la cuenta. Un `throw` de aquí
// revierte toda la mutation, así que el código vigente sobrevive intacto. El contador
// de envíos NO se escribe aquí (se perdería con el rollback): lo escribe
// `registrarEnvio`, invocado post-commit desde `sendVerificationRequest`.
// ---------------------------------------------------------------------------

export async function bloquearSiThrottleReset(
  db: DatabaseWriter,
  emailCrudo: string,
): Promise<void> {
  const email = normalizaEmail(emailCrudo);

  // S1: la cuenta a consultar es la del provider "password" (no "password-reset").
  // Password.js's flow:"reset" resuelve `retrieveAccount({provider:"password", ...})`
  // y pasa ese `account._id` como `accountId` a `signInViaProvider`; createVerificationCode
  // cuelga el código de ESE _id (getAccountOrThrow), no de una cuenta del provider de
  // reset. Buscar por "password-reset" aquí encontraría siempre `null` y el cooldown
  // nunca se aplicaría.
  const cuentaPassword = await db
    .query("authAccounts")
    .withIndex("providerAndAccountId", (q) =>
      q.eq("provider", "password").eq("providerAccountId", email),
    )
    .unique();
  // No debería ocurrir: Password.js ya comprobó con retrieveAccount que la cuenta
  // existe antes de llegar aquí. Defensivo, no bloqueante.
  if (!cuentaPassword) return;

  const ahora = Date.now();

  const codigoVigente = await db
    .query("authVerificationCodes")
    .withIndex("accountId", (q) => q.eq("accountId", cuentaPassword._id))
    .unique();
  if (codigoVigente) {
    // authVerificationCodes no guarda la hora de creación; se deriva de la expiración.
    const creadoEn = codigoVigente.expirationTime - MAX_AGE_RESET_S * 1000;
    if (ahora - creadoEn < COOLDOWN_ENVIO_MS) {
      throw new Error("Espera un momento antes de pedir otro código.");
    }
  }

  const clave = `envio:${email}`;
  const fila = await db
    .query("authThrottle")
    .withIndex("by_clave", (q) => q.eq("clave", clave))
    .unique();
  if (
    fila &&
    ahora - fila.ventanaInicio < VENTANA_ENVIOS_MS &&
    fila.contador >= LIMITE_ENVIOS_HORA
  ) {
    throw new Error("Demasiadas solicitudes. Inténtalo más tarde.");
  }
}

async function incrementarThrottle(
  db: DatabaseWriter,
  clave: string,
  ventanaMs: number,
): Promise<void> {
  const ahora = Date.now();
  const fila = await db
    .query("authThrottle")
    .withIndex("by_clave", (q) => q.eq("clave", clave))
    .unique();
  if (!fila || ahora - fila.ventanaInicio >= ventanaMs) {
    if (fila) {
      await db.patch(fila._id, { ventanaInicio: ahora, contador: 1, ultimo: ahora });
    } else {
      await db.insert("authThrottle", {
        clave,
        ventanaInicio: ahora,
        contador: 1,
        ultimo: ahora,
      });
    }
    return;
  }
  await db.patch(fila._id, { contador: fila.contador + 1, ultimo: ahora });
}

export const registrarEnvio = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await incrementarThrottle(ctx.db, `envio:${normalizaEmail(email)}`, VENTANA_ENVIOS_MS);
  },
});

// ---------------------------------------------------------------------------
// Proveedor de reset por código (Password({ reset: proveedorCodigoReset })).
// ---------------------------------------------------------------------------

function plantillaTexto(codigo: string): string {
  return [
    "Restablece tu contraseña — Vibe CRM",
    "",
    "Has pedido definir una contraseña nueva para tu cuenta de Vibe CRM.",
    `Tu código: ${codigo}`,
    "",
    "El código caduca en 15 minutos y solo se puede usar una vez.",
    "",
    "Si no has pedido este cambio, ignora este mensaje: tu contraseña actual sigue siendo válida.",
  ].join("\n");
}

function plantillaHtml(codigo: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#F7F8F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;">
      <tr>
        <td style="background:#FFFFFF;border:1px solid #E4E7EB;border-radius:12px;padding:32px;">
          <p style="margin:0 0 24px;font-size:14px;font-weight:600;color:#2F6F4F;">Vibe CRM</p>
          <h1 style="margin:0 0 12px;font-size:20px;color:#1A1F1C;">Restablece tu contraseña</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#4A5350;">
            Has pedido definir una contraseña nueva para tu cuenta de Vibe CRM.
            Introduce este código en la pantalla que tienes abierta:
          </p>
          <div style="background:#F1F5F3;border-radius:8px;padding:16px;text-align:center;margin:0 0 20px;">
            <span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:34px;font-weight:600;letter-spacing:8px;color:#1A1F1C;">${codigo}</span>
          </div>
          <p style="margin:0 0 8px;font-size:13px;color:#6B7570;">
            El código caduca en <strong>15 minutos</strong> y solo se puede usar una vez.
          </p>
          <p style="margin:0;font-size:13px;color:#6B7570;">
            Si no has pedido este cambio, ignora este mensaje: tu contraseña actual sigue siendo válida.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// La librería llama a `sendVerificationRequest` con DOS argumentos en runtime
// (signIn.js: `provider.sendVerificationRequest({...}, ctx)`), pero el tipo público
// `EmailConfig` (heredado de @auth/core) solo declara `params` — su propio código
// interno tiene el mismo comentario ("Figure out typing for email providers so they can
// access ctx"). Se declara aparte y se castea al asignarla, en vez de repetir un
// `@ts-expect-error` por parámetro.
async function enviarCodigoReset(
  params: { identifier: string; token: string },
  ctx: GenericActionCtxWithAuthConfig<DataModel>,
): Promise<void> {
  const email = normalizaEmail(params.identifier);
  const codigo = params.token;

  // MOI-115 auditoría M1: el throttle de emisión solo debe contar envíos que REALMENTE
  // salieron. Contar antes de intentar el fetch castigaba al usuario legítimo por un
  // incidente transitorio del proveedor (Resend caído, dominio momentáneamente
  // inválido, etc.): 5 fallos de Resend bastaban para bloquear la recuperación una
  // hora entera sin que hubiera salido un solo email. Por eso `registrarEnvio` se
  // invoca al FINAL de cada rama, solo tras confirmar éxito (res.ok, o el camino de
  // desarrollo sin API key, que si "envía" con éxito por consola).
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // El código solo se escribe en el log fuera de producción: en prod, un log con
    // códigos recuperables es material de toma de cuentas para quien tenga acceso a
    // los logs operativos (auditoría, sugerencia baja).
    // `process.env.NODE_ENV` NO está garantizado en el runtime de Convex (verificado:
    // en el deployment dev de este proyecto ni siquiera está definido) — no sirve para
    // distinguir dev/producción aquí. Se exige un opt-in explícito por variable de
    // entorno, que por defecto no está puesta en NINGÚN deployment: así nadie deja
    // códigos recuperables en logs de producción por accidente (auditoría, sugerencia
    // baja). Para probar en local sin Resend: `npx convex env set RESEND_DEV_LOG_CODIGO true`.
    // MOI-115 auditoría M1 (residual, 6ª ronda): sin API key configurada, NO se ha
    // emitido el código por ningún canal salvo cuando el opt-in de log de dev está
    // activo — solo esa rama cuenta contra el throttle. Sin la key y sin el opt-in,
    // esto es una incidencia de configuración (no un envío, exitoso ni fallido): 5
    // intentos así no deben agotar la cuota horaria de un usuario legítimo, porque en
    // cuanto se arregle la configuración seguiría bloqueado sin motivo.
    if (process.env.RESEND_DEV_LOG_CODIGO === "true") {
      console.warn(`[dev] Código de recuperación para ${email}: ${codigo}`);
      await ctx.runMutation(internal.passwordReset.registrarEnvio, { email });
    }
    return;
  }

  const remitente = process.env.EMAIL_REMITENTE ?? "Vibe CRM <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: remitente,
      to: [email],
      subject: "Código para restablecer tu contraseña — Vibe CRM",
      html: plantillaHtml(codigo),
      text: plantillaTexto(codigo),
    }),
  });

  if (!res.ok) {
    const cuerpo = await res.text();
    console.error(`[passwordReset] Resend respondió ${res.status}: ${cuerpo}`);
    // Fallar ruidosamente: un dominio sin verificar debe verse en los logs de Convex,
    // no parecer un envío exitoso. NO se cuenta contra el throttle horario: un fallo
    // del proveedor no debe consumir la cuota del usuario legítimo (auditoría M1).
    throw new Error("No se pudo enviar el email de recuperación.");
  }

  await ctx.runMutation(internal.passwordReset.registrarEnvio, { email });
}

export const proveedorCodigoReset = Email({
  id: "password-reset",
  maxAge: MAX_AGE_RESET_S,
  generateVerificationToken: async () => generarCodigo6Digitos(),
  // NO TOCAR: el `authorize` por defecto de Email() exige que `params.email` coincida
  // con `account.providerAccountId`. Es lo único que impide que un código de 6 dígitos,
  // localizable por el índice GLOBAL `authVerificationCodes.code`, sirva para entrar en
  // OTRA cuenta. Con un token tan corto esta comprobación no es opcional.
  //
  // NOTA IMPORTANTE (verificado en verifyCodeAndSignIn.js:107 y signIn.js:65): ese
  // `authorize` compara contra el `params.email` CRUDO tal cual llega del cliente, NO
  // contra el email canonizado por el `profile` de Password. La UI (Fase C) DEBE
  // normalizar el email (normalizaEmail) antes de cada llamada a `signIn`, y reutilizar
  // ese mismo valor normalizado en los 3 pasos del wizard — si no, un usuario que teclee
  // mayúsculas distintas entre el paso 1 y el paso 3 vería "código inválido" con un
  // código correcto.
  sendVerificationRequest: enviarCodigoReset as unknown as EmailConfig["sendVerificationRequest"],
});

// ---------------------------------------------------------------------------
// Alta inicial: crea la cuenta password con secret inutilizable (auditoría B1).
// ---------------------------------------------------------------------------

export const estadoAltaPassword = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const usuario = await ctx.db
      .query("usuarios")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!usuario) return { existeUsuario: false, existeCuentaPassword: false };
    const cuenta = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email),
      )
      .unique();
    return { existeUsuario: true, existeCuentaPassword: cuenta !== null };
  },
});

/**
 * Da de alta la cuenta `password` para un usuario ya provisionado en `usuarios`, con un
 * secret de 256 bits que NUNCA se transmite ni se guarda en claro: la cuenta existe
 * (así `retrieveAccount` de flow:"reset" la encuentra) pero nadie puede autenticarse con
 * ella. El único camino a una contraseña usable sigue siendo el código por email.
 *
 * Devuelve `null` SIEMPRE, exista o no exista el email — anti-enumeración.
 */
export const asegurarCuentaPassword = action({
  args: { email: v.string() },
  handler: async (ctx, { email: emailCrudo }): Promise<null> => {
    const email = normalizaEmail(emailCrudo);
    if (!EMAIL_RE.test(email)) return null;

    const estado = await ctx.runQuery(internal.passwordReset.estadoAltaPassword, { email });
    if (!estado.existeUsuario || estado.existeCuentaPassword) return null;

    try {
      await createAccount(ctx, {
        provider: "password",
        account: { id: email, secret: generarSecretoAleatorio() },
        profile: { email },
        shouldLinkViaEmail: false,
      });
    } catch {
      // Carrera: otra petición concurrente ya creó la cuenta entre el estadoAltaPassword
      // y aquí. No es un error real — el resultado deseado (la cuenta existe) se cumple.
    }
    return null;
  },
});

// ---------------------------------------------------------------------------
// Verificación del código sin consumirlo (auditoría: la librería no ofrece este paso).
// ---------------------------------------------------------------------------

/**
 * Verifica un código SIN consumirlo (Password.js solo ofrece verificar+cambiar en una
 * sola llamada, `flow:"reset-verification"`). Trade-off documentado en el plan: esto
 * añade un oráculo que no quema el código, compensado por un límite propio (6 intentos
 * / 15 min) más estricto que el nativo (8/hora, `signIn.maxFailedAttempsPerHour`).
 *
 * No requiere `action` (sin `fetch` ni `createAccount`): es una `mutation` pública
 * normal, con lecturas + el throttle de intentos en la misma transacción.
 */
export const comprobarCodigo = mutation({
  args: { email: v.string(), codigo: v.string() },
  handler: async (ctx, { email: emailCrudo, codigo }): Promise<"ok" | "invalido" | "bloqueado"> => {
    const email = normalizaEmail(emailCrudo);

    const clave = `intento:${email}`;
    const ahora = Date.now();
    const fila = await ctx.db
      .query("authThrottle")
      .withIndex("by_clave", (q) => q.eq("clave", clave))
      .unique();
    if (fila && ahora - fila.ventanaInicio < VENTANA_INTENTOS_MS) {
      if (fila.contador >= LIMITE_INTENTOS_VENTANA) return "bloqueado";
      await ctx.db.patch(fila._id, { contador: fila.contador + 1, ultimo: ahora });
    } else if (fila) {
      await ctx.db.patch(fila._id, { ventanaInicio: ahora, contador: 1, ultimo: ahora });
    } else {
      await ctx.db.insert("authThrottle", { clave, ventanaInicio: ahora, contador: 1, ultimo: ahora });
    }

    // Misma cuenta que bloquearSiThrottleReset (auditoría S1): provider "password".
    const cuenta = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email),
      )
      .unique();
    if (!cuenta) return "invalido";

    const hash = hashCodigo(codigo);
    const filaCodigo = await ctx.db
      .query("authVerificationCodes")
      .withIndex("code", (q) => q.eq("code", hash))
      .unique();
    if (!filaCodigo) return "invalido";
    if (filaCodigo.expirationTime < ahora) return "invalido";
    if (filaCodigo.provider !== "password-reset") return "invalido";
    // Replica el `authorize` de Email(): el código debe pertenecer a ESTA cuenta.
    if (filaCodigo.accountId !== cuenta._id) return "invalido";

    return "ok";
  },
});

// ---------------------------------------------------------------------------
// Aviso de cambio de contraseña (mitigación de la decisión del owner de permitir
// contraseña en cuentas `soloGoogle` — auditoría de seguridad de MOI-115). Disparado
// desde `createOrUpdateUser` (convex/auth.ts) vía `ctx.scheduler`, porque ese callback
// corre en una mutation y no puede hacer `fetch` directamente.
// ---------------------------------------------------------------------------

function plantillaAvisoCambioTexto(): string {
  return [
    "Contraseña actualizada — Vibe CRM",
    "",
    "La contraseña de tu cuenta de Vibe CRM se acaba de cambiar.",
    "",
    "Si has sido tú, no tienes que hacer nada.",
    "Si NO has sido tú, alguien más puede tener acceso a tu correo: cambia también la",
    "contraseña de tu email cuanto antes.",
  ].join("\n");
}

function plantillaAvisoCambioHtml(): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#F7F8F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;">
      <tr>
        <td style="background:#FFFFFF;border:1px solid #E4E7EB;border-radius:12px;padding:32px;">
          <p style="margin:0 0 24px;font-size:14px;font-weight:600;color:#2F6F4F;">Vibe CRM</p>
          <h1 style="margin:0 0 12px;font-size:20px;color:#1A1F1C;">Contraseña actualizada</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#4A5350;">
            La contraseña de tu cuenta de Vibe CRM se acaba de cambiar.
          </p>
          <p style="margin:0 0 8px;font-size:13px;color:#6B7570;">Si has sido tú, no tienes que hacer nada.</p>
          <p style="margin:0;font-size:13px;color:#6B7570;">
            Si <strong>no</strong> has sido tú, alguien más puede tener acceso a tu correo:
            cambia también la contraseña de tu email cuanto antes.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const notificarCambioPassword = internalAction({
  args: { email: v.string() },
  handler: async (_ctx, { email: emailCrudo }) => {
    const email = normalizaEmail(emailCrudo);
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return; // sin key configurada, no hay nada que enviar (mismo criterio que el resto del módulo)

    const remitente = process.env.EMAIL_REMITENTE ?? "Vibe CRM <onboarding@resend.dev>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remitente,
        to: [email],
        subject: "Tu contraseña de Vibe CRM ha cambiado",
        html: plantillaAvisoCambioHtml(),
        text: plantillaAvisoCambioTexto(),
      }),
    });
    if (!res.ok) {
      // No relanzar: este aviso es "best effort", no debe poder tumbar el flujo de
      // cambio de contraseña (que ya ha tenido éxito cuando esto se dispara).
      console.error(`[passwordReset] Aviso de cambio no enviado, Resend ${res.status}`);
    }
  },
});
