process.loadEnvFile?.('.env.local');

function requiredEnv(...names) {
  const entry = names
    .map((name) => [name, String(process.env[name] || '').trim()])
    .find(([, value]) => value);
  if (!entry) throw new Error(`Falta configurar ${names.join(' o ')}.`);
  return entry[1];
}

async function checkTable(baseUrl, key, table, fields) {
  const url = `${baseUrl}/rest/v1/${table}?select=${encodeURIComponent(fields)}&limit=1`;
  const response = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Accept-Profile': 'public',
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${table}: ${payload.code || response.status} ${payload.message || 'consulta rechazada'}`);
  }
}

async function main() {
  const baseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL').replace(/\/$/, '');
  const key = requiredEnv('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY');

  await Promise.all([
    checkTable(baseUrl, key, 'Equipo', 'id,codigoInterno,partNumber,ean,imagenR2Key'),
    checkTable(baseUrl, key, 'Cliente', 'id,nombre,esEmpresaCMCing'),
    checkTable(baseUrl, key, 'OrdenTrabajo', 'id,criticidad,prioridad'),
  ]);

  console.log(JSON.stringify({ ok: true, schema: 'equipment-identity-and-work-order-criticality' }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
