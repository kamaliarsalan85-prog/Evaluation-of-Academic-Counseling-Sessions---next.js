'use client';

import React, { useEffect, useState } from 'react';
import {
  AdminProvider,
  useAdminSessionRoot,
  type AdminUser,
} from './AdminContext';
import { AdminShell } from './AdminShell';

export function AdminAuthGate({
  initialAdmin,
  initialCsrfToken,
  children,
}: {
  initialAdmin: AdminUser | null;
  initialCsrfToken: string | null;
  children: React.ReactNode;
}) {
  const { memorySession, setMemorySession, isLoggingOut } = useAdminSessionRoot();
  const [checking, setChecking] = useState(
    !initialAdmin && !memorySession
  );

  useEffect(() => {
    if (isLoggingOut) {
      return;
    }

    if (initialAdmin || memorySession) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          cache: 'no-store',
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (!cancelled && data?.admin && data?.csrfToken) {
            setMemorySession({
              admin: data.admin,
              csrfToken: data.csrfToken,
              sessionToken: null,
            });
            setChecking(false);
            return;
          }
        }
      } catch {
        // Fall through to setup/login check
      }

      try {
        const statusRes = await fetch('/api/auth/setup-status', {
          cache: 'no-store',
        });
        const statusData = await statusRes.json().catch(() => ({}));
        if (!cancelled) {
          window.location.replace(
            statusData?.initialized === false ? '/admin/setup' : '/admin/login'
          );
        }
      } catch {
        if (!cancelled) {
          window.location.replace('/admin/login');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialAdmin, memorySession, isLoggingOut, setMemorySession]);

  if (isLoggingOut) {
    return (
      <main className="min-h-screen bg-[#F2F7FC] flex items-center justify-center p-4">
        <div className="rounded-2xl bg-white border border-[#E2E8F0] px-6 py-5 text-sm font-medium text-[#64748B] shadow-sm">
          در حال خروج از حساب کاربری...
        </div>
      </main>
    );
  }

  if (initialAdmin && initialCsrfToken) {
    return (
      <AdminProvider
        initialAdmin={initialAdmin}
        initialCsrfToken={initialCsrfToken}
        initialSessionToken={memorySession?.sessionToken ?? null}
      >
        <AdminShell>{children}</AdminShell>
      </AdminProvider>
    );
  }

  if (memorySession) {
    return (
      <AdminProvider
        initialAdmin={memorySession.admin}
        initialCsrfToken={memorySession.csrfToken}
        initialSessionToken={memorySession.sessionToken}
      >
        <AdminShell>{children}</AdminShell>
      </AdminProvider>
    );
  }

  return (
    <main className="min-h-screen bg-[#F2F7FC] flex items-center justify-center p-4">
      <div className="rounded-2xl bg-white border border-[#E2E8F0] px-6 py-5 text-sm font-medium text-[#64748B] shadow-sm">
        {checking ? 'در حال بررسی نشست کاربری...' : 'در حال انتقال به صفحه ورود...'}
      </div>
    </main>
  );
}
