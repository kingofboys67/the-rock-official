"""Crops every About photo to one 4:5 portrait frame, centred on his face.

Reads media/about/src/<key>.jpg and media/about/crops.json (face box per photo, from Apple Vision;
optional "centre_x" / "full_height" overrides for group or wide shots) and writes media/about/<key>.jpg.
usage: python scripts/about-crops.py      (needs numpy + opencv-python-headless)
"""
import json
from pathlib import Path
import cv2

SITE = Path(__file__).resolve().parent.parent
SRC, OUT = SITE / 'media/about/src', SITE / 'media/about'
W_OUT, H_OUT = 960, 1200  # 4:5


def main():
    spec = json.loads((OUT / 'crops.json').read_text())
    for key, s in spec.items():
        img = cv2.imread(str(SRC / f'{key}.jpg'))
        H, W = img.shape[:2]
        fx, fy, fw, fh = s['face']
        cx, cy = s.get('centre_x', fx + fw / 2), fy + fh / 2
        # head-and-shoulders framing: crop about 5 face-heights tall, never smaller than 900px
        ch = H if s.get('full_height') else max(fh * 5.0, 900)
        ch = min(ch, H, W * 5 / 4)
        cw = ch * 4 / 5
        x0 = min(max(cx - cw / 2, 0), W - cw)
        y0 = min(max(cy - ch * 0.36, 0), H - ch)  # eyes sit a little above the upper third
        crop = img[int(y0):int(y0 + ch), int(x0):int(x0 + cw)]
        crop = cv2.resize(crop, (W_OUT, H_OUT), interpolation=cv2.INTER_AREA if ch > H_OUT else cv2.INTER_CUBIC)
        cv2.imwrite(str(OUT / f'{key}.jpg'), crop, [cv2.IMWRITE_JPEG_QUALITY, 84])
        print(f'{key}: {int(cw)}x{int(ch)} from {W}x{H}')


if __name__ == '__main__':
    main()
