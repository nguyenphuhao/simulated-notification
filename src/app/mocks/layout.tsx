import AdminLayout from '@/components/admin/admin-layout';

export default function MocksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}

