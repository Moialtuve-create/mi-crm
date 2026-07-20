/**
 * Sesión mock del MVP — store minimalista sobre localStorage (solo el email del
 * usuario activo), expuesto como "external store" para `useSyncExternalStore`.
 * Así signIn/signOut re-renderizan a los consumidores y se sincroniza entre pestañas.
 *
 * La identidad autoritativa (rol, _id, nombre) se resuelve en Convex vía
 * `useCurrentUser()`. Este módulo es el PUNTO DE INTEGRACIÓN de `src/lib/auth.ts`:
 * `createMockAuth()` cumple la interfaz `AuthProvider` con un mock local, sustituible
 * por auth real (Convex Auth / Supabase / API propia) sin tocar las pantallas. El auth
 * de servidor (cookies, autoría derivada en backend) llega con MOI-55.
 *
 * Login de prueba del seed: marta@acme.es (Dueña) o carlos@betadigital.com (comercial).
 * Regla de credenciales mock: el email debe existir en Convex y la contraseña ser no vacía.
 */

import type { ConvexReactClient } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { AuthProvider, Session } from "./auth";

const STORAGE_KEY = "vibecrm_session";

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Suscripción para useSyncExternalStore (incluye sincronización entre pestañas). */
export function subscribeSesion(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

/** Snapshot en cliente: email guardado o null. */
export function getEmailSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Snapshot en servidor (SSR): sin acceso a localStorage. */
export function getEmailServerSnapshot(): string | null {
  return null;
}

/** Persiste el email de sesión. Única autoridad de persistencia (junto a signOutEmail). */
export function signInEmail(email: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, email);
  } catch {
    /* almacenamiento no disponible: sesión efímera */
  }
  emit();
}

export function signOutEmail(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
  emit();
}

/** Normaliza el email tecleado (espacios + minúsculas) para casar con el seed. */
function normalizaEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Proveedor de auth MOCK que cumple `AuthProvider` (src/lib/auth.ts). Recibe el cliente
 * Convex porque validar credenciales consulta `usuarios.getByEmail`. Es la única autoridad
 * de persistencia de sesión (localStorage); las pantallas no tocan el store directamente.
 * `updateProfile`/`changePassword` llegan con MOI-82.
 */
export function createMockAuth(convex: ConvexReactClient): AuthProvider {
  async function resolverSesion(email: string): Promise<Session | null> {
    const usuario = await convex.query(api.usuarios.getByEmail, { email });
    if (!usuario) return null;
    return {
      user: { id: usuario._id, nombre: usuario.nombre, email, rol: usuario.rol },
    };
  }

  return {
    async signIn(email, password) {
      const normalizado = normalizaEmail(email);
      const sesion = password ? await resolverSesion(normalizado) : null;
      if (!sesion) throw new Error("Credenciales inválidas");
      signInEmail(normalizado);
      return sesion;
    },
    async signOut() {
      signOutEmail();
    },
    async getSession() {
      const email = getEmailSnapshot();
      return email ? resolverSesion(email) : null;
    },
    async updateProfile() {
      throw new Error("No disponible en el MVP (MOI-82)");
    },
    async changePassword() {
      throw new Error("No disponible en el MVP (MOI-82)");
    },
  };
}
