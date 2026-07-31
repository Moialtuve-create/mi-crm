import type { Tono } from "@/components/ui/Badge";

/** Rol de usuario (espejo de `rolUsuario` en convex/schema.ts). */
export type RolUsuario = "propietaria" | "comercial";

/** Etiqueta y tono de cada rol (design.md §8, etiquetas exactas del prototipo). */
export const ROL_META: Record<RolUsuario, { label: string; tono: Tono }> = {
  propietaria: { label: "Dueña", tono: "primary" },
  comercial: { label: "Atiende y vende", tono: "neutral" },
};

export const ROL_OPCIONES: { value: RolUsuario; label: string }[] = [
  { value: "propietaria", label: "Dueña" },
  { value: "comercial", label: "Atiende y vende" },
];
