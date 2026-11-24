import ExcelJS from 'exceljs';
import { formatJalaliDateTime } from './jalali';

export interface ExportableSubmission {
  id: string;
  firstName: string;
  lastName: string;
  submittedAt: Date;
  counselor: {
    firstName: string;
    lastName: string;
  };
  formVersion: {
    versionNumber: number;
  };
  answers: Array<{
    questionId: string;
    answerText: string | null;
    questionSnapshot: unknown;
  }>;
}

interface QuestionColumn {
  key: string;
  questionText: string;
}

function collectQuestionColumns(submissions: ExportableSubmission[]): QuestionColumn[] {
  const seen = new Map<string, string>();
  for (const sub of submissions) {
    for (const ans of sub.answers) {
      const snap = ans.questionSnapshot as { id?: string; questionText?: string } | null;
      const text = snap?.questionText?.trim() || `سوال ${ans.questionId.slice(0, 6)}`;
      if (!seen.has(text)) {
        seen.set(text, text);
      }
    }
  }
  return Array.from(seen.keys()).map((text, idx) => ({
    key: `q_${idx}`,
    questionText: text,
  }));
}

function escapeCsvCell(value: string): string {
  const safe = value.replace(/"/g, '""');
  // Guard against spreadsheet formula injection
  const formulaSafe = /^[=+\-@]/.test(safe) ? `'${safe}` : safe;
  return `"${formulaSafe}"`;
}

export function buildCsvExport(submissions: ExportableSubmission[]): Buffer {
  const qCols = collectQuestionColumns(submissions);
  const headers = [
    'ردیف',
    'نام',
    'نام خانوادگی',
    'مشاور',
    'نسخه فرم',
    'تاریخ و زمان ثبت (جلالی)',
    ...qCols.map((c) => c.questionText),
  ];

  const rows: string[] = [headers.map(escapeCsvCell).join(',')];

  submissions.forEach((sub, index) => {
    const answerByQuestionText = new Map<string, string>();
    for (const ans of sub.answers) {
      const snap = ans.questionSnapshot as { questionText?: string } | null;
      const qText = snap?.questionText?.trim() || `سوال ${ans.questionId.slice(0, 6)}`;
      answerByQuestionText.set(qText, ans.answerText ?? '—');
    }

    const rowCells = [
      String(index + 1),
      sub.firstName,
      sub.lastName,
      `${sub.counselor.firstName} ${sub.counselor.lastName}`,
      String(sub.formVersion.versionNumber),
      formatJalaliDateTime(sub.submittedAt, false),
      ...qCols.map((c) => answerByQuestionText.get(c.questionText) ?? '—'),
    ];

    rows.push(rowCells.map(escapeCsvCell).join(','));
  });

  // UTF-8 BOM so Microsoft Excel renders Persian characters properly
  const bom = '\uFEFF';
  return Buffer.from(bom + rows.join('\r\n'), 'utf8');
}

export async function buildXlsxExport(submissions: ExportableSubmission[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'سامانه ارزیابی جلسات مشاوره';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('ارزیابی‌ها', {
    views: [{ rightToLeft: true }],
  });

  const qCols = collectQuestionColumns(submissions);
  const columns = [
    { header: 'ردیف', key: 'row', width: 8 },
    { header: 'نام', key: 'firstName', width: 18 },
    { header: 'نام خانوادگی', key: 'lastName', width: 22 },
    { header: 'مشاور', key: 'counselor', width: 24 },
    { header: 'نسخه فرم', key: 'version', width: 12 },
    { header: 'تاریخ و زمان ثبت', key: 'submittedAt', width: 22 },
    ...qCols.map((c) => ({
      header: c.questionText,
      key: c.key,
      width: 32,
    })),
  ];

  sheet.columns = columns;

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF142B4A' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 28;

  submissions.forEach((sub, index) => {
    const answerByQuestionText = new Map<string, string>();
    for (const ans of sub.answers) {
      const snap = ans.questionSnapshot as { questionText?: string } | null;
      const qText = snap?.questionText?.trim() || `سوال ${ans.questionId.slice(0, 6)}`;
      answerByQuestionText.set(qText, ans.answerText ?? '—');
    }

    const rowData: Record<string, string | number> = {
      row: index + 1,
      firstName: sub.firstName,
      lastName: sub.lastName,
      counselor: `${sub.counselor.firstName} ${sub.counselor.lastName}`,
      version: sub.formVersion.versionNumber,
      submittedAt: formatJalaliDateTime(sub.submittedAt, true),
    };

    qCols.forEach((c) => {
      rowData[c.key] = answerByQuestionText.get(c.questionText) ?? '—';
    });

    const addedRow = sheet.addRow(rowData);
    addedRow.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
