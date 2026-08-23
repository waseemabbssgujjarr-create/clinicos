"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.comparePassword = comparePassword;
exports.hashPassword = hashPassword;
const bcryptjs_1 = require("bcryptjs");
const bcrypt = bcryptjs_1.default || bcryptjs_1;
const SALT_ROUNDS = 12;
/** PHP password_hash() uses $2y$ — bcryptjs needs $2a$ prefix */
function normalizeBcryptHash(hash) {
    if (!hash || typeof hash !== 'string')
        return hash;
    if (hash.startsWith('$2y$'))
        return '$2a$' + hash.slice(4);
    return hash;
}
async function comparePassword(plain, hash) {
    if (!plain || !hash)
        return false;
    return bcrypt.compare(plain, normalizeBcryptHash(hash));
}
async function hashPassword(plain) {
    return bcrypt.hash(plain, SALT_ROUNDS);
}
