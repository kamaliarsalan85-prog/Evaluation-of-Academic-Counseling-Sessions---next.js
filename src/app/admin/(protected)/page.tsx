'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/components/admin/AdminContext';
import { PermissionDeniedCard } from '@/components/admin/AdminShell';
import { formatJalaliDateTime, toPersianDigits } from '@/lib/jalali';
import { AlertCircle, ArrowLeft } from 'lucide-react';

interface OverviewResponse {
  stats: {
    totalSubmissions: number;
    todaySubmissions: number;
    weekSubmissions: number;
    monthSubmissions: number;
    activeCounselorsCount: number;
    publishedQuestionsCount: number;
    activeFormVersionNumber: number;
  };
  dailyTrend: Array<{ dateKey: string; label: string; count: number }>;
  topCounselors: Array<{ id: string; name: string; status: string; count: number }>;
  recentSubmissions: Array<{
    id: string;
    studentName: string;
    counselorName: string;
    formVersionNumber: number;
    submittedAt: string;
  }>;
}

export default function AdminOverviewPage() {
  const { hasPermission, adminFetch } = useAdmin();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canView = hasPermission('VIEW_DASHBOARD');

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    adminFetch('/api/admin/overview', { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'خطا در دریافت آمار');
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'خطا در دریافت اطلاعات'))
      .finally(() => setLoading(false));
  }, [canView, adminFetch]);

  if (!canView) {
    return <PermissionDeniedCard permission="VIEW_DASHBOARD" />;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-28 rounded-2xl bg-white border border-[#E2E8F0] animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-white border border-[#E2E8F0] animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-white border border-[#DC4444]/40 p-6 flex items-center gap-3 text-sm text-[#DC4444]">
        <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span>{error || 'اطلاعات داشبورد در دسترس نیست.'}</span>
      </div>
    );
  }

  const maxDaily = Math.max(1, ...data.dailyTrend.map((d) => d.count));
  const maxCounselor = Math.max(1, ...data.topCounselors.map((c) => c.count));

  const kpis = [
    { label: 'کل ارزیابی‌های ثبت‌شده', value: data.stats.totalSubmissions },
    { label: 'ارزیابی‌های امروز', value: data.stats.todaySubmissions },
    { label: 'ارزیابی‌های این هفته', value: data.stats.weekSubmissions },
    { label: 'ارزیابی‌های این ماه', value: data.stats.monthSubmissions },
    { label: 'مشاوران فعال', value: data.stats.activeCounselorsCount },
    {
      label: `سوالات فعال (نسخه ${toPersianDigits(data.stats.activeFormVersionNumber)})`,
      value: data.stats.publishedQuestionsCount,
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <section aria-label="شاخص‌های کلیدی" className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl bg-white border border-[#E2E8F0] p-5 flex flex-col justify-between"
          >
            <span className="text-xs sm:text-sm font-medium text-[#64748B]">{item.label}</span>
            <span className="mt-3 text-2xl sm:text-3xl font-bold text-[#142B4A] tabular-nums">
              {toPersianDigits(item.value)}
            </span>
          </div>
        ))}
      </section>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 14-day Trend Bar Chart */}
        <section className="lg:col-span-2 rounded-2xl bg-white border border-[#E2E8F0] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4 border-b border-[#E2E8F0] pb-3">
            <h2 className="text-base font-bold text-[#142B4A]">روند ثبت ارزیابی در ۱۴ روز اخیر</h2>
            <span className="text-xs text-[#64748B]">بر اساس تقویم جلالی (تهران)</span>
          </div>

          <div className="mt-6 flex items-end gap-1.5 sm:gap-2.5 h-48 overflow-x-auto pb-2">
            {data.dailyTrend.map((day) => {
              const heightPct = Math.round((day.count / maxDaily) * 100);
              return (
                <div
                  key={day.dateKey}
                  className="flex-1 min-w-[26px] flex flex-col items-center justify-end h-full gap-1.5"
                >
                  <span className="text-[11px] font-medium text-[#64748B] tabular-nums">
                    {toPersianDigits(day.count)}
                  </span>
                  <div className="w-full flex-1 flex items-end bg-[#F2F7FC] rounded-t-lg overflow-hidden">
                    <div
                      title={`${day.label}: ${toPersianDigits(day.count)} ارزیابی`}
                      style={{ height: `${Math.max(day.count > 0 ? 8 : 0, heightPct)}%` }}
                      className="w-full rounded-t-lg bg-[#2878D0] transition-all"
                    />
                  </div>
                  <span className="text-[10px] text-[#64748B] tabular-nums whitespace-nowrap">
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Top Counselors */}
        <section className="rounded-2xl bg-white border border-[#E2E8F0] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
            <h2 className="text-base font-bold text-[#142B4A]">تعداد ارزیابی به تفکیک مشاور</h2>
          </div>

          <div className="mt-4 space-y-4">
            {data.topCounselors.length === 0 ? (
              <p className="text-sm text-[#64748B]">هنوز مشاوری ثبت نشده است.</p>
            ) : (
              data.topCounselors.map((c) => (
                <div key={c.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-[#1E293B]">
                      {c.name}
                      {c.status === 'INACTIVE' && (
                        <span className="mr-1.5 text-xs text-[#64748B]">(غیرفعال)</span>
                      )}
                    </span>
                    <span className="text-xs font-semibold text-[#142B4A] tabular-nums shrink-0">
                      {toPersianDigits(c.count)} مورد
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#F2F7FC] overflow-hidden">
                    <div
                      style={{ width: `${Math.round((c.count / maxCounselor) * 100)}%` }}
                      className="h-full rounded-full bg-[#20A36B]"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Recent Submissions */}
      <section className="rounded-2xl bg-white border border-[#E2E8F0] overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-[#E2E8F0] px-5 py-4 sm:px-6">
          <h2 className="text-base font-bold text-[#142B4A]">آخرین ارزیابی‌های ثبت‌شده</h2>
          {hasPermission('VIEW_SUBMISSIONS') && (
            <Link
              href="/admin/submissions"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#2878D0] hover:text-[#1E63B3] whitespace-nowrap"
            >
              <span>مشاهده همه</span>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>

        {data.recentSubmissions.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#64748B]">
            هنوز هیچ ارزیابی توسط دانش‌آموزان ثبت نشده است.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-[#F2F7FC] text-xs font-semibold text-[#64748B] border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-5 py-3">نام دانش‌آموز</th>
                  <th className="px-5 py-3">مشاور</th>
                  <th className="px-5 py-3">نسخه فرم</th>
                  <th className="px-5 py-3">زمان ثبت</th>
                  <th className="px-5 py-3">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {data.recentSubmissions.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3.5 font-medium text-[#1E293B]">
                      {item.studentName}
                    </td>
                    <td className="px-5 py-3.5 text-[#64748B]">{item.counselorName}</td>
                    <td className="px-5 py-3.5 text-[#64748B] tabular-nums">
                      نسخه {toPersianDigits(item.formVersionNumber)}
                    </td>
                    <td className="px-5 py-3.5 text-[#64748B] tabular-nums whitespace-nowrap">
                      {formatJalaliDateTime(item.submittedAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      {hasPermission('VIEW_SUBMISSION_DETAILS') ? (
                        <Link
                          href={`/admin/submissions/${item.id}`}
                          className="text-xs font-medium text-[#2878D0] hover:underline whitespace-nowrap"
                        >
                          مشاهده جزئیات
                        </Link>
                      ) : (
                        <span className="text-xs text-[#64748B]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
