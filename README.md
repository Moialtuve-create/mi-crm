# Vibe CRM

CRM ligero para un negocio pequeño de productos digitales: organiza clientes y
evita perder ventas por falta de seguimiento. Web responsive (PWA), móvil-primero,
UI en español.

- **PRD / MVP:** Notion → "CRM - PRD"
- **Tareas:** Linear → proyecto **CRM-MVP** (post-MVP: **CRM-RESTOPRD**)
- **Diseño (fuente de verdad visual):** carpeta [`design/`](./design) —
  `design (1).md` (design system y tokens) + prototipo hifi
  `Prototipo del CRM - Claude Design/design_handoff_crm_pwa/CRM Shell.dc.html`
  (abrir en el navegador) + `README.md` del handoff con la especificación de cada pantalla.

## Stack

- **Next.js** (App Router, TypeScript) + **Tailwind CSS v4** (tokens del design system en `src/app/globals.css`)
- **Convex** — base de datos y backend (`convex/schema.ts`: clientes, interacciones, seguimientos, ventas, usuarios)
- **Lucide** — iconos (trazo 1.5px)
- Deploy: **GitHub → Railway**

## Desarrollo

```bash
npm install
npx convex dev     # primera vez: crea el proyecto Convex y escribe .env.local
npm run dev        # http://localhost:3000
```

Sin `NEXT_PUBLIC_CONVEX_URL` la app arranca igualmente (sin backend), para poder
construir pantallas con datos mock. Copia `.env.example` a `.env.local`.

## Rutas (diseño final)

| Ruta | Pantalla | Linear |
|---|---|---|
| `/login` | Inicio de sesión | MOI-80 |
| `/hoy` | Tareas del día (pantalla inicial) | MOI-40 |
| `/clientes` | Lista de clientes con buscador | MOI-35 |
| `/clientes/[id]` | Ficha de cliente (nodo central) | MOI-36/37/38/39 |
| `/ventas` | Ventas y oportunidades | MOI-42/43 |
| `/equipo` | Gestión de usuarios (solo Dueña) | MOI-81 |
| `/cuenta` | Perfil / Mi cuenta | MOI-82 |

Los formularios no son rutas: son overlays (hoja inferior en móvil / modal en
escritorio). Ver `src/components/README.md`.

## Estructura

```
convex/            esquema y funciones de Convex (backend)
design/            diseño: design system, prototipo hifi y handoff (NO tocar; es la referencia)
public/            estáticos + manifest PWA
src/app/           rutas (App Router): login, (app)/hoy|clientes|ventas|equipo|cuenta
src/components/    ui/ · layout/ · overlays/ · providers/
src/lib/           auth.ts (interfaz del proveedor de auth — punto de integración)
```

## Deploy en Railway

1. Sube el repo a GitHub y crea un servicio en Railway desde ese repo
   (detecta Next.js: build `npm run build`, start `npm run start`).
2. Crea el deployment de producción de Convex: `npx convex deploy`.
3. En Railway, añade la variable `NEXT_PUBLIC_CONVEX_URL` con la URL de
   producción de Convex (Convex se hospeda aparte; Railway solo sirve la app Next).
