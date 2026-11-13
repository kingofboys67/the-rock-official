// Vercel Serverless Function: POST /api/fan-club
// The Rock Fan Club (unofficial fan site): sends each sign-up or letter to the fan club's own inbox,
// and a short welcome email to the fan, both via Resend. Emails always go out as "The Rock Fan Club"
// and say plainly that this is an unofficial fan site, not Dwayne Johnson or his team.
//
// Env: RESEND_API_KEY, FANCLUB_INBOX (where sign-ups land), RESEND_FROM_EMAIL (address only;
// a display name in it is ignored), SITE_URL (e.g. https://yourfansite.com).

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const CLUB = 'The Rock Fan Club';
const DISCLAIMER = 'The Rock Fan Club is an unofficial fan site. It is not run by, affiliated with or endorsed by Dwayne Johnson or his team, and messages sent here do not reach him.';
const siteUrl = () => (process.env.SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')).replace(/\/$/, '');
// Always send as the fan club, whatever display name is set in the environment.
const fromHeader = () => {
  const raw = process.env.RESEND_FROM_EMAIL || '';
  const addr = (raw.match(/<([^>]+)>/) || [, raw])[1].trim();
  return addr ? `${CLUB} <${addr}>` : '';
};
const clip = (v, n) => String(v ?? '').trim().slice(0, n);

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateApplicationId(seedNumber) {
  if (seedNumber && /^\d+$/.test(String(seedNumber))) {
    return `RFC-2026-${String(seedNumber).slice(-4).padStart(4, '0')}`;
  }
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RFC-2026-${rand}`;
}

function buildAdminZohoEmailHtml({
  applicationId,
  submissionType,
  fullName,
  email,
  country,
  instagram,
  favoriteEra,
  message,
  cardStyle,
  mayShare,
  timestamp
}) {
  const rows = [
    ['Member ID', `#${applicationId}`],
    ['Submission Type', submissionType],
    ['Full Name', fullName],
    ['Email Address', email],
    ['Country / City', country || '—'],
    ['Instagram / Social Handle', instagram || '—'],
    ['Favorite Career Era / Film', favoriteEra || '—'],
    ['Card Style / Topic', cardStyle || '—'],
    ['Permission to Share', mayShare || '—'],
    ['Submitted At (UTC)', timestamp]
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #2A2D24;font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#A7AC96;width:36%;background-color:#191B15;">${escapeHtml(label)}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #2A2D24;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:600;color:#F7F7F2;background-color:#1E2019;">${escapeHtml(value)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(submissionType)}: ${escapeHtml(fullName)}</title>
</head>
<body style="margin:0;padding:24px;background-color:#0F110C;font-family:'Helvetica Neue',Arial,sans-serif;color:#F7F7F2;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background-color:#141612;border:1px solid #2A2D24;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="height:6px;background-color:#D4FF00;font-size:0;line-height:0;">&nbsp;</td>
    </tr>
    <tr>
      <td style="padding:28px 32px 20px 32px;border-bottom:1px solid #2A2D24;">
        <div style="font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#D4FF00;margin-bottom:8px;">
          THE ROCK FAN CLUB · NEW SUBMISSION
        </div>
        <h1 style="margin:0;font-size:24px;font-weight:900;letter-spacing:-0.02em;color:#F7F7F2;text-transform:uppercase;">
          ${escapeHtml(submissionType)}
        </h1>
        <p style="margin:6px 0 0 0;font-size:13px;color:#A7AC96;">
          Member ID: <strong style="color:#D4FF00;">#${escapeHtml(applicationId)}</strong> · Reply directly to this email to contact <strong style="color:#F7F7F2;">${escapeHtml(fullName)}</strong>.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #2A2D24;border-radius:8px;overflow:hidden;">
          ${rowsHtml}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 28px 32px;">
        <div style="padding:18px 20px;background-color:#191B15;border-left:4px solid #D4FF00;border-radius:6px;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#D4FF00;margin-bottom:8px;">
            NOTE / LETTER
          </div>
          <div style="font-size:15px;line-height:1.6;color:#F7F7F2;white-space:pre-wrap;">${escapeHtml(message || 'No personal note provided.')}</div>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 32px;background-color:#0F110C;border-top:1px solid #2A2D24;font-size:12px;color:#858A76;text-align:center;">
        Sent by the fan club website form · ${escapeHtml(siteUrl() || 'site')}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildApplicantCanvaEmailHtml({ applicationId, fullName, firstName, country, favoriteEra, submissionType }) {
  const isLetter = /letter/i.test(submissionType || '');
  const url = siteUrl();
  const lead = isLetter
    ? 'Thanks for writing to the fan club. Your letter arrived, and if you asked a question we’ll reply to this email address.'
    : 'You’re in. Welcome to the fan club. We’ll send you fan club news now and then, and you can ask us to remove you any time.';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${CLUB} — ${isLetter ? 'letter received' : 'welcome'}</title>
</head>
<body style="margin:0;padding:0;background-color:#F7F7F2;font-family:'Helvetica Neue',Arial,sans-serif;color:#141612;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F7F7F2;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#141612;border-radius:20px;overflow:hidden;border:1px solid #2A2D24;">
        <tr><td style="height:8px;background-color:#D4FF00;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:32px 32px 8px 32px;">
          <span style="display:inline-block;padding:6px 12px;background-color:#D4FF00;color:#141612;font-size:10px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;border-radius:999px;">THE ROCK FAN CLUB · UNOFFICIAL</span>
          <h1 style="margin:22px 0 12px 0;font-size:30px;line-height:1;font-weight:900;letter-spacing:-0.02em;text-transform:uppercase;color:#F7F7F2;">
            ${isLetter ? 'Thanks' : 'Welcome'}, <span style="color:#D4FF00;">${escapeHtml(firstName)}</span>.
          </h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#C8CCBA;">${lead}</p>
        </td></tr>
        ${isLetter ? '' : `
        <tr><td style="padding:20px 32px 8px 32px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#1E2019;border:2px solid #D4FF00;border-radius:14px;">
            <tr><td style="padding:18px 20px;">
              <div style="font-size:10px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#8E947E;">MEMBER</div>
              <div style="margin-top:4px;font-size:20px;font-weight:900;text-transform:uppercase;color:#F7F7F2;">${escapeHtml(fullName)}</div>
              <div style="margin-top:12px;font-size:13px;color:#C8CCBA;">#${escapeHtml(applicationId)}${country ? ` · ${escapeHtml(country)}` : ''}${favoriteEra ? ` · Favourite: ${escapeHtml(favoriteEra)}` : ''}</div>
            </td></tr>
          </table>
        </td></tr>`}
        ${url ? `<tr><td align="center" style="padding:24px 32px 8px 32px;">
          <a href="${url}" style="display:inline-block;padding:13px 26px;background-color:#D4FF00;color:#141612;font-size:13px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;border-radius:999px;">Back to the fan club →</a>
        </td></tr>` : ''}
        <tr><td style="padding:24px 32px;font-size:12px;line-height:1.6;color:#8E947E;border-top:1px solid #262920;">
          ${DISCLAIMER} You got this email because this address was entered on the fan club website. If that wasn’t you, ignore this email or reply and we’ll delete it.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendResendEmail(apiKey, payload) {
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

export default async function handler(req, res) {
  // CORS: same-site form posts
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid JSON payload.' });
    }
  }

  // Honeypot spam protection
  if (body.website || body._gotcha || body.honeypot) {
    return res.status(200).json({
      ok: true,
      applicationId: 'RFC-2026-0000',
      status: 'filtered'
    });
  }

  const fullName = clip(body.fullName || body.name, 60);
  const email = clip(body.email, 120);
  const country = clip(body.country || body.city || body.from, 60);
  const instagram = clip(body.instagram || body.social, 50);
  const favoriteEra = clip(body.favoriteEra || body.favouriteMovie || body.movie || body.topic, 80);
  const message = clip(body.message || body.note, 4000);
  const submissionType = clip(body.submissionType || body.type || 'Fan Club Membership', 80);
  const cardStyle = clip(body.cardStyle || body.style || body.to || 'Field', 80);
  const mayShare = String(body.mayShare || (body.share ? 'yes' : 'no')).trim();

  if (!fullName) {
    return res.status(400).json({ ok: false, error: 'Full Name is required.' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'A valid Email Address is required.' });
  }
  if (!country && !submissionType.toLowerCase().includes('letter')) {
    return res.status(400).json({ ok: false, error: 'Country / City is required.' });
  }

  const applicationId = /^RFC-\d{4}-\d{4}$/.test(body.applicationId || '') ? body.applicationId : generateApplicationId(body.memberNumber);
  const firstName = fullName.split(/\s+/)[0] || fullName;
  const timestamp = new Date().toISOString();

  const resendApiKey = process.env.RESEND_API_KEY;
  const zohoReceiver = process.env.FANCLUB_INBOX || process.env.ZOHO_RECEIVER_EMAIL;
  const fromAddress = fromHeader();

  if (!resendApiKey || !zohoReceiver || !fromAddress) {
    return res.status(503).json({
      ok: false,
      error: 'Email is not set up yet (RESEND_API_KEY, FANCLUB_INBOX and RESEND_FROM_EMAIL are needed).',
      applicationId
    });
  }

  const adminHtml = buildAdminZohoEmailHtml({
    applicationId,
    submissionType,
    fullName,
    email,
    country,
    instagram,
    favoriteEra,
    message,
    cardStyle,
    mayShare,
    timestamp
  });

  const applicantHtml = buildApplicantCanvaEmailHtml({
    applicationId,
    fullName,
    firstName,
    country,
    instagram,
    favoriteEra,
    message,
    submissionType
  });

  const isLetter = /letter/i.test(submissionType);
  const adminSubject = isLetter
    ? `[Fan letter] ${fullName} — ${country || 'no city'} (#${applicationId})`
    : `[New fan club member] ${fullName} — ${country} (#${applicationId})`;

  const applicantSubject = isLetter ? `${CLUB}: we got your letter` : `Welcome to ${CLUB} (#${applicationId})`;

  const [adminResult, applicantResult] = await Promise.all([
    sendResendEmail(resendApiKey, {
      from: fromAddress,
      to: [zohoReceiver],
      reply_to: email,
      subject: adminSubject,
      html: adminHtml
    }),
    sendResendEmail(resendApiKey, {
      from: fromAddress,
      to: [email],
      reply_to: zohoReceiver,
      subject: applicantSubject,
      html: applicantHtml
    })
  ]);

  if (!adminResult.ok && !applicantResult.ok) {
    return res.status(502).json({
      ok: false,
      error:
        adminResult.data?.message ||
        applicantResult.data?.message ||
        'Email dispatch failed via Resend.',
      applicationId,
      details: {
        adminStatus: adminResult.status,
        applicantStatus: applicantResult.status
      }
    });
  }

  return res.status(200).json({
    ok: true,
    applicationId,
    timestamp,
    zohoDelivered: adminResult.ok,
    autoReplyDelivered: applicantResult.ok,
    applicant: {
      fullName,
      firstName,
      email,
      country,
      instagram,
      favoriteEra,
      status: 'MEMBER'
    }
  });
}

