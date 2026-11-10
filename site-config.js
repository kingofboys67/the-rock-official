// Site settings in one place. Loaded before community.js, fanclub.js, and fanclub-home.js.
window.SITE_CONFIG = {
  // Serverless Resend + Zoho Mail receiver endpoint on dwaynejohnsonofficial.com
  formEndpoint: '/api/fan-club',

  // Verified official social accounts shown on the Contact page and across the platform.
  socials: [
    { name: 'Instagram', handle: '@therock', url: 'https://www.instagram.com/therock/' },
    { name: 'YouTube', handle: '@therock', url: 'https://www.youtube.com/@therock' },
    { name: 'X', handle: '@TheRock', url: 'https://x.com/TheRock' },
    { name: 'TikTok', handle: '@therock', url: 'https://www.tiktok.com/@therock' },
    { name: 'Facebook', handle: 'Dwayne Johnson', url: 'https://www.facebook.com/DwayneJohnson' },
  ],
};

// Sends a form submission to /api/fan-club (delivers to Zoho Mail + triggers Canva-style Resend auto-reply).
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
