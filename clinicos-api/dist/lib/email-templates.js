"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailLayout = emailLayout;
exports.brandName = brandName;
exports.supportEmail = supportEmail;
function brandName() {
    const n = (process.env.APP_NAME || 'Doctors My Agency').trim();
    if (/ClinicOS|MediCore/i.test(n)) return 'Doctors My Agency';
    return n || 'Doctors My Agency';
}
function supportEmail() {
    return process.env.SMTP_FROM?.match(/<([^>]+)>/)?.[1]
        || process.env.SMTP_USER
        || 'info@doctorsmyagency.com';
}
function emailLayout({ title, preheader, bodyHtml, ctaLabel, ctaUrl }) {
    const brand = brandName();
    const support = supportEmail();
    const appUrl = process.env.APP_URL || 'https://doctorsmyagency.com';
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Inter,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${preheader || title}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:0 0 24px;text-align:center;">
          <div style="display:inline-block;background:linear-gradient(135deg,#F97316,#ea580c);color:#fff;font-weight:800;font-size:14px;padding:10px 18px;border-radius:10px;">DM · ${brand}</div>
        </td></tr>
        <tr><td style="background:#1e293b;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:36px 32px;">
          <h1 style="margin:0 0 16px;color:#f8fafc;font-size:22px;">${title}</h1>
          <div style="color:#cbd5e1;font-size:15px;line-height:1.7;">${bodyHtml}</div>
          ${ctaLabel && ctaUrl ? `
          <p style="margin:28px 0 0;">
            <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#F97316,#ea580c);color:#fff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:10px;">${ctaLabel}</a>
          </p>` : ''}
        </td></tr>
        <tr><td style="padding:24px 8px 0;text-align:center;color:#64748b;font-size:12px;line-height:1.6;">
          <p style="margin:0;">${brand} · CRM for doctors, clinics &amp; hospitals</p>
          <p style="margin:8px 0 0;"><a href="${appUrl}" style="color:#fb923c;text-decoration:none;">${appUrl.replace(/^https?:\/\//, '')}</a> · <a href="mailto:${support}" style="color:#fb923c;">${support}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
