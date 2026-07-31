"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Identidad autoritativa del usuario actual, resuelta en Convex desde la sesión de
 * Convex Auth (MOI-115) — no falsificable escribiendo en localStorage.
 * Se usa para el gating de rol del shell (mostrar "Equipo" solo a la Dueña).
 *
 * Devuelve:
 *   - `undefined` → cargando
 *   - `null`      → sin sesión, o la cuenta no está provisionada en `usuarios`
 *   - objeto      → `{ _id, nombre, rol, email }`
 */
export function useCurrentUser() {
  return useQuery(api.usuarios.getUsuarioAutenticado);
}
