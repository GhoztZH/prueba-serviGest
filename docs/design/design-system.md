# ServiGest · Sistema de diseño

Sistema de diseño de **ServiGest Ecuador** (gestión de solicitudes de servicio técnico · Universidad de Guayaquil, DAWA P1 2026).
Fuente de verdad: el archivo de Figma `ServiGest` (https://www.figma.com/design/u4dt3r4s9aE00UUu3JGj5A). Este documento describe lo que hay en ese archivo; si Figma cambia, se actualiza este documento.

Los valores de ejemplo (nombres, códigos de solicitud, sedes) de las pantallas son datos ficticios.

---

## 1. Principios

1. **Un solo sistema, cuatro roles.** Administrador, Coordinador, Técnico y Cliente comparten componentes y estructura; solo cambia el color de identidad del rol.
   - **Administrador (el sistema):** CRUD de usuarios, técnicos, clientes y sedes, catálogos, parámetros y auditoría; reportes globales.
   - **Coordinador (la operación):** recibe, prioriza, aprueba, asigna y reasigna solicitudes y les da seguimiento. No crea ni edita datos maestros (solo los consulta).
2. **El color tiene un trabajo.** El color del rol identifica quién usa la pantalla; el color de estado (verde, ámbar, rojo) solo marca estados y excepciones. Nada decorativo.
3. **Notificaciones en un solo lugar.** Únicamente la campana de la barra superior; no hay opción "Notificaciones" duplicada en el menú lateral.
4. **Prioridad por barras.** Los niveles de prioridad se leen por el número de barras; solo "Crítica" lleva color.
5. **Tablas sobrias.** Encabezado sin borde, código en gris, título como texto principal, acciones como enlaces subrayados.
6. **Accesible por defecto.** Texto ≥ 4.5:1 y controles ≥ 3:1 de contraste, en claro y oscuro.
7. **Metáforas de icono ligadas a la función** (campana = notificaciones, gráfico de barras = dashboard, engranaje = configuración, etc.).

---

## 2. Cómo se aplican tema y rol

```html
<html data-theme="light|dark" data-role="admin|coordinador|tecnico|cliente">
```

| Eje | Figma | Código |
|---|---|---|
| Tema | Colección **Paleta**, modo `Empresarial AA` (claro) o `Empresarial AA · Oscuro` | `data-theme` |
| Rol | Colección **Rol**, modos `Administrador`, `Técnico`, `Cliente`, `Coordinador` | `data-role` |

Los modos `Triádica`, `Corporativa azul` y `Negro y blanco` de Paleta son exploraciones y **no se exportan**.

Las variables `accent`, `accent-soft` y `accent-ink` apuntan (alias) al color del rol activo. Los componentes usan siempre `accent*`, nunca el color de un rol concreto.

---

## 3. Fundamentos (tokens)

Cada variable de Figma tiene su nombre CSS en "code syntax Web". Archivos exportados: `tokens.css`, `tokens.json` (W3C DTCG). Total: 74 variables y 3 estilos de efecto.

### 3.1 Color · neutros y estado

| Figma | CSS | Claro | Oscuro |
|---|---|---|---|
| neutral/bg | `--color-bg` | #F6F7F9 | #0E1116 |
| neutral/surface | `--color-surface` | #FFFFFF | #161A21 |
| neutral/border | `--color-border` | #E2E5EA | #2B313C |
| neutral/text | `--color-text` | #171A21 | #ECEFF4 |
| neutral/muted | `--color-text-muted` | #586273 | #9BA4B3 |
| neutral/text-disabled | `--color-text-disabled` | #9AA3B2 | #596273 |
| neutral/wire | `--color-fill-subtle` | #ECEEF2 | #1E232C |
| neutral/wire-dark | `--color-control-border` | #8B93A1 | #667085 |
| neutral/overlay | `--color-overlay` | rgba(23,26,33,0.5) | rgba(0,0,0,0.6) |
| status/ok | `--color-success` | #146C43 | #4CC38A |
| status/warn | `--color-warning` | #8A5300 | #E5B04D |
| status/err | `--color-danger` | #B42318 | #F47C72 |
| status/ok-soft | `--color-success-soft` | #E0F4E8 | #12281F |
| status/warn-soft | `--color-warning-soft` | #FDF0D5 | #2E2410 |
| status/err-soft | `--color-danger-soft` | #FDE5E2 | #3B1816 |

### 3.2 Color · roles

| Rol | Base (claro / oscuro) | Soft (claro / oscuro) | Ink (claro / oscuro) |
|---|---|---|---|
| Administrador `rol/admin/*` | #5B3EBF / #A68BF7 | #ECE7FA / #2A2247 | #FFFFFF / #140A2B |
| Técnico `rol/tecnico/*` | #A8480A / #F2915A | #FBEADC / #3B2214 | #FFFFFF / #2A1204 |
| Cliente `rol/cliente/*` | #0C7A56 / #3FC596 | #DCF2E9 / #11302A | #FFFFFF / #04201A |
| Coordinador `rol/coordinador/*` | #1F5FB8 / #7AAAF2 | #E3ECF9 / #172540 | #FFFFFF / #071A38 |

CSS: `--color-role-{admin|coordinador|tecnico|cliente}`, `-soft`, `-ink`. Rol activo: `--color-accent`, `--color-accent-soft`, `--color-accent-ink`.

`ink` es el color del texto o icono **sobre** el color base (en oscuro el base es claro, por eso `ink` es oscuro).

**Por qué azul para el Coordinador:** los tonos de los roles quedan repartidos en el círculo cromático (naranja ~25°, verde ~160°, azul ~215°, violeta ~255°), con la misma claridad y saturación media que los demás, y lejos del rojo de error y del ámbar de alerta. Contraste medido: blanco sobre #1F5FB8 = 6.2:1; #7AAAF2 sobre la superficie oscura = 7.4:1; `ink` sobre la base oscura = 7.3:1.

### 3.3 Iconos

La variable `icon/color` tiene cuatro modos que sustituyen a cuatro alias CSS:

| Modo | CSS |
|---|---|
| Tenue | `--icon-muted` → `--color-text-muted` |
| Acento | `--icon-accent` → `--color-accent` |
| Tinta | `--icon-on-accent` → `--color-accent-ink` |
| Texto | `--icon-text` → `--color-text` |

### 3.4 Espaciado y radios

| Espaciado | Valor | | Radio | Valor |
|---|---|---|---|---|
| `--space-xs` | 4 px | | `--radius-sm` | 6 px |
| `--space-sm` | 8 px | | `--radius-md` | 8 px |
| `--space-md` | 12 px | | `--radius-lg` | 12 px |
| `--space-lg` | 16 px | | `--radius-xl` | 16 px |
| `--space-xl` | 24 px | | `--radius-full` | 9999 px |
| `--space-2xl` | 32 px | | | |

### 3.5 Tamaños y bordes

| Figma | CSS | Valor |
|---|---|---|
| size/control/sm · md · lg | `--size-control-sm · md · lg` | 32 · 36 · 44 px |
| size/icon/sm · md · lg | `--size-icon-sm · md · lg` | 16 · 18 · 24 px |
| size/avatar/s · m · l · xl | `--size-avatar-s · m · l · xl` | 24 · 32 · 48 · 72 px |
| size/sidebar | `--size-sidebar` | 240 px |
| size/topbar | `--size-topbar` | 64 px |
| size/table-header · table-row | `--size-table-header · -row` | 36 · 44 px |
| border/default · strong | `--border-width · -strong` | 1 · 2 px |

### 3.6 Movimiento

| Figma | CSS | Valor |
|---|---|---|
| duration/fast · base · slow | `--duration-fast · base · slow` | 120 · 200 · 320 ms |
| easing/standard | `--easing-standard` | cubic-bezier(0.2, 0, 0, 1) |
| easing/enter | `--easing-enter` | cubic-bezier(0, 0, 0, 1) |
| easing/exit | `--easing-exit` | cubic-bezier(0.3, 0, 1, 1) |

### 3.7 Capas, breakpoints y opacidad

| Figma | CSS | Valor |
|---|---|---|
| z/dropdown · sticky · overlay · modal · toast | `--z-dropdown · sticky · overlay · modal · toast` | 1000 · 1100 · 1200 · 1300 · 1400 |
| breakpoint/sm · md · lg · xl | `--breakpoint-sm · md · lg · xl` | 640 · 1024 · 1280 · 1536 px |
| opacity/disabled | `--opacity-disabled` | 0.4 |

Nota: las media queries de CSS no aceptan `var()`; usa los valores de breakpoint directamente o desde `tokens.json`.

### 3.8 Sombras y foco (estilos de efecto)

| Figma | CSS | Valor |
|---|---|---|
| Sombra/Popover | `--shadow-popover` | 0 8px 24px rgba(0,0,0,.14) |
| Sombra/Modal | `--shadow-modal` | 0 16px 48px rgba(0,0,0,.24) |
| Foco/Anillo | `--focus-ring` | 0 0 0 3px var(--color-accent) |

### 3.9 Tipografía (Inter)

| Estilo de texto | Tamaño | Peso | CSS (prefijo) |
|---|---|---|---|
| Título/Página | 22 | Bold 700 | `--text-titulo-pagina-*` |
| Título/Sección | 18 | Bold 700 | `--text-titulo-seccion-*` |
| Título/Tarjeta | 14 | Semi Bold 600 | `--text-titulo-tarjeta-*` |
| Cuerpo/Normal | 13 | Regular 400 | `--text-cuerpo-normal-*` |
| Cuerpo/Medio | 13 | Medium 500 | `--text-cuerpo-medio-*` |
| Etiqueta | 12 | Medium 500 | `--text-etiqueta-*` |
| Nota | 12 | Regular 400 | `--text-nota-*` |
| Sobretítulo | 11 | Semi Bold 600 | `--text-sobretitulo-*` |
| Cifra/Grande | 28 | Bold 700 | `--text-cifra-grande-*` |

Cada prefijo tiene `-size`, `-weight` y `-line`. El interlineado está en `normal` (automático en Figma); no hay tokens numéricos de interlineado. Familia: `--font-family`.

---

## 4. Componentes (Atomic Design)

Páginas de Figma: `DS · Fundamentos`, `DS · Átomos`, `DS · Células`, `DS · Organismos`, `DS · Plantillas`, `DS · Tokens (código)`.

### 4.1 Átomos

| Componente | Variantes y propiedades |
|---|---|
| Icono / Icono adicional | Biblioteca de iconos (incl. `configuracion`, `carga` (barras de carga), chevron, marcar, ubicación, usuario-más, editar, opciones, cerrar, filtro, asignar, info, exportar, correo). Color por `icon/color`. |
| Botón | Tipo: Primary · Secondary · Ghost. Propiedad: Label. |
| Badge | Tono: Neutro · Rol · Ok · Alerta · Error. |
| Campo de texto (v1) | Reemplazado por **Campo**; se conserva solo por compatibilidad. |
| Campo (v2) | Tipo: Vacío · Lleno · Selector · Error. Propiedades: Etiqueta, Valor, Mensaje. |
| Avatar | Tamaño: S · M · L · XL. Muestra un icono de persona sobre el color del rol. |
| Interruptor | Estado: Activo · Inactivo. |
| Barra de progreso | — |
| Pestaña | — |
| Prioridad | Nivel: Baja · Media · Alta · Crítica (barras). |
| Campana | Pendientes (contador); Estado: Normal · Activa. |

### 4.2 Células

| Componente | Variantes y propiedades |
|---|---|
| Item de navegación | Label, Icono (swap), Estado: Activo · Normal. |
| Tarjeta KPI | Indicador con cifra grande. |
| Campo de búsqueda · Filtro | — |
| Aviso | Tono: Alerta · Error · Correcto. |
| Notificación (v1) · Fila de notificación | La fila es la vigente. |
| Paso de historial · Paso de estado | Líneas de tiempo de solicitudes. |
| Persona | Avatar + nombre + dato secundario. |
| **Fila de ajuste** | Control: Interruptor · Selector. Propiedades: Título, Descripción, Valor. |
| **Opción de tema** | Tema: Claro · Oscuro · Sistema × Estado: Elegida · Normal. |
| **Fila de carga** | Carga: 0–5 × Disponible: Sí · No (12 variantes). Propiedades: Nombre, Especialidades, Acción. Segmentos en color del rol; ámbar al llegar a 5; gris si está en pausa. |

### 4.3 Organismos

| Componente | Notas |
|---|---|
| Barra lateral (vigente) | Rol: Administrador · Técnico · Cliente · Coordinador. Menús por rol (ver 5.1). |
| Barra superior (vigente) | Propiedad Ruta (miga de pan); incluye Campana y Avatar. |
| Panel de la campana | Panel rápido de notificaciones; usa Sombra/Popover. |
| Encabezado de página | Título, subtítulo, acción opcional. |
| Fila de indicadores · Tabla de datos · Indicador de estado · Grupo de pestañas · Barra de filtros · Tarjeta · Formulario lateral · Historial de solicitud · Notificaciones recientes | Bloques de pantalla reutilizables. |
| Barra lateral (v1) · Barra superior (v1) | Obsoletas; no usar en pantallas nuevas. |

### 4.4 Plantillas

Cuatro plantillas (`DS · Plantillas`) construidas sobre la estructura vigente: barra lateral + barra superior + área de contenido de 1280×800.

---

## 5. Pantallas

Página `Wireframes v2 · Consolidado` (claro) y `Wireframes v2 · Oscuro` (mismas pantallas con el modo oscuro). Total: **33 pantallas**. Cada pantalla trae una tarjeta de anotaciones con arquitectura de la información, principios Gestalt y heurísticas de Nielsen.

### 5.1 Menú lateral por rol

| Rol | Secciones |
|---|---|
| Administrador | SEGUIMIENTO: Reportes, Solicitudes (consulta) · ADMINISTRACIÓN: Usuarios y técnicos, Clientes y sedes, Catálogos, Parámetros, Auditoría · CUENTA: Mi perfil, Configuración |
| Coordinador | OPERACIÓN: Dashboard, Solicitudes, Carga del equipo · CONSULTA: Técnicos, Clientes y sedes · CUENTA: Mi perfil, Configuración |
| Técnico | MI TRABAJO: Mi panel, Mis solicitudes · CUENTA: Mi perfil, Disponibilidad, Configuración |
| Cliente | MIS SOLICITUDES: Mis solicitudes, Nueva solicitud · CUENTA: Mi perfil, Ayuda, Configuración |

### 5.2 Inventario

| Código | Pantalla | Rol |
|---|---|---|
| A1 | Reportes globales (cumplimiento, tiempos, datos maestros) | Administrador |
| A2 | Solicitudes · solo consulta y auditoría | Administrador |
| A3 | Mi perfil | Administrador |
| A4 | Usuarios | Administrador |
| A5 | Técnicos | Administrador |
| A6 | Nuevo usuario | Administrador |
| A7 | Clientes y sedes | Administrador |
| A8 | Nuevo cliente | Administrador |
| A9 | Catálogos | Administrador |
| A10 | Notificaciones (seguridad, cambios, reportes) | Administrador |
| A11 | Configuración | Administrador |
| CO1 | Dashboard operativo | Coordinador |
| CO2 | Bandeja de solicitudes | Coordinador |
| CO3 | Revisar y asignar (antes A3) | Coordinador |
| CO4 | Carga del equipo (nueva) | Coordinador |
| CO5 | Técnicos · consulta | Coordinador |
| CO6 | Clientes y sedes · consulta | Coordinador |
| CO7 | Notificaciones (operativas) | Coordinador |
| CO8 | Mi perfil | Coordinador |
| CO9 | Configuración | Coordinador |
| T1 | Mi panel | Técnico |
| T2–T4 | Flujo de solicitudes del técnico | Técnico |
| T5 | Mi perfil | Técnico |
| T6 | Configuración | Técnico |
| C1 | Mis solicitudes | Cliente |
| C2–C4 | Flujo de solicitudes del cliente (incl. detalle y Nueva solicitud) | Cliente |
| C5 | Mi perfil | Cliente |
| C6 | Ayuda | Cliente |
| C7 | Configuración | Cliente |

Compartido: panel rápido de la campana (todos los roles).

### 5.3 Pantalla de Configuración (A11 · CO9 · T6 · C7)

Estructura común: encabezado → columna izquierda (**Apariencia** con 3 Opciones de tema, **Preferencias** con Filas de ajuste de tipo Selector, botones *Restablecer valores / Cancelar / Guardar cambios*) y columna derecha (**Qué avisos quiero recibir** y **Cómo los recibo**, con Filas de ajuste de tipo Interruptor).

| Rol | Preferencias específicas | Avisos |
|---|---|---|
| Administrador | Cierre de sesión por inactividad | Accesos fallidos, cambios en catálogos, nuevos clientes y sedes, reporte mensual |
| Coordinador | Página de inicio (Dashboard operativo) | Solicitudes por aprobar, técnico en su límite de carga, solicitudes vencidas, resumen diario |
| Técnico | Página de inicio (Mi panel / Mis solicitudes) | Nueva solicitud asignada, recordatorio antes de vencer, el cliente respondió, resumen diario |
| Cliente | Sede predeterminada (solo sedes registradas) | Cambios de estado, el técnico pide información, solicitud resuelta, recordatorios de respuesta |

Común a los tres: idioma, zona horaria, formato de fecha, aviso por plataforma (siempre activo) y por correo.

---

### 5.4 Reparto Administrador / Coordinador en las pantallas

| Tema | Administrador | Coordinador |
|---|---|---|
| Inicio | A1 Reportes globales (gestión del período) | CO1 Dashboard operativo (cola del día) |
| Solicitudes | A2 consulta: abre en "Todas", acción "Ver" | CO2 bandeja: abre en "Por aprobar", acción "Revisar" |
| Aprobar y asignar | No en la interfaz (permiso de respaldo en la API) | CO3 Revisar y asignar + CO4 Carga del equipo |
| Técnicos, clientes y sedes | Crear, editar, eliminar (A4–A8) | Solo consulta (CO5, CO6): sin botones de edición; la disponibilidad se muestra como etiqueta |
| Catálogos, parámetros, auditoría | Sí (A9) | No (los usa en selectores) |
| Notificaciones | Seguridad, cambios de datos maestros, reportes | Aprobaciones, límites de carga, vencimientos, respuestas |

## 6. Accesibilidad

- Texto normal ≥ 4.5:1 y controles/bordes de control ≥ 3:1, verificados en `Empresarial AA` y `Empresarial AA · Oscuro`.
- Principio: los estados no dependen solo del color; llevan texto, icono o barras.
- `--focus-ring` define el anillo de foco; aún no está aplicado como variante de estado en los componentes de Figma (se aplica en código).
- `--color-text-disabled` es solo para elementos deshabilitados (no exige contraste de texto normal).

## 7. Limitaciones conocidas

- No hay pantalla de **Disponibilidad** del Técnico (está en su menú, pero no está diseñada).
- El Administrador conserva en la API el permiso de aprobar y asignar (por si falta el Coordinador), pero su interfaz es de consulta.
- La exportación a código es manual: cambia la variable en Figma, exporta de nuevo `tokens.css` y corre `python3 build_json.py tokens.css tokens.json`.
- El interlineado es automático (`normal`).
- Los componentes marcados (v1) se conservan solo por historial.
