// About section: reveal animations for .about-* elements (home teaser + about.html).
// On about.html it also runs that page's background lines, menu, nav colour, chapter nav and photo credits.
// It never touches the hero; on the home page app.js keeps doing everything else.
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15 });
  $$('.about-reveal').forEach(e => io.observe(e));

  if (!document.body.classList.contains('about-page')) return;

  // topographic contour lines (same generator as the home page)
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
  $$('.contours').forEach((s, i) => s.insertAdjacentHTML('afterbegin', topo(1440, 900, 3571 + i * 977)));

  // menu
  const menu = $('#menu'), mb = $('#menuBtn');
  const setMenu = o => { menu.hidden = !o; mb.setAttribute('aria-expanded', o); document.body.style.overflow = o ? 'hidden' : ''; };
  mb.onclick = () => setMenu(menu.hidden);
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

  // (the nav has a solid light bar on this page, so its logo never needs to flip colour)

  // chapter nav: highlight the chapter in view
  const links = $$('.about-toc a'), toc = $('.about-toc');
  const tocObs = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
    const on = links.find(a => a.classList.contains('on'));
    if (on) toc.scrollTo({ left: on.offsetLeft - toc.clientWidth / 2 + on.offsetWidth / 2, behavior: 'smooth' });
  }), { rootMargin: '-45% 0px -50% 0px' });
  links.forEach(a => { const t = $(a.getAttribute('href')); if (t) tocObs.observe(t); });

  // image slots: preserve native loading="lazy" below the fold; update credits if any slot falls back.
  let creditsMap = null;
  const renderCredits = () => {
    if (!creditsMap || !$('#credits')) return;
    const used = [...new Set($$('main img[data-credit]').filter(i => !i.closest('.is-empty')).map(i => i.dataset.credit))].map(k => creditsMap[k]).filter(Boolean);
    $('#credits').innerHTML = 'Photos via Wikimedia Commons: ' + used.map(c => '<a href="' + esc(c.page) + '" target="_blank" rel="noopener noreferrer">' + esc(c.artist || 'contributor') + '</a> (' + esc(c.license) + ')').join(', ') + '. Other photos shared by @therock.';
  };
  $$('figure.about-timeline-media img').forEach(img => {
    const fig = img.closest('figure');
    const fail = () => {
      if (img.dataset.fallback && img.getAttribute('src') !== img.dataset.fallback) {
        img.src = img.dataset.fallback;
        if (img.dataset.fallbackCredit) img.dataset.credit = img.dataset.fallbackCredit;
      } else { fig.classList.add('is-empty'); }
      renderCredits();
    };
    img.addEventListener('error', fail);
    img.addEventListener('load', () => fig.classList.remove('is-empty'));
    if (img.complete && !img.naturalWidth) fail();
  });

  // filmography, filterable by era (titles and years checked against public filmographies)
  const ERAS = [
    ['all', 'All'], ['early', '1999–2005'], ['pivot', '2006–2010'], ['titan', '2011–2021'], ['drama', '2022–2026'],
  ];
  const FILMS = [
    [1999, 'That ’70s Show', 'Rocky Johnson (his father)', 'TV debut', 'early'],
    [2001, 'The Mummy Returns', 'Mathayus / The Scorpion King', 'Film debut', 'early'],
    [2002, 'The Scorpion King', 'Mathayus', '$5.5M, a Guinness record for a first lead', 'early'],
    [2003, 'The Rundown', 'Beck', 'Schwarzenegger cameo', 'early'],
    [2004, 'Walking Tall', 'Chris Vaughn', '', 'early'],
    [2005, 'Be Cool', 'Elliot Wilhelm', '', 'early'],
    [2005, 'Doom', 'Sarge', '', 'early'],
    [2006, 'Gridiron Gang', 'Sean Porter', '', 'pivot'],
    [2006, 'Southland Tales', 'Boxer Santaros', '', 'pivot'],
    [2007, 'The Game Plan', 'Joe Kingman', '', 'pivot'],
    [2008, 'Get Smart', 'Agent 23', '', 'pivot'],
    [2009, 'Race to Witch Mountain', 'Jack Bruno', '', 'pivot'],
    [2010, 'Tooth Fairy', 'Derek Thompson', '', 'pivot'],
    [2010, 'Faster', 'Driver', '', 'pivot'],
    [2010, 'The Other Guys', 'Christopher Danson', '', 'pivot'],
    [2011, 'Fast Five', 'Luke Hobbs', 'Joins the Fast franchise', 'titan'],
    [2012, 'Journey 2: The Mysterious Island', 'Hank Parsons', '', 'titan'],
    [2013, 'G.I. Joe: Retaliation', 'Roadblock', '', 'titan'],
    [2013, 'Pain & Gain', 'Paul Doyle', '', 'titan'],
    [2013, 'Fast & Furious 6', 'Luke Hobbs', '', 'titan'],
    [2014, 'Hercules', 'Hercules', '', 'titan'],
    [2015, 'Furious 7', 'Luke Hobbs', '$1.515B worldwide', 'titan'],
    [2015, 'San Andreas', 'Ray Gaines', '', 'titan'],
    [2015, 'Ballers', 'Spencer Strasmore', 'HBO series, 2015–2019', 'titan'],
    [2016, 'Central Intelligence', 'Bob Stone', '', 'titan'],
    [2016, 'Moana', 'Maui (voice)', '', 'titan'],
    [2017, 'The Fate of the Furious', 'Luke Hobbs', '', 'titan'],
    [2017, 'Baywatch', 'Mitch Buchannon', '', 'titan'],
    [2017, 'Jumanji: Welcome to the Jungle', 'Dr. Smolder Bravestone', '', 'titan'],
    [2018, 'Rampage', 'Davis Okoye', '', 'titan'],
    [2018, 'Skyscraper', 'Will Sawyer', '', 'titan'],
    [2019, 'Hobbs & Shaw', 'Luke Hobbs', 'Spin-off', 'titan'],
    [2019, 'Jumanji: The Next Level', 'Dr. Smolder Bravestone', '', 'titan'],
    [2021, 'Jungle Cruise', 'Frank Wolff', '', 'titan'],
    [2021, 'Red Notice', 'John Hartley', 'Netflix', 'titan'],
    [2022, 'Black Adam', 'Teth-Adam / Black Adam', '', 'drama'],
    [2024, 'Red One', 'Callum Drift', '', 'drama'],
    [2024, 'Moana 2', 'Maui (voice)', '', 'drama'],
    [2025, 'The Smashing Machine', 'Mark Kerr', 'Golden Globe nomination, Best Actor – Drama', 'drama'],
    [2026, 'Moana', 'Maui', 'Live-action remake', 'drama'],
  ];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const filters = $('.about-films-filters'), list = $('.about-films-list');
  if (filters && list) {
    const show = era => {
      filters.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.era === era)));
      list.innerHTML = FILMS.filter(f => era === 'all' || f[4] === era).map(([y, t, r, n]) =>
        '<li><span class="about-film-year">' + y + '</span><span class="about-film-title"><i>' + esc(t) + '</i></span><span class="about-film-role">' + esc(r) + '</span><span class="about-film-note">' + esc(n) + '</span></li>').join('');
    };
    filters.innerHTML = ERAS.map(([k, label]) => '<button type="button" data-era="' + k + '" aria-pressed="false">' + label + '</button>').join('');
    filters.addEventListener('click', e => { const b = e.target.closest('button'); if (b) show(b.dataset.era); });
    show('all');
  }

  // photo credits (licences require attribution): one line in the footer, nothing under the photos
  fetch('media/about/credits.json').then(r => r.json()).then(cr => {
    creditsMap = cr;
    renderCredits();
  }).catch(() => {});
})();
