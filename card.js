// The fan club membership card, drawn on a canvas. Shared by fanclub.html (live editor + download) and the home page teaser.
// RockCard.draw(canvas, data, photo?)  data: {number, since, name, city, movie, style}; photo: a loaded image (196x236 frame) or null.
window.RockCard = (() => {
  const W = 1012, H = 638, P = 56, SCALE = 2;
  let ctx;
  const THEMES = {
    field: { bg: '#282c20', ink: '#F7F7F2', accent: '#D4FF00', sub: '#b4b8a5', line: 'rgba(210,255,0,.16)', chipBg: '#D4FF00', chipInk: '#282c20' },
    volt:  { bg: '#D4FF00', ink: '#282c20', accent: '#282c20', sub: 'rgba(40,44,32,.62)', line: 'rgba(40,44,32,.15)', chipBg: '#282c20', chipInk: '#D4FF00' },
    paper: { bg: '#F7F7F2', ink: '#282c20', accent: '#7f8f22', sub: '#6b6e60', line: 'rgba(40,44,32,.11)', chipBg: '#D4FF00', chipInk: '#282c20' },
  };

  // ---- contour lines as canvas paths (same shapes as the site backgrounds, seeded by member number)
  function contours(seed) {
    let s = seed % 2147483646 + 1; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const out = [];
    for (let b = 0; b < 2; b++) {
      const cx = W * (.45 + rnd() * .6), cy = rnd() * H, p1 = rnd() * 6, p2 = rnd() * 6, p3 = rnd() * 6;
      for (let r = 1; r <= 18; r++) {
        const R = r * H * 0.06; let d = '';
        for (let a = 0; a <= 72; a++) {
          const t = a / 72 * Math.PI * 2;
          const k = R * (1 + .22 * Math.sin(3 * t + p1) + .12 * Math.sin(5 * t + p2) + .06 * Math.sin(8 * t + p3 + r * .15));
          d += (a ? 'L' : 'M') + (cx + Math.cos(t) * k * 1.5).toFixed(1) + ' ' + (cy + Math.sin(t) * k).toFixed(1);
        }
        out.push(new Path2D(d + 'Z'));
      }
    }
    return out;
  }

  const text = (str, x, y, font, color, { align = 'left', spacing = 0 } = {}) => {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align;
    if ('letterSpacing' in ctx) ctx.letterSpacing = spacing + 'px';
    ctx.fillText(str, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  };
  const fit = (str, weight, family, max, width) => {
    let size = max;
    do { ctx.font = `${weight} ${size}px ${family}`; } while (ctx.measureText(str).width > width && (size -= 2) > 28);
    return size;
  };
  const clip = (str, font, width) => {
    ctx.font = font; if (ctx.measureText(str).width <= width) return str;
    while (str && ctx.measureText(str + '…').width > width) str = str.slice(0, -1);
    return str.trimEnd() + '…';
  };

  const SANS = '"Mona Sans", "Helvetica Neue", Arial, sans-serif', SERIF = '"Instrument Serif", Georgia, serif';

  function render(d, photo) {
    const t = THEMES[d.style] || THEMES.field;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(0, 0, W, H, 34); ctx.clip();
    ctx.fillStyle = t.bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = t.line; ctx.lineWidth = 1.3;
    contours(d.number).forEach(p => ctx.stroke(p));
    if (d.style === 'paper') { ctx.fillStyle = '#D4FF00'; ctx.fillRect(0, 0, W, 10); }

    // wordmark + chip
    text('THE', P, P + 38, `900 46px ${SANS}`, t.ink, { spacing: -2 });
    text('ROCK', P, P + 78, `900 46px ${SANS}`, t.ink, { spacing: -2 });
    ctx.font = `800 15px ${SANS}`; if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    const chip = 'EXCLUSIVE MEMBER', cw = ctx.measureText(chip).width + 36;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.fillStyle = t.chipBg; ctx.beginPath(); ctx.roundRect(W - P - cw, P + 4, cw, 40, 10); ctx.fill();
    text(chip, W - P - cw / 2, P + 30, `800 15px ${SANS}`, t.chipInk, { align: 'center', spacing: 2 });

    // photo (portrait, right side, between the badge and the details row)
    let textW = W - P * 2;
    if (photo) {
      const pw = 196, ph = 236, px = W - P - pw, py = 132;
      ctx.save();
      ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 18); ctx.clip();
      ctx.drawImage(photo, px, py, pw, ph);
      ctx.restore();
      ctx.strokeStyle = t.chipBg; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(px - 1.5, py - 1.5, pw + 3, ph + 3, 19.5); ctx.stroke();
      textW = px - P - 32;
    }

    // name + city
    const name = (d.name || 'Your name').toUpperCase();
    const size = fit(name, 900, SANS, 92, textW);
    text(name, P, 352, `900 ${size}px ${SANS}`, d.name ? t.ink : t.sub, { spacing: -size * .04 });
    const city = d.city ? `of ${d.city}` : 'Always bringing the energy';
    text(clip(city, `44px ${SERIF}`, textW), P, 408, `44px ${SERIF}`, t.accent);

    // details row
    ctx.fillStyle = t.line.replace(/[\d.]+\)$/, '.5)'); ctx.fillRect(P, H - 138, W - P * 2, 1.5);
    const cols = [['MEMBER NO.', String(d.number).padStart(6, '0')], ['MEMBER SINCE', d.since], ['FAVOURITE', d.movie || '—']];
    const colW = (W - P * 2) / 3;
    cols.forEach(([label, value], i) => {
      const x = P + i * colW;
      text(label, x, H - 96, `700 13px ${SANS}`, t.sub, { spacing: 2 });
      text(clip(value, `800 26px ${SANS}`, colW - 24), x, H - 60, `800 26px ${SANS}`, t.ink, { spacing: -.5 });
    });
    ctx.restore();
  }

  const fonts = () => Promise.all([document.fonts.load(`900 46px ${SANS}`), document.fonts.load(`800 26px ${SANS}`), document.fonts.load(`44px ${SERIF}`)]).catch(() => {});
  function draw(canvas, d, photo = null) {
    if (canvas.width !== W * SCALE) { canvas.width = W * SCALE; canvas.height = H * SCALE; }
    ctx = canvas.getContext('2d');
    render(d, photo);
  }
  return { W, H, draw, fonts };
})();
