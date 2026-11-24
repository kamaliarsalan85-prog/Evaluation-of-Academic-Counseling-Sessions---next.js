import Link from 'next/link';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-[#F2F7FC] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-[#E2E8F0] p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2F7FC] text-[#142B4A]">
          <WifiOff className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-[#1E293B]">اتصال اینترنت برقرار نیست</h1>
        <p className="mt-3 text-sm leading-7 text-[#64748B]">
          برای دریافت سوالات به‌روز و ثبت نهایی ارزیابی جلسه مشاوره در پایگاه داده، اتصال اینترنت مورد نیاز است. پس از برقراری اتصال دوباره تلاش کنید.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#2878D0] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1E63B3] transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            تلاش مجدد
          </Link>
        </div>
      </div>
    </main>
  );
}
