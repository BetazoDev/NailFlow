import { query } from './lib/db';

async function migrate() {
    console.log('Running manual migration to add image columns...');
    try {
        await query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS image_urls JSONB');
        await query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS image_url TEXT');
        console.log('Migration completed successfully!');
    } catch (e) {
        console.error('Migration failed:', e);
    }
}

migrate().then(() => process.exit(0));
