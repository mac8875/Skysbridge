#!/usr/bin/env python3
"""Generate native launcher icons from the real bridge in the Skysbridge logo."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "native-assets/app-icon/skysbridge-real-bridge-source.jpg"
ANDROID = ROOT / "native-assets/android-icons/res"
IOS_ICON = ROOT / "native-assets/ios-icons/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
ICON_DIR = ROOT / "native-assets/app-icon"
ICON_DIR.mkdir(parents=True, exist_ok=True)

master = Image.open(SOURCE).convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
master_rgba = master.convert("RGBA")
master.save(IOS_ICON, optimize=True)

densities = {
    "ldpi": 36,
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}
for density, size in densities.items():
    folder = ANDROID / f"mipmap-{density}"
    square = master.resize((size, size), Image.Resampling.LANCZOS)
    square.save(folder / "ic_launcher.png", optimize=True)

    circle_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(circle_mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    rounded = square.copy()
    rounded.putalpha(circle_mask)
    rounded.save(folder / "ic_launcher_round.png", optimize=True)

    # Android adaptive-icon layers use a 108 dp canvas, so scale by device density.
    foreground_size = round(108 * size / 48)
    adaptive = master_rgba.resize((foreground_size, foreground_size), Image.Resampling.LANCZOS)
    adaptive.save(folder / "ic_launcher_foreground.png", optimize=True)

    background_layer = Image.new("RGB", (size, size), "#04121f")
    background_layer.save(folder / "ic_launcher_background.png", optimize=True)

print(f"Generated native icons from {SOURCE.name} into {IOS_ICON}")
