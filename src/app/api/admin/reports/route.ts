import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasPermission, requireAdminApi } from '@/lib/auth';
import { buildSubmissionWhere } from '@/lib/submission-filters';

export const dynamic = 'force-dynamic';

interface QuestionSnapshotShape {
  id?: string;
  questionText: string;
  questionType: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'DESCRIPTIVE' | 'RATING' | 'YES_NO';
  config?: { minRating?: number; maxRating?: number } | null;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  if (
    !hasPermission(auth.admin, 'VIEW_ANALYTICS') &&
    !hasPermission(auth.admin, 'EXPORT_REPORTS')
  ) {
    return NextResponse.json(
      { error: 'شما مجوز مشاهده گزارش‌ها و تحلیل‌ها را ندارید.' },
      { status: 403 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const where = buildSubmissionWhere({
    counselorId: sp.get('counselorId'),
    dateFrom: sp.get('dateFrom'),
    dateTo: sp.get('dateTo'),
    formVersionId: sp.get('formVersionId'),
  });

  const submissions = await prisma.submission.findMany({
    where,
    include: {
      counselor: { select: { id: true, firstName: true, lastName: true, status: true } },
      answers: true,
    },
    orderBy: { submittedAt: 'desc' },
  });

  const counselorStatsMap = new Map<
    string,
    {
      counselorId: string;
      counselorName: string;
      status: string;
      totalSubmissions: number;
      ratingSum: number;
      ratingCount: number;
    }
  >();

  const questionStatsMap = new Map<
    string,
    {
      questionText: string;
      questionType: QuestionSnapshotShape['questionType'];
      totalAnswers: number;
      optionCounts: Map<string, number>;
      ratingDistribution: Map<number, number>;
      ratingSum: number;
      ratingCount: number;
      maxRating: number;
      minRating: number;
    }
  >();

  for (const sub of submissions) {
    const cKey = sub.counselor.id;
    const cEntry = counselorStatsMap.get(cKey) ?? {
      counselorId: cKey,
      counselorName: `${sub.counselor.firstName} ${sub.counselor.lastName}`,
      status: sub.counselor.status,
      totalSubmissions: 0,
      ratingSum: 0,
      ratingCount: 0,
    };
    cEntry.totalSubmissions += 1;

    for (const ans of sub.answers) {
      const qSnap = ans.questionSnapshot as unknown as QuestionSnapshotShape;
      const qTitle = qSnap?.questionText?.trim() || 'سوال بدون عنوان';
      const qType = qSnap?.questionType || 'DESCRIPTIVE';
      const qKey = `${qType}::${qTitle}`;

      const qEntry = questionStatsMap.get(qKey) ?? {
        questionText: qTitle,
        questionType: qType,
        totalAnswers: 0,
        optionCounts: new Map<string, number>(),
        ratingDistribution: new Map<number, number>(),
        ratingSum: 0,
        ratingCount: 0,
        minRating: qSnap?.config?.minRating ?? 1,
        maxRating: qSnap?.config?.maxRating ?? 5,
      };
      qEntry.totalAnswers += 1;

      const data = ans.answerData as Record<string, unknown> | null;
      if (qType === 'RATING' && data && typeof data.rating === 'number') {
        const ratingVal = data.rating;
        qEntry.ratingSum += ratingVal;
        qEntry.ratingCount += 1;
        qEntry.ratingDistribution.set(
          ratingVal,
          (qEntry.ratingDistribution.get(ratingVal) ?? 0) + 1
        );
        cEntry.ratingSum += ratingVal;
        cEntry.ratingCount += 1;
      } else if (qType === 'SINGLE_CHOICE' && data && typeof data.selectedOptionText === 'string') {
        const optText = data.selectedOptionText;
        qEntry.optionCounts.set(optText, (qEntry.optionCounts.get(optText) ?? 0) + 1);
      } else if (
        qType === 'MULTIPLE_CHOICE' &&
        data &&
        Array.isArray(data.selectedOptionTexts)
      ) {
        for (const optText of data.selectedOptionTexts) {
          if (typeof optText === 'string') {
            qEntry.optionCounts.set(optText, (qEntry.optionCounts.get(optText) ?? 0) + 1);
          }
        }
      } else if (qType === 'YES_NO' && data && typeof data.label === 'string') {
        const label = data.label;
        qEntry.optionCounts.set(label, (qEntry.optionCounts.get(label) ?? 0) + 1);
      }

      questionStatsMap.set(qKey, qEntry);
    }

    counselorStatsMap.set(cKey, cEntry);
  }

  const counselorReports = Array.from(counselorStatsMap.values())
    .map((c) => ({
      counselorId: c.counselorId,
      counselorName: c.counselorName,
      status: c.status,
      totalSubmissions: c.totalSubmissions,
      averageRating:
        c.ratingCount > 0 ? Number((c.ratingSum / c.ratingCount).toFixed(2)) : null,
    }))
    .sort((a, b) => b.totalSubmissions - a.totalSubmissions);

  const questionSummaries = Array.from(questionStatsMap.values()).map((q) => {
    const ratingDist: Array<{ score: number; count: number }> = [];
    if (q.questionType === 'RATING') {
      for (let score = q.minRating; score <= q.maxRating; score++) {
        ratingDist.push({
          score,
          count: q.ratingDistribution.get(score) ?? 0,
        });
      }
    }

    return {
      questionText: q.questionText,
      questionType: q.questionType,
      totalAnswers: q.totalAnswers,
      averageRating:
        q.ratingCount > 0 ? Number((q.ratingSum / q.ratingCount).toFixed(2)) : null,
      ratingDistribution: ratingDist,
      optionBreakdown: Array.from(q.optionCounts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
    };
  });

  return NextResponse.json({
    totalSubmissions: submissions.length,
    counselorReports,
    questionSummaries,
  });
}
