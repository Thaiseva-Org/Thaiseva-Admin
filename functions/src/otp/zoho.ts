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
    text: `${senderName}\nYour email verification code is ${code}.\nThis code expires in 5 minutes. Only the most recent code works.\nDo not share this code. Our team will never ask for it.\nIf you did not request this code, you can ignore this email.`,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Verify your email</title></head>
<body style="margin:0;padding:0;background:#f2f4f8;color:#192552;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;font-size:1px;line-height:1px;color:#f2f4f8;max-height:0;max-width:0;opacity:0;overflow:hidden">Your ${brand} verification code is ${code}. Valid for 5 minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f4f8"><tr><td align="center" style="padding:36px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e8f0;border-radius:16px;overflow:hidden">
<tr><td style="height:5px;background:#ffa229;font-size:1px;line-height:5px">&nbsp;</td></tr>
<tr><td align="center" style="padding:32px 28px 26px;border-bottom:1px solid #edf0f5">
<img src="https://gothai-admin.web.app/email/thaiseva-logo.jpg" width="220" alt="${brand}" border="0" style="display:block;width:220px;max-width:100%;height:auto;color:#1c2c72;font-size:24px;font-weight:bold">
</td></tr>
<tr><td style="padding:32px 28px 12px">
<p style="margin:0 0 12px;color:#66718b;font-size:11px;line-height:16px;font-weight:bold;letter-spacing:2px">EMAIL VERIFICATION</p>
<h1 style="margin:0 0 16px;font-size:28px;line-height:36px;letter-spacing:-0.5px;color:#1c2c72">Verify your email address</h1>
<p style="margin:0;color:#59647c;font-size:16px;line-height:26px">Welcome to ${brand}. Enter the code below in the app or website to verify your email address.</p>
</td></tr>
<tr><td style="padding:16px 28px 8px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f7ff;border:1px solid #dce3fc;border-radius:12px"><tr><td align="center" style="padding:24px 12px">
<p style="margin:0 0 10px;font-size:11px;line-height:16px;letter-spacing:1.5px;color:#66718b;font-weight:bold">YOUR ONE-TIME CODE</p>
<p style="margin:0;padding-left:6px;font-family:'Courier New',Courier,monospace;font-size:36px;line-height:48px;letter-spacing:6px;font-weight:bold;color:#1c2c72">${code}</p>
<p style="margin:10px 0 0;color:#59647c;font-size:13px;line-height:20px">Expires in <strong>5 minutes</strong></p>
</td></tr></table>
</td></tr>
<tr><td style="padding:12px 28px 28px">
<p style="margin:0 0 20px;color:#59647c;font-size:13px;line-height:22px">Use the most recent code. If you request another one, this code will stop working.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff8ed;border-left:3px solid #ffa229"><tr><td style="padding:14px 16px;color:#725225;font-size:13px;line-height:21px"><strong>Keep your code private.</strong><br>Never share this code with anyone. Our team will never ask for it.</td></tr></table>
</td></tr>
<tr><td style="padding:22px 28px;background:#fafbfe;border-top:1px solid #edf0f5">
<p style="margin:0;color:#778197;font-size:12px;line-height:20px">Didn't request this email? You can safely ignore it.</p>
<p style="margin:10px 0 0;color:#778197;font-size:12px;line-height:20px">This is an automated email. Please do not reply.</p>
</td></tr></table>
<p style="margin:20px 0 0;color:#778197;font-size:12px;line-height:20px">${brand} &nbsp;&bull;&nbsp; Secure email verification</p>
<p style="margin:4px 0 0;font-size:12px;line-height:20px"><a href="https://thaiseva.com" style="color:#1c2c72;text-decoration:none">thaiseva.com</a></p>
</td></tr></table></body></html>`,
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
      subject: `Your ${config.senderName} email verification code`,
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
