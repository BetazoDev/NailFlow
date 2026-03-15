"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./lib/db");
async function migrate() {
    console.log('Running manual migration to add image columns...');
    try {
        await (0, db_1.query)('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS image_urls JSONB');
        await (0, db_1.query)('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS image_url TEXT');
        console.log('Migration completed successfully!');
    }
    catch (e) {
        console.error('Migration failed:', e);
    }
}
migrate().then(() => process.exit(0));
