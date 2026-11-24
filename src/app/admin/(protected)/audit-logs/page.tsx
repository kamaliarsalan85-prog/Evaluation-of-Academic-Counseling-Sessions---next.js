'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/admin/AdminContext';
import { PermissionDeniedCard } from '@/components/admin/AdminShell';
import { formatJalaliDateTime, toPersianDigits } from '@/lib/jalali';
import { ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';

interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  admin: {
    id: string;
    username: string;
    fullName: string;
    role: string;
  } | null;
}

const ACTION_LABELS: Record<string, string> = {
  INITIAL_SUPER_ADMIN_CREATED: 'ایجاد مدیر ارشد اولیه',
  ADMIN_LOGIN_SUCCESS: 'ورود موفق مدیر',
  ADMIN_LOGIN_FAILED: 'تلاش ناموفق ورود',
  ADMIN_LOGIN_LOCKED: 'قفل موقت حساب به دلیل خطای ورود',
  ADMIN_LOGOUT: 'خروج مدیر',
  ADMIN_CREATED: 'ایجاد حساب مدیر جدید',
  ADMIN_UPDATED: 'ویرایش حساب مدیر',
  ADMIN_DEACTIVATED: 'غیرفعال‌سازی مدیر',
  ADMIN_ACTIVATED: 'فعال‌سازی مدیر',
  ADMIN_PERMISSIONS_UPDATED: 'تغییر مجوزهای مدیر',
  COUNSELOR_CREATED: 'افزودن مشاور جدید',
  COUNSELOR_UPDATED: 'ویرایش اطلاعات مشاور',
  COUNSELOR_ACTIVATED: 'فعال‌سازی مشاور',
  COUNSELOR_DEACTIVATED: 'غیرفعال‌سازی مشاور',
  COUNSELOR_DELETED: 'حذف مشاور بدون سابقه',
  FORM_DRAFT_UPDATED: 'ویرایش پیش‌نویس فرم',
  FORM_VERSION_PUBLISHED: 'انتشار نسخه جدید فرم',
  SUBMISSION_UPDATED: 'ویرایش مشخصات ارزیابی',
  SUBMISSION_DELETED: 'حذف ارزیابی',
  REPORT_EXPORTED: 'دریافت خروجی گزارش',
  APP_SETTINGS_UPDATED: 'تغییر تنظیمات سامانه',
};

export default function AdminAuditLogsPage() {
  const { isSuperAdmin, adminFetch } = useAdmin();
  const toast = useToast();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(
    async (targetPage: number) => {
      if (!isSuperAdmin) return;
      setLoading(true);
      setError(null);
      try {
        const sp = new URLSearchParams();
        sp.set('page', String(targetPage));
        sp.set('pageSize', '20');
        if (actionFilter !== 'ALL') sp.set('action', actionFilter);
        const res = await adminFetch(`/api/admin/audit-logs?${sp.toString()}`, {
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          setLogs(json.logs || []);
          setPage(json.pagination?.page || 1);
          setTotalPages(json.pagination?.totalPages || 1);
        } else {
          const msg = json.error || 'خطا در دریافت گزارش فعالیت‌ها';
          setError(msg);
          toast.error(msg);
        }
      } catch {
        const msg = 'خطا در برقراری ارتباط با سرور هنگام دریافت گزارش فعالیت‌ها';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [isSuperAdmin, adminFetch, actionFilter, toast]
  );

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    loadLogs(page);
  }, [isSuperAdmin, page, loadLogs]);

  if (!isSuperAdmin) {
    return <PermissionDeniedCard />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white border border-[#E2E8F0] p-4 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-[#64748B]">
          فهرست ثبت‌شده تمام رویدادهای حساس مدیریتی و امنیتی سیستم (غیرقابل ویرایش).
        </p>

        <select
          aria-label="فیلتر نوع رویداد"
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="min-h-[40px] rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
        >
          <option value="ALL">همه رویدادها</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-[#DC4444]/40 bg-[#DC4444]/5 p-4 text-sm text-[#DC4444]"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <section className="rounded-2xl bg-white border border-[#E2E8F0] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-[#64748B]">در حال بارگذاری...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#64748B]">رویدادی ثبت نشده است.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-[#F2F7FC] text-xs font-semibold text-[#64748B] border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-5 py-3">رویداد</th>
                  <th className="px-5 py-3">مدیر عامل</th>
                  <th className="px-5 py-3">موجودیت</th>
                  <th className="px-5 py-3">جزئیات</th>
                  <th className="px-5 py-3">زمان ثبت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3.5 font-medium text-[#142B4A]">
                      {ACTION_LABELS[log.action] || log.action}
                    </td>
                    <td className="px-5 py-3.5 text-[#1E293B]">
                      {log.admin ? `${log.admin.fullName} (@${log.admin.username})` : 'سیستم'}
                    </td>
                    <td className="px-5 py-3.5 text-[#64748B]" dir="ltr">
                      {log.entityType}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#64748B] max-w-xs truncate" dir="ltr">
                      {log.metadata ? JSON.stringify(log.metadata) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-[#64748B] tabular-nums whitespace-nowrap">
                      {formatJalaliDateTime(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#1E293B] disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                <span>قبلی</span>
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#1E293B] disabled:opacity-40 cursor-pointer"
              >
                <span>بعدی</span>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
