"""Capture each fixed-size HTML slide as a standalone PNG with isolated Edge profiles."""
from pathlib import Path
from tempfile import TemporaryDirectory
import subprocess
import sys
from PIL import Image, ImageDraw

EDGE = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
HERE = Path(__file__).resolve().parent
OUT = HERE / "images"


def main():
    requested = [int(value) for value in sys.argv[1:]] or list(range(1, 15))
    OUT.mkdir(parents=True, exist_ok=True)
    for number in requested:
        if number not in range(1, 15):
            raise ValueError(f"invalid slide: {number}")
        output = OUT / f"{number:02d}.png"
        with TemporaryDirectory(prefix=f"physics-ppt-{number:02d}-") as profile:
            command = [EDGE, "--headless=new", "--no-first-run", "--no-default-browser-check",
                       "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                       "--window-size=1920,1080", "--virtual-time-budget=1500",
                       f"--user-data-dir={profile}", f"--screenshot={output}",
                       f"{(HERE / 'index.html').as_uri()}?slide={number:02d}"]
            completed = subprocess.run(command, capture_output=True, text=True, timeout=35)
            if completed.returncode or not output.is_file():
                raise RuntimeError(f"slide {number}: exit {completed.returncode}\n{completed.stderr[-1500:]}")
        print(output)
    slides = [OUT / f"{number:02d}.png" for number in range(1, 15)]
    if all(path.is_file() for path in slides):
        overview = Image.new("RGB", (1920, 1184), (20, 25, 35))
        painter = ImageDraw.Draw(overview)
        for index, path in enumerate(slides):
            with Image.open(path) as source:
                preview = source.convert("RGB")
                preview.thumbnail((480, 270))
            x, y = (index % 4) * 480, (index // 4) * 296
            overview.paste(preview, (x, y))
            painter.text((x + 9, y + 273), path.stem, fill="white")
        overview.save(OUT / "00-overview.png")


if __name__ == "__main__":
    main()
