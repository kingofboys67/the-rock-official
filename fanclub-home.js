// Home page fan club sign-up (#fan-club):
// Live-updates the 3D membership card (including optional device-only photo + Volt/Field/Paper themes)
// as the visitor types, posts the application to /api/fan-club (delivering to Hostinger Email + sending the
// Canva-style Resend auto-reply), and transitions into the on-screen membership pass with PNG download.
(async () => {
  const canvas = document.getElementById('fanclubHomeCard');
  if (!canvas || !window.RockCard) return;

  const KEY = 'rockFanClubMember';
  let member = null;
  try { member = JSON.parse(localStorage.getItem(KEY)); } catch {}

  const since = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
  const draftNumber = member?.number || (1000 + Math.floor(Math.random() * 9000));
  const PW = 392, PH = 472;
  let photo = null, photoData = member?.photo || '';

  const loadImg = src => new Promise((ok, no) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = no;
    i.src = src;
  });

  async function cropFile(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImg(url);
      const c = document.createElement('canvas');
      c.width = PW; c.height = PH;
      const s = Math.max(PW / img.naturalWidth, PH / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      c.getContext('2d').drawImage(img, (PW - w) / 2, (PH - h) * .3, w, h);
      return c.toDataURL('image/jpeg', .85);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const thumbEl = document.getElementById('homePhotoThumb');
  const pickTextEl = document.getElementById('homePhotoPickText');
  const removeBtn = document.getElementById('homePhotoRemove');
  const photoInput = document.getElementById('homePhotoInput');

  async function setPhoto(src) {
    photoData = src || '';
    photo = src ? await loadImg(src).catch(() => null) : null;
    if (thumbEl) { thumbEl.hidden = !photo; if (photo) thumbEl.src = src; }
    if (removeBtn) removeBtn.hidden = !photo;
    if (pickTextEl) pickTextEl.textContent = photo ? 'Change photo' : 'Add photo';
  }

  if (photoData) await setPhoto(photoData);

  const form = document.getElementById('homeFanClubForm');
  const errEl = document.getElementById('homeFanClubError');
  const submitBtn = document.getElementById('homeFanClubSubmit');
  const passBox = document.getElementById('homeCanvaPass');

  function getSelectedStyle() {
    const checked = form?.querySelector('input[name="cardStyle"]:checked');
    return checked?.value || member?.style || 'volt';
  }

  function getFormDraft() {
    if (!form) return member || { number: draftNumber, since, name: '', phone: '', city: '', movie: '', style: 'volt' };
    return {
      number: member?.number || draftNumber,
      since: member?.since || since,
      name: form.fullName.value.trim() || member?.name || '',
      email: form.email.value.trim() || member?.email || '',
      phone: form.phone?.value.trim() || member?.phone || '',
      city: form.country.value.trim() || member?.city || '',
      instagram: form.instagram.value.trim() || member?.instagram || '',
      movie: form.favoriteEra.value || member?.movie || 'Attitude Era / The Final Boss',
      message: form.message.value.trim() || member?.message || '',
      style: getSelectedStyle(),
      photo: photoData
    };
  }

  function renderCard() {
    const d = getFormDraft();
    RockCard.draw(canvas, d, photo);
  }

  function showCanvaPass(data, appId) {
    if (!passBox || !form) return;
    const first = (data.name || 'Member').split(/\s+/)[0];
    document.getElementById('homePassId').textContent = `#${appId}`;
    document.getElementById('homePassFirst').textContent = first.toUpperCase();
    document.getElementById('homePassEmail').textContent = data.email;
    document.getElementById('homePassName').textContent = data.name;
    document.getElementById('homePassLocation').textContent = data.city || 'Global';
    document.getElementById('homePassEra').textContent = data.movie || 'Attitude Era / The Final Boss';
    form.hidden = true;
    passBox.hidden = false;
  }

  if (form && member?.name) {
    form.fullName.value = member.name || '';
    form.email.value = member.email || '';
    if (form.phone) form.phone.value = member.phone || '';
    form.country.value = member.city || '';
    form.instagram.value = member.instagram || '';
    if (member.movie) form.favoriteEra.value = member.movie;
    form.message.value = member.message || '';
    if (member.style) {
      const radio = form.querySelector(`input[name="cardStyle"][value="${member.style}"]`);
      if (radio) radio.checked = true;
    }
  }

  if (photoInput) {
    photoInput.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      errEl.textContent = '';
      try {
        await setPhoto(await cropFile(file));
        renderCard();
      } catch {
        errEl.textContent = 'That photo couldn’t be opened. Try a JPG or PNG.';
      }
    });
  }
  if (removeBtn) {
    removeBtn.addEventListener('click', async () => {
      await setPhoto('');
      renderCard();
    });
  }

  await RockCard.fonts();
  renderCard();

  if (!form) return;
  form.addEventListener('input', renderCard);
  form.addEventListener('change', renderCard);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errEl.textContent = '';

    const fullName = form.fullName.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone ? form.phone.value.trim() : '';
    const country = form.country.value.trim();
    const instagram = form.instagram.value.trim();
    const favoriteEra = form.favoriteEra.value;
    const message = form.message.value.trim();
    const style = getSelectedStyle();
    const website = form.website?.value || '';

    if (!fullName) {
      errEl.textContent = 'Please enter your Full Name.';
      form.fullName.focus();
      return;
    }
    if (!email || !form.email.checkValidity()) {
      errEl.textContent = 'Please enter a valid Email Address.';
      form.email.focus();
      return;
    }
    if (!phone) {
      errEl.textContent = 'Please enter your Phone Number.';
      form.phone.focus();
      return;
    }
    if (!country) {
      errEl.textContent = 'Please enter your Country / City.';
      form.country.focus();
      return;
    }

    const origText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting Application…';

    const nextMember = {
      ...getFormDraft(),
      name: fullName,
      email,
      phone,
      city: country,
      instagram,
      movie: favoriteEra,
      message,
      style,
      photo: photoData
    };

    try {
      const res = await window.sendToInbox(
        `[New fan club member] ${fullName} — ${country}`,
        {
          submissionType: 'Fan Club Membership',
          memberNumber: String(nextMember.number).padStart(6, '0'),
          fullName,
          email,
          phone,
          country,
          instagram,
          favoriteEra,
          message,
          cardStyle: style,
          hasPhoto: photoData ? 'yes' : 'no',
          website
        }
      );
      const appId = res?.applicationId || `RFC-2026-${String(nextMember.number).slice(-4).padStart(4, '0')}`;
      nextMember.applicationId = appId;
      member = nextMember;
      try { localStorage.setItem(KEY, JSON.stringify(member)); }
      catch { try { localStorage.setItem(KEY, JSON.stringify({ ...member, photo: '' })); } catch {} }
      renderCard();
      showCanvaPass(member, appId);
    } catch (err) {
      errEl.textContent = err?.message || 'We couldn’t sign you up just now. Please try again.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = origText;
    }
  });

  const dlBtn = document.getElementById('homePassDownload');
  if (dlBtn) {
    dlBtn.addEventListener('click', () => {
      canvas.toBlob(b => {
        if (!b) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        const idSlug = (member?.applicationId || 'RFC-2026').toLowerCase();
        a.download = `the-rock-fan-club-${idSlug}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, 'image/png');
    });
  }

  const resetBtn = document.getElementById('homePassReset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      passBox.hidden = true;
      form.hidden = false;
      form.fullName.focus();
    });
  }
})();
