import { query } from './apps/api/src/lib/db';
import * as dotenv from 'dotenv';
dotenv.config({ path: './apps/api/.env' });

async function cleanup() {
    console.log('Cleaning up database...');
    try {
        await query('TRUNCATE appointments, staff, services CASCADE;');
        console.log('Database cleaned successfully.');
    } catch (error) {
        console.error('Database cleanup failed:', error);
    } finally {
        process.exit(0);
    }
}

cleanup();
