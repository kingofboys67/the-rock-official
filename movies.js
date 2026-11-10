// movies.html: Top 10 ranking, complete catalog, and a per-film detail view (#movie/<id>),
// all built from media/movies.json (scripts/build-movies.py, then scripts/enrich-movies.py).
(async () => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

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
  $$('.contours').forEach((s, i) => s.insertAdjacentHTML('afterbegin', topo(1440, 900, 4243 + i * 977)));

  // ---- menu
  const menu = $('#menu'), mb = $('#menuBtn');
  const setMenu = o => { menu.hidden = !o; mb.setAttribute('aria-expanded', o); document.body.style.overflow = o ? 'hidden' : ''; };
  mb.onclick = () => setMenu(menu.hidden);
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));

  const films = await (await fetch('media/movies.json', { cache: 'no-cache' })).json();
  const byId = Object.fromEntries(films.map(f => [f.id, f]));
  fetch('media.json').then(r => r.json()).then(({ items }) => {
    const p = items.find(i => i.file === 'media/img/1783330546_3935182615065044430.jpg');
    if (p) ($('#footerImg') || {}).src = p.thumb;
  }).catch(() => {});

  const money = n => !n ? null : n >= 1e9 ? `$${(n / 1e9).toFixed(n >= 1.1e9 ? 2 : 3).replace(/0+$/, '').replace(/\.$/, '')}B` : `$${Math.round(n / 1e6)}M`;
  const rtNum = r => r ? parseInt(r, 10) : -1;
  const searchUrl = f => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(`${f.title} ${f.year} official trailer`);
  const runtime = m => m ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : null;
  const GENRE = { action: 'Action & Adventure', comedy: 'Comedy & Family', drama: 'Drama & Biopic' };

  // ---- posters: high-resolution key art sized for the slot, then theatrical poster, then a typographic fallback
  const hd = (url, w) => url ? url.replace(/\._V1_.*\.jpg$/, `._V1_QL85_UX${w}_.jpg`) : null;
  const poster = (f, w = 600, cls = 'catalog-poster') => {
    const src = hd(f.posterHD, w) || f.poster || '';
    const fb = f.posterHD && f.poster ? f.poster : '';
    return `<div class="${cls}"><img src="${esc(src)}" data-fallback="${esc(fb)}" alt="${esc(f.title)} (${f.year}) poster" loading="lazy" decoding="async" referrerpolicy="no-referrer"><div class="catalog-poster-alt" aria-hidden="true"><b>${esc(f.title)}</b><span>${f.year}</span></div></div>`;
  };
  const wirePosters = root => root.querySelectorAll('.catalog-poster img, .movie-detail-poster img').forEach(img => {
    const fail = () => {
      if (img.dataset.fallback && img.getAttribute('src') !== img.dataset.fallback) { img.src = img.dataset.fallback; return; }
      img.parentElement.classList.add('is-fallback');
    };
    if (!img.getAttribute('src')) return fail();
    img.addEventListener('error', fail);
    if (img.complete && !img.naturalWidth) fail();
  });

  // ---- trailer modal (used from the list views)
  const player = $('#player'), frame = $('#playerFrame');
  const ytEmbed = (id, extra = '') => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1&playsinline=1${extra}`;
  const playBtn = (f, label = 'Watch Official Trailer') => f.trailer
    ? `<button type="button" class="catalog-play" data-play="${esc(f.id)}">▶ ${label}</button>`
    : `<a class="catalog-play is-search" href="${searchUrl(f)}" target="_blank" rel="noopener noreferrer">▶ Watch Official Trailer ↗</a>`;
  const detailBtn = f => `<a class="catalog-play is-details" href="#movie/${esc(f.id)}">View Film &amp; Credits</a>`;
  let lastFocus = null;
  const openPlayer = f => {
    lastFocus = document.activeElement;
    $('#playerTitle').textContent = `${f.title} (${f.year}) — Official Trailer`;
    $('#playerExt').href = `https://www.youtube.com/watch?v=${encodeURIComponent(f.trailer)}`;
    frame.innerHTML = `<iframe src="${ytEmbed(f.trailer, '&autoplay=1')}" title="${esc(f.title)} official trailer" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    player.hidden = false; document.body.style.overflow = 'hidden';
    $('#playerClose').focus();
  };
  const closePlayer = () => { player.hidden = true; frame.replaceChildren(); document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); };
  $('#playerClose').onclick = closePlayer;
  player.addEventListener('click', e => { if (e.target === player) closePlayer(); });
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!player.hidden) closePlayer(); else if (!menu.hidden) setMenu(false);
  });
  document.addEventListener('click', e => { const b = e.target.closest('[data-play]'); if (b && byId[b.dataset.play]) openPlayer(byId[b.dataset.play]); });

  // ---- Signature Films — Essential Box Office & Acclaimed Roles
  const RANK = [
    { id: 'moana', title: 'Moana', years: '2016 / 2024 / 2026', role: 'Maui', gross: (byId['moana'].gross || 0) + (byId['moana-2'].gross || 0), grossNote: 'animated franchise',
      why: 'His defining generational family role inspired by his grandfather, High Chief Peter Maivia. The animated films surpassed $1.75 billion worldwide with 95% critical acclaim, anchored by the multi-platinum anthem “You’re Welcome,” expanding into the 2026 live-action theatrical event produced with Seven Bucks Productions.' },
    { id: 'smashing-machine', why: 'Directed by Benny Safdie for A24, his transformative dramatic portrayal of two-time UFC Heavyweight Tournament Champion Mark Kerr earned a 15-minute standing ovation at the Venice Film Festival and a Golden Globe nomination for Best Actor – Motion Picture Drama.' },
    { id: 'fast-five', why: 'The watershed franchise entry that reinvented Fast & Furious into a global heist juggernaut, introducing DSS Agent Luke Hobbs and igniting a multi-billion-dollar run.' },
    { id: 'jumanji-wttj', why: 'A $962M global box office phenomenon for Sony Pictures—showcasing his comedic range as a nervous high-school teenager trapped inside the towering avatar of Dr. Smolder Bravestone.' },
    { id: 'furious-7', why: 'The highest-grossing theatrical release of his career ($1.515B worldwide), anchoring the ensemble’s historic tribute to Paul Walker.' },
    { id: 'rundown', why: 'An action-comedy milestone directed by Peter Berg—featuring Arnold Schwarzenegger’s iconic on-screen torch-passing cameo—that established his command as a solo Hollywood leading man.' },
    { id: 'fighting-family', why: 'Produced by Seven Bucks Productions and written/directed by Stephen Merchant, this acclaimed biographical comedy-drama (93% Critics Score) chronicled WWE’s Paige with Johnson appearing as himself.' },
    { id: 'pain-gain', why: 'One of his most daring character turns—portraying conflicted ex-con Paul Doyle in Michael Bay’s satirical crime drama alongside Mark Wahlberg and Anthony Mackie.' },
    { id: 'san-andreas', why: 'An original Warner Bros. tentpole carried on his shoulders as LAFD rescue pilot Ray Gaines, grossing $474M worldwide as an original non-sequel property.' },
    { id: 'black-adam', why: 'A decade-long passion project produced with Seven Bucks Productions that delivered the highest-grossing theatrical opening weekend of his career as a solo lead ($393M worldwide).' },
  ].map((r, i) => {
    const f = byId[r.id];
    return { ...f, n: i + 1, title: r.title || f.title, years: r.years || String(f.year), role: r.role || f.role, gross: r.gross ?? f.gross, grossNote: r.grossNote, why: r.why };
  });
  const rankList = $('#rankList');
  const renderRank = by => {
    const list = [...RANK].sort((a, b) => by === 'gross' ? (b.gross || 0) - (a.gross || 0) : by === 'rt' ? rtNum(b.rt) - rtNum(a.rt) : a.n - b.n);
    rankList.innerHTML = list.map(r => `<li class="catalog-rank">
      <div class="catalog-rank-n">${r.n}<small>${by === 'rank' ? 'Rank' : `Ranked #${r.n}`}</small></div>
      <a class="catalog-open" href="#movie/${esc(r.id)}" aria-label="Open ${esc(r.title)}">${poster(r, 300)}</a>
      <div>
        <h3><a class="catalog-open" href="#movie/${esc(r.id)}">${esc(r.title)}</a><span>${esc(r.years)}</span></h3>
        <p class="catalog-role">as ${esc(r.role)}</p>
        <p class="catalog-why">${esc(r.why)}</p>
      </div>
      <div class="catalog-stats">
        <span class="catalog-stat"><b>${money(r.gross) || '—'}</b>${r.grossNote ? 'worldwide, ' + esc(r.grossNote) : 'worldwide'}</span>
        <span class="catalog-stat"><b>${r.rt || '—'}</b>Critics Score</span>
        <div class="catalog-actions">
          ${detailBtn(r)}
          ${playBtn(r, 'Watch Official Trailer')}
        </div>
      </div>
    </li>`).join('');
    wirePosters(rankList);
  };
  $('#rankSort').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#rankSort button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderRank(b.dataset.sort);
  });
  renderRank('rank');

  // ---- complete catalog: search + genre/decade filters
  const grid = $('#catalogGrid'), count = $('#catalogCount'), search = $('#catalogSearch');
  let filter = 'all';
  const tagFor = f => f.tag && !/^(Cameo|Voice role)$/.test(f.tag) ? f.tag : f.gross ? `${money(f.gross)} worldwide` : f.tag || (f.rt ? `${f.rt} Critics Score` : '');
  const card = f => `<article class="catalog-card" id="film-${esc(f.id)}">
      <a class="catalog-open" href="#movie/${esc(f.id)}" aria-label="Open ${esc(f.title)}">${poster(f, 600)}</a>
      <h3><a class="catalog-open" href="#movie/${esc(f.id)}">${esc(f.title)}</a><span>${f.year}</span></h3>
      <p class="catalog-role">as ${esc(f.role)}</p>
      <p class="catalog-synopsis"><b>About the movie</b>${esc(f.synopsis)}</p>
      ${tagFor(f) ? `<span class="catalog-tag">${esc(tagFor(f))}</span>` : ''}
      <div class="catalog-actions">
        ${detailBtn(f)}
        ${playBtn(f, 'Watch Official Trailer')}
      </div>
    </article>`;
  const decade = y => `${String(y).slice(0, 3)}0s`;
  const renderCatalog = () => {
    const q = search.value.trim().toLowerCase();
    const list = films.filter(f =>
      (filter === 'all' || f.genres.includes(filter) || decade(f.year) === filter) &&
      (!q || (f.title + ' ' + f.role).toLowerCase().includes(q)));
    grid.innerHTML = list.length ? list.map(card).join('') : '<p class="catalog-empty">No films match that search.</p>';
    count.textContent = `${list.length} ${list.length === 1 ? 'film' : 'films'}`;
    wirePosters(grid);
  };
  $('#catalogFilters').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    filter = b.dataset.f;
    $$('#catalogFilters button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderCatalog();
  });
  search.addEventListener('input', renderCatalog);
  renderCatalog();

  // ---- movie detail view (#movie/<id>): cover trailer, overlapping poster, details, cast, trailer, related
  const listView = $('#moviesList'), detail = $('#movieDetail');
  const FRANCHISE = [
    ['fast-five', 'ff6', 'furious-7', 'fate-furious', 'hobbs-shaw', 'fast-x'],
    ['jumanji-wttj', 'jumanji-next', 'jumanji-3'], ['moana', 'moana-2', 'moana-live'],
    ['mummy-returns', 'scorpion-king'], ['black-adam', 'super-pets'],
  ];
  const related = f => {
    const fam = FRANCHISE.find(g => g.includes(f.id)) || [];
    return films.filter(x => x.id !== f.id).map(x => ({ x, s:
      (fam.includes(x.id) ? 10 : 0) + x.genres.filter(g => f.genres.includes(g)).length * 2 - Math.abs(x.year - f.year) / 6 + (x.gross ? Math.log10(x.gross) / 4 : 0) }))
      .sort((a, b) => b.s - a.s).slice(0, 4).map(r => r.x);
  };
  const about = f => {
    const s = [f.synopsis];
    if (f.director) s.push(`Directed by ${f.director.join(' and ')}.`);
    if (f.gross && f.tag !== 'Upcoming') s.push(`It grossed ${money(f.gross)} worldwide${f.rt ? `, earning a ${f.rt} Critics Score` : ''}.`);
    else if (f.rt) s.push(`It holds a ${f.rt} Critics Score.`);
    return s.join(' ');
  };
  const cmd = (iframe, func, args = []) => iframe && iframe.contentWindow && iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*');

  function showDetail(f) {
    const meta = [f.year, f.rating, runtime(f.runtime)].filter(Boolean);
    const cover = f.trailer
      ? `<iframe class="movie-detail-cover-video" src="${ytEmbed(f.trailer, `&autoplay=1&mute=1&controls=0&loop=1&playlist=${encodeURIComponent(f.trailer)}&disablekb=1&enablejsapi=1&iv_load_policy=3`)}" title="${esc(f.title)} trailer (background)" allow="autoplay; encrypted-media" tabindex="-1" aria-hidden="true"></iframe>
         <button type="button" class="movie-detail-mute" id="coverMute" aria-pressed="false" aria-label="Turn trailer sound on">🔇 Sound off</button>`
      : `<div class="movie-detail-cover-still" style="background-image:url('${esc(hd(f.posterHD, 1200) || f.poster || '')}')"></div>`;
    detail.innerHTML = `
      <div class="movie-detail-bar"><a class="movie-detail-back" href="#catalog">← Back to movies</a></div>
      <header class="movie-detail-cover">${cover}<div class="movie-detail-vignette"></div></header>
      <div class="movie-detail-head">
        ${poster(f, 900, 'catalog-poster movie-detail-poster')}
        <div class="movie-detail-info">
          <h1>${esc(f.title)}</h1>
          <p class="movie-detail-meta">${meta.map(m => `<span>${esc(m)}</span>`).join('')}</p>
          <p class="movie-detail-genres">${f.genres.map(g => `<span>${GENRE[g]}</span>`).join('')}${f.tag ? `<span class="is-tag">${esc(f.tag)}</span>` : ''}</p>
          <p class="movie-detail-as">as <strong>${esc(f.role)}</strong></p>
        </div>
        <div class="movie-detail-cta">
          ${f.trailer ? '<button type="button" class="movie-detail-watch" id="watchTrailer">▶ Watch Official Trailer</button>'
                      : `<a class="movie-detail-watch is-search" href="${searchUrl(f)}" target="_blank" rel="noopener noreferrer">▶ Watch Official Trailer ↗</a>`}
        </div>
      </div>
      <div class="movie-detail-body">
        <section class="movie-detail-about">
          <h2>About the film &amp; production</h2>
          <p>${esc(about(f))}</p>
          <dl class="movie-detail-facts">
            ${f.director ? `<div><dt>Director</dt><dd>${esc(f.director.join(', '))}</dd></div>` : ''}
            ${f.runtime ? `<div><dt>Runtime</dt><dd>${f.runtime} min</dd></div>` : ''}
            ${f.rating ? `<div><dt>Rated</dt><dd>${esc(f.rating)}</dd></div>` : ''}
            ${f.gross ? `<div><dt>Box office</dt><dd>${money(f.gross)}</dd></div>` : ''}
            ${f.rt ? `<div><dt>Critics Score</dt><dd>${esc(f.rt)}</dd></div>` : ''}
          </dl>
        </section>
        <section class="movie-detail-cast">
          <h2>Principal cast &amp; credits</h2>
          <ul>
            <li class="is-lead"><b>Dwayne Johnson</b><span>${esc(f.role)}</span></li>
            ${(f.cast || []).map(c => `<li><b>${esc(c.actor)}</b><span>${esc(c.role)}</span></li>`).join('')}
            ${f.director ? `<li class="is-crew"><b>${esc(f.director.join(', '))}</b><span>Director</span></li>` : ''}
          </ul>
        </section>
      </div>
      <section class="movie-detail-trailer" id="detailTrailer">
        <h2>Watch Official Trailer</h2>
        ${f.trailer ? `<div class="movie-detail-player" id="detailPlayer">
            <button type="button" class="movie-detail-player-start" id="detailStart" style="background-image:url('${esc(`https://i.ytimg.com/vi/${encodeURIComponent(f.trailer)}/hqdefault.jpg`)}')"><span>▶ Play Official Trailer with Sound</span></button>
          </div>
          <a class="movie-detail-yt" href="https://www.youtube.com/watch?v=${encodeURIComponent(f.trailer)}" target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a>`
        : `<p class="movie-detail-none">No embedded trailer is currently queued for this title. <a href="${searchUrl(f)}" target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a></p>`}
      </section>
      <section class="movie-detail-more">
        <h2>Related films in the catalog</h2>
        <div class="movie-detail-more-grid">
          ${related(f).map(r => `<a class="movie-detail-more-card" href="#movie/${esc(r.id)}">${poster(r, 500)}<b>${esc(r.title)}</b><span>${r.year}</span></a>`).join('')}
        </div>
      </section>`;
    wirePosters(detail);

    const coverVideo = detail.querySelector('.movie-detail-cover-video');
    const mute = $('#coverMute');
    if (mute) mute.onclick = () => {
      const on = mute.getAttribute('aria-pressed') !== 'true';
      cmd(coverVideo, on ? 'unMute' : 'mute'); if (on) cmd(coverVideo, 'playVideo');
      mute.setAttribute('aria-pressed', String(on));
      mute.setAttribute('aria-label', on ? 'Turn trailer sound off' : 'Turn trailer sound on');
      mute.textContent = on ? '🔊 Sound on' : '🔇 Sound off';
    };
    const startMain = () => {
      const box = $('#detailPlayer'); if (!box || box.querySelector('iframe')) return;
      cmd(coverVideo, 'pauseVideo');
      box.innerHTML = `<iframe src="${ytEmbed(f.trailer, '&autoplay=1')}" title="${esc(f.title)} official trailer" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    };
    const start = $('#detailStart'); if (start) start.onclick = startMain;
    const watch = $('#watchTrailer');
    if (watch) watch.onclick = () => { $('#detailTrailer').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); startMain(); };

    document.title = `${f.title} (${f.year}) | Dwayne "The Rock" Johnson Official Website`;
    listView.hidden = true; detail.hidden = false;
    scrollTo(0, 0);
  }
  function showList(target) {
    detail.hidden = true; detail.replaceChildren(); listView.hidden = false;
    document.title = 'Filmography & Movies | Dwayne "The Rock" Johnson Official Website';
    const t = target && document.getElementById(target);
    if (t) t.scrollIntoView({ block: target.startsWith('film-') ? 'center' : 'start' });
  }
  let lastListHash = '';
  const route = () => {
    const h = decodeURIComponent(location.hash.slice(1));
    if (h.startsWith('film-')) { location.replace('#movie/' + h.slice(5)); return; } // old deep links
    const m = h.match(/^movie\/(.+)$/);
    if (m && byId[m[1]]) { showDetail(byId[m[1]]); return; }
    showList(h || lastListHash);
    lastListHash = '';
  };
  // remember the card you came from, so "Back to movies" returns to it
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#movie/"]');
    if (a && !detail.contains(a)) { const c = a.closest('.catalog-card, .catalog-rank'); lastListHash = c && c.id ? c.id : (c ? 'ranking' : ''); }
  });
  detail.addEventListener('click', e => {
    if (e.target.closest('.movie-detail-back') && lastListHash) { e.preventDefault(); history.pushState(null, '', location.pathname); showList(lastListHash); }
  });
  addEventListener('hashchange', route);
  route();
})();
