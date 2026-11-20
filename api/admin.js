// Vercel Serverless Function: GET /api/admin
// Private data for the site owner's dashboard at /admin/.
// Requires the ADMIN_PASSWORD environment variable (set it in Vercel; never in code).
// Reads the email log from Resend with the existing RESEND_API_KEY, server-side only.

import crypto from 'node:crypto';

const RESEND = 'https://api.resend.com';
const MAX_PAGES = 5; // up to 500 most recent emails

// Slow down password guessing: max 10 wrong passwords per 15 minutes per IP (per instance).
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const FAIL_MAX = 10;
const fails = new Map();
const tooManyFails = ip => (fails.get(ip) || []).filter(t => Date.now() - t < FAIL_WINDOW_MS).length >= FAIL_MAX;
const noteFail = ip => fails.set(ip, [...(fails.get(ip) || []).filter(t => Date.now() - t < FAIL_WINDOW_MS), Date.now()]);

const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const passwordOk = given => {
  const want = process.env.ADMIN_PASSWORD || '';
  return want.length > 0 && crypto.timingSafeEqual(sha(given), sha(want));
};

// What kind of site message an email is, from the subject lines api/fan-club.js uses.
function classify(subject = '') {
  if (/^\[New fan club member\]|^\[New Fan Club Application\]/i.test(subject)) return 'signup';
  if (/^\[Fan letter\]/i.test(subject)) return 'letter';
  if (/we got your letter/i.test(subject)) return 'letter-reply';
  if (/^Welcome to/i.test(subject)) return 'welcome';
  return 'other';
}

// "[New fan club member] Jane Doe — Lagos (#RFC-2026-1234)" -> name, city, id
function parseSubject(subject = '') {
  const id = (subject.match(/\(#?(RFC-\d{4}-\d{4})\)/) || [])[1] || '';
  const body = subject.replace(/^\[[^\]]+\]\s*/, '').replace(/\s*\(#?RFC-[^)]*\)\s*$/, '');
  const [name = '', city = ''] = body.split(/\s+[—-]\s+/);
  return { id, name: name.trim(), city: city.trim() };
}

async function listResendEmails(key) {
  const out = [];
  let after = '';
  for (let i = 0; i < MAX_PAGES; i++) {
    const url = `${RESEND}/emails?limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.message || `Resend answered ${r.status}`);
    const page = Array.isArray(data?.data) ? data.data : [];
    out.push(...page);
    if (!data?.has_more || !page.length) break;
    after = page[page.length - 1].id;
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Use GET.' });

  if (!process.env.ADMIN_PASSWORD) {
    return res.status(503).json({ ok: false, error: 'The dashboard is not switched on yet. Add ADMIN_PASSWORD in Vercel → Settings → Environment Variables, then redeploy.' });
  }
  const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  if (tooManyFails(ip)) return res.status(429).json({ ok: false, error: 'Too many wrong passwords. Wait 15 minutes.' });
  const given = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (!passwordOk(given)) {
    noteFail(ip);
    return res.status(401).json({ ok: false, error: 'Wrong password.' });
  }

  const key = process.env.RESEND_API_KEY || '';
  const inbox = process.env.FANCLUB_INBOX || process.env.HOSTINGER_RECEIVER_EMAIL || process.env.HOSTINGER_SMTP_USER || 'contact@dwaynejohnsonofficial.com (default — FANCLUB_INBOX not set)';
  const setup = {
    inbox,
    sender: process.env.RESEND_FROM_EMAIL || 'fanclub@dwaynejohnsonofficial.com (default — RESEND_FROM_EMAIL not set)',
    siteUrl: process.env.SITE_URL || '(not set)',
    resendKeySet: Boolean(key),
    fanclubInboxSet: Boolean(process.env.FANCLUB_INBOX || process.env.HOSTINGER_RECEIVER_EMAIL),
    smtpFallbackSet: Boolean(process.env.HOSTINGER_SMTP_USER && process.env.HOSTINGER_SMTP_PASS)
  };

  let emails = [];
  let emailError = '';
  if (key) {
    try {
      emails = (await listResendEmails(key)).map(e => {
        const type = classify(e.subject);
        const p = parseSubject(e.subject);
        if (type !== 'signup' && type !== 'letter') { p.name = ''; p.city = ''; }
        return {
          id: e.id,
          at: e.created_at,
          type,
          to: Array.isArray(e.to) ? e.to.join(', ') : String(e.to || ''),
          subject: e.subject || '',
          status: e.last_event || 'unknown',
          name: p.name,
          city: p.city,
          memberId: p.id,
          test: /site check test/i.test(e.subject || '')
        };
      });
      // Replies to fans carry only the member ID; borrow the name and city from the matching sign-up or letter.
      const byId = new Map(emails.filter(e => e.memberId && e.name).map(e => [e.memberId, e]));
      for (const e of emails) {
        if (!e.name && byId.has(e.memberId)) { e.name = byId.get(e.memberId).name; e.city = byId.get(e.memberId).city; }
      }
    } catch (err) {
      emailError = String(err.message || err);
    }
  } else {
    emailError = 'RESEND_API_KEY is not set, so the email log can’t be read.';
  }

  return res.status(200).json({ ok: true, generatedAt: new Date().toISOString(), setup, emails, emailError });
}
