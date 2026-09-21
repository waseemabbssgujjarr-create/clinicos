/**
 * Canonical nav catalogs for clinic + superadmin.
 * Shells remain the runtime source; this file documents the contract for /dev/ui.
 * Do not add /dashboard/leads/ to clinic groups (orphaned on purpose).
 */
(function (global) {
  var CLINIC_OWNER_GROUPS = [
    ["Clinic", ["home", "patients"]],
    ["Front desk", ["appointments", "waiting", "messages", "whatsapp"]],
    ["Care", ["clinical"]],
    ["Practice", ["staff", "rooms"]],
    ["Grow", ["ai", "analytics"]],
    ["Setup", ["settings"]]
  ];
  var ADMIN_GROUPS = [
    ["Platform", ["/superadmin/", "/superadmin/clinics/", "/superadmin/users/"]],
    ["Business", ["/superadmin/subscriptions/"]],
    ["Operations", ["/superadmin/whatsapp/"]],
    ["System", ["/superadmin/settings/"]]
  ];
  global.DmaNavConfig = {
    CLINIC_OWNER_GROUPS: CLINIC_OWNER_GROUPS,
    ADMIN_GROUPS: ADMIN_GROUPS,
    NOTES: "Runtime nav is still dashboard-doctor-shell.js / superadmin-admin-shell.js. Leads stay off the sidebar."
  };
})(window);
