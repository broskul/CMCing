import { NextResponse } from 'next/server';
import { routeError } from '../../../lib/api-response';
import { getServiceWorkCatalogs } from '../../../lib/service-work-store';

export async function GET() {
  try {
    return NextResponse.json(await getServiceWorkCatalogs());
  } catch (error) {
    return routeError(error);
  }
}
