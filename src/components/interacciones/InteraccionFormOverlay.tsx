"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CircleAlert } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Overlay } from "@/components/ui/Overlay";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { hoyISO } from "@/lib/fecha";

/** Canal/tipo de la interacción (espejo de `tipoInteraccion` en convex/schema.ts). */
type TipoInteraccion = "llamada" | "email" | "whatsapp" | "en_persona";

const TIPO_OPCIONES: { value: TipoInteraccion; label: string }[] = [
  { value: "llamada", label: "Llamada" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "en_persona", label: "En persona" },
];

/**
 * Overlay "Registrar interacción" (MOI-37). Desde la ficha (cliente fijo) o desde Hoy
 * (con selector de cliente). Guardado optimista sobre el historial y "último contacto".
 * Errores de guardado INLINE (el overlay va por encima del toast).
 */
export function InteraccionFormOverlay({
  open,
  clienteId,
  onClose,
}: {
  open: boolean;
  clienteId?: Id<"clientes">;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const usuario = useCurrentUser();

  // La lista solo hace falta en la variante "desde Hoy" (sin cliente fijo) y con el
  // overlay abierto: el provider es app-wide, así que evitamos cargarla siempre.
  const clientes = useQuery(
    api.clientes.list,
    open && !clienteId ? {} : "skip",
  );

  const registrar = useMutation(api.interacciones.crear).withOptimisticUpdate(
    (localStore, args) => {
      if (!usuario) return;
      const cid = args.clienteId;
      const nuevo = {
        _id: crypto.randomUUID() as Id<"interacciones">,
        tipo: args.tipo,
        texto: args.texto,
        fecha: args.fecha,
        autorNombre: usuario.nombre,
      };

      // 1) Historial: insertar y reordenar como el backend (fecha desc; empate →
      // el optimista primero gracias al sort estable si va al frente).
      const hist = localStore.getQuery(api.interacciones.listByCliente, {
        clienteId: cid,
      });
      if (hist !== undefined) {
        const ordenado = [nuevo, ...hist].sort((a, b) =>
          b.fecha.localeCompare(a.fecha),
        );
        localStore.setQuery(
          api.interacciones.listByCliente,
          { clienteId: cid },
          ordenado,
        );
      }

      // 2) "Último contacto" de la ficha (solo avanza).
      const doc = localStore.getQuery(api.clientes.get, { id: cid });
      if (
        doc &&
        (!doc.ultimoContacto || args.fecha.localeCompare(doc.ultimoContacto) > 0)
      ) {
        localStore.setQuery(
          api.clientes.get,
          { id: cid },
          { ...doc, ultimoContacto: args.fecha },
        );
      }

      // 3) "Último contacto" en la lista de clientes.
      const lista = localStore.getQuery(api.clientes.list, {});
      if (lista) {
        localStore.setQuery(
          api.clientes.list,
          {},
          lista.map((c) =>
            c._id === cid &&
            (!c.ultimoContacto || args.fecha.localeCompare(c.ultimoContacto) > 0)
              ? { ...c, ultimoContacto: args.fecha }
              : c,
          ),
        );
      }
    },
  );

  const [clienteSel, setClienteSel] = useState<Id<"clientes"> | "">("");
  const [tipo, setTipo] = useState<TipoInteraccion>("llamada");
  const [fecha, setFecha] = useState(() => hoyISO());
  const [nota, setNota] = useState("");
  const [triedSave, setTriedSave] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardarError, setGuardarError] = useState<string | null>(null);

  const cid = clienteId ?? (clienteSel || null);
  const notaTrim = nota.trim();
  const faltaCliente = !cid;
  const faltaNota = notaTrim === "";

  const clienteError =
    triedSave && faltaCliente ? "Elige un cliente" : undefined;
  const notaError = triedSave && faltaNota ? "Escribe qué pasó" : undefined;

  async function guardar() {
    setTriedSave(true);
    if (!usuario || !cid || faltaNota || guardando) return;
    setGuardando(true);
    setGuardarError(null);
    try {
      await registrar({
        clienteId: cid,
        tipo,
        texto: notaTrim,
        fecha,
        autorId: usuario._id,
      });
      onClose();
      showToast({ mensaje: "Interacción registrada" });
    } catch {
      setGuardarError(
        "No se pudo registrar la interacción. Inténtalo de nuevo.",
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
      titulo="Registrar interacción"
      footer={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={guardar}
            disabled={guardando || !usuario}
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
        {/* Selector de cliente: solo cuando el overlay se abre fuera de una ficha. */}
        {!clienteId ? (
          <div className="space-y-1.5">
            <label
              htmlFor="interaccion-cliente"
              className="block text-[14px] font-medium"
            >
              Cliente
            </label>
            <select
              id="interaccion-cliente"
              value={clienteSel}
              onChange={(e) =>
                setClienteSel(e.target.value as Id<"clientes"> | "")
              }
              aria-invalid={clienteError ? true : undefined}
              className={`focus-ring h-12 w-full rounded-md border bg-surface px-3.5 text-[15px] ${
                clienteError ? "border-error" : "border-line-strong"
              } ${clienteSel === "" ? "text-subtle-fg" : ""}`}
            >
              <option value="" disabled>
                Selecciona un cliente…
              </option>
              {clientes?.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.nombre}
                  {c.empresa ? ` · ${c.empresa}` : ""}
                </option>
              ))}
            </select>
            {clienteError ? (
              <p className="flex items-center gap-1 text-[13px] text-error-fg">
                <CircleAlert size={13} strokeWidth={2} />
                {clienteError}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <span className="block text-[14px] font-medium">Canal</span>
          <ChipGroup
            ariaLabel="Canal de la interacción"
            options={TIPO_OPCIONES}
            value={tipo}
            // Requerido: ignorar la deselección para que nunca vuelva a null.
            onChange={(v) => v && setTipo(v)}
          />
        </div>

        <Input
          label="Fecha"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />

        <div className="space-y-1.5">
          <Textarea
            label="Nota"
            data-autofocus
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Qué se habló, acuerdos, próximos pasos…"
            aria-invalid={notaError ? true : undefined}
          />
          {notaError ? (
            <p className="flex items-center gap-1 text-[13px] text-error-fg">
              <CircleAlert size={13} strokeWidth={2} />
              {notaError}
            </p>
          ) : null}
        </div>

        <p className="text-[13px] text-subtle-fg">
          {usuario
            ? `Se registrará como ${usuario.nombre}`
            : "Cargando tu usuario…"}
        </p>

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
