"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DEFAULT_EMAIL,
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
 * rol/_id autoritativos se resuelven en Convex con `useCurrentUser()`. Sin login
 * real todavía (MOI-80), si no hay sesión se usa el usuario por defecto.
 */

interface SessionContextValue {
  email: string;
  signIn: (email: string) => void;
  signOut: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const stored = useSyncExternalStore(
    subscribeSesion,
    getEmailSnapshot,
    getEmailServerSnapshot,
  );
  const email = stored ?? DEFAULT_EMAIL;

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
