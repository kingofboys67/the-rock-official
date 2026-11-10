// contact.html + fanclub.html: background lines, menu, and the letter form.
(() => {
  const $ = s => document.querySelector(s);

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
  document.querySelectorAll('.contours').forEach((s, i) => s.insertAdjacentHTML('afterbegin', topo(1440, 900, 7919 + i * 977)));

  // ---- menu
  const menu = $('#menu'), mb = $('#menuBtn');
  const setMenu = o => { menu.hidden = !o; mb.setAttribute('aria-expanded', o); document.body.style.overflow = o ? 'hidden' : ''; };
  mb.onclick = () => setMenu(menu.hidden);
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

  // ---- social links (contact.html), from site-config.js
  const socials = $('#socials');
  if (socials && window.SITE_CONFIG) {
    SITE_CONFIG.socials.filter(x => x.url).forEach(x => {
      const a = document.createElement('a');
      a.className = 'contact-social'; a.href = x.url; a.target = '_blank'; a.rel = 'noopener';
      a.innerHTML = `<span class="contact-social-name"></span><span class="contact-social-handle"></span><span class="contact-social-arrow" aria-hidden="true">↗</span>`;
      a.children[0].textContent = x.name; a.children[1].textContent = x.handle;
      socials.append(a);
    });
  }

  // ---- letter form (contact.html)
  const form = $('#letter');
  if (!form) return;
  // Letters go to the inbox set in site-config.js (SITE_CONFIG.formEndpoint).

  $('#letterDate').textContent = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  const salutes = { fan: 'Dear Rock,', club: 'Dear Fan Club,', site: 'Hello,', other: 'Hello,' };
  form.topic.onchange = () => { $('#salute').textContent = salutes[form.topic.value]; };
  const msg = form.message, count = $('#letterCount');
  const grow = () => { msg.style.height = 'auto'; msg.style.height = msg.scrollHeight + 'px'; count.textContent = `${msg.value.length} / 4000`; };
  msg.addEventListener('input', grow);

  const err = $('#letterError');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.textContent = '';
    const bad = [...form.querySelectorAll('[required]')].find(f => !f.value.trim() || !f.checkValidity());
    if (bad) {
      err.textContent = bad.name === 'email' ? 'That email address doesn’t look right.' : bad.name === 'message' ? 'Your letter is empty.' : 'Please sign with your name.';
      bad.focus(); return;
    }
    const data = Object.fromEntries(new FormData(form)); data.share = form.share.checked;
    const send = form.querySelector('.contact-send'); send.disabled = true; send.textContent = 'Sending…';
    try {
      const to = form.topic.options[form.topic.selectedIndex].text;
      const res = await sendToInbox(`Letter: ${to} (from ${data.name.trim()})`, {
        submissionType: `Official Correspondence · ${to}`,
        fullName: data.name.trim(),
        email: data.email.trim(),
        country: data.from?.trim() || 'Global',
        favoriteEra: to,
        message: data.message.trim(),
        mayShare: data.share ? 'yes' : 'no'
      });
      const first = data.name.trim().split(/\s+/)[0];
      $('#sentName').textContent = res?.applicationId ? `${first} (#${res.applicationId})` : first;
      $('#letterBody').hidden = true; $('#letterSent').hidden = false; $('#letterSent').focus();
    } catch (ex) {
      err.textContent = ex?.message || 'Your letter didn’t go through. Please try again in a moment.';
    } finally { send.disabled = false; send.textContent = 'Seal & send →'; }
  });
  $('#letterAgain').onclick = () => { form.reset(); grow(); $('#salute').textContent = salutes.fan; $('#letterSent').hidden = true; $('#letterBody').hidden = false; msg.focus(); };
})();
