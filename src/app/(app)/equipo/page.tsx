import { PantallaPendiente } from "@/components/ui/PantallaPendiente";

// Solo visible/accesible para el rol "propietaria" (Dueña).
export default function EquipoPage() {
  return (
    <PantallaPendiente
      titulo="Equipo"
      tarea="MOI-81 (gestión de usuarios, solo Dueña)"
      referencia='design/.../README.md → "11. Gestión de usuarios"'
    />
  );
}
