import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp, requireAdminApi } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { recordAuditLog } from '@/lib/audit';
import { adminUpdateSchema } from '@/lib/validation';
import { ALL_PERMISSIONS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi(req, { superAdminOnly: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => null);
  const parsed = adminUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'اطلاعات به‌روزرسانی مدیر معتبر نیست.' },
      { status: 400 }
    );
  }

  const target = await prisma.administrator.findUnique({
    where: { id },
    include: { permissions: true },
  });

  if (!target) {
    return NextResponse.json({ error: 'مدیر مورد نظر یافت نشد.' }, { status: 404 });
  }

  const nextRole = parsed.data.role ?? target.role;
  const nextStatus = parsed.data.status ?? target.status;

  // Protect the last active Super Admin from deactivation or demotion
  if (target.role === 'SUPER_ADMIN' && target.status === 'ACTIVE') {
    if (nextRole !== 'SUPER_ADMIN' || nextStatus !== 'ACTIVE') {
      const otherActiveSuperAdmins = await prisma.administrator.count({
        where: {
          id: { not: target.id },
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
        },
      });
      if (otherActiveSuperAdmins === 0) {
        return NextResponse.json(
          {
            error:
              'امکان غیرفعال کردن یا تغییر نقش آخرین مدیر ارشد فعال سیستم وجود ندارد.',
          },
          { status: 409 }
        );
      }
    }
  }

  const passwordHash = parsed.data.password
    ? await hashPassword(parsed.data.password)
    : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const admin = await tx.administrator.update({
      where: { id },
      data: {
        ...(parsed.data.fullName !== undefined ? { fullName: parsed.data.fullName } : {}),
        ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(passwordHash ? { passwordHash, failedLoginCount: 0, lockedUntil: null } : {}),
      },
    });

    if (parsed.data.permissions !== undefined) {
      await tx.adminPermission.deleteMany({ where: { adminId: id } });
      if (admin.role === 'ADMIN' && parsed.data.permissions.length > 0) {
        await tx.adminPermission.createMany({
          data: Array.from(new Set(parsed.data.permissions)).map((permissionKey) => ({
            adminId: id,
            permissionKey,
          })),
        });
      }
    }

    // Revoke active sessions if deactivated or password reset
    if (nextStatus === 'INACTIVE' || passwordHash) {
      await tx.adminSession.updateMany({
        where: { adminId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const refreshed = await tx.administrator.findUniqueOrThrow({
      where: { id },
      include: { permissions: true },
    });

    await recordAuditLog(
      {
        adminId: auth.admin.id,
        action:
          nextStatus !== target.status
            ? nextStatus === 'INACTIVE'
              ? 'ADMIN_DEACTIVATED'
              : 'ADMIN_ACTIVATED'
            : parsed.data.permissions !== undefined
              ? 'ADMIN_PERMISSIONS_UPDATED'
              : 'ADMIN_UPDATED',
        entityType: 'Administrator',
        entityId: id,
        metadata: {
          username: refreshed.username,
          role: refreshed.role,
          status: refreshed.status,
          passwordChanged: Boolean(passwordHash),
        },
        ipAddress: getClientIp(req),
      },
      tx
    );

    return refreshed;
  });

  return NextResponse.json({
    admin: {
      id: updated.id,
      username: updated.username,
      fullName: updated.fullName,
      role: updated.role,
      status: updated.status,
      lastLoginAt: updated.lastLoginAt,
      createdAt: updated.createdAt,
      permissions:
        updated.role === 'SUPER_ADMIN'
          ? [...ALL_PERMISSIONS]
          : updated.permissions.map((p) => p.permissionKey),
    },
  });
}
