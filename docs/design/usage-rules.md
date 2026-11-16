# ServiGest · Reglas de uso

Cómo usar el sistema de diseño (ver `design-system.md`) sin romper la consistencia, el modo oscuro ni los roles. Cada regla dice qué hacer, qué evitar y por qué.

---

## 1. Color

1. **Nada de colores fijos.** Usa siempre una variable (`var(--color-*)` en código; variable enlazada en Figma). Un hex fijo se ve bien en claro y falla en oscuro.
2. **Texto sobre el color del rol → `--color-accent-ink`, no blanco.** En oscuro el color base es claro; el blanco pierde contraste.
3. **El color del rol identifica, no decora.** Se usa en: opción activa del menú, botón principal, avatar, controles activos (interruptor, opción elegida). No lo uses para marcar estados.
4. **El color de estado solo para estados.** Verde = correcto, ámbar = alerta, rojo = error o crítico. Nunca para adornar.
5. **Fondos suaves (`*-soft`) llevan texto `--color-text` o el color de su estado**, nunca el color del rol sobre su propio soft si el contraste baja de 4.5:1.
6. **Componentes con `accent*`, no con un rol concreto.** El rol lo define `data-role`; así el mismo componente sirve a los tres.
7. **Deshabilitado:** `--color-text-disabled` + `--opacity-disabled`. No inventes grises.
8. **Fondo oscurecido de modales:** `--color-overlay`.

| Hacer | Evitar |
|---|---|
| `background: var(--color-accent); color: var(--color-accent-ink)` | `background: #5B3EBF; color: #fff` |
| `border: var(--border-width) solid var(--color-border)` | `border: 1px solid #ddd` |
| Badge de tono Ok para "Resuelta" | Badge verde para decorar una categoría |

---

## 2. Roles y temas

- Fija el tema y el rol en el contenedor raíz: `<html data-theme="…" data-role="…">`. Sin `data-theme` se sigue el sistema.
- Cada pantalla pertenece a **un** rol (Administrador, Coordinador, Técnico o Cliente). No mezcles colores de dos roles en una pantalla.
- Un rol nuevo necesita: variables `rol/<rol>/base|soft|ink` con valores para claro y oscuro, un modo en la colección **Rol**, una variante de la Barra lateral y su bloque `[data-role]` en `tokens.css`. Verifica contraste (≥ 4.5:1) antes de aprobar el color y evita tonos cercanos al rojo de error o al ámbar de alerta.
- En Figma, un marco de pantalla lleva dos modos explícitos: **Paleta** (claro/oscuro) y **Rol** (Admin/Técnico/Cliente).
- Prueba cada pantalla nueva en claro y oscuro antes de darla por terminada.

---

## 3. Espaciado, radios y tamaños

- Solo valores de la escala: espaciado 4 · 8 · 12 · 16 · 24 · 32; radios 6 · 8 · 12 · 16 · completo.
- Tarjetas: relleno `--space-lg`, radio `--radius-lg`, borde `--border-width` en `--color-border`.
- Botones y campos usan los tamaños de control (`--size-control-*`); iconos los de `--size-icon-*`; avatares los de `--size-avatar-*`.
- Barra lateral 240 px y barra superior 64 px: no se alteran por pantalla.
- Tablas: encabezado 36 px, fila 44 px.
- Un valor que no está en la escala es una señal para crear un token, no para escribir un número suelto.

---

## 4. Tipografía

- Solo los 9 estilos de texto. No cambies tamaño o peso a mano.
- Un título de página por pantalla (Título/Página); secciones con Título/Sección; tarjetas con Título/Tarjeta.
- Texto de ayuda y descripciones: Nota con `--color-text-muted`.
- Cifras de indicadores: Cifra/Grande.
- Sobretítulo (11, mayúsculas) solo para agrupar el menú y etiquetas de sección.

---

## 5. Componentes

### General
- **Usa instancias, no copias.** Si falta una variante, se agrega al componente, no se dibuja aparte.
- **Los componentes (v1) no se usan en pantallas nuevas** (Campo de texto v1, Barra lateral v1, Barra superior v1, Notificación v1). Usa Campo, Barra lateral vigente, Barra superior vigente y Fila de notificación.
- Cambios de menú, encabezado o barra superior se hacen **en el componente**: se propaga a todas las pantallas.

### Botones
- Un solo **Primary** por vista o bloque de formulario. Acciones secundarias: Secondary; acciones de bajo peso: Ghost.
- Etiquetas con verbo: "Guardar cambios", "Cancelar".
- Orden en formularios: acción de baja prioridad a la izquierda, Cancelar, y Guardar cambios a la derecha.

### Formularios
- Usa **Campo** (v2): Vacío, Lleno, Selector, Error. El error lleva un mensaje que explica qué corregir.
- Datos que viven en la base de datos (sedes, técnicos, catálogos) se eligen con **Selector**, nunca con texto libre.
- Formularios largos en secciones con título; un campo por fila de ajuste cuando es configuración.
- Datos que ya se conocen (por ejemplo, la sede del cliente) se precargan y se permite cambiarlos entre opciones registradas.

### Tablas
- Encabezado sin borde; código/ID en gris; título de la fila como texto principal; acciones como enlaces subrayados.
- Estados con Badge (tono según estado); prioridad con el componente Prioridad (barras).
- Sin bordes verticales ni cebra por defecto.

### Notificaciones
- **Solo en la campana de la barra superior** (más el panel rápido y la pantalla de notificaciones del rol). No agregues "Notificaciones" al menú lateral.
- El contador de la campana usa el color de error y muestra el número de pendientes.

### Prioridad y estados
- Prioridad: barras (Baja a Crítica). Solo **Crítica** lleva color.
- Estado de solicitud: Badge o Indicador de estado; no inventes colores nuevos.

### Avatar
- Siempre con el icono de persona sobre el color del rol; tamaños S, M, L, XL según el contexto (lista, barra, perfil).

### Pantallas de consulta (Coordinador)
- Si el rol no puede editar un dato, **no se muestra** el control (ni deshabilitado): sin "Nuevo", "Editar", "Eliminar" ni "+ Agregar".
- Los estados editables (Interruptor) se muestran como **Badge** en solo lectura (por ejemplo "Disponible" / "En pausa").
- La acción de fila pasa a ser "Ver".
- El subtítulo indica quién edita ese dato ("· los edita el Administrador").

### Carga del equipo
- Usa la célula **Fila de carga**: 5 segmentos = 5 solicitudes activas; color del rol para la carga, ámbar al límite, gris en pausa.
- Ordena de menor a mayor carga para que se vea primero quién puede recibir trabajo.
- El color ámbar de "al límite" se usa igual en el Dashboard operativo y en Revisar y asignar.

### Configuración
- Cada ajuste es una **Fila de ajuste**: título, descripción corta y un solo control (Interruptor o Selector).
- Agrupa por tema en tarjetas: Apariencia, Preferencias, Avisos.
- El aviso por la plataforma es obligatorio y se muestra activo; lo opcional (correo, resúmenes) se puede apagar.
- Siempre ofrecer **Restablecer valores**, Cancelar y Guardar cambios.
- Lo que define a la organización (parámetros, catálogos) **no** va en Configuración: va en la administración.
- Los avisos de cada rol son los de su trabajo: el Coordinador recibe los operativos; el Administrador, los de seguridad, datos maestros y reportes.

### Iconos
- Metáfora ligada a la función: campana = notificaciones, gráfico = dashboard, engranaje = configuración, persona = perfil.
- Color por `icon/color` (Tenue, Acento, Tinta, Texto). Sin iconos decorativos.

---

## 6. Movimiento y capas

- Cambios pequeños (hover, foco): `--duration-fast`; menús y paneles: `--duration-base`; transiciones amplias: `--duration-slow`.
- Aparece → `--easing-enter`; se va → `--easing-exit`; el resto → `--easing-standard`.
- Respeta `prefers-reduced-motion`: reduce o quita las animaciones.
- Apila con la escala `--z-*` (dropdown < sticky < overlay < modal < toast). No uses `z-index` sueltos.
- Sombras solo en elementos que flotan (`--shadow-popover`, `--shadow-modal`); las tarjetas normales no llevan sombra.
- Foco con teclado: `box-shadow: var(--focus-ring)`; no elimines el contorno de foco sin reemplazo.

---

## 7. Accesibilidad

- Texto ≥ 4.5:1 de contraste y bordes de controles ≥ 3:1. Los pares de la paleta ya lo cumplen; no los recombines sin medir.
- Ningún estado depende solo del color.
- Áreas táctiles de controles: al menos `--size-control-sm`.
- Cada control tiene etiqueta visible; los iconos sin texto llevan nombre accesible (`aria-label`).

---

## 8. Nombres y mantenimiento

- Variables de Figma: `grupo/subgrupo/nombre` (por ejemplo `neutral/text`, `size/control/md`). CSS: `--grupo-nombre`.
- Propiedades de componentes: nombre en español, claro y corto (Estado, Tipo, Tono, Nivel).
- Páginas de pantallas: código por rol y número (A = Administrador, CO = Coordinador, T = Técnico, C = Cliente).
- Flujo de cambios en tokens: cambiar la variable en Figma → exportar `tokens.css` → `python3 build_json.py tokens.css tokens.json` → comprobar que claro y oscuro definen los mismos colores y que no hay `var()` sin definir.
- Una pantalla nueva incluye: versión clara y oscura, tarjeta de anotaciones (arquitectura, Gestalt, Nielsen) y el menú lateral correcto de su rol.

---

## 9. Lista rápida antes de entregar una pantalla

- [ ] Todo el color, espaciado, radio y tamaño viene de variables.
- [ ] Se ve bien en claro y oscuro, con el rol correcto.
- [ ] Un solo botón Primary por bloque.
- [ ] Notificaciones solo en la campana.
- [ ] Datos de catálogo con Selector, no texto libre.
- [ ] Tabla con el estilo estándar (sin bordes en el encabezado, enlaces subrayados).
- [ ] Contraste y estados verificados.
- [ ] Menú lateral con el ítem activo correcto.
