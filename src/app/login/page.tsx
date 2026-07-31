"use client";

// Pantalla: Inicio de sesión (/login) — Linear MOI-80 (contraseña) + MOI-114 (Google)
// + MOI-115 (contraseña real + recuperación).
// Diseño: design/.../README.md → "1. Inicio de sesión" + prototipo CRM Shell.dc.html.

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { CircleAlert } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { BotonVerPassword } from "@/components/ui/BotonVerPassword";
import { normalizaEmail, EMAIL_RE } from "@/lib/authCliente";
import { api } from "../../../convex/_generated/api";

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
  const { signIn } = useAuthActions();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const autenticado = useQuery(api.usuarios.getUsuarioAutenticado);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Con sesión de Convex Auth ya resuelta y provisionada, no tiene sentido ver el login.
  useEffect(() => {
    if (isAuthenticated && autenticado) router.replace("/hoy");
  }, [isAuthenticated, autenticado, router]);

  // Canal de rechazo tras el redirect completo de Google: solo se interpreta como error si
  // realmente veníamos de pulsar "Continuar con Google" (evita falsos banners en cargas
  // normales) y espera a que Convex Auth termine de resolver (isLoading), no un timeout.
  //
  // `createOrUpdateUser` (convex/auth.ts) YA valida contra `usuarios` antes de crear la
  // sesión: si `isAuthenticated` llega a ser `true`, la cuenta ESTÁ provisionada por
  // definición. Por eso, mientras `isAuthenticated` es `true`, un `autenticado === null`
  // de `getUsuarioAutenticado` solo puede ser transitorio (la suscripción de la query
  // todavía no se reactualizó con el token nuevo) — nunca un rechazo real. Tratarlo como
  // "aún resolviendo" (igual que `undefined`) evita el falso rechazo. Como red de
  // seguridad ante un caso verdaderamente anómalo, un margen (timer) fuerza una decisión
  // final si nunca llega a resolver.
  const hidratado = useSyncExternalStore(noopSubscribe, getTrue, getFalse);
  const [googleResuelto, setGoogleResuelto] = useState(false);
  const [margenAgotado, setMargenAgotado] = useState(false);
  const autenticadoAunTransitorio =
    isAuthenticated && (autenticado === undefined || (autenticado === null && !margenAgotado));
  const googleAunResolviendo = authLoading || autenticadoAunTransitorio;

  useEffect(() => {
    if (!(isAuthenticated && autenticado === null && !margenAgotado)) return;
    const t = setTimeout(() => setMargenAgotado(true), 4000);
    return () => clearTimeout(t);
  }, [isAuthenticated, autenticado, margenAgotado]);

  if (hidratado && !googleResuelto && !googleAunResolviendo) {
    const habiaIntento = window.sessionStorage.getItem(MARCA_GOOGLE_INTENTADO);
    if (habiaIntento) {
      window.sessionStorage.removeItem(MARCA_GOOGLE_INTENTADO);
      if (!isAuthenticated) {
        setError("Esta cuenta de Google no está autorizada. Contacta con la Dueña.");
        setGoogleSubmitting(false);
      } else if (autenticado === null) {
        // isAuthenticated=true pero la identidad de negocio nunca llegó a resolver
        // (caso anómalo, no un rechazo — ver comentario de arriba).
        setError("No se pudo completar el acceso con Google. Inténtalo de nuevo.");
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
      await signIn("password", {
        flow: "signIn",
        email: normalizaEmail(email),
        password,
      });
      // MOI-115 auditoría M3: NO navegar aquí. `isAuthenticated` puede pasar a `true`
      // (JWT ya emitido) antes de que la suscripción de `getUsuarioAutenticado` se
      // reactualice con el token nuevo — mismo fenómeno ya documentado abajo para
      // Google. Si se navegara ya a /hoy, el guard de `AppShell` podría ver un
      // `usuario === null` transitorio y cerrar la sesión que se acaba de abrir. El
      // `useEffect` de la línea ~67 ya navega en cuanto `autenticado` resuelve de
      // verdad — dejar que sea la única puerta de entrada a /hoy, para Google y
      // contraseña por igual. `submitting` se queda en `true` (spinner) hasta entonces.
    } catch {
      // Nunca el error crudo del servidor (puede venir redactado o revelar detalles
      // internos) — mensaje genérico siempre, tanto si el email no existe como si la
      // contraseña es incorrecta.
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
      await signIn("google", { redirectTo: "/login" });
    } catch {
      window.sessionStorage.removeItem(MARCA_GOOGLE_INTENTADO);
      setError("No se pudo iniciar el acceso con Google. Inténtalo de nuevo.");
      setGoogleSubmitting(false);
    }
  }

  // Con sesión activa (a la espera del puente a /hoy) se está redirigiendo: no mostrar
  // el formulario.
  if (isAuthenticated && autenticado) {
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
                <BotonVerPassword
                  visible={showPassword}
                  onToggle={() => setShowPassword((s) => !s)}
                />
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
            <Link
              href="/login/recuperar"
              className="text-[13px] text-muted-fg hover:text-fg"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
