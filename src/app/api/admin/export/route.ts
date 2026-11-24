import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp, requireAdminApi } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { buildSubmissionWhere } from '@/lib/submission-filters';
import { buildCsvExport, buildXlsxExport } from '@/lib/export';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req, { permission: 'EXPORT_REPORTS' });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const sp = req.nextUrl.searchParams;
  const format = sp.get('format') === 'csv' ? 'csv' : 'xlsx';
  const where = buildSubmissionWhere({
    search: sp.get('search'),
    counselorId: sp.get('counselorId'),
    dateFrom: sp.get('dateFrom'),
    dateTo: sp.get('dateTo'),
    answerQuery: sp.get('answerQuery'),
    formVersionId: sp.get('formVersionId'),
  });

  const submissions = await prisma.submission.findMany({
    where,
    orderBy: { submittedAt: 'desc' },
    include: {
      counselor: { select: { firstName: true, lastName: true } },
      formVersion: { select: { versionNumber: true } },
      answers: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  await recordAuditLog({
    adminId: auth.admin.id,
    action: 'REPORT_EXPORTED',
    entityType: 'Submission',
    metadata: {
      format,
      recordCount: submissions.length,
      counselorId: sp.get('counselorId') || null,
      dateFrom: sp.get('dateFrom') || null,
      dateTo: sp.get('dateTo') || null,
    },
    ipAddress: getClientIp(req),
  });

  const timestampSlug = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    const csvBuffer = buildCsvExport(submissions);
    return new NextResponse(new Uint8Array(csvBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="counseling-evaluations-${timestampSlug}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const xlsxBuffer = await buildXlsxExport(submissions);
  return new NextResponse(new Uint8Array(xlsxBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="counseling-evaluations-${timestampSlug}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
