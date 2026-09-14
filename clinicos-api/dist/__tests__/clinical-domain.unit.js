"use strict";
/**
 * DB-free unit checks for Phase 5 chart migration + slot overlap.
 * Run: node dist/__tests__/clinical-domain.unit.js
 */
const assert = require("assert");
const chart = require("../lib/clinicos-chart");
const schedule = require("../services/schedule.service");

const sample = "Free text\n[[clinicos-chart]]\n" + JSON.stringify({
  vitals: { bp: "120/80", hr: "72" },
  complaint: "Headache",
  diagnosis: "Tension headache",
  rx: [{ medication: "Paracetamol", strength: "500mg" }],
  labs: ["CBC"],
  followup: "3 days",
  draft: false,
});

const parsed = chart.parseChart(sample);
assert.equal(parsed.text, "Free text");
assert.equal(parsed.chart.complaint, "Headache");
assert.equal(parsed.chart.vitals.bp, "120/80");
assert.equal(parsed.chart.rx[0].medication, "Paracetamol");
assert.equal(chart.vitalsHasData(parsed.chart.vitals), true);
assert.equal(chart.vitalsHasData({}), false);

const empty = chart.parseChart("plain notes only");
assert.equal(empty.chart.draft, true);
assert.equal(empty.text, "plain notes only");

const a0 = new Date("2026-09-14T10:00:00Z");
const a1 = new Date("2026-09-14T10:30:00Z");
const b0 = new Date("2026-09-14T10:15:00Z");
const b1 = new Date("2026-09-14T10:45:00Z");
assert.equal(schedule.overlaps(a0, a1, b0, b1), true);
assert.equal(schedule.overlaps(a0, a1, a1, new Date("2026-09-14T11:00:00Z")), false);

const blocked = schedule.slotIsBlocked(a0, a1, {
  leaves: [{ practitionerId: "p1", startsAt: a0, endsAt: a1 }],
  blocks: [],
}, { practitionerId: "p1" });
assert.equal(blocked, true);

const notBlocked = schedule.slotIsBlocked(a0, a1, {
  leaves: [{ practitionerId: "p2", startsAt: a0, endsAt: a1 }],
  blocks: [],
}, { practitionerId: "p1" });
assert.equal(notBlocked, false);

console.log("clinical-domain.unit.js ok");
