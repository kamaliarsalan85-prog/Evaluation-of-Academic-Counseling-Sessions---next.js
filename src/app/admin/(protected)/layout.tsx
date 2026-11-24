import { getAuthenticatedAdmin } from '@/lib/auth';
import { AdminAuthGate } from '@/components/admin/AdminAuthGate';

export const dynamic = 'force-dynamic';

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAuthenticatedAdmin();

  return (
    <AdminAuthGate
      initialAdmin={
        admin
          ? {
              id: admin.id,
              username: admin.username,
              fullName: admin.fullName,
              role: admin.role,
              permissions: admin.permissions,
            }
          : null
      }
      initialCsrfToken={admin?.csrfToken ?? null}
    >
      {children}
    </AdminAuthGate>
  );
}
