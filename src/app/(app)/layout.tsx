import Link from "next/link";

/**
 * Shell de la app (secciones con navegación) — Linear MOI-33.
 *
 * Placeholder temporal: la versión final es tab bar inferior en móvil
 * (Hoy · Clientes · Ventas · Equipo, esta última solo Dueña) y sidebar de
 * 240px en escritorio, según design/.../README.md → "Arquitectura de navegación".
 */
const secciones = [
  { href: "/hoy", label: "Hoy" },
  { href: "/clientes", label: "Clientes" },
  { href: "/ventas", label: "Ventas" },
  { href: "/equipo", label: "Equipo" },
  { href: "/cuenta", label: "Cuenta" },
] as const;

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <main className="mx-auto w-full max-w-[860px] flex-1 p-4 pb-24">
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-surface">
        <ul className="mx-auto flex max-w-[860px]">
          {secciones.map((s) => (
            <li key={s.href} className="flex-1">
              <Link
                href={s.href}
                className="flex min-h-14 items-center justify-center text-[13px] font-medium text-subtle-fg hover:text-primary"
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
