"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CircleAlert, UserPlus } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Overlay } from "@/components/ui/Overlay";
import { Input } from "@/components/ui/Input";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { hoyISO } from "@/lib/fecha";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACTO_MSG = "Indica al menos un teléfono o un email";

/**
 * Overlay "Programar seguimiento" (ficha) / "Nueva tarea" (Hoy) — MOI-39. Mismo
 * componente, `clienteId?` decide la variante. Desde Hoy incluye "+ Nuevo cliente":
 * una segunda "vista" del MISMO overlay (sin remontar nada, así el título/fecha ya
 * escritos sobreviven al ir y volver).
 */
export function SeguimientoFormOverlay({
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
  const esTarea = !clienteId;

  const [vista, setVista] = useState<"tarea" | "nuevoCliente">("tarea");

  // ---- Vista "tarea" ----
  const [accion, setAccion] = useState("");
  const [clienteSel, setClienteSel] = useState<Id<"clientes"> | "">("");
  const [fecha, setFecha] = useState("");
  const [responsableId, setResponsableId] = useState<Id<"usuarios"> | null>(
    null,
  );
  const [triedSave, setTriedSave] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardarError, setGuardarError] = useState<string | null>(null);

  const cid = clienteId ?? (clienteSel || null);

  const clientes = useQuery(
    api.clientes.list,
    open && esTarea && vista === "tarea" ? {} : "skip",
  );
  const usuarios = useQuery(
    api.usuarios.list,
    open && !esTarea ? {} : "skip",
  );

  const crearSeguimiento = useMutation(
    api.seguimientos.crear,
  ).withOptimisticUpdate((localStore, args) => {
    const responsableNombreOptimista =
      usuarios?.find((u) => u._id === args.responsableId)?.nombre ??
      usuario?.nombre ??
      "Sin responsable";
    const nuevo = {
      _id: crypto.randomUUID() as Id<"seguimientos">,
      accion: args.accion,
      vence: args.vence,
      responsableNombre: responsableNombreOptimista,
    };
    const actuales = localStore.getQuery(api.seguimientos.listByCliente, {
      clienteId: args.clienteId,
    });
    if (actuales !== undefined) {
      const ordenado = [...actuales, nuevo].sort((a, b) =>
        a.vence.localeCompare(b.vence),
      );
      localStore.setQuery(
        api.seguimientos.listByCliente,
        { clienteId: args.clienteId },
        ordenado,
      );
    }
    // listHoy NO se parchea a mano: replicar su join (cliente+estado) y su filtro de
    // horizonte de 30 días aquí sería frágil. Convex es reactivo: en cuanto el
    // servidor confirma la mutation, listHoy se re-emite solo (latencia de red, no
    // de recarga de página).
  });

  const accionTrim = accion.trim();
  const faltaAccion = accionTrim === "";
  const faltaCliente = esTarea && !cid;
  const faltaFecha = fecha === "";

  const accionError =
    triedSave && faltaAccion ? "Indica qué hay que hacer" : undefined;
  const clienteError =
    triedSave && faltaCliente ? "Selecciona un cliente" : undefined;
  const fechaError = triedSave && faltaFecha ? "Elige una fecha" : undefined;

  async function guardarSeguimiento() {
    setTriedSave(true);
    if (!usuario || !cid || faltaAccion || faltaFecha || guardando) return;
    setGuardando(true);
    setGuardarError(null);
    try {
      const responsableIdFinal = esTarea
        ? usuario._id
        : (responsableId ?? usuario._id);
      await crearSeguimiento({
        clienteId: cid,
        accion: accionTrim,
        vence: fecha,
        responsableId: responsableIdFinal,
      });
      onClose();
      showToast({
        mensaje: esTarea ? "Tarea creada" : "Seguimiento programado",
      });
    } catch {
      setGuardarError(
        "No se pudo guardar el seguimiento. Inténtalo de nuevo.",
      );
    } finally {
      setGuardando(false);
    }
  }

  // ---- Vista "nuevoCliente" (solo alcanzable desde la variante Nueva tarea) ----
  const [ncNombre, setNcNombre] = useState("");
  const [ncEmpresa, setNcEmpresa] = useState("");
  const [ncTelefono, setNcTelefono] = useState("");
  const [ncEmail, setNcEmail] = useState("");
  const [triedSaveCliente, setTriedSaveCliente] = useState(false);
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [guardarClienteError, setGuardarClienteError] = useState<
    string | null
  >(null);
  const crearCliente = useMutation(api.clientes.crear);

  const ncNombreTrim = ncNombre.trim();
  const ncTelTrim = ncTelefono.trim();
  const ncEmailTrim = ncEmail.trim();
  const ncFaltaNombre = ncNombreTrim === "";
  const ncEmailInvalido = ncEmailTrim !== "" && !EMAIL_RE.test(ncEmailTrim);
  const ncFaltaContacto = ncTelTrim === "" && ncEmailTrim === "";

  const ncNombreError =
    triedSaveCliente && ncFaltaNombre ? "Añade un nombre" : undefined;
  const ncEmailError =
    triedSaveCliente && ncEmailInvalido
      ? "Email no válido"
      : triedSaveCliente && ncFaltaContacto
        ? CONTACTO_MSG
        : undefined;

  async function guardarCliente() {
    setTriedSaveCliente(true);
    if (
      ncFaltaNombre ||
      ncEmailInvalido ||
      ncFaltaContacto ||
      guardandoCliente
    )
      return;
    setGuardandoCliente(true);
    setGuardarClienteError(null);
    try {
      const nuevoId = await crearCliente({
        nombre: ncNombreTrim,
        empresa: ncEmpresa.trim() || undefined,
        telefono: ncTelTrim || undefined,
        email: ncEmailTrim || undefined,
        hoy: hoyISO(),
      });
      setClienteSel(nuevoId);
      setVista("tarea");
      showToast({ mensaje: "Cliente añadido" });
    } catch {
      setGuardarClienteError("No se pudo guardar el cliente. Inténtalo de nuevo.");
    } finally {
      setGuardandoCliente(false);
    }
  }

  // El onClose de <Overlay> cubre Esc, scrim y el botón X — los tres pasan por aquí.
  // En la sub-vista "nuevoCliente" deben volver a "tarea" (sin perder título/fecha),
  // no cerrar todo el overlay.
  function cerrar() {
    if (vista === "nuevoCliente") {
      if (!guardandoCliente) setVista("tarea");
      return;
    }
    if (!guardando) onClose();
  }

  const titulo =
    vista === "nuevoCliente"
      ? "Nuevo cliente"
      : esTarea
        ? "Nueva tarea"
        : "Programar seguimiento";

  return (
    <Overlay
      open={open}
      onClose={cerrar}
      titulo={titulo}
      footer={
        vista === "nuevoCliente" ? (
          <>
            <Button
              variant="secondary"
              onClick={() => setVista("tarea")}
              disabled={guardandoCliente}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={guardarCliente}
              disabled={guardandoCliente}
            >
              {guardandoCliente ? "Guardando…" : "Guardar"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={cerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={guardarSeguimiento}
              disabled={guardando || !usuario}
            >
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </>
        )
      }
    >
      {vista === "nuevoCliente" ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            guardarCliente();
          }}
        >
          <Input
            label="Nombre"
            data-autofocus
            value={ncNombre}
            onChange={(e) => setNcNombre(e.target.value)}
            placeholder="Marta López"
            autoCapitalize="words"
            error={ncNombreError}
          />
          <Input
            label="Empresa"
            value={ncEmpresa}
            onChange={(e) => setNcEmpresa(e.target.value)}
            placeholder="Acme S.L."
          />
          <Input
            label="Teléfono"
            type="tel"
            inputMode="tel"
            value={ncTelefono}
            onChange={(e) => setNcTelefono(e.target.value)}
            placeholder="+34 600 000 000"
          />
          <Input
            label="Email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            value={ncEmail}
            onChange={(e) => setNcEmail(e.target.value)}
            placeholder="nombre@empresa.es"
            error={ncEmailError}
            helper={!ncEmailError ? CONTACTO_MSG : undefined}
          />
          {guardarClienteError ? (
            <p className="flex items-center gap-1.5 rounded-md bg-error-bg px-3 py-2 text-[13px] text-error-fg">
              <CircleAlert size={14} strokeWidth={2} />
              {guardarClienteError}
            </p>
          ) : null}
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            guardarSeguimiento();
          }}
        >
          <Input
            label={esTarea ? "Título" : "Qué hay que hacer"}
            data-autofocus
            value={accion}
            onChange={(e) => setAccion(e.target.value)}
            placeholder="Llamar para cierre"
            autoCapitalize="sentences"
            error={accionError}
          />

          {esTarea ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="seguimiento-cliente"
                  className="block text-[14px] font-medium"
                >
                  Cliente
                </label>
                <button
                  type="button"
                  onClick={() => setVista("nuevoCliente")}
                  className="focus-ring -mr-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[13px] font-semibold text-primary hover:underline"
                >
                  <UserPlus size={14} strokeWidth={2} />
                  Nuevo cliente
                </button>
              </div>
              <select
                id="seguimiento-cliente"
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
            label="Fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            error={fechaError}
          />

          {!esTarea ? (
            <div className="space-y-1.5">
              <span className="block text-[14px] font-medium">Responsable</span>
              <ChipGroup
                ariaLabel="Responsable del seguimiento"
                options={(usuarios ?? []).map((u) => ({
                  value: u._id,
                  label: u.nombre,
                }))}
                value={responsableId ?? usuario?._id ?? null}
                onChange={(v) => v && setResponsableId(v)}
              />
            </div>
          ) : null}

          {guardarError ? (
            <p className="flex items-center gap-1.5 rounded-md bg-error-bg px-3 py-2 text-[13px] text-error-fg">
              <CircleAlert size={14} strokeWidth={2} />
              {guardarError}
            </p>
          ) : null}

          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      )}
    </Overlay>
  );
}
