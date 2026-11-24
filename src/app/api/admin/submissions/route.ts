import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hasPermission, requireAdminApi } from '@/lib/auth';
import { buildSubmissionWhere } from '@/lib/submission-filters';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req, { permission: 'VIEW_SUBMISSIONS' });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const sp = req.nextUrl.searchParams;
    const search = sp.get('search');
    const counselorId = sp.get('counselorId');
    const dateFrom = sp.get('dateFrom');
    const dateTo = sp.get('dateTo');
    const answerQuery = sp.get('answerQuery');
    const formVersionId = sp.get('formVersionId');

    const hasSearchFilter = Boolean(
      search?.trim() ||
        (counselorId && counselorId !== 'ALL') ||
        dateFrom?.trim() ||
        dateTo?.trim() ||
        answerQuery?.trim() ||
        (formVersionId && formVersionId !== 'ALL')
    );

    if (hasSearchFilter && !hasPermission(auth.admin, 'SEARCH_SUBMISSIONS')) {
      return NextResponse.json(
        { error: 'شما مجوز جستجو و فیلتر ارزیابی‌ها را ندارید.' },
        { status: 403 }
      );
    }

    const page = Math.max(1, Number(sp.get('page') || 1) || 1);
    const pageSize = Math.min(50, Math.max(5, Number(sp.get('pageSize') || 15) || 15));
    const sortBy = sp.get('sortBy') || 'submittedAt';
    const sortDir = sp.get('sortDir') === 'asc' ? 'asc' : 'desc';

    let orderBy: Prisma.SubmissionOrderByWithRelationInput = { submittedAt: sortDir };
    if (sortBy === 'lastName') {
      orderBy = { lastName: sortDir };
    } else if (sortBy === 'counselor') {
      orderBy = { counselor: { lastName: sortDir } };
    }

    const where = buildSubmissionWhere({
      search,
      counselorId,
      dateFrom,
      dateTo,
      answerQuery,
      formVersionId,
    });

    const [total, items] = await Promise.all([
      prisma.submission.count({ where }),
      prisma.submission.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          counselor: { select: { id: true, firstName: true, lastName: true, status: true } },
          formVersion: { select: { id: true, versionNumber: true } },
          _count: { select: { answers: true } },
        },
      }),
    ]);

    return NextResponse.json({
      items: items.map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        counselor: s.counselor,
        formVersion: s.formVersion,
        answersCount: s._count.answers,
        submittedAt: s.submittedAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    console.error('Submissions list error:', error);
    return NextResponse.json(
      { error: 'خطا در دریافت فهرست ارزیابی‌ها.' },
      { status: 500 }
    );
  }
}
