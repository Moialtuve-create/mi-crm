"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarCheck,
  Users,
  TrendingUp,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSession } from "@/components/providers/SessionProvider";
import { Avatar } from "@/components/ui/Avatar";

/**
 * Shell de navegación (Linear MOI-33): tab bar inferior en móvil, sidebar 240px en
 * escritorio. "Equipo" solo para la Dueña. Aterrizaje en /hoy tras la sesión.
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

// Flag de hidratación (sin setState-en-efecto): `false` en SSR y en la primera pintura
// de hidratación, `true` en cliente ya hidratado. Evita evaluar el guard con el snapshot
// de SSR (email = null) y redirigir por error a un usuario logueado.
const noopSubscribe = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

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
  const { email, signOut } = useSession();
  const usuario = useCurrentUser();

  const hidratado = useSyncExternalStore(noopSubscribe, getTrue, getFalse);

  // Guard A — sin sesión → /login (protege TODAS las rutas de (app); MOI-80).
  useEffect(() => {
    if (hidratado && email == null) router.replace("/login");
  }, [hidratado, email, router]);

  // Guard B — sesión rancia: hay email pero no existe en Convex → fallar cerrado a /login.
  useEffect(() => {
    if (hidratado && email != null && usuario === null) {
      signOut();
      router.replace("/login");
    }
  }, [hidratado, email, usuario, signOut, router]);

  // Redirigiendo (sin sesión / hidratando) o cargando la identidad: spinner neutro.
  // Nunca se monta contenido protegido en estos estados.
  if (
    !hidratado ||
    email == null ||
    usuario === undefined ||
    usuario === null
  ) {
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
        <div className="border-t border-line p-3">
          <Link
            href="/cuenta"
            aria-current={esActivo(pathname, "/cuenta") ? "page" : undefined}
            className={`flex items-center gap-3 rounded-md px-2 py-2 transition-colors ${
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
        </div>
      </aside>

      {/* Columna principal */}
      <div className="flex min-h-dvh flex-1 flex-col">
        {/* Top bar (móvil) */}
        <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4 md:hidden">
          <Marca />
          <Link href="/cuenta" aria-label="Mi cuenta">
            <Avatar nombre={usuario.nombre} size={32} />
          </Link>
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
    </div>
  );
}
