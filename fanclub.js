// fanclub.html: the exclusive membership card. Drawn on a canvas so the preview and the downloaded PNG are the same image.
// The card is kept in this browser (localStorage). Joining sends the member's details (not the photo) to the club inbox set in site-config.js.
(async () => {
  const $ = s => document.querySelector(s);
  const form = $('#joinForm'), canvas = $('#card'), err = $('#joinError');
  const KEY = 'rockFanClubMember';

  // ---- saved member (if any)
  let member = null;
  try { member = JSON.parse(localStorage.getItem(KEY)); } catch {}
  const store = m => {
    try { localStorage.setItem(KEY, JSON.stringify(m)); return true; }
    catch { try { localStorage.setItem(KEY, JSON.stringify({ ...m, photo: '' })); } catch {} return false; }
  };

  // ---- card photo: cropped once to the card's portrait frame (2x), kept as a small JPEG
  let photo = null, photoData = '';
  const PW = 392, PH = 472; // 196x236 on the card, at 2x
  const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  async function setPhoto(src) {
    photoData = src || '';
    photo = src ? await loadImg(src) : null;
    $('#photoThumb').hidden = !src; if (src) $('#photoThumb').src = src;
    $('#photoRemove').hidden = !src;
    $('#photoPickText').textContent = src ? 'Change photo' : 'Add a photo';
  }
  async function cropFile(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImg(url);
      const c = document.createElement('canvas'); c.width = PW; c.height = PH;
      const s = Math.max(PW / img.naturalWidth, PH / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      // centre horizontally; sit a little high so heads aren't cut off
      c.getContext('2d').drawImage(img, (PW - w) / 2, (PH - h) * .3, w, h);
      return c.toDataURL('image/jpeg', .85);
    } finally { URL.revokeObjectURL(url); }
  }

  // ---- favourite movie options, newest first
  try {
    const films = await (await fetch('media/movies.json')).json();
    const dup = t => films.filter(f => f.title === t).length > 1; // e.g. the two Moanas: keep the year on the card
    films.slice().sort((a, b) => b.year - a.year || a.title.localeCompare(b.title)).forEach(f => form.movie.add(new Option(`${f.title} (${f.year})`, dup(f.title) ? `${f.title} (${f.year})` : f.title)));
  } catch {}

  // ---- form state
  const since = () => new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
  const draft = { number: member?.number || 1 + Math.floor(Math.random() * 999998), since: member?.since || since() };
  const read = () => ({ ...draft, name: form.name.value.trim(), city: form.city.value.trim(), movie: form.movie.value, style: form.style.value, photo: photoData });
  const heroCard = $('#heroCard');
  const render = () => { const d = read(); RockCard.draw(canvas, d, photo); if (heroCard) RockCard.draw(heroCard, member || (d.name ? d : { ...d, style: 'volt' }), member ? photo : (d.name ? photo : null)); };

  const joined = m => {
    $('#joinSubmit').textContent = 'Update card';
    $('#joinDownload').hidden = false;
    $('#joinLede').textContent = `Welcome to the club, ${m.name.split(/\s+/)[0]}. You’re member No. ${String(m.number).padStart(6, '0')}. Download your card and keep it.`;
    $('#cardCaption').textContent = 'Your card';
  };

  if (member) {
    form.name.value = member.name || ''; form.city.value = member.city || ''; form.email.value = member.email || '';
    form.movie.value = member.movie || ''; form.style.value = member.style || 'field';
    if (member.photo) await setPhoto(member.photo).catch(() => setPhoto(''));
    joined(member);
  }

  $('#photoInput').addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    err.textContent = '';
    try { await setPhoto(await cropFile(file)); render(); }
    catch { err.textContent = 'That photo couldn’t be opened. Try a JPG or PNG.'; }
  });
  $('#photoRemove').onclick = async () => { await setPhoto(''); render(); };

  await RockCard.fonts();
  render();
  form.addEventListener('input', render);
  form.addEventListener('change', render);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.textContent = '';
    if (!form.name.value.trim()) { err.textContent = 'Put your name on the card.'; form.name.focus(); return; }
    if (!form.email.value.trim() || !form.email.checkValidity()) { err.textContent = 'Add a valid email so the club can reach you.'; form.email.focus(); return; }
    const next = { ...read(), email: form.email.value.trim() };
    const btn = $('#joinSubmit'), label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Registering…';
    try {
      // register with the club inbox (site-config.js); the photo stays on the device
      await sendToInbox(`${member ? 'Fan club card updated' : 'New fan club member'}: ${next.name} (No. ${String(next.number).padStart(6, '0')})`, {
        type: member ? 'Membership update' : 'Membership registration',
        memberNumber: String(next.number).padStart(6, '0'), name: next.name, email: next.email,
        city: next.city, favouriteMovie: next.movie, cardStyle: next.style, memberSince: next.since, hasPhoto: next.photo ? 'yes' : 'no',
      });
    } catch {
      err.textContent = 'We couldn’t register you just now. Please try again in a moment.';
      btn.disabled = false; btn.textContent = label; return;
    }
    btn.disabled = false;
    member = next; render(); joined(member);
    if (!store(member)) err.textContent = 'You’re registered, but this browser had no room to keep the photo. Download your card to keep it.';
    $('#joinDownload').focus();
  });

  $('#joinDownload').onclick = () => canvas.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `the-rock-fan-club-${String(read().number).padStart(6, '0')}.png`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
})();
