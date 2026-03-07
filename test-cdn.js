const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFkbWluLWlkIiwiZW1haWwiOiJhZG1pbkBkaWFib2xpY2FsLnRlY2giLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzI4MzM3NjAsImV4cCI6MTgwNDM2OTc2MH0.AGehR76_EM6Xv_hG2uUkiEueOOrE7jzAsNw9IvJOgFk';
const uploadUrl = 'https://api.diabolicalservices.tech/api/images/upload';

async function testUpload() {
    const formData = new FormData();
    // We need a dummy file or something
    const dummyFilePath = 'test-image.txt';
    fs.writeFileSync(dummyFilePath, 'dummy data');

    formData.append('images', fs.createReadStream(dummyFilePath));
    formData.append('client_id', 'c6d224a2-1ebc-480a-8ccc-dcaf06258f01');
    formData.append('project_id', 'a4ebae0c-6ce2-482a-8774-e1a9aee72c79');

    try {
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        if (response.ok) {
            console.log("UPLOAD SUCCESSFUL");
        } else {
            console.error("UPLOAD FAILED");
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

testUpload();
