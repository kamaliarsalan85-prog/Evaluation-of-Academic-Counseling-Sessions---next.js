'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { PermissionKey } from '@/lib/constants';
import { useToast } from '@/components/ui/ToastProvider';

export interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
  permissions: PermissionKey[];
}

export interface MemoryAdminSession {
  admin: AdminUser;
  csrfToken: string;
  sessionToken: string | null;
}

interface AdminSessionRootContextValue {
  memorySession: MemoryAdminSession | null;
  setMemorySession: (session: MemoryAdminSession | null) => void;
  isLoggingOut: boolean;
  setIsLoggingOut: (value: boolean) => void;
}

const AdminSessionRootContext = createContext<AdminSessionRootContextValue | null>(null);

export function AdminSessionRootProvider({ children }: { children: React.ReactNode }) {
  const [memorySession, setMemorySessionState] = useState<MemoryAdminSession | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const setMemorySession = useCallback((session: MemoryAdminSession | null) => {
    if (session) {
      setIsLoggingOut(false);
    }
    setMemorySessionState(session);
  }, []);

  return (
    <AdminSessionRootContext.Provider
      value={{ memorySession, setMemorySession, isLoggingOut, setIsLoggingOut }}
    >
      {children}
    </AdminSessionRootContext.Provider>
  );
}

export function useAdminSessionRoot() {
  const ctx = useContext(AdminSessionRootContext);
  if (!ctx) {
    throw new Error('useAdminSessionRoot must be used inside AdminSessionRootProvider');
  }
  return ctx;
}

interface AdminContextValue {
  admin: AdminUser;
  csrfToken: string;
  hasPermission: (perm: PermissionKey) => boolean;
  isSuperAdmin: boolean;
  adminFetch: (input: string, init?: RequestInit) => Promise<Response>;
  downloadFile: (url: string, fallbackFilename: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({
  initialAdmin,
  initialCsrfToken,
  initialSessionToken = null,
  children,
}: {
  initialAdmin: AdminUser;
  initialCsrfToken: string;
  initialSessionToken?: string | null;
  children: React.ReactNode;
}) {
  const toast = useToast();
  const rootCtx = useContext(AdminSessionRootContext);

  const admin = initialAdmin;
  const csrfToken = initialCsrfToken;
  const sessionToken = initialSessionToken ?? rootCtx?.memorySession?.sessionToken ?? null;

  const csrfTokenRef = useRef(csrfToken);
  const sessionTokenRef = useRef(sessionToken);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    csrfTokenRef.current = csrfToken;
  }, [csrfToken]);

  useEffect(() => {
    sessionTokenRef.current = sessionToken;
  }, [sessionToken]);

  const hasPermission = useCallback(
    (perm: PermissionKey) => {
      if (admin.role === 'SUPER_ADMIN') return true;
      return admin.permissions.includes(perm);
    },
    [admin]
  );

  const adminFetch = useCallback(
    async (input: string, init?: RequestInit) => {
      const method = (init?.method || 'GET').toUpperCase();
      const headers = new Headers(init?.headers);
      if (sessionTokenRef.current) {
        headers.set('Authorization', `Bearer ${sessionTokenRef.current}`);
      }
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        headers.set('x-csrf-token', csrfTokenRef.current);
      }
      const res = await fetch(input, {
        ...init,
        credentials: 'include',
        headers,
      });
      if (res.status === 401 && !loggingOutRef.current) {
        rootCtx?.setMemorySession(null);
        window.location.replace('/admin/login?reason=expired');
      }
      return res;
    },
    [rootCtx]
  );

  const downloadFile = useCallback(
    async (url: string, fallbackFilename: string) => {
      try {
        const res = await adminFetch(url, { cache: 'no-store' });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || 'خطا در تهیه فایل خروجی');
        }
        const blob = await res.blob();
        const disposition = res.headers.get('content-disposition') || '';
        const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
        const filename = match ? decodeURIComponent(match[1] || match[2]) : fallbackFilename;

        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
        toast.success('فایل خروجی با موفقیت آماده و دانلود شد.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'دانلود فایل انجام نشد.');
      }
    },
    [adminFetch, toast]
  );

  const logout = useCallback(async () => {
    loggingOutRef.current = true;
    rootCtx?.setIsLoggingOut(true);
    try {
      const headers = new Headers({ 'x-csrf-token': csrfTokenRef.current });
      if (sessionTokenRef.current) {
        headers.set('Authorization', `Bearer ${sessionTokenRef.current}`);
      }
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers,
      });
    } finally {
      rootCtx?.setMemorySession(null);
      window.location.replace('/admin/login?reason=logout');
    }
  }, [rootCtx]);

  return (
    <AdminContext.Provider
      value={{
        admin,
        csrfToken,
        hasPermission,
        isSuperAdmin: admin.role === 'SUPER_ADMIN',
        adminFetch,
        downloadFile,
        logout,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error('useAdmin must be used inside AdminProvider');
  }
  return ctx;
}
