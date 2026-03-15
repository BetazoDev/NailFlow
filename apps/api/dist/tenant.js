"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantByDomain = getTenantByDomain;
exports.getTenantById = getTenantById;
const db_1 = require("./lib/db");
async function getTenantByDomain(domain) {
    let searchDomain = domain;
    if (domain.includes('localhost') || domain === 'api-demo.diabolicalservices.tech') {
        searchDomain = 'demo.diabolicalservices.tech';
    }
    const res = await (0, db_1.query)('SELECT * FROM tenants WHERE domain = $1', [searchDomain]);
    if (res.rowCount === 0)
        return null;
    return res.rows[0];
}
async function getTenantById(id) {
    const res = await (0, db_1.query)('SELECT * FROM tenants WHERE id = $1', [id]);
    if (res.rowCount === 0)
        return null;
    return res.rows[0];
}
