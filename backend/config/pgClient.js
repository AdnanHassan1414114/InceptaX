/**
 * config/pgClient.js
 *
 * Single shared Postgres connection pool for the entire app — same
 * singleton pattern as config/redisClient.js (one shared client,
 * lazily created, reused everywhere).
 *
 * WHY A "POOL" AND NOT A SINGLE CONNECTION:
 *   A single Postgres connection can only run one query at a time —
 *   if two requests hit the database simultaneously, one has to wait.
 *   A "pool" is just a small set of pre-opened connections (the `pg`
 *   library calls this a Pool) that get handed out to whichever query
 *   needs one and returned when done. You don't manage this yourself —
 *   you call pool.query(...) and the library picks an available
 *   connection from the pool automatically. This is the standard,
 *   expected way to talk to Postgres from a Node server; it's not an
 *   extra layer of complexity, it's just how the 'pg' library works.
 *
 * Install: npm install pg
 *
 * .env:
 *   POSTGRES_URL=postgresql://user:password@host:port/database
 *   (Railway/Supabase both give you this connection string directly
 *   when you provision a Postgres instance)
 */

const { Pool } = require('pg');

let _pool = null;

function getPgPool() {
  if (_pool) return _pool;

  if (!process.env.POSTGRES_URL) {
    console.error('❌ POSTGRES_URL missing in .env');
    process.exit(1);
  }

  _pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    // Most managed Postgres providers (Railway, Supabase, Render) require
    // SSL but use a self-signed-looking cert chain for internal routing —
    // rejectUnauthorized: false is the standard setting for this, same
    // idea as how many managed Mongo/Redis providers handle their
    // internal TLS termination.
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  _pool.on('connect', () => console.log('✅ Postgres pool connected'));
  _pool.on('error', (err) => console.error('❌ Postgres pool error:', err.message));

  return _pool;
}

module.exports = getPgPool;