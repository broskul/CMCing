import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.loadEnvFile?.('.env.local');

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, '..');
const migrationsDirectory = path.join(repositoryRoot, 'supabase', 'migrations');

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Falta ${name}. Configure la credencial en el vault y ejecute este comando mediante Vault.ps1 Run.`);
  return value;
}

function projectRef() {
  const configured = String(process.env.SUPABASE_PROJECT_REF || '').trim();
  if (configured) return configured;

  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const match = url.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/i);
  if (!match) throw new Error('Falta SUPABASE_PROJECT_REF o una NEXT_PUBLIC_SUPABASE_URL válida.');
  return match[1];
}

function migrationFilename() {
  const filename = String(process.argv[2] || '').trim();
  if (!filename) {
    throw new Error('Uso: npm run supabase:apply -- 20260804114000_equipo_identidad_imagenes_y_criticidad_ot.sql');
  }
  if (!/^\d{14}_[a-z0-9_\-]+\.sql$/i.test(filename)) {
    throw new Error('El nombre de migración no es válido. Use un archivo .sql versionado de supabase/migrations.');
  }
  return filename;
}

async function main() {
  const accessToken = requiredEnv('SUPABASE_ACCESS_TOKEN');
  const filename = migrationFilename();
  const migrationPath = path.join(migrationsDirectory, filename);
  await access(migrationPath);
  const query = await readFile(migrationPath, 'utf8');
  const ref = projectRef();

  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Supabase Management rechazó la migración (${response.status}): ${result.message || result.error || 'sin detalle público'}`);
  }

  console.log(JSON.stringify({ ok: true, projectRef: ref, migration: filename }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
