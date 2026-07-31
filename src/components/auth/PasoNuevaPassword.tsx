"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { CircleAlert } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { BotonVerPassword } from "@/components/ui/BotonVerPassword";
import { useToast } from "@/components/ui/Toast";

export function PasoNuevaPassword({ email, codigo }: { email: string; codigo: string }) {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const { showToast } = useToast();

  const [password, setPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordCorta = password.length < 8;
  const noCoincide = repetir !== password;
  const passwordError = triedSubmit && passwordCorta ? "Mínimo 8 caracteres" : undefined;
  const repetirError = triedSubmit && noCoincide ? "Las contraseñas no coinciden" : undefined;

  async function guardar() {
    setTriedSubmit(true);
    if (passwordCorta || noCoincide || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await signIn("password", {
        flow: "reset-verification",
        email,
        code: codigo,
        newPassword: password,
      });
      showToast({ mensaje: "Contraseña actualizada" });
      router.replace("/hoy");
    } catch {
      setError(
        "El código ha caducado o ya se usó. Vuelve a pedir uno nuevo desde el paso anterior.",
      );
      setGuardando(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Define tu contraseña</h1>
      <p className="mt-1 text-sm text-muted-fg">
        Se cerrará la sesión en tus otros dispositivos.
      </p>

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <Input
          label="Contraseña nueva"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Al menos 8 caracteres"
          error={passwordError}
          helper={passwordError ? undefined : "Mínimo 8 caracteres"}
          trailing={
            <BotonVerPassword
              visible={showPassword}
              onToggle={() => setShowPassword((s) => !s)}
            />
          }
        />

        <Input
          label="Repite la contraseña"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={repetir}
          onChange={(e) => setRepetir(e.target.value)}
          placeholder="Vuelve a escribirla"
          error={repetirError}
        />

        {error ? (
          <p
            role="alert"
            className="flex items-center gap-1.5 rounded-md bg-error-bg px-3 py-2 text-[13px] text-error-fg"
          >
            <CircleAlert size={14} strokeWidth={2} />
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={guardando}>
          {guardando ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary/40 border-t-on-primary" />
              Guardando…
            </>
          ) : (
            "Guardar contraseña"
          )}
        </Button>
      </form>
    </>
  );
}
