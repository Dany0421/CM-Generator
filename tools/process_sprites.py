#!/usr/bin/env python3
"""Sprite pipeline for Career World. Pure stdlib (zlib/struct) — no Pillow.
Reads approved sources in assets/sprites/, writes processed assets to
assets/sprites/dist/. Idempotent; rerun any time sources change."""
import zlib, struct, os, sys, colorsys

ROOT = os.path.join(os.path.dirname(__file__), "..", "assets", "sprites")

def read_png(path):
    d = open(path, "rb").read()
    assert d[:8] == b"\x89PNG\r\n\x1a\n", path
    pos, idat, w, h, ct = 8, b"", None, None, None
    while pos < len(d):
        ln = struct.unpack(">I", d[pos:pos+4])[0]
        t = d[pos+4:pos+8]; c = d[pos+8:pos+8+ln]
        if t == b"IHDR": w, h, _, ct = struct.unpack(">IIBB", c[:10])
        elif t == b"IDAT": idat += c
        pos += 12 + ln
    assert ct == 6, f"{path}: not RGBA"
    raw = zlib.decompress(idat)
    bpp, stride = 4, w * 4 + 1
    out = bytearray(w * h * 4)
    prev = bytearray(w * 4)
    for y in range(h):
        f = raw[y*stride]
        row = bytearray(raw[y*stride+1:(y+1)*stride])
        if f == 1:
            for i in range(bpp, len(row)): row[i] = (row[i] + row[i-bpp]) & 255
        elif f == 2:
            for i in range(len(row)): row[i] = (row[i] + prev[i]) & 255
        elif f == 3:
            for i in range(len(row)):
                a = row[i-bpp] if i >= bpp else 0
                row[i] = (row[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(len(row)):
                a = row[i-bpp] if i >= bpp else 0
                b = prev[i]; c2 = prev[i-bpp] if i >= bpp else 0
                p = a + b - c2
                pa, pb, pc = abs(p-a), abs(p-b), abs(p-c2)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c2)
                row[i] = (row[i] + pr) & 255
        out[y*w*4:(y+1)*w*4] = row
        prev = row
    return w, h, out

def write_png(path, w, h, px):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    raw = b"".join(b"\x00" + bytes(px[y*w*4:(y+1)*w*4]) for y in range(h))
    def chunk(t, c):
        cc = t + c
        return struct.pack(">I", len(c)) + cc + struct.pack(">I", zlib.crc32(cc) & 0xffffffff)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))

def trim(w, h, px, thresh=8):
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        base = y * w * 4
        for x in range(w):
            if px[base + x*4 + 3] > thresh:
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    tw, th = maxx - minx + 1, maxy - miny + 1
    out = bytearray(tw * th * 4)
    for y in range(th):
        s = ((y + miny) * w + minx) * 4
        out[y*tw*4:(y+1)*tw*4] = px[s:s + tw*4]
    return tw, th, out

def resize(w, h, px, nw, nh):
    """Area-average downscale (box filter) with alpha premultiply."""
    out = bytearray(nw * nh * 4)
    for oy in range(nh):
        y0, y1 = oy * h / nh, (oy + 1) * h / nh
        for ox in range(nw):
            x0, x1 = ox * w / nw, (ox + 1) * w / nw
            r = g = b = a = area = 0.0
            for sy in range(int(y0), min(int(y1) + 1, h)):
                fy = min(y1, sy + 1) - max(y0, sy)
                if fy <= 0: continue
                base = sy * w * 4
                for sx in range(int(x0), min(int(x1) + 1, w)):
                    fx = min(x1, sx + 1) - max(x0, sx)
                    if fx <= 0: continue
                    f = fx * fy
                    al = px[base + sx*4 + 3] / 255.0
                    r += px[base + sx*4] * al * f
                    g += px[base + sx*4 + 1] * al * f
                    b += px[base + sx*4 + 2] * al * f
                    a += al * f
                    area += f
            i = (oy * nw + ox) * 4
            if a > 0:
                out[i]   = min(255, round(r / a))
                out[i+1] = min(255, round(g / a))
                out[i+2] = min(255, round(b / a))
                out[i+3] = min(255, round(a / area * 255))
    return out

def mirror(w, h, px):
    out = bytearray(w * h * 4)
    for y in range(h):
        for x in range(w):
            s, d = (y*w + x)*4, (y*w + (w-1-x))*4
            out[d:d+4] = px[s:s+4]
    return out

def boost(w, h, px, sat=1.18, val=1.05):
    out = bytearray(px)
    for i in range(0, len(px), 4):
        if px[i+3] == 0: continue
        h_, s, v = colorsys.rgb_to_hsv(px[i]/255, px[i+1]/255, px[i+2]/255)
        r, g, b = colorsys.hsv_to_rgb(h_, min(1, s*sat), min(1, v*val))
        out[i], out[i+1], out[i+2] = round(r*255), round(g*255), round(b*255)
    return out

BUILDINGS = {"casa": 440, "balneario": 480, "imprensa": 460, "sponsors": 400,
             "agencia": 420, "boardroom": 440, "club-office": 480, "estadio": 680}
PROPS = {"arvore": 200, "arbusto": 120, "banco": 140, "candeeiro": 100,
         "campo": 560, "estatua": 180}
FRAME_W, FRAME_H = 128, 192

def fit_frame(path):
    w, h, px = trim(*read_png(path))
    nh = FRAME_H
    nw = max(1, round(w * nh / h))
    if nw > FRAME_W:
        nw = FRAME_W
        nh = max(1, round(h * nw / w))
    return nw, nh, resize(w, h, px, nw, nh)

def main():
    dist = os.path.join(ROOT, "dist")
    # player sheet: down, left, right(=mirror left), up
    frames = {}
    for d in ("down", "left", "up"):
        frames[d] = fit_frame(os.path.join(ROOT, f"player-idle-{d}.png"))
    lw, lh, lpx = frames["left"]
    frames["right"] = (lw, lh, mirror(lw, lh, lpx))
    sheet = bytearray(FRAME_W * 4 * FRAME_H * 4)  # 512x192 RGBA
    for i, d in enumerate(("down", "left", "right", "up")):
        fw, fh, fpx = frames[d]
        ox = i * FRAME_W + (FRAME_W - fw) // 2
        oy = FRAME_H - fh  # bottom-aligned
        for y in range(fh):
            s = y * fw * 4
            t = ((oy + y) * FRAME_W * 4 + ox) * 4
            sheet[t:t + fw*4] = fpx[s:s + fw*4]
    write_png(os.path.join(dist, "player.png"), FRAME_W * 4, FRAME_H, sheet)
    print(f"player.png {FRAME_W*4}x{FRAME_H}")

    for group, table in (("buildings", BUILDINGS), ("props", PROPS)):
        for name, tw in table.items():
            w, h, px = trim(*read_png(os.path.join(ROOT, group, f"{name}.png")))
            th = max(1, round(h * tw / w))
            px = resize(w, h, px, tw, th)
            if name == "campo": px = boost(tw, th, px)
            write_png(os.path.join(dist, group, f"{name}.png"), tw, th, px)
            print(f"{group}/{name}.png {tw}x{th}")

if __name__ == "__main__":
    main()
