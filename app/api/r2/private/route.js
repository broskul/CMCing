import { NextResponse } from 'next/server';
import { getObjectFromR2, parsePrivateR2Url } from '../../../lib/r2';

export const runtime = 'nodejs';

function normalizeKey(value) {
  const parsed = parsePrivateR2Url(value);
  const key = parsed?.key || String(value || '');

  if (!key || key.startsWith('/') || key.includes('..')) return '';
  if (!/^(private\/|firmas\/|servicios\/)/.test(key)) return '';

  return key;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = normalizeKey(searchParams.get('key') || searchParams.get('url'));

    if (!key) {
      return NextResponse.json({ error: 'Archivo privado invalido.' }, { status: 400 });
    }

    const object = await getObjectFromR2({ key });

    return new NextResponse(object.buffer, {
      headers: {
        'Cache-Control': 'private, max-age=60',
        'Content-Type': object.contentType,
        'Content-Length': String(object.buffer.length),
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}
