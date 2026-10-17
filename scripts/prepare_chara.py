# Turns the character illustrations into public/chara/01.webp … 47.webp.
# Painted backgrounds (gray checkerboard / plain white / plain black) are removed
# by flood-filling from the image border; real transparent PNGs are kept as is.
#
#   pip install pillow numpy
#   python scripts/prepare_chara.py <folder with hokkaidou.png …> [names...]
#
# File names are matched by FILES below (romaji, in prefecture order).
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "chara")
FILES = (
    "hokkaidou aomori iwate miyagi akita yamagata fukushima ibaraki tochigi gunma saitama chiba toukyou "
    "kanagawa niigata toyamna ishikawa fukui yamanashi nagano gifu shizuoka aichi mie shiga kyouto oosaka "
    "hyougo nara wakayama tottori shimane okayama hiroshima yamaguchi tokushima kagawa ehime kouchi fukuoka "
    "saga nagasaki kumamonoto ooita miyazaki kagoshima okinawa"
).split()
SIZE = 512
os.makedirs(OUT, exist_ok=True)


def background_mask(rgb: np.ndarray, kind: str) -> np.ndarray:
    r, g, b = (rgb[..., i].astype(int) for i in range(3))
    sat = np.max(rgb, axis=2).astype(int) - np.min(rgb, axis=2).astype(int)
    val = (r + g + b) // 3
    if kind == "checker":
        # The checker's two tones differ per image, so read them off the border.
        edge = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]).astype(int)
        flat = edge[(edge.max(1) - edge.min(1)) <= 8].mean(1)
        lo, hi = np.percentile(flat, 3) - 10, np.percentile(flat, 97) + 10
        cand = (sat <= 14) & (val >= lo) & (val <= hi)
    elif kind == "white":
        cand = (sat <= 14) & (val >= 236)
    else:
        cand = (sat <= 20) & (val <= 24)
    m = Image.fromarray(np.where(cand, 255, 0).astype(np.uint8)).copy()
    h, w = cand.shape
    for x, y in [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]:
        if m.getpixel((x, y)) == 255:
            ImageDraw.floodfill(m, (x, y), 128)
    bg = np.array(m) == 128
    if kind == "checker":
        # Checker patches trapped between arms or hair: enclosed gray regions whose
        # tone alternates strongly (a flat gray costume part would not).
        rest = np.array(m) == 255
        ys, xs = np.nonzero(rest)
        label = 0
        for y, x in zip(ys, xs):
            if m.getpixel((int(x), int(y))) != 255:
                continue
            label = 1 + (label % 120)
            ImageDraw.floodfill(m, (int(x), int(y)), label)
            comp = np.array(m) == label
            if comp.sum() >= 12 and val[comp].std() > 14:
                bg |= comp
            m.paste(0, mask=Image.fromarray((comp * 255).astype(np.uint8)))
    return bg


def detect(rgb: np.ndarray) -> str:
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]).astype(int)
    val = border.mean(axis=1)
    if (val >= 236).mean() > 0.6:
        return "white"
    if (val <= 24).mean() > 0.6:
        return "black"
    return "checker"


names = sys.argv[2:] or FILES
for name in names:
    im = Image.open(os.path.join(SRC, name + ".png"))
    # Square canvas, character centred, then shrink to SIZE.
    side = max(im.size)
    if im.mode == "RGBA":
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
        out = canvas.resize((SIZE, SIZE), Image.LANCZOS)
        kind = "alpha"
    else:
        rgb = im.convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
        arr = np.array(rgb)
        kind = detect(arr)
        bg = background_mask(arr, kind)
        alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8))
        # Pull the edge in by a pixel and soften it so no gray halo remains.
        alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
        out = rgb.convert("RGBA")
        out.putalpha(alpha)
    out.save(os.path.join(OUT, f"{FILES.index(name) + 1:02d}.webp"), "WEBP", quality=82, method=6)
    print(name, kind)
