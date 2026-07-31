"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { CircleAlert } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Overlay } from "@/components/ui/Overlay";
import { Input } from "@/components/ui/Input";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { EMAIL_RE, normalizaEmail } from "@/lib/authCliente";
import { ROL_OPCIONES, type RolUsuario } from "@/lib/roles";

/** Datos mínimos para precargar el formulario en modo edición. */
export type UsuarioEditable = {
  _id: Id<"usuarios">;
  nombre: string;
  email: string;
  rol: RolUsuario;
};

/**
 * Overlay de alta / edición de usuario (MOI-81). Mismo esqueleto que
 * `ClienteFormOverlay`: validación tras el primer intento, single-flight en Guardar,
 * error de guardado inline (el overlay va por encima del toast).
 *
 * El email SOLO es editable en modo "nuevo" (auditoría de plan MOI-81, hallazgo B1):
 * cambiarlo en `usuarios` no revoca ni migra la credencial ya vinculada en
 * `authAccounts`, que sigue atada al email original — el titular anterior conservaría
 * acceso con ese email y contraseña. En edición se muestra como texto de solo lectura.
 */
export function UsuarioFormOverlay({
  open,
  modo,
  inicial,
  onClose,
}: {
  open: boolean;
  modo: "nuevo" | "editar";
  inicial?: UsuarioEditable;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const crear = useMutation(api.usuarios.crear);
  const actualizar = useMutation(api.usuarios.actualizar);

  const [nombre, setNombre] = useState(() => inicial?.nombre ?? "");
  const [email, setEmail] = useState(() => inicial?.email ?? "");
  const [rol, setRol] = useState<RolUsuario>(() => inicial?.rol ?? "comercial");
  const [triedSave, setTriedSave] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardarError, setGuardarError] = useState<string | null>(null);

  const nombreTrim = nombre.trim();
  const emailTrim = email.trim();
  const faltaNombre = nombreTrim === "";
  const emailInvalido = modo === "nuevo" && !EMAIL_RE.test(emailTrim);
  const valido = !faltaNombre && !emailInvalido;

  const nombreError = triedSave && faltaNombre ? "Añade un nombre" : undefined;
  const emailError =
    triedSave && emailInvalido ? "Introduce un email válido" : undefined;

  async function guardar() {
    setTriedSave(true);
    if (!valido || guardando) return;
    setGuardando(true);
    setGuardarError(null);
    try {
      if (modo === "editar" && inicial) {
        await actualizar({ id: inicial._id, nombre: nombreTrim, rol });
        onClose();
      } else {
        await crear({ nombre: nombreTrim, email: normalizaEmail(emailTrim), rol });
        onClose();
        showToast({ mensaje: "Usuario añadido" });
      }
    } catch (e) {
      setGuardarError(
        e instanceof Error ? e.message : "No se pudo guardar el usuario. Inténtalo de nuevo.",
      );
    } finally {
      setGuardando(false);
    }
  }

  function cerrar() {
    if (!guardando) onClose();
  }

  return (
    <Overlay
      open={open}
      onClose={cerrar}
      titulo={modo === "editar" ? "Editar usuario" : "Añadir usuario"}
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
          autoCapitalize="words"
          error={nombreError}
        />

        {modo === "nuevo" ? (
          <Input
            label="Email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@empresa.es"
            error={emailError}
            helper={emailError ? undefined : "Se le enviará un código para definir su contraseña"}
          />
        ) : (
          <div className="space-y-1.5">
            <span className="block text-[14px] font-medium">Email</span>
            <p className="rounded-md border border-line bg-surface-2 px-3.5 py-2.5 text-[15px] text-muted-fg">
              {inicial?.email}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <span className="block text-[14px] font-medium">Rol</span>
          <ChipGroup
            ariaLabel="Rol del usuario"
            options={ROL_OPCIONES}
            value={rol}
            onChange={(v) => v && setRol(v)}
          />
        </div>

        {guardarError ? (
          <p className="flex items-center gap-1.5 rounded-md bg-error-bg px-3 py-2 text-[13px] text-error-fg">
            <CircleAlert size={14} strokeWidth={2} />
            {guardarError}
          </p>
        ) : null}

        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Overlay>
  );
}
