import { getSettings } from "@/lib/localDb";

/**
 * Email delivery supporting two providers, configured in settings:
 *   - "resend": Resend HTTP API (no extra transport, just fetch)
 *   - "smtp":   any SMTP server via nodemailer
 *
 * Returns { ok, error } rather than throwing so callers (e.g. key rotation)
 * can proceed even when notification fails.
 */

function resolveFrom(settings) {
  const address = (settings.emailFromAddress || "").trim();
  if (!address) return null;
  const name = (settings.emailFromName || "").trim();
  return name ? `${name} <${address}>` : address;
}

async function sendViaResend(settings, { to, subject, html, text }) {
  const apiKey = (settings.resendApiKey || "").trim();
  if (!apiKey) return { ok: false, error: "Resend API key is not configured" };

  const from = resolveFrom(settings);
  if (!from) return { ok: false, error: "Sender address is not configured" };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html, text }),
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body?.message) detail = body.message;
    } catch {
      // ignore JSON parse failure, keep status-based detail
    }
    return { ok: false, error: `Resend send failed: ${detail}` };
  }
  return { ok: true };
}

async function sendViaSmtp(settings, { to, subject, html, text }) {
  const host = (settings.smtpHost || "").trim();
  if (!host) return { ok: false, error: "SMTP host is not configured" };

  const from = resolveFrom(settings);
  if (!from) return { ok: false, error: "Sender address is not configured" };

  const { default: nodemailer } = await import("nodemailer");
  const port = Number(settings.smtpPort) || 587;
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: settings.smtpSecure === true || port === 465,
    auth: settings.smtpUser
      ? { user: settings.smtpUser, pass: settings.smtpPassword || "" }
      : undefined,
  });

  await transport.sendMail({ from, to, subject, html, text });
  return { ok: true };
}

/**
 * Send an email using the configured provider. `overrideSettings` lets the
 * "test connection" route try unsaved values without persisting them first.
 */
export async function sendEmail({ to, subject, html, text }, overrideSettings = null) {
  try {
    const settings = overrideSettings || (await getSettings());
    if (!settings.emailEnabled && !overrideSettings) {
      return { ok: false, error: "Email notifications are disabled" };
    }
    if (!to) return { ok: false, error: "Recipient address is required" };

    const provider = settings.emailProvider === "smtp" ? "smtp" : "resend";
    const payload = { to, subject, html, text };
    return provider === "smtp"
      ? await sendViaSmtp(settings, payload)
      : await sendViaResend(settings, payload);
  } catch (error) {
    return { ok: false, error: error?.message || "Email send failed" };
  }
}

/**
 * Notify a key manager that their API key was rotated. Includes the new key
 * value since the manager needs it to update their integrations.
 */
export async function sendKeyRotationEmail({ to, managerName, keyName, newKey, expiresAt }) {
  const greeting = managerName ? `Hi ${managerName},` : "Hi,";
  const expiryLine = expiresAt
    ? `<p>This key expires on <strong>${new Date(expiresAt).toLocaleString()}</strong>.</p>`
    : "";
  const subject = `Your 9Router API key "${keyName}" was rotated`;
  const html = `
    <div style="font-family: system-ui, sans-serif; line-height: 1.5;">
      <p>${greeting}</p>
      <p>The API key <strong>${keyName}</strong> has been rotated. The previous key is now invalid. Please update your integrations with the new key below:</p>
      <pre style="background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:12px;font-size:14px;">${newKey}</pre>
      ${expiryLine}
      <p style="color:#71717a;font-size:12px;">If you did not expect this change, contact your 9Router administrator immediately.</p>
    </div>
  `;
  const text = `${greeting}\n\nThe API key "${keyName}" has been rotated. The previous key is now invalid. New key:\n\n${newKey}\n${expiresAt ? `\nThis key expires on ${new Date(expiresAt).toLocaleString()}.\n` : ""}\nIf you did not expect this change, contact your 9Router administrator immediately.`;

  return sendEmail({ to, subject, html, text });
}
