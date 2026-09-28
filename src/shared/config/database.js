const { Pool } = require('pg');
require('dotenv').config();

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const useSsl = process.env.DB_SSL === 'true' || hasDatabaseUrl;

const pool = new Pool({
  ...(hasDatabaseUrl
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      }),
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (error) => {
  console.error('Error inesperado en el pool de PostgreSQL:', error);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  checkConnection: async () => {
    const result = await pool.query('SELECT 1 AS connected');
    return result.rows[0].connected === 1;
  },
  pool
};
