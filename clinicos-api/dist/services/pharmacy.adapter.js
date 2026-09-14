"use strict";
/**
 * Future pharmacy-rail boundary. No provider is connected.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendToPharmacy = sendToPharmacy;

async function sendToPharmacy(/* prescription */) {
  return {
    ok: false,
    code: "PHARMACY_RAIL_UNAVAILABLE",
    error: "No e-prescribe pharmacy rail is connected.",
  };
}
