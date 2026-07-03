import { PantallaPendiente } from "@/components/ui/PantallaPendiente";

// Pantalla inicial de la app tras el login.
export default function HoyPage() {
  return (
    <PantallaPendiente
      titulo="Tareas del día"
      tarea="MOI-40 (+ MOI-39 overlays, MOI-41 dormidos)"
      referencia='design/.../README.md → "2. Tareas del día — Hoy"'
    />
  );
}
