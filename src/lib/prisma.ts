import { PrismaClient } from '@prisma/client';

export type DatabaseUrlIssue =
  | 'missing'
  | 'placeholder'
  | 'bracketed_password'
  | 'invalid_url';

export interface DatabaseUrlStatus {
  valid: boolean;
  issue?: DatabaseUrlIssue;
}

export function inspectDatabaseUrlStatus(rawUrl: string | undefined): DatabaseUrlStatus {
  const trimmed = rawUrl?.trim() || '';
  if (!trimmed) {
    return { valid: false, issue: 'missing' };
  }
  if (trimmed.includes('[YOUR-DATABASE-PASSWORD]') || trimmed.includes('YOUR_PASSWORD')) {
    return { valid: false, issue: 'placeholder' };
  }
  try {
    const parsed = new URL(trimmed);
    let decodedPassword = parsed.password || '';
    try {
      decodedPassword = decodeURIComponent(decodedPassword);
    } catch {
      // keep raw parsed password if percent-decoding fails
    }
    if (decodedPassword.startsWith('[') && decodedPassword.endsWith(']')) {
      return { valid: false, issue: 'bracketed_password' };
    }
    return { valid: true };
  } catch {
    return { valid: false, issue: 'invalid_url' };
  }
}

export function getDatabaseConfigErrorMessage(issue?: DatabaseUrlIssue): string {
  switch (issue) {
    case 'missing':
      return 'متغیر اتصال پایگاه داده (DATABASE_URL) در بخش Secrets تنظیم نشده است.';
    case 'placeholder':
      return 'رشته اتصال پایگاه داده (DATABASE_URL) هنوز با رمز عبور واقعی تکمیل نشده است. لطفاً در بخش Secrets عبارت [YOUR-DATABASE-PASSWORD] را در DATABASE_URL و DIRECT_URL با رمز عبور واقعی جایگزین کنید (بدون براکت).';
    case 'bracketed_password':
      return 'در رشته اتصال DATABASE_URL، علامت‌های براکت [ و ] دور رمز عبور باقی مانده است (مثال اشتباه: \u2066:[password]@\u2069). لطفاً براکت‌های اطراف رمز عبور را در Secrets حذف کنید (مثال صحیح: \u2066:password@\u2069).';
    case 'invalid_url':
      return 'فرمت رشته اتصال DATABASE_URL معتبر نیست. لطفاً ساختار URL استاندارد PostgreSQL را در بخش Secrets بررسی کنید.';
    default:
      return 'در حال حاضر امکان اتصال به پایگاه داده وجود ندارد. لطفاً تنظیمات اتصال و اعتبارنامه‌های PostgreSQL (مانند DATABASE_URL) را در بخش Secrets بررسی کنید.';
  }
}

function normalizeDatabaseUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl || !rawUrl.trim()) return undefined;
  try {
    const parsed = new URL(rawUrl);
    const isPoolerPort = parsed.port === '6543' || parsed.hostname.includes('pooler.supabase.com');
    if (parsed.port === '6543' && !parsed.searchParams.has('pgbouncer')) {
      parsed.searchParams.set('pgbouncer', 'true');
    }
    if (isPoolerPort && !parsed.searchParams.has('sslmode')) {
      parsed.searchParams.set('sslmode', 'require');
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const normalizedUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(normalizedUrl ? { datasources: { db: { url: normalizedUrl } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
