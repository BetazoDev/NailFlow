const jwt = require('jsonwebtoken');

const secret = 'd1ab0l1cal-m3d1a-jwt-s3cr3t-pr0duct10n-2026';
const payload = {
    id: 'admin-id',
    email: 'admin@diabolical.tech',
    role: 'admin'
};

const token = jwt.sign(payload, secret, { expiresIn: '365d' });
console.log('JWT_TOKEN:', token);
