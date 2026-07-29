"use client";

// Pantalla: Inicio de sesión (/login) — Linear MOI-80 (contraseña) + MOI-114 (Google).
// Diseño: design/.../README.md → "1. Inicio de sesión" + prototipo CRM Shell.dc.html.

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useConvex, useQuery } from "convex/react";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/components/providers/SessionProvider";
import { createMockAuth, signInEmail } from "@/lib/auth.mock";
import { api } from "../../../convex/_generated/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Marca en sessionStorage que se disparó el redirect a Google, para distinguir "acabamos
// de volver de un intento" de una carga cualquiera de /login (MOI-114, §9 del plan).
const MARCA_GOOGLE_INTENTADO = "google_intentado";

// Flag de hidratación (mismo patrón que AppShell): evita leer sessionStorage en el primer
// render de cliente, que debe coincidir con el HTML de servidor para no romper la hidratación.
const noopSubscribe = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

function IconoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.94v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.97H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.03l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.97l3.01 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const convex = useConvex();
  const { email: sesionEmail } = useSession();
  const { signIn: signInGoogle } = useAuthActions();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const autenticado = useQuery(api.usuarios.getUsuarioAutenticado);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si ya hay sesión (contraseña o Google ya puenteado), no tiene sentido ver el login.
  useEffect(() => {
    if (sesionEmail) router.replace("/hoy");
  }, [sesionEmail, router]);

  // Puente MOI-114: cuando Convex Auth confirma una identidad de Google verificada en
  // servidor y provisionada en `usuarios`, se traduce a la sesión "de conveniencia" que
  // ya usan AppShell/useSession (vibecrm_session) y se entra a /hoy.
  useEffect(() => {
    if (sesionEmail || !isAuthenticated || !autenticado) return;
    signInEmail(autenticado.email);
    router.replace("/hoy");
  }, [sesionEmail, isAuthenticated, autenticado, router]);

  // Canal de rechazo tras el redirect completo de Google: solo se interpreta como error si
  // realmente veníamos de pulsar "Continuar con Google" (evita falsos banners en cargas
  // normales) y espera a que Convex Auth termine de resolver (isLoading), no un timeout.
  // Se resuelve en el propio render (no en un efecto) con un ref que garantiza que solo se
  // decide una vez por intento — patrón de React para "ajustar estado según algo que cambió",
  // igual que ya usa AppShell con `hidratado` para no romper la hidratación de servidor.
  const hidratado = useSyncExternalStore(noopSubscribe, getTrue, getFalse);
  const [googleResuelto, setGoogleResuelto] = useState(false);
  const googleAunResolviendo = authLoading || (isAuthenticated && autenticado === undefined);
  if (hidratado && !googleResuelto && !googleAunResolviendo) {
    const habiaIntento = window.sessionStorage.getItem(MARCA_GOOGLE_INTENTADO);
    if (habiaIntento) {
      window.sessionStorage.removeItem(MARCA_GOOGLE_INTENTADO);
      if (!isAuthenticated || autenticado === null) {
        setError("Esta cuenta de Google no está autorizada. Contacta con la Dueña.");
        setGoogleSubmitting(false);
      }
    }
    setGoogleResuelto(true);
  }

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

  async function entrarConGoogle() {
    setError(null);
    setGoogleSubmitting(true);
    window.sessionStorage.setItem(MARCA_GOOGLE_INTENTADO, "1");
    try {
      // Dispara un redirect de página completa a Google; el código de después de este
      // await normalmente no llega a ejecutarse salvo que falle antes de redirigir.
      // redirectTo: "/login" — sin esto, Convex Auth vuelve a SITE_URL raíz ("/"), y
      // `src/app/page.tsx` hace `redirect("/hoy")` en el servidor SIN conservar el
      // `?code=` que trae el resultado del login: el intercambio nunca se completa y
      // la app queda "no autenticada" aunque Google y createOrUpdateUser ya validaron
      // todo correctamente. /login no tiene redirect de servidor, así que el `code`
      // sobrevive para que ConvexAuthProvider lo procese.
      await signInGoogle("google", { redirectTo: "/login" });
    } catch {
      window.sessionStorage.removeItem(MARCA_GOOGLE_INTENTADO);
      setError("No se pudo iniciar el acceso con Google. Inténtalo de nuevo.");
      setGoogleSubmitting(false);
    }
  }

  // Con sesión activa (contraseña, o Google ya verificado a la espera del puente) se está
  // redirigiendo: no mostrar el formulario.
  if (sesionEmail || (isAuthenticated && autenticado !== null)) {
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
              disabled={submitting || googleSubmitting}
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

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[12px] text-subtle-fg">o</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <button
            type="button"
            onClick={entrarConGoogle}
            disabled={submitting || googleSubmitting}
            className="focus-ring flex w-full items-center justify-center gap-2 rounded-md border border-line bg-surface py-2.5 text-[14px] font-medium text-fg transition-colors hover:bg-surface-2 disabled:opacity-60"
          >
            {googleSubmitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-fg" />
            ) : (
              <IconoGoogle />
            )}
            Continuar con Google
          </button>

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
