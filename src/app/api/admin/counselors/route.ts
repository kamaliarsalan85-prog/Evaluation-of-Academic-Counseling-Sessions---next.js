import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp, hasPermission, requireAdminApi } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { counselorSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const canRead =
    hasPermission(auth.admin, 'MANAGE_COUNSELORS') ||
    hasPermission(auth.admin, 'VIEW_SUBMISSIONS') ||
    hasPermission(auth.admin, 'VIEW_ANALYTICS') ||
    hasPermission(auth.admin, 'EXPORT_REPORTS') ||
    hasPermission(auth.admin, 'EDIT_SUBMISSIONS');

  if (!canRead) {
    return NextResponse.json(
      { error: 'شما دسترسی مشاهده فهرست مشاوران را ندارید.' },
      { status: 403 }
    );
  }

  const search = req.nextUrl.searchParams.get('search')?.trim();
  const status = req.nextUrl.searchParams.get('status');

  const counselors = await prisma.counselor.findMany({
    where: {
      ...(status === 'ACTIVE' || status === 'INACTIVE' ? { status } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    include: {
      _count: { select: { submissions: true } },
    },
  });

  return NextResponse.json({
    counselors: counselors.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      description: c.description,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      submissionsCount: c._count.submissions,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi(req, { permission: 'MANAGE_COUNSELORS' });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = counselorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'اطلاعات مشاور معتبر نیست.' },
      { status: 400 }
    );
  }

  const counselor = await prisma.$transaction(async (tx) => {
    const created = await tx.counselor.create({
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        description: parsed.data.description,
        status: parsed.data.status ?? 'ACTIVE',
      },
      include: { _count: { select: { submissions: true } } },
    });

    await recordAuditLog(
      {
        adminId: auth.admin.id,
        action: 'COUNSELOR_CREATED',
        entityType: 'Counselor',
        entityId: created.id,
        metadata: { name: `${created.firstName} ${created.lastName}`, status: created.status },
        ipAddress: getClientIp(req),
      },
      tx
    );

    return created;
  });

  return NextResponse.json(
    {
      counselor: {
        ...counselor,
        submissionsCount: counselor._count.submissions,
      },
    },
    { status: 201 }
  );
}
