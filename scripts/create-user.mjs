import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile?.('.env.local');

function readArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return '';
  return process.argv[index + 1] || '';
}

function passwordHash(password, salt) {
  return crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
}

function buildPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt:${salt}:${passwordHash(password, salt)}`;
}

function assertConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || key.includes('...') || key.length < 80) {
    throw new Error('Configura NEXT_PUBLIC_SUPABASE_URL y una SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY real antes de crear usuarios.');
  }

  return { url, key };
}

const email = readArg('email').trim().toLowerCase();
const password = readArg('password');
const nombre = readArg('name').trim() || email;
const rol = (readArg('role').trim() || 'ADMIN').toUpperCase();
const tecnicoIdArg = readArg('tecnico-id').trim();
const tecnicoId = tecnicoIdArg ? Number(tecnicoIdArg) : null;

if (!email || !password) {
  console.error('Uso: npm run create:user -- --email admin@cmcing.cl --password "clave" --name "Admin CMCing" --role ADMIN');
  process.exit(1);
}

async function main() {
  const { url, key } = assertConfig();
  const supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const payload = {
    nombre,
    email,
    passwordHash: buildPasswordHash(password),
    rol,
    tecnicoId,
    activo: true,
  };

  const { data: existing, error: findError } = await supabase
    .from('Usuario')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (findError) throw new Error(findError.message);

  const query = existing
    ? supabase.from('Usuario').update(payload).eq('id', existing.id)
    : supabase.from('Usuario').insert(payload);

  const { data, error } = await query.select('id,email,rol,tecnicoId,activo').single();
  if (error) throw new Error(error.message);

  console.log(JSON.stringify({ ok: true, user: data }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
