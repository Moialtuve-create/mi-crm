"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { normalizaEmail, EMAIL_RE } from "@/lib/authCliente";
import { api } from "../../../convex/_generated/api";

/**
 * Paso 1 del wizard de recuperación: pedir el email.
 *
 * Anti-enumeración (MOI-115): SIEMPRE avanza al paso "código", exista o no exista el
 * email — `asegurarCuentaPassword` devuelve `null` en ambos casos, y el `signIn(reset)`
 * se envuelve en try/catch que traga cualquier error (cuenta inexistente, throttle,
 * etc.). Nunca discriminar por el resultado de estas llamadas en la UI.
 */
export function PasoEmail({ onEnviado }: { onEnviado: (email: string) => void }) {
  const { signIn } = useAuthActions();
  const asegurarCuentaPassword = useAction(api.passwordReset.asegurarCuentaPassword);

  const [email, setEmail] = useState("");
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const emailInvalido = !EMAIL_RE.test(email.trim());
  const emailError = triedSubmit && emailInvalido ? "Introduce un email válido" : undefined;

  async function enviar() {
    setTriedSubmit(true);
    if (emailInvalido || enviando) return;
    setEnviando(true);

    const emailNormalizado = normalizaEmail(email);
    try {
      await asegurarCuentaPassword({ email: emailNormalizado });
    } catch {
      // No debería lanzar nunca (siempre devuelve null), pero por si acaso: no bloquea
      // el flujo, sigue igual al paso de código.
    }
    try {
      await signIn("password", { flow: "reset", email: emailNormalizado });
    } catch {
      // Cuenta inexistente, throttle disparado, etc. — todo se trata igual desde fuera.
    }
    onEnviado(emailNormalizado);
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Recuperar contraseña</h1>
      <p className="mt-1 text-sm text-muted-fg">
        Te enviaremos un código de 6 dígitos a tu email para que definas una contraseña
        nueva.
      </p>

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          error={emailError}
        />

        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary/40 border-t-on-primary" />
              Enviando…
            </>
          ) : (
            "Enviar código"
          )}
        </Button>
      </form>
    </>
  );
}
