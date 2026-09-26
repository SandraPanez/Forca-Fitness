const { Pool } = require('pg');
require('dotenv').config();

// Configuración del pool de conexiones a la base de datos PostgreSQL
// Se soporta conexión a través de DATABASE_URL (para AWS/Render/Heroku)
// o por medio de variables individuales (para desarrollo local)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Configuraciones adicionales recomendadas para producción
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
