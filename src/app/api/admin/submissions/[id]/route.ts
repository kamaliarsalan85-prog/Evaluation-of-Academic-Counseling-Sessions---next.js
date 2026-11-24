import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp, requireAdminApi } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { submissionEditSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi(req, { permission: 'VIEW_SUBMISSION_DETAILS' });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      counselor: { select: { id: true, firstName: true, lastName: true, status: true } },
      formVersion: { select: { id: true, versionNumber: true, publishedAt: true, status: true } },
      answers: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!submission) {
    return NextResponse.json({ error: 'ارزیابی مورد نظر یافت نشد.' }, { status: 404 });
  }

  // Sort answers by snapshot displayOrder so historical order is faithfully preserved
  const sortedAnswers = [...submission.answers].sort((a, b) => {
    const orderA = (a.questionSnapshot as { displayOrder?: number })?.displayOrder ?? 0;
    const orderB = (b.questionSnapshot as { displayOrder?: number })?.displayOrder ?? 0;
    return orderA - orderB;
  });

  return NextResponse.json({
    submission: {
      ...submission,
      answers: sortedAnswers,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi(req, { permission: 'EDIT_SUBMISSIONS' });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => null);
  const parsed = submissionEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'اطلاعات واردشده معتبر نیست.' },
      { status: 400 }
    );
  }

  const [existing, counselor] = await Promise.all([
    prisma.submission.findUnique({ where: { id } }),
    prisma.counselor.findUnique({ where: { id: parsed.data.counselorId } }),
  ]);

  if (!existing) {
    return NextResponse.json({ error: 'ارزیابی یافت نشد.' }, { status: 404 });
  }
  if (!counselor) {
    return NextResponse.json({ error: 'مشاور انتخاب‌شده یافت نشد.' }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.submission.update({
      where: { id },
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        counselorId: parsed.data.counselorId,
      },
      include: {
        counselor: { select: { id: true, firstName: true, lastName: true, status: true } },
        formVersion: { select: { id: true, versionNumber: true } },
      },
    });

    await recordAuditLog(
      {
        adminId: auth.admin.id,
        action: 'SUBMISSION_UPDATED',
        entityType: 'Submission',
        entityId: id,
        metadata: {
          before: {
            firstName: existing.firstName,
            lastName: existing.lastName,
            counselorId: existing.counselorId,
          },
          after: {
            firstName: row.firstName,
            lastName: row.lastName,
            counselorId: row.counselorId,
          },
        },
        ipAddress: getClientIp(req),
      },
      tx
    );

    return row;
  });

  return NextResponse.json({ submission: updated });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi(req, { permission: 'DELETE_SUBMISSIONS' });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { id } = await context.params;
  const existing = await prisma.submission.findUnique({
    where: { id },
    include: { counselor: { select: { firstName: true, lastName: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: 'ارزیابی مورد نظر یافت نشد.' }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.submission.delete({ where: { id } });
    await recordAuditLog(
      {
        adminId: auth.admin.id,
        action: 'SUBMISSION_DELETED',
        entityType: 'Submission',
        entityId: id,
        metadata: {
          studentName: `${existing.firstName} ${existing.lastName}`,
          counselorName: `${existing.counselor.firstName} ${existing.counselor.lastName}`,
          submittedAt: existing.submittedAt.toISOString(),
        },
        ipAddress: getClientIp(req),
      },
      tx
    );
  });

  return NextResponse.json({ ok: true });
}
