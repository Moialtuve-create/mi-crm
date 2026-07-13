"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CircleAlert } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Overlay } from "@/components/ui/Overlay";
import { Input } from "@/components/ui/Input";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { hoyISO } from "@/lib/fecha";
import { parseImporte, type EstadoVenta } from "@/lib/ventas";

const ESTADO_OPCIONES: { value: EstadoVenta; label: string }[] = [
  { value: "abierta", label: "Oportunidad abierta" },
  { value: "ganada", label: "Ganada" },
  { value: "perdida", label: "Perdida" },
];

/**
 * Overlay "Registrar venta u oportunidad" (MOI-43). Desde la ficha (cliente fijo) o
 * desde Hoy / la sección Ventas (con selector de cliente). Guardado optimista sobre el
 * historial del cliente. Errores de guardado INLINE (el overlay va por encima del toast).
 */
export function VentaFormOverlay({
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

  // La lista solo hace falta cuando el overlay se abre fuera de una ficha (sin cliente
  // fijo) y está abierto: el provider es app-wide, así evitamos cargarla siempre.
  const clientes = useQuery(
    api.clientes.list,
    open && !clienteId ? {} : "skip",
  );

  const registrar = useMutation(api.ventas.crear).withOptimisticUpdate(
    (localStore, args) => {
      if (!usuario) return;
      const cid = args.clienteId;
      const nuevo = {
        _id: crypto.randomUUID() as Id<"ventas">,
        concepto: args.concepto,
        importe: args.importe,
        estado: args.estado,
        fecha: args.fecha,
        autorNombre: usuario.nombre,
      };

      // Historial del cliente: insertar y reordenar como el backend (fecha desc).
      const hist = localStore.getQuery(api.ventas.listByCliente, {
        clienteId: cid,
      });
      if (hist !== undefined) {
        const ordenado = [nuevo, ...hist].sort((a, b) =>
          b.fecha.localeCompare(a.fecha),
        );
        localStore.setQuery(
          api.ventas.listByCliente,
          { clienteId: cid },
          ordenado,
        );
      }
      // ventas.list NO se parchea a mano: Convex la re-emite al confirmar (patrón listHoy).
    },
  );

  const [clienteSel, setClienteSel] = useState<Id<"clientes"> | "">("");
  const [concepto, setConcepto] = useState("");
  const [importe, setImporte] = useState("");
  const [estado, setEstado] = useState<EstadoVenta>("abierta");
  const [fecha, setFecha] = useState(() => hoyISO());
  const [triedSave, setTriedSave] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardarError, setGuardarError] = useState<string | null>(null);

  const cid = clienteId ?? (clienteSel || null);
  const conceptoTrim = concepto.trim();
  const importeNum = parseImporte(importe);
  const faltaCliente = !cid;
  const faltaConcepto = conceptoTrim === "";
  const faltaImporte = importeNum === null;

  const clienteError =
    triedSave && faltaCliente ? "Elige un cliente" : undefined;
  const conceptoError =
    triedSave && faltaConcepto ? "Indica qué se vende" : undefined;
  const importeError =
    triedSave && faltaImporte ? "Indica un importe válido" : undefined;

  async function guardar() {
    setTriedSave(true);
    if (!usuario || !cid || faltaConcepto || importeNum === null || guardando) {
      return;
    }
    setGuardando(true);
    setGuardarError(null);
    try {
      await registrar({
        clienteId: cid,
        concepto: conceptoTrim,
        importe: importeNum,
        estado,
        fecha,
        autorId: usuario._id,
      });
      onClose();
      showToast({ mensaje: "Venta registrada" });
    } catch {
      setGuardarError("No se pudo registrar la venta. Inténtalo de nuevo.");
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
      titulo="Registrar venta"
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
              htmlFor="venta-cliente"
              className="block text-[14px] font-medium"
            >
              Cliente
            </label>
            <select
              id="venta-cliente"
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

        <Input
          label="Qué se vende"
          data-autofocus
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="Licencia anual, servicio…"
          error={conceptoError}
        />

        <Input
          label="Importe (USD)"
          type="tel"
          inputMode="numeric"
          value={importe}
          onChange={(e) => setImporte(e.target.value)}
          placeholder="1200"
          error={importeError}
        />

        <div className="space-y-1.5">
          <span className="block text-[14px] font-medium">Estado</span>
          <ChipGroup
            ariaLabel="Estado de la venta"
            options={ESTADO_OPCIONES}
            value={estado}
            // Requerido: ignorar la deselección para que nunca vuelva a null.
            onChange={(v) => v && setEstado(v)}
          />
        </div>

        <Input
          label="Fecha"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />

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
