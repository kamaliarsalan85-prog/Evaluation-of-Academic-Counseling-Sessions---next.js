'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Lock,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldPlus,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAdminSessionRoot } from '@/components/admin/AdminContext';
import { useToast } from '@/components/ui/ToastProvider';

export default function AdminLoginPage() {
  const router = useRouter();
  const toast = useToast();
  const { setMemorySession } = useAdminSessionRoot();

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState<'username' | 'password' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason');
    if (reason === 'expired') {
      setError('نشست کاربری شما منقضی شده است. لطفاً دوباره وارد شوید.');
    } else if (reason === 'logout') {
      setSuccessMessage('از حساب کاربری خود با موفقیت خارج شدید.');
    }

    fetch('/api/auth/setup-status', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            data.error ||
              'اتصال به پایگاه داده برقرار نیست. لطفاً تنظیمات DATABASE_URL را بررسی کنید.'
          );
          return;
        }
        if (data && data.initialized === false) {
          setNeedsSetup(true);
        }
      })
      .catch(() => {
        setError('خطا در برقراری ارتباط با سرور.');
      })
      .finally(() => setCheckingSetup(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || redirecting) return;

    setError(null);
    setFieldError(null);
    setSuccessMessage(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      const msg = 'لطفاً نام کاربری خود را وارد کنید.';
      setError(msg);
      setFieldError('username');
      toast.error(msg);
      usernameRef.current?.focus();
      return;
    }
    if (!password) {
      const msg = 'لطفاً رمز عبور خود را وارد کنید.';
      setError(msg);
      setFieldError('password');
      toast.error(msg);
      passwordRef.current?.focus();
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: trimmedUsername, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = data.error || 'نام کاربری یا رمز عبور نادرست است.';
        setError(errMsg);
        toast.error(errMsg);
        setSubmitting(false);
        return;
      }

      if (!data?.admin || !data?.csrfToken) {
        const errMsg = 'پاسخ نامعتبر از سرور دریافت شد. لطفاً دوباره تلاش کنید.';
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
      const okMsg = 'ورود با موفقیت انجام شد. در حال انتقال به داشبورد...';
      setSuccessMessage(okMsg);
      toast.success('خوش آمدید! در حال ورود به داشبورد مدیریت...');
      router.replace('/admin');
    } catch {
      const errMsg = 'خطا در برقراری ارتباط با سرور. لطفاً دوباره تلاش کنید.';
      setError(errMsg);
      toast.error(errMsg);
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F2F7FC] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-[#E2E8F0] p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#E2E8F0] pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#142B4A] text-white">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#142B4A]">ورود به پنل مدیریت</h1>
            <p className="text-xs text-[#64748B]">سامانه ارزیابی جلسات مشاوره تحصیلی</p>
          </div>
        </div>

        {!checkingSetup && needsSetup ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl bg-[#F2F7FC] border border-[#E2E8F0] p-4 text-sm leading-7 text-[#1E293B]">
              هنوز هیچ مدیر ارشدی برای این سامانه تعریف نشده است. برای شروع، نخستین حساب مدیر ارشد (Super Admin) را ایجاد کنید.
            </div>
            <Link
              href="/admin/setup"
              prefetch={false}
              className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#2878D0] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1E63B3] transition-colors"
            >
              <ShieldPlus className="h-4 w-4" aria-hidden="true" />
              <span>ایجاد حساب مدیر ارشد اولیه</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-[#DC4444]/40 bg-[#DC4444]/5 p-3.5 text-xs font-medium leading-6 text-[#DC4444]"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-xl border border-[#20A36B]/40 bg-[#20A36B]/5 p-3.5 text-xs font-medium leading-6 text-[#20A36B]"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{successMessage}</span>
              </div>
            )}

            <div>
              <label htmlFor="login_username" className="block text-sm font-medium text-[#1E293B] mb-1.5">
                نام کاربری
              </label>
              <input
                ref={usernameRef}
                id="login_username"
                name="username"
                type="text"
                dir="ltr"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (fieldError === 'username') setFieldError(null);
                  if (error) setError(null);
                }}
                placeholder="username"
                className={`w-full min-h-[46px] rounded-xl border px-3.5 py-2.5 text-sm text-left focus:outline-none focus:ring-2 ${
                  fieldError === 'username'
                    ? 'border-[#DC4444] focus:border-[#DC4444] focus:ring-[#DC4444]/20'
                    : 'border-[#E2E8F0] focus:border-[#2878D0] focus:ring-[#2878D0]/20'
                }`}
              />
            </div>

            <div>
              <label htmlFor="login_password" className="block text-sm font-medium text-[#1E293B] mb-1.5">
                رمز عبور
              </label>
              <div className="relative">
                <input
                  ref={passwordRef}
                  id="login_password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldError === 'password') setFieldError(null);
                    if (error) setError(null);
                  }}
                  className={`w-full min-h-[46px] rounded-xl border pl-3.5 pr-11 py-2.5 text-sm text-left focus:outline-none focus:ring-2 ${
                    fieldError === 'password'
                      ? 'border-[#DC4444] focus:border-[#DC4444] focus:ring-[#DC4444]/20'
                      : 'border-[#E2E8F0] focus:border-[#2878D0] focus:ring-[#2878D0]/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'مخفی کردن رمز عبور' : 'نمایش رمز عبور'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F2F7FC] hover:text-[#1E293B] cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || redirecting || checkingSetup}
              className="w-full min-h-[48px] rounded-xl bg-[#2878D0] py-3 text-sm font-semibold text-white hover:bg-[#1E63B3] disabled:opacity-60 transition-colors cursor-pointer"
            >
              {redirecting
                ? 'در حال انتقال به داشبورد...'
                : submitting
                  ? 'در حال بررسی...'
                  : 'ورود به داشبورد'}
            </button>
          </form>
        )}

        <div className="mt-6 border-t border-[#E2E8F0] pt-4 text-center">
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
