const fs = require('fs');
const apiKey = "AIzaSyDi8FLD8Itnv93f7_AcCRQJZwNUBShx9dI";
const email = "demo@nailflow.com";
const password = "DemoNails2026!";

async function signIn() {
    try {
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                returnSecureToken: true
            })
        });

        const data = await response.json();
        if (data.error) {
            console.error("Error signing in:", JSON.stringify(data.error, null, 2));
            process.exit(1);
        }
        const result = `UID: ${data.localId}`;
        fs.writeFileSync('uid.txt', result);
        console.log("UID saved to uid.txt");
    } catch (err) {
        console.error("Fetch error:", err);
        process.exit(1);
    }
}

signIn();
