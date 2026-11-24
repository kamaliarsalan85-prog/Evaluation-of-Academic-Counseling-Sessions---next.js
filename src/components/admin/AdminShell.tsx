'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  ListChecks,
  Shield,
  BarChart3,
  Settings,
  History,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ClipboardCheck,
} from 'lucide-react';
import { useAdmin } from './AdminContext';
import type { PermissionKey } from '@/lib/constants';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: boolean;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { admin, isSuperAdmin, hasPermission, logout } = useAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);

  const canViewForms =
    hasPermission('MANAGE_QUESTIONS') || hasPermission('PUBLISH_FORM_VERSIONS');
  const canViewReports =
    hasPermission('VIEW_ANALYTICS') || hasPermission('EXPORT_REPORTS');

  const navItems: NavItem[] = [
    {
      href: '/admin',
      label: 'نمای کلی داشبورد',
      icon: LayoutDashboard,
      visible: hasPermission('VIEW_DASHBOARD'),
    },
    {
      href: '/admin/submissions',
      label: 'ارزیابی‌های ثبت‌شده',
      icon: FileSpreadsheet,
      visible: hasPermission('VIEW_SUBMISSIONS'),
    },
    {
      href: '/admin/counselors',
      label: 'مدیریت مشاوران',
      icon: Users,
      visible: hasPermission('MANAGE_COUNSELORS'),
    },
    {
      href: '/admin/forms',
      label: 'فرم و سوالات',
      icon: ListChecks,
      visible: canViewForms,
    },
    {
      href: '/admin/admins',
      label: 'مدیریت مدیران',
      icon: Shield,
      visible: isSuperAdmin,
    },
    {
      href: '/admin/reports',
      label: 'گزارش‌ها و خروجی',
      icon: BarChart3,
      visible: canViewReports,
    },
    {
      href: '/admin/settings',
      label: 'تنظیمات سامانه',
      icon: Settings,
      visible: isSuperAdmin,
    },
    {
      href: '/admin/audit-logs',
      label: 'گزارش وقایع (Audit)',
      icon: History,
      visible: isSuperAdmin,
    },
  ].filter((item) => item.visible);

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const activeTitle =
    navItems.find((i) => isActive(i.href))?.label || 'پنل مدیریت';

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#142B4A] text-white">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <ClipboardCheck className="h-5 w-5 shrink-0 text-[#60A5FA]" aria-hidden="true" />
          <span className="truncate text-sm font-bold whitespace-nowrap">پنل مدیریت ارزیابی</span>
        </div>
        <button
          type="button"
          aria-label="بستن منو"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 cursor-pointer"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="منوی پنل مدیریت" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#2878D0] text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3 space-y-2">
        <div className="rounded-xl bg-white/5 px-3.5 py-2.5">
          <p className="truncate text-sm font-semibold text-white">{admin.fullName}</p>
          <p className="mt-0.5 text-xs text-white/70">
            {admin.role === 'SUPER_ADMIN' ? 'مدیر ارشد سیستم' : 'مدیر'} · @{admin.username}
          </p>
        </div>

        <button
          type="button"
          onClick={logout}
          className="flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-white/85 hover:bg-[#DC4444]/20 hover:text-white transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>خروج از حساب</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F2F7FC]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[264px] shrink-0 border-l border-[#E2E8F0]">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[272px] max-w-[85vw] h-full shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#E2E8F0] bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="باز کردن منوی مدیریت"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-[#E2E8F0] text-[#1E293B] hover:bg-[#F2F7FC] cursor-pointer"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <h1 className="truncate text-base sm:text-lg font-bold text-[#142B4A]">
              {activeTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href="/"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F2F7FC] transition-colors whitespace-nowrap shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5 text-[#2878D0]" aria-hidden="true" />
              <span>مشاهده فرم عمومی</span>
            </a>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PermissionDeniedCard({
  permission,
}: {
  permission?: PermissionKey;
}) {
  return (
    <div className="rounded-2xl bg-white border border-[#E2E8F0] p-8 text-center">
      <h2 className="text-lg font-bold text-[#1E293B]">دسترسی محدود شده است</h2>
      <p className="mt-2 text-sm text-[#64748B]">
        حساب کاربری شما مجوز دسترسی به این بخش{permission ? ` (${permission})` : ''} را ندارد.
      </p>
    </div>
  );
}
