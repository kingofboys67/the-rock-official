// Home page fan club sign-up (#fan-club):
// Live-updates the 3D membership card as the visitor types, posts the application to /api/fan-club
// (delivering to Zoho Mail + sending the Canva-style Resend auto-reply), and transitions into the
// on-screen membership pass with one-click PNG download.
(async () => {
  const canvas = document.getElementById('fanclubHomeCard');
  if (!canvas || !window.RockCard) return;

  const KEY = 'rockFanClubMember';
  let member = null;
  try { member = JSON.parse(localStorage.getItem(KEY)); } catch {}

  const since = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
  const draftNumber = member?.number || (1000 + Math.floor(Math.random() * 9000));
  let photo = null;
  if (member?.photo) {
    photo = await new Promise(ok => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ok(null);
      i.src = member.photo;
    });
  }

  const form = document.getElementById('homeFanClubForm');
  const errEl = document.getElementById('homeFanClubError');
  const submitBtn = document.getElementById('homeFanClubSubmit');
  const passBox = document.getElementById('homeCanvaPass');

  function getFormDraft() {
    if (!form) return member || { number: draftNumber, since, name: '', city: '', movie: '', style: 'volt' };
    return {
      number: member?.number || draftNumber,
      since: member?.since || since,
      name: form.fullName.value.trim() || member?.name || '',
      email: form.email.value.trim() || member?.email || '',
      city: form.country.value.trim() || member?.city || '',
      instagram: form.instagram.value.trim() || member?.instagram || '',
      movie: form.favoriteEra.value || member?.movie || 'Attitude Era / The Final Boss',
      message: form.message.value.trim() || member?.message || '',
      style: member?.style || 'volt',
      photo: member?.photo || ''
    };
  }

  function renderCard() {
    const d = getFormDraft();
    RockCard.draw(canvas, d.name ? d : { ...d, style: 'volt' }, photo);
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
    form.country.value = member.city || '';
    form.instagram.value = member.instagram || '';
    if (member.movie) form.favoriteEra.value = member.movie;
    form.message.value = member.message || '';
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
    const country = form.country.value.trim();
    const instagram = form.instagram.value.trim();
    const favoriteEra = form.favoriteEra.value;
    const message = form.message.value.trim();
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
      city: country,
      instagram,
      movie: favoriteEra,
      message
    };

    try {
      const res = await window.sendToInbox(
        `[New fan club member] ${fullName} — ${country}`,
        {
          submissionType: 'Fan Club Membership',
          memberNumber: String(nextMember.number).padStart(6, '0'),
          fullName,
          email,
          country,
          instagram,
          favoriteEra,
          message,
          cardStyle: nextMember.style,
          website
        }
      );
      const appId = res?.applicationId || `RFC-2026-${String(nextMember.number).slice(-4).padStart(4, '0')}`;
      nextMember.applicationId = appId;
      member = nextMember;
      try { localStorage.setItem(KEY, JSON.stringify(member)); } catch {}
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
