"use client";

import { ReactNode, useMemo } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

/**
 * Proveedor de Convex para toda la app.
 *
 * Requiere NEXT_PUBLIC_CONVEX_URL (ver .env.example). La app depende de Convex
 * (las pantallas usan useQuery), así que si falta la URL se muestra un aviso
 * en vez de renderizar la app —que fallaría al suscribirse a las queries—.
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
        "[Vibe CRM] Falta NEXT_PUBLIC_CONVEX_URL. Ejecuta `npx convex dev` y copia la URL a .env.local.",
      );
    }
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-line bg-surface p-5 text-center shadow-xs">
          <h1 className="text-lg font-semibold">Falta configurar Convex</h1>
          <p className="mt-2 text-sm text-muted-fg">
            Define <code>NEXT_PUBLIC_CONVEX_URL</code> en <code>.env.local</code>{" "}
            (ejecuta <code>npx convex dev</code>). La app necesita el backend para
            funcionar.
          </p>
        </div>
      </div>
    );
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
