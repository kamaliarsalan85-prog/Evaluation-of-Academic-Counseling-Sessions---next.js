import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hasPermission, requireAdminApi } from '@/lib/auth';
import { ensureDefaultAppData } from '@/lib/bootstrap';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  if (
    !hasPermission(auth.admin, 'MANAGE_QUESTIONS') &&
    !hasPermission(auth.admin, 'PUBLISH_FORM_VERSIONS')
  ) {
    return NextResponse.json(
      { error: 'شما مجوز مدیریت سوالات و فرم ارزیابی را ندارید.' },
      { status: 403 }
    );
  }

  try {
    await ensureDefaultAppData();

    const form = await prisma.form.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (!form) {
      return NextResponse.json({ error: 'فرم ارزیابی یافت نشد.' }, { status: 404 });
    }

    // Ensure a DRAFT version exists cloned from latest PUBLISHED version
    let draftVersion = await prisma.formVersion.findFirst({
      where: { formId: form.id, status: 'DRAFT' },
      orderBy: { versionNumber: 'desc' },
    });

    if (!draftVersion) {
      draftVersion = await prisma.$transaction(async (tx) => {
        const existingDraft = await tx.formVersion.findFirst({
          where: { formId: form.id, status: 'DRAFT' },
        });
        if (existingDraft) return existingDraft;

        const latestVersion = await tx.formVersion.findFirst({
          where: { formId: form.id },
          orderBy: { versionNumber: 'desc' },
          include: {
            questions: {
              orderBy: { displayOrder: 'asc' },
              include: { options: { orderBy: { displayOrder: 'asc' } } },
            },
          },
        });

        const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;
        const createdDraft = await tx.formVersion.create({
          data: {
            formId: form.id,
            versionNumber: nextVersionNumber,
            status: 'DRAFT',
            notes: `پیش‌نویس نسخه ${nextVersionNumber}`,
          },
        });

        if (latestVersion) {
          for (const q of latestVersion.questions) {
            const createdQ = await tx.question.create({
              data: {
                formVersionId: createdDraft.id,
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
                  questionId: createdQ.id,
                  optionText: opt.optionText,
                  displayOrder: opt.displayOrder,
                })),
              });
            }
          }
        }

        return createdDraft;
      });
    }

    const versions = await prisma.formVersion.findMany({
      where: { formId: form.id },
      orderBy: { versionNumber: 'desc' },
      include: {
        _count: { select: { submissions: true } },
        questions: {
          orderBy: { displayOrder: 'asc' },
          include: {
            options: { orderBy: { displayOrder: 'asc' } },
          },
        },
      },
    });

    const publishedVersion = versions.find((v) => v.status === 'PUBLISHED') ?? null;
    const currentDraft = versions.find((v) => v.status === 'DRAFT') ?? null;
    const archivedVersions = versions.filter((v) => v.status === 'ARCHIVED');

    return NextResponse.json({
      form,
      publishedVersion,
      draftVersion: currentDraft,
      archivedVersions,
    });
  } catch (error) {
    console.error('Forms GET error:', error);
    return NextResponse.json({ error: 'خطا در دریافت اطلاعات فرم.' }, { status: 500 });
  }
}
