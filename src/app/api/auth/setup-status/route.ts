import { NextResponse } from 'next/server';
import { hasInitializedSuperAdmin } from '@/lib/auth';
import {
  getDatabaseConfigErrorMessage,
  inspectDatabaseUrlStatus,
} from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const dbStatus = inspectDatabaseUrlStatus(process.env.DATABASE_URL);
  if (!dbStatus.valid) {
    return NextResponse.json(
      { error: getDatabaseConfigErrorMessage(dbStatus.issue) },
      { status: 503 }
    );
  }

  try {
    const initialized = await hasInitializedSuperAdmin();
    const requiresBootstrapSecret = Boolean(
      process.env.ADMIN_BOOTSTRAP_SECRET && process.env.ADMIN_BOOTSTRAP_SECRET.trim().length > 0
    );
    return NextResponse.json({
      initialized,
      requiresBootstrapSecret,
    });
  } catch (error) {
    console.error('Setup status error:', error);
    return NextResponse.json({ error: 'خطا در بررسی وضعیت راه‌اندازی' }, { status: 500 });
  }
}
