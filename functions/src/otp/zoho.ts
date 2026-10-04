/* eslint max-len: ["error", {"code": 80,
  "ignoreTemplateLiterals": true, "ignoreRegExpLiterals": true}] */
import { normalizeEmail } from "./core";

export interface MailConfig {
  apiKey: string;
  apiUrl: string;
  from: string;
  senderName: string;
  businessDomain: string;
  replyTo?: string;
}

export function validateMailConfig(config: MailConfig): void {
  const url = new URL(config.apiUrl);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !/^(api\.zeptomail|cpaas\.zoho)\.(com|in|eu|com\.au|jp|ca|com\.cn|sa)$/.test(
      url.hostname
    ) ||
    url.pathname !== "/v1.1/email" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Configure the Zoho transactional email endpoint for your account region."
    );
  }
  const from = normalizeEmail(config.from);
  if (
    !config.apiKey.trim() ||
    config.apiKey.includes("\n") ||
    from.split("@")[1] !== config.businessDomain.trim().toLowerCase() ||
    !config.senderName.trim() ||
    /[\r\n]/.test(config.senderName)
  ) {
    throw new Error(
      "Configure the Zoho key, verified business domain and sender."
    );
  }
  if (config.replyTo) normalizeEmail(config.replyTo);
}

const entities: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
};
const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => entities[char]);

export function otpTemplate(
  code: string,
  senderName: string
): { html: string; text: string } {
  if (!/^\d{6}$/.test(code)) throw new Error("Invalid OTP template code");
  const brand = escapeHtml(senderName);
  return {
    text: `${senderName}\nYour sign-in code is ${code}.\nThis code expires in 5 minutes. Only the most recent code works.\nDo not share this code. Our team will never ask for it.\nIf you did not request this code, you can ignore this email.`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f3f6fb;font-family:Arial,sans-serif;color:#1e293b"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:40px 16px"><table role="presentation" width="100%" style="max-width:520px;background:white;border-radius:16px" cellspacing="0" cellpadding="0"><tr><td style="padding:28px 32px;background:#1d4ed8;color:white;font-size:24px;font-weight:bold;border-radius:16px 16px 0 0">${brand}</td></tr><tr><td style="padding:32px"><h1 style="font-size:24px;margin:0 0 16px">Your secure sign-in code</h1><p style="line-height:1.6">Enter the following code to sign in to your account.</p><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:24px;text-align:center;font-size:36px;letter-spacing:8px;font-weight:bold;color:#1d4ed8">${code}</div><p style="line-height:1.6">Valid for <strong>5 minutes</strong>. Only the most recent code works.</p><p style="line-height:1.6">Do not share this code. Our team will never ask for it.</p><hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0"><p style="font-size:13px;color:#64748b;line-height:1.6">If you did not request this code, you can ignore this email.</p></td></tr></table><p style="font-size:12px;color:#64748b">${brand} &bull; Account security</p></td></tr></table></body></html>`,
  };
}

export async function sendZohoOtp(
  config: MailConfig,
  email: string,
  code: string,
  reference: string,
  fetcher: typeof fetch = fetch
): Promise<void> {
  validateMailConfig(config);
  const template = otpTemplate(code, config.senderName);
  const token = config.apiKey.replace(/^Zoho-enczapikey\s+/i, "").trim();
  const response = await fetcher(config.apiUrl, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Zoho-enczapikey ${token}`,
    },
    body: JSON.stringify({
      from: { address: normalizeEmail(config.from), name: config.senderName },
      to: [{ email_address: { address: normalizeEmail(email) } }],
      subject: `Your ${config.senderName} sign-in code`,
      htmlbody: template.html,
      textbody: template.text,
      client_reference: reference,
      track_opens: false,
      track_clicks: false,
      ...(config.replyTo ?
        { reply_to: [{ address: normalizeEmail(config.replyTo) }] } :
        {}),
    }),
  });
  // Never log the provider response: it can contain recipient or message data.
  if (!response.ok) {
    throw new Error(`Zoho rejected delivery (HTTP ${response.status}).`);
  }
  const body = (await response.json()) as { error?: unknown; data?: unknown[] };
  if (body.error || !Array.isArray(body.data) || body.data.length === 0) {
    throw new Error("Zoho did not confirm acceptance.");
  }
}
