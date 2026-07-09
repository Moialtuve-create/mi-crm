import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Seed de datos de ejemplo — SOLO DESARROLLO.
 *
 * Destructivo (borra e inserta) → protegido con triple guarda:
 *   1. internalMutation: no accesible desde ningún cliente.
 *   2. env flag SEED_ENABLED="true": ponerla solo en el deployment dev
 *      (`npx convex env set SEED_ENABLED true`); producción no la tendrá.
 *   3. arg confirm === "SEED_DEV".
 * Borra únicamente las 5 tablas del MVP, nunca un wipe global.
 *
 * Ejecutar (inyecta tu fecha LOCAL para que los grupos Atrasado/Hoy/Próximo cuadren):
 *   bash:        npx convex run seed:run "{\"confirm\":\"SEED_DEV\",\"hoy\":\"$(date +%F)\"}"
 *   PowerShell:  $h = Get-Date -Format yyyy-MM-dd
 *                npx convex run seed:run "{`"confirm`":`"SEED_DEV`",`"hoy`":`"$h`"}"
 */

// Aritmética de calendario a prueba de zona horaria: parte de una fecha yyyy-mm-dd
// (la fecha LOCAL de quien ejecuta) y suma días en UTC puro, sin drift local/UTC.
function sumarDiasISO(baseISO: string, dias: number): string {
  const [y, m, d] = baseISO.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + dias * 86_400_000);
  const yy = t.getUTCFullYear();
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(t.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export const run = internalMutation({
  // `hoy` = fecha LOCAL de quien ejecuta (yyyy-mm-dd), normalmente `$(date +%F)`.
  args: { confirm: v.string(), hoy: v.string() },
  handler: async (ctx, { confirm, hoy }) => {
    if (process.env.SEED_ENABLED !== "true") {
      throw new Error(
        "Seed deshabilitado. Define SEED_ENABLED=true SOLO en el deployment de desarrollo.",
      );
    }
    if (confirm !== "SEED_DEV") {
      throw new Error('Confirmación requerida: pasa {"confirm":"SEED_DEV"}.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(hoy)) {
      throw new Error(
        'Pasa tu fecha local en `hoy` (yyyy-mm-dd), p. ej. con `$(date +%F)`.',
      );
    }
    const rel = (dias: number) => sumarDiasISO(hoy, dias);

    // 1) Limpiar solo las tablas del MVP (dev).
    for (const tabla of [
      "seguimientos",
      "interacciones",
      "ventas",
      "clientes",
      "usuarios",
    ] as const) {
      const filas = await ctx.db.query(tabla).collect();
      await Promise.all(filas.map((f) => ctx.db.delete(f._id)));
    }

    // 2) Usuarios (login mock: cualquier contraseña).
    const marta = await ctx.db.insert("usuarios", {
      nombre: "Marta Ruiz",
      email: "marta@acme.es",
      rol: "propietaria",
    });
    const carlos = await ctx.db.insert("usuarios", {
      nombre: "Carlos Díaz",
      email: "carlos@betadigital.com",
      rol: "comercial",
    });

    // 3) Clientes con estados variados.
    const ana = await ctx.db.insert("clientes", {
      nombre: "Ana López",
      empresa: "Estudio Aria",
      email: "ana@estudioaria.com",
      telefono: "600 111 222",
      canal: "web",
      estado: "nuevo_lead",
      ultimoContacto: rel(-6),
    });
    const jorge = await ctx.db.insert("clientes", {
      nombre: "Jorge Medina",
      empresa: "Medina & Co",
      email: "jorge@medina.co",
      telefono: "600 333 444",
      canal: "redes",
      estado: "en_negociacion",
      ultimoContacto: rel(-2),
    });
    const lucia = await ctx.db.insert("clientes", {
      nombre: "Lucía Fernández",
      telefono: "600 555 666",
      canal: "whatsapp",
      estado: "pendiente",
      ultimoContacto: rel(-1),
    });
    const carmen = await ctx.db.insert("clientes", {
      nombre: "Carmen Ortega",
      empresa: "Ortega Diseño",
      email: "carmen@ortega.es",
      canal: "email",
      estado: "en_negociacion",
      ultimoContacto: rel(-3),
    });
    const rosa = await ctx.db.insert("clientes", {
      nombre: "Rosa Bahía",
      empresa: "Tienda Bahía",
      email: "rosa@tiendabahia.com",
      telefono: "600 777 888",
      canal: "web",
      estado: "ganado",
      ultimoContacto: rel(-10),
    });
    const diego = await ctx.db.insert("clientes", {
      nombre: "Diego Santos",
      telefono: "600 999 000",
      canal: "redes",
      estado: "perdido",
      ultimoContacto: rel(-20),
    });

    // 4) Seguimientos: atrasados / para hoy / próximos, repartidos entre responsables.
    const seguimientos: Array<{
      clienteId: Id<"clientes">;
      accion: string;
      vence: string;
      hecho: boolean;
      fechaHecho?: string;
      responsableId: Id<"usuarios">;
    }> = [
      // Atrasados
      { clienteId: ana, accion: "Llamar para presentar la propuesta", vence: rel(-2), hecho: false, responsableId: carlos },
      { clienteId: jorge, accion: "Enviar presupuesto revisado", vence: rel(-1), hecho: false, responsableId: carlos },
      // Para hoy
      { clienteId: lucia, accion: "Confirmar la cita de mañana", vence: rel(0), hecho: false, responsableId: carlos },
      { clienteId: carmen, accion: "Llamada de seguimiento", vence: rel(0), hecho: false, responsableId: marta },
      // Próximas
      { clienteId: diego, accion: "Reactivar el contacto tras 3 semanas", vence: rel(1), hecho: false, responsableId: carlos },
      { clienteId: rosa, accion: "Preparar la renovación anual", vence: rel(3), hecho: false, responsableId: marta },
      { clienteId: ana, accion: "Enviar el contrato para firma", vence: rel(7), hecho: false, responsableId: carlos },
      // Completado (no debe aparecer en Hoy)
      { clienteId: jorge, accion: "Hacer la demo del producto", vence: rel(-5), hecho: true, fechaHecho: rel(-5), responsableId: carlos },
    ];
    await Promise.all(
      seguimientos.map((s) => ctx.db.insert("seguimientos", s)),
    );

    // 5) Interacciones: historial de ejemplo para un par de clientes.
    const interacciones: Array<{
      clienteId: Id<"clientes">;
      tipo: "llamada" | "email" | "whatsapp" | "en_persona";
      texto: string;
      fecha: string;
      autorId: Id<"usuarios">;
    }> = [
      { clienteId: jorge, tipo: "llamada", texto: "Primer contacto: interesado en el plan anual. Pide propuesta por email.", fecha: rel(-9), autorId: carlos },
      { clienteId: jorge, tipo: "email", texto: "Enviada la propuesta con dos opciones de precio.", fecha: rel(-5), autorId: carlos },
      { clienteId: jorge, tipo: "whatsapp", texto: "Confirma que la revisa esta semana; le encaja la opción B.", fecha: rel(-2), autorId: carlos },
      { clienteId: ana, tipo: "en_persona", texto: "Reunión en su estudio: necesita cerrar antes de fin de mes.", fecha: rel(-6), autorId: marta },
    ];
    await Promise.all(
      interacciones.map((i) => ctx.db.insert("interacciones", i)),
    );

    // 6) Ventas y oportunidades: repartidas entre estados y clientes (para la sección
    // Ventas y el historial de la ficha).
    const ventas: Array<{
      clienteId: Id<"clientes">;
      concepto: string;
      importe: number;
      estado: "abierta" | "ganada" | "perdida";
      fecha: string;
      autorId: Id<"usuarios">;
    }> = [
      { clienteId: rosa, concepto: "Licencia anual Enterprise", importe: 21000, estado: "ganada", fecha: rel(-10), autorId: marta },
      { clienteId: jorge, concepto: "Plan anual (opción B)", importe: 4800, estado: "abierta", fecha: rel(-2), autorId: carlos },
      { clienteId: carmen, concepto: "Servicio de configuración inicial", importe: 1200, estado: "abierta", fecha: rel(-4), autorId: marta },
      { clienteId: rosa, concepto: "Formación del equipo", importe: 1500, estado: "ganada", fecha: rel(-8), autorId: carlos },
      { clienteId: diego, concepto: "Propuesta renovación", importe: 3600, estado: "perdida", fecha: rel(-20), autorId: carlos },
    ];
    await Promise.all(ventas.map((v) => ctx.db.insert("ventas", v)));

    return {
      usuarios: 2,
      clientes: 6,
      seguimientos: seguimientos.length,
      interacciones: interacciones.length,
      ventas: ventas.length,
    };
  },
});
