"""Age-morph frames: maps every era's face onto ONE base head so only the face changes.

Reads the eye-aligned cutouts in media/eras/NN.png (made by build-eras.mjs), finds face
landmarks with scripts/.bin/landmarks, warps each era's face onto the base face geometry
(piecewise-affine over a Delaunay mesh), matches skin tone to the base, and blends it in
with a feathered mask. Writes media/eras/morph-NN.png, all sharing the base head/body.

usage: python scripts/age-morph.py '<json list of {file, keep}>' <base_index 0-based>
(normally run by build-eras.mjs)
"""
import json, subprocess, sys
from pathlib import Path
import cv2
import numpy as np

SITE = Path(__file__).resolve().parent.parent
BIN = SITE / 'scripts/.bin/landmarks'
N_CONTOUR = 17  # faceContour points come first
ORDER = ['faceContour', 'leftEyebrow', 'rightEyebrow', 'leftEye', 'rightEye', 'nose', 'noseCrest',
         'medianLine', 'outerLips', 'innerLips', 'leftPupil', 'rightPupil']


def landmarks(path):
    d = json.loads(subprocess.check_output([str(BIN), str(path)], stderr=subprocess.DEVNULL))
    if 'error' in d:
        raise RuntimeError(f'{path.name}: {d["error"]}')
    pts = np.array([p for k in ORDER for p in d[k]], np.float32)
    # lift the brows to cover the lower forehead too
    brows = np.array(d['leftEyebrow'] + d['rightEyebrow'], np.float32)
    eyes = np.array(d['leftPupil'] + d['rightPupil'], np.float32)
    iod = float(np.linalg.norm(eyes[0] - eyes[1]))
    fore = brows.copy(); fore[:, 1] -= 0.38 * iod
    # extend below the jaw so each era's own chin/upper neck covers the base's chin shadow
    jaw = np.array(d['faceContour'], np.float32)[4:13].copy()  # same lower-jaw points in every photo
    jaw[:, 1] += 0.28 * iod
    return np.vstack([pts, fore, jaw]), d, iod


def triangles(pts, shape):
    sub = cv2.Subdiv2D((0, 0, shape[1], shape[0]))
    for p in pts:
        sub.insert((float(np.clip(p[0], 0, shape[1] - 1)), float(np.clip(p[1], 0, shape[0] - 1))))
    tris = []
    for t in sub.getTriangleList():
        tri = t.reshape(3, 2)
        idx = [int(np.argmin(np.linalg.norm(pts - v, axis=1))) for v in tri]
        if len(set(idx)) == 3:
            tris.append(idx)
    return tris


def warp_face(src, src_pts, dst_pts, tris, shape):
    """Piecewise-affine warp; also returns which pixels the mesh actually covered."""
    out = np.zeros(shape[:2] + (src.shape[2],), np.float32)
    cov = np.zeros(shape[:2], np.float32)
    for t in tris:
        s, d = src_pts[t], dst_pts[t]
        r = cv2.boundingRect(d.astype(np.float32))
        x, y, w, h = r
        if w == 0 or h == 0:
            continue
        m = cv2.getAffineTransform(s.astype(np.float32), (d - [x, y]).astype(np.float32))
        patch = cv2.warpAffine(src, m, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
        mask = np.zeros((h, w), np.float32)
        cv2.fillConvexPoly(mask, np.int32(d - [x, y]), 1.0, cv2.LINE_AA)
        y0, y1, x0, x1 = max(y, 0), min(y + h, shape[0]), max(x, 0), min(x + w, shape[1])
        if y1 <= y0 or x1 <= x0:
            continue
        p = patch[y0 - y:y1 - y, x0 - x:x1 - x]; mk = mask[y0 - y:y1 - y, x0 - x:x1 - x, None]
        # accumulate weights so anti-aliased shared edges add up instead of leaving dark seams
        out[y0:y1, x0:x1] += p * mk
        cov[y0:y1, x0:x1] += mk[..., 0]
    out /= np.maximum(cov, 1e-6)[..., None]
    return out, np.minimum(cov, 1.0)


def match_tone(src, ref, mask):
    """Match LAB mean/std of src to ref inside mask (keeps lighting consistent with the base)."""
    s = cv2.cvtColor(np.clip(src, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    r = cv2.cvtColor(ref.astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    m = mask > 0.5
    for c in range(3):
        sm, ss = s[..., c][m].mean(), s[..., c][m].std() + 1e-5
        rm, rs = r[..., c][m].mean(), r[..., c][m].std() + 1e-5
        if c == 0:  # brightness: shift only, so the era's own wrinkles/contrast survive
            s[..., c] = s[..., c] + (rm - sm) * 0.75
        else:       # colour: full match, removes warm/cool casts from different lighting
            s[..., c] = (s[..., c] - sm) * (rs / ss) + rm
    return cv2.cvtColor(np.clip(s, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)


def region_mask(d, names, shape, iod):
    """Feathered mask over the given landmark regions (used to keep the base's eyes/mouth)."""
    m = np.zeros(shape, np.uint8)
    groups = {'eyes': [['leftEye', 'leftEyebrow'], ['rightEye', 'rightEyebrow']], 'mouth': [['outerLips']]}
    for n in names:
        for g in groups.get(n, []):
            pts = np.array([p for k in g for p in d[k]], np.float32)
            if n == 'eyes':  # eye + lower half of brow, padded
                c = pts.mean(0); pts = c + (pts - c) * 1.25
            cv2.fillConvexPoly(m, cv2.convexHull(pts.astype(np.int32)), 255)
    m = cv2.dilate(m, np.ones((int(iod * .1),) * 2, np.uint8))
    return cv2.GaussianBlur(m.astype(np.float32) / 255, (0, 0), iod * 0.08)[..., None]


def fix_red_eye(img, d):
    """Neutralise flash red-eye inside the eye outlines (only strongly red pixels change)."""
    out = img.copy()
    for k in ('leftEye', 'rightEye'):
        m = np.zeros(img.shape[:2], np.uint8)
        cv2.fillConvexPoly(m, cv2.convexHull(np.array(d[k], np.int32)), 255)
        b, g, r = [out[..., c].astype(np.float32) for c in range(3)]
        red = (m > 0) & (r > 60) & (r > 1.4 * np.maximum(g, b))
        dark = (g + b) / 2
        out[..., 2] = np.where(red, dark, out[..., 2])
    return out


def region_indices(d):
    """Index range of every landmark region inside the stacked point array."""
    out, i = {}, 0
    for k in ORDER:
        out[k] = list(range(i, i + len(d[k]))); i += len(d[k])
    return out


def anchors(shape, centre, radius):
    """Fixed points (image border + a ring round the face) so only the face moves while morphing."""
    h, w = shape[:2]
    pts = [[0, 0], [w / 2, 0], [w - 1, 0], [w - 1, h / 2], [w - 1, h - 1], [w / 2, h - 1], [0, h - 1], [0, h / 2]]
    for a in np.linspace(0, 2 * np.pi, 20, endpoint=False):
        pts.append([centre[0] + np.cos(a) * radius, centre[1] + np.sin(a) * radius * 1.25])
    return np.clip(np.array(pts, np.float32), 0, [w - 1, h - 1])


def morph_frames(ca, ga, cb, gb, n, anc, shape):
    """True morph: both faces slide to an in-between shape, then blend, so features never double up."""
    pa, pb = np.vstack([ga, anc]), np.vstack([gb, anc])
    # drop landmark points that sit on top of another one (e.g. chin + median line): they collapse
    # Delaunay triangles and leave gaps
    keep = []
    for i in range(len(pa)):
        if all(np.linalg.norm(pa[i] - pa[j]) > 3 and np.linalg.norm(pb[i] - pb[j]) > 3 for j in keep):
            keep.append(i)
    pa, pb = pa[keep], pb[keep]
    frames = []
    for k in range(1, n):
        t = k / n
        e = t * t * (3 - 2 * t)  # smoothstep: shape moves a little ahead of colour for a cleaner blend
        p = pa * (1 - e) + pb * e
        tris = triangles(p, shape)
        wa, cva = warp_face(ca, pa, p, tris, shape)
        wb, cvb = warp_face(cb, pb, p, tris, shape)
        f = wa * (1 - t) + wb * t
        # any pixel the mesh still missed falls back to a plain blend (identical outside the face)
        cv = np.minimum(cva, cvb)[..., None]
        f = f * cv + (ca * (1 - t) + cb * t) * (1 - cv)
        f[..., 3] = ca[..., 3]  # silhouette is the shared base body: keep it pixel-identical (no edge halo)
        frames.append(np.clip(f, 0, 255).astype(np.uint8))
    return frames


def main():
    spec = json.loads(sys.argv[1])
    files = [SITE / e['file'] for e in spec]
    base_i = int(sys.argv[2])
    n_frames = int(sys.argv[3]) if len(sys.argv) > 3 else 14
    base = cv2.imread(str(files[base_i]), cv2.IMREAD_UNCHANGED)
    b_rgb, b_a = base[..., :3].astype(np.float32), base[..., 3]
    b_pts, b_d, iod = landmarks(files[base_i])
    idx = region_indices(b_d)

    hull = cv2.convexHull(b_pts.astype(np.int32))
    hard = np.zeros(base.shape[:2], np.uint8); cv2.fillConvexPoly(hard, hull, 255)
    hard = cv2.erode(hard, np.ones((int(iod * .12),) * 2, np.uint8))
    feather = cv2.GaussianBlur(hard.astype(np.float32) / 255, (0, 0), iod * 0.11)[..., None]

    comps, geoms = [], []
    for i, f in enumerate(files):
        if i == base_i:
            comps.append(base.astype(np.float32)); geoms.append(b_pts); print(f.name, 'base'); continue
        img = cv2.imread(str(f), cv2.IMREAD_UNCHANGED)
        e_pts, e_d, _ = landmarks(f)
        if spec[i].get('redeye'):
            img = fix_red_eye(img, e_d)
        # target geometry: era's own features (so its face shape shows), outline pulled to the base head;
        # regions borrowed from the base ('keep') stay exactly where the base has them
        w = np.full((len(b_pts), 1), 0.7, np.float32); w[:N_CONTOUR] = 0.3
        for k in spec[i].get('keep', []):
            for r in {'eyes': ['leftEye', 'rightEye', 'leftEyebrow', 'rightEyebrow', 'leftPupil', 'rightPupil'], 'mouth': ['outerLips', 'innerLips']}[k]:
                w[idx[r]] = 0
        tgt = b_pts + (e_pts - b_pts) * w
        warped4, cov = warp_face(img.astype(np.float32), e_pts, tgt, triangles(tgt, base.shape[:2]), b_rgb.shape)
        # only trust pixels the mesh covered AND that were the person (not cut-away background)
        cov = cov * (warped4[..., 3] / 255)
        tone_mask = (hard.astype(np.float32) / 255) * (cov > .9)
        warped = match_tone(warped4[..., :3], b_rgb, tone_mask)
        cov = cv2.GaussianBlur(cv2.erode(cov, np.ones((7, 7), np.uint8)), (0, 0), iod * 0.06)[..., None]
        warped = warped * cov + b_rgb * (1 - cov)
        fm = feather * cov
        if spec[i].get('keep'):
            fm = fm * (1 - region_mask(b_d, spec[i]['keep'], base.shape[:2], iod))
        comp = warped * fm + b_rgb * (1 - fm)
        comps.append(np.dstack([comp, b_a.astype(np.float32)])); geoms.append(tgt)
        print(f.name, 'mapped')

    out_dir = SITE / 'media/eras'
    q = [cv2.IMWRITE_WEBP_QUALITY, 86]
    eras = []
    for i, c in enumerate(comps):
        name = f'era-{i + 1:02d}.webp'
        cv2.imwrite(str(out_dir / name), np.clip(c, 0, 255).astype(np.uint8), q)
        eras.append({'file': f'media/eras/{name}', 'age': spec[i]['age'], 'label': spec[i]['label']})

    # in-between frames for every step, including the wrap-around back to the youngest
    centre = b_pts[:N_CONTOUR].mean(0); radius = 2.3 * iod
    anc = anchors(base.shape, centre, radius)
    trans = []
    for i in range(len(comps)):
        j = (i + 1) % len(comps)
        if j == i:
            break
        fr = morph_frames(comps[i], geoms[i], comps[j], geoms[j], n_frames, anc, base.shape)
        names = []
        for k, f in enumerate(fr):
            name = f't{i + 1}{j + 1}-{k + 1:02d}.webp'
            cv2.imwrite(str(out_dir / name), f, q); names.append(f'media/eras/{name}')
        trans.append({'from': i, 'to': j, 'frames': names})
        print(f'morph {i + 1}->{j + 1}: {len(fr)} frames')
    return eras, trans


if __name__ == '__main__':
    eras, trans = main()
    print('MANIFEST' + json.dumps({'eras': eras, 'transitions': trans}))
