import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) {
    return NextResponse.json(
      { error: 'احراز هویت انجام نشده است.' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    admin: {
      id: admin.id,
      username: admin.username,
      fullName: admin.fullName,
      role: admin.role,
      permissions: admin.permissions,
    },
    csrfToken: admin.csrfToken,
  });
}
