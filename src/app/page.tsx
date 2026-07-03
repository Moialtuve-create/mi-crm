import { redirect } from "next/navigation";

// La app abre en "Tareas del día" (design handoff: `/` → redirige a /hoy).
export default function Home() {
  redirect("/hoy");
}
