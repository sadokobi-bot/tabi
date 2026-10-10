interface Env {
  RESEND_API_KEY: string
  FIREBASE_SERVICE_ACCOUNT: string
  FIREBASE_PROJECT_ID: string
  APP_URL: string
}

interface EmailRequest {
  type: 'verifyEmail' | 'resetPassword' | 'verifyAndChangeEmail'
  email: string
  displayName?: string
  idToken?: string
  newEmail?: string
}

const CORS = {
  'Access-Control-Allow-Origin': 'https://tabijap.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })
    // Browsers always send Origin on a cross-origin POST: this turns away other sites (not a determined script).
    const origin = request.headers.get('Origin')
    if (origin && origin !== 'https://tabijap.com') return new Response('Forbidden', { status: 403, headers: CORS })

    try {
      const body = (await request.json()) as EmailRequest
      if (!body.email || !body.type) return new Response('Missing email or type', { status: 400, headers: CORS })
      if (!['resetPassword', 'verifyAndChangeEmail'].includes(body.type) || body.email.length > 254) {
        return new Response('Bad request', { status: 400, headers: CORS })
      }
      // At most one mail per address and kind a minute, so this can't be used to flood someone's inbox.
      const target = (body.type === 'verifyAndChangeEmail' ? body.newEmail : body.email) ?? ''
      if (await throttled(`${body.type}:${target.trim().toLowerCase()}`)) {
        return new Response(JSON.stringify({ ok: false, error: 'TOO_FAST' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }

      const accessToken = await getAccessToken(env.FIREBASE_SERVICE_ACCOUNT)
      let link: string
      if (body.type === 'verifyAndChangeEmail') {
        if (!body.idToken || !body.newEmail) return new Response('Missing idToken or newEmail', { status: 400, headers: CORS })
        link = await changeEmailAndGenerateLink(env.FIREBASE_PROJECT_ID, accessToken, body.idToken, body.newEmail, env.APP_URL)
      } else {
        link = await generateActionLink(env.FIREBASE_PROJECT_ID, accessToken, body.type, body.email, env.APP_URL)
      }
      const appLink = rewriteLink(link, env.APP_URL)
      const emailType = body.type === 'verifyAndChangeEmail' ? 'verifyEmail' : body.type
      const recipient = body.type === 'verifyAndChangeEmail' ? body.newEmail! : body.email

      await sendEmail(env.RESEND_API_KEY, recipient, body.displayName ?? '', emailType, appLink)

      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    } catch (error) {
      console.error('[email worker]', error)
      const message = error instanceof Error ? error.message : ''
      // Only what the app acts on goes back; Firebase's own messages stay in the logs.
      const safe = message === 'EMAIL_EXISTS' ? 'EMAIL_EXISTS' : 'FAILED'
      return new Response(JSON.stringify({ ok: false, error: safe }), {
        status: safe === 'EMAIL_EXISTS' ? 409 : 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }
  },
}

/** Per-data-centre cooldown kept in the Workers cache. True when this key was used in the last minute. */
async function throttled(key: string): Promise<boolean> {
  const cache = caches.default
  const url = `https://throttle.invalid/${encodeURIComponent(key)}`
  if (await cache.match(url)) return true
  await cache.put(url, new Response('1', { headers: { 'Cache-Control': 'max-age=60' } }))
  return false
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson.replace(/^﻿/, '').trim())
  const now = Math.floor(Date.now() / 1000)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = btoa(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/firebase',
    }),
  )
  const unsigned = `${header}.${payload}`
  const key = await importPKCS8(sa.private_key)
  const signature = await sign(key, unsigned)
  const jwt = `${unsigned}.${signature}`

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const data = (await response.json()) as { access_token: string }
  return data.access_token
}

async function importPKCS8(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey('pkcs8', binary, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
}

async function sign(key: CryptoKey, data: string): Promise<string> {
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function generateActionLink(
  projectId: string,
  accessToken: string,
  type: 'verifyEmail' | 'resetPassword',
  email: string,
  continueUrl: string,
): Promise<string> {
  const requestType = type === 'verifyEmail' ? 'VERIFY_EMAIL' : 'PASSWORD_RESET'
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:sendOobCode`
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestType, email, returnOobLink: true, continueUrl }),
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Firebase: ${error}`)
  }
  const data = (await response.json()) as { oobLink: string }
  return data.oobLink
}

async function changeEmailAndGenerateLink(
  projectId: string,
  accessToken: string,
  idToken: string,
  newEmail: string,
  continueUrl: string,
): Promise<string> {
  const lookupUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`
  const lookupRes = await fetch(lookupUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!lookupRes.ok) throw new Error(`Firebase lookup: ${await lookupRes.text()}`)
  const lookupData = (await lookupRes.json()) as { users: { localId: string }[] }
  const uid = lookupData.users?.[0]?.localId
  if (!uid) throw new Error('User not found')

  const updateUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`
  const updateRes = await fetch(updateUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ localId: uid, email: newEmail, emailVerified: false }),
  })
  if (!updateRes.ok) {
    const error = await updateRes.text()
    if (error.includes('EMAIL_EXISTS')) throw new Error('EMAIL_EXISTS')
    throw new Error(`Firebase update: ${error}`)
  }

  return generateActionLink(projectId, accessToken, 'verifyEmail', newEmail, continueUrl)
}

function rewriteLink(firebaseLink: string, appUrl: string): string {
  const url = new URL(firebaseLink)
  const mode = url.searchParams.get('mode')
  const oobCode = url.searchParams.get('oobCode')
  return `${appUrl}?mode=${mode}&oobCode=${oobCode}`
}

async function sendEmail(apiKey: string, to: string, name: string, type: string, link: string) {
  const isReset = type === 'resetPassword'
  const subject = isReset ? 'Tabi 旅 — איפוס סיסמה' : 'Tabi 旅 — אישור כתובת המייל'
  const heading = isReset ? 'איפוס סיסמה' : 'אישור כתובת המייל'
  const body = isReset
    ? 'קיבלנו בקשה לאפס את הסיסמה של החשבון שלך. לחצו על הכפתור לבחירת סיסמה חדשה:'
    : 'כדי לאמת את כתובת המייל שלך ולהפעיל את כל האפשרויות בחשבון, לחצו על הכפתור:'
  const button = isReset ? 'בחירת סיסמה חדשה' : 'אישור כתובת המייל'
  const footer = isReset
    ? 'אם לא ביקשתם לאפס סיסמה, אפשר להתעלם מההודעה הזו. הסיסמה הנוכחית לא תשתנה.'
    : 'אם לא ביקשתם לאמת כתובת מייל, אפשר להתעלם מההודעה הזו.'

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f1ee;font-family:'Heebo',Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ee;padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:480px;width:100%">
        <!-- Header -->
        <tr><td style="padding:0;text-align:center">
          <img src="https://tabijap.com/mail-header.png" alt="Tabi — הטיול שלך ליפן" width="480" style="display:block;width:100%;max-width:480px;height:auto;border-radius:16px 16px 0 0" />
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 28px;text-align:right;direction:rtl">
          <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#1a1a1a">${heading}</p>
          <p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:#444">${name ? `שלום ${escapeHtml(name.slice(0, 60))},` : 'שלום,'}</p>
          <p style="margin:8px 0 0;font-size:15px;line-height:1.7;color:#444">${body}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0">
            <tr><td align="center">
              <a href="${link}" style="display:inline-block;background:#c0552c;color:#ffffff;font-size:16px;font-weight:700;padding:14px 44px;border-radius:12px;text-decoration:none;letter-spacing:0.3px">${button}</a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:12px;line-height:1.6;color:#999">${footer}</p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#faf8f6;padding:20px 28px;text-align:center;border-top:1px solid #eee">
          <p style="margin:0;font-size:12px;color:#aaa">צוות Tabi 旅 · <a href="https://tabijap.com" style="color:#c0552c;text-decoration:none">tabijap.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Tabi 旅 <noreply@tabijap.com>', to, subject, html }),
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Resend: ${error}`)
  }
}
