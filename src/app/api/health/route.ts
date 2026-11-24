import { NextResponse } from 'next/server';
import {
  getDatabaseConfigErrorMessage,
  inspectDatabaseUrlStatus,
  prisma,
} from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const dbStatus = inspectDatabaseUrlStatus(process.env.DATABASE_URL);
  if (!dbStatus.valid) {
    return NextResponse.json(
      {
        ok: false,
        database: 'misconfigured',
        issue: dbStatus.issue,
        error: getDatabaseConfigErrorMessage(dbStatus.issue),
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    const isEmbeddedDev = process.env.DEV_EMBEDDED_POSTGRES === 'true';
    return NextResponse.json({
      ok: true,
      database: 'connected',
      mode: isEmbeddedDev ? 'embedded-dev-postgres' : 'postgresql',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check database failure:', error);
    return NextResponse.json(
      {
        ok: false,
        database: 'disconnected',
        error: 'اتصال به پایگاه داده برقرار نشد.',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
