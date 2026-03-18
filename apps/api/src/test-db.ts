import { query } from './lib/db';

async function test() {
    try {
        const res = await query('SELECT id, name, branding, settings FROM tenants');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
}

test();
