const fetch = require('node-fetch');

async function testDiscovery(token) {
    const url = 'https://api.diabolicalservices.tech/api/images/discovery';
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        console.log(`TOKEN: ${token.substring(0, 10)}...`);
        console.log(`SLUG: ${data.client?.slug}`);
        console.log(`-------------------`);
    } catch (e) {
        console.error(e);
    }
}

const demoToken = 'dmm_7tpONlAMTNtIMLjpr4gMSNqw9LGbgX6X';
const clientsToken = 'dmm_XKnnaMPrgRWaRHQ21deaQ3Krz2B6iBW';

async function run() {
    await testDiscovery(demoToken);
    await testDiscovery(clientsToken);
}

run();
