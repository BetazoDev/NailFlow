import { query } from '../src/lib/db';

async function clearTestData() {
  console.log('Connecting to database to clear test bookings...');

  try {
    // We only delete appointments, slot_locks, and client_favorites.
    // Services and Staff will be kept.
    // Tenants are kept.

    console.log('Clearing appointments...');
    await query('TRUNCATE appointments CASCADE');

    console.log('Clearing client_favorites...');
    await query('TRUNCATE client_favorites CASCADE');

    console.log('Clearing slot_locks...');
    await query('TRUNCATE slot_locks CASCADE');

    console.log('✅ Test data cleared successfully (bookings, clients, and locks)!');
    console.log('Services and Staff remain intact.');
  } catch (error) {
    console.error('❌ Failed to clear test data:', error);
  } finally {
    process.exit(0);
  }
}

clearTestData();
