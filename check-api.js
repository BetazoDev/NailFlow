const fetch = require('node-fetch');

async function checkServices() {
    const API_URL = 'https://demo.diabolicalservices.tech/api/services?domain=demo.diabolicalservices.tech';
    try {
        const response = await fetch(API_URL, {
            headers: {
                'x-tenant-domain': 'demo.diabolicalservices.tech'
            }
        });
        const data = await response.json();
        console.log("SERVICES:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

checkServices();
