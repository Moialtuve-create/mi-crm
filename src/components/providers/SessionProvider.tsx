"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  getEmailServerSnapshot,
  getEmailSnapshot,
  signInEmail,
  signOutEmail,
  subscribeSesion,
} from "@/lib/auth.mock";

/**
 * Sesión de la app (Linear MOI-33 / MOI-80).
 *
 * Guarda solo el email del usuario activo (external store en localStorage); el
 * rol/_id autoritativos se resuelven en Convex con `useCurrentUser()`. Si no hay
 * sesión, `email` es `null` y el guard de `<AppShell>` redirige a `/login` (MOI-80).
 */

interface SessionContextValue {
  email: string | null;
  signIn: (email: string) => void;
  signOut: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const email = useSyncExternalStore(
    subscribeSesion,
    getEmailSnapshot,
    getEmailServerSnapshot,
  );

  return (
    <SessionContext.Provider
      value={{ email, signIn: signInEmail, signOut: signOutEmail }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  }
  return ctx;
}
