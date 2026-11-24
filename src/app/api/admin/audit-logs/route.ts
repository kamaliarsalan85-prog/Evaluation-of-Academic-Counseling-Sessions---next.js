import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req, { superAdminOnly: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get('page') || 1) || 1);
  const pageSize = Math.min(50, Math.max(10, Number(sp.get('pageSize') || 20) || 20));
  const action = sp.get('action')?.trim();

  const where = action && action !== 'ALL' ? { action } : {};

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        admin: {
          select: { id: true, username: true, fullName: true, role: true },
        },
      },
    }),
  ]);

  return NextResponse.json({
    logs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}
