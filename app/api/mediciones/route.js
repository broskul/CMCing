import { NextResponse } from 'next/server';
import { routeError } from '../../lib/api-response';
import { createMedicionCatalogo, listMedicionesCatalogo } from '../../lib/service-work-store';

export async function GET() {
  try {
    return NextResponse.json(await listMedicionesCatalogo());
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request) {
  try {
    return NextResponse.json(await createMedicionCatalogo(await request.json()), { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
