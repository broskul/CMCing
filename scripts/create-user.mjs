import { createClient } from '@supabase/supabase-js';

process.loadEnvFile?.('.env.local');

const ALLOWED_ROLES = new Set(['SUPERADMIN', 'ADMIN', 'OPERACIONES', 'TECNICO', 'LECTURA']);
const EXTERNAL_BOOTSTRAP_EMAIL = 'carlos@prof3sional.com';

function readArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? '' : String(process.argv[index + 1] || '');
}

function requiredEnv(...names) {
  const entry = names
    .map((name) => [name, String(process.env[name] || '').trim()])
    .find(([, value]) => value);
  if (!entry) throw new Error(`Falta configurar ${names.join(' o ')}.`);
  return entry[1];
}

function assertBootstrapEmail(email) {
  if (email !== EXTERNAL_BOOTSTRAP_EMAIL) {
    throw new Error('Las cuentas @cmcing.cl se aprovisionan por Microsoft SSO. Este comando queda reservado al superadmin externo autorizado.');
  }
}

async function findAuthUserByEmail(supabase, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((user) => String(user.email || '').toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  throw new Error('No fue posible completar la búsqueda segura del usuario en Supabase Auth.');
}

const email = readArg('email').trim().toLowerCase();
const password = readArg('password');
const nombre = readArg('name').trim() || 'Carlos';
const rol = (readArg('role').trim() || 'SUPERADMIN').toUpperCase();

if (!email || !password) {
  console.error('Uso: npm run create:user -- --email correo --password "clave-segura" --name "Nombre" --role SUPERADMIN');
  process.exit(1);
}
if (password.length < 12) {
  console.error('La contraseña debe tener al menos 12 caracteres.');
  process.exit(1);
}
if (!ALLOWED_ROLES.has(rol)) {
  console.error(`Rol inválido: ${rol}.`);
  process.exit(1);
}

async function main() {
  assertBootstrapEmail(email);
  const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL');
  const key = requiredEnv('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let authUser = await findAuthUserByEmail(supabase, email);
  if (authUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: nombre },
    });
    if (error) throw error;
    authUser = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nombre },
    });
    if (error) throw error;
    authUser = data.user;
  }

  const { data: existing, error: findError } = await supabase
    .from('Usuario')
    .select('id')
    .ilike('email', email)
    .maybeSingle();
  if (findError) throw findError;

  const profile = {
    nombre,
    email,
    passwordHash: null,
    rol,
    authUserId: authUser.id,
    provider: 'email',
    activo: true,
    emailVerifiedAt: new Date().toISOString(),
  };
  const query = existing
    ? supabase.from('Usuario').update(profile).eq('id', existing.id)
    : supabase.from('Usuario').insert(profile);
  const { data, error } = await query.select('id,email,rol,tecnicoId,activo,authUserId').single();
  if (error) throw error;

  console.log(JSON.stringify({ ok: true, user: data }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
