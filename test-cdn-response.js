const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

const token = 'dmm_7tpONlAMTNtIMLjpr4gMSNqw9LGbgX6X';
const uploadUrl = 'https://api.diabolicalservices.tech/api/images/upload';

async function testUpload() {
    const base64Jpg = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEReference: AAAA/9k=';
    const buffer = Buffer.from(base64Jpg, 'base64');
    const filename = `test-${Date.now()}.jpg`;
    fs.writeFileSync(filename, buffer);

    const formData = new FormData();
    formData.append('images', fs.createReadStream(filename));

    try {
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await response.json();
        if (data.duplicates && data.duplicates.length > 0) {
            console.log("FILENAME:", data.duplicates[0].filename);
        } else if (data.uploaded && data.uploaded.length > 0) {
            console.log("FILENAME:", data.uploaded[0].filename);
        } else {
            console.log("DATA:", JSON.stringify(data));
        }
        fs.unlinkSync(filename);
    } catch (err) {
        console.error("Error:", err);
    }
}

testUpload();
