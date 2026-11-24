'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/components/admin/AdminContext';
import { useToast } from '@/components/ui/ToastProvider';
import { PermissionDeniedCard } from '@/components/admin/AdminShell';
import { ConfirmModal } from '@/components/admin/ConfirmModal';
import { formatJalaliDateTime, toPersianDigits } from '@/lib/jalali';
import {
  Search,
  Download,
  Trash2,
  Eye,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface SubmissionItem {
  id: string;
  firstName: string;
  lastName: string;
  counselor: { id: string; firstName: string; lastName: string; status: string };
  formVersion: { id: string; versionNumber: number };
  answersCount: number;
  submittedAt: string;
}

interface CounselorOption {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
}

export default function AdminSubmissionsPage() {
  const { hasPermission, adminFetch, downloadFile } = useAdmin();
  const toast = useToast();
  const canView = hasPermission('VIEW_SUBMISSIONS');
  const canSearch = hasPermission('SEARCH_SUBMISSIONS');
  const canViewDetails = hasPermission('VIEW_SUBMISSION_DETAILS');
  const canDelete = hasPermission('DELETE_SUBMISSIONS');
  const canExport = hasPermission('EXPORT_REPORTS');

  const [items, setItems] = useState<SubmissionItem[]>([]);
  const [counselors, setCounselors] = useState<CounselorOption[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [counselorId, setCounselorId] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [answerQuery, setAnswerQuery] = useState('');
  const [sortBy, setSortBy] = useState('submittedAt');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; fullName: string } | null>(null);

  const buildQueryString = useCallback(
    (targetPage: number) => {
      const sp = new URLSearchParams();
      sp.set('page', String(targetPage));
      sp.set('pageSize', '15');
      sp.set('sortBy', sortBy);
      sp.set('sortDir', sortDir);
      if (canSearch) {
        if (search.trim()) sp.set('search', search.trim());
        if (counselorId !== 'ALL') sp.set('counselorId', counselorId);
        if (dateFrom.trim()) sp.set('dateFrom', dateFrom.trim());
        if (dateTo.trim()) sp.set('dateTo', dateTo.trim());
        if (answerQuery.trim()) sp.set('answerQuery', answerQuery.trim());
      }
      return sp.toString();
    },
    [canSearch, search, counselorId, dateFrom, dateTo, answerQuery, sortBy, sortDir]
  );

  const loadSubmissions = useCallback(
    async (targetPage: number) => {
      if (!canView) return;
      setLoading(true);
      setError(null);
      try {
        const res = await adminFetch(`/api/admin/submissions?${buildQueryString(targetPage)}`, {
          cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'خطا در دریافت فهرست ارزیابی‌ها');
        setItems(data.items || []);
        setPage(data.pagination?.page || 1);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'خطا در دریافت اطلاعات');
      } finally {
        setLoading(false);
      }
    },
    [canView, adminFetch, buildQueryString]
  );

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    adminFetch('/api/admin/counselors', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { counselors: [] }))
      .then((data) => setCounselors(data.counselors || []))
      .catch(() => {});
  }, [canView, adminFetch]);

  useEffect(() => {
    loadSubmissions(page);
  }, [loadSubmissions, page]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    if (page !== 1) {
      setPage(1);
    } else {
      loadSubmissions(1);
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setCounselorId('ALL');
    setDateFrom('');
    setDateTo('');
    setAnswerQuery('');
    setSortBy('submittedAt');
    setSortDir('desc');
    setPage(1);
  };

  const confirmDelete = async () => {
    if (!canDelete || !deleteTarget) return;
    const { id, fullName } = deleteTarget;
    setDeletingId(id);
    setError(null);
    setFeedback(null);
    try {
      const res = await adminFetch(`/api/admin/submissions/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'خطا در حذف ارزیابی');
      setDeleteTarget(null);
      await loadSubmissions(page);
      const msg = `ارزیابی «${fullName}» با موفقیت حذف شد.`;
      setFeedback(msg);
      toast.success(msg);
    } catch (err) {
      const errMsg =
        err instanceof Error
          ? err.message
          : `حذف ارزیابی ${fullName} انجام نشد.`;
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setDeletingId(null);
    }
  };

  const exportUrl = (format: 'xlsx' | 'csv') => {
    const sp = new URLSearchParams(buildQueryString(1));
    sp.set('format', format);
    return `/api/admin/export?${sp.toString()}`;
  };

  if (!canView) {
    return <PermissionDeniedCard permission="VIEW_SUBMISSIONS" />;
  }

  return (
    <div className="space-y-6">
      {/* Search & Filter Panel */}
      {canSearch && (
        <form
          onSubmit={handleApplyFilters}
          className="rounded-2xl bg-white border border-[#E2E8F0] p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label htmlFor="filter_search" className="block text-xs font-medium text-[#64748B] mb-1">
                نام یا نام خانوادگی دانش‌آموز
              </label>
              <input
                id="filter_search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجو..."
                className="w-full min-h-[42px] rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#2878D0] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="filter_counselor" className="block text-xs font-medium text-[#64748B] mb-1">
                مشاور
              </label>
              <select
                id="filter_counselor"
                value={counselorId}
                onChange={(e) => setCounselorId(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm focus:border-[#2878D0] focus:outline-none"
              >
                <option value="ALL">همه مشاوران</option>
                {counselors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} {c.status === 'INACTIVE' ? '(غیرفعال)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter_date_from" className="block text-xs font-medium text-[#64748B] mb-1">
                از تاریخ (مثال: 1405/09/01)
              </label>
              <input
                id="filter_date_from"
                type="text"
                dir="ltr"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="1405/09/01"
                className="w-full min-h-[42px] rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm text-left focus:border-[#2878D0] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="filter_date_to" className="block text-xs font-medium text-[#64748B] mb-1">
                تا تاریخ (مثال: 1405/09/30)
              </label>
              <input
                id="filter_date_to"
                type="text"
                dir="ltr"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="1405/09/30"
                className="w-full min-h-[42px] rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm text-left focus:border-[#2878D0] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-end">
            <div>
              <label htmlFor="filter_answer" className="block text-xs font-medium text-[#64748B] mb-1">
                جستجو در متن پاسخ‌ها
              </label>
              <input
                id="filter_answer"
                type="text"
                value={answerQuery}
                onChange={(e) => setAnswerQuery(e.target.value)}
                placeholder="بخشی از پاسخ..."
                className="w-full min-h-[42px] rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#2878D0] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="filter_sort" className="block text-xs font-medium text-[#64748B] mb-1">
                مرتب‌سازی
              </label>
              <select
                id="filter_sort"
                value={`${sortBy}:${sortDir}`}
                onChange={(e) => {
                  const [sb, sd] = e.target.value.split(':');
                  setSortBy(sb);
                  setSortDir(sd as 'asc' | 'desc');
                }}
                className="w-full min-h-[42px] rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm focus:border-[#2878D0] focus:outline-none"
              >
                <option value="submittedAt:desc">جدیدترین ثبت</option>
                <option value="submittedAt:asc">قدیمی‌ترین ثبت</option>
                <option value="lastName:asc">نام خانوادگی دانش‌آموز (الف-ی)</option>
                <option value="counselor:asc">نام خانوادگی مشاور (الف-ی)</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#2878D0] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E63B3] cursor-pointer whitespace-nowrap"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span>اعمال فیلتر</span>
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex min-h-[42px] items-center rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] hover:bg-[#F2F7FC] cursor-pointer whitespace-nowrap"
              >
                پاک کردن
              </button>
            </div>
          </div>
        </form>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-2xl border border-[#DC4444]/40 bg-[#DC4444]/5 p-4 text-sm text-[#DC4444]"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-2xl border border-[#20A36B]/40 bg-[#20A36B]/5 p-4 text-sm text-[#20A36B]"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Results Header + Export Actions */}
      <section className="rounded-2xl bg-white border border-[#E2E8F0] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] px-5 py-4">
          <p className="text-sm font-semibold text-[#142B4A] tabular-nums">
            مجموع نتایج: {toPersianDigits(total)} ارزیابی
          </p>

          {canExport && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadFile(exportUrl('xlsx'), 'counseling-evaluations.xlsx')}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F2F7FC] cursor-pointer whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5 text-[#20A36B]" aria-hidden="true" />
                <span>خروجی Excel</span>
              </button>
              <button
                type="button"
                onClick={() => downloadFile(exportUrl('csv'), 'counseling-evaluations.csv')}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F2F7FC] cursor-pointer whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5 text-[#2878D0]" aria-hidden="true" />
                <span>خروجی CSV</span>
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-[#64748B]">در حال بارگذاری ارزیابی‌ها...</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#64748B]">
            هیچ ارزیابی مطابق فیلترهای انتخابی یافت نشد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-[#F2F7FC] text-xs font-semibold text-[#64748B] border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-5 py-3">نام دانش‌آموز</th>
                  <th className="px-5 py-3">مشاور</th>
                  <th className="px-5 py-3">نسخه فرم</th>
                  <th className="px-5 py-3">پاسخ‌ها</th>
                  <th className="px-5 py-3">تاریخ و ساعت ثبت</th>
                  <th className="px-5 py-3">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {items.map((item) => {
                  const fullName = `${item.firstName} ${item.lastName}`;
                  return (
                    <tr key={item.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-5 py-3.5 font-medium text-[#1E293B]">{fullName}</td>
                      <td className="px-5 py-3.5 text-[#64748B]">
                        {item.counselor.firstName} {item.counselor.lastName}
                      </td>
                      <td className="px-5 py-3.5 text-[#64748B] tabular-nums">
                        نسخه {toPersianDigits(item.formVersion.versionNumber)}
                      </td>
                      <td className="px-5 py-3.5 text-[#64748B] tabular-nums">
                        {toPersianDigits(item.answersCount)} سوال
                      </td>
                      <td className="px-5 py-3.5 text-[#64748B] tabular-nums whitespace-nowrap">
                        {formatJalaliDateTime(item.submittedAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {canViewDetails && (
                            <Link
                              href={`/admin/submissions/${item.id}`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-[#2878D0] hover:underline whitespace-nowrap"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>جزئیات</span>
                            </Link>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              disabled={deletingId === item.id}
                              onClick={() => setDeleteTarget({ id: item.id, fullName })}
                              aria-label={`حذف ارزیابی ${fullName}`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-[#DC4444] hover:underline disabled:opacity-50 cursor-pointer whitespace-nowrap"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>حذف</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#E2E8F0] px-5 py-3.5 text-xs text-[#64748B]">
            <span className="tabular-nums">
              صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#1E293B] hover:bg-[#F2F7FC] disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                <span>قبلی</span>
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#1E293B] hover:bg-[#F2F7FC] disabled:opacity-40 cursor-pointer"
              >
                <span>بعدی</span>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="تایید حذف ارزیابی"
        message={
          deleteTarget
            ? `آیا از حذف ارزیابی «${deleteTarget.fullName}» مطمئن هستید؟ این عملیات غیرقابل بازگشت است.`
            : ''
        }
        confirmLabel="حذف ارزیابی"
        variant="danger"
        busy={Boolean(deletingId)}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
