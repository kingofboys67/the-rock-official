// Site settings in one place. Loaded before community.js and fanclub.js.
window.SITE_CONFIG = {
  // Where fan club sign-ups and contact letters are delivered.
  // A static site can't send email by itself, so it posts to a form service that forwards to the club's inbox:
  //   1. Create the fan club email address.
  //   2. Make a free form at https://formspree.io with that address, and paste its URL below
  //      (looks like https://formspree.io/f/abcdwxyz).
  // While this is empty, sign-ups and letters still work on screen but are NOT delivered anywhere.
  formEndpoint: '',

  // Verified official social accounts shown on the Contact page and across the platform.
  socials: [
    { name: 'Instagram', handle: '@therock', url: 'https://www.instagram.com/therock/' },
    { name: 'YouTube', handle: '@therock', url: 'https://www.youtube.com/@therock' },
    { name: 'X', handle: '@TheRock', url: 'https://x.com/TheRock' },
    { name: 'TikTok', handle: '@therock', url: 'https://www.tiktok.com/@therock' },
    { name: 'Facebook', handle: 'Dwayne Johnson', url: 'https://www.facebook.com/DwayneJohnson' },
  ],
};

// Sends a form to the inbox. Resolves true when delivered, false when no inbox is set up yet; throws on failure.
window.sendToInbox = async (subject, fields) => {
  const url = window.SITE_CONFIG.formEndpoint;
  if (!url) { console.warn('SITE_CONFIG.formEndpoint is empty: not delivered.', subject, fields); return false; }
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ _subject: subject, ...fields }),
  });
  if (!r.ok) throw new Error('Form service answered ' + r.status);
  return true;
};
