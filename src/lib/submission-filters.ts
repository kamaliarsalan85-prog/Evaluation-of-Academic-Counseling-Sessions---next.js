import { Prisma } from '@prisma/client';
import { parseFlexibleDateRangeBound } from './jalali';

export interface SubmissionFilterParams {
  search?: string | null;
  counselorId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  answerQuery?: string | null;
  formVersionId?: string | null;
}

export function buildSubmissionWhere(params: SubmissionFilterParams): Prisma.SubmissionWhereInput {
  const andConditions: Prisma.SubmissionWhereInput[] = [];

  const search = params.search?.trim();
  if (search) {
    andConditions.push({
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  const counselorId = params.counselorId?.trim();
  if (counselorId && counselorId !== 'ALL') {
    andConditions.push({ counselorId });
  }

  const formVersionId = params.formVersionId?.trim();
  if (formVersionId && formVersionId !== 'ALL') {
    andConditions.push({ formVersionId });
  }

  const fromDate = parseFlexibleDateRangeBound(params.dateFrom, 'start');
  const toDate = parseFlexibleDateRangeBound(params.dateTo, 'end');
  if (fromDate || toDate) {
    const submittedAtFilter: Prisma.DateTimeFilter = {};
    if (fromDate) submittedAtFilter.gte = fromDate;
    if (toDate) submittedAtFilter.lte = toDate;
    andConditions.push({ submittedAt: submittedAtFilter });
  }

  const answerQuery = params.answerQuery?.trim();
  if (answerQuery) {
    andConditions.push({
      answers: {
        some: {
          answerText: { contains: answerQuery, mode: 'insensitive' },
        },
      },
    });
  }

  return andConditions.length > 0 ? { AND: andConditions } : {};
}
