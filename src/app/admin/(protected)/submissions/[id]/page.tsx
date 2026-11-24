'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAdmin } from '@/components/admin/AdminContext';
import { PermissionDeniedCard } from '@/components/admin/AdminShell';
import { ConfirmModal } from '@/components/admin/ConfirmModal';
import { formatJalaliDateTime, toPersianDigits } from '@/lib/jalali';
import { QUESTION_TYPE_LABELS } from '@/lib/constants';
import { ArrowRight, Edit3, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';

interface SubmissionDetail {
  id: string;
  firstName: string;
  lastName: string;
  counselorId: string;
  submittedAt: string;
  counselor: { id: string; firstName: string; lastName: string; status: string };
  formVersion: { id: string; versionNumber: number; publishedAt: string | null };
  answers: Array<{
    id: string;
    questionId: string;
    answerText: string | null;
    answerData: Record<string, unknown> | null;
    questionSnapshot: {
      questionText: string;
      questionType: keyof typeof QUESTION_TYPE_LABELS;
      isRequired: boolean;
    };
    optionsSnapshot: Array<{ id: string; optionText: string }> | null;
  }>;
}

export default function SubmissionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission, adminFetch } = useAdmin();
  const toast = useToast();

  const canView = hasPermission('VIEW_SUBMISSION_DETAILS');
  const canEdit = hasPermission('EDIT_SUBMISSIONS');
  const canDelete = hasPermission('DELETE_SUBMISSIONS');

  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [counselors, setCounselors] = useState<
    Array<{ id: string; firstName: string; lastName: string; status: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editCounselorId, setEditCounselorId] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }

    Promise.all([
      adminFetch(`/api/admin/submissions/${params.id}`, { cache: 'no-store' }),
      canEdit
        ? adminFetch('/api/admin/counselors', { cache: 'no-store' })
        : Promise.resolve(null),
    ])
      .then(async ([subRes, cRes]) => {
        const subJson = await subRes.json().catch(() => ({}));
        if (!subRes.ok) throw new Error(subJson.error || 'خطا در دریافت جزئیات ارزیابی');
        setDetail(subJson.submission);
        setEditFirstName(subJson.submission.firstName);
        setEditLastName(subJson.submission.lastName);
        setEditCounselorId(subJson.submission.counselorId);

        if (cRes && cRes.ok) {
          const cJson = await cRes.json().catch(() => ({}));
          setCounselors(cJson.counselors || []);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'خطا در دریافت اطلاعات'))
      .finally(() => setLoading(false));
  }, [canView, canEdit, params.id, adminFetch]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setError(null);
    setFeedback(null);

    if (editFirstName.trim().length < 2 || editLastName.trim().length < 2) {
      const msg = 'نام و نام خانوادگی دانش‌آموز باید حداقل ۲ کاراکتر باشد.';
      setError(msg);
      toast.error(msg);
      return;
    }

    setSaving(true);
    try {
      const res = await adminFetch(`/api/admin/submissions/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          counselorId: editCounselorId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'ویرایش انجام نشد');
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              firstName: json.submission.firstName,
              lastName: json.submission.lastName,
              counselorId: json.submission.counselorId,
              counselor: json.submission.counselor,
            }
          : prev
      );
      setIsEditing(false);
      const okMsg = 'اطلاعات ارزیابی با موفقیت به‌روزرسانی شد.';
      setFeedback(okMsg);
      toast.success(okMsg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در ویرایش';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!detail || !canDelete) return;
    setDeleting(true);
    try {
      const res = await adminFetch(`/api/admin/submissions/${detail.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setConfirmDeleteOpen(false);
        toast.success('ارزیابی با موفقیت حذف شد.');
        router.push('/admin/submissions');
      } else {
        const json = await res.json().catch(() => ({}));
        const msg = json.error || 'حذف انجام نشد.';
        setError(msg);
        toast.error(msg);
      }
    } catch {
      const msg = 'خطا در برقراری ارتباط هنگام حذف ارزیابی.';
      setError(msg);
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  if (!canView) {
    return <PermissionDeniedCard permission="VIEW_SUBMISSION_DETAILS" />;
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-white border border-[#E2E8F0] p-8 text-center text-sm text-[#64748B]">
        در حال بارگذاری جزئیات...
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-white border border-[#DC4444]/40 p-6 text-sm text-[#DC4444]">
          {error}
        </div>
        <Link
          href="/admin/submissions"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2878D0]"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          <span>بازگشت به فهرست ارزیابی‌ها</span>
        </Link>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/submissions"
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F2F7FC]"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          <span>بازگشت به فهرست</span>
        </Link>

        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsEditing((prev) => !prev)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#2878D0] bg-white px-4 py-2 text-xs font-medium text-[#2878D0] hover:bg-[#F2F7FC] cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isEditing ? 'انصراف از ویرایش' : 'ویرایش مشخصات'}</span>
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#DC4444] px-4 py-2 text-xs font-medium text-white hover:bg-[#b91c1c] cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>حذف ارزیابی</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-2xl border border-[#20A36B]/40 bg-[#20A36B]/5 p-4 text-sm text-[#20A36B]">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-[#DC4444]/40 bg-[#DC4444]/5 p-4 text-sm text-[#DC4444]">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Metadata Summary */}
      <section className="rounded-2xl bg-white border border-[#E2E8F0] p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div>
            <p className="text-xs text-[#64748B]">نام و نام خانوادگی دانش‌آموز</p>
            <p className="mt-1 text-base font-bold text-[#142B4A]">
              {detail.firstName} {detail.lastName}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#64748B]">مشاور</p>
            <p className="mt-1 text-base font-bold text-[#142B4A]">
              {detail.counselor.firstName} {detail.counselor.lastName}
              {detail.counselor.status === 'INACTIVE' && (
                <span className="mr-1.5 text-xs font-normal text-[#64748B]">(غیرفعال)</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#64748B]">نسخه فرم ثبت‌شده</p>
            <p className="mt-1 text-base font-bold text-[#142B4A] tabular-nums">
              نسخه {toPersianDigits(detail.formVersion.versionNumber)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#64748B]">تاریخ و زمان ثبت</p>
            <p className="mt-1 text-base font-bold text-[#142B4A] tabular-nums">
              {formatJalaliDateTime(detail.submittedAt)}
            </p>
          </div>
        </div>

        {isEditing && canEdit && (
          <form
            noValidate
            onSubmit={handleSaveEdit}
            className="mt-6 border-t border-[#E2E8F0] pt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"
          >
            <div>
              <label htmlFor="edit_fn" className="block text-xs font-medium text-[#64748B] mb-1">
                نام
              </label>
              <input
                id="edit_fn"
                type="text"
                required
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="edit_ln" className="block text-xs font-medium text-[#64748B] mb-1">
                نام خانوادگی
              </label>
              <input
                id="edit_ln"
                type="text"
                required
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="edit_counselor" className="block text-xs font-medium text-[#64748B] mb-1">
                مشاور
              </label>
              <select
                id="edit_counselor"
                value={editCounselorId}
                onChange={(e) => setEditCounselorId(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
              >
                {counselors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="min-h-[42px] rounded-xl bg-[#2878D0] px-5 py-2 text-sm font-medium text-white hover:bg-[#1E63B3] disabled:opacity-60 cursor-pointer"
              >
                {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Immutable Historical Question & Answer Snapshots */}
      <section className="rounded-2xl bg-white border border-[#E2E8F0] p-6 space-y-5">
        <div className="border-b border-[#E2E8F0] pb-3">
          <h2 className="text-base font-bold text-[#142B4A]">
            پاسخ‌های ثبت‌شده (متن و گزینه‌های اصلی نسخه {toPersianDigits(detail.formVersion.versionNumber)})
          </h2>
          <p className="mt-1 text-xs text-[#64748B]">
            این پاسخ‌ها بر اساس نسخه تاریخی فرم در لحظه ثبت ذخیره شده‌اند و تغییرات بعدی سوالات روی آن اثر نمی‌گذارد.
          </p>
        </div>

        <div className="space-y-4">
          {detail.answers.map((ans, idx) => (
            <div
              key={ans.id}
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:p-5 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
                <span className="font-semibold text-[#142B4A] tabular-nums">
                  سوال {toPersianDigits(idx + 1)}
                </span>
                <span>
                  {QUESTION_TYPE_LABELS[ans.questionSnapshot.questionType] ||
                    ans.questionSnapshot.questionType}
                </span>
              </div>
              <p className="text-sm sm:text-base font-semibold text-[#1E293B]">
                {ans.questionSnapshot.questionText}
              </p>

              <div className="pt-2 border-t border-[#E2E8F0]">
                <p className="text-xs text-[#64748B] mb-1">پاسخ ثبت‌شده:</p>
                <p className="text-sm font-medium text-[#142B4A] whitespace-pre-wrap">
                  {ans.answerText || '—'}
                </p>
              </div>

              {ans.optionsSnapshot && ans.optionsSnapshot.length > 0 && (
                <p className="pt-1 text-xs text-[#64748B]">
                  گزینه‌های زمان ثبت:{' '}
                  {ans.optionsSnapshot.map((o) => o.optionText).join(' · ')}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <ConfirmModal
        open={confirmDeleteOpen}
        title="تایید حذف دائمی ارزیابی"
        message="آیا از حذف دائمی این ارزیابی اطمینان دارید؟ این عملیات غیرقابل بازگشت است."
        confirmLabel="حذف دائمی"
        variant="danger"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
