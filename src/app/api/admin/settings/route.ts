import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp, requireAdminApi } from '@/lib/auth';
import { ensureDefaultAppData } from '@/lib/bootstrap';
import { recordAuditLog } from '@/lib/audit';
import { appSettingsUpdateSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  await ensureDefaultAppData();
  const settings = await prisma.appSettings.findUnique({ where: { id: 'default' } });
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminApi(req, { superAdminOnly: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = appSettingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'تنظیمات واردشده معتبر نیست.' },
      { status: 400 }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.appSettings.upsert({
      where: { id: 'default' },
      update: parsed.data,
      create: {
        id: 'default',
        ...parsed.data,
      },
    });

    await recordAuditLog(
      {
        adminId: auth.admin.id,
        action: 'APP_SETTINGS_UPDATED',
        entityType: 'AppSettings',
        entityId: 'default',
        metadata: {
          isFormAvailable: row.isFormAvailable,
          isPublicSubmissionEnabled: row.isPublicSubmissionEnabled,
          timezone: row.timezone,
        },
        ipAddress: getClientIp(req),
      },
      tx
    );

    return row;
  });

  return NextResponse.json({ settings: updated });
}
