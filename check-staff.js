const fetch = require('node-fetch');

async function checkStaff() {
    const API_URL = 'https://demo.diabolicalservices.tech/api/staff';
    try {
        const response = await fetch(API_URL, {
            headers: {
                'x-tenant-domain': 'demo.diabolicalservices.tech'
            }
        });
        const data = await response.json();
        console.log("STAFF:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

checkStaff();
