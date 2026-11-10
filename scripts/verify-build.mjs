import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const htmlFiles = fs.readdirSync(root).filter(f => f.endsWith('.html'));
const jsFiles = fs.readdirSync(root).filter(f => f.endsWith('.js'));

console.log(`Verifying ${htmlFiles.length} HTML pages and ${jsFiles.length} JS modules...`);

for (const jf of jsFiles) {
  execFileSync('node', ['--check', path.join(root, jf)], { stdio: 'inherit' });
}

for (const hf of htmlFiles) {
  const content = fs.readFileSync(path.join(root, hf), 'utf8');
  const ldMatch = content.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
  if (!ldMatch) throw new Error(`Missing JSON-LD in ${hf}`);
  JSON.parse(ldMatch[1]);

  // Verify local relative img src paths exist
  const imgSrcs = [...content.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m => m[1]);
  for (const src of imgSrcs) {
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) continue;
    const clean = src.split('?')[0];
    if (!fs.existsSync(path.join(root, clean))) {
      throw new Error(`Missing image asset referenced in ${hf}: ${src}`);
    }
  }
}

for (const heroAsset of ['rock-24.webp', 'rock-29.webp', 'rock-30.webp', 'rock-54.webp', 'rock-24.png', 'rock-29.png', 'rock-30.png', 'rock-54.png']) {
  const p = path.join(root, 'assets/hero', heroAsset);
  if (!fs.existsSync(p)) throw new Error(`Missing Hero era portrait in assets/hero: ${p}`);
}

for (const stage of ['stage-01.webp', 'stage-02.webp', 'stage-03.webp', 'stage-04.webp', 'stage-01.png', 'stage-02.png', 'stage-03.png', 'stage-04.png']) {
  const p = path.join(root, 'media/eras', stage);
  if (!fs.existsSync(p)) throw new Error(`Missing Hero era portrait in media/eras: ${p}`);
}

console.log('Production build check passed with 0 errors.');

