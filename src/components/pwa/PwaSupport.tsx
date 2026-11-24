'use client';

import React, { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, WifiOff, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

export function PwaSupport() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          registration.update().catch(() => {});
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:left-4 sm:right-auto z-50 flex items-center gap-2.5 rounded-xl bg-[#142B4A] px-4 py-3 text-xs font-medium text-white shadow-lg"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-[#F59E0B]" aria-hidden="true" />
      <span>اتصال اینترنت قطع است. برای ثبت ارزیابی، اتصال برقرار شود.</span>
    </div>
  );
}

export function PWAInstallButton({ variant = 'header' }: { variant?: 'header' | 'card' }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  // On Android/Chromium when native prompt is ready
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          variant === 'header'
            ? 'inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#2878D0] px-2.5 sm:px-3.5 py-2 text-xs font-medium text-white hover:bg-[#1E63B3] transition-colors whitespace-nowrap shrink-0 cursor-pointer'
            : 'inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#2878D0] bg-white px-4 py-2 text-sm font-medium text-[#2878D0] hover:bg-[#F2F7FC] transition-colors whitespace-nowrap shrink-0 cursor-pointer'
        }
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        <span>
          نصب<span className="hidden sm:inline"> اپلیکیشن</span>
        </span>
      </button>
    );
  }

  // On iOS Safari or browsers without beforeinstallprompt: offer clean Persian guide modal
  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className={
          variant === 'header'
            ? 'inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-2.5 sm:px-3 py-2 text-xs font-medium text-white hover:bg-white/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer'
            : 'inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#1E293B] hover:bg-[#F2F7FC] transition-colors whitespace-nowrap shrink-0 cursor-pointer'
        }
      >
        <Smartphone className="h-4 w-4" aria-hidden="true" />
        <span>
          {variant === 'header' ? (
            isIOS ? (
              <>
                نصب<span className="hidden sm:inline"> در آیفون</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">راهنمای </span>نصب
              </>
            )
          ) : isIOS ? (
            'نصب در آیفون'
          ) : (
            'راهنمای نصب'
          )}
        </span>
      </button>

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-guide-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-[#E2E8F0] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
              <h2 id="pwa-install-guide-title" className="text-base font-bold text-[#1E293B]">
                نصب نسخه وب‌اپلیکیشن روی گوشی
              </h2>
              <button
                type="button"
                aria-label="بستن راهنمای نصب"
                onClick={() => setShowGuide(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F2F7FC] hover:text-[#1E293B] cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm leading-7 text-[#1E293B]">
              <div className="rounded-xl bg-[#F2F7FC] p-4 border border-[#E2E8F0]">
                <p className="font-semibold text-[#142B4A]">در آیفون و آیپد (مرورگر Safari):</p>
                <ol className="mt-2 space-y-2 text-[#1E293B] list-decimal list-inside">
                  <li className="flex items-start gap-2">
                    <Share className="mt-1.5 h-4 w-4 shrink-0 text-[#2878D0]" aria-hidden="true" />
                    <span>
                      در نوار پایین یا بالای مرورگر Safari، دکمه <strong>Share</strong> (مربع و فلش رو به بالا) را لمس کنید.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <PlusSquare className="mt-1.5 h-4 w-4 shrink-0 text-[#2878D0]" aria-hidden="true" />
                    <span>
                      در منوی بازشده به پایین بروید و گزینه <strong>Add to Home Screen</strong> را انتخاب کنید.
                    </span>
                  </li>
                  <li>در پایان دکمه <strong>Add</strong> را بزنید تا آیکون برنامه به صفحه اصلی اضافه شود.</li>
                </ol>
              </div>

              <div className="rounded-xl bg-[#F2F7FC] p-4 border border-[#E2E8F0]">
                <p className="font-semibold text-[#142B4A]">در اندروید (مرورگر Chrome):</p>
                <p className="mt-1 text-[#64748B]">
                  از منوی سه‌نقطه بالای مرورگر گزینه <strong>نصب برنامه (Install app)</strong> یا{' '}
                  <strong>افزودن به صفحه اصلی</strong> را انتخاب کنید.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-6 w-full min-h-[44px] rounded-xl bg-[#2878D0] py-2.5 text-sm font-medium text-white hover:bg-[#1E63B3] transition-colors cursor-pointer"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}
    </>
  );
}
