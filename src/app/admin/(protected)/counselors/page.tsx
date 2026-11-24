'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/admin/AdminContext';
import { useToast } from '@/components/ui/ToastProvider';
import { PermissionDeniedCard } from '@/components/admin/AdminShell';
import { ConfirmModal } from '@/components/admin/ConfirmModal';
import { formatJalaliDate, toPersianDigits } from '@/lib/jalali';
import { Plus, Search, Edit3, Power, Trash2, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface CounselorRecord {
  id: string;
  firstName: string;
  lastName: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  submissionsCount: number;
}

export default function AdminCounselorsPage() {
  const { hasPermission, adminFetch } = useAdmin();
  const toast = useToast();
  const canManage = hasPermission('MANAGE_COUNSELORS');

  const [counselors, setCounselors] = useState<CounselorRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CounselorRecord | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [description, setDescription] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CounselorRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCounselors = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (search.trim()) sp.set('search', search.trim());
      const res = await adminFetch(`/api/admin/counselors?${sp.toString()}`, {
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'خطا در دریافت لیست مشاوران');
      setCounselors(json.counselors || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در دریافت اطلاعات');
    } finally {
      setLoading(false);
    }
  }, [canManage, adminFetch, search]);

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    loadCounselors();
  }, [canManage, loadCounselors]);

  const openAddModal = () => {
    setEditing(null);
    setFirstName('');
    setLastName('');
    setDescription('');
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = (c: CounselorRecord) => {
    setEditing(c);
    setFirstName(c.firstName);
    setLastName(c.lastName);
    setDescription(c.description || '');
    setModalError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setError(null);
    setFeedback(null);

    if (firstName.trim().length < 2) {
      setModalError('نام مشاور باید حداقل ۲ حرف باشد.');
      return;
    }
    if (lastName.trim().length < 2) {
      setModalError('نام خانوادگی مشاور باید حداقل ۲ حرف باشد.');
      return;
    }

    setSaving(true);
    try {
      const url = editing
        ? `/api/admin/counselors/${editing.id}`
        : '/api/admin/counselors';
      const method = editing ? 'PATCH' : 'POST';
      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          description: description.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'خطا در ذخیره اطلاعات مشاور');
      setModalOpen(false);
      await loadCounselors();
      const msg = editing ? 'اطلاعات مشاور با موفقیت به‌روزرسانی شد.' : 'مشاور جدید با موفقیت اضافه شد.';
      setFeedback(msg);
      toast.success(msg);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'ذخیره اطلاعات انجام نشد';
      setModalError(errMsg);
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (c: CounselorRecord) => {
    const nextStatus = c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setError(null);
    setFeedback(null);
    const res = await adminFetch(`/api/admin/counselors/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = json.error || 'تغییر وضعیت مشاور انجام نشد.';
      setError(errMsg);
      toast.error(errMsg);
      return;
    }
    await loadCounselors();
    const msg =
      nextStatus === 'ACTIVE'
        ? `مشاور «${c.firstName} ${c.lastName}» فعال شد.`
        : `مشاور «${c.firstName} ${c.lastName}» غیرفعال شد.`;
    setFeedback(msg);
    toast.success(msg);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    setFeedback(null);
    try {
      const deletedName = `${deleteTarget.firstName} ${deleteTarget.lastName}`;
      const res = await adminFetch(`/api/admin/counselors/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = json.error || 'حذف مشاور انجام نشد.';
        setError(errMsg);
        toast.error(errMsg);
        return;
      }
      setDeleteTarget(null);
      await loadCounselors();
      const msg = `مشاور «${deletedName}» با موفقیت حذف شد.`;
      setFeedback(msg);
      toast.success(msg);
    } finally {
      setDeleting(false);
    }
  };

  if (!canManage) {
    return <PermissionDeniedCard permission="MANAGE_COUNSELORS" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search
            className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]"
            aria-hidden="true"
          />
          <input
            type="text"
            aria-label="جستجوی مشاور"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی نام یا توضیحات مشاور..."
            className="w-full min-h-[44px] rounded-xl border border-[#E2E8F0] bg-white pr-10 pl-4 py-2 text-sm focus:border-[#2878D0] focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#2878D0] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1E63B3] cursor-pointer whitespace-nowrap"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>افزودن مشاور جدید</span>
        </button>
      </div>

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

      <section className="rounded-2xl bg-white border border-[#E2E8F0] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-[#64748B]">در حال بارگذاری...</div>
        ) : counselors.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#64748B]">
            مشاوری با این مشخصات یافت نشد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-[#F2F7FC] text-xs font-semibold text-[#64748B] border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-5 py-3">نام و نام خانوادگی</th>
                  <th className="px-5 py-3">توضیحات داخلی</th>
                  <th className="px-5 py-3">وضعیت</th>
                  <th className="px-5 py-3">تعداد ارزیابی‌ها</th>
                  <th className="px-5 py-3">تاریخ ایجاد</th>
                  <th className="px-5 py-3">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {counselors.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3.5 font-semibold text-[#1E293B]">
                      {c.firstName} {c.lastName}
                    </td>
                    <td className="px-5 py-3.5 text-[#64748B] max-w-xs truncate">
                      {c.description || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-xs font-semibold ${
                          c.status === 'ACTIVE' ? 'text-[#20A36B]' : 'text-[#64748B]'
                        }`}
                      >
                        {c.status === 'ACTIVE' ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[#1E293B] tabular-nums">
                      {toPersianDigits(c.submissionsCount)}
                    </td>
                    <td className="px-5 py-3.5 text-[#64748B] tabular-nums whitespace-nowrap">
                      {formatJalaliDate(c.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#2878D0] hover:underline cursor-pointer whitespace-nowrap"
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>ویرایش</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(c)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#142B4A] hover:underline cursor-pointer whitespace-nowrap"
                        >
                          <Power className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{c.status === 'ACTIVE' ? 'غیرفعال‌سازی' : 'فعال‌سازی'}</span>
                        </button>
                        {c.submissionsCount === 0 && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(c)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#DC4444] hover:underline cursor-pointer whitespace-nowrap"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>حذف</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="counselor-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-[#E2E8F0] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h2 id="counselor-modal-title" className="text-base font-bold text-[#142B4A]">
                {editing ? 'ویرایش اطلاعات مشاور' : 'افزودن مشاور جدید'}
              </h2>
              <button
                type="button"
                aria-label="بستن"
                onClick={() => setModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F2F7FC] cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSave} noValidate className="mt-4 space-y-4">
              {modalError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-xl border border-[#DC4444]/40 bg-[#DC4444]/5 p-3 text-xs font-medium text-[#DC4444]"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label htmlFor="c_first_name" className="block text-sm font-medium text-[#1E293B] mb-1">
                  نام
                </label>
                <input
                  id="c_first_name"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-[#E2E8F0] px-3.5 py-2 text-sm focus:border-[#2878D0] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="c_last_name" className="block text-sm font-medium text-[#1E293B] mb-1">
                  نام خانوادگی
                </label>
                <input
                  id="c_last_name"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-[#E2E8F0] px-3.5 py-2 text-sm focus:border-[#2878D0] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="c_desc" className="block text-sm font-medium text-[#1E293B] mb-1">
                  توضیحات داخلی (اختیاری)
                </label>
                <textarea
                  id="c_desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-[#E2E8F0] px-3.5 py-2 text-sm focus:border-[#2878D0] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[42px] rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] hover:bg-[#F2F7FC] cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] rounded-xl bg-[#2878D0] px-5 py-2 text-sm font-medium text-white hover:bg-[#1E63B3] disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'در حال ذخیره...' : 'ذخیره'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="تایید حذف مشاور"
        message={
          deleteTarget
            ? `آیا از حذف مشاور «${deleteTarget.firstName} ${deleteTarget.lastName}» مطمئن هستید؟`
            : ''
        }
        confirmLabel="حذف مشاور"
        variant="danger"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
