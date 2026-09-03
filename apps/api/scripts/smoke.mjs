/**
 * Smoke test for the API's HTTP surface, without a database.
 *
 * Run with `npm run smoke -w @nailflow/api` after `npm run build`.
 *
 * Boots the compiled app and exercises the routes that should answer before any
 * query runs: health, CORS policy, the 404 handler, image-proxy validation, and
 * the auth/tenant gates. A failure here means the router tree itself is wrong.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://smoke:smoke@127.0.0.1:1/smoke';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.DB_AUTO_MIGRATE = 'false';

const { createApp } = await import('../dist/app.js');

const app = createApp();
const server = app.listen(0);
const base = () => `http://127.0.0.1:${server.address().port}`;

const cases = [
    { name: 'health (root)', path: '/health', expect: 200 },
    { name: 'health (api)', path: '/api/health', expect: 200 },
    // Unmatched /api paths pass through tenant resolution first, so without a
    // reachable database they surface as 500 rather than 404.
    { name: 'unknown route is refused', path: '/api/nope', expect: [404, 500] },
    { name: 'image proxy rejects encoded traversal', path: '/api/img/slug/..%2F..%2Fetc%2Fpasswd', expect: [400, 404] },
    { name: 'image proxy rejects bad slug', path: '/api/img/..%2F..%2Fx/a.jpg', expect: [400, 404] },
    { name: 'webhook without signature is refused', path: '/api/webhooks/mercadopago', method: 'POST', expect: 401 },
    { name: 'appointments require auth', path: '/api/appointments', expect: [401, 500] },
    { name: 'favorites require auth', path: '/api/favorites', expect: [401, 500] },
    { name: 'session requires auth', path: '/api/session', expect: [401, 500] },
];

(async () => {
    let failures = 0;

    for (const test of cases) {
        const expected = Array.isArray(test.expect) ? test.expect : [test.expect];
        try {
            const response = await fetch(base() + test.path, {
                method: test.method ?? 'GET',
                headers: { host: 'demo.example.com', 'content-type': 'application/json' },
                body: test.method === 'POST' ? '{}' : undefined,
            });
            const ok = expected.includes(response.status);
            if (!ok) failures++;
            console.log(`${ok ? 'PASS' : 'FAIL'}  ${test.name} → ${response.status} (expected ${expected.join('|')})`);
        } catch (error) {
            failures++;
            console.log(`FAIL  ${test.name} → threw ${error.message}`);
        }
    }

    // CORS: an origin outside the allowlist must not be echoed back.
    const blocked = await fetch(base() + '/api/health', { headers: { origin: 'https://evil.example' } });
    const echoed = blocked.headers.get('access-control-allow-origin');
    const corsOk = echoed !== 'https://evil.example' && echoed !== '*';
    if (!corsOk) failures++;
    console.log(`${corsOk ? 'PASS' : 'FAIL'}  disallowed origin not echoed → ${echoed ?? '(none)'}`);

    const allowed = await fetch(base() + '/api/health', { headers: { origin: 'http://localhost:3000' } });
    const allowedOk = allowed.headers.get('access-control-allow-origin') === 'http://localhost:3000';
    if (!allowedOk) failures++;
    console.log(`${allowedOk ? 'PASS' : 'FAIL'}  allowed origin echoed`);

    // Security headers from helmet.
    const headers = await fetch(base() + '/health');
    const nosniff = headers.headers.get('x-content-type-options') === 'nosniff';
    if (!nosniff) failures++;
    console.log(`${nosniff ? 'PASS' : 'FAIL'}  X-Content-Type-Options set`);

    server.close();
    console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
    process.exit(failures === 0 ? 0 : 1);
})();
