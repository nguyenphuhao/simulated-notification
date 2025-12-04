import AdminLayout from '@/components/admin/admin-layout';

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}

