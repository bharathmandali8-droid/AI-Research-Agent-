/**
 * migrate.js — runs supabase/migrations/001_pgvector.sql against Supabase
 * Usage: node scripts/migrate.js
 *
 * SUPABASE_DB_PASSWORD can be either:
 *   - The plain password:  r9EngZnJ/_hvkTa
 *   - The full URI:        postgresql://postgres:[r9EngZnJ/_hvkTa]@db.xxx.supabase.co:5432/postgres
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function buildClientConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const dbPasswordRaw = process.env.SUPABASE_DB_PASSWORD;

  if (!supabaseUrl) {
    console.error('❌  SUPABASE_URL not set in server/.env');
    process.exit(1);
  }
  if (!dbPasswordRaw) {
    console.error('❌  SUPABASE_DB_PASSWORD not set in server/.env');
    process.exit(1);
  }

  // If the value looks like a full connection URI, parse host/user/pass from it
  if (dbPasswordRaw.startsWith('postgresql://') || dbPasswordRaw.startsWith('postgres://')) {
    // Strip Supabase UI's decorative brackets around password: [pass] → pass
    const stripped = dbPasswordRaw.replace(/:(\[)([^\]]+)(\])@/, ':$2@');

    // Parse with URL — encode special chars in password first
    // Extract password between :// user : pass @ host
    const match = stripped.match(/^(postgresql|postgres):\/\/([^:]+):(.+)@(.+)$/);
    if (!match) {
      console.error('❌  Could not parse connection string. Check SUPABASE_DB_PASSWORD format.');
      process.exit(1);
    }
    const [, , user, rawPass, hostAndDb] = match;
    const encodedPass = encodeURIComponent(rawPass);
    const refMatch = hostAndDb.match(/db\.([^.]+)\.supabase\.co/);
    if (refMatch) {
      const ref = refMatch[1];
      const host = `db.${ref}.supabase.co`;
      // Use explicit config (not connection string) so pg uses system DNS which resolves IPv4
      console.log(`📋  Connecting directly to ${host}:5432`);
      return {
        host,
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: rawPass,   // plain password, not URL-encoded, for config object
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
        family: 4,           // force IPv4
      };
    }
    const cleanUri = `postgresql://${user}:${encodedPass}@${hostAndDb}`;
    console.log(`📋  Connecting as user '${user}'`);
    return { connectionString: cleanUri, ssl: { rejectUnauthorized: false } };
  }

  // Plain password — derive host from SUPABASE_URL
  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
  const host = `db.${projectRef}.supabase.co`;
  console.log(`📋  Using host: ${host}`);
  return {
    host,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: dbPasswordRaw,
    ssl: { rejectUnauthorized: false },
  };
}

async function main() {
  const config = buildClientConfig();
  const client = new Client(config);

  const sqlPath = path.join(__dirname, '../..', 'supabase', 'migrations', '001_pgvector.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('🔌  Connecting to Supabase...');
  await client.connect();
  console.log('✅  Connected.');

  console.log('🚀  Running migration...');
  await client.query(sql);
  console.log('✅  Migration complete — pgvector table and RPC function created.');

  await client.end();
}

main().catch((err) => {
  console.error('❌  Migration failed:', err.message);
  process.exit(1);
});
