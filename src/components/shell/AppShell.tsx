"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import {
  CalendarCheck,
  Users,
  TrendingUp,
  Shield,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Avatar } from "@/components/ui/Avatar";
import { Overlay } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";

/**
 * Shell de navegación (Linear MOI-33): tab bar inferior en móvil, sidebar 240px en
 * escritorio. "Equipo" solo para la Dueña. Aterrizaje en /hoy tras la sesión.
 *
 * MOI-115: la sesión es la de Convex Auth (JWT verificado en servidor), no un email en
 * localStorage. `useConvexAuth().isLoading` ya cubre la rehidratación del refresh token
 * en el primer render, así que no hace falta el flag de hidratación que tenía el guard
 * anterior (era para no leer localStorage antes de hidratar).
 */

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  soloPropietaria?: boolean;
}

const NAV: NavItem[] = [
  { href: "/hoy", label: "Hoy", icon: CalendarCheck },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/ventas", label: "Ventas", icon: TrendingUp },
  { href: "/equipo", label: "Equipo", icon: Shield, soloPropietaria: true },
];

function esActivo(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

function Marca() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-primary text-[15px] font-semibold text-on-primary">
        V
      </span>
      <span className="text-[15px] font-semibold">Vibe CRM</span>
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const usuario = useCurrentUser();
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);

  async function cerrarSesion() {
    await signOut();
    router.replace("/login");
  }

  // Guard A — sin sesión → /login (protege TODAS las rutas de (app); MOI-80/MOI-115).
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isLoading, isAuthenticated, router]);

  // Guard B — sesión de Convex Auth válida pero sin fila en `usuarios` (p. ej. la cuenta
  // fue desprovisionada): fallar cerrado a /login.
  useEffect(() => {
    if (isAuthenticated && usuario === null) {
      void signOut().then(() => router.replace("/login"));
    }
  }, [isAuthenticated, usuario, signOut, router]);

  // Redirigiendo (sin sesión) o cargando la identidad: spinner neutro. Nunca se monta
  // contenido protegido en estos estados.
  if (isLoading || !isAuthenticated || usuario === undefined || usuario === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span
          className="h-6 w-6 animate-spin rounded-full border-[3px] border-surface-2 border-t-primary"
          aria-label="Cargando"
        />
      </div>
    );
  }

  const esPropietaria = usuario.rol === "propietaria";
  const items = NAV.filter((i) => !i.soloPropietaria || esPropietaria);

  // La ficha de cliente es un "push" de detalle: en móvil oculta la tab bar (MOI-36).
  // Único detalle hoy → basta con detectar /clientes/:id (no /clientes).
  const esFicha = /^\/clientes\/[^/]+$/.test(pathname);

  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar (escritorio) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex h-16 items-center px-5">
          <Marca />
        </div>
        <nav className="flex-1 px-3">
          <ul className="space-y-1">
            {items.map(({ href, label, icon: Icon }) => {
              const activo = esActivo(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={activo ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium transition-colors ${
                      activo
                        ? "bg-primary-subtle text-primary"
                        : "text-muted-fg hover:bg-surface-2"
                    }`}
                  >
                    <Icon size={20} strokeWidth={1.5} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex items-center gap-1 border-t border-line p-3">
          <Link
            href="/cuenta"
            aria-current={esActivo(pathname, "/cuenta") ? "page" : undefined}
            className={`flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 transition-colors ${
              esActivo(pathname, "/cuenta")
                ? "bg-primary-subtle"
                : "hover:bg-surface-2"
            }`}
          >
            <Avatar nombre={usuario.nombre} size={32} />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium">
                {usuario.nombre}
              </span>
              <span className="block text-[12px] text-subtle-fg">Mi cuenta</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setConfirmandoSalida(true)}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-subtle-fg hover:bg-surface-2 hover:text-fg"
          >
            <LogOut size={18} strokeWidth={1.5} />
          </button>
        </div>
      </aside>

      {/* Columna principal */}
      <div className="flex min-h-dvh flex-1 flex-col">
        {/* Top bar (móvil) */}
        <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4 md:hidden">
          <Marca />
          <div className="flex items-center gap-1">
            <Link href="/cuenta" aria-label="Mi cuenta">
              <Avatar nombre={usuario.nombre} size={32} />
            </Link>
            <button
              type="button"
              onClick={() => setConfirmandoSalida(true)}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="focus-ring flex h-9 w-9 items-center justify-center rounded-md text-subtle-fg hover:bg-surface-2 hover:text-fg"
            >
              <LogOut size={18} strokeWidth={1.5} />
            </button>
          </div>
        </header>

        <main
          className={`mx-auto w-full max-w-[860px] flex-1 px-4 py-5 ${
            esFicha ? "pb-8" : "pb-24 md:pb-8"
          }`}
        >
          {children}
        </main>
      </div>

      {/* Tab bar (móvil) — oculta en la ficha de detalle (push) */}
      {!esFicha && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface md:hidden">
          <ul className="mx-auto flex max-w-[860px]">
            {items.map(({ href, label, icon: Icon }) => {
              const activo = esActivo(pathname, href);
              return (
                <li key={href} className="flex-1">
                  <Link
                    href={href}
                    aria-current={activo ? "page" : undefined}
                    className={`flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors ${
                      activo ? "text-primary" : "text-subtle-fg"
                    }`}
                  >
                    <Icon size={22} strokeWidth={1.5} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <Overlay
        open={confirmandoSalida}
        onClose={() => setConfirmandoSalida(false)}
        titulo="Cerrar sesión"
        footer={
          <>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setConfirmandoSalida(false)}
            >
              Cancelar
            </Button>
            <Button variant="danger" className="flex-1" onClick={cerrarSesion}>
              Cerrar sesión
            </Button>
          </>
        }
      >
        <p className="text-[14px] text-muted-fg">
          ¿Seguro que quieres cerrar sesión? Tendrás que volver a entrar para acceder al CRM.
        </p>
      </Overlay>
    </div>
  );
}
