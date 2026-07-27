const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'hn_search',
};

// If individual credentials aren't sufficient, fallback to DATABASE_URL
if (!config.user && process.env.DATABASE_URL) {
  config.connectionString = process.env.DATABASE_URL;
  // delete config properties that might conflict
  delete config.host;
  delete config.port;
  delete config.user;
  delete config.password;
  delete config.database;
}

const pool = new Pool(config);

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
