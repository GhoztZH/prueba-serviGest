# ServiGest Ecuador · Pendientes para terminar el proyecto

Documento de traspaso. Describe **qué está hecho y verificado**, **qué está escrito pero sin verificar** y **qué falta**, en orden de ejecución. Estado al 2026-11-14, rama `implementacion-v1`.

---

## 0. Reglas que se deben respetar

- **No modificar ni borrar** los originales de `docs/` (`docs/api/openapi.yaml`, `docs/database/db-serviGest.sql`, `docs/design/*`, `docs/index.html`). Los cambios van en documentos complementarios.
- Orden de prioridad ante contradicciones: requisitos y reglas de negocio → base de datos → OpenAPI → diseño (Figma/tokens) → decisiones propias.
- Las reglas de negocio viven en el **backend**. El frontend solo muestra lo que el backend calcula (`estado_plazo`, `horas_restantes`, `acciones`).
- Sin colores, tamaños ni espaciados fijos: todo sale de `frontend/src/shared/styles/tokens.css` (copia de `docs/design/tokens.css`; se actualiza con `npm run sync:tokens`).
- Commits pequeños por tema, en español, con comentarios breves en el código que expliquen los flujos.
- No inventar porcentajes de cobertura: medir y reportar valores reales.

## 1. Decisiones ya tomadas (no reabrir)

| Tema | Decisión |
|---|---|
| Tiempo real | **SSE** en `GET /api/eventos` (eventos `notificacion` y `solicitud:actualizada`). El OpenAPI aún dice Socket.IO: documentar la desviación en un complemento + ADR, sin tocar el YAML. |
| Sesión | JWT Bearer (HS256) con `jti`, revocación en `tokens_revocados`, token en `sessionStorage`. SSE por `fetch` en streaming para enviar `Authorization`. |
| Contraseñas | Argon2id (hash de 97 caracteres, cabe en `VARCHAR(100)`). |
| Persistencia | `pg` con SQL parametrizado, sin ORM. Unidad de trabajo con `AsyncLocalStorage` (`backend/src/shared/db/database.ts`). |
| Migraciones | `001` = copia literal del SQL de docs; `002` = catálogos base. Runner idempotente con checksum. Datos demo aparte (`SEED_DEMO=true`). |
| Roles | Datos maestros: solo ADMIN escribe; COORDINADOR consulta (403 al escribir). Operación de solicitudes: ADMIN y COORDINADOR en la API; la **interfaz** del Admin es solo de consulta. |
| Coordinador | Color propio (azul), `data-role="coordinador"`, menú y pantallas CO1–CO9. |
| Reapertura | Solo ADMIN/COORDINADOR, con motivo; vuelve a `EN_PROCESO` si conserva técnico, si no a `APROBADA`; el plazo se reinicia. |
| Reasignación | Deja la solicitud en `ASIGNADA`; motivo obligatorio (≥ 10 caracteres). |
| Duplicados | Solicitud abierta con mismo cliente + sede + categoría + equipo → 409. |
| Cumplimiento | `aTiempo / (aTiempo + resueltas tarde + abiertas vencidas)`. |
| Puerto PostgreSQL | El contenedor publica **5433** en el host (el 5432 lo usa un PostgreSQL local de Windows). |

## 2. Hecho y verificado

### Backend (`backend/`) — completo
- 10 módulos por capas (`domain / application / infrastructure / presentation`): `auth`, `users`, `clients`, `technicians`, `catalogs`, `requests`, `assignments`, `notifications`, `audit`, `dashboard`. Composición en `src/container.ts`.
- **175 pruebas pasan** (77 unitarias + 98 de integración contra PostgreSQL real). Cobertura medida: **93,1 % líneas, 89,7 % sentencias, 76,0 % ramas, 95,3 % funciones**.
- `npx tsc --noEmit` y `npx eslint src tests` sin errores.
- Arranque real probado: migraciones, datos demo, login, listado, dashboard, 403 del Coordinador, técnicos sugeridos.
- Todo commiteado (último commit: `feat(dashboard): cumplimiento de plazos desglosado por prioridad`).

Comandos (desde `backend/`):
```bash
docker compose -f ../docker-compose.yml -f ../docker-compose.dev.yml up -d postgres   # PostgreSQL en localhost:5433
npm run dev          # API en http://localhost:3000 (lee ../.env)
npm test             # unitarias + integración (usa TEST_DATABASE_URL de ../.env)
npm run test:coverage
```
Usuarios demo (contraseña `Servigest2026`): `admin@servigest.ec`, `coordinador@servigest.ec`, `tecnico@servigest.ec`, `cliente@servigest.ec`.

### Infraestructura — parcial
- `docker-compose.yml`, `docker-compose.dev.yml`, `.env.example`, `.env` local (no versionado), `backend/Dockerfile`: escritos. **Solo se probó el servicio `postgres`.**

## 3. Frontend: escrito pero SIN compilar ni probar

Todo lo de `frontend/` está **sin commit** y nunca se ejecutó `tsc` ni `vite`. Lo primero es compilarlo y corregir errores.

Versiones instaladas (más nuevas que lo habitual; revisar APIs si algo no compila): React 19, **MUI 9**, **TypeScript 7**, react-router-dom 7, recharts 3, **lucide-react 1.x**, Vite 8, vitest 5.

Archivos ya escritos:
- Configuración: `package.json`, `tsconfig.json`, `vite.config.ts` (proxy `/api` → `localhost:3000`), `index.html`, `scripts/sync-tokens.mjs`.
- `src/shared/`: `types/api.ts`, `http/client.ts`, `http/sse.ts`, `utils/format.ts`, `hooks/hooks.ts`, `styles/app.css`, `styles/tokens.css|json`, `components/atoms.tsx`, `components/layout.tsx`, `components/forms.tsx`, `layouts/AppLayout.tsx`.
- `src/app/`: `theme.ts`, `navigation.ts`, `providers/AuthProvider.tsx`, `AparienciaProvider.tsx`, `AvisosProvider.tsx`, `TiempoRealProvider.tsx`.
- Servicios de todos los módulos (`modules/*/services/*.service.ts`).
- `modules/auth/pages/AccesoPages.tsx` (login, recuperar, restablecer).
- `modules/requests/`: `pages/SolicitudesPage.tsx`, `SolicitudDetallePage.tsx`, `NuevaSolicitudPage.tsx`; `components/Historial.tsx`, `Adjuntos.tsx`, `PanelesRol.tsx`; `hooks/useSolicitud.ts`.
- `modules/assignments/components/PanelDecision.tsx`.
- `modules/dashboard/components/Graficos.tsx`, `pages/DashboardPages.tsx` (CO1, A1 y T1).

Puntos a revisar al compilar:
- Nombres de iconos de `lucide-react` 1.x (`ChartColumn`, `CircleHelp`, `CircleAlert`, `CircleCheck`, `AlertTriangle`, `ListFilter`, `ToggleLeft`…): confirmar que existen.
- `slotProps` de `TextField`/`Select` en MUI 9 (`forms.tsx`, `Graficos.tsx`).
- `Button component={Link}` (tipado de MUI 9).
- `resolveJsonModule` para `tokens.json` en `theme.ts`.
- Falta `src/test-setup.ts` (lo referencia `vite.config.ts`).
- `.oxlintrc.json` sigue siendo el de la plantilla.

## 4. Lo que falta, en orden

### 4.1 Frontend: arranque
1. Crear `src/main.tsx` (importa `@fontsource-variable/inter`, `tokens.css`, `app.css`) y `src/app/App.tsx` con los proveedores en este orden: `AuthProvider` → `AparienciaProvider` → `AvisosProvider` → `TiempoRealProvider` → router.
2. Crear `src/app/routes.tsx`:
   - Públicas: `/login`, `/recuperar`, `/restablecer`.
   - `RutaProtegida`: sin sesión → `/login` (guardando la ruta de origen); rol no permitido → pantalla "Sin acceso".
   - `/` redirige a `INICIO[rol]` (o a `preferencias.paginaInicio` si es válida para el rol).
   - Rutas por rol según `MENU` de `app/navigation.ts`. `/catalogos` y `/parametros` abren la misma pantalla en pestañas distintas. `/notificaciones` para todos.
3. `npx tsc --noEmit` y `npm run build` hasta que no haya errores.

### 4.2 Frontend: pantallas pendientes
Referencia visual: Figma `u4dt3r4s9aE00UUu3JGj5A`, página `42:2`. Capturas ya revisadas: CO1, CO3, CO4, A1, A4, A7, A9, A11, T1, T3, T5, C1, C2, C3 y panel de la campana.

| Pantalla | Archivo sugerido | Rol | Notas |
|---|---|---|---|
| CO4 Carga del equipo (`74:4564`) | `assignments/pages/CargaEquipoPage.tsx` | COORDINADOR | 4 KPI; lista ordenada por carga con `Segmentos` y `DisponibilidadBadge`; aviso si alguien está al límite; "Por asignar" (estado `APROBADA`) con enlace al detalle. |
| CO5 Técnicos consulta (`72:4328`) | `technicians/pages/TecnicosPage.tsx` | COORDINADOR | Solo lectura: sin botones de edición, disponibilidad como badge, acción "Ver". |
| Disponibilidad | `technicians/pages/DisponibilidadPage.tsx` | TECNICO | No está en Figma: `Fila de ajuste` con interruptor + carga actual. |
| A7/A8 y CO6 Clientes y sedes (`42:2587`, `42:2895`, `72:4692`) | `clients/pages/ClientesPage.tsx` | ADMIN edita, COORDINADOR consulta | Tabla + panel derecho con el cliente elegido y sus sedes; formulario de alta con sedes y cuenta opcional; errores 409/422 junto al campo. |
| A4/A5/A6 Usuarios y técnicos (`42:1646`, `42:2045`, `42:2355`) | `users/pages/UsuariosPage.tsx` | ADMIN | Pestañas Usuarios / Técnicos; panel lateral de alta y edición; el rol decide los campos (técnico: cédula, especialidades, carga máxima). |
| A9 Catálogos y parámetros (`42:3104`) | `catalogs/pages/CatalogosPage.tsx` | ADMIN | Pestañas: Especialidades, Categorías, Prioridades y plazos, Parámetros. Mostrar el 409 de eliminación como aviso ("desactívala en lugar de eliminarla"). |
| Auditoría | `audit/pages/AuditoriaPage.tsx` | ADMIN | Tabla paginada con filtro por entidad; mostrar antes/después. |
| A10/CO7/T4/C4 Notificaciones | `notifications/pages/NotificacionesPage.tsx` | todos | Lista paginada, filtro "sin leer", marcar una/todas; se refresca con `version` de `useTiempoReal`. |
| A3/CO8/T5/C5 Mi perfil | `account/pages/PerfilPage.tsx` | todos | Editar nombre (`PATCH /auth/me`), cambiar contraseña; el técnico ve especialidades y carga; el cliente ve empresa y sedes. **No** implementar "Sesiones abiertas" (el modelo no lo soporta). |
| A11/CO9/T6/C7 Configuración | `account/pages/ConfiguracionPage.tsx` | todos | Apariencia (Claro/Oscuro/Sistema) y preferencias locales (`useApariencia`): página de inicio (Coordinador/Técnico), sede predeterminada (Cliente). **No** implementar interruptores de avisos (sin soporte en el modelo); documentarlo. |
| C6 Ayuda (`50:2850`) | `account/pages/AyudaPage.tsx` | CLIENTE | Preguntas frecuentes y guías; contenido estático. |

Ajustes pendientes en lo ya escrito:
- `SolicitudesPage`: aceptar `?tecnico=ID` como filtro `tecnico_id` (lo usa "Ver solicitudes" de CO4).

Diferencias entre Figma y el contrato que **no** se deben "arreglar" en la interfaz (documentarlas):
- C2 dice "Equipo afectado (opcional)", pero la base y el OpenAPI lo exigen → es obligatorio.
- C3 dice "el tiempo no corre" en pendiente de información; el backend no pausa el plazo → mostrar el plazo real.
- Los "vs. período anterior" de los KPI no se calculan → mostrar subtítulos con datos reales.
- Códigos `SG-0142` de Figma son ficticios; el formato real es `SOL-AAAA-NNNNNN`.

### 4.3 Frontend: verificación
1. `npm run dev` con el backend arriba; iniciar sesión con los 4 roles y recorrer cada pantalla.
2. Comparar cada pantalla con Figma: dimensiones, colores, tipografía, espaciado, jerarquía, estados interactivos.
3. Probar tema claro y oscuro, y anchos 375 / 768 / 1280 px.
4. Comprobar estados de carga, error (apagar el backend) y vacío.
5. Comprobar actualización en vivo: dos navegadores con roles distintos; un cambio en uno debe reflejarse en el otro sin recargar.
6. Pruebas unitarias mínimas (`vitest`): `utils/format.ts`, `http/sse.ts` (`interpretar`), `agruparEvolucion`, y la ruta protegida.
7. `npm run lint` (oxlint) sin errores.
8. Commits pequeños: base, layout, acceso, solicitudes, dashboards, administración, cuenta.

### 4.4 Docker completo
1. Crear `frontend/Dockerfile` (build con Node → `nginxinc/nginx-unprivileged`, puerto **8080**) y `frontend/nginx.conf`:
   - `location /api/` → `proxy_pass http://backend:3000`; `client_max_body_size 30m`.
   - `location /api/eventos` con `proxy_buffering off`, `proxy_read_timeout 1h`, `proxy_http_version 1.1`.
   - `location /healthz` que responda 200 (lo usa el healthcheck del compose).
   - `try_files $uri /index.html` para las rutas de React; cabeceras de seguridad (CSP, `X-Content-Type-Options`, `Referrer-Policy`).
2. `docker compose up --build` desde la raíz y verificar: los tres servicios `healthy`, login desde `http://localhost:8080`, SSE a través de nginx, subida y descarga de adjuntos.
3. `docker compose down` y volver a levantar: los datos y los adjuntos deben persistir (volúmenes `pgdata`, `uploads`).
4. Confirmar que `backend/Dockerfile` construye (`argon2` usa binarios precompilados; si falla en la imagen, añadir herramientas de compilación en la etapa de build).

### 4.5 Pruebas end-to-end (`e2e/`, Playwright)
- Flujo 1: registro de solicitud (cliente) → aprobación (coordinador) → asignación → atención (técnico).
- Flujo 2: consulta → seguimiento → resolución (técnico) → cierre (cliente).
- Además: navegación protegida (sin sesión y con rol incorrecto), estados de carga/error/vacío, responsive (móvil), actualización dinámica con dos contextos de navegador.
- Guardar capturas y el reporte HTML como evidencias en `docs/testing/evidencias/`.

### 4.6 Documentación (carpetas nuevas dentro de `docs/`, sin tocar los originales)
- `docs/architecture/arquitectura.md` con diagramas (Mermaid): contexto, módulos y dependencias, capas de un módulo, secuencia de "cambiar estado" y de "asignar", despliegue Docker.
- `docs/adr/`: SSE frente a Socket.IO; JWT y revocación; sin ORM y unidad de trabajo; migraciones; Argon2id; reapertura y reinicio de plazo; fórmula de cumplimiento; roles Admin/Coordinador.
- `docs/api/openapi-complemento.md` (o un YAML versionado aparte): `GET /api/eventos`, `PATCH /api/auth/me`, `GET /api/health`, formas de respuesta `{data, meta}` no definidas en el contrato, campos extra (`porPrioridad[].cumplimiento`, `horas_plazo`, etc.).
- `docs/database/modelo-de-datos.md`: modelo lógico y físico, migraciones `001` y `002`, y la nota sobre la "migración 003" que el SQL cita pero no existe.
- `docs/dashboard-formulas.md`: fórmula y criterio de cada indicador.
- `docs/manuals/`: manual técnico, guía de configuración (`.env`), guía de ejecución con Docker, manual de usuario por rol (Admin, Coordinador, Técnico, Cliente).
- `docs/testing/informe-de-pruebas.md`: resultados reales (175 pruebas backend, cobertura medida, E2E), defectos encontrados y correcciones.
- `README.md` en la raíz: clonar, configurar, ejecutar, probar.
- Registrar las inconsistencias detectadas en los originales (no corregirlas): `openapi.yaml` líneas 34 y 59 (Socket.IO); `docs/index.html` desactualizado; `docs/design/README.md` sin `coordinador`; `usage-rules.md` líneas 14 y 31 y `design-system.md` línea 271 aún dicen "tres" roles.

### 4.7 Cierre
- `npm audit` en `backend/` y `frontend/`: sin vulnerabilidades críticas.
- Verificar que los cuatro roles pueden demostrar sus funciones con los datos demo.
- Revisar que `.env` no esté versionado y que `.env.example` no tenga secretos.

## 5. Limitaciones conocidas (documentarlas, no resolverlas)
- El concentrador SSE vive en memoria: con varias réplicas del backend haría falta un bus compartido.
- Cambiar o restablecer la contraseña no cierra las demás sesiones abiertas (no hay tabla de sesiones).
- El plazo no se pausa en "Pendiente de información".
- No hay envío de correo: el token de restablecimiento se devuelve solo fuera de producción.
- Preferencias de avisos y "sesiones abiertas" de Figma no tienen soporte en el modelo de datos.
