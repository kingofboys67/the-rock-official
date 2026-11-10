// photos.html: a pure picture gallery (no captions), built from media/gallery.json (scripts/build-gallery.py).
(async () => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

  // ---- topographic contour lines (same generator as the other pages)
  function topo(w, h, seed) {
    let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const blobs = 2 + Math.floor(rnd() * 2), out = [];
    for (let b = 0; b < blobs; b++) {
      const cx = rnd() * w, cy = rnd() * h, p1 = rnd() * 6, p2 = rnd() * 6, p3 = rnd() * 6;
      for (let r = 1; r <= 16; r++) {
        const R = r * Math.min(w, h) * 0.055; let d = '';
        for (let a = 0; a <= 64; a++) {
          const t = a / 64 * Math.PI * 2;
          const k = R * (1 + .22 * Math.sin(3 * t + p1) + .12 * Math.sin(5 * t + p2) + .06 * Math.sin(8 * t + p3 + r * .15));
          d += (a ? 'L' : 'M') + (cx + Math.cos(t) * k * 1.5).toFixed(1) + ' ' + (cy + Math.sin(t) * k).toFixed(1);
        }
        out.push(`<path d="${d}Z"/>`);
      }
    }
    return `<svg class="topo" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${out.join('')}</svg>`;
  }
  $$('.contours').forEach((s, i) => s.insertAdjacentHTML('afterbegin', topo(1440, 900, 5303 + i * 977)));

  // ---- menu
  const menu = $('#menu'), mb = $('#menuBtn');
  const setMenu = o => { menu.hidden = !o; mb.setAttribute('aria-expanded', o); document.body.style.overflow = o ? 'hidden' : ''; };
  mb.onclick = () => setMenu(menu.hidden);
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));

  const photos = await (await fetch('media/gallery.json', { cache: 'no-cache' })).json();
  if ($('#footerImg') && photos[0]) $('#footerImg').src = photos[0].thumb;

  // ---- lightbox: the picture only
  let idx = 0;
  const lb = $('#lb'), stage = $('#lbStage'), cap = $('#lbCap');
  const show = i => {
    idx = (i + photos.length) % photos.length;
    const im = el('img'); im.src = photos[idx].file; im.alt = 'Dwayne Johnson';
    stage.replaceChildren(im); cap.textContent = '';
    [photos[idx + 1], photos[idx - 1]].forEach(p => { if (p) new Image().src = p.file; }); // preload neighbours
  };
  const open = i => { lb.hidden = false; document.body.style.overflow = 'hidden'; show(i); };
  const close = () => { lb.hidden = true; stage.replaceChildren(); document.body.style.overflow = ''; };
  lb.querySelector('.lb-x').onclick = close;
  lb.querySelector('.prev').onclick = () => show(idx - 1);
  lb.querySelector('.next').onclick = () => show(idx + 1);
  lb.addEventListener('click', e => { if (e.target === lb || e.target === stage) close(); });
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (!lb.hidden) close(); else if (!menu.hidden) setMenu(false); }
    if (lb.hidden) return;
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  });
  let x0 = null; // swipe on touch screens
  lb.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1)); x0 = null; });

  // ---- gallery: masonry of every photo, loaded in batches as you scroll
  const gallery = $('#gallery'), sentinel = $('#gallerySentinel'), BATCH = 36;
  let shown = 0;
  const more = () => {
    photos.slice(shown, shown + BATCH).forEach((p, k) => {
      const i = shown + k;
      const b = el('button', 'photos-gallery-item'); b.type = 'button';
      b.setAttribute('aria-label', 'Open photo');
      const im = el('img'); im.src = p.thumb; im.alt = 'Dwayne Johnson'; im.loading = 'lazy'; im.decoding = 'async';
      im.width = p.w; im.height = p.h;
      b.append(im); b.onclick = () => open(i);
      gallery.append(b);
    });
    shown = Math.min(photos.length, shown + BATCH);
    if (shown >= photos.length) io.disconnect();
  };
  // keep loading while the bottom is near (the observer only fires on changes, so re-check after each batch)
  const near = () => sentinel.getBoundingClientRect().top < innerHeight + 1200;
  const fill = () => { if (shown < photos.length && near()) { more(); requestAnimationFrame(fill); } };
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) fill(); }, { rootMargin: '1200px 0px' });
  more(); io.observe(sentinel);
})();
