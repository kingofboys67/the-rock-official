// Scans the parent folder for therock_* media, makes web-sized images,
// links videos, and writes site/media.json (newest first, grouped by post).
import { readdirSync, existsSync, linkSync, copyFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(here, '..');
const src = path.resolve(site, '..');

const files = readdirSync(src).filter(f => /^therock_\d+_\d+_\d+(?: \(\d+\))?\.(jpg|mp4)$/i.test(f) && !/ \(\d+\)\./.test(f));
const items = [], jobs = [];
for (const f of files) {
  const [, ts, id] = f.match(/^therock_(\d+)_(\d+)_/);
  const isVideo = f.toLowerCase().endsWith('.mp4');
  const base = f.replace(/^therock_/, '').replace(/_232192182/, '');
  if (isVideo) {
    const dest = path.join(site, 'media/video', base), poster = path.join(site, 'media/poster', base.replace(/\.mp4$/, '.jpg'));
    jobs.push(async () => {
      // web copy: <=720px short side, H.264 + AAC, fast-start. Never writes to the original.
      if (!existsSync(dest)) await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(src, f), '-vf', "scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)'", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', dest]);
      if (!existsSync(poster)) await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.8', '-i', dest, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', poster]);
    });
    items.push({ type: 'video', ts: +ts, id, file: `media/video/${base}`, poster: `media/poster/${base.replace(/\.mp4$/, '.jpg')}`, _src: path.join(src, f) });
  } else {
    const full = path.join(site, 'media/img', base), thumb = path.join(site, 'media/thumb', base);
    if (!existsSync(full)) execFileSync('sips', ['-Z', '1600', '-s', 'formatOptions', '78', path.join(src, f), '--out', full], { stdio: 'ignore' });
    if (!existsSync(thumb)) execFileSync('sips', ['-Z', '640', '-s', 'formatOptions', '70', path.join(src, f), '--out', thumb], { stdio: 'ignore' });
    const dim = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', thumb]).toString();
    const w = +dim.match(/pixelWidth: (\d+)/)[1], h = +dim.match(/pixelHeight: (\d+)/)[1];
    items.push({ type: 'image', ts: +ts, id, file: `media/img/${base}`, thumb: `media/thumb/${base}`, w, h });
  }
}
// run encodes 4 at a time
let next = 0;
await Promise.all(Array.from({ length: 4 }, async () => { while (next < jobs.length) { const j = jobs[next++]; try { await j(); } catch (e) { console.error('encode failed', e.message.slice(0, 200)); } if (next % 20 === 0) console.log(`encoded ${next}/${jobs.length}`); } }));
for (const i of items) if (i.type === 'video') { i.mb = Math.round(statSync(path.join(site, i.file)).size / 1e5) / 10; delete i._src; }
items.sort((a, b) => b.ts - a.ts || a.id.localeCompare(b.id));
writeFileSync(path.join(site, 'media.json'), JSON.stringify({ built: Date.now(), items }));
console.log(`${items.filter(i => i.type === 'image').length} images, ${items.filter(i => i.type === 'video').length} videos`);
