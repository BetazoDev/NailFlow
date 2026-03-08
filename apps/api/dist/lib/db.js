"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = void 0;
const pg_1 = require("pg");
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
});
const query = (text, params) => pool.query(text, params);
exports.query = query;
exports.default = pool;
