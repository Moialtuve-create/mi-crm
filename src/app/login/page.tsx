// Pantalla: Inicio de sesión (/login) — Linear MOI-80.
// Diseño: design/.../README.md → "1. Inicio de sesión" + prototipo CRM Shell.dc.html.
export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-primary font-semibold text-on-primary">
            V
          </span>
          <span className="text-lg font-semibold">Vibe CRM</span>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5 shadow-xs">
          <h1 className="text-2xl font-semibold">Inicia sesión</h1>
          <p className="mt-1 text-sm text-muted-fg">
            Pantalla pendiente de construir (MOI-80).
          </p>
        </div>
      </div>
    </main>
  );
}
