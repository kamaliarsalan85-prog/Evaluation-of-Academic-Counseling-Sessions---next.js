import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getClientIp, requireAdminApi } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi(req, { permission: 'PUBLISH_FORM_VERSIONS' });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const draft = await tx.formVersion.findFirst({
        where: { status: 'DRAFT' },
        orderBy: { versionNumber: 'desc' },
        include: {
          questions: {
            orderBy: { displayOrder: 'asc' },
            include: { options: { orderBy: { displayOrder: 'asc' } } },
          },
        },
      });

      if (!draft) {
        throw new Error('NO_DRAFT');
      }

      const activeQuestions = draft.questions.filter((q) => q.isActive);
      if (activeQuestions.length === 0) {
        throw new Error('NO_ACTIVE_QUESTIONS');
      }

      for (const q of activeQuestions) {
        if (
          (q.questionType === 'SINGLE_CHOICE' || q.questionType === 'MULTIPLE_CHOICE') &&
          q.options.length < 2
        ) {
          throw new Error(`INVALID_OPTIONS:${q.questionText}`);
        }
      }

      // Archive previously published versions
      await tx.formVersion.updateMany({
        where: { formId: draft.formId, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED' },
      });

      // Promote draft to published
      const published = await tx.formVersion.update({
        where: { id: draft.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
        include: {
          _count: { select: { submissions: true } },
          questions: {
            orderBy: { displayOrder: 'asc' },
            include: { options: { orderBy: { displayOrder: 'asc' } } },
          },
        },
      });

      // Immediately create next isolated DRAFT version cloned from published
      const nextVersionNumber = published.versionNumber + 1;
      const nextDraft = await tx.formVersion.create({
        data: {
          formId: published.formId,
          versionNumber: nextVersionNumber,
          status: 'DRAFT',
          notes: `پیش‌نویس نسخه ${nextVersionNumber}`,
        },
      });

      for (const q of published.questions) {
        const clonedQ = await tx.question.create({
          data: {
            formVersionId: nextDraft.id,
            questionText: q.questionText,
            questionType: q.questionType,
            isRequired: q.isRequired,
            isActive: q.isActive,
            displayOrder: q.displayOrder,
            config: q.config ? (q.config as Prisma.InputJsonValue) : Prisma.JsonNull,
          },
        });
        if (q.options.length > 0) {
          await tx.questionOption.createMany({
            data: q.options.map((opt) => ({
              questionId: clonedQ.id,
              optionText: opt.optionText,
              displayOrder: opt.displayOrder,
            })),
          });
        }
      }

      await recordAuditLog(
        {
          adminId: auth.admin.id,
          action: 'FORM_VERSION_PUBLISHED',
          entityType: 'FormVersion',
          entityId: published.id,
          metadata: {
            versionNumber: published.versionNumber,
            activeQuestionsCount: activeQuestions.length,
          },
          ipAddress: getClientIp(req),
        },
        tx
      );

      return { publishedVersion: published, nextDraftId: nextDraft.id };
    });

    return NextResponse.json({
      ok: true,
      publishedVersion: result.publishedVersion,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NO_DRAFT') {
        return NextResponse.json({ error: 'نسخه پیش‌نویس برای انتشار یافت نشد.' }, { status: 404 });
      }
      if (error.message === 'NO_ACTIVE_QUESTIONS') {
        return NextResponse.json(
          { error: 'برای انتشار فرم، حداقل یک سوال فعال لازم است.' },
          { status: 400 }
        );
      }
      if (error.message.startsWith('INVALID_OPTIONS:')) {
        const qText = error.message.slice('INVALID_OPTIONS:'.length);
        return NextResponse.json(
          { error: `سوال «${qText}» باید حداقل دو گزینه داشته باشد.` },
          { status: 400 }
        );
      }
    }
    console.error('Publish form error:', error);
    return NextResponse.json({ error: 'خطا در انتشار نسخه جدید فرم.' }, { status: 500 });
  }
}
