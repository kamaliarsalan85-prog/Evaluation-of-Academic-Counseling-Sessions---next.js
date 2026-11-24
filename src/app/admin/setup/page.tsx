'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAdminSessionRoot } from '@/components/admin/AdminContext';
import { useToast } from '@/components/ui/ToastProvider';

export default function AdminSetupPage() {
  const router = useRouter();
  const toast = useToast();
  const { setMemorySession } = useAdminSessionRoot();

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [requiresBootstrapSecret, setRequiresBootstrapSecret] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    fetch('/api/auth/setup-status', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            data.error ||
              'اتصال به پایگاه داده برقرار نیست. ابتدا اتصال PostgreSQL را برقرار کنید.'
          );
          setLoadingStatus(false);
          return;
        }
        if (data.initialized) {
          window.location.replace('/admin/login');
          return;
        }
        setRequiresBootstrapSecret(Boolean(data.requiresBootstrapSecret));
        setLoadingStatus(false);
      })
      .catch(() => {
        setError('خطا در بررسی وضعیت سیستم.');
        setLoadingStatus(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || redirecting) return;

    setError(null);
    setSuccessMessage(null);

    if (fullName.trim().length < 2) {
      const msg = 'نام و نام خانوادگی مدیر ارشد باید حداقل ۲ حرف باشد.';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username.trim())) {
      const msg = 'نام کاربری باید بین ۳ تا ۴۰ کاراکتر و فقط شامل حروف انگلیسی، اعداد و _ . - باشد.';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (password.length < 8) {
      const msg = 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (password !== confirmPassword) {
      const msg = 'رمز عبور و تکرار آن یکسان نیستند.';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (requiresBootstrapSecret && !bootstrapSecret.trim()) {
      const msg = 'وارد کردن کد امنیتی راه‌اندازی (ADMIN_BOOTSTRAP_SECRET) الزامی است.';
      setError(msg);
      toast.error(msg);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fullName: fullName.trim(),
          username: username.trim(),
          password,
          bootstrapSecret: requiresBootstrapSecret ? bootstrapSecret : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = data.error || 'خطا در ایجاد حساب مدیر ارشد.';
        setError(errMsg);
        toast.error(errMsg);
        setSubmitting(false);
        return;
      }

      if (!data?.admin || !data?.csrfToken) {
        const errMsg = 'پاسخ نامعتبر از سرور دریافت شد.';
        setError(errMsg);
        toast.error(errMsg);
        setSubmitting(false);
        return;
      }

      setMemorySession({
        admin: data.admin,
        csrfToken: data.csrfToken,
        sessionToken: typeof data.sessionToken === 'string' ? data.sessionToken : null,
      });

      setRedirecting(true);
      setSuccessMessage('حساب مدیر ارشد با موفقیت ایجاد شد. در حال انتقال به داشبورد...');
      toast.success('حساب مدیر ارشد ایجاد شد. خوش آمدید!');
      router.replace('/admin');
    } catch {
      const errMsg = 'ارتباط با سرور برقرار نشد.';
      setError(errMsg);
      toast.error(errMsg);
      setSubmitting(false);
    }
  };

  if (loadingStatus) {
    return (
      <main className="min-h-screen bg-[#F2F7FC] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white border border-[#E2E8F0] p-8 text-center text-sm text-[#64748B]">
          در حال بررسی وضعیت راه‌اندازی...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F2F7FC] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-[#E2E8F0] p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#E2E8F0] pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#142B4A] text-white">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#142B4A]">راه‌اندازی اولیه مدیر ارشد</h1>
            <p className="text-xs text-[#64748B]">ایجاد نخستین حساب Super Admin (یک‌بار مصرف)</p>
          </div>
        </div>

        <p className="mt-4 text-xs leading-6 text-[#64748B]">
          این صفحه فقط تا زمانی که هیچ مدیر ارشدی در پایگاه داده ثبت نشده باشد فعال است و بلافاصله پس از ثبت مسدود می‌شود.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#DC4444]/40 bg-[#DC4444]/5 p-3.5 text-xs font-medium leading-6 text-[#DC4444]"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#20A36B]/40 bg-[#20A36B]/5 p-3.5 text-xs font-medium leading-6 text-[#20A36B]"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
          <div>
            <label htmlFor="setup_fullname" className="block text-sm font-medium text-[#1E293B] mb-1.5">
              نام و نام خانوادگی مدیر ارشد
            </label>
            <input
              id="setup_fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="مثال: مدیر سیستم مرکز مشاوره"
              className="w-full min-h-[44px] rounded-xl border border-[#E2E8F0] px-3.5 py-2.5 text-sm focus:border-[#2878D0] focus:outline-none focus:ring-2 focus:ring-[#2878D0]/20"
            />
          </div>

          <div>
            <label htmlFor="setup_username" className="block text-sm font-medium text-[#1E293B] mb-1.5">
              نام کاربری (حروف انگلیسی)
            </label>
            <input
              id="setup_username"
              type="text"
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="superadmin"
              className="w-full min-h-[44px] rounded-xl border border-[#E2E8F0] px-3.5 py-2.5 text-sm text-left focus:border-[#2878D0] focus:outline-none focus:ring-2 focus:ring-[#2878D0]/20"
            />
          </div>

          <div>
            <label htmlFor="setup_password" className="block text-sm font-medium text-[#1E293B] mb-1.5">
              رمز عبور (حداقل ۸ کاراکتر)
            </label>
            <input
              id="setup_password"
              type="password"
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#E2E8F0] px-3.5 py-2.5 text-sm text-left focus:border-[#2878D0] focus:outline-none focus:ring-2 focus:ring-[#2878D0]/20"
            />
          </div>

          <div>
            <label htmlFor="setup_confirm_password" className="block text-sm font-medium text-[#1E293B] mb-1.5">
              تکرار رمز عبور
            </label>
            <input
              id="setup_confirm_password"
              type="password"
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#E2E8F0] px-3.5 py-2.5 text-sm text-left focus:border-[#2878D0] focus:outline-none focus:ring-2 focus:ring-[#2878D0]/20"
            />
          </div>

          {requiresBootstrapSecret && (
            <div>
              <label htmlFor="setup_secret" className="block text-sm font-medium text-[#1E293B] mb-1.5">
                کد امنیتی راه‌اندازی (ADMIN_BOOTSTRAP_SECRET)
              </label>
              <input
                id="setup_secret"
                type="password"
                dir="ltr"
                value={bootstrapSecret}
                onChange={(e) => setBootstrapSecret(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[#E2E8F0] px-3.5 py-2.5 text-sm text-left focus:border-[#2878D0] focus:outline-none focus:ring-2 focus:ring-[#2878D0]/20"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || redirecting}
            className="w-full min-h-[48px] rounded-xl bg-[#2878D0] py-3 text-sm font-semibold text-white hover:bg-[#1E63B3] disabled:opacity-60 transition-colors cursor-pointer"
          >
            {redirecting
              ? 'در حال انتقال به داشبورد...'
              : submitting
                ? 'در حال ثبت...'
                : 'ایجاد حساب مدیر ارشد و ورود'}
          </button>
        </form>

        <div className="mt-5 border-t border-[#E2E8F0] pt-4 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#142B4A]"
          >
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span>بازگشت به فرم ارزیابی عمومی</span>
          </a>
        </div>
      </div>
    </main>
  );
}
