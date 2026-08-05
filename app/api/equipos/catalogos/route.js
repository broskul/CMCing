import { NextResponse } from 'next/server';
import { routeError } from '../../../lib/api-response';
import { listEquipmentOwners } from '../../../lib/equipment-service';
import { requireRequestUser } from '../../../lib/request-auth';

export async function GET(request) {
  try {
    await requireRequestUser(request);
    return NextResponse.json({ propietarios: await listEquipmentOwners() });
  } catch (error) {
    return routeError(error);
  }
}
