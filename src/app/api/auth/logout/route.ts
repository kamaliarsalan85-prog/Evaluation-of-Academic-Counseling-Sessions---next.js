import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clearSessionCookie, getClientIp, requireAdminApi } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) {
    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res, req);
    return res;
  }

  await prisma.adminSession
    .update({
      where: { id: auth.admin.sessionId },
      data: { revokedAt: new Date() },
    })
    .catch(() => {});

  await recordAuditLog({
    adminId: auth.admin.id,
    action: 'ADMIN_LOGOUT',
    entityType: 'Administrator',
    entityId: auth.admin.id,
    ipAddress: getClientIp(req),
  }).catch(() => {});

  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res, req);
  return res;
}
