'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/admin/AdminContext';
import { useToast } from '@/components/ui/ToastProvider';
import { PermissionDeniedCard } from '@/components/admin/AdminShell';
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  type PermissionKey,
} from '@/lib/constants';
import { formatJalaliDateTime } from '@/lib/jalali';
import { Plus, Edit3, Power, AlertCircle, CheckCircle2, X, Shield } from 'lucide-react';

interface AdminRecord {
  id: string;
  username: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE';
  lastLoginAt: string | null;
  createdAt: string;
  permissions: PermissionKey[];
}

export default function AdminManagementPage() {
  const { isSuperAdmin, adminFetch } = useAdmin();
  const toast = useToast();

  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRecord | null>(null);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'SUPER_ADMIN' | 'ADMIN'>('ADMIN');
  const [permissions, setPermissions] = useState<PermissionKey[]>([
    'VIEW_DASHBOARD',
    'VIEW_SUBMISSIONS',
    'SEARCH_SUBMISSIONS',
    'VIEW_SUBMISSION_DETAILS',
  ]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadAdmins = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/admins', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'خطا در دریافت لیست مدیران');
      setAdmins(json.admins || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در دریافت اطلاعات');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, adminFetch]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    loadAdmins();
  }, [isSuperAdmin, loadAdmins]);

  const openCreateModal = () => {
    setEditing(null);
    setUsername('');
    setFullName('');
    setPassword('');
    setRole('ADMIN');
    setPermissions([
      'VIEW_DASHBOARD',
      'VIEW_SUBMISSIONS',
      'SEARCH_SUBMISSIONS',
      'VIEW_SUBMISSION_DETAILS',
    ]);
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = (a: AdminRecord) => {
    setEditing(a);
    setUsername(a.username);
    setFullName(a.fullName);
    setPassword('');
    setRole(a.role);
    setPermissions(a.permissions);
    setModalError(null);
    setModalOpen(true);
  };

  const togglePermission = (perm: PermissionKey) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setError(null);
    setFeedback(null);

    if (fullName.trim().length < 2) {
      setModalError('نام و نام خانوادگی مدیر باید حداقل ۲ حرف باشد.');
      return;
    }
    if (!editing && !/^[a-zA-Z0-9_.-]{3,40}$/.test(username.trim())) {
      setModalError('نام کاربری باید بین ۳ تا ۴۰ کاراکتر و فقط شامل حروف انگلیسی، اعداد و _ . - باشد.');
      return;
    }
    if ((!editing || password.trim().length > 0) && password.length < 8) {
      setModalError('رمز عبور باید حداقل ۸ کاراکتر باشد.');
      return;
    }

    setSaving(true);
    try {
      const url = editing ? `/api/admin/admins/${editing.id}` : '/api/admin/admins';
      const method = editing ? 'PATCH' : 'POST';

      const body = editing
        ? {
            fullName: fullName.trim(),
            role,
            permissions: role === 'SUPER_ADMIN' ? [...ALL_PERMISSIONS] : permissions,
            ...(password.trim() ? { password } : {}),
          }
        : {
            username: username.trim(),
            fullName: fullName.trim(),
            password,
            role,
            permissions: role === 'SUPER_ADMIN' ? [...ALL_PERMISSIONS] : permissions,
          };

      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'عملیات ذخیره مدیر انجام نشد.');

      setModalOpen(false);
      await loadAdmins();
      const msg = editing
        ? `اطلاعات و دسترسی‌های «${fullName.trim()}» به‌روزرسانی شد.`
        : `حساب مدیر جدید «${fullName.trim()}» با موفقیت ایجاد شد.`;
      setFeedback(msg);
      toast.success(msg);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'خطا در ذخیره اطلاعات';
      setModalError(errMsg);
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (a: AdminRecord) => {
    setError(null);
    setFeedback(null);
    const nextStatus = a.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const res = await adminFetch(`/api/admin/admins/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = json.error || 'تغییر وضعیت مدیر انجام نشد.';
      setError(errMsg);
      toast.error(errMsg);
      return;
    }
    await loadAdmins();
    const msg =
      nextStatus === 'ACTIVE'
        ? `حساب مدیر «${a.fullName}» فعال شد.`
        : `حساب مدیر «${a.fullName}» غیرفعال شد.`;
    setFeedback(msg);
    toast.success(msg);
  };

  if (!isSuperAdmin) {
    return <PermissionDeniedCard />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-[#64748B]">
          تعریف حساب‌های مدیریتی و تخصیص دقیق دسترسی‌ها برای هر مدیر.
        </p>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#2878D0] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1E63B3] cursor-pointer whitespace-nowrap"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>ایجاد مدیر جدید</span>
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-[#F2F7FC] text-xs font-semibold text-[#64748B] border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-5 py-3">نام و نام خانوادگی</th>
                  <th className="px-5 py-3">نام کاربری</th>
                  <th className="px-5 py-3">نقش</th>
                  <th className="px-5 py-3">وضعیت</th>
                  <th className="px-5 py-3">آخرین ورود</th>
                  <th className="px-5 py-3">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {admins.map((a) => (
                  <tr key={a.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3.5 font-semibold text-[#1E293B]">{a.fullName}</td>
                    <td className="px-5 py-3.5 text-[#64748B]" dir="ltr">
                      @{a.username}
                    </td>
                    <td className="px-5 py-3.5 text-[#142B4A] font-medium">
                      {a.role === 'SUPER_ADMIN' ? 'مدیر ارشد (کل دسترسی‌ها)' : 'مدیر عادی'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-xs font-semibold ${
                          a.status === 'ACTIVE' ? 'text-[#20A36B]' : 'text-[#DC4444]'
                        }`}
                      >
                        {a.status === 'ACTIVE' ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[#64748B] tabular-nums whitespace-nowrap">
                      {a.lastLoginAt ? formatJalaliDateTime(a.lastLoginAt) : 'هنوز وارد نشده'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openEditModal(a)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#2878D0] hover:underline cursor-pointer whitespace-nowrap"
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>ویرایش و دسترسی‌ها</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(a)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#142B4A] hover:underline cursor-pointer whitespace-nowrap"
                        >
                          <Power className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{a.status === 'ACTIVE' ? 'غیرفعال‌سازی' : 'فعال‌سازی'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-[#E2E8F0] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#142B4A]" aria-hidden="true" />
                <h2 id="admin-modal-title" className="text-base font-bold text-[#142B4A]">
                  {editing ? `ویرایش مدیر: ${editing.fullName}` : 'ایجاد حساب مدیر جدید'}
                </h2>
              </div>
              <button
                type="button"
                aria-label="بستن"
                onClick={() => setModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F2F7FC] cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSave} noValidate className="mt-5 space-y-4">
              {modalError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-xl border border-[#DC4444]/40 bg-[#DC4444]/5 p-3 text-xs font-medium text-[#DC4444]"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="adm_fullname" className="block text-sm font-medium text-[#1E293B] mb-1">
                    نام و نام خانوادگی
                  </label>
                  <input
                    id="adm_fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="adm_username" className="block text-sm font-medium text-[#1E293B] mb-1">
                    نام کاربری
                  </label>
                  <input
                    id="adm_username"
                    type="text"
                    dir="ltr"
                    required
                    disabled={Boolean(editing)}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm text-left disabled:bg-[#F2F7FC]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="adm_role" className="block text-sm font-medium text-[#1E293B] mb-1">
                    نقش مدیریتی
                  </label>
                  <select
                    id="adm_role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'SUPER_ADMIN' | 'ADMIN')}
                    className="w-full min-h-[42px] rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
                  >
                    <option value="ADMIN">مدیر عادی (با مجوزهای انتخابی)</option>
                    <option value="SUPER_ADMIN">مدیر ارشد (Super Admin)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="adm_password" className="block text-sm font-medium text-[#1E293B] mb-1">
                    {editing ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور (حداقل ۸ کاراکتر)'}
                  </label>
                  <input
                    id="adm_password"
                    type="password"
                    dir="ltr"
                    required={!editing}
                    minLength={editing ? 0 : 8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm text-left"
                  />
                </div>
              </div>

              {role === 'ADMIN' && (
                <div className="rounded-xl bg-[#F2F7FC] border border-[#E2E8F0] p-4 space-y-3">
                  <p className="text-xs font-bold text-[#142B4A]">
                    تعیین مجوزهای دقیق دسترسی
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {ALL_PERMISSIONS.map((perm) => {
                      const info = PERMISSION_LABELS[perm];
                      return (
                        <label
                          key={perm}
                          className="flex items-start gap-2.5 rounded-xl bg-white border border-[#E2E8F0] p-3 cursor-pointer hover:border-[#2878D0]"
                        >
                          <input
                            type="checkbox"
                            checked={permissions.includes(perm)}
                            onChange={() => togglePermission(perm)}
                            className="mt-1 h-4 w-4 accent-[#2878D0] shrink-0"
                          />
                          <div>
                            <p className="text-xs font-semibold text-[#1E293B]">{info.title}</p>
                            <p className="text-[11px] text-[#64748B]">{info.description}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[42px] rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] rounded-xl bg-[#2878D0] px-5 py-2 text-sm font-medium text-white hover:bg-[#1E63B3] disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'در حال ذخیره...' : 'ذخیره اطلاعات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
