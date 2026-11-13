// Site settings in one place. Loaded before community.js, fanclub.js, and fanclub-home.js.
window.SITE_CONFIG = {
  // The fan club email function (api/fan-club.js): sends sign-ups and letters to the fan club inbox via Resend.
  formEndpoint: '/api/fan-club',

  // His own social accounts, linked from the Contact page (this fan site does not run them).
  socials: [
    { name: 'Instagram', handle: '@therock', url: 'https://www.instagram.com/therock/' },
    { name: 'YouTube', handle: '@therock', url: 'https://www.youtube.com/@therock' },
    { name: 'X', handle: '@TheRock', url: 'https://x.com/TheRock' },
    { name: 'TikTok', handle: '@therock', url: 'https://www.tiktok.com/@therock' },
    { name: 'Facebook', handle: 'Dwayne Johnson', url: 'https://www.facebook.com/DwayneJohnson' },
  ],
};

// Sends a form submission to /api/fan-club (to the fan club inbox, plus a welcome email to the fan).
window.sendToInbox = async (subject, fields) => {
  const url = window.SITE_CONFIG.formEndpoint || '/api/fan-club';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ _subject: subject, ...fields }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) {
    throw new Error(data.error || 'Submission service answered ' + r.status);
  }
  return data;
};
