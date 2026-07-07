"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { CircleAlert } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Overlay } from "@/components/ui/Overlay";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ESTADO_META, type EstadoCliente } from "@/lib/estados";
import { hoyISO } from "@/lib/fecha";

/** Canal de origen (espejo de `canalOrigen` en convex/schema.ts). */
type CanalOrigen = "web" | "redes" | "email" | "whatsapp";

/** Datos mínimos para precargar el formulario en modo edición. */
export type ClienteEditable = {
  _id: Id<"clientes">;
  nombre: string;
  empresa?: string | null;
  telefono?: string | null;
  email?: string | null;
  estado: EstadoCliente;
};

const CANAL_OPCIONES: { value: CanalOrigen; label: string }[] = [
  { value: "web", label: "Web" },
  { value: "redes", label: "Redes" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
];

const ESTADO_OPCIONES = (Object.keys(ESTADO_META) as EstadoCliente[]).map(
  (value) => ({ value, label: ESTADO_META[value].label }),
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACTO_MSG = "Indica al menos un teléfono o un email";

/**
 * Overlay de alta / edición de cliente (MOI-34). El mismo formulario crea y edita.
 * Validación tras el primer intento; single-flight en Guardar (anti-duplicados);
 * los errores de guardado se muestran INLINE (el overlay va por encima del toast).
 */
export function ClienteFormOverlay({
  open,
  modo,
  inicial,
  onClose,
}: {
  open: boolean;
  modo: "nuevo" | "editar";
  inicial?: ClienteEditable;
  onClose: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const crear = useMutation(api.clientes.crear);
  const actualizar = useMutation(api.clientes.actualizar);

  // Estado sembrado en el montaje. El provider remonta con `key` en cada apertura,
  // así que los inicializadores perezosos leen los datos correctos sin efectos.
  const [nombre, setNombre] = useState(() => inicial?.nombre ?? "");
  const [empresa, setEmpresa] = useState(() => inicial?.empresa ?? "");
  const [telefono, setTelefono] = useState(() => inicial?.telefono ?? "");
  const [email, setEmail] = useState(() => inicial?.email ?? "");
  const [canal, setCanal] = useState<CanalOrigen | null>(null);
  const [nota, setNota] = useState("");
  const [estado, setEstado] = useState<EstadoCliente>(
    () => inicial?.estado ?? "nuevo_lead",
  );
  const [triedSave, setTriedSave] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardarError, setGuardarError] = useState<string | null>(null);

  const nombreTrim = nombre.trim();
  const telTrim = telefono.trim();
  const emailTrim = email.trim();
  const faltaNombre = nombreTrim === "";
  const emailInvalido = emailTrim !== "" && !EMAIL_RE.test(emailTrim);
  const faltaContacto = telTrim === "" && emailTrim === "";
  const valido = !faltaNombre && !faltaContacto && !emailInvalido;

  const nombreError = triedSave && faltaNombre ? "Añade un nombre" : undefined;
  const emailError =
    triedSave && emailInvalido
      ? "Email no válido"
      : triedSave && faltaContacto
        ? CONTACTO_MSG
        : undefined;
  const emailHelper =
    modo === "nuevo" && !emailError ? CONTACTO_MSG : undefined;

  async function guardar() {
    setTriedSave(true);
    if (!valido || guardando) return;
    setGuardando(true);
    setGuardarError(null);
    try {
      if (modo === "editar" && inicial) {
        await actualizar({
          id: inicial._id,
          nombre: nombreTrim,
          empresa: empresa.trim() || undefined,
          telefono: telTrim || undefined,
          email: emailTrim || undefined,
          estado,
        });
        onClose();
      } else {
        const id = await crear({
          nombre: nombreTrim,
          empresa: empresa.trim() || undefined,
          telefono: telTrim || undefined,
          email: emailTrim || undefined,
          // v.optional(canalOrigen) no acepta null: enviar undefined al deseleccionar.
          canal: canal ?? undefined,
          nota: nota.trim() || undefined,
          hoy: hoyISO(),
        });
        onClose();
        showToast({ mensaje: "Cliente añadido" });
        router.push(`/clientes/${id}`);
      }
    } catch {
      // El overlay sigue abierto y va por encima del toast → error visible inline.
      setGuardarError("No se pudo guardar el cliente. Inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  // Mientras se guarda, bloquear el cierre (Cancelar / Esc / scrim / botón X): evita
  // cerrar el overlay y que el alta, al completar, navegue a la ficha de forma confusa.
  function cerrar() {
    if (!guardando) onClose();
  }

  return (
    <Overlay
      open={open}
      onClose={cerrar}
      titulo={modo === "editar" ? "Editar cliente" : "Nuevo cliente"}
      footer={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={guardar}
            disabled={guardando}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <Input
          label="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Marta López"
          autoCapitalize={modo === "nuevo" ? "words" : undefined}
          error={nombreError}
        />
        <Input
          label="Empresa"
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
          placeholder="Acme S.L."
        />

        {modo === "editar" ? (
          <>
            <Input
              label="Email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@empresa.es"
              error={emailError}
            />
            <Input
              label="Teléfono"
              type="tel"
              inputMode="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+34 600 000 000"
            />
            <div className="space-y-1.5">
              <span className="block text-[14px] font-medium">Estado</span>
              <ChipGroup
                ariaLabel="Estado del cliente"
                options={ESTADO_OPCIONES}
                value={estado}
                onChange={(v) => v && setEstado(v)}
              />
            </div>
          </>
        ) : (
          <>
            <Input
              label="Teléfono"
              type="tel"
              inputMode="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+34 600 000 000"
            />
            <Input
              label="Email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@empresa.es"
              error={emailError}
              helper={emailHelper}
            />
            <div className="space-y-1.5">
              <span className="block text-[14px] font-medium">
                Canal de origen
              </span>
              <ChipGroup
                ariaLabel="Canal de origen"
                options={CANAL_OPCIONES}
                value={canal}
                onChange={setCanal}
              />
            </div>
            <Textarea
              label="Nota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Detalle del primer contacto, necesidades…"
            />
          </>
        )}

        {guardarError ? (
          <p className="flex items-center gap-1.5 rounded-md bg-error-bg px-3 py-2 text-[13px] text-error-fg">
            <CircleAlert size={14} strokeWidth={2} />
            {guardarError}
          </p>
        ) : null}

        {/* Enviar con Enter sin un botón submit visible (el submit real está en el footer). */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Overlay>
  );
}
