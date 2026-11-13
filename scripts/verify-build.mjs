import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlFiles = fs.readdirSync(root).filter(f => f.endsWith('.html'));
const jsFiles = fs.readdirSync(root).filter(f => f.endsWith('.js'));

console.log(`Verifying ${htmlFiles.length} HTML pages and ${jsFiles.length} JS modules...`);

// Fill in the site's address. Pages use the token __SITE_URL__ so the domain lives in one place:
// set SITE_URL in Vercel (e.g. https://yourfansite.com); otherwise the Vercel production URL is used.
const SITE_URL = (process.env.SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  || (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`)
  || '').replace(/\/$/, '');
const tokenFiles = [...htmlFiles, 'sitemap.xml', 'robots.txt', 'llms.txt', 'llms-full.txt'];
if (SITE_URL) {
  for (const f of tokenFiles) {
    const p = path.join(root, f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replaceAll('__SITE_URL__', SITE_URL));
  }
  console.log(`Site address set to ${SITE_URL}`);
} else {
  console.log('SITE_URL not set (local check): leaving __SITE_URL__ tokens in place.');
}

for (const jf of jsFiles) {
  execFileSync('node', ['--check', path.join(root, jf)], { stdio: 'inherit' });
}
execFileSync('node', ['--check', path.join(root, 'api/fan-club.js')], { stdio: 'inherit' });

const requiredRootAssets = [
  'og-image.jpg',
  'favicon.ico',
  'icon.svg',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'site.webmanifest',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'llms-full.txt',
  'd84f92a1c7e34b6091f52026dwaynedj.txt'
];

for (const asset of requiredRootAssets) {
  const p = path.join(root, asset);
  if (!fs.existsSync(p)) throw new Error(`Missing required SEO/GEO/icon root asset: ${asset}`);
}

for (const hf of htmlFiles) {
  const content = fs.readFileSync(path.join(root, hf), 'utf8');

  // 1. Validate JSON-LD
  const ldMatch = content.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
  if (!ldMatch) throw new Error(`Missing JSON-LD in ${hf}`);
  JSON.parse(ldMatch[1]);

  // 2. Ensure zero dead placeholder href="#" links
  if (/href="\s*#\s*"/.test(content)) {
    throw new Error(`Found dead placeholder href="#" link in ${hf}`);
  }

  // 3. Ensure canonical, OG card, and favicon links exist
  if (!/<link rel="canonical" href="[^"]+">/.test(content)) {
    throw new Error(`Missing canonical link in ${hf}`);
  }
  if (!content.includes('/og-image.jpg')) {
    throw new Error(`Missing 1200x630 og-image.jpg reference in ${hf}`);
  }
  // 5. It must stay clearly an unofficial fan site
  if (!/Unofficial fan site/i.test(content)) throw new Error(`Missing unofficial fan site notice in ${hf}`);
  if (/Official Website|All Rights Reserved|dwaynejohnsonofficial/i.test(content)) throw new Error(`Page presents itself as official: ${hf}`);
  if (!content.includes('/favicon.ico') || !content.includes('/site.webmanifest')) {
    throw new Error(`Missing favicon/webmanifest tags in ${hf}`);
  }

  // 4. Verify local relative img src paths exist
  const imgSrcs = [...content.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m => m[1]);
  for (const src of imgSrcs) {
    if (!src || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) continue;
    const clean = src.split('?')[0].replace(/^\//, '');
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

// Verify image weight cap (<250KB) across Hero, Story, About, and Era directories
const maxBytes = 250 * 1024;
for (const dirRel of ['assets/hero', 'assets/story', 'media/about', 'media/eras', 'eras']) {
  const dir = path.join(root, dirRel);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(webp|png|jpe?g)$/i.test(f)) continue;
    const st = fs.statSync(path.join(dir, f));
    if (st.size > maxBytes) {
      throw new Error(`Oversized image (>250KB): ${dirRel}/${f} (${Math.round(st.size / 1024)}KB)`);
    }
  }
}

// Verify JSON data asset integrity
const gallery = JSON.parse(fs.readFileSync(path.join(root, 'media/gallery.json'), 'utf8'));
for (const g of gallery) {
  if (!fs.existsSync(path.join(root, g.file)) || !fs.existsSync(path.join(root, g.thumb))) {
    throw new Error(`Missing gallery photo asset: ${g.file}`);
  }
}

const moviesRaw = JSON.parse(fs.readFileSync(path.join(root, 'media/movies.json'), 'utf8'));
const movieList = Array.isArray(moviesRaw) ? moviesRaw : (moviesRaw.movies || []);
for (const m of movieList) {
  const localPoster = m.posterLocal || m.poster;
  if (localPoster && !localPoster.startsWith('http://') && !localPoster.startsWith('https://') && !fs.existsSync(path.join(root, localPoster))) {
    throw new Error(`Missing movie poster asset: ${localPoster}`);
  }
}

console.log(`Production build check passed with 0 errors (${htmlFiles.length} pages, ${gallery.length} gallery photos, ${movieList.length} films).`);
