# Componentes

Estructura prevista (según el design system "Vibe CRM", `design/design (1).md` §8
y el README del handoff → "Components"):

- `ui/` — componentes base del design system: `Button` (primary/secondary/ghost/destructive),
  `IconButton`, `Card`, `Metric` (KPI), `ListRow`, `Input`, `Badge` (chip de estado con punto),
  `Avatar` (iniciales), `Skeleton`, `EmptyState`, `Toast`, `SegmentedControl`.
- `layout/` — shell de navegación: `TabBar` (móvil), `Sidebar` (escritorio), cabeceras de página.
- `overlays/` — hoja inferior (móvil) / modal (escritorio) con foco atrapado y cierre Esc/scrim,
  y los formularios: nuevo/editar cliente, nueva tarea, registrar interacción, registrar venta,
  programar seguimiento, añadir/editar usuario, confirmaciones.
- `providers/` — proveedores de contexto (Convex, sesión).

Regla: una sola acción primaria (botón verde) por vista; cifras en mono tabular
alineadas a la derecha (`.tnum`); iconos Lucide 1.5px; sin emoji.
