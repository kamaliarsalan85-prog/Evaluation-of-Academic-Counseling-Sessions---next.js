import { AdminSessionRootProvider } from '@/components/admin/AdminContext';

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminSessionRootProvider>{children}</AdminSessionRootProvider>;
}
