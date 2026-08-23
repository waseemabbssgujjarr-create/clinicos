"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const path = require("path");
const { PrismaClient } = require(path.join(__dirname, "../../generated/prisma"));
const globalForPrisma = globalThis;
exports.prisma = globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
if (process.env.NODE_ENV !== 'production')
    globalForPrisma.prisma = exports.prisma;
