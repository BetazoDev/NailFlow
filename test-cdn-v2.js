const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

const token = 'dmm_7tpONlAMTNtIMLjpr4gMSNqw9LGbgX6X';
const uploadUrl = 'https://api.diabolicalservices.tech/api/images/upload';

async function testUpload() {
    // Basic red 1x1 JPG (base64)
    const base64Jpg = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEReference: AAAA/9k=';
    const buffer = Buffer.from(base64Jpg, 'base64');
    fs.writeFileSync('test-image.jpg', buffer);

    const formData = new FormData();
    formData.append('images', fs.createReadStream('test-image.jpg'), { filename: 'test-image.jpg', contentType: 'image/jpeg' });
    // No necesitas especificar client_id ni project_id, la API los deduce de tu llave.
    // formData.append('client_id', 'c6d224a2-1ebc-480a-8ccc-dcaf06258f01');
    // formData.append('project_id', 'a4ebae0c-6ce2-482a-8774-e1a9aee72c79');

    try {
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();
        console.log("RESULT:", JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error:", err);
    }
}

testUpload();
