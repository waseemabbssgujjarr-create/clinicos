"use strict";
/**
 * Legacy [[clinicos-chart]] parser. Used once during migration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHART_MARK = void 0;
exports.emptyChart = emptyChart;
exports.parseChart = parseChart;
exports.vitalsHasData = vitalsHasData;

exports.CHART_MARK = "[[clinicos-chart]]";

function emptyChart() {
  return {
    vitals: {},
    complaint: "",
    history: "",
    exam: "",
    diagnosis: "",
    assessment: "",
    treatment: "",
    rx: [],
    labs: [],
    followup: "",
    draft: true,
  };
}

function parseChart(notes) {
  const s = String(notes || "");
  const i = s.indexOf(exports.CHART_MARK);
  const base = emptyChart();
  if (i < 0) return { text: s, chart: base };
  try {
    const parsed = JSON.parse(s.slice(i + exports.CHART_MARK.length).trim() || "{}");
    return { text: s.slice(0, i).trim(), chart: Object.assign(base, parsed) };
  } catch (_) {
    return { text: s, chart: base };
  }
}

function vitalsHasData(vitals) {
  if (!vitals || typeof vitals !== "object") return false;
  return Object.keys(vitals).some((k) => vitals[k] != null && String(vitals[k]).trim() !== "");
}
