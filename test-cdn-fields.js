const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

const demoToken = 'dmm_7tpONlAMTNtIMLjpr4gMSNqw9LGbgX6X';

async function testUpload() {
    const buffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    const filename = `test-${Date.now()}.gif`;
    fs.writeFileSync(filename, buffer);

    const formData = new FormData();
    formData.append('images', fs.createReadStream(filename));

    try {
        const response = await fetch('https://api.diabolicalservices.tech/api/images/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${demoToken}` },
            body: formData
        });

        const data = await response.json();
        const item = (data.uploaded && data.uploaded[0]) || (data.duplicates && data.duplicates[0]);
        console.log("ITEM KEYS:", Object.keys(item || {}));
        if (item) {
            console.log("ITEM FILENAME:", item.filename);
            console.log("ITEM URL:", item.url || 'NOT FOUND');
            console.log("ITEM CDN_URL:", item.cdnUrl || 'NOT FOUND');
        }
        fs.unlinkSync(filename);
    } catch (err) {
        console.error("Error:", err);
    }
}

testUpload();
