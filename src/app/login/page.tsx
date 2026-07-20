"use client";

// Pantalla: Inicio de sesión (/login) — Linear MOI-80.
// Diseño: design/.../README.md → "1. Inicio de sesión" + prototipo CRM Shell.dc.html.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvex } from "convex/react";
import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/components/providers/SessionProvider";
import { createMockAuth } from "@/lib/auth.mock";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const convex = useConvex();
  const { email: sesionEmail } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si ya hay sesión, no tiene sentido ver el login: a Hoy.
  useEffect(() => {
    if (sesionEmail) router.replace("/hoy");
  }, [sesionEmail, router]);

  const emailInvalido = !EMAIL_RE.test(email.trim());
  const passwordVacio = password === "";
  const emailError =
    triedSubmit && emailInvalido ? "Introduce un email válido" : undefined;
  const passwordError =
    triedSubmit && passwordVacio ? "Introduce tu contraseña" : undefined;

  async function entrar() {
    setTriedSubmit(true);
    if (emailInvalido || passwordVacio || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // createMockAuth().signIn persiste la sesión (única autoridad). No re-persistir aquí.
      await createMockAuth(convex).signIn(email, password);
      router.replace("/hoy");
    } catch {
      setError("Email o contraseña incorrectos");
      setSubmitting(false);
    }
  }

  // Con sesión activa se está redirigiendo: no mostrar el formulario.
  if (sesionEmail) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <span
          className="h-6 w-6 animate-spin rounded-full border-[3px] border-surface-2 border-t-primary"
          aria-label="Cargando"
        />
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-primary font-semibold text-on-primary">
            V
          </span>
          <span className="text-lg font-semibold">Vibe CRM</span>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5 shadow-xs">
          <h1 className="text-2xl font-semibold">Inicia sesión</h1>
          <p className="mt-1 text-sm text-muted-fg">
            Entra para gestionar tus clientes y no perder ninguna venta.
          </p>

          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              entrar();
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

            <Input
              label="Contraseña"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              error={passwordError}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-pressed={showPassword}
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  className="focus-ring flex h-9 w-9 items-center justify-center rounded-md text-subtle-fg hover:text-fg"
                >
                  {showPassword ? (
                    <EyeOff size={18} strokeWidth={1.5} />
                  ) : (
                    <Eye size={18} strokeWidth={1.5} />
                  )}
                </button>
              }
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

            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary/40 border-t-on-primary" />
                  Entrando…
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            {/* Recuperación de contraseña real: post-MVP (MOI-55). */}
            <a
              href="#"
              className="text-[13px] text-muted-fg hover:text-fg"
              onClick={(e) => e.preventDefault()}
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
