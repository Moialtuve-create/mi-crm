"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSession } from "@/components/providers/SessionProvider";

/**
 * Identidad autoritativa del usuario actual, resuelta en Convex por email.
 * Se usa para el gating de rol del shell (mostrar "Equipo" solo a la Dueña).
 *
 * Devuelve:
 *   - `undefined` → cargando (o sin email de sesión todavía)
 *   - `null`      → el email no existe en Convex (p. ej. falta ejecutar el seed)
 *   - objeto      → `{ _id, nombre, rol }`
 */
export function useCurrentUser() {
  const { email } = useSession();
  return useQuery(api.usuarios.getByEmail, email ? { email } : "skip");
}
