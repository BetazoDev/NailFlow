import { query } from '../lib/db';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function cleanup() {
    console.log('Searching for data to cleanup...');
    try {
        const clients = await query('DELETE FROM appointments');
        const staff = await query('DELETE FROM staff');
        const services = await query('DELETE FROM services');
        console.log(`Database cleaned successfully. Appointments: ${clients.rowCount}, Staff: ${staff.rowCount}, Services: ${services.rowCount}`);
    } catch (error) {
        console.error('Database cleanup failed:', error);
    } finally {
        process.exit(0);
    }
}

cleanup();
