/**
 * Sesión mock del MVP — store minimalista sobre localStorage (solo el email del
 * usuario activo), expuesto como "external store" para `useSyncExternalStore`.
 * Así signIn/signOut re-renderizan a los consumidores y se sincroniza entre pestañas.
 *
 * La identidad autoritativa (rol, _id, nombre) se resuelve en Convex vía
 * `useCurrentUser()`. El `AuthProvider` completo (login real, perfil, contraseña)
 * es el PUNTO DE INTEGRACIÓN de `src/lib/auth.ts` y llega en MOI-80 / MOI-82.
 *
 * Login de prueba del seed: marta@acme.es (Dueña) o carlos@betadigital.com (comercial).
 */

const STORAGE_KEY = "vibecrm_session";

/** Usuario por defecto mientras no exista login real (MOI-80): "inicio de Carlos". */
export const DEFAULT_EMAIL = "carlos@betadigital.com";

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
