"use strict";
/**
 * Loads PlatformSetting rows into process.env so SMTP/AI/Twilio/Stripe
 * can be configured from Superadmin → Integrations without editing .env.
 * Uses raw SQL so existing Prisma client does not need regenerate.
 */
const { prisma } = require("../lib/prisma");

const CATALOG = [
  { key: "APP_URL", group: "app", label: "Public app URL", secret: false, placeholder: "https://doctorsmyagency.com", guide: "Used in emails, webhooks, and OAuth redirects." },
  { key: "FRONTEND_URL", group: "app", label: "Frontend URL", secret: false, placeholder: "https://doctorsmyagency.com", guide: "CORS origin and redirect target." },
  { key: "APP_NAME", group: "app", label: "Platform name", secret: false, placeholder: "Doctors My Agency", guide: "Shown in emails and branding." },
  { key: "TRIAL_DAYS", group: "app", label: "Trial days", secret: false, placeholder: "14", guide: "New clinic trial length." },

  { key: "SMTP_HOST", group: "email", label: "SMTP host", secret: false, placeholder: "mail.doctorsmyagency.com", guide: "Your mail server hostname." },
  { key: "SMTP_PORT", group: "email", label: "SMTP port", secret: false, placeholder: "465", guide: "465 (SSL) or 587 (STARTTLS)." },
  { key: "SMTP_USER", group: "email", label: "SMTP username", secret: false, placeholder: "info@doctorsmyagency.com", guide: "Full mailbox email address." },
  { key: "SMTP_PASS", group: "email", label: "SMTP password", secret: true, placeholder: "", guide: "Mailbox password. Leave blank to keep existing." },
  { key: "SMTP_FROM", group: "email", label: "From address", secret: false, placeholder: "Doctors My Agency <info@doctorsmyagency.com>", guide: "Visible From on outgoing email." },

  { key: "AI_PROVIDER", group: "ai", label: "AI provider", secret: false, placeholder: "deepseek", guide: "deepseek or openai." },
  { key: "DEEPSEEK_API_KEY", group: "ai", label: "DeepSeek API key", secret: true, placeholder: "", guide: "Required for AI receptionist." },
  { key: "AI_BASE_URL", group: "ai", label: "AI base URL", secret: false, placeholder: "https://api.deepseek.com", guide: "API endpoint base." },
  { key: "AI_MODEL", group: "ai", label: "AI model", secret: false, placeholder: "deepseek-chat", guide: "Model id from your provider." },
  { key: "OPENAI_API_KEY", group: "ai", label: "OpenAI API key", secret: true, placeholder: "", guide: "Optional if using OpenAI instead of DeepSeek." },
  { key: "OPENAI_MODEL", group: "ai", label: "OpenAI model", secret: false, placeholder: "gpt-4o-mini", guide: "Used when AI_PROVIDER=openai." },

  { key: "TWILIO_ACCOUNT_SID", group: "twilio", label: "Twilio Account SID", secret: false, placeholder: "ACxxxxxxxx", guide: "From Twilio console." },
  { key: "TWILIO_AUTH_TOKEN", group: "twilio", label: "Twilio Auth Token", secret: true, placeholder: "", guide: "Keep secret." },
  { key: "TWILIO_WHATSAPP_NUMBER", group: "twilio", label: "WhatsApp number", secret: false, placeholder: "whatsapp:+14155238886", guide: "Webhook: {APP_URL}/api/webhooks/twilio" },
  { key: "TWILIO_SMS_NUMBER", group: "twilio", label: "SMS number", secret: false, placeholder: "+1XXXXXXXXXX", guide: "E.164 format." },

  { key: "META_APP_ID", group: "meta", label: "Meta App ID", secret: false, placeholder: "", guide: "Your Doctors My Agency Meta App ID. From Meta App Dashboard → Settings → Basic." },
  { key: "META_APP_SECRET", group: "meta", label: "Meta App Secret", secret: true, placeholder: "", guide: "From Meta → App Settings → Basic. Keep this secret." },
  { key: "META_CONFIG_ID", group: "meta", label: "Embedded Signup Config ID", secret: false, placeholder: "", guide: "From your approved Doctors My Agency Meta App → WhatsApp → Embedded Signup. Required for clinic Connect with Meta." },
  { key: "META_GRAPH_API_VERSION", group: "meta", label: "Graph API version", secret: false, placeholder: "v21.0", guide: "Meta Graph API version. Update when Meta deprecates older versions." },
  { key: "META_WEBHOOK_VERIFY_TOKEN", group: "meta", label: "Webhook verify token", secret: false, placeholder: "", guide: "Random string. Must match Meta App → WhatsApp → Configuration → Verify token." },
  { key: "META_ENCRYPTION_KEY", group: "meta", label: "Token encryption key", secret: true, placeholder: "", guide: "MANDATORY. 32+ char random hex. Encrypts per-clinic WhatsApp tokens at rest. Set ONCE — never change after clinics have connected or all tokens become unreadable. Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"" },
  { key: "WHATSAPP_EMBEDDED_SIGNUP_ENABLED", group: "meta", label: "Embedded Signup enabled", secret: false, placeholder: "true", guide: "Set true after Meta App Review. Clinic dashboard uses Embedded Signup only (no shop/catalog onboarding)." },

  { key: "STRIPE_SECRET_KEY", group: "stripe", label: "Stripe secret key", secret: true, placeholder: "sk_live_… or sk_test_…", guide: "Billing after trial." },
  { key: "STRIPE_WEBHOOK_SECRET", group: "stripe", label: "Stripe webhook secret", secret: true, placeholder: "whsec_…", guide: "Webhook: {APP_URL}/api/webhooks/stripe" },
  { key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", group: "stripe", label: "Stripe publishable key", secret: false, placeholder: "pk_live_…", guide: "Safe for browser checkout." },
  { key: "STRIPE_STARTER_PRICE_ID", group: "stripe", label: "Starter price ID", secret: false, placeholder: "price_…", guide: "Stripe Price id." },
  { key: "STRIPE_PRO_PRICE_ID", group: "stripe", label: "Pro price ID", secret: false, placeholder: "price_…", guide: "Stripe Price id." },
  { key: "STRIPE_ENTERPRISE_PRICE_ID", group: "stripe", label: "Enterprise price ID", secret: false, placeholder: "price_…", guide: "Stripe Price id." },

  { key: "CLOUDINARY_CLOUD_NAME", group: "cloudinary", label: "Cloudinary cloud name", secret: false, placeholder: "", guide: "Clinic logo uploads." },
  { key: "CLOUDINARY_API_KEY", group: "cloudinary", label: "Cloudinary API key", secret: false, placeholder: "", guide: "From Cloudinary dashboard." },
  { key: "CLOUDINARY_API_SECRET", group: "cloudinary", label: "Cloudinary API secret", secret: true, placeholder: "", guide: "Keep secret." },
];

const GROUP_META = {
  app: { title: "App", description: "Site URLs and product name." },
  email: { title: "Email (SMTP)", description: "Password reset, verification, staff invites, daily briefs." },
  ai: { title: "AI Receptionist", description: "DeepSeek / OpenAI for chat booking and CRM AI features." },
  twilio: { title: "Twilio (WhatsApp / SMS)", description: "Legacy fallback. Prefer Meta WhatsApp for clinics." },
  meta: { title: "Meta WhatsApp (Cloud API)", description: "Approved Doctors My Agency Meta app. Clinics connect with Embedded Signup." },
  stripe: { title: "Stripe billing", description: "Required only when trials convert to paid plans." },
  cloudinary: { title: "Cloudinary", description: "Optional clinic logo / media uploads." },
};

function isPlaceholder(v) {
  if (v == null) return true;
  const s = String(v).trim();
  if (!s) return true;
  return /placeholder|changeme|your[-_ ]|REPLACE_/i.test(s);
}

function envReady(key) {
  return !isPlaceholder(process.env[key]);
}

function maskSecret(value) {
  if (!value || isPlaceholder(value)) return { set: false, masked: "" };
  const s = String(value);
  if (s.length <= 6) return { set: true, masked: "••••••" };
  return { set: true, masked: "••••••••" + s.slice(-4) };
}

async function ensureTable() {
  // Soft-fail: Prisma engine panics (e.g. "timer has gone away") under LVE/OOM
  // or flaky localhost MySQL must never crash boot. Caller already try/catches.
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS PlatformSetting (
        \`key\` varchar(191) NOT NULL,
        \`value\` text NOT NULL,
        \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        \`updatedBy\` varchar(191) NULL,
        PRIMARY KEY (\`key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (err) {
    // swallow — SELECT may still work if table already exists
    return false;
  }
  return true;
}

async function loadAllRows(opts) {
  const skipEnsure = opts && opts.skipEnsureTable;
  try {
    if (!skipEnsure) {
      await ensureTable();
    }
    return await prisma.$queryRawUnsafe("SELECT `key`, `value`, `updatedAt`, `updatedBy` FROM PlatformSetting");
  } catch (err) {
    // Retry once with ensureTable if we skipped it and table might be missing
    if (skipEnsure) {
      try {
        await ensureTable();
        return await prisma.$queryRawUnsafe("SELECT `key`, `value`, `updatedAt`, `updatedBy` FROM PlatformSetting");
      } catch (_) {
        return [];
      }
    }
    return [];
  }
}

function maybeResetMailer(keys) {
  const smtpTouched = (keys || []).some((k) => String(k).startsWith("SMTP_"));
  if (!smtpTouched) return;
  try {
    const email = require("./email.service");
    if (typeof email.resetEmailTransport === "function") email.resetEmailTransport();
  } catch (_) { /* ignore */ }
}

async function applyFromDatabase(opts) {
  try {
    const rows = await loadAllRows(opts);
    let applied = 0;
    const keys = [];
    for (const row of rows) {
      if (!row || !row.key) continue;
      const val = row.value == null ? "" : String(row.value);
      if (!val.trim()) continue;
      process.env[row.key] = val;
      keys.push(row.key);
      applied++;
    }
    maybeResetMailer(keys);
    return { applied, total: rows.length };
  } catch (err) {
    // Never throw from boot path — Integrations can reload later
    return { applied: 0, total: 0, error: String(err && err.message ? err.message : err) };
  }
}

function statusForGroup(group) {
  const keys = CATALOG.filter((c) => c.group === group);
  const requiredish = keys.filter((k) => !k.secret || k.key === "SMTP_PASS" || k.key === "DEEPSEEK_API_KEY" || k.key === "OPENAI_API_KEY");
  const configured = keys.filter((k) => envReady(k.key)).length;
  let status = "empty";
  if (group === "email") status = envReady("SMTP_HOST") && envReady("SMTP_USER") && envReady("SMTP_PASS") ? "ready" : configured ? "partial" : "empty";
  else if (group === "ai") status = envReady("DEEPSEEK_API_KEY") || envReady("OPENAI_API_KEY") ? "ready" : configured ? "partial" : "empty";
  else if (group === "twilio") status = envReady("TWILIO_ACCOUNT_SID") && envReady("TWILIO_AUTH_TOKEN") ? "ready" : configured ? "partial" : "empty";
  else if (group === "meta") status = envReady("META_APP_ID") && envReady("META_APP_SECRET") && envReady("META_WEBHOOK_VERIFY_TOKEN") && envReady("META_ENCRYPTION_KEY") ? "ready" : configured ? "partial" : "empty";
  else if (group === "stripe") status = envReady("STRIPE_SECRET_KEY") ? "ready" : configured ? "partial" : "empty";
  else if (group === "cloudinary") status = envReady("CLOUDINARY_CLOUD_NAME") && envReady("CLOUDINARY_API_KEY") ? "ready" : configured ? "partial" : "empty";
  else if (group === "app") status = envReady("APP_URL") ? "ready" : configured ? "partial" : "empty";
  return { configured, total: keys.length, status, requiredish: requiredish.length };
}

async function getIntegrationsPayload() {
  const rows = await loadAllRows();
  const byKey = {};
  for (const r of rows) byKey[r.key] = r;

  const groups = {};
  for (const [id, meta] of Object.entries(GROUP_META)) {
    groups[id] = {
      id,
      ...meta,
      ...statusForGroup(id),
      fields: CATALOG.filter((c) => c.group === id).map((c) => {
        const fromDb = byKey[c.key];
        const live = process.env[c.key];
        const source = fromDb && String(fromDb.value || "").trim()
          ? "database"
          : envReady(c.key)
            ? "env"
            : "empty";
        const effective = live || (fromDb && fromDb.value) || "";
        const masked = c.secret ? maskSecret(effective) : { set: !!String(effective || "").trim(), masked: String(effective || "") };
        return {
          key: c.key,
          label: c.label,
          secret: c.secret,
          placeholder: c.placeholder,
          guide: c.guide,
          source,
          set: masked.set,
          value: c.secret ? "" : (masked.set ? String(effective) : ""),
          masked: c.secret ? masked.masked : undefined,
          updatedAt: fromDb ? fromDb.updatedAt : null,
        };
      }),
    };
  }

  return {
    ok: true,
    product: "Doctors My Agency",
    mode: "crm",
    note: "Saved values override .env at runtime. Leave secret fields blank to keep the current value.",
    webhookHints: {
      twilio: `${process.env.APP_URL || "https://your-domain"}/api/webhooks/twilio`,
      meta: `${process.env.APP_URL || "https://your-domain"}/api/webhooks/meta`,
      stripe: `${process.env.APP_URL || "https://your-domain"}/api/webhooks/stripe`,
    },
    groups,
  };
}

async function upsertSettings(updates, updatedBy) {
  await ensureTable();
  const saved = [];
  const skipped = [];
  for (const [key, raw] of Object.entries(updates || {})) {
    const meta = CATALOG.find((c) => c.key === key);
    if (!meta) {
      skipped.push({ key, reason: "unknown_key" });
      continue;
    }
    let value = raw == null ? "" : String(raw);
    if (meta.secret && !value.trim()) {
      skipped.push({ key, reason: "unchanged_blank_secret" });
      continue;
    }
    value = value.replace(/\r/g, "").trim();
    await prisma.$executeRawUnsafe(
      "INSERT INTO PlatformSetting (`key`, `value`, `updatedAt`, `updatedBy`) VALUES (?, ?, NOW(3), ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updatedAt` = NOW(3), `updatedBy` = VALUES(`updatedBy`)",
      key,
      value,
      updatedBy || null
    );
    if (value) process.env[key] = value;
    else delete process.env[key];
    saved.push(key);
  }
  maybeResetMailer(saved);
  return { saved, skipped };
}

module.exports = {
  CATALOG,
  GROUP_META,
  applyFromDatabase,
  getIntegrationsPayload,
  upsertSettings,
  ensureTable,
  envReady,
};
