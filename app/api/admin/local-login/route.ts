/**
 * POST /api/admin/local-login
 * Dev-only static admin login. Disabled when NODE_ENV !== development.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isLocalAdminEnabled,
  LOCAL_ADMIN_EMAIL,
  LOCAL_ADMIN_PASSWORD,
  LOCAL_ADMIN_TOKEN,
} from '@/lib/admin';

export async function POST(request: NextRequest) {
  if (!isLocalAdminEnabled()) {
    return NextResponse.json(
      { error: 'Local admin login is disabled outside development' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (email === LOCAL_ADMIN_EMAIL && password === LOCAL_ADMIN_PASSWORD) {
      return NextResponse.json({
        success: true,
        token: LOCAL_ADMIN_TOKEN,
        email: LOCAL_ADMIN_EMAIL,
      });
    }

    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
