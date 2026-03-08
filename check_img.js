
const { Client } = require('pg');
const client = new Client({
    connectionString: "postgresql://u351939521_nail_user:NnailFlow_2025@82.197.82.77:5432/u351939521_nailflow_db"
});

async function run() {
    await client.connect();
    const res = await client.query('SELECT image_url FROM services WHERE image_url IS NOT NULL LIMIT 5');
    console.log(JSON.stringify(res.rows, null, 2));
    await client.end();
}

run().catch(console.error);
