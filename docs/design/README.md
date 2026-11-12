# Tokens de diseño · ServiGest

Fuente de verdad: las variables de Figma (colecciones Paleta, Rol, Espaciado, Radios, Icono, Tamaños, Movimiento y Capas y breakpoints, más los estilos de efecto Sombra/Popover, Sombra/Modal y Foco/Anillo). Cada variable tiene su nombre CSS en "code syntax Web".

| Archivo | Para qué sirve |
|---|---|
| `tokens.css` | Variables CSS listas para usar (tema claro, oscuro y roles) |
| `design-system.md` | Descripción del sistema: tokens, componentes, pantallas |
| `usage-rules.md` | Reglas de uso: qué hacer y qué evitar |
| `tokens.json` | Los mismos tokens en formato W3C Design Tokens, para Style Dictionary o Tokens Studio |
| `build_json.py` | Regenera `tokens.json` desde `tokens.css` |

## Uso

```html
<html data-theme="dark" data-role="tecnico">
```

- `data-theme`: `light` o `dark`. Sin el atributo se sigue la preferencia del sistema.
- `data-role`: `admin`, `tecnico` o `cliente`. Define `--color-accent`, `--color-accent-soft` y `--color-accent-ink`. Puede ir en `<html>` o en un contenedor.

```css
.boton-principal {
  background: var(--color-accent);
  color: var(--color-accent-ink);   /* no uses blanco: en oscuro el acento es claro */
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-lg);
  font: var(--text-cuerpo-medio-weight) var(--text-cuerpo-medio-size) var(--font-family);
}
```

## Reglas

- Sin colores fijos en los componentes: rompen el modo oscuro.
- Fondos suaves (`--color-*-soft`) con texto `--color-text` o el color del estado, nunca el color del rol.
- Estados: `--color-success`, `--color-warning`, `--color-danger`. La prioridad usa barras; solo Crítica lleva color.

## Tailwind (opcional)

```js
// tailwind.config.js
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)', surface: 'var(--color-surface)', border: 'var(--color-border)',
        text: 'var(--color-text)', muted: 'var(--color-text-muted)',
        accent: 'var(--color-accent)', 'accent-soft': 'var(--color-accent-soft)', 'accent-ink': 'var(--color-accent-ink)',
        success: 'var(--color-success)', warning: 'var(--color-warning)', danger: 'var(--color-danger)',
      },
      borderRadius: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)', xl: 'var(--radius-xl)' },
    },
  },
}
```

## Actualizar desde Figma

1. Cambia el valor en la variable de Figma (modo "Empresarial AA" o "Empresarial AA · Oscuro").
2. Vuelve a exportar `tokens.css` y corre `python3 build_json.py tokens.css tokens.json`.
3. La página "DS · Tokens (código)" del archivo muestra cada token con su variable CSS y sus valores claro y oscuro.
