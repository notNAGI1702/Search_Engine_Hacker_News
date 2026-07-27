const fs = require('fs');
const path = require('path');
const db = require('./index');

async function runMigration() {
  console.log('Starting database migrations...');
  const migrationPath = path.join(__dirname, 'migrations', '01_init.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  try {
    await db.query(sql);
    console.log('Migration completed successfully. docs table is ready.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

runMigration();
