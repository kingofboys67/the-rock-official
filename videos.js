// videos.html: the full video collection, newest first, filterable by month, loaded 24 at a time.
(async () => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  // ---- topographic contour lines (same generator as the home page)
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
  $$('.contours').forEach((s, i) => s.insertAdjacentHTML('afterbegin', topo(1440, 900, 6151 + i * 977)));

  // ---- menu
  const menu = $('#menu'), mb = $('#menuBtn');
  const setMenu = o => { menu.hidden = !o; mb.setAttribute('aria-expanded', o); document.body.style.overflow = o ? 'hidden' : ''; };
  mb.onclick = () => setMenu(menu.hidden);
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

  // ---- data
  const { items } = await (await fetch('media.json')).json();
  const videos = items.filter(i => i.type === 'video');
  const fmt = ts => new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const monthKey = ts => new Date(ts * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const footerPhoto = items.find(i => i.file === 'media/img/1783330546_3935182615065044430.jpg');
  if (footerPhoto) ($('#footerImg') || {}).src = footerPhoto.thumb;

  // ---- lightbox
  let list = [], idx = 0;
  const lb = $('#lb'), stage = $('#lbStage'), cap = $('#lbCap');
  function show(i) {
    idx = (i + list.length) % list.length;
    const it = list[idx]; stage.replaceChildren();
    const m = el('video'); m.src = it.file.replace('/video/', '/preview/'); m.controls = true; m.autoplay = true; m.playsInline = true;
    m.addEventListener('error', () => { if (m.src && !m.src.endsWith(it.file)) { m.src = it.file; m.play().catch(() => {}); } });
    stage.append(m); cap.textContent = `${fmt(it.ts)} · ${idx + 1} / ${list.length}`;
  }
  const open = (l, i) => { list = l; lb.hidden = false; document.body.style.overflow = 'hidden'; show(i); };
  const close = () => { lb.hidden = true; stage.replaceChildren(); document.body.style.overflow = ''; };
  lb.querySelector('.lb-x').onclick = close;
  lb.querySelector('.prev').onclick = () => show(idx - 1);
  lb.querySelector('.next').onclick = () => show(idx + 1);
  lb.addEventListener('click', e => { if (e.target === lb || e.target === stage) close(); });
  addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  });

  // ---- tiles: clips play muted on their own while visible
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // video tiles play on their own (muted, looping) while on screen; they load as they near the viewport and pause when scrolled away
  const autoplay = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) { if (!v.src) v.src = v.dataset.src; if (!reduce) v.play().catch(() => {}); } else v.pause();
  }), { rootMargin: '300px 0px', threshold: 0.1 });
  const tile = (it, l, i) => {
    const b = el('button', 'tile'); b.setAttribute('aria-label', 'Watch video with sound');
    const v = el('video'); v.poster = it.poster; v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
    v.dataset.src = it.file.replace('/video/', '/preview/'); v.dataset.full = it.file; v.setAttribute('aria-hidden', 'true');
      v.addEventListener('error', () => { if (v.src && !v.src.endsWith(v.dataset.full)) { v.src = v.dataset.full; v.play().catch(() => {}); } }); // no preview yet: use the full clip
    b.append(v); autoplay.observe(v);
    b.onclick = () => open(l, i);
    return b;
  };

  // ---- month filters + paging
  const grid = $('#videoGrid'), filters = $('#videoFilters'), more = $('#videoMore'), count = $('#videoCount'), page = 24;
  let month = 'All', shown = 0, cur = videos;
  ['All', ...new Set(videos.map(i => monthKey(i.ts)))].forEach(m => {
    const c = el('button', 'chip' + (m === 'All' ? ' on' : ''), m);
    c.onclick = () => { month = m; filters.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); reset(); };
    filters.append(c);
  });
  function reset() {
    cur = month === 'All' ? videos : videos.filter(i => monthKey(i.ts) === month);
    grid.replaceChildren(); shown = 0; next(); count.textContent = `${cur.length} videos`;
  }
  function next() {
    cur.slice(shown, shown + page).forEach((it, k) => grid.append(tile(it, cur, shown + k)));
    shown = Math.min(cur.length, shown + page); more.hidden = shown >= cur.length;
  }
  more.onclick = next; reset();
})();
