"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CodigoInput } from "@/components/auth/CodigoInput";
import { api } from "../../../convex/_generated/api";

const COOLDOWN_REENVIO_S = 60;

export function PasoCodigo({
  email,
  onVerificado,
  onCambiarEmail,
}: {
  email: string;
  onVerificado: (codigo: string) => void;
  onCambiarEmail: () => void;
}) {
  const { signIn } = useAuthActions();
  const asegurarCuentaPassword = useAction(api.passwordReset.asegurarCuentaPassword);
  const comprobarCodigo = useMutation(api.passwordReset.comprobarCodigo);

  const [codigo, setCodigo] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(COOLDOWN_REENVIO_S);
  const [reenviando, setReenviando] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function verificar() {
    if (codigo.length !== 6 || verificando) return;
    setVerificando(true);
    setError(null);
    try {
      const resultado = await comprobarCodigo({ email, codigo });
      if (resultado === "ok") {
        onVerificado(codigo);
        return;
      }
      if (resultado === "bloqueado") {
        setError("Demasiados intentos. Espera 15 minutos antes de volver a probar.");
      } else {
        setError("El código no es correcto o ha caducado.");
      }
    } catch {
      setError("No se pudo comprobar el código. Inténtalo de nuevo.");
    } finally {
      setVerificando(false);
    }
  }

  async function reenviar() {
    if (cooldown > 0 || reenviando) return;
    setReenviando(true);
    setError(null);
    try {
      await asegurarCuentaPassword({ email });
    } catch {
      // Anti-enumeración: nunca revela si el email existe.
    }
    try {
      await signIn("password", { flow: "reset", email });
    } catch {
      // Cuenta inexistente o throttle disparado — se trata igual desde fuera.
    }
    setCooldown(COOLDOWN_REENVIO_S);
    setReenviando(false);
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Introduce el código</h1>
      <p className="mt-1 text-sm text-muted-fg">
        Si <span className="font-medium text-fg">{email}</span> tiene cuenta, te hemos
        enviado un código de 6 dígitos. Caduca en 15 minutos.
      </p>

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          verificar();
        }}
      >
        <CodigoInput value={codigo} onChange={setCodigo} autoFocus />

        {error ? (
          <p
            role="alert"
            className="flex items-center gap-1.5 rounded-md bg-error-bg px-3 py-2 text-[13px] text-error-fg"
          >
            <CircleAlert size={14} strokeWidth={2} />
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={codigo.length !== 6 || verificando}>
          {verificando ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary/40 border-t-on-primary" />
              Verificando…
            </>
          ) : (
            "Verificar"
          )}
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between text-[13px]">
        <button
          type="button"
          onClick={onCambiarEmail}
          className="focus-ring rounded text-muted-fg hover:text-fg"
        >
          Usar otro email
        </button>
        <button
          type="button"
          onClick={reenviar}
          disabled={cooldown > 0 || reenviando}
          className="focus-ring rounded text-muted-fg hover:text-fg disabled:opacity-60"
        >
          {cooldown > 0 ? `Reenviar en ${cooldown} s` : "Reenviar código"}
        </button>
      </div>
    </>
  );
}
