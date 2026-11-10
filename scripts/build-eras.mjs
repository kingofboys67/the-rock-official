// Builds the aging-hero portraits: cuts each era photo out of its background and aligns
// the eyes to one spot so cross-fades between eras read as the same face growing older.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(site, 'scripts/.bin/cutout');
const { eras } = JSON.parse(readFileSync(path.join(site, 'eras/eras.json'), 'utf8'));
const CW = 900, CH = 1200, EX = 450, EY = 400, IOD = 168;
mkdirSync(path.join(site, 'media/eras'), { recursive: true });

const out = [];
eras.forEach((e, i) => {
  const dest = `media/eras/${String(i + 1).padStart(2, '0')}.png`;
  const args = [path.join(site, 'eras', e.src), path.join(site, dest), CW, CH, EX, EY, IOD, ...(e.crop || [])].map(String);
  try { const r = execFileSync(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim().split('\n').pop(); console.log(e.src, r); }
  catch (err) { console.error(`skipped ${e.src}: no face/subject found`); return; }
  out.push({ file: dest, age: e.age, label: e.label, keep: e.keep || [], base: !!e.base, redeye: !!e.redeye, src: e.src });
});

// map every era's face onto the base head and render true-morph frames between them
const base = Math.max(0, out.findIndex(e => e.base));
const py = process.env.PYTHON || 'python3';
for (const f of readdirSync(path.join(site, 'media/eras'))) if (/\.webp$/.test(f)) unlinkSync(path.join(site, 'media/eras', f));
const log = execFileSync(py, ['-I', path.join(site, 'scripts/age-morph.py'), JSON.stringify(out), String(base), '14'], { stdio: ['ignore', 'pipe', 'inherit'] }).toString();
const lines = log.trim().split('\n'); lines.filter(l => !l.startsWith('MANIFEST')).forEach(l => console.log(l));
const manifest = JSON.parse(lines.find(l => l.startsWith('MANIFEST')).slice(8));
const v = Date.now().toString(36), bust = f => `${f}?v=${v}`;
manifest.eras.forEach(e => { e.file = bust(e.file); });
manifest.transitions.forEach(t => { t.frames = t.frames.map(bust); });
writeFileSync(path.join(site, 'media/eras.json'), JSON.stringify({ canvas: [CW, CH], ...manifest }));
