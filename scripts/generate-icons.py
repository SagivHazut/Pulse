#!/usr/bin/env python3
"""
Launch icons, drawn rather than exported.

Same reasoning as `generate-audio.js`: the icon is code, not a binary to hunt
down. Change a colour in `src/theme/themes.ts`, mirror it in PALETTE below,
re-run, and every asset regenerates consistently.

It draws the *same* tile construction the game itself uses — `Tile.tsx` under
the Gloss finish: a dark base showing as a bottom lip, the body colour on top,
a soft light highlight, and a hairline inner border. That is why the icon reads
as a screenshot of the game rather than as artwork about it.

The composition is an S/Z tetromino in the three wordmark colours plus sky,
which is what the splash screen already shows above "PULSE BLOCKS".

Requires Pillow:  python3 -m pip install --user Pillow
Run:              npm run icons
"""

from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFilter

# --------------------------------------------------------------------- palette
# Mirrors the Neon theme in src/theme/themes.ts. base / light / dark per skin().
PALETTE = {
    "aqua":   ("#3FD9CE", "#93F4EE", "#1C948C"),
    "violet": ("#8B7BFF", "#C2B8FF", "#57499E"),
    "rose":   ("#FF6FAE", "#FFACD0", "#BB4079"),
    "sky":    ("#57B8FF", "#A0D9FF", "#2A7EC0"),
}
BACKGROUND = "#0A0C17"   # theme colors.background
ACCENT = "#5EE7DF"       # theme colors.accent — the glow

# The S/Z tetromino: (column, row, skin). Matches the approved icon comp.
SHAPE = [(0, 0, "aqua"), (1, 0, "violet"), (1, 1, "rose"), (2, 1, "sky")]

# ----------------------------------------------------------- Gloss finish spec
# Mirrors GLOSS in src/theme/finishes.ts, which Tile.tsx reads.
RADIUS_RATIO = 0.22
LIP_RATIO = 0.09
HIGHLIGHT_OPACITY = 0.5
HIGHLIGHT_HEIGHT_RATIO = 0.34
BODY_BORDER = "rgba(255,255,255,0.16)"

GAP_RATIO = 0.10   # space between tiles, as a fraction of tile size
TILT_DEG = -6.0    # the whole cluster leans, as in the reference comp
SS = 4             # supersample factor; everything is drawn 4x then downsampled


def rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def draw_tile(size: int, base: str, light: str, dark: str) -> Image.Image:
    """One block face, built the way Tile.tsx builds it."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    radius = max(3, int(size * RADIUS_RATIO))
    lip = max(2, int(size * LIP_RATIO))

    # The dark base is the full tile; the lip is what shows below the body.
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=rgb(dark))

    # Body sits on top, inset from the bottom by the lip.
    body_bottom = size - 1 - lip
    d.rounded_rectangle([0, 0, size - 1, body_bottom], radius=radius, fill=rgb(base))
    # A subtle vertical deepening across the body, so the face reads as curved
    # rather than as flat colour. Clipped to the body's rounded corners.
    grad = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(body_bottom + 1):
        t = y / max(1, body_bottom)
        gd.line([(0, y), (size, y)], fill=rgb(dark) + (int(70 * t * t),))
    body_clip = Image.new("L", (size, size), 0)
    ImageDraw.Draw(body_clip).rounded_rectangle(
        [0, 0, size - 1, body_bottom], radius=radius, fill=255
    )
    img.alpha_composite(
        Image.composite(grad, Image.new("RGBA", (size, size), (0, 0, 0, 0)), body_clip)
    )

    # Hairline inner border: rgba(255,255,255,0.16) over the body.
    border = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(border).rounded_rectangle(
        [0, 0, size - 1, body_bottom], radius=radius, outline=(255, 255, 255, 41),
        width=max(1, size // 160),
    )
    img.alpha_composite(border)

    # Soft top highlight, clipped to the body's rounded corners.
    hl = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    hx = max(1, int(lip * 0.7))
    hy = max(1, int(lip * 0.5))
    hh = int((size - lip) * HIGHLIGHT_HEIGHT_RATIO)
    ImageDraw.Draw(hl).rounded_rectangle(
        [hx, hy, size - 1 - hx, hy + hh],
        radius=int(radius * 0.8),
        fill=rgb(light) + (int(255 * HIGHLIGHT_OPACITY),),
    )
    clip = Image.new("L", (size, size), 0)
    ImageDraw.Draw(clip).rounded_rectangle([0, 0, size - 1, body_bottom], radius=radius, fill=255)
    img.alpha_composite(Image.composite(hl, Image.new("RGBA", (size, size), (0, 0, 0, 0)), clip))
    return img


def build_cluster(tile: int, shadow: bool = True) -> Image.Image:
    """
    The four tiles, laid out and tilted, with a soft drop shadow beneath.

    `shadow=False` is for the Android monochrome layer: a themed icon fills the
    silhouette with one flat colour, so a blurred shadow inside the alpha would
    render as a smudge around the blocks rather than as depth.
    """
    step = int(tile * (1 + GAP_RATIO))
    cols = max(c for c, _, _ in SHAPE) + 1
    rows = max(r for _, r, _ in SHAPE) + 1
    pad = tile  # room for the shadow and the rotation
    w = step * (cols - 1) + tile + pad * 2
    h = step * (rows - 1) + tile + pad * 2

    tiles = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for col, row, skin in SHAPE:
        tiles.alpha_composite(draw_tile(tile, *PALETTE[skin]), (pad + col * step, pad + row * step))

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    if shadow:
        # The cluster's own silhouette, blurred and pushed down.
        drop = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        drop.paste((0, 0, 0, 150), (0, 0, w, h), tiles.getchannel("A"))
        drop = drop.filter(ImageFilter.GaussianBlur(tile * 0.10))
        out.alpha_composite(drop, (0, int(tile * 0.07)))
    out.alpha_composite(tiles)

    out = out.rotate(TILT_DEG, resample=Image.BICUBIC, expand=True)
    return out.crop(out.getbbox())


def glow_field(size: int, shaped: Image.Image | None = None) -> Image.Image:
    """
    Navy field with the accent bleeding outward.

    The glow takes the cluster's own silhouette where one is given, so the light
    hugs the blocks instead of sitting behind them as a disc — that shaped bloom
    is most of what makes the reference comp read as neon.
    """
    field = Image.new("RGBA", (size, size), rgb(BACKGROUND) + (255,))

    if shaped is None:
        blob = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        r = int(size * 0.30)
        ImageDraw.Draw(blob).ellipse(
            [size // 2 - r, size // 2 - r, size // 2 + r, size // 2 + r],
            fill=rgb(ACCENT) + (140,),
        )
        field.alpha_composite(blob.filter(ImageFilter.GaussianBlur(size * 0.16)))
        return field

    silhouette = shaped.getchannel("A")
    # Two passes: a wide soft bloom, then a tight bright halo at the edges.
    for blur, alpha in ((size * 0.085, 190), (size * 0.022, 150)):
        layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        layer.paste(rgb(ACCENT) + (alpha,), (0, 0), silhouette)
        field.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))
    return field


def place(cluster: Image.Image, canvas: int, fraction: float) -> Image.Image:
    """Scale the cluster so its widest side spans `fraction` of the canvas."""
    scale = (canvas * fraction) / max(cluster.size)
    c = cluster.resize(
        (max(1, int(cluster.width * scale)), max(1, int(cluster.height * scale))),
        Image.LANCZOS,
    )
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.alpha_composite(c, ((canvas - c.width) // 2, (canvas - c.height) // 2))
    return out


def main() -> None:
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
    root = os.path.normpath(root)
    big = 1024 * SS
    cluster = build_cluster(tile=int(big * 0.19))

    def save(img: Image.Image, name: str, size: int, opaque_over=None) -> None:
        img = img.resize((size, size), Image.LANCZOS)
        if opaque_over is not None:
            bg = opaque_over.resize((size, size), Image.LANCZOS).convert("RGBA")
            bg.alpha_composite(img)
            img = bg.convert("RGB")  # no alpha — Apple rejects icons with it
        img.save(os.path.join(root, name))
        print(f"  {name:34} {size}x{size}")

    print("assets/")
    # iOS / store icon: full bleed and opaque. Apple's squircle barely crops, so
    # the artwork can sit larger here than on the Android foreground layer.
    icon_cluster = place(cluster, big, 0.74)
    save(icon_cluster, "icon.png", 1024, opaque_over=glow_field(big, icon_cluster))

    # Android adaptive: the mask crops to the centre 66%, so the foreground is
    # laid out smaller than the iOS icon and the glow lives on the background.
    android_cluster = place(cluster, big, 0.58)
    save(android_cluster, "android-icon-foreground.png", 1024)
    # The glow lives on the background layer, shaped by where the foreground
    # will sit, so the two layers still compose into the same image.
    save(glow_field(big, android_cluster).convert("RGB"), "android-icon-background.png", 1024)

    # Shadow-free, and its alpha hardened, so a themed icon tints four crisp
    # blocks instead of four blocks wrapped in a grey haze.
    mono = place(build_cluster(tile=int(big * 0.19), shadow=False), big, 0.58)
    alpha = mono.getchannel("A").point(lambda a: 255 if a > 140 else 0)
    white = Image.new("RGBA", mono.size, (255, 255, 255, 255))
    white.putalpha(alpha)
    save(white, "android-icon-monochrome.png", 1024)

    # Splash sits on the themed background already, so it stays transparent.
    save(place(cluster, big, 0.66), "splash-icon.png", 1024)
    fav = place(cluster, big, 0.80)
    save(fav, "favicon.png", 48, opaque_over=glow_field(big, fav))


if __name__ == "__main__":
    main()
