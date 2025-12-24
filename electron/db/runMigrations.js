// Migration runner for Supabase
// This script should be run manually in Supabase SQL Editor since Supabase JS client
// doesn't support raw SQL execution directly
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'migrations');

console.log('📦 Migration files to run manually in Supabase SQL Editor:\n');

const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();

for (const file of migrationFiles) {
  const migrationPath = path.join(migrationsDir, file);
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log(`\n--- ${file} ---`);
  console.log(sql);
  console.log('\n');
}

console.log('\n💡 Copy and paste these SQL statements into Supabase SQL Editor to run migrations.');

