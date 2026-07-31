"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { CircleAlert } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { BotonVerPassword } from "@/components/ui/BotonVerPassword";
import { useToast } from "@/components/ui/Toast";
import { normalizaEmail } from "@/lib/authCliente";
import { api } from "../../../convex/_generated/api";

export function PasoNuevaPassword({ email, codigo }: { email: string; codigo: string }) {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const { showToast } = useToast();
  const { isAuthenticated } = useConvexAuth();
  const autenticado = useQuery(api.usuarios.getUsuarioAutenticado);

  const [password, setPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ref, no useState: solo evita repetir el toast si el efecto se reevalúa por un
  // cambio de referencia de `autenticado` (nueva versión del mismo objeto) antes de
  // que `router.replace` complete la navegación. No debe disparar un re-render.
  const avisadoRef = useRef(false);

  // MOI-115 auditoría M3: mismo fenómeno que en /login — `isAuthenticated` puede
  // pasar a `true` antes de que `getUsuarioAutenticado` se reactualice con el token
  // nuevo. Navegar a /hoy directamente después de `signIn` arriesga que el guard de
  // `AppShell` vea un `usuario === null` transitorio y cierre la sesión recién creada.
  // Solo se navega cuando `autenticado` resuelve de verdad a un objeto.
  useEffect(() => {
    if (isAuthenticated && autenticado && !avisadoRef.current) {
      avisadoRef.current = true;
      showToast({ mensaje: "Contraseña actualizada" });
      router.replace("/hoy");
    }
  }, [isAuthenticated, autenticado, showToast, router]);

  const passwordCorta = password.length < 8;
  // El servidor rechaza esto de todos modos (auditoría M2) — validar aquí es solo
  // feedback inmediato, no la barrera real.
  const esElEmail = password !== "" && normalizaEmail(password) === email;
  const noCoincide = repetir !== password;
  const passwordError = triedSubmit
    ? passwordCorta
      ? "Mínimo 8 caracteres"
      : esElEmail
        ? "La contraseña no puede ser tu email"
        : undefined
    : undefined;
  const repetirError = triedSubmit && noCoincide ? "Las contraseñas no coinciden" : undefined;

  async function guardar() {
    setTriedSubmit(true);
    if (passwordCorta || esElEmail || noCoincide || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await signIn("password", {
        flow: "reset-verification",
        email,
        code: codigo,
        newPassword: password,
      });
      // No navegar aquí — ver el useEffect de arriba. `guardando` se queda en `true`
      // (botón deshabilitado con spinner) hasta que la identidad resuelva de verdad.
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
