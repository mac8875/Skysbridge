#!/usr/bin/env python3
"""Generate native launcher icons from the accepted original Sky’s Bridge artwork."""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "native-assets/app-icon/skysbridge-real-bridge-source.jpg"
ANDROID = ROOT / "native-assets/android-icons/res"
IOS_ICON = ROOT / "native-assets/ios-icons/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
PLAY_ICON = ROOT / "play-store/app-icon-512.png"
FONT_CANDIDATES = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    "/System/Library/Fonts/Supplemental/Georgia.ttf",
)

master = Image.open(SOURCE).convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS).convert("RGBA")

# Preserve the original bridge, star field, and water; add only the agreed SB
# monogram beneath the bridge over a slightly darkened water area.
shade = Image.new("RGBA", master.size, (0, 0, 0, 0))
pixels = shade.load()
for y in range(720, 1024):
    alpha = int(66 * (y - 720) / (1024 - 720))
    for x in range(1024):
        pixels[x, y] = (2, 12, 28, alpha)
master = Image.alpha_composite(master, shade)

font_path = next((path for path in FONT_CANDIDATES if Path(path).exists()), None)
font = ImageFont.truetype(font_path, 124) if font_path else ImageFont.load_default(size=124)

def text_mask_at(position, stroke_width=0):
    mask = Image.new("L", master.size, 0)
    ImageDraw.Draw(mask).text(position, "SB", font=font, anchor="mm", fill=255,
                              stroke_width=stroke_width, stroke_fill=255)
    return mask

fill_mask = text_mask_at((512, 720))
stroke_mask = text_mask_at((512, 720), stroke_width=4)
stroke_only = ImageChops.subtract(stroke_mask, fill_mask)
shadow_mask = text_mask_at((512, 726), stroke_width=5).filter(ImageFilter.GaussianBlur(6))
shadow = Image.new("RGBA", master.size, (0, 0, 0, 0))
shadow.putalpha(shadow_mask.point(lambda a: int(a * 0.68)))
master = Image.alpha_composite(master, shadow)

glow = fill_mask.filter(ImageFilter.GaussianBlur(18))
glow_layer = Image.new("RGBA", master.size, (255, 185, 72, 0))
glow_layer.putalpha(glow.point(lambda a: int(a * 0.25)))
master = Image.alpha_composite(master, glow_layer)

outline = Image.new("RGBA", master.size, (8, 20, 38, 0))
outline.putalpha(stroke_only.point(lambda a: int(a * 0.92)))
master = Image.alpha_composite(master, outline)

gradient = Image.new("RGBA", master.size, (0, 0, 0, 0))
gp = gradient.load()
for y in range(1024):
    t = min(1.0, max(0.0, (y - 790) / 170))
    color = (255, 239, 178) if t < 0.48 else (224, 167, 58)
    for x in range(1024):
        gp[x, y] = (*color, 255)
gradient.putalpha(fill_mask)
master = Image.alpha_composite(master, gradient).convert("RGB")

master.save(IOS_ICON, optimize=True)
play_icon = master.resize((512, 512), Image.Resampling.LANCZOS)
play_icon.save(PLAY_ICON, optimize=False, compress_level=6)

densities = {"ldpi": 36, "mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for density, size in densities.items():
    folder = ANDROID / f"mipmap-{density}"
    square = master.resize((size, size), Image.Resampling.LANCZOS)
    square.save(folder / "ic_launcher.png", optimize=True)

    circle_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(circle_mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    rounded = square.copy()
    rounded.putalpha(circle_mask)
    rounded.save(folder / "ic_launcher_round.png", optimize=True)

    foreground_size = round(108 * size / 48)
    adaptive = master.convert("RGBA").resize((foreground_size, foreground_size), Image.Resampling.LANCZOS)
    adaptive.save(folder / "ic_launcher_foreground.png", optimize=True)

    Image.new("RGB", (size, size), "#04121f").save(folder / "ic_launcher_background.png", optimize=True)

print(f"Generated original-bridge SB icons from {SOURCE.name} into Android, iOS, and Play Store sizes.")
