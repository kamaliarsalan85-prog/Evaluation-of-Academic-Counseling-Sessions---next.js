'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/admin/AdminContext';
import { PermissionDeniedCard } from '@/components/admin/AdminShell';
import { QUESTION_TYPE_LABELS } from '@/lib/constants';
import { toPersianDigits } from '@/lib/jalali';
import { Download, Search, AlertCircle } from 'lucide-react';

interface ReportsResponse {
  totalSubmissions: number;
  counselorReports: Array<{
    counselorId: string;
    counselorName: string;
    status: string;
    totalSubmissions: number;
    averageRating: number | null;
  }>;
  questionSummaries: Array<{
    questionText: string;
    questionType: keyof typeof QUESTION_TYPE_LABELS;
    totalAnswers: number;
    averageRating: number | null;
    ratingDistribution: Array<{ score: number; count: number }>;
    optionBreakdown: Array<{ label: string; count: number }>;
  }>;
}

export default function AdminReportsPage() {
  const { hasPermission, adminFetch, downloadFile } = useAdmin();
  const canViewAnalytics = hasPermission('VIEW_ANALYTICS');
  const canExport = hasPermission('EXPORT_REPORTS');

  const [counselors, setCounselors] = useState<
    Array<{ id: string; firstName: string; lastName: string }>
  >([]);
  const [counselorId, setCounselorId] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [report, setReport] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildFilterQuery = useCallback(() => {
    const sp = new URLSearchParams();
    if (counselorId !== 'ALL') sp.set('counselorId', counselorId);
    if (dateFrom.trim()) sp.set('dateFrom', dateFrom.trim());
    if (dateTo.trim()) sp.set('dateTo', dateTo.trim());
    return sp.toString();
  }, [counselorId, dateFrom, dateTo]);

  const loadReports = useCallback(async () => {
    if (!canViewAnalytics && !canExport) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/admin/reports?${buildFilterQuery()}`, {
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'خطا در دریافت گزارش تحلیلی');
      setReport(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در بارگذاری گزارش');
    } finally {
      setLoading(false);
    }
  }, [canViewAnalytics, canExport, adminFetch, buildFilterQuery]);

  useEffect(() => {
    if (!canViewAnalytics && !canExport) {
      setLoading(false);
      return;
    }
    adminFetch('/api/admin/counselors', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { counselors: [] }))
      .then((json) => setCounselors(json.counselors || []))
      .catch(() => {});
    loadReports();
  }, [canViewAnalytics, canExport, adminFetch, loadReports]);

  if (!canViewAnalytics && !canExport) {
    return <PermissionDeniedCard permission="VIEW_ANALYTICS" />;
  }

  const exportUrl = (format: 'xlsx' | 'csv') => {
    const sp = new URLSearchParams(buildFilterQuery());
    sp.set('format', format);
    return `/api/admin/export?${sp.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Filters & Export Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          loadReports();
        }}
        className="rounded-2xl bg-white border border-[#E2E8F0] p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end"
      >
        <div>
          <label htmlFor="rep_counselor" className="block text-xs font-medium text-[#64748B] mb-1">
            فیلتر بر اساس مشاور
          </label>
          <select
            id="rep_counselor"
            value={counselorId}
            onChange={(e) => setCounselorId(e.target.value)}
            className="w-full min-h-[42px] rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">همه مشاوران</option>
            {counselors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rep_from" className="block text-xs font-medium text-[#64748B] mb-1">
            از تاریخ (جلالی یا میلادی)
          </label>
          <input
            id="rep_from"
            type="text"
            dir="ltr"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="1405/09/01"
            className="w-full min-h-[42px] rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm text-left"
          />
        </div>

        <div>
          <label htmlFor="rep_to" className="block text-xs font-medium text-[#64748B] mb-1">
            تا تاریخ (جلالی یا میلادی)
          </label>
          <input
            id="rep_to"
            type="text"
            dir="ltr"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="1405/09/30"
            className="w-full min-h-[42px] rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm text-left"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#2878D0] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E63B3] cursor-pointer whitespace-nowrap"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>به‌روزرسانی گزارش</span>
          </button>
        </div>
      </form>

      {canExport && (
        <div className="rounded-2xl bg-white border border-[#E2E8F0] p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-[#142B4A]">دریافت خروجی داده‌ها</h2>
            <p className="mt-0.5 text-xs text-[#64748B] tabular-nums">
              تعداد رکوردهای منطبق با فیلتر فعلی: {toPersianDigits(report?.totalSubmissions ?? 0)} ارزیابی
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => downloadFile(exportUrl('xlsx'), 'counseling-reports.xlsx')}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#20A36B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#198758] cursor-pointer whitespace-nowrap"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>دانلود فایل Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={() => downloadFile(exportUrl('csv'), 'counseling-reports.csv')}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#1E293B] hover:bg-[#F2F7FC] cursor-pointer whitespace-nowrap"
            >
              <Download className="h-4 w-4 text-[#2878D0]" aria-hidden="true" />
              <span>دانلود فایل CSV</span>
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-[#DC4444]/40 bg-[#DC4444]/5 p-4 text-sm text-[#DC4444]">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {canViewAnalytics && !loading && report && (
        <>
          {/* Counselor Report Table */}
          <section className="rounded-2xl bg-white border border-[#E2E8F0] overflow-hidden">
            <div className="border-b border-[#E2E8F0] px-5 py-4">
              <h2 className="text-base font-bold text-[#142B4A]">گزارش عملکرد مشاوران</h2>
            </div>

            {report.counselorReports.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#64748B]">
                داده‌ای در این بازه زمانی یافت نشد.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-[#F2F7FC] text-xs font-semibold text-[#64748B] border-b border-[#E2E8F0]">
                    <tr>
                      <th className="px-5 py-3">نام مشاور</th>
                      <th className="px-5 py-3">تعداد ارزیابی</th>
                      <th className="px-5 py-3">میانگین امتیاز</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {report.counselorReports.map((c) => (
                      <tr key={c.counselorId}>
                        <td className="px-5 py-3.5 font-medium text-[#1E293B]">
                          {c.counselorName}
                          {c.status === 'INACTIVE' && (
                            <span className="mr-1.5 text-xs text-[#64748B]">(غیرفعال)</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-[#1E293B] tabular-nums">
                          {toPersianDigits(c.totalSubmissions)}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-[#2878D0] tabular-nums">
                          {c.averageRating !== null
                            ? toPersianDigits(c.averageRating)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Question Summaries */}
          <section className="space-y-4">
            <h2 className="text-base font-bold text-[#142B4A]">تحلیل پاسخ سوالات</h2>

            {report.questionSummaries.length === 0 ? (
              <div className="rounded-2xl bg-white border border-[#E2E8F0] p-8 text-center text-sm text-[#64748B]">
                هنوز پاسخی برای تحلیل ثبت نشده است.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {report.questionSummaries.map((q, idx) => (
                  <div
                    key={`${q.questionText}-${idx}`}
                    className="rounded-2xl bg-white border border-[#E2E8F0] p-5 space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-[#64748B]">
                        <span>{QUESTION_TYPE_LABELS[q.questionType]}</span>
                        <span className="tabular-nums">
                          {toPersianDigits(q.totalAnswers)} پاسخ
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-sm font-bold text-[#1E293B] leading-6">
                        {q.questionText}
                      </h3>
                    </div>

                    {q.questionType === 'RATING' && (
                      <div className="space-y-2.5">
                        {q.averageRating !== null && (
                          <p className="text-xs font-semibold text-[#2878D0] tabular-nums">
                            میانگین امتیاز: {toPersianDigits(q.averageRating)}
                          </p>
                        )}
                        {q.ratingDistribution.map((row) => {
                          const pct =
                            q.totalAnswers > 0
                              ? Math.round((row.count / q.totalAnswers) * 100)
                              : 0;
                          return (
                            <div key={row.score} className="flex items-center gap-3 text-xs">
                              <span className="w-12 text-[#64748B] tabular-nums">
                                امتیاز {toPersianDigits(row.score)}
                              </span>
                              <div className="flex-1 h-2.5 rounded-full bg-[#F2F7FC] overflow-hidden">
                                <div
                                  style={{ width: `${pct}%` }}
                                  className="h-full rounded-full bg-[#2878D0]"
                                />
                              </div>
                              <span className="w-14 text-left text-[#1E293B] tabular-nums">
                                {toPersianDigits(row.count)} ({toPersianDigits(pct)}٪)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.optionBreakdown.length > 0 && (
                      <div className="space-y-2.5">
                        {q.optionBreakdown.map((opt) => {
                          const pct =
                            q.totalAnswers > 0
                              ? Math.round((opt.count / q.totalAnswers) * 100)
                              : 0;
                          return (
                            <div key={opt.label} className="space-y-1 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[#1E293B]">{opt.label}</span>
                                <span className="text-[#64748B] tabular-nums">
                                  {toPersianDigits(opt.count)} ({toPersianDigits(pct)}٪)
                                </span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-[#F2F7FC] overflow-hidden">
                                <div
                                  style={{ width: `${pct}%` }}
                                  className="h-full rounded-full bg-[#20A36B]"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.questionType === 'DESCRIPTIVE' && (
                      <p className="text-xs text-[#64748B]">
                        پاسخ‌های متنی برای این سوال در بخش جزئیات ارزیابی‌ها و خروجی اکسل قابل مطالعه است.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
