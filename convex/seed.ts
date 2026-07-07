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
 * Ejecutar (inyecta tu fecha LOCAL con `date +%F` para que los grupos cuadren):
 *   npx convex run seed:run "{\"confirm\":\"SEED_DEV\",\"hoy\":\"$(date +%F)\"}"
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

    return {
      usuarios: 2,
      clientes: 6,
      seguimientos: seguimientos.length,
    };
  },
});
