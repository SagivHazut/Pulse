#!/usr/bin/env python3
"""
Compose App Store screenshots from the raw captures in marketing/screenshots/ios.

    python3 scripts/compose-store-shots.py

Each image is a headline over the Neon theme's background, with the real
capture set in a phone frame beneath it. Output goes to marketing/app-store/,
one folder per display size App Store Connect asks for.

The captures are never retouched. Apple rejects screenshots that show UI the
app does not have, so everything inside the frame is exactly what the game drew
— the composition only adds a caption and a background around it. Captions
likewise only claim what the code does; see marketing/store-listing.md.
"""

from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), "..")
SOURCE = os.path.join(ROOT, "marketing", "screenshots", "ios")
OUT = os.path.join(ROOT, "marketing", "app-store")

# App Store Connect's iPhone slots. 6.9" is the one that must be filled; 6.5"
# is what the listing page shows by default, so both are produced.
SIZES = {
    "6.9-inch": (1320, 2868),
    "6.5-inch": (1284, 2778),
}

# Neon theme — mirrors src/theme/themes.ts, like scripts/generate-icons.py.
BACKGROUND_TOP = (17, 21, 49)      # backgroundAlt #111531
BACKGROUND_BOTTOM = (10, 12, 23)   # background    #0A0C17
ACCENT = (94, 231, 223)            # accent        #5EE7DF
TILES = [(63, 217, 206), (139, 123, 255), (255, 111, 174), (87, 184, 255), (255, 198, 84)]

FONT = "/System/Library/Fonts/SFNS.ttf"

# In the order they appear on the listing. The first three are the ones the
# install sheet shows, so they are all gameplay.
SHOTS = [
    ("09-drag-preview.png", "Drag. Drop. Clear.", "A calm block puzzle — no timer"),
    ("08-combo.png", "Chain big combos", "Clear lines to charge the Pulse"),
    ("02-gameplay.png", "Bombs and bolts", "Power-ups for tight spots"),
    ("01-home.png", "Two ways to play", "Classic or Pulse — your pick"),
    ("03-themes.png", "Eight themes to unlock", "Make the board your own"),
    ("04-daily.png", "Rewards every day", "Keep your streak going"),
    ("06-achievements.png", "Ten achievements", "And a level to climb"),
]


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_name(weight)
    return f


def fitted(text: str, weight: str, size: int, max_width: int, floor: int) -> ImageFont.FreeTypeFont:
    """Largest size down to `floor` at which `text` fits on one line."""
    while size > floor:
        f = font(weight, size)
        if f.getlength(text) <= max_width:
            return f
        size -= 4
    return font(weight, floor)


def background(w: int, h: int) -> Image.Image:
    img = Image.new("RGB", (w, h))
    px = ImageDraw.Draw(img)
    for y in range(h):
        t = y / (h - 1)
        px.line(
            [(0, y), (w, y)],
            fill=tuple(round(a + (b - a) * t) for a, b in zip(BACKGROUND_TOP, BACKGROUND_BOTTOM)),
        )

    # Soft colour pools, the same glow the home screen sits in.
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    for cx, cy, r, rgb, a in [
        (0.12, 0.10, 0.55, TILES[0], 90),
        (0.95, 0.52, 0.60, TILES[1], 80),
        (0.05, 0.92, 0.45, TILES[2], 55),
    ]:
        x, y, rr = cx * w, cy * h, r * w
        g.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(*rgb, a))
    glow = glow.filter(ImageFilter.GaussianBlur(w * 0.18))
    img = Image.alpha_composite(img.convert("RGBA"), glow)

    # A few drifting tiles, like the home screen background.
    tiles = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for cx, cy, s, rot, rgb, a in [
        (0.08, 0.30, 0.13, 18, TILES[1], 60),
        (0.90, 0.22, 0.10, -14, TILES[0], 55),
        (0.93, 0.80, 0.14, 24, TILES[2], 45),
        (0.06, 0.70, 0.09, -20, TILES[3], 50),
    ]:
        side = int(s * w)
        tile = Image.new("RGBA", (side * 2, side * 2), (0, 0, 0, 0))
        ImageDraw.Draw(tile).rounded_rectangle(
            [side // 2, side // 2, side // 2 + side, side // 2 + side],
            radius=int(side * 0.22),
            fill=(*rgb, a),
        )
        tile = tile.rotate(rot, resample=Image.BICUBIC).filter(ImageFilter.GaussianBlur(side * 0.04))
        tiles.alpha_composite(tile, (int(cx * w - side), int(cy * h - side)))
    return Image.alpha_composite(img, tiles)


def phone(capture: Image.Image, width: int) -> Image.Image:
    """The capture in a plain dark bezel with rounded corners."""
    bezel = round(width * 0.022)
    screen_w = width - bezel * 2
    screen_h = round(capture.height * screen_w / capture.width)
    screen = capture.convert("RGB").resize((screen_w, screen_h), Image.LANCZOS)

    # iPhone screen corners are ~55pt on a 440pt-wide device.
    radius = round(screen_w * 0.125)
    mask = Image.new("L", (screen_w, screen_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, screen_w - 1, screen_h - 1], radius=radius, fill=255)

    frame = Image.new("RGBA", (width, screen_h + bezel * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(frame)
    d.rounded_rectangle(
        [0, 0, frame.width - 1, frame.height - 1],
        radius=radius + bezel,
        fill=(5, 6, 11, 255),
        outline=(255, 255, 255, 34),
        width=max(2, bezel // 8),
    )
    frame.paste(screen, (bezel, bezel), mask)
    return frame


def compose(capture_path: str, headline: str, sub: str, w: int, h: int) -> Image.Image:
    img = background(w, h)
    d = ImageDraw.Draw(img)

    margin = round(w * 0.06)
    top = round(h * 0.058)
    # One size for every headline in the set, so the listing reads as a series
    # rather than seven posters that each shrank to fit their own caption.
    head = font("Heavy", min(fitted(t, "Heavy", round(w * 0.1), w - margin * 2, round(w * 0.072)).size for _, t, _ in SHOTS))
    subf = font("Semibold", min(fitted(t, "Semibold", round(w * 0.044), w - margin * 2, round(w * 0.034)).size for _, _, t in SHOTS))

    d.text((w / 2, top), headline, font=head, fill=(255, 255, 255), anchor="mt")
    head_h = head.getbbox(headline)[3]
    sub_y = top + head_h + round(h * 0.014)
    d.text((w / 2, sub_y), sub, font=subf, fill=ACCENT, anchor="mt")
    text_bottom = sub_y + subf.getbbox(sub)[3]

    # The phone takes whatever height is left, capped so it never runs wider
    # than 76% of the canvas.
    gap = round(h * 0.03)
    room = h - text_bottom - gap - round(h * 0.035)
    capture = Image.open(capture_path)
    by_height = round(room * capture.width / capture.height)
    device = phone(capture, min(round(w * 0.76), by_height))

    x = (w - device.width) // 2
    y = text_bottom + gap

    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [x, y + round(h * 0.012), x + device.width, y + device.height + round(h * 0.012)],
        radius=round(device.width * 0.14),
        fill=(0, 0, 0, 150),
    )
    img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(w * 0.03)))
    img.alpha_composite(device, (x, y))
    return img.convert("RGB")


def main() -> None:
    for label, (w, h) in SIZES.items():
        folder = os.path.join(OUT, label)
        os.makedirs(folder, exist_ok=True)
        for i, (name, headline, sub) in enumerate(SHOTS, start=1):
            out = compose(os.path.join(SOURCE, name), headline, sub, w, h)
            assert out.size == (w, h), (name, out.size)
            path = os.path.join(folder, f"{i:02d}-{os.path.splitext(name)[0].split('-', 1)[1]}.png")
            out.save(path, optimize=True)
            print(f"{label}  {os.path.basename(path)}  {w}x{h}")


if __name__ == "__main__":
    main()
