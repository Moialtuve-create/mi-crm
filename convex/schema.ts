import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
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
  ...authTables,

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
    // Credenciales: gestionadas por Convex Auth (provider Password, hash en
    // authAccounts.secret). No guardar contraseñas en claro ni hasheadas aquí.
    // MOI-114 — acceso con Google (Convex Auth). MOI-115: soloGoogle ya NO bloquea el
    // login por contraseña (decisión del owner); se conserva como dato informativo.
    soloGoogle: v.optional(v.boolean()),
    authUserId: v.optional(v.id("users")), // enlace hacia authTables.users
  })
    .index("by_email", ["email"])
    // by_authUserId: el JWT de Convex Auth no trae claim `email` (solo `sub`), así que la
    // identidad autenticada se resuelve por este vínculo. Ver usuarios.getUsuarioAutenticado.
    .index("by_authUserId", ["authUserId"]),

  // MOI-115: throttle propio de la recuperación de contraseña. La librería NO limita la
  // emisión de códigos (solo la verificación, vía authRateLimits) — ver convex/passwordReset.ts.
  authThrottle: defineTable({
    clave: v.string(), // "envio:<email>" | "intento:<email>"
    ventanaInicio: v.number(),
    contador: v.number(),
    ultimo: v.number(),
  }).index("by_clave", ["clave"]),
});
