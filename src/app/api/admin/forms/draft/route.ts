import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getClientIp, requireAdminApi } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { saveDraftFormSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest) {
  const auth = await requireAdminApi(req, { permission: 'MANAGE_QUESTIONS' });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = saveDraftFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'اطلاعات سوالات نامعتبر است.' },
      { status: 400 }
    );
  }

  for (const q of parsed.data.questions) {
    if (
      (q.questionType === 'SINGLE_CHOICE' || q.questionType === 'MULTIPLE_CHOICE') &&
      q.options.length < 2
    ) {
      return NextResponse.json(
        {
          error: `سوال «${q.questionText}» از نوع چندگزینه‌ای است و باید حداقل ۲ گزینه داشته باشد.`,
        },
        { status: 400 }
      );
    }
  }

  const draft = await prisma.formVersion.findFirst({
    where: { status: 'DRAFT' },
    orderBy: { versionNumber: 'desc' },
  });

  if (!draft) {
    return NextResponse.json(
      { error: 'نسخه پیش‌نویس یافت نشد. لطفاً صفحه را تازه کنید.' },
      { status: 404 }
    );
  }

  const updatedDraft = await prisma.$transaction(async (tx) => {
    // Double check draft has zero submissions before replacing questions
    const subCount = await tx.submission.count({ where: { formVersionId: draft.id } });
    if (subCount > 0 || draft.status !== 'DRAFT') {
      throw new Error('DRAFT_IMMUTABLE');
    }

    await tx.question.deleteMany({ where: { formVersionId: draft.id } });

    await tx.formVersion.update({
      where: { id: draft.id },
      data: {
        notes: parsed.data.notes ?? draft.notes,
      },
    });

    for (let idx = 0; idx < parsed.data.questions.length; idx++) {
      const q = parsed.data.questions[idx];
      const createdQ = await tx.question.create({
        data: {
          formVersionId: draft.id,
          questionText: q.questionText,
          questionType: q.questionType,
          isRequired: q.isRequired,
          isActive: q.isActive,
          displayOrder: idx,
          config: q.config ? (q.config as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });

      if (
        (q.questionType === 'SINGLE_CHOICE' || q.questionType === 'MULTIPLE_CHOICE') &&
        q.options.length > 0
      ) {
        await tx.questionOption.createMany({
          data: q.options.map((opt, optIdx) => ({
            questionId: createdQ.id,
            optionText: opt.optionText,
            displayOrder: optIdx,
          })),
        });
      }
    }

    await recordAuditLog(
      {
        adminId: auth.admin.id,
        action: 'FORM_DRAFT_UPDATED',
        entityType: 'FormVersion',
        entityId: draft.id,
        metadata: {
          versionNumber: draft.versionNumber,
          questionsCount: parsed.data.questions.length,
        },
        ipAddress: getClientIp(req),
      },
      tx
    );

    return tx.formVersion.findUnique({
      where: { id: draft.id },
      include: {
        _count: { select: { submissions: true } },
        questions: {
          orderBy: { displayOrder: 'asc' },
          include: { options: { orderBy: { displayOrder: 'asc' } } },
        },
      },
    });
  });

  return NextResponse.json({ draftVersion: updatedDraft });
}
