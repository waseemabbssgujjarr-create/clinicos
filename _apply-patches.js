/**
 * Apply runtime patches to Next.js static chunks + inject dashboard-bootstrap.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const BOOTSTRAP_TAG = '<script src="/dashboard-bootstrap.js"></script>';
const SUPERADMIN_THEME_TAGS = '<link rel="stylesheet" href="/dma-dashboard.css" /><link rel="stylesheet" href="/superadmin-theme.css" /><script src="/dashboard-bootstrap.js"></script>';

function patchFile(rel, patches, label) {
  const file = path.join(ROOT, rel);
  let s = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const [from, to] of patches) {
    if (!s.includes(from)) {
      if (s.includes(to)) continue; // already patched
      console.error(`[${label}] MISSING pattern: ${from.slice(0, 80)}...`);
      continue;
    }
    s = s.replace(from, to);
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(file, s);
    console.log(`[${label}] patched`);
  } else {
    console.log(`[${label}] no changes needed`);
  }
}

// ── 1. Superadmin layout: logout + login-page detection ─────────────────────
patchFile(
  '_next/static/chunks/app/(superadmin)/layout-720bcf9e830ec598.js',
  [
    ['h(),r.push("/superadmin/login")', 'h(),r.push("/admin-login")'],
    [
      'm="/superadmin/login"===l||"/superadmin/login/"===l',
      'm="/admin-login"===l||"/admin-login/"===l||"/superadmin/login"===l||"/superadmin/login/"===l',
    ],
    [
      'return((0,a.useEffect)(()=>{if(!m){if(!c||!d)return void r.replace("/admin-login");if("SUPERADMIN"!==d.role)return void r.replace("/admin-login")}},[d,c,r,m]),m)?',
      'return((0,a.useEffect)(()=>{if(m)return;var x=setTimeout(function(){if(c&&d){if("SUPERADMIN"!==d.role)r.replace("/admin-login");return}try{var y=localStorage.getItem("clinicos-store");if(localStorage.getItem("token")&&y&&JSON.parse(y).state.user)return}catch(z){}r.replace("/admin-login")},450);return function(){clearTimeout(x)}},[d,c,r,m]),m)?',
    ],
  ],
  'superadmin layout'
);

// ── 1b. Superadmin layout: extra nav items ───────────────────────────────────
patchFile(
  '_next/static/chunks/app/(superadmin)/layout-720bcf9e830ec598.js',
  [
    [
      '{href:"/superadmin/announcements",icon:m.A,label:"Announcements"}]',
      '{href:"/superadmin/announcements",icon:m.A,label:"Announcements"},{href:"/superadmin/subscriptions",icon:h.A,label:"Subscriptions"},{href:"/superadmin/users",icon:c.A,label:"Users"},{href:"/superadmin/settings",icon:d.A,label:"Settings"},{href:"/superadmin/stripe",icon:p.A,label:"Connect Stripe"}]',
    ],
  ],
  'superadmin nav items'
);

// ── 1c. Superadmin layout: rebrand sidebar (ClinicOS → Doctors My Agency) ───
patchFile(
  '_next/static/chunks/app/(superadmin)/layout-720bcf9e830ec598.js',
  [
    ['children:"ClinicOS AI"', 'children:"Doctors My Agency"'],
    ['children:"Super Admin"', 'children:"Platform Admin"'],
  ],
  'superadmin layout branding'
);

// ── 1d. Dist mirror superadmin layout (different chunk hash) ─────────────────
const DIST_LAYOUT = 'clinicos-api/dist/public/_next/static/chunks/app/(superadmin)/layout-03c871282a986ead.js';
patchFile(DIST_LAYOUT, [
  ['h(),r.push("/superadmin/login")', 'h(),r.push("/admin-login")'],
  [
    'useEffect)(()=>{if(!m){if(!c||!d)return void r.replace("/superadmin/login");if("SUPERADMIN"!==d.role)return void r.replace("/login")}},[d,c,r,m]),m)?',
    'useEffect)(()=>{if(m)return;var x=setTimeout(function(){if(c&&d){if("SUPERADMIN"!==d.role)r.replace("/admin-login");return}try{var y=localStorage.getItem("clinicos-store");if(localStorage.getItem("token")&&y&&JSON.parse(y).state.user)return}catch(z){}r.replace("/admin-login")},450);return function(){clearTimeout(x)}},[d,c,r,m]),m)?',
  ],
  ['children:"ClinicOS AI"', 'children:"Doctors My Agency"'],
  ['children:"Super Admin"', 'children:"Platform Admin"'],
], 'dist superadmin layout');

patchFile(DIST_LAYOUT, [
  [
    '{href:"/superadmin/announcements",icon:m.A,label:"Announcements"}]',
    '{href:"/superadmin/announcements",icon:m.A,label:"Announcements"},{href:"/superadmin/subscriptions",icon:h.A,label:"Subscriptions"},{href:"/superadmin/users",icon:c.A,label:"Users"},{href:"/superadmin/settings",icon:d.A,label:"Settings"},{href:"/superadmin/stripe",icon:b.A,label:"Connect Stripe"}]',
  ],
], 'dist superadmin nav items');

// ── 2. Staff layout: rehydration delay before redirect ──────────────────────
patchFile(
  '_next/static/chunks/app/(staff-portal)/staff/layout-e543e3b8ea305f71.js',
  [
    [
      '(0,s.useEffect)(()=>u&&d?"DOCTOR"===d.role?void r.replace("/dashboard"):void 0:void r.replace("/staff-login"),[d,u,r])',
      '(0,s.useEffect)(()=>{var x=setTimeout(function(){if(u&&d){if("DOCTOR"===d.role)return void r.replace("/dashboard");if("STAFF"===d.role)return;return}try{var y=localStorage.getItem("clinicos-store");if(localStorage.getItem("token")&&y&&JSON.parse(y).state.user)return}catch(z){}r.replace("/staff-login")},450);return function(){clearTimeout(x)}},[d,u,r])',
    ],
  ],
  'staff layout'
);

// ── 3. Staff invite modal: empty Full Name (avoid Settings "name" autofill) ─
patchFile(
  '_next/static/chunks/app/(dashboard)/dashboard/staff/page-cb397228289cfa3b.js',
  [
    [
      '{register:g,handleSubmit:k,reset:w,formState:{errors:E}}=(0,r.mN)()',
      '{register:g,handleSubmit:k,reset:w,formState:{errors:E}}=(0,r.mN)({defaultValues:{staffFullName:"",email:"",role:"RECEPTIONIST"}})',
    ],
    [
      'onClick:()=>y(!0),children:[(0,a.jsx)(u.A,{className:"w-4 h-4"})," Invite Staff"]',
      'onClick:()=>{w({staffFullName:"",email:"",role:"RECEPTIONIST"});y(!0)},children:[(0,a.jsx)(u.A,{className:"w-4 h-4"})," Invite Staff"]',
    ],
    [
      'onSubmit:k(e=>A.mutate(e)),className:"space-y-4",noValidate:!0,children:[(0,a.jsxs)("div",{children:[(0,a.jsx)("label",{className:"block text-xs font-bold text-muted mb-1.5",children:"Full Name *"}),(0,a.jsx)("input",{className:"input",placeholder:"Fatima Al-Rashid",...g("name",{required:"Name is required"})}),E.name&&(0,a.jsx)("p",{className:"text-xs text-danger mt-1",children:E.name.message})]',
      'onSubmit:k(e=>A.mutate({name:e.staffFullName,email:e.email,role:e.role})),className:"space-y-4",noValidate:!0,children:[(0,a.jsxs)("div",{children:[(0,a.jsx)("label",{className:"block text-xs font-bold text-muted mb-1.5",children:"Full Name *"}),(0,a.jsx)("input",{className:"input",placeholder:"Fatima Al-Rashid",autoComplete:"off",...g("staffFullName",{required:"Name is required"})}),E.staffFullName&&(0,a.jsx)("p",{className:"text-xs text-danger mt-1",children:E.staffFullName.message})]',
    ],
  ],
  'staff invite page'
);

// ── 4. Inject dashboard-bootstrap.js into dashboard/staff/superadmin HTML ───
function injectBootstrap(htmlPath) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  if (!html.includes('/_next/')) return false;
  const isSuperadmin = htmlPath.replace(/\\/g, '/').includes('/superadmin/');
  const tag = isSuperadmin ? SUPERADMIN_THEME_TAGS : BOOTSTRAP_TAG;
  if (html.includes('dashboard-bootstrap.js') && (!isSuperadmin || html.includes('superadmin-theme.css'))) return false;
  if (isSuperadmin && html.includes('dashboard-bootstrap.js') && !html.includes('superadmin-theme.css')) {
    html = html.replace(BOOTSTRAP_TAG, SUPERADMIN_THEME_TAGS);
    fs.writeFileSync(htmlPath, html);
    return true;
  }
  if (html.includes('dashboard-bootstrap.js')) return false;

  // Insert before first _next script or first script tag
  const markers = [
    '<script src="/_next/',
    '<script src="/_next\\',
    '<script src="/_next',
  ];
  let inserted = false;
  for (const m of markers) {
    const idx = html.indexOf(m);
    if (idx >= 0) {
      html = html.slice(0, idx) + tag + html.slice(idx);
      inserted = true;
      break;
    }
  }
  if (!inserted) {
    const idx = html.indexOf('<script');
    if (idx >= 0) {
      html = html.slice(0, idx) + tag + html.slice(idx);
      inserted = true;
    }
  }
  if (!inserted) {
    console.error(`[bootstrap] could not inject into ${htmlPath}`);
    return false;
  }
  fs.writeFileSync(htmlPath, html);
  return true;
}

const htmlDirs = ['dashboard', 'staff', 'superadmin', path.join('clinicos-api', 'dist', 'public', 'superadmin')];
let injected = 0;
for (const dir of htmlDirs) {
  const base = path.join(ROOT, dir);
  if (!fs.existsSync(base)) continue;
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name === 'index.html') {
        if (injectBootstrap(full)) {
          injected++;
          console.log('[bootstrap] injected', path.relative(ROOT, full));
        }
      }
    }
  };
  walk(base);
}
console.log(`[bootstrap] total injected: ${injected}`);

// ── 4b. Sync theme + patients assets to dist/public mirror ───────────────────
const SYNC_FILES = [
  'superadmin-theme.css',
  'superadmin-polish.css',
  'dma-dashboard.css',
  'platform-polish.css',
  'platform-hovers.css',
  'dashboard-layout.css',
  'dashboard-fixes.css',
  'dashboard-reviews.css',
  'dashboard-bootstrap.js',
  'dashboard-layout.js',
  'dashboard-fixes.js',
  'dashboard-reviews.js',
  'dashboard-whatsapp.css',
  'dashboard-whatsapp.js',
  'dashboard-whatsapp-hub.css',
  'dashboard-whatsapp-hub.js',
  'dashboard/whatsapp/index.html',
  'superadmin-clinics-actions.js',
  'superadmin-admin-shell.js',
  'patients/index.html',
];
for (const rel of SYNC_FILES) {
  const src = path.join(ROOT, rel);
  const dest = path.join(ROOT, 'clinicos-api', 'dist', 'public', rel);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('[sync]', rel, '→ dist/public');
}

const STATIC_SA = [
  'superadmin/users/index.html',
  'superadmin/subscriptions/index.html',
  'superadmin/settings/index.html',
  'superadmin/stripe/index.html',
  'superadmin/clinics/detail/index.html',
  'superadmin/integrations/index.html',
  'superadmin/whatsapp/index.html',
];
for (const rel of STATIC_SA) {
  const src = path.join(ROOT, rel);
  const dest = path.join(ROOT, 'clinicos-api', 'dist', 'public', rel);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('[sync]', rel, '→ dist/public');
}

// Copy root superadmin layout chunk to dist only if dist hash differs — branding
// is patched in-place above on layout-03c871282a986ead.js

// ── 5. Verify dashboard layout ──────────────────────────────────────────────
const dash = fs.readFileSync(
  path.join(ROOT, '_next/static/chunks/app/(dashboard)/dashboard/layout-8b478dd2da6190e7.js'),
  'utf8'
);
const dashOk =
  dash.includes('doctor-login') &&
  dash.includes('setTimeout') &&
  !dash.includes('push("/login")') &&
  dash.includes('i.push("/doctor-login")');
console.log('[verify] dashboard layout OK:', dashOk);

console.log('Done.');
