"use strict";
/**
 * lib/crypto.js — re-exports Node.js built-in crypto module.
 *
 * This file exists so that any compiled dist file that requires './lib/crypto'
 * (or '../lib/crypto') resolves to the real Node.js crypto module rather than
 * failing with "Cannot find module './lib/crypto.js'".
 *
 * No custom implementation. No fallback. Pure built-in re-export.
 */
module.exports = require("crypto");
