import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ensureDefaultAppData } from '@/lib/bootstrap';
import { getClientIp } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { validatePublicSubmission, type QuestionRule } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rate = checkRateLimit(`public-submit:${ip}`, 30, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: 'تعداد درخواست‌های شما در لحظه زیاد بوده است. لطفاً چند ثانیه صبر کرده و دوباره تلاش کنید.',
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rate.retryAfterSeconds) },
        }
      );
    }

    await ensureDefaultAppData();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
    }

    const [settings, activeCounselors, publishedVersion] = await Promise.all([
      prisma.appSettings.findUnique({ where: { id: 'default' } }),
      prisma.counselor.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      }),
      prisma.formVersion.findFirst({
        where: { status: 'PUBLISHED' },
        orderBy: { versionNumber: 'desc' },
        include: {
          questions: {
            where: { isActive: true },
            orderBy: { displayOrder: 'asc' },
            include: {
              options: {
                orderBy: { displayOrder: 'asc' },
              },
            },
          },
        },
      }),
    ]);

    if (settings && (!settings.isFormAvailable || !settings.isPublicSubmissionEnabled)) {
      return NextResponse.json(
        { error: 'در حال حاضر امکان ثبت ارزیابی جدید فعال نیست.' },
        { status: 403 }
      );
    }

    if (!publishedVersion) {
      return NextResponse.json(
        { error: 'هیچ نسخه فعالی از فرم ارزیابی منتشر نشده است.' },
        { status: 409 }
      );
    }

    const validCounselorIds = new Set(activeCounselors.map((c) => c.id));
    const questionRules: QuestionRule[] = publishedVersion.questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      questionType: q.questionType,
      isRequired: q.isRequired,
      isActive: q.isActive,
      displayOrder: q.displayOrder,
      config: (q.config as QuestionRule['config']) ?? null,
      options: q.options.map((o) => ({
        id: o.id,
        optionText: o.optionText,
        displayOrder: o.displayOrder,
      })),
    }));

    const validation = validatePublicSubmission(
      body as Record<string, unknown>,
      questionRules,
      validCounselorIds,
      publishedVersion.id
    );

    if (!validation.valid || !validation.normalized) {
      return NextResponse.json(
        {
          error: 'لطفاً خطاهای فرم را بررسی و اصلاح کنید.',
          fieldErrors: validation.fieldErrors,
        },
        { status: 422 }
      );
    }

    const normalized = validation.normalized;

    const submission = await prisma.$transaction(async (tx) => {
      // Re-verify counselor active and formVersion published inside transaction
      const counselorCheck = await tx.counselor.findFirst({
        where: { id: normalized.counselorId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!counselorCheck) {
        throw new Error('COUNSELOR_INACTIVE');
      }

      const versionCheck = await tx.formVersion.findFirst({
        where: { id: normalized.formVersionId, status: 'PUBLISHED' },
        select: { id: true },
      });
      if (!versionCheck) {
        throw new Error('FORM_VERSION_STALE');
      }

      return tx.submission.create({
        data: {
          firstName: normalized.firstName,
          lastName: normalized.lastName,
          counselorId: normalized.counselorId,
          formVersionId: normalized.formVersionId,
          submittedAt: new Date(),
          answers: {
            create: normalized.answers.map((ans) => ({
              questionId: ans.questionId,
              answerText: ans.answerText,
              answerData: ans.answerData as Prisma.InputJsonValue,
              questionSnapshot: ans.questionSnapshot as Prisma.InputJsonValue,
              optionsSnapshot: ans.optionsSnapshot
                ? (ans.optionsSnapshot as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            })),
          },
        },
        select: {
          id: true,
          submittedAt: true,
        },
      });
    });

    return NextResponse.json(
      {
        ok: true,
        submissionId: submission.id,
        submittedAt: submission.submittedAt,
        message: settings?.successMessage ?? 'پاسخهای شما با موفقیت ثبت شد.',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'COUNSELOR_INACTIVE') {
        return NextResponse.json(
          { error: 'مشاور انتخاب‌شده در حال حاضر فعال نیست.' },
          { status: 422 }
        );
      }
      if (error.message === 'FORM_VERSION_STALE') {
        return NextResponse.json(
          { error: 'نسخه فرم ارزیابی تغییر کرده است. لطفاً صفحه را تازه کنید.' },
          { status: 409 }
        );
      }
    }
    console.error('Submission error:', error);
    return NextResponse.json(
      { error: 'در ثبت ارزیابی خطایی رخ داد. لطفاً دوباره تلاش کنید.' },
      { status: 500 }
    );
  }
}
