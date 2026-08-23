"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-minimum-50-characters-long-for-jest-testing-purposes-only';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'mysql://root:@localhost:3306/clinicos_test';
process.env.PORT = '3002';
process.env.APP_URL = 'http://localhost:3002';
process.env.FRONTEND_URL = 'http://localhost:3000';
// Suppress console output in tests unless DEBUG=1
if (!process.env.DEBUG) {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
}
//# sourceMappingURL=setup.js.map