/**
 * Client permission helper — mirrors server rules for hide/disable UI.
 * Never replaces Express middleware. Server remains authoritative.
 */
(function (global) {
  function user() {
    if (global.DmaApp && typeof DmaApp.user === "function") return DmaApp.user() || {};
    try {
      var parsed = JSON.parse(localStorage.getItem("clinicos-store") || "{}");
      return (parsed.state && parsed.state.user) || {};
    } catch (_) {
      return {};
    }
  }

  function roleOf(u) {
    u = u || user();
    return String(u.role || "").toUpperCase();
  }

  function staffRoleOf(u) {
    u = u || user();
    if (roleOf(u) === "STAFF") {
      return String(u.staffRole || u.clinicRole || "RECEPTIONIST").toUpperCase();
    }
    return "";
  }

  function isOwner(u) {
    return roleOf(u) !== "STAFF" && roleOf(u) !== "SUPERADMIN" && roleOf(u) !== "PATIENT";
  }

  function isStaff(u) {
    return roleOf(u) === "STAFF";
  }

  function isSuperadmin(u) {
    return roleOf(u) === "SUPERADMIN";
  }

  function canChart(u) {
    if (isOwner(u)) return true;
    return staffRoleOf(u) === "NURSE";
  }

  function canPrescribe(u) {
    return isOwner(u);
  }

  function canWriteAR(u) {
    if (isOwner(u)) return true;
    var sr = staffRoleOf(u);
    return sr === "RECEPTIONIST" || sr === "MANAGER";
  }

  function canManageStaff(u) {
    return isOwner(u);
  }

  function canOpenWhatsApp(u) {
    return isOwner(u);
  }

  function canTrainAI(u) {
    return isOwner(u);
  }

  function canSeeAnalytics(u) {
    return isOwner(u);
  }

  function canSeeSettings(u) {
    return isOwner(u);
  }

  function tooltipWhenDenied(can, label) {
    if (can) return "";
    return "You do not have permission to " + (label || "do this") + ".";
  }

  global.DmaPerm = {
    user: user,
    roleOf: roleOf,
    staffRoleOf: staffRoleOf,
    isOwner: isOwner,
    isStaff: isStaff,
    isSuperadmin: isSuperadmin,
    canChart: canChart,
    canPrescribe: canPrescribe,
    canWriteAR: canWriteAR,
    canManageStaff: canManageStaff,
    canOpenWhatsApp: canOpenWhatsApp,
    canTrainAI: canTrainAI,
    canSeeAnalytics: canSeeAnalytics,
    canSeeSettings: canSeeSettings,
    tooltipWhenDenied: tooltipWhenDenied,
  };
})(window);
