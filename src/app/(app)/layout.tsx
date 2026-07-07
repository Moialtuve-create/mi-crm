import { AppShell } from "@/components/shell/AppShell";

/**
 * Shell de la app (secciones con navegación) — Linear MOI-33.
 * La navegación adaptativa (tab bar móvil / sidebar escritorio) vive en <AppShell>.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
