import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp, requireAdminApi } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { recordAuditLog } from '@/lib/audit';
import { adminCreateSchema } from '@/lib/validation';
import { ALL_PERMISSIONS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req, { superAdminOnly: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const admins = await prisma.administrator.findMany({
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      permissions: {
        select: { permissionKey: true },
      },
    },
  });

  return NextResponse.json({
    admins: admins.map((a) => ({
      ...a,
      permissions:
        a.role === 'SUPER_ADMIN'
          ? [...ALL_PERMISSIONS]
          : a.permissions.map((p) => p.permissionKey),
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi(req, { superAdminOnly: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = adminCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'اطلاعات مدیر جدید معتبر نیست.' },
      { status: 400 }
    );
  }

  const username = parsed.data.username.toLowerCase();
  const existing = await prisma.administrator.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { error: 'این نام کاربری قبلاً ثبت شده است.' },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const created = await prisma.$transaction(async (tx) => {
    const admin = await tx.administrator.create({
      data: {
        username,
        fullName: parsed.data.fullName,
        passwordHash,
        role: parsed.data.role,
        status: 'ACTIVE',
      },
    });

    if (parsed.data.role === 'ADMIN' && parsed.data.permissions.length > 0) {
      await tx.adminPermission.createMany({
        data: Array.from(new Set(parsed.data.permissions)).map((permissionKey) => ({
          adminId: admin.id,
          permissionKey,
        })),
      });
    }

    await recordAuditLog(
      {
        adminId: auth.admin.id,
        action: 'ADMIN_CREATED',
        entityType: 'Administrator',
        entityId: admin.id,
        metadata: {
          username: admin.username,
          role: admin.role,
          permissions: parsed.data.role === 'SUPER_ADMIN' ? ALL_PERMISSIONS : parsed.data.permissions,
        },
        ipAddress: getClientIp(req),
      },
      tx
    );

    return admin;
  });

  return NextResponse.json(
    {
      admin: {
        id: created.id,
        username: created.username,
        fullName: created.fullName,
        role: created.role,
        status: created.status,
        createdAt: created.createdAt,
        lastLoginAt: created.lastLoginAt,
        permissions:
          created.role === 'SUPER_ADMIN' ? [...ALL_PERMISSIONS] : parsed.data.permissions,
      },
    },
    { status: 201 }
  );
}
