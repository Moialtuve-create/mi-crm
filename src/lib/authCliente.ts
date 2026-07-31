/**
 * MOI-115: normalización de email en el CLIENTE, antes de cualquier llamada a
 * `signIn("password", ...)`.
 *
 * El `authorize` por defecto del proveedor de reset (`convex/passwordReset.ts`) compara
 * el email tal cual llega en `params` contra la cuenta — sin pasar por el `profile` de
 * Password (verificado leyendo @convex-dev/auth: verifyCodeAndSignIn.js y signIn.js).
 * Si el email no se normaliza aquí ANTES de enviarlo, un usuario que teclee mayúsculas
 * o espacios distintos entre pasos vería "código inválido" con un código correcto.
 *
 * Debe coincidir exactamente con `normalizaEmail`/`EMAIL_RE` de convex/passwordReset.ts.
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizaEmail(email: string): string {
  return email.trim().toLowerCase();
}
