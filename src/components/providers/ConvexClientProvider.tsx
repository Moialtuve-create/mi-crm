"use client";

import { ReactNode, useMemo } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

/**
 * Proveedor de Convex para toda la app.
 *
 * Requiere NEXT_PUBLIC_CONVEX_URL (ver .env.example). Mientras no exista
 * (p. ej. antes de ejecutar `npx convex dev` por primera vez), la app
 * funciona sin backend para poder construir las pantallas con datos mock.
 */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  const client = useMemo(
    () => (convexUrl ? new ConvexReactClient(convexUrl) : null),
    [convexUrl],
  );

  if (!client) {
    if (typeof window !== "undefined") {
      console.warn(
        "[Vibe CRM] NEXT_PUBLIC_CONVEX_URL no está definida: la app corre sin Convex. " +
          "Ejecuta `npx convex dev` y copia la URL a .env.local.",
      );
    }
    return <>{children}</>;
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
