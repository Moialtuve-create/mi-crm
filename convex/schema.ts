import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Modelo de datos del MVP — 5 entidades (Linear MOI-32).
 * Fuente: PRD (Notion → Datos) y design/.../README.md → "State Management".
 * Valores acotados tomados del prototipo CRM Shell.dc.html.
 */

export const estadoCliente = v.union(
  v.literal("nuevo_lead"),
  v.literal("en_negociacion"),
  v.literal("pendiente"),
  v.literal("ganado"),
  v.literal("perdido"),
);

export const canalOrigen = v.union(
  v.literal("web"),
  v.literal("redes"),
  v.literal("email"),
  v.literal("whatsapp"),
);

export const tipoInteraccion = v.union(
  v.literal("llamada"),
  v.literal("email"),
  v.literal("whatsapp"),
  v.literal("en_persona"),
);

export const estadoVenta = v.union(
  v.literal("abierta"),
  v.literal("ganada"),
  v.literal("perdida"),
);

export const rolUsuario = v.union(
  v.literal("propietaria"), // Dueña
  v.literal("comercial"), // Atiende y vende
);

export default defineSchema({
  clientes: defineTable({
    nombre: v.string(), // obligatorio
    empresa: v.optional(v.string()),
    telefono: v.optional(v.string()), // al menos teléfono o email (validar en la mutación)
    email: v.optional(v.string()),
    canal: v.optional(canalOrigen),
    estado: estadoCliente, // al crear: "nuevo_lead"
    nota: v.optional(v.string()),
    ultimoContacto: v.optional(v.string()), // ISO yyyy-mm-dd; se actualiza al registrar interacciones
    // Fecha de registro: _creationTime (automática en Convex)
  })
    .index("by_estado", ["estado"])
    .index("by_nombre", ["nombre"]),

  interacciones: defineTable({
    clienteId: v.id("clientes"),
    tipo: tipoInteraccion,
    texto: v.string(),
    fecha: v.string(), // ISO yyyy-mm-dd (por defecto hoy)
    autorId: v.id("usuarios"), // automático = usuario en sesión
  }).index("by_cliente", ["clienteId"]),

  seguimientos: defineTable({
    clienteId: v.id("clientes"),
    accion: v.string(), // qué hay que hacer
    vence: v.string(), // ISO yyyy-mm-dd
    hecho: v.boolean(),
    fechaHecho: v.optional(v.string()),
    responsableId: v.id("usuarios"), // por defecto, el usuario en sesión
  })
    .index("by_cliente", ["clienteId"])
    .index("by_hecho_vence", ["hecho", "vence"]),

  ventas: defineTable({
    clienteId: v.id("clientes"),
    concepto: v.string(), // qué se vende (requerido)
    importe: v.number(), // USD, > 0
    estado: estadoVenta, // por defecto "abierta"
    fecha: v.string(), // ISO yyyy-mm-dd
    autorId: v.id("usuarios"),
  })
    .index("by_cliente", ["clienteId"])
    .index("by_estado", ["estado"]),

  usuarios: defineTable({
    nombre: v.string(),
    email: v.string(),
    rol: rolUsuario,
    // Credenciales: gestionadas por el proveedor de auth (punto de integración,
    // ver src/lib/auth.ts y Linear MOI-80 / MOI-55). No guardar contraseñas en claro.
  }).index("by_email", ["email"]),
});
