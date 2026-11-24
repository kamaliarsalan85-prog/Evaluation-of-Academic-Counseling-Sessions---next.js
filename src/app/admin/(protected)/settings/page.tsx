'use client';

import React, { useEffect, useState } from 'react';
import { useAdmin } from '@/components/admin/AdminContext';
import { useToast } from '@/components/ui/ToastProvider';
import { PermissionDeniedCard } from '@/components/admin/AdminShell';
import { Save, AlertCircle, CheckCircle2 } from 'lucide-react';

interface SettingsFormState {
  institutionName: string;
  appTitle: string;
  appDescription: string;
  successMessage: string;
  privacyNotice: string;
  isFormAvailable: boolean;
  isPublicSubmissionEnabled: boolean;
  timezone: string;
}

export default function AdminSettingsPage() {
  const { isSuperAdmin, adminFetch } = useAdmin();
  const toast = useToast();
  const [form, setForm] = useState<SettingsFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    adminFetch('/api/admin/settings', { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'خطا در دریافت تنظیمات');
        if (json.settings) {
          setForm({
            institutionName: json.settings.institutionName,
            appTitle: json.settings.appTitle,
            appDescription: json.settings.appDescription,
            successMessage: json.settings.successMessage,
            privacyNotice: json.settings.privacyNotice,
            isFormAvailable: json.settings.isFormAvailable,
            isPublicSubmissionEnabled: json.settings.isPublicSubmissionEnabled,
            timezone: json.settings.timezone,
          });
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'خطا در بارگذاری'))
      .finally(() => setLoading(false));
  }, [isSuperAdmin, adminFetch]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setFeedback(null);

    if (form.institutionName.trim().length < 2) {
      const msg = 'نام مرکز یا برند باید حداقل ۲ حرف باشد.';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (form.appTitle.trim().length < 2) {
      const msg = 'عنوان فرم ارزیابی باید حداقل ۲ حرف باشد.';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!form.appDescription.trim() || !form.successMessage.trim() || !form.privacyNotice.trim()) {
      const msg = 'لطفاً توضیحات صفحه اول، پیام موفقیت و متن حریم خصوصی را تکمیل کنید.';
      setError(msg);
      toast.error(msg);
      return;
    }

    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'خطا در ذخیره تنظیمات');
      const okMsg = 'تنظیمات سامانه با موفقیت ذخیره و در فرم عمومی اعمال شد.';
      setFeedback(okMsg);
      toast.success(okMsg);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'ذخیره تنظیمات انجام نشد';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return <PermissionDeniedCard />;
  }

  if (loading || !form) {
    return (
      <div className="rounded-2xl bg-white border border-[#E2E8F0] p-8 text-center text-sm text-[#64748B]">
        در حال بارگذاری تنظیمات...
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} noValidate className="max-w-3xl space-y-6">
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-[#DC4444]/40 bg-[#DC4444]/5 p-4 text-sm text-[#DC4444]"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-[#20A36B]/40 bg-[#20A36B]/5 p-4 text-sm text-[#20A36B]"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      )}

      <section className="rounded-2xl bg-white border border-[#E2E8F0] p-6 space-y-4">
        <h2 className="text-base font-bold text-[#142B4A] border-b border-[#E2E8F0] pb-3">
          مشخصات و متن‌های فرم عمومی
        </h2>

        <div>
          <label htmlFor="set_inst" className="block text-sm font-medium text-[#1E293B] mb-1">
            نام مرکز / برند
          </label>
          <input
            id="set_inst"
            type="text"
            required
            value={form.institutionName}
            onChange={(e) => setForm({ ...form, institutionName: e.target.value })}
            className="w-full min-h-[44px] rounded-xl border border-[#E2E8F0] px-3.5 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="set_title" className="block text-sm font-medium text-[#1E293B] mb-1">
            عنوان فرم ارزیابی
          </label>
          <input
            id="set_title"
            type="text"
            required
            value={form.appTitle}
            onChange={(e) => setForm({ ...form, appTitle: e.target.value })}
            className="w-full min-h-[44px] rounded-xl border border-[#E2E8F0] px-3.5 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="set_desc" className="block text-sm font-medium text-[#1E293B] mb-1">
            توضیحات صفحه اول
          </label>
          <textarea
            id="set_desc"
            rows={3}
            required
            value={form.appDescription}
            onChange={(e) => setForm({ ...form, appDescription: e.target.value })}
            className="w-full rounded-xl border border-[#E2E8F0] px-3.5 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="set_success" className="block text-sm font-medium text-[#1E293B] mb-1">
            پیام موفقیت پس از ثبت ارزیابی
          </label>
          <input
            id="set_success"
            type="text"
            required
            value={form.successMessage}
            onChange={(e) => setForm({ ...form, successMessage: e.target.value })}
            className="w-full min-h-[44px] rounded-xl border border-[#E2E8F0] px-3.5 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="set_privacy" className="block text-sm font-medium text-[#1E293B] mb-1">
            متن اعلامیه حریم خصوصی
          </label>
          <textarea
            id="set_privacy"
            rows={3}
            required
            value={form.privacyNotice}
            onChange={(e) => setForm({ ...form, privacyNotice: e.target.value })}
            className="w-full rounded-xl border border-[#E2E8F0] px-3.5 py-2 text-sm"
          />
        </div>
      </section>

      <section className="rounded-2xl bg-white border border-[#E2E8F0] p-6 space-y-4">
        <h2 className="text-base font-bold text-[#142B4A] border-b border-[#E2E8F0] pb-3">
          دسترس‌پذیری و منطقه زمانی
        </h2>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isFormAvailable}
            onChange={(e) => setForm({ ...form, isFormAvailable: e.target.checked })}
            className="h-4 w-4 accent-[#2878D0]"
          />
          <span className="text-sm text-[#1E293B]">نمایش فرم ارزیابی در دسترس عموم باشد</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isPublicSubmissionEnabled}
            onChange={(e) =>
              setForm({ ...form, isPublicSubmissionEnabled: e.target.checked })
            }
            className="h-4 w-4 accent-[#2878D0]"
          />
          <span className="text-sm text-[#1E293B]">امکان ثبت پاسخ جدید توسط کاربران فعال باشد</span>
        </label>

        <div className="max-w-xs">
          <label htmlFor="set_tz" className="block text-sm font-medium text-[#1E293B] mb-1">
            منطقه زمانی نمایش تاریخ‌ها
          </label>
          <input
            id="set_tz"
            type="text"
            dir="ltr"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            className="w-full min-h-[42px] rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm text-left"
          />
        </div>
      </section>

      <div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#2878D0] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1E63B3] disabled:opacity-60 cursor-pointer"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          <span>{saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}</span>
        </button>
      </div>
    </form>
  );
}
