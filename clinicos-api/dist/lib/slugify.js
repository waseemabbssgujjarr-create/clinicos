"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slugify = slugify;
/**
 * Converts a doctor's name to a URL-safe booking slug.
 * Example: "Dr. Ahmed Rahman" → "dr-ahmed-rahman"
 */
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}
//# sourceMappingURL=slugify.js.map