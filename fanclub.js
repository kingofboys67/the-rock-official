// fanclub.html: the exclusive membership card & Official Fan Club Inner Circle application.
// Drawn on a canvas so the preview and the downloaded PNG are the same image.
// Submitting delivers the applicant's data to Zoho Mail + sends the Canva-style Resend auto-reply via /api/fan-club.
(async () => {
  const $ = s => document.querySelector(s);
  const form = $('#joinForm'), canvas = $('#card'), err = $('#joinError');
  const passBox = $('#joinCanvaPass');
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
      c.getContext('2d').drawImage(img, (PW - w) / 2, (PH - h) * .3, w, h);
      return c.toDataURL('image/jpeg', .85);
    } finally { URL.revokeObjectURL(url); }
  }

  // ---- append complete filmography options after the 6 featured Career Eras
  try {
    const films = await (await fetch('media/movies.json')).json();
    const dup = t => films.filter(f => f.title === t).length > 1;
    films.slice().sort((a, b) => b.year - a.year || a.title.localeCompare(b.title)).forEach(f => {
      const val = dup(f.title) ? `${f.title} (${f.year})` : f.title;
      if (![...form.movie.options].some(o => o.value === val)) {
        form.movie.add(new Option(`${f.title} (${f.year})`, val));
      }
    });
  } catch {}

  // ---- form state
  const since = () => new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
  const draft = { number: member?.number || 1000 + Math.floor(Math.random() * 8999), since: member?.since || since() };
  const read = () => ({
    ...draft,
    name: form.name.value.trim(),
    city: form.city.value.trim(),
    instagram: form.instagram?.value.trim() || '',
    movie: form.movie.value,
    message: form.message?.value.trim() || '',
    style: form.style.value,
    photo: photoData
  });
  const heroCard = $('#heroCard');
  const render = () => {
    const d = read();
    RockCard.draw(canvas, d, photo);
    if (heroCard) RockCard.draw(heroCard, member || (d.name ? d : { ...d, style: 'volt' }), member ? photo : (d.name ? photo : null));
  };

  function showCanvaPass(m, appId) {
    if (!passBox) return;
    const first = (m.name || 'Member').split(/\s+/)[0];
    $('#joinPassId').textContent = `#${appId}`;
    $('#joinPassFirst').textContent = first.toUpperCase();
    $('#joinPassEmail').textContent = m.email;
    $('#joinPassName').textContent = m.name;
    $('#joinPassLocation').textContent = m.city || 'Global';
    $('#joinPassEra').textContent = m.movie || 'Attitude Era / The Final Boss';
    form.hidden = true;
    passBox.hidden = false;
  }

  const joined = m => {
    $('#joinSubmit').textContent = 'Update Application & Card →';
    $('#joinDownload').hidden = false;
    $('#joinLede').textContent = `Welcome to the Inner Circle, ${m.name.split(/\s+/)[0]}. Application ID #${m.applicationId || ('DJ-2026-' + String(m.number).slice(-4).padStart(4, '0'))}. Download your card and keep it.`;
    $('#cardCaption').textContent = 'Your Official Membership Card';
  };

  if (member) {
    form.name.value = member.name || '';
    form.city.value = member.city || '';
    form.email.value = member.email || '';
    if (form.instagram) form.instagram.value = member.instagram || '';
    if (member.movie) form.movie.value = member.movie;
    if (form.message) form.message.value = member.message || '';
    form.style.value = member.style || 'field';
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
    if (!form.name.value.trim()) { err.textContent = 'Please enter your Full Name.'; form.name.focus(); return; }
    if (!form.email.value.trim() || !form.email.checkValidity()) { err.textContent = 'Please enter a valid Email Address.'; form.email.focus(); return; }
    if (!form.city.value.trim()) { err.textContent = 'Please enter your Country / City.'; form.city.focus(); return; }

    const next = { ...read(), email: form.email.value.trim() };
    const btn = $('#joinSubmit'), label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Submitting Application…';
    let appId = `DJ-2026-${String(next.number).slice(-4).padStart(4, '0')}`;
    try {
      const res = await sendToInbox(`[New Fan Club Application] ${next.name} — ${next.city}`, {
        submissionType: member ? 'Fan Club Membership Update' : 'Official Fan Club Application',
        memberNumber: String(next.number).padStart(6, '0'),
        fullName: next.name,
        email: next.email,
        country: next.city,
        instagram: next.instagram,
        favoriteEra: next.movie,
        message: next.message,
        cardStyle: next.style,
        memberSince: next.since,
        hasPhoto: next.photo ? 'yes' : 'no',
        website: form.website?.value || ''
      });
      if (res?.applicationId) appId = res.applicationId;
    } catch (ex) {
      err.textContent = ex?.message || 'We couldn’t register you just now. Please try again in a moment.';
      btn.disabled = false; btn.textContent = label; return;
    }
    btn.disabled = false;
    next.applicationId = appId;
    member = next; render(); joined(member);
    if (!store(member)) err.textContent = 'You’re registered, but this browser had no room to keep the photo. Download your card to keep it.';
    showCanvaPass(member, appId);
  });

  const downloadCardPng = () => canvas.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    const slug = (member?.applicationId || `DJ-2026-${String(read().number).slice(-4).padStart(4, '0')}`).toLowerCase();
    a.download = `the-rock-fan-club-${slug}.png`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');

  $('#joinDownload').onclick = downloadCardPng;
  if ($('#joinPassDownload')) $('#joinPassDownload').onclick = downloadCardPng;
  if ($('#joinPassReset')) {
    $('#joinPassReset').onclick = () => {
      passBox.hidden = true;
      form.hidden = false;
      form.name.focus();
    };
  }
})();
