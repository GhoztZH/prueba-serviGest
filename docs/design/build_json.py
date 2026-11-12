"""Genera tokens.json (formato W3C Design Tokens) a partir de tokens.css.

Uso: python3 build_json.py tokens.css tokens.json
tokens.css es la fuente: si cambian los valores en Figma, se vuelve a exportar el CSS y se corre este script.
"""
import json
import re
import sys

FIGMA = {
    "bg": "neutral/bg", "surface": "neutral/surface", "border": "neutral/border",
    "text": "neutral/text", "text-muted": "neutral/muted", "fill-subtle": "neutral/wire",
    "control-border": "neutral/wire-dark", "text-disabled": "neutral/text-disabled", "overlay": "neutral/overlay", "success": "status/ok", "warning": "status/warn",
    "danger": "status/err", "success-soft": "status/ok-soft", "warning-soft": "status/warn-soft",
    "danger-soft": "status/err-soft",
}
for role in ("admin", "tecnico", "cliente"):
    FIGMA[f"role-{role}"] = f"rol/{role}/base"
    FIGMA[f"role-{role}-soft"] = f"rol/{role}/soft"
    FIGMA[f"role-{role}-ink"] = f"rol/{role}/ink"

TYPO_FIGMA = {
    "titulo-pagina": "Título/Página", "titulo-seccion": "Título/Sección", "titulo-tarjeta": "Título/Tarjeta",
    "cuerpo-normal": "Cuerpo/Normal", "cuerpo-medio": "Cuerpo/Medio", "etiqueta": "Etiqueta",
    "nota": "Nota", "sobretitulo": "Sobretítulo", "cifra-grande": "Cifra/Grande",
}


def block(css, selector):
    m = re.search(re.escape(selector) + r"\s*\{(.*?)\n\}", css, re.S)
    if not m:
        raise SystemExit(f"No se encontró el bloque {selector}")
    return dict(re.findall(r"--([\w-]+):\s*([^;]+);", m.group(1)))


def main(src, dst):
    css = open(src, encoding="utf-8").read()
    light = block(css, ":root")
    dark = block(css, '[data-theme="dark"]')

    colors = {}
    for name, fig in FIGMA.items():
        key = f"color-{name}"
        colors[name] = {
            "$type": "color",
            "$value": light[key],
            "$extensions": {"modes": {"light": light[key], "dark": dark[key]}, "figma": fig, "css": f"--{key}"},
        }

    roles = {
        r: {
            "accent": {"$type": "color", "$value": f"{{color.role-{r}}}"},
            "accent-soft": {"$type": "color", "$value": f"{{color.role-{r}-soft}}"},
            "accent-ink": {"$type": "color", "$value": f"{{color.role-{r}-ink}}"},
        }
        for r in ("admin", "tecnico", "cliente")
    }

    def dim(prefix):
        return {
            k.split("-", 1)[1]: {"$type": "dimension", "$value": v, "$extensions": {"css": f"--{k}"}}
            for k, v in light.items() if k.startswith(prefix + "-")
        }

    typography = {}
    for key, fig in TYPO_FIGMA.items():
        typography[key] = {
            "$type": "typography",
            "$value": {
                "fontFamily": "Inter",
                "fontSize": light[f"text-{key}-size"],
                "fontWeight": int(light[f"text-{key}-weight"]),
                "lineHeight": light[f"text-{key}-line"],
            },
            "$extensions": {"figma": fig},
        }

    def group(pairs, typ):
        return {name: {"$type": typ, "$value": light[key], "$extensions": {"css": f"--{key}", "figma": fig}} for name, key, fig in pairs}

    size = group(
        [(k.replace("size-", "", 1), k, "size/" + (k.replace("size-", "", 1).replace("-", "/", 1) if k.split("-")[1] in ("control", "icon", "avatar") else k.replace("size-", "", 1)))
         for k in light if k.startswith("size-")], "dimension")
    border = group([("default", "border-width", "border/default"), ("strong", "border-width-strong", "border/strong")], "dimension")
    duration = group([(k.split("-", 1)[1], k, "duration/" + k.split("-", 1)[1]) for k in light if k.startswith("duration-")], "duration")
    easing = group([(k.split("-", 1)[1], k, "easing/" + k.split("-", 1)[1]) for k in light if k.startswith("easing-")], "cubicBezier")
    z = group([(k.split("-", 1)[1], k, "z/" + k.split("-", 1)[1]) for k in light if k.startswith("z-")], "number")
    breakpoint_ = group([(k.split("-", 1)[1], k, "breakpoint/" + k.split("-", 1)[1]) for k in light if k.startswith("breakpoint-")], "dimension")
    opacity = group([("disabled", "opacity-disabled", "opacity/disabled")], "number")
    shadow = {
        "popover": {"$type": "shadow", "$value": light["shadow-popover"], "$extensions": {"css": "--shadow-popover", "figma": "Sombra/Popover"}},
        "modal": {"$type": "shadow", "$value": light["shadow-modal"], "$extensions": {"css": "--shadow-modal", "figma": "Sombra/Modal"}},
        "focus-ring": {"$type": "shadow", "$value": light["focus-ring"], "$extensions": {"css": "--focus-ring", "figma": "Foco/Anillo"}},
    }

    out = {
        "$description": "ServiGest · tokens de diseño generados desde Figma. Cada color trae $extensions.modes con los valores claro y oscuro.",
        "color": colors, "role": roles, "space": dim("space"), "radius": dim("radius"), "size": size, "border": border,
        "duration": duration, "easing": easing, "z": z, "breakpoint": breakpoint_, "opacity": opacity, "shadow": shadow,
        "typography": typography,
    }
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{len(size)} tamaños, {len(duration)} duraciones, {len(easing)} curvas, {len(z)} capas, {len(breakpoint_)} breakpoints, {len(shadow)} sombras")
    print(f"{len(colors)} colores, {len(out['space'])} espaciados, {len(out['radius'])} radios, {len(typography)} estilos de texto")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "tokens.css", sys.argv[2] if len(sys.argv) > 2 else "tokens.json")
