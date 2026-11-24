import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/auth';
import { ensureDefaultAppData } from '@/lib/bootstrap';
import { formatJalaliDate, getTehranDayKey, getTehranPeriodBounds } from '@/lib/jalali';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req, { permission: 'VIEW_DASHBOARD' });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    await ensureDefaultAppData();
    const now = new Date();
    const { todayStart, weekStart, monthStart } = getTehranPeriodBounds(now);
    const fourteenDaysAgo = new Date(todayStart.getTime() - 13 * 24 * 60 * 60 * 1000);

    const [
      totalSubmissions,
      todaySubmissions,
      weekSubmissions,
      monthSubmissions,
      activeCounselorsCount,
      publishedVersion,
      recentSubmissions,
      trendSubmissions,
      counselorCounts,
    ] = await Promise.all([
      prisma.submission.count(),
      prisma.submission.count({ where: { submittedAt: { gte: todayStart } } }),
      prisma.submission.count({ where: { submittedAt: { gte: weekStart } } }),
      prisma.submission.count({ where: { submittedAt: { gte: monthStart } } }),
      prisma.counselor.count({ where: { status: 'ACTIVE' } }),
      prisma.formVersion.findFirst({
        where: { status: 'PUBLISHED' },
        orderBy: { versionNumber: 'desc' },
        include: {
          _count: { select: { questions: { where: { isActive: true } } } },
        },
      }),
      prisma.submission.findMany({
        take: 6,
        orderBy: { submittedAt: 'desc' },
        include: {
          counselor: { select: { id: true, firstName: true, lastName: true } },
          formVersion: { select: { versionNumber: true } },
        },
      }),
      prisma.submission.findMany({
        where: { submittedAt: { gte: fourteenDaysAgo } },
        select: { submittedAt: true },
        orderBy: { submittedAt: 'asc' },
      }),
      prisma.counselor.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          _count: { select: { submissions: true } },
        },
        orderBy: { submissions: { _count: 'desc' } },
        take: 6,
      }),
    ]);

    // Build 14-day chart series keyed by Tehran Jalali day
    const dayCounts = new Map<string, number>();
    for (const row of trendSubmissions) {
      const key = getTehranDayKey(row.submittedAt);
      dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    }

    const dailyTrend: Array<{ dateKey: string; label: string; count: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = getTehranDayKey(d);
      const label = formatJalaliDate(d, true).slice(5); // MM/DD
      dailyTrend.push({
        dateKey: key,
        label,
        count: dayCounts.get(key) ?? 0,
      });
    }

    return NextResponse.json({
      stats: {
        totalSubmissions,
        todaySubmissions,
        weekSubmissions,
        monthSubmissions,
        activeCounselorsCount,
        publishedQuestionsCount: publishedVersion?._count.questions ?? 0,
        activeFormVersionNumber: publishedVersion?.versionNumber ?? 0,
      },
      dailyTrend,
      topCounselors: counselorCounts.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        status: c.status,
        count: c._count.submissions,
      })),
      recentSubmissions: recentSubmissions.map((s) => ({
        id: s.id,
        studentName: `${s.firstName} ${s.lastName}`,
        counselorName: `${s.counselor.firstName} ${s.counselor.lastName}`,
        formVersionNumber: s.formVersion.versionNumber,
        submittedAt: s.submittedAt,
      })),
    });
  } catch (error) {
    console.error('Overview API error:', error);
    return NextResponse.json(
      { error: 'خطا در دریافت آمار داشبورد.' },
      { status: 500 }
    );
  }
}
