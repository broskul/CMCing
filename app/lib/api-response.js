import { NextResponse } from 'next/server';
import { jsonErrorStatus } from './request-auth';

export function routeError(error, { internalMessage } = {}) {
  const status = jsonErrorStatus(error);
  const message = status >= 500 && internalMessage
    ? internalMessage
    : error?.message || 'Error interno.';

  return NextResponse.json(
    { error: message },
    { status },
  );
}
