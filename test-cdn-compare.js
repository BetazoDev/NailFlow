const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

const demoToken = 'dmm_7tpONlAMTNtIMLjpr4gMSNqw9LGbgX6X';
const clientsToken = 'dmm_XKnnaMPrgRWaRHQ21deaQ3Krz2B6iBW';

async function testUpload(token, name) {
    const base64Jpg = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEReference: AAAA/9k=';
    const buffer = Buffer.from(base64Jpg, 'base64');
    const filename = `test-${name}-${Date.now()}.jpg`;
    fs.writeFileSync(filename, buffer);

    const formData = new FormData();
    formData.append('images', fs.createReadStream(filename));

    try {
        const response = await fetch('https://api.diabolicalservices.tech/api/images/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await response.json();
        console.log(`${name} FULL DATA:`, JSON.stringify(data));
        fs.unlinkSync(filename);
    } catch (err) {
        console.error(`${name} Error:`, err);
    }
}

async function run() {
    await testUpload(demoToken, 'DEMO');
    await testUpload(clientsToken, 'CLIENTS');
}

run();
