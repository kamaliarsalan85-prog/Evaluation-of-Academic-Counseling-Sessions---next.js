import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { attachSessionCookie, createAdminSession, getClientIp } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { recordAuditLog } from '@/lib/audit';
import {
  ALL_PERMISSIONS,
  LOCKOUT_MINUTES,
  MAX_FAILED_LOGIN_ATTEMPTS,
  type PermissionKey,
} from '@/lib/constants';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'نام کاربری الزامی است'),
  password: z.string().min(1, 'رمز عبور الزامی است'),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rate = checkRateLimit(`admin-login:${ip}`, 20, 15 * 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: 'تعداد تلاش‌های ورود بیش از حد مجاز بوده است. لطفاً چند دقیقه دیگر تلاش کنید.',
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rate.retryAfterSeconds) },
        }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'نام کاربری و رمز عبور الزامی است.' },
        { status: 400 }
      );
    }

    const username = parsed.data.username.toLowerCase();
    const admin = await prisma.administrator.findUnique({
      where: { username },
      include: { permissions: true },
    });

    if (!admin) {
      return NextResponse.json(
        { error: 'نام کاربری یا رمز عبور نادرست است.' },
        { status: 401 }
      );
    }

    if (admin.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'حساب کاربری شما غیرفعال شده است.' },
        { status: 403 }
      );
    }

    if (admin.lockedUntil && admin.lockedUntil.getTime() > Date.now()) {
      return NextResponse.json(
        {
          error: 'به دلیل تلاش‌های ناموفق متوالی، حساب شما موقتاً قفل شده است. لطفاً دقایقی دیگر تلاش کنید.',
        },
        { status: 423 }
      );
    }

    const valid = await verifyPassword(parsed.data.password, admin.passwordHash);
    if (!valid) {
      const nextFailures = admin.failedLoginCount + 1;
      const shouldLock = nextFailures >= MAX_FAILED_LOGIN_ATTEMPTS;
      await prisma.administrator.update({
        where: { id: admin.id },
        data: {
          failedLoginCount: shouldLock ? 0 : nextFailures,
          lockedUntil: shouldLock
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null,
        },
      });
      await recordAuditLog({
        adminId: admin.id,
        action: shouldLock ? 'ADMIN_LOGIN_LOCKED' : 'ADMIN_LOGIN_FAILED',
        entityType: 'Administrator',
        entityId: admin.id,
        metadata: { username: admin.username },
        ipAddress: ip,
      });

      return NextResponse.json(
        { error: 'نام کاربری یا رمز عبور نادرست است.' },
        { status: 401 }
      );
    }

    await prisma.administrator.update({
      where: { id: admin.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const session = await createAdminSession(admin.id, req);
    await recordAuditLog({
      adminId: admin.id,
      action: 'ADMIN_LOGIN_SUCCESS',
      entityType: 'Administrator',
      entityId: admin.id,
      metadata: { username: admin.username, role: admin.role },
      ipAddress: ip,
    });

    const permissions: PermissionKey[] =
      admin.role === 'SUPER_ADMIN'
        ? [...ALL_PERMISSIONS]
        : admin.permissions.map((p) => p.permissionKey as PermissionKey);

    const res = NextResponse.json({
      ok: true,
      admin: {
        id: admin.id,
        username: admin.username,
        fullName: admin.fullName,
        role: admin.role,
        permissions,
      },
      csrfToken: session.csrfToken,
      sessionToken: session.rawToken,
    });

    attachSessionCookie(res, session.rawToken, session.expiresAt, req);
    return res;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'خطا در ورود به پنل مدیریت.' },
      { status: 500 }
    );
  }
}
