import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';
import { generateSecureToken, hashToken } from './password';
import {
  ALL_PERMISSIONS,
  SESSION_COOKIE_NAME,
  SESSION_TTL_HOURS,
  type PermissionKey,
} from './constants';

export interface AuthenticatedAdmin {
  id: string;
  username: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
  permissions: PermissionKey[];
  sessionId: string;
  csrfToken: string;
}

export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const trimmed = authHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

export function isHttpsRequest(req: NextRequest): boolean {
  const proto = req.headers.get('x-forwarded-proto');
  if (proto && proto.split(',')[0]?.trim().toLowerCase() === 'https') {
    return true;
  }
  const forwardedSsl = req.headers.get('x-forwarded-ssl');
  if (forwardedSsl?.toLowerCase() === 'on') {
    return true;
  }
  const origin = req.headers.get('origin');
  if (origin) {
    return origin.startsWith('https://');
  }
  const referer = req.headers.get('referer');
  if (referer) {
    return referer.startsWith('https://');
  }
  const forwardedHost = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '')
    .split(',')[0]
    ?.trim()
    .toLowerCase();
  if (forwardedHost.startsWith('localhost') || forwardedHost.startsWith('127.0.0.1')) {
    return req.nextUrl.protocol === 'https:';
  }
  if (process.env.APP_URL?.startsWith('https://')) {
    return true;
  }
  return req.nextUrl.protocol === 'https:';
}

export function attachSessionCookie(
  res: NextResponse,
  rawToken: string,
  expiresAt: Date,
  req: NextRequest
) {
  const secure = isHttpsRequest(req);
  res.cookies.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    ...(secure ? { partitioned: true } : {}),
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: NextResponse, req: NextRequest) {
  const secure = isHttpsRequest(req);
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    ...(secure ? { partitioned: true } : {}),
    path: '/',
    maxAge: 0,
  });
}

export async function createAdminSession(adminId: string, req: NextRequest) {
  const rawToken = generateSecureToken(32);
  const csrfToken = generateSecureToken(24);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  await prisma.adminSession.create({
    data: {
      adminId,
      tokenHash,
      csrfToken,
      expiresAt,
      ipAddress: getClientIp(req),
      userAgent: req.headers.get('user-agent')?.slice(0, 250) ?? null,
    },
  });

  return { rawToken, csrfToken, expiresAt };
}

export async function getAuthenticatedAdmin(
  req?: NextRequest
): Promise<AuthenticatedAdmin | null> {
  let rawToken: string | undefined;

  if (req) {
    rawToken =
      extractBearerToken(req.headers.get('authorization')) ??
      req.cookies.get(SESSION_COOKIE_NAME)?.value;
  } else {
    const headerStore = await headers();
    rawToken = extractBearerToken(headerStore.get('authorization')) ?? undefined;
    if (!rawToken) {
      const cookieStore = await cookies();
      rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    }
  }

  if (!rawToken) {
    return null;
  }

  const tokenHash = hashToken(rawToken);
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash },
    include: {
      admin: {
        include: {
          permissions: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.revokedAt !== null) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (session.admin.status !== 'ACTIVE') return null;

  const permissions: PermissionKey[] =
    session.admin.role === 'SUPER_ADMIN'
      ? [...ALL_PERMISSIONS]
      : session.admin.permissions
          .map((p) => p.permissionKey as PermissionKey)
          .filter((k) => (ALL_PERMISSIONS as readonly string[]).includes(k));

  return {
    id: session.admin.id,
    username: session.admin.username,
    fullName: session.admin.fullName,
    role: session.admin.role,
    permissions,
    sessionId: session.id,
    csrfToken: session.csrfToken,
  };
}

export function hasPermission(admin: AuthenticatedAdmin, permission: PermissionKey): boolean {
  if (admin.role === 'SUPER_ADMIN') return true;
  return admin.permissions.includes(permission);
}

export function verifyRequestOriginAndCsrf(req: NextRequest, admin: AuthenticatedAdmin): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }

  const origin = req.headers.get('origin');
  const rawHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const host = rawHost?.split(',')[0]?.trim().toLowerCase();
  if (origin && host) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      let appUrlHost: string | null = null;
      if (process.env.APP_URL) {
        try {
          appUrlHost = new URL(process.env.APP_URL).host.toLowerCase();
        } catch {
          appUrlHost = null;
        }
      }
      if (originHost !== host && (!appUrlHost || originHost !== appUrlHost)) {
        return false;
      }
    } catch {
      return false;
    }
  }

  const headerToken = req.headers.get('x-csrf-token');
  if (!headerToken) {
    return false;
  }

  const a = Buffer.from(headerToken);
  const b = Buffer.from(admin.csrfToken);
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export async function requireAdminApi(
  req: NextRequest,
  options?: { permission?: PermissionKey; superAdminOnly?: boolean }
): Promise<
  | { ok: true; admin: AuthenticatedAdmin }
  | { ok: false; status: number; message: string }
> {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) {
    return {
      ok: false,
      status: 401,
      message: 'نشست کاربری معتبر نیست. لطفاً دوباره وارد شوید.',
    };
  }

  if (!verifyRequestOriginAndCsrf(req, admin)) {
    return {
      ok: false,
      status: 403,
      message: 'درخواست از نظر امنیتی (CSRF) تایید نشد.',
    };
  }

  if (options?.superAdminOnly && admin.role !== 'SUPER_ADMIN') {
    return {
      ok: false,
      status: 403,
      message: 'انجام این عملیات فقط برای مدیر ارشد (Super Admin) مجاز است.',
    };
  }

  if (options?.permission && !hasPermission(admin, options.permission)) {
    return {
      ok: false,
      status: 403,
      message: 'شما دسترسی لازم برای انجام این بخش را ندارید.',
    };
  }

  return { ok: true, admin };
}

export async function hasInitializedSuperAdmin(): Promise<boolean> {
  const count = await prisma.administrator.count({
    where: {
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });
  return count > 0;
}
