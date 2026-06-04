const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Test initial connection and log status to the terminal
pool.query('SELECT NOW()')
    .then(res => console.log(`[Database] Connected successfully to PostgreSQL at ${res.rows[0].now}`))
    .catch(err => console.error(`[Database] Connection failed: ${err.message}`));

// Log errors that happen on idle clients (e.g., if the DB shuts down unexpectedly)
pool.on('error', (err) => {
    console.error('[Database] Unexpected error on idle database client:', err.message);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};