import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { attachSessionCookie, createAdminSession, getClientIp } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { ALL_PERMISSIONS } from '@/lib/constants';
import { normalizeText } from '@/lib/validation';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const setupSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'نام کاربری باید حداقل ۳ کاراکتر باشد')
    .max(40, 'نام کاربری حداکثر ۴۰ کاراکتر است')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'نام کاربری فقط شامل حروف انگلیسی، اعداد و _ . - باشد'),
  fullName: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().min(2, 'نام و نام خانوادگی الزامی است').max(80)),
  password: z
    .string()
    .min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد')
    .max(128, 'رمز عبور بیش از حد طولانی است'),
  bootstrapSecret: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || 'اطلاعات واردشده معتبر نیست.',
        },
        { status: 400 }
      );
    }

    const configuredSecret = process.env.ADMIN_BOOTSTRAP_SECRET?.trim();
    if (configuredSecret) {
      const provided = parsed.data.bootstrapSecret?.trim() || '';
      const a = Buffer.from(provided);
      const b = Buffer.from(configuredSecret);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return NextResponse.json(
          { error: 'کد امنیتی راه‌اندازی اولیه (Bootstrap Secret) صحیح نیست.' },
          { status: 403 }
        );
      }
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const ip = getClientIp(req);

    const createdAdmin = await prisma.$transaction(
      async (tx) => {
        const existingSuperAdmin = await tx.administrator.count({
          where: { role: 'SUPER_ADMIN' },
        });
        if (existingSuperAdmin > 0) {
          throw new Error('ALREADY_INITIALIZED');
        }

        const admin = await tx.administrator.create({
          data: {
            username: parsed.data.username.toLowerCase(),
            fullName: parsed.data.fullName,
            passwordHash,
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            lastLoginAt: new Date(),
          },
        });

        await recordAuditLog(
          {
            adminId: admin.id,
            action: 'INITIAL_SUPER_ADMIN_CREATED',
            entityType: 'Administrator',
            entityId: admin.id,
            metadata: { username: admin.username },
            ipAddress: ip,
          },
          tx
        );

        return admin;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const session = await createAdminSession(createdAdmin.id, req);
    const res = NextResponse.json(
      {
        ok: true,
        admin: {
          id: createdAdmin.id,
          username: createdAdmin.username,
          fullName: createdAdmin.fullName,
          role: createdAdmin.role,
          permissions: [...ALL_PERMISSIONS],
        },
        csrfToken: session.csrfToken,
        sessionToken: session.rawToken,
      },
      { status: 201 }
    );

    attachSessionCookie(res, session.rawToken, session.expiresAt, req);
    return res;
  } catch (error) {
    if (error instanceof Error && error.message === 'ALREADY_INITIALIZED') {
      return NextResponse.json(
        { error: 'مدیر ارشد پیش‌تر ایجاد شده است و ثبت‌نام عمومی غیرفعال است.' },
        { status: 403 }
      );
    }
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'خطا در ایجاد حساب مدیر ارشد.' },
      { status: 500 }
    );
  }
}
