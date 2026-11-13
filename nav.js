// Shared:
// 1. The logo has no background, so it steps aside while reading (scrolling down) and returns on scroll up or near the top.
// 2. Privacy Policy & Terms of Use dialog on every page (links keep contact.html#privacy / #terms as fallbacks).
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
      kicker: 'The Rock Fan Club · unofficial fan site',
      title: 'Privacy Policy',
      updated: 'Last updated November 2026',
      sections: [
        {
          h: 'Who we are',
          p: 'The Rock Fan Club is an unofficial fan site run by fans. It is not run by, affiliated with or endorsed by Dwayne Johnson, Seven Bucks or any of his companies or representatives. Nothing you send here reaches him or his team.'
        },
        {
          h: 'What we collect',
          p: 'Only what you type into the fan club or letter forms: your name, email, city or country, and anything optional you add (a social handle, a favourite film, a note or letter). Card photos are cropped in your browser and never uploaded.'
        },
        {
          h: 'How we use it',
          p: 'To add you to the fan club, send you a welcome email and fan club news, and reply to letters. Emails are sent with Resend and received in a Zoho Mail inbox run by the fan club. We never sell or rent your details.'
        },
        {
          h: 'On your device',
          p: 'Your card is saved in this browser (localStorage) so you can come back and edit it. Clearing your browser data removes it.'
        },
        {
          h: 'Removing your details',
          p: 'Write to us from the letter form on the Contact page and we will delete your fan club record.'
        }
      ]
    },
    terms: {
      kicker: 'The Rock Fan Club · unofficial fan site',
      title: 'Terms of Use',
      updated: 'Last updated November 2026',
      sections: [
        {
          h: 'An unofficial fan site',
          p: 'This site celebrates Dwayne “The Rock” Johnson’s work. It is not his website and does not speak for him. For anything official, use his own accounts or contact his representatives directly.'
        },
        {
          h: 'Names, photos and trademarks',
          p: '“Dwayne Johnson”, “The Rock”, Seven Bucks Productions, Teremana, PAPATUI, ZOA Energy, Project Rock and related marks belong to their owners. Film stills, posters, trailers and photos belong to their studios and photographers and are shown here for fan commentary.'
        },
        {
          h: 'Your membership card',
          p: 'Fan club cards are a fun keepsake for personal, non-commercial use. They are not tickets, credentials or proof of any connection to Dwayne Johnson.'
        },
        {
          h: 'Letters',
          p: 'Send only your own words. We share a letter with other fans only if you tick the permission box, and then only your first name and city.'
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
          <a class="pill lime" href="contact.html#letter">Write to the fan club →</a>
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
