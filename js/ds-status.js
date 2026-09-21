/**
 * Single status registry — domain enum → label, semantic, description.
 * Meaning is never color-alone; pair with the label.
 */
(function (global) {
  var SEM = {
    neutral: { semantic: "neutral", tone: "ds-pill-neutral" },
    info: { semantic: "info", tone: "ds-pill-info" },
    success: { semantic: "success", tone: "ds-pill-ok" },
    warning: { semantic: "warning", tone: "ds-pill-warn" },
    danger: { semantic: "danger", tone: "ds-pill-danger" },
  };

  function entry(label, semantic, description) {
    var s = SEM[semantic] || SEM.neutral;
    return {
      label: label,
      semantic: s.semantic,
      tone: s.tone,
      description: description || "",
    };
  }

  var MAP = {
    appointment: {
      PENDING: entry("Pending", "warning", "Awaiting confirmation"),
      CONFIRMED: entry("Confirmed", "info", "Booked and confirmed"),
      ARRIVED: entry("Arrived", "info", "Checked in"),
      WAITING: entry("Waiting", "info", "In the waiting room"),
      CALLED: entry("Called", "info", "Called from the waiting room"),
      IN_PROGRESS: entry("In progress", "info", "Consultation underway"),
      COMPLETED: entry("Completed", "success", "Visit finished"),
      CANCELLED: entry("Cancelled", "neutral", "Appointment cancelled"),
      NO_SHOW: entry("No show", "danger", "Patient did not attend"),
      RESCHEDULED: entry("Rescheduled", "neutral", "Moved to another slot"),
    },
    encounter: {
      DRAFT: entry("Draft", "neutral", "Chart not started"),
      IN_PROGRESS: entry("In progress", "info", "Chart open"),
      COMPLETED: entry("Completed", "success", "Encounter closed"),
    },
    prescription: {
      DRAFT: entry("Draft", "neutral", "Not issued"),
      ISSUED: entry("Issued", "success", "Issued to the patient"),
      CANCELLED: entry("Cancelled", "neutral", "Prescription cancelled"),
    },
    lab: {
      ORDERED: entry("Ordered", "info", "Lab order placed"),
      COLLECTED: entry("Collected", "info", "Sample collected"),
      PROCESSING: entry("Processing", "warning", "Lab processing"),
      COMPLETED: entry("Completed", "success", "Results in"),
      CANCELLED: entry("Cancelled", "neutral", "Order cancelled"),
    },
    room: {
      AVAILABLE: entry("Available", "success", "Room free"),
      RESERVED: entry("Reserved", "info", "Held for a visit"),
      OCCUPIED: entry("Occupied", "warning", "In use"),
      BLOCKED: entry("Blocked", "neutral", "Not bookable"),
    },
    invoice: {
      DRAFT: entry("Draft", "neutral", "Not issued"),
      OPEN: entry("Open", "warning", "Awaiting payment"),
      PARTIAL: entry("Partial", "warning", "Part paid"),
      PAID: entry("Paid", "success", "Settled"),
      VOID: entry("Void", "neutral", "Voided"),
      REFUNDED: entry("Refunded", "info", "Refunded"),
    },
    plan: {
      TRIAL: entry("Trial", "neutral", "Trial plan"),
      STARTER: entry("Starter", "info", "Starter plan"),
      PRO: entry("Pro", "info", "Pro plan"),
      ENTERPRISE: entry("Enterprise", "info", "Enterprise plan"),
    },
    planStatus: {
      ACTIVE: entry("Active", "success", "Subscription active"),
      TRIALING: entry("Trial", "neutral", "In trial"),
      PAST_DUE: entry("Past due", "danger", "Payment past due"),
      CANCELLED: entry("Cancelled", "neutral", "Subscription cancelled"),
    },
    lead: {
      NEW: entry("New", "info", "New lead"),
      CONTACTED: entry("Contacted", "info", "Outreach started"),
      QUALIFIED: entry("Qualified", "success", "Qualified"),
      WON: entry("Won", "success", "Converted"),
      LOST: entry("Lost", "neutral", "Closed lost"),
      HOT: entry("Hot", "danger", "Hot lead"),
      WARM: entry("Warm", "warning", "Warm lead"),
      COLD: entry("Cold", "neutral", "Cold lead"),
    },
    whatsapp: {
      active: entry("Connected", "success", "WhatsApp connected"),
      connected: entry("Connected", "success", "WhatsApp connected"),
      CONNECTED: entry("Connected", "success", "WhatsApp connected"),
      disconnected: entry("Disconnected", "danger", "WhatsApp not connected"),
      DISCONNECTED: entry("Disconnected", "danger", "WhatsApp not connected"),
    },
    clinic: {
      ACTIVE: entry("Active", "success", "Clinic is active"),
      SUSPENDED: entry("Suspended", "danger", "Clinic suspended"),
    },
    health: {
      ONLINE: entry("Online", "success", "Process responded"),
      DEGRADED: entry("Degraded", "warning", "Degraded or partial"),
      OFFLINE: entry("Offline", "danger", "Did not respond"),
      UNKNOWN: entry("Unknown", "neutral", "Not measured"),
    },
  };

  function lookup(domain, raw) {
    var key = String(raw == null ? "" : raw).trim();
    var table = MAP[domain] || {};
    if (table[key]) return table[key];
    var upper = key.toUpperCase();
    if (table[upper]) return table[upper];
    var lower = key.toLowerCase();
    if (table[lower]) return table[lower];
    if (!key) return entry("—", "neutral", "No status");
    return entry(key.replace(/_/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); }), "neutral", "");
  }

  function pill(domain, raw) {
    var s = lookup(domain, raw);
    var esc = global.DmaUI && DmaUI.esc
      ? DmaUI.esc
      : function (t) {
        return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
          return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
        });
      };
    return '<span class="ds-pill ' + s.tone + '" title="' + esc(s.description) + '">' + esc(s.label) + "</span>";
  }

  global.DmaStatus = {
    lookup: lookup,
    pill: pill,
    MAP: MAP,
  };
})(window);
