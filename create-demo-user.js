const apiKey = "AIzaSyDi8FLD8Itnv93f7_AcCRQJZwNUBShx9dI";
const email = "demo@nailflow.com";
const password = "DemoNails2026!";

async function createUser() {
    try {
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
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
            console.error("Error creating user:", JSON.stringify(data.error, null, 2));
            process.exit(1);
        }
        console.log("-----------------------------------------");
        console.log("DEMO USER CREATED SUCCESSFULLY");
        console.log("Email:", email);
        console.log("Password:", password);
        console.log("LocalId:", data.localId);
        console.log("-----------------------------------------");
    } catch (err) {
        console.error("Fetch error:", err);
        process.exit(1);
    }
}

createUser();
