/**
 * Phase 0 route inventory for the UI redesign harness.
 * Roles: public, auth, clinic (HTML-only without creds), superadmin (HTML-only without creds).
 */
"use strict";

const PUBLIC = [
  "/",
  "/platform/",
  "/ai-receptionist/",
  "/clinic-crm/",
  "/clinical/",
  "/patient-experience/",
  "/solutions/",
  "/pricing/",
  "/faqs/",
  "/contact/",
  "/about/",
  "/privacy/",
  "/terms/",
  "/security/",
  "/data-deletion/",
  "/data-processing/",
  "/demo/",
  "/start/",
];

const AUTH = [
  "/doctor-login/",
  "/staff-login/",
  "/admin-login/",
  "/register/",
  "/register/clinic/",
  "/register/hours/",
  "/register/plan/",
  "/forgot-password/",
  "/reset-password/",
  "/verify-email/",
  "/accept-invite/",
  "/book/",
  "/patients/",
  "/verify/",
  "/my-appointments/",
];

const CLINIC = [
  "/dashboard/",
  "/dashboard/appointments/",
  "/dashboard/calendar/",
  "/dashboard/waiting/",
  "/dashboard/patients/",
  "/dashboard/patients/detail/",
  "/dashboard/messages/",
  "/dashboard/whatsapp/",
  "/dashboard/broadcasts/",
  "/dashboard/communication/",
  "/dashboard/ai/",
  "/dashboard/leads/",
  "/dashboard/clinical/",
  "/dashboard/consult/",
  "/dashboard/vitals/",
  "/dashboard/prescriptions/",
  "/dashboard/laboratory/",
  "/dashboard/documents/",
  "/dashboard/staff/",
  "/dashboard/doctors/",
  "/dashboard/rooms/",
  "/dashboard/operations/",
  "/dashboard/inventory/",
  "/dashboard/leave/",
  "/dashboard/telemedicine/",
  "/dashboard/locations/",
  "/dashboard/payments/",
  "/dashboard/tasks/",
  "/dashboard/analytics/",
  "/dashboard/reports/",
  "/dashboard/reviews/",
  "/dashboard/billing/",
  "/dashboard/settings/",
  "/dashboard/notifications/",
];

const SUPERADMIN = [
  "/superadmin/",
  "/superadmin/clinics/",
  "/superadmin/clinics/detail/",
  "/superadmin/users/",
  "/superadmin/subscriptions/",
  "/superadmin/stripe/",
  "/superadmin/revenue/",
  "/superadmin/whatsapp/",
  "/superadmin/announcements/",
  "/superadmin/support/",
  "/superadmin/settings/",
  "/superadmin/security/",
  "/superadmin/health/",
  "/superadmin/audit/",
  "/superadmin/integrations/",
  "/superadmin/api/",
];

const DEV = ["/dev/ui/"];

const WIDTHS = [360, 768, 1024, 1366, 1920];
const THEMES = ["light", "dark"];

/** Representative pages for the 5×2 viewport × theme matrix. */
const SWEEP = ["/", "/doctor-login/", "/staff-login/", "/admin-login/", "/dashboard/", "/superadmin/", "/pricing/"];

/** Axe on public/auth surfaces only (dashboard redirects need auth). */
const AXE_ROUTES = ["/", "/doctor-login/", "/staff-login/", "/admin-login/", "/pricing/", "/faqs/", "/contact/"];

function allInventory() {
  return PUBLIC.concat(AUTH, CLINIC, SUPERADMIN);
}

module.exports = {
  PUBLIC,
  AUTH,
  CLINIC,
  SUPERADMIN,
  DEV,
  WIDTHS,
  THEMES,
  SWEEP,
  AXE_ROUTES,
  allInventory,
};
