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

- **Next.js 16** (App Router, TypeScript) + **Tailwind CSS v4** (tokens del design system en `src/app/globals.css`)
- **Convex** — base de datos y backend reactivo (`convex/schema.ts`: clientes, interacciones, seguimientos, ventas, usuarios)
- **Lucide** — iconos (trazo 1.5px)
- **Node** >= 20.9 (el repo fija **22** en `.nvmrc`)
- Deploy: **GitHub → Railway** (Convex se hospeda aparte)

## Desarrollo

```bash
npm install

# 1) Backend Convex: crea/conecta el deployment de desarrollo y escribe .env.local
#    (NEXT_PUBLIC_CONVEX_URL y CONVEX_DEPLOYMENT). Copia .env.example si hace falta.
npx convex dev            # deja el proceso vivo, o usa `npx convex dev --once`

# 2) Datos de ejemplo (solo desarrollo, destructivo, protegido):
npx convex env set SEED_ENABLED true
npx convex run seed:run "{\"confirm\":\"SEED_DEV\",\"hoy\":\"$(date +%F)\"}"

# 3) App
npm run dev               # http://localhost:3000  (abre en /hoy)
```

En **PowerShell** (Windows), el seed del paso 2 es:

```powershell
npx convex env set SEED_ENABLED true
$h = Get-Date -Format yyyy-MM-dd
npx convex run seed:run "{`"confirm`":`"SEED_DEV`",`"hoy`":`"$h`"}"
```

> La app **necesita Convex** (las pantallas usan `useQuery`): si falta
> `NEXT_PUBLIC_CONVEX_URL` se muestra un aviso en vez de arrancar.
> El seed borra e inserta las tablas del MVP; el arg `hoy` es tu fecha **local**
> (`$(date +%F)`) para que los grupos Atrasado/Hoy/Próximo cuadren con tu zona horaria.

**Login de prueba (mock):** `marta@acme.es` (Dueña) o `carlos@betadigital.com` (comercial),
cualquier contraseña. Sin pantalla de login todavía (MOI-80): la app arranca con Carlos.

## Scripts

| Script          | Acción                             |
| --------------- | ---------------------------------- |
| `npm run dev`   | Servidor de desarrollo (Turbopack) |
| `npm run build` | Build de producción                |
| `npm run start` | Sirve el build de producción       |
| `npm run lint`  | ESLint                             |

## Rutas (diseño final)

| Ruta | Pantalla | Linear | Estado |
|---|---|---|---|
| `/login` | Inicio de sesión | MOI-80 | placeholder |
| `/hoy` | Tareas del día (pantalla inicial) | MOI-40 | **implementada** |
| `/clientes` | Lista de clientes con buscador | MOI-35 | placeholder |
| `/clientes/[id]` | Ficha de cliente (nodo central) | MOI-36/37/38/39 | placeholder |
| `/ventas` | Ventas y oportunidades | MOI-42/43 | placeholder |
| `/equipo` | Gestión de usuarios (solo Dueña) | MOI-81 | placeholder |
| `/cuenta` | Perfil / Mi cuenta | MOI-82 | placeholder |

Navegación (shell responsive, tab bar móvil / sidebar escritorio) y "Tareas del día"
con datos reales de Convex ya están implementadas (**MOI-33 + MOI-40**). Los formularios
no son rutas: son overlays (pendientes: MOI-39/37/43/34).

## Estructura

```
convex/            backend: schema + queries/mutations (seguimientos, usuarios) + seed
design/            diseño: design system, prototipo hifi y handoff (referencia, NO es código de la app)
public/            estáticos + manifest PWA
src/app/           rutas (App Router): login, (app)/hoy|clientes|ventas|equipo|cuenta
src/components/    shell/ (navegación) · ui/ (design system) · providers/
src/lib/           helpers (fecha, estados, sesión mock) + auth.ts (interfaz del proveedor de auth)
```

## Deploy en Railway (conectado a GitHub)

Railway despliega automáticamente cada push a `main`. La configuración está versionada en
[`railway.json`](./railway.json):

- **Build:** `npm run build` · **Start:** `npm run start` (Next escucha en `$PORT`) ·
  **Node:** 20.9+ (`.nvmrc` / `engines`).

**Modo actual — apuntar a un backend de Convex ya desplegado (sin secreto):**
La variable `NEXT_PUBLIC_CONVEX_URL` del servicio de Railway apunta a un deployment de Convex
(p. ej. el de desarrollo `grateful-grouse-386`). Railway solo construye la app Next; las
funciones de Convex se despliegan aparte con `npx convex deploy` cuando cambien.

**Upgrade a deploy de Convex automatizado en producción:**
1. Crea una **Production deploy key** en Convex (Settings → Deploy keys).
2. En Railway añade `CONVEX_DEPLOY_KEY` = esa key (y quita el `NEXT_PUBLIC_CONVEX_URL` manual).
3. Cambia `buildCommand` en `railway.json` a `npx convex deploy --cmd 'npm run build'`.
   Así cada deploy despliega Convex a producción e inyecta la URL automáticamente.

**Datos en producción:** como no hay login todavía (MOI-80), la app usa el usuario por
defecto `carlos@betadigital.com`, que debe existir en la BD de producción. Para una demo,
siembra producción una vez (recuerda: el seed **borra** las tablas del MVP):

```bash
npx convex env set SEED_ENABLED true --prod
npx convex run seed:run "{\"confirm\":\"SEED_DEV\",\"hoy\":\"$(date +%F)\"}" --prod
```
