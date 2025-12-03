import AdminLayout from '@/components/admin/admin-layout';

export default function LogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}

