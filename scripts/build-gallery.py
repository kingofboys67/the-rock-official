"""Builds media/gallery.json: every photo of him in the media folder (alone or with others), newest first.

1. scripts/.bin/classify-photos (Apple Vision) measures each photo: faces found, largest face size, share of
   the image covered by text.
2. Keep photos with a visible face and little text (drops headlines, quote cards, ads, schedules).
3. Apply the hand review in scripts/gallery-overrides.json (photos the filter missed / graphics it let through).
4. Make web-size copies for photos that build-media.mjs doesn't already cover (non-@therock posts).

usage: python3 scripts/build-gallery.py      (needs macOS; compile the classifier first:
       swiftc -O scripts/classify-photos.swift -o scripts/.bin/classify-photos)
"""
import json, re, subprocess
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
SRC = SITE.parent
MAX_TEXT, MIN_FACE = 0.06, 0.002


def web_name(f):
    # therock_<ts>_<id>_232192182.jpg -> <ts>_<id>.jpg (same names build-media.mjs uses); others keep their account prefix
    m = re.match(r'^therock_(\d+)_(\d+)_\d+\.jpg$', f)
    if m: return f'{m.group(1)}_{m.group(2)}.jpg'
    m = re.match(r'^([a-z0-9_]+?)_(\d+)_(\d+)_\d+\.jpg$', f)
    return f'{m.group(1)}_{m.group(2)}_{m.group(3)}.jpg' if m else f


def main():
    files = sorted(p.name for p in SRC.glob('*.jpg'))
    out = subprocess.run([str(SITE / 'scripts/.bin/classify-photos'), *[str(SRC / f) for f in files]],
                         capture_output=True, text=True, check=True).stdout
    rows = {r['file']: r for r in map(json.loads, out.strip().splitlines())}
    ov = json.loads((SITE / 'scripts/gallery-overrides.json').read_text())
    keep = {f for f, r in rows.items() if r['faces'] and r['text'] < MAX_TEXT and r['face'] >= MIN_FACE}
    keep = (keep | set(ov['include'])) - set(ov['exclude'])

    items = []
    for f in keep:
        name = web_name(f)
        full, thumb = SITE / 'media/img' / name, SITE / 'media/thumb' / name
        if not full.exists():
            subprocess.run(['sips', '-Z', '1600', '-s', 'formatOptions', '78', str(SRC / f), '--out', str(full)], capture_output=True)
        if not thumb.exists():
            subprocess.run(['sips', '-Z', '640', '-s', 'formatOptions', '70', str(SRC / f), '--out', str(thumb)], capture_output=True)
        dim = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', str(thumb)], capture_output=True, text=True).stdout
        w, h = int(re.search(r'pixelWidth: (\d+)', dim).group(1)), int(re.search(r'pixelHeight: (\d+)', dim).group(1))
        ts = int(re.search(r'_(\d{10})_', f).group(1))
        items.append({'file': f'media/img/{name}', 'thumb': f'media/thumb/{name}', 'w': w, 'h': h, 'ts': ts, 'gallery': True})
    items.sort(key=lambda x: (-x['ts'], x['file']))
    (SITE / 'media/gallery.json').write_text(json.dumps(items))
    print(f'{len(items)} photos (from {len(files)} in the folder)')


if __name__ == '__main__':
    main()
