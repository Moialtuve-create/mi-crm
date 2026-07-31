"use client";

// Pantalla: Recuperar contraseña (/login/recuperar) — Linear MOI-115.
//
// Ruta propia, no overlay: Overlay.tsx cierra con Esc y con clic fuera, inaceptable en
// un flujo de varios minutos (el usuario se va al correo y vuelve). Fuera del grupo
// (app), así que NO pasa por el guard de AppShell — crítico, aquí nunca hay sesión.

import { useState } from "react";
import Link from "next/link";
import { PasoEmail } from "@/components/auth/PasoEmail";
import { PasoCodigo } from "@/components/auth/PasoCodigo";
import { PasoNuevaPassword } from "@/components/auth/PasoNuevaPassword";

type Paso =
  | { t: "email" }
  | { t: "codigo"; email: string }
  | { t: "nueva"; email: string; codigo: string };

export default function RecuperarPage() {
  const [paso, setPaso] = useState<Paso>({ t: "email" });

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
          {paso.t === "email" ? (
            <PasoEmail
              key="email"
              onEnviado={(email) => setPaso({ t: "codigo", email })}
            />
          ) : paso.t === "codigo" ? (
            <PasoCodigo
              key="codigo"
              email={paso.email}
              onVerificado={(codigo) => setPaso({ t: "nueva", email: paso.email, codigo })}
              onCambiarEmail={() => setPaso({ t: "email" })}
            />
          ) : (
            <PasoNuevaPassword key="nueva" email={paso.email} codigo={paso.codigo} />
          )}

          <div className="mt-4 text-center">
            <Link href="/login" className="text-[13px] text-muted-fg hover:text-fg">
              Volver a iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
