import { NextResponse } from 'next/server';
import { getDashboardStats } from '../../lib/cmms-store';

export async function GET() {
  try {
    const response = NextResponse.json(await getDashboardStats());
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
