import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp, requireAdminApi } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { counselorSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi(req, { permission: 'MANAGE_COUNSELORS' });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => null);
  const parsed = counselorSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'اطلاعات مشاور معتبر نیست.' },
      { status: 400 }
    );
  }

  const existing = await prisma.counselor.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'مشاور یافت نشد.' }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.counselor.update({
      where: { id },
      data: {
        ...(parsed.data.firstName !== undefined ? { firstName: parsed.data.firstName } : {}),
        ...(parsed.data.lastName !== undefined ? { lastName: parsed.data.lastName } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      },
      include: { _count: { select: { submissions: true } } },
    });

    await recordAuditLog(
      {
        adminId: auth.admin.id,
        action:
          parsed.data.status && parsed.data.status !== existing.status
            ? parsed.data.status === 'ACTIVE'
              ? 'COUNSELOR_ACTIVATED'
              : 'COUNSELOR_DEACTIVATED'
            : 'COUNSELOR_UPDATED',
        entityType: 'Counselor',
        entityId: id,
        metadata: {
          name: `${row.firstName} ${row.lastName}`,
          status: row.status,
        },
        ipAddress: getClientIp(req),
      },
      tx
    );

    return row;
  });

  return NextResponse.json({
    counselor: {
      ...updated,
      submissionsCount: updated._count.submissions,
    },
  });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi(req, { permission: 'MANAGE_COUNSELORS' });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { id } = await context.params;
  const existing = await prisma.counselor.findUnique({
    where: { id },
    include: { _count: { select: { submissions: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: 'مشاور یافت نشد.' }, { status: 404 });
  }

  // Rule: Do not physically delete counselors who have associated submissions
  if (existing._count.submissions > 0) {
    return NextResponse.json(
      {
        error:
          'این مشاور دارای ارزیابی‌های ثبت‌شده در سوابق است و قابل حذف فیزیکی نیست. لطفاً وضعیت مشاور را به «غیرفعال» تغییر دهید.',
      },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.counselor.delete({ where: { id } });
    await recordAuditLog(
      {
        adminId: auth.admin.id,
        action: 'COUNSELOR_DELETED',
        entityType: 'Counselor',
        entityId: id,
        metadata: { name: `${existing.firstName} ${existing.lastName}` },
        ipAddress: getClientIp(req),
      },
      tx
    );
  });

  return NextResponse.json({ ok: true });
}
